package com.obhl.gateway.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.NotificationPrefDto;
import com.obhl.gateway.model.NotificationOptOut;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.NotificationOptOutRepository;
import com.obhl.gateway.repository.SeasonGoalieRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Who has switched off which broadcast email, and the no-login link that lets them do it.
 *
 * <p>The link exists because the people it matters most for — substitutes who drifted away — are
 * the least likely to remember a password. It has to work from the email in one click, forever.
 * So it carries no stored token: {@code ?u=<userId>&k=<kind>&t=<hmac>} where the HMAC is over
 * {@code userId:kind} with a key derived from the JWT secret. Nothing to expire, nothing to store,
 * and rotating the JWT secret invalidates every old link at once, which is the right failure mode.
 *
 * <p>The derived key is deliberately not the JWT secret itself: a signature that is also valid as
 * part of a JWT would be a foot-gun, and a domain label costs nothing.
 */
@Service
public class NotificationOptOutService {

    private static final String KEY_LABEL = "obhl-email-alerts-v1";

    private static final Map<String, String[]> KINDS = Map.of(
            NotificationOptOut.KIND_GOALIE_OPEN_SPOT, new String[] {
                    "Open goalie spot alerts",
                    "Sent to the whole goalie pool when a goalie declines or drops a game and the net "
                            + "needs filling, or when the coordinator asks for cover." });

    @Autowired
    private NotificationOptOutRepository optOutRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SeasonGoalieRepository seasonGoalieRepository;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${app.frontend.url:https://oldbuzzardhockey.com}")
    private String frontendUrl;

    // ---- reads used by the senders ----

    /** Everyone opted out of a kind, with when — the console shows the date beside their name. */
    public Map<Long, LocalDateTime> optedOutAtByUser(String kind) {
        Map<Long, LocalDateTime> out = new HashMap<>();
        for (NotificationOptOut o : optOutRepository.findByKind(kind)) {
            out.put(o.getUserId(), o.getCreatedAt());
        }
        return out;
    }

    public boolean isOptedOut(Long userId, String kind) {
        return optOutRepository.findByUserIdAndKind(userId, kind).isPresent();
    }

    // ---- the emailed link ----

    /** Absolute link for the email footer, pointing at the public toggle page. */
    public String unsubscribeLink(Long userId, String kind) {
        return frontendUrl + "/email-alerts?u=" + userId + "&k=" + kind + "&t=" + sign(userId, kind);
    }

    public NotificationPrefDto.TokenStatusView statusByToken(Long userId, String kind, String token) {
        User u = verify(userId, kind, token);
        return new NotificationPrefDto.TokenStatusView(firstName(u), maskEmail(u.getEmail()),
                view(u.getId(), normalizeKind(kind)));
    }

    @Transactional
    public NotificationPrefDto.TokenStatusView setByToken(Long userId, String kind, String token, boolean subscribed) {
        User u = verify(userId, kind, token);
        String k = normalizeKind(kind);
        set(u.getId(), k, subscribed);
        return new NotificationPrefDto.TokenStatusView(firstName(u), maskEmail(u.getEmail()), view(u.getId(), k));
    }

    // ---- the logged-in toggle (Account Settings) ----

    /**
     * The kinds this person can be sent, with their current answer. Only the goalie kind exists
     * today, and it is shown to anyone holding the GOALIE role or sitting in any season's goalie pool
     * — the pool is what the broadcast actually reads, so someone carried forward without the role
     * still needs the switch.
     */
    public List<NotificationPrefDto.AlertPrefView> getMine(User user) {
        boolean goalie = holdsRole(user, "GOALIE")
                || !seasonGoalieRepository.findByUserId(user.getId()).isEmpty();
        if (!goalie) {
            return List.of();
        }
        return List.of(view(user.getId(), NotificationOptOut.KIND_GOALIE_OPEN_SPOT));
    }

    @Transactional
    public List<NotificationPrefDto.AlertPrefView> setMine(User user, String kind, boolean subscribed) {
        set(user.getId(), normalizeKind(kind), subscribed);
        return getMine(user);
    }

    // ---- internals ----

    private void set(Long userId, String kind, boolean subscribed) {
        Optional<NotificationOptOut> existing = optOutRepository.findByUserIdAndKind(userId, kind);
        if (subscribed) {
            existing.ifPresent(optOutRepository::delete);
        } else if (existing.isEmpty()) {
            optOutRepository.save(new NotificationOptOut(null, userId, kind, null));
        }
    }

    private NotificationPrefDto.AlertPrefView view(Long userId, String kind) {
        String[] copy = KINDS.get(kind);
        Optional<NotificationOptOut> o = optOutRepository.findByUserIdAndKind(userId, kind);
        return new NotificationPrefDto.AlertPrefView(kind, copy[0], copy[1], o.isEmpty(),
                o.map(NotificationOptOut::getCreatedAt).orElse(null));
    }

    /**
     * Resolves a link back to its user, or throws with a message fit for the page. Every failure —
     * bad kind, unknown user, forged or stale signature — reads the same to the visitor, because the
     * distinction only helps someone probing the endpoint.
     */
    private User verify(Long userId, String kind, String token) {
        String k = kind == null ? "" : kind.trim().toUpperCase();
        if (userId == null || token == null || !KINDS.containsKey(k)) {
            throw new RuntimeException("This link is no longer valid.");
        }
        byte[] expected = sign(userId, k).getBytes(StandardCharsets.UTF_8);
        byte[] given = token.trim().getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, given)) {
            throw new RuntimeException("This link is no longer valid.");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("This link is no longer valid."));
    }

    private String normalizeKind(String kind) {
        String k = kind == null ? "" : kind.trim().toUpperCase();
        if (!KINDS.containsKey(k)) {
            throw new RuntimeException("Unknown alert kind");
        }
        return k;
    }

    private String sign(Long userId, String kind) {
        try {
            // Derived on every call rather than cached: cheap, and it keeps this stateless.
            Mac derive = Mac.getInstance("HmacSHA256");
            derive.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] key = derive.doFinal(KEY_LABEL.getBytes(StandardCharsets.UTF_8));
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            byte[] sig = mac.doFinal((userId + ":" + kind).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot sign email-alert link", e);
        }
    }

    private boolean holdsRole(User u, String roleName) {
        if (u.getRoles() != null && u.getRoles().stream().anyMatch(r -> roleName.equals(r.getName()))) {
            return true;
        }
        return roleName.equals(u.getRole());
    }

    private static String firstName(User u) {
        return (u.getFirstName() != null && !u.getFirstName().isBlank()) ? u.getFirstName() : u.getUsername();
    }

    /** "c***@gmail.com" — enough to recognise your own address, not enough to harvest it. */
    private static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "";
        }
        int at = email.indexOf('@');
        String local = email.substring(0, at);
        String shown = local.isEmpty() ? "" : local.substring(0, 1);
        return shown + "***" + email.substring(at);
    }
}
