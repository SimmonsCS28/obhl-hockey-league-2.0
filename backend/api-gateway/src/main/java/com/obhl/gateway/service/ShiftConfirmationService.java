package com.obhl.gateway.service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.ShiftAssignmentRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Goalie/ref confirm-or-decline of a proposed shift, via emailed token link
 * (no login) or in-app (authenticated).
 */
@Service
public class ShiftConfirmationService {

    @Autowired
    private ShiftAssignmentRepository assignmentRepository;

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private TeamService teamService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private EmailService emailService;

    @Value("${app.frontend.url:https://oldbuzzardhockey.com}")
    private String frontendUrl;

    private static final DateTimeFormatter GAME_FMT = DateTimeFormatter.ofPattern("EEE MMM d, h:mm a");
    private static final ZoneId LEAGUE_TZ = ZoneId.of("America/Chicago");

    /** Validate a token and return the shift details for display (no status change). */
    public CoordinatorDto.AssignmentView getByToken(Long id, String token) {
        ShiftAssignment a = validateToken(id, token);
        return toView(a);
    }

    @Transactional
    public CoordinatorDto.AssignmentView respondByToken(Long id, String token, String action, String reason) {
        ShiftAssignment a = validateToken(id, token);
        applyResponse(a, action, reason);
        return toView(a);
    }

    @Transactional
    public CoordinatorDto.AssignmentView respondInApp(Long id, Long userId, String action, String reason) {
        ShiftAssignment a = assignmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Shift not found"));
        if (!a.getUserId().equals(userId)) {
            throw new RuntimeException("This shift is not assigned to you");
        }
        applyResponse(a, action, reason);
        return toView(a);
    }

    /** PROPOSED shifts awaiting this user's response. */
    public List<CoordinatorDto.AssignmentView> getPendingForUser(Long userId) {
        return assignmentRepository.findByUserIdAndStatus(userId, ShiftAssignment.STATUS_PROPOSED)
                .stream().map(this::toView).collect(Collectors.toList());
    }

    // ---- helpers ----

    private ShiftAssignment validateToken(Long id, String token) {
        if (id == null || token == null || token.isBlank()) {
            throw new RuntimeException("Invalid confirmation link.");
        }
        ShiftAssignment a = assignmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Invalid confirmation link."));
        if (a.getConfirmTokenHash() == null || a.getTokenExpiresAt() == null
                || LocalDateTime.now().isAfter(a.getTokenExpiresAt())) {
            throw new RuntimeException("This confirmation link has expired. Please contact your coordinator.");
        }
        if (!passwordEncoder.matches(token, a.getConfirmTokenHash())) {
            throw new RuntimeException("Invalid confirmation link.");
        }
        return a;
    }

    private void applyResponse(ShiftAssignment a, String action, String reason) {
        String act = action == null ? "" : action.trim().toLowerCase();
        boolean declined = false;
        if (act.equals("confirm")) {
            a.setStatus(ShiftAssignment.STATUS_CONFIRMED);
            a.setDeclineReason(null);
        } else if (act.equals("decline")) {
            a.setStatus(ShiftAssignment.STATUS_DECLINED);
            a.setDeclineReason(reason);
            declined = true;
        } else {
            throw new RuntimeException("Action must be 'confirm' or 'decline'");
        }
        a.setRespondedAt(LocalDateTime.now());
        assignmentRepository.save(a);

        // A decline is the only response that needs the coordinator to do something. Confirms stay
        // silent on purpose: mailing those too would teach her to ignore this sender.
        if (declined) {
            notifyCoordinatorOfDecline(a);
        }
    }

    /**
     * Email whoever has to find a replacement. Best-effort — the official's decline is already
     * recorded and must stand even if Resend is down; a lost notice degrades to "she sees it on the
     * board", which is exactly the status quo this improves on.
     */
    private void notifyCoordinatorOfDecline(ShiftAssignment a) {
        try {
            List<User> recipients = coordinatorsFor(a);
            if (recipients.isEmpty()) {
                return;
            }
            String who = userName(a.getUserId());
            String game = describeGame(a);
            String link = frontendUrl + "/coordinator";
            for (User c : recipients) {
                if (c.getEmail() == null || c.getEmail().isBlank()) {
                    continue;
                }
                String name = (c.getFirstName() != null && !c.getFirstName().isBlank())
                        ? c.getFirstName() : c.getUsername();
                emailService.sendDeclineNoticeEmail(c.getEmail(), name, who, roleLabel(a.getRole()),
                        game, a.getDeclineReason(), link);
            }
        } catch (RuntimeException e) {
            // Notice is best-effort; the decline itself is already persisted.
        }
    }

    /**
     * Who to tell. The coordinator who proposed the shift is the right person, but that column is
     * null on self-signups and on rows predating it, and they may no longer hold the role — so fall
     * back to everyone currently holding the matching coordinator role.
     */
    private List<User> coordinatorsFor(ShiftAssignment a) {
        String coordRole = coordinatorRole(a.getRole());
        if (a.getAssignedBy() != null) {
            User assigner = userRepository.findById(a.getAssignedBy()).orElse(null);
            if (assigner != null && holdsRole(assigner, coordRole)) {
                return List.of(assigner);
            }
        }
        // Both sources, because the deprecated single-role column is still populated and read.
        Map<Long, User> byId = new LinkedHashMap<>();
        userRepository.findByRoles_Name(coordRole).forEach(u -> byId.put(u.getId(), u));
        userRepository.findByRole(coordRole).forEach(u -> byId.put(u.getId(), u));
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

    /** Game line for the notice, in league-local time. */
    private String describeGame(ShiftAssignment a) {
        try {
            GameResponseDTO g = gameProxyService.getGameById(a.getGameId());
            if (g == null) {
                return "Game #" + a.getGameId();
            }
            String when = g.getGameDate() != null
                    ? g.getGameDate().atZone(ZoneOffset.UTC).withZoneSameInstant(LEAGUE_TZ).format(GAME_FMT)
                    : "TBD";
            String where = g.getRink() != null ? (" at " + g.getRink()) : "";
            return when + " — " + teamName(g.getHomeTeamId()) + " vs " + teamName(g.getAwayTeamId()) + where;
        } catch (RuntimeException e) {
            return "Game #" + a.getGameId();
        }
    }

    private CoordinatorDto.AssignmentView toView(ShiftAssignment a) {
        CoordinatorDto.AssignmentView v = new CoordinatorDto.AssignmentView();
        v.setId(a.getId());
        v.setGameId(a.getGameId());
        v.setSeasonId(a.getSeasonId());
        v.setRole(a.getRole());
        v.setSlot(a.getSlot());
        v.setUserId(a.getUserId());
        v.setUserName(userName(a.getUserId()));
        v.setStatus(a.getStatus());
        v.setPublished(a.getPublished());
        v.setDeclineReason(a.getDeclineReason());
        v.setRespondedAt(a.getRespondedAt());
        v.setUpdatedAt(a.getUpdatedAt());
        v.setTokenExpiresAt(a.getTokenExpiresAt());
        try {
            GameResponseDTO game = gameProxyService.getGameById(a.getGameId());
            if (game != null) {
                v.setWeek(game.getWeek());
                v.setGameDate(game.getGameDate());
                v.setRink(game.getRink());
                v.setHomeTeam(teamName(game.getHomeTeamId()));
                v.setAwayTeam(teamName(game.getAwayTeamId()));
            }
        } catch (Exception ignored) {
            // Game lookup is best-effort enrichment; the shift is still valid without it.
        }
        return v;
    }

    private String teamName(Long teamId) {
        if (teamId == null) {
            return "TBD";
        }
        return teamService.getTeamById(teamId).map(t -> t.getName()).orElse("Team " + teamId);
    }

    private String userName(Long userId) {
        return userRepository.findById(userId)
                .map(u -> (u.getFirstName() != null && u.getLastName() != null)
                        ? (u.getFirstName() + " " + u.getLastName())
                        : u.getUsername())
                .orElse("User " + userId);
    }
}
