package com.obhl.gateway.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.GoalieUnavailabilityDTO;
import com.obhl.gateway.model.GoalieAvailability;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.StaffUnavailability;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.ShiftAssignmentRepository;
import com.obhl.gateway.repository.StaffUnavailabilityRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Availability for staff roles. Goalies keep their dedicated
 * {@code goalie_unavailability} table (handled by {@link GoalieShiftService});
 * all other roles (REF now, SCOREKEEPER later) use {@code staff_unavailability}.
 * This service dispatches by role so callers don't care which table backs it.
 */
@Service
public class StaffAvailabilityService {

    @Autowired
    private GoalieShiftService goalieShiftService;

    @Autowired
    private StaffUnavailabilityRepository staffUnavailabilityRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalieAvailabilityService goalieAvailabilityService;

    @Autowired
    private ShiftAssignmentRepository assignmentRepository;

    @Autowired
    private GameProxyService gameProxyService;

    private static final ZoneId LEAGUE_TZ = ZoneId.of("America/Chicago");

    /** Statuses that mean the person still holds the shift, i.e. is evidently available for it. */
    private static final List<String> ACTIVE_STATUSES = List.of(
            ShiftAssignment.STATUS_AUTO_PROPOSED,
            ShiftAssignment.STATUS_PROPOSED,
            ShiftAssignment.STATUS_SIGNED_UP,
            ShiftAssignment.STATUS_CONFIRMED);

    /** All unavailability for a role, as {userId, date} pairs (for the coordinator board). */
    public List<GoalieUnavailabilityDTO> getAllUnavailability(String role) {
        if ("GOALIE".equals(role)) {
            return goalieShiftService.getAllUnavailability();
        }
        return staffUnavailabilityRepository.findByRole(role).stream()
                .map(u -> new GoalieUnavailabilityDTO(u.getUser().getId(), u.getUnavailableDate()))
                .collect(Collectors.toList());
    }

    /** A single user's unavailable dates for a role. */
    public List<LocalDate> getMyUnavailability(Long userId, String role) {
        if ("GOALIE".equals(role)) {
            return goalieShiftService.getMyUnavailability(userId);
        }
        return staffUnavailabilityRepository.findByUserIdAndRole(userId, role).stream()
                .map(StaffUnavailability::getUnavailableDate)
                .collect(Collectors.toList());
    }

    @Transactional
    public void markUnavailable(Long userId, String role, List<LocalDate> dates) {
        if ("GOALIE".equals(role)) {
            com.obhl.gateway.dto.GoalieAvailabilityRequest req = new com.obhl.gateway.dto.GoalieAvailabilityRequest();
            req.setDates(dates);
            goalieShiftService.markUnavailable(userId, req);
            return;
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        for (LocalDate date : dates) {
            if (staffUnavailabilityRepository.findByUserIdAndRoleAndUnavailableDate(userId, role, date).isEmpty()) {
                StaffUnavailability su = new StaffUnavailability();
                su.setUser(user);
                su.setRole(role);
                su.setUnavailableDate(date);
                staffUnavailabilityRepository.save(su);
            }
        }
    }

    @Transactional
    public void removeUnavailable(Long userId, String role, LocalDate date) {
        if ("GOALIE".equals(role)) {
            goalieShiftService.removeUnavailableDate(userId, date);
            return;
        }
        staffUnavailabilityRepository.findByUserIdAndRoleAndUnavailableDate(userId, role, date)
                .ifPresent(staffUnavailabilityRepository::delete);
    }

    /**
     * A decline means "I can't make this one", so record it as unavailability — otherwise the
     * coordinator's picker and the goalie auto-proposer keep offering the same person back for the
     * slot they just turned down. Goalies only have week-level availability, so their week is marked
     * UNAVAILABLE; refs and scorekeepers mark the game's league-local date.
     *
     * <p>Skipped when the person still holds another shift in the same role for that week (goalie) or
     * night (ref/SK): they are plainly available then, and the decline was about this game alone.
     * Runs in its own transaction so a failure here rolls back only this write: callers catch it,
     * and the decline itself stands.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markUnavailableAfterDecline(ShiftAssignment declined) {
        GameResponseDTO game = gameProxyService.getGameById(declined.getGameId());
        if (game == null) {
            return;
        }
        String role = declined.getRole();
        Long userId = declined.getUserId();
        List<ShiftAssignment> others = assignmentRepository.findByUserIdAndStatusIn(userId, ACTIVE_STATUSES)
                .stream()
                .filter(a -> role.equals(a.getRole()) && !a.getId().equals(declined.getId()))
                .collect(Collectors.toList());

        if ("GOALIE".equals(role)) {
            Integer week = game.getWeek();
            Long seasonId = declined.getSeasonId() != null ? declined.getSeasonId() : game.getSeasonId();
            if (week == null || seasonId == null) {
                return;
            }
            boolean holdsOtherThisWeek = others.stream().anyMatch(a -> {
                GameResponseDTO g = gameProxyService.getGameById(a.getGameId());
                return g != null && week.equals(g.getWeek()) && seasonId.equals(g.getSeasonId());
            });
            if (!holdsOtherThisWeek) {
                goalieAvailabilityService.setStatus(userId, seasonId, week, GoalieAvailability.STATUS_UNAVAILABLE);
            }
            return;
        }

        LocalDate day = leagueDay(game);
        if (day == null) {
            return;
        }
        boolean holdsOtherThatNight = others.stream()
                .anyMatch(a -> day.equals(leagueDay(gameProxyService.getGameById(a.getGameId()))));
        if (!holdsOtherThatNight) {
            markUnavailable(userId, role, List.of(day));
        }
    }

    /** The game's calendar date in league time — the same day key the coordinator board uses. */
    private LocalDate leagueDay(GameResponseDTO game) {
        if (game == null || game.getGameDate() == null) {
            return null;
        }
        return game.getGameDate().atZone(ZoneOffset.UTC).withZoneSameInstant(LEAGUE_TZ).toLocalDate();
    }
}
