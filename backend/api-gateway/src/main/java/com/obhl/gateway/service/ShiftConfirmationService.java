package com.obhl.gateway.service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
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
    private CoordinatorNotifyService coordinatorNotifyService;

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
        // Burn the confirm link. It was live for its full 7-day life even after being used, so the
        // original email could be reopened and used to decline a shift that was already confirmed and
        // published — flipping the row without taking anyone off the game. Changing your mind after
        // confirming is a drop, which goes through the dashboard and unpublishes properly.
        a.setConfirmTokenHash(null);
        a.setTokenExpiresAt(null);
        assignmentRepository.save(a);

        // A decline is the only response that needs the coordinator to do something. Confirms stay
        // silent on purpose: mailing those too would teach her to ignore this sender.
        if (declined) {
            try {
                coordinatorNotifyService.notifyDecline(a, userName(a.getUserId()), describeGame(a));
            } catch (RuntimeException e) {
                // Notice is best-effort; the decline itself is already persisted.
            }
        }
    }

    /** Every shift this person currently holds, at any stage — the source for their own dashboard. */
    public List<CoordinatorDto.AssignmentView> getMyAssignments(Long userId) {
        return assignmentRepository.findByUserIdAndStatusIn(userId, List.of(
                        ShiftAssignment.STATUS_PROPOSED,
                        ShiftAssignment.STATUS_AUTO_PROPOSED,
                        ShiftAssignment.STATUS_SIGNED_UP,
                        ShiftAssignment.STATUS_CONFIRMED))
                .stream().map(this::toView).collect(Collectors.toList());
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
