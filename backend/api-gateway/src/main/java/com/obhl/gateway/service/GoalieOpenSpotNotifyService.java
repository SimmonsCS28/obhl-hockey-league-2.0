package com.obhl.gateway.service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.NotificationPrefDto;
import com.obhl.gateway.model.GoalieAvailability;
import com.obhl.gateway.model.NotificationOptOut;
import com.obhl.gateway.model.SeasonGoalie;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.GoalieAvailabilityRepository;
import com.obhl.gateway.repository.SeasonGoalieRepository;
import com.obhl.gateway.repository.ShiftAssignmentRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Tells the whole goalie pool when a net opens up.
 *
 * <p>Fires on a decline and on a drop — the two moments a slot goes from "someone's" back to open
 * without the coordinator choosing it — and on demand from the console's Alert Pool button. It does
 * <em>not</em> fire when the coordinator removes someone: that is the coordinator acting, usually
 * with a replacement already in mind, and mailing twenty people every time they click Remove would
 * train the pool to ignore the sender.
 *
 * <p>Deliberately one email per event with no batching or look-ahead window — accepted for v1 on
 * 2026-09-14, to be revisited if a busy decline week turns out to be noisy.
 *
 * <p>Every send is best-effort: the decline or drop that triggered it is already committed and
 * stands whatever happens here.
 */
@Service
public class GoalieOpenSpotNotifyService {

    private static final Logger logger = LoggerFactory.getLogger(GoalieOpenSpotNotifyService.class);

    private static final ZoneId LEAGUE_TZ = ZoneId.of("America/Chicago");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("EEE MMM d", Locale.ENGLISH);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);

    /** Why the net is open; picks the sentence in the card. */
    public enum Reason { DECLINED, DROPPED, MANUAL }

    @Autowired
    private SeasonGoalieRepository seasonGoalieRepository;

    @Autowired
    private ShiftAssignmentRepository assignmentRepository;

    @Autowired
    private GoalieAvailabilityRepository goalieAvailabilityRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private NotificationOptOutService optOutService;

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private TeamService teamService;

    @Value("${app.frontend.url:https://oldbuzzardhockey.com}")
    private String frontendUrl;

    /** Convenience for the decline/drop triggers, which hold the assignment that just fell through. */
    public NotificationPrefDto.OpenSpotOutcome notifySpotOpened(ShiftAssignment a, Reason reason) {
        if (!"GOALIE".equals(a.getRole())) {
            return empty();
        }
        return notifySpotOpened(a.getSeasonId(), a.getGameId(), a.getSlot() == null ? 1 : a.getSlot(),
                a.getUserId(), reason, null);
    }

    /**
     * Email everyone in the season's goalie pool — full-time and substitute alike — about one open
     * net, minus the people it can't be for: whoever just left it, anyone already in the other net,
     * anyone who marked that week unavailable, and anyone who unsubscribed.
     *
     * @param excludeUserId the goalie who just declined or dropped; null for a manual send
     * @param actingUserId  the coordinator pressing Alert Pool; null for the automatic triggers.
     *                      Becomes the Reply-To when present, so replies reach the person who asked.
     */
    public NotificationPrefDto.OpenSpotOutcome notifySpotOpened(Long seasonId, Long gameId, int slot,
            Long excludeUserId, Reason reason, Long actingUserId) {
        GameResponseDTO game = gameProxyService.getGameById(gameId);
        if (game == null) {
            return empty();
        }

        Set<Long> onGame = assignmentRepository.findByGameIdInAndRole(List.of(gameId), "GOALIE").stream()
                .filter(x -> x.getUserId() != null)
                .filter(x -> !ShiftAssignment.STATUS_DECLINED.equals(x.getStatus()))
                .map(ShiftAssignment::getUserId)
                .collect(Collectors.toSet());
        if (excludeUserId != null) {
            onGame.add(excludeUserId);
        }

        Set<Long> unavailable = game.getWeek() == null ? Set.of()
                : goalieAvailabilityRepository.findBySeasonIdAndWeek(seasonId, game.getWeek()).stream()
                        .filter(av -> GoalieAvailability.STATUS_UNAVAILABLE.equals(av.getStatus()))
                        .map(GoalieAvailability::getUserId)
                        .collect(Collectors.toSet());

        Map<Long, LocalDateTime> optedOut = optOutService.optedOutAtByUser(NotificationOptOut.KIND_GOALIE_OPEN_SPOT);

        // Who replies go to. The coordinator who pressed the button when there is one; otherwise the
        // goalie coordinator(s), falling back to admins the same way the decline notice does.
        User coordinator = actingUserId == null ? null : userRepository.findById(actingUserId).orElse(null);
        if (coordinator == null) {
            coordinator = firstWithEmail(usersWithRole("GOALIE_COORDINATOR"));
        }
        if (coordinator == null) {
            coordinator = firstWithEmail(usersWithRole("ADMIN"));
        }
        String coordinatorName = coordinator == null ? null : firstName(coordinator);
        String coordinatorEmail = coordinator == null ? null : coordinator.getEmail();

        // Rendered once; it is the same net for every recipient.
        String shortDate = "";
        String gameLine = "Game #" + gameId;
        if (game.getGameDate() != null) {
            ZonedDateTime local = game.getGameDate().atZone(ZoneOffset.UTC).withZoneSameInstant(LEAGUE_TZ);
            shortDate = local.format(DATE_FMT);
            gameLine = htmlEscape(shortDate + "  ·  " + local.format(TIME_FMT)
                    + (game.getRink() != null ? ("  ·  " + game.getRink()) : ""));
        }
        String home = teamName(game.getHomeTeamId());
        String away = teamName(game.getAwayTeamId());
        String net = (slot == 2 ? away : home) + " net";
        String matchupLine = htmlEscape(home + " vs " + away + "  ·  " + net);
        String whyLine = whyLine(reason, coordinatorName);
        String availabilityLink = frontendUrl + "/user/goalie-availability";
        String oneClickBase = frontendUrl + "/api/v1/auth/email-alerts/one-click";

        int eligible = 0;
        int sent = 0;
        int skippedOptedOut = 0;
        int skippedUnavailable = 0;
        int skippedOnGame = 0;
        List<String> sentTo = new ArrayList<>();

        for (SeasonGoalie sg : seasonGoalieRepository.findBySeasonId(seasonId)) {
            Long uid = sg.getUserId();
            if (uid == null) {
                continue;
            }
            if (onGame.contains(uid)) {
                skippedOnGame++;
                continue;
            }
            if (unavailable.contains(uid)) {
                skippedUnavailable++;
                continue;
            }
            if (optedOut.containsKey(uid)) {
                skippedOptedOut++;
                continue;
            }
            try {
                Optional<User> userOpt = userRepository.findById(uid);
                if (userOpt.isEmpty() || userOpt.get().getEmail() == null || userOpt.get().getEmail().isBlank()) {
                    continue;
                }
                User user = userOpt.get();
                eligible++;
                String unsubscribeLink = optOutService.unsubscribeLink(uid, NotificationOptOut.KIND_GOALIE_OPEN_SPOT);
                // The one-click URL is the same signed triple, pointed at the API instead of the page.
                String oneClick = oneClickBase + unsubscribeLink.substring(unsubscribeLink.indexOf('?'));
                if (emailService.sendGoalieOpenSpotEmail(user.getEmail(), firstName(user), shortDate, gameLine,
                        matchupLine, whyLine, coordinatorName, coordinatorEmail, availabilityLink,
                        unsubscribeLink, oneClick)) {
                    sent++;
                    sentTo.add(firstName(user));
                }
            } catch (RuntimeException e) {
                // Skip this goalie; the rest of the pool still gets told.
                logger.warn("Open-spot alert to user {} failed: {}", uid, e.getMessage());
            }
        }

        logger.info("Open-spot alert for game {} slot {} ({}): {} sent of {} eligible; skipped {} opted out, "
                + "{} unavailable, {} on game", gameId, slot, reason, sent, eligible, skippedOptedOut,
                skippedUnavailable, skippedOnGame);
        return new NotificationPrefDto.OpenSpotOutcome(sent, eligible, skippedOptedOut, skippedUnavailable,
                skippedOnGame, sentTo);
    }

    /**
     * One sentence for the coordinator's own decline/drop notice, so they know the pool was already
     * told and don't press Alert Pool on top. Null when nothing went out, so the notice stays silent
     * on it rather than reporting a broadcast that didn't happen.
     */
    public static String poolNote(NotificationPrefDto.OpenSpotOutcome o) {
        if (o == null || o.getEligible() == 0) {
            return null;
        }
        StringBuilder sb = new StringBuilder("The goalie pool has been alerted that this net is open — ")
                .append(o.getSent()).append(" of ").append(o.getEligible()).append(" emailed");
        List<String> skips = new ArrayList<>();
        if (o.getOptedOut() > 0) {
            skips.add(o.getOptedOut() + " opted out of these alerts");
        }
        if (o.getUnavailable() > 0) {
            skips.add(o.getUnavailable() + " unavailable that week");
        }
        if (!skips.isEmpty()) {
            sb.append(" (skipped: ").append(String.join(", ", skips)).append(")");
        }
        return sb.append(".").toString();
    }

    private static String whyLine(Reason reason, String coordinatorName) {
        switch (reason) {
            case DROPPED:
                return "The goalie who was confirmed for this net has had to drop out, so it's open again.";
            case MANUAL:
                return htmlEscape(coordinatorName == null ? "The goalie coordinator" : coordinatorName)
                        + " is looking for someone to fill this net.";
            case DECLINED:
            default:
                return "The goalie lined up for this net can't make it, so it's open again.";
        }
    }

    private static NotificationPrefDto.OpenSpotOutcome empty() {
        return new NotificationPrefDto.OpenSpotOutcome(0, 0, 0, 0, 0, List.of());
    }

    private String teamName(Long teamId) {
        if (teamId == null) {
            return "TBD";
        }
        return teamService.getTeamById(teamId).map(t -> t.getName()).orElse("Team " + teamId);
    }

    /** Holders of a role, reading both the roles table and the deprecated single-role column. */
    private List<User> usersWithRole(String roleName) {
        Map<Long, User> byId = new LinkedHashMap<>();
        userRepository.findByRoles_Name(roleName).forEach(u -> byId.put(u.getId(), u));
        userRepository.findByRole(roleName).forEach(u -> byId.put(u.getId(), u));
        return new ArrayList<>(byId.values());
    }

    private static User firstWithEmail(List<User> users) {
        return users.stream()
                .filter(u -> u.getEmail() != null && !u.getEmail().isBlank())
                .findFirst().orElse(null);
    }

    private static String firstName(User u) {
        return (u.getFirstName() != null && !u.getFirstName().isBlank()) ? u.getFirstName() : u.getUsername();
    }

    private static String htmlEscape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
