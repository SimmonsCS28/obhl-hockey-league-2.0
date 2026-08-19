package com.obhl.gateway.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.model.CoordinatorNotificationPref;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.CoordinatorNotificationPrefRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Tells the coordinator when a shift falls through — either turned down before it was ever agreed
 * (a decline) or given up after (a drop).
 *
 * <p>Both live here rather than beside their triggers because they answer the same awkward question:
 * <em>who</em> is the coordinator for this shift. That answer has three fallbacks and is easy to get
 * subtly wrong, and having two copies of it drift apart is how one of these notices ends up going to
 * nobody.
 *
 * <p>Every send is best-effort. The event that triggered it — a decline, a drop, an unpublish — is
 * already committed and must stand even if Resend is down; a lost notice degrades to "they see it on
 * the board", which is the status quo these replace.
 */
@Service
public class CoordinatorNotifyService {

    // Deliberately permissive. This is a typo guard on a field the coordinator types for themselves,
    // not an authority on what an address may look like; rejecting a valid oddity would be worse
    // than accepting a wrong-but-plausible one, which they can see and correct.
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private CoordinatorNotificationPrefRepository prefRepository;

    @Value("${app.frontend.url:https://oldbuzzardhockey.com}")
    private String frontendUrl;

    /** Someone turned down a shift they had not yet agreed to. Opt-out via preferences; on by default. */
    public void notifyDecline(ShiftAssignment a, String whoDeclined, String gameDescription) {
        for (User c : recipientsFor(a)) {
            CoordinatorNotificationPref p = prefFor(c.getId(), a.getRole());
            if (p != null && Boolean.FALSE.equals(p.getNotifyOnDecline())) {
                continue;
            }
            emailService.sendDeclineNoticeEmail(addressFor(c, p), firstName(c), whoDeclined,
                    roleLabel(a.getRole()), gameDescription, a.getDeclineReason(), consoleLink(),
                    replyToFor(a));
        }
    }

    /** Someone accepted a shift. Off by default — the happy path, and there are a lot of them. */
    public void notifyConfirm(ShiftAssignment a, String whoConfirmed, String gameDescription) {
        for (User c : recipientsFor(a)) {
            CoordinatorNotificationPref p = prefFor(c.getId(), a.getRole());
            if (p == null || !Boolean.TRUE.equals(p.getNotifyOnConfirm())) {
                continue;
            }
            emailService.sendShiftAcceptedNoticeEmail(addressFor(c, p), firstName(c), whoConfirmed,
                    roleLabel(a.getRole()), gameDescription, consoleLink(), replyToFor(a));
        }
    }

    /**
     * Someone gave up a shift they had already confirmed. More urgent than a decline: if the slot was
     * published, that person's name was on the public schedule until a moment ago, so the coordinator
     * has to both find a replacement and republish the matchup.
     */
    public void notifyDrop(ShiftAssignment a, String whoDropped, String gameDescription, boolean wasPublished) {
        for (User c : recipientsFor(a)) {
            // No preference check: this one cannot be switched off, so there is no column for it.
            // A silent drop means somebody does not turn up to a game that may already be public.
            emailService.sendShiftDroppedEmail(addressFor(c, prefFor(c.getId(), a.getRole())), firstName(c),
                    whoDropped, roleLabel(a.getRole()), gameDescription, wasPublished, consoleLink(),
                    replyToFor(a));
        }
    }

    /**
     * These notices go to a coordinator <em>about</em> an official, so the reply they want to send is
     * to that official — "can you still make it?", "who can cover?". From is the league's unmonitored
     * noreply@, so without this their reply goes nowhere.
     */
    private String replyToFor(ShiftAssignment a) {
        if (a.getUserId() == null) {
            return null;
        }
        return userRepository.findById(a.getUserId())
                .map(User::getEmail)
                .filter(e -> e != null && !e.isBlank())
                .orElse(null);
    }

    /**
     * The settings panel for one person: one card per coordinator role they hold, plus the roles
     * nobody holds. An admin holding no coordinator role gets an empty {@code roles} list — a real
     * state with its own screen, since their only exposure is the unfilled-role fallback.
     */
    public CoordinatorDto.NotificationSettingsView getSettings(User user) {
        List<CoordinatorDto.NotificationPrefView> held = new ArrayList<>();
        List<String> unfilled = new ArrayList<>();

        for (String shiftRole : List.of("GOALIE", "REF", "SCOREKEEPER")) {
            String coordRole = coordinatorRole(shiftRole);
            List<User> holders = usersWithRole(coordRole);
            if (holders.isEmpty()) {
                unfilled.add(shiftRole);
            }
            if (!holdsRole(user, coordRole)) {
                continue;
            }
            CoordinatorNotificationPref p = prefFor(user.getId(), shiftRole);
            held.add(new CoordinatorDto.NotificationPrefView(
                    shiftRole,
                    p == null || Boolean.TRUE.equals(p.getNotifyOnDecline()),
                    p != null && Boolean.TRUE.equals(p.getNotifyOnConfirm()),
                    p == null ? null : p.getEmailOverride(),
                    user.getEmail(),
                    holders.stream()
                            .filter(h -> !h.getId().equals(user.getId()))
                            .map(this::displayName)
                            .toList()));
        }
        return new CoordinatorDto.NotificationSettingsView(held, unfilled, holdsRole(user, "ADMIN"));
    }

    /**
     * Save one role's settings. Refuses roles the caller doesn't hold, so the panel can't be used to
     * redirect somebody else's mail. The row is keyed by the authenticated user and the request
     * carries no user id, so there is no parameter here that could target another person.
     *
     * <p>Admins are deliberately <em>not</em> exempted: holding ADMIN grants console access without
     * making you a coordinator, which is the separation the whole feature exists to preserve. The
     * consequence is that nobody can fix a coordinator's typo'd address on their behalf from the app.
     * Considered and accepted 2026-08-15 — revisit only if that actually causes trouble.
     */
    @Transactional
    public void saveSettings(User user, CoordinatorDto.NotificationPrefView in) {
        String shiftRole = in.getRole() == null ? "" : in.getRole().trim().toUpperCase();
        if (!holdsRole(user, coordinatorRole(shiftRole))) {
            throw new RuntimeException("You don't hold the " + shiftRole + " coordinator role");
        }
        String override = in.getEmailOverride() == null ? null : in.getEmailOverride().trim();
        if (override != null && override.isEmpty()) {
            override = null;
        }
        if (override != null && !EMAIL_PATTERN.matcher(override).matches()) {
            throw new RuntimeException("That doesn't look like an email address");
        }

        CoordinatorNotificationPref p = prefRepository.findByUserIdAndRole(user.getId(), shiftRole)
                .orElseGet(CoordinatorNotificationPref::new);
        p.setUserId(user.getId());
        p.setRole(shiftRole);
        p.setNotifyOnDecline(in.isNotifyOnDecline());
        p.setNotifyOnConfirm(in.isNotifyOnConfirm());
        p.setEmailOverride(override);
        prefRepository.save(p);
    }

    private String displayName(User u) {
        if (u.getFirstName() != null && u.getLastName() != null) {
            return u.getFirstName() + " " + u.getLastName();
        }
        return u.getUsername();
    }

    private CoordinatorNotificationPref prefFor(Long userId, String role) {
        return prefRepository.findByUserIdAndRole(userId, role).orElse(null);
    }

    /** Where this person's mail for this role goes — their override, else their account address. */
    private String addressFor(User u, CoordinatorNotificationPref p) {
        if (p != null && p.getEmailOverride() != null && !p.getEmailOverride().isBlank()) {
            return p.getEmailOverride().trim();
        }
        return u.getEmail();
    }

    /**
     * Who to tell, in order of preference:
     * <ol>
     *   <li>the coordinator who proposed the shift — right in the normal case;</li>
     *   <li>everyone currently holding the matching coordinator role, when the proposer is unknown
     *       (self-signups, older rows) or has since lost the role;</li>
     *   <li>admins, but <em>only</em> when nobody holds that coordinator role at all.</li>
     * </ol>
     *
     * <p>The last step exists because the goalie and scorekeeper roles are unfilled and run from the
     * admin console — without it those notices resolve to an empty list and vanish silently. Keeping
     * it to a last resort means holding ADMIN grants console access without subscribing you to the
     * mail of a coordinator who does exist.
     *
     * <p>Anyone without a usable email address is dropped here rather than at each call site.
     */
    private List<User> recipientsFor(ShiftAssignment a) {
        String coordRole = coordinatorRole(a.getRole());

        List<User> chosen = null;
        if (a.getAssignedBy() != null) {
            User assigner = userRepository.findById(a.getAssignedBy()).orElse(null);
            if (assigner != null && holdsRole(assigner, coordRole)) {
                chosen = List.of(assigner);
            }
        }
        if (chosen == null) {
            chosen = usersWithRole(coordRole);
        }
        if (chosen.isEmpty()) {
            chosen = usersWithRole("ADMIN");
        }
        return chosen.stream()
                .filter(u -> u.getEmail() != null && !u.getEmail().isBlank())
                .toList();
    }

    /** Holders of a role, reading both the roles table and the deprecated single-role column. */
    private List<User> usersWithRole(String roleName) {
        Map<Long, User> byId = new LinkedHashMap<>();
        userRepository.findByRoles_Name(roleName).forEach(u -> byId.put(u.getId(), u));
        userRepository.findByRole(roleName).forEach(u -> byId.put(u.getId(), u));
        return new ArrayList<>(byId.values());
    }

    private boolean holdsRole(User u, String roleName) {
        if (u.getRoles() != null && u.getRoles().stream().anyMatch(r -> roleName.equals(r.getName()))) {
            return true;
        }
        return roleName.equals(u.getRole());
    }

    private String coordinatorRole(String role) {
        if ("REF".equals(role)) {
            return "REF_COORDINATOR";
        }
        if ("SCOREKEEPER".equals(role)) {
            return "SCOREKEEPER_COORDINATOR";
        }
        return "GOALIE_COORDINATOR";
    }

    private String roleLabel(String role) {
        if ("REF".equals(role)) {
            return "referee";
        }
        if ("SCOREKEEPER".equals(role)) {
            return "scorekeeper";
        }
        return "goalie";
    }

    private String firstName(User u) {
        return (u.getFirstName() != null && !u.getFirstName().isBlank()) ? u.getFirstName() : u.getUsername();
    }

    private String consoleLink() {
        return frontendUrl + "/coordinator";
    }
}
