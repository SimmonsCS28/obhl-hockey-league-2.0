package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.LongStream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.model.SeasonGoalie;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.GoalieBenchNoticeRepository;
import com.obhl.gateway.repository.SeasonGoalieRepository;
import com.obhl.gateway.repository.ShiftAssignmentRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Availability is per game night: on a week with Thursday and Friday games, a goalie out Friday must
 * still be usable on Thursday, and must never be paired into (or placed on) a Friday game.
 *
 * <p>Every goalie has the same (unresolved -> median) rating here, so skill can't separate them —
 * the night rule alone has to decide who shares a game.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GoalieProposerServiceNightAvailabilityTest {

    private static final Long SEASON = 15L;
    private static final Integer WEEK = 5;
    private static final Long COORDINATOR = 1L;

    // 8pm Central on each night, stored as UTC (the next calendar day).
    private static final LocalDate THU = LocalDate.of(2026, 10, 8);
    private static final LocalDate FRI = LocalDate.of(2026, 10, 9);

    @Mock private SeasonGoalieRepository seasonGoalieRepository;
    @Mock private GoalieBenchNoticeRepository benchNoticeRepository;
    @Mock private ShiftAssignmentRepository assignmentRepository;
    @Mock private GoalieAvailabilityService availabilityService;
    @Mock private UserRepository userRepository;
    @Mock private PlayerService playerService;
    @Mock private GameProxyService gameProxyService;
    @Mock private TeamService teamService;
    @Mock private CoordinatorService coordinatorService;

    @InjectMocks private GoalieProposerService service;

    private static GameResponseDTO game(long id, LocalDate night, int hourCentral) {
        GameResponseDTO g = new GameResponseDTO();
        g.setId(id);
        g.setSeasonId(SEASON);
        g.setWeek(WEEK);
        g.setGameType("REGULAR_SEASON");
        // Central is UTC-5 in October.
        g.setGameDate(night.atTime(hourCentral, 0).plusHours(5));
        g.setHomeTeamId(100 + id);
        g.setAwayTeamId(200 + id);
        return g;
    }

    /** Goalies 1..n on the full-time roster, no ratings on file. */
    private void roster(long n) {
        List<SeasonGoalie> fulltime = LongStream.rangeClosed(1, n).mapToObj(uid -> {
            SeasonGoalie sg = new SeasonGoalie();
            sg.setUserId(uid);
            sg.setSeasonId(SEASON);
            sg.setIsFulltime(true);
            return sg;
        }).collect(Collectors.toList());
        when(seasonGoalieRepository.findBySeasonIdAndIsFulltimeTrue(SEASON)).thenReturn(fulltime);
        when(userRepository.findAllById(any())).thenReturn(LongStream.rangeClosed(1, n).mapToObj(uid -> {
            User u = new User();
            u.setId(uid);
            u.setUsername("g" + uid);
            return u;
        }).collect(Collectors.toList()));
        when(playerService.getAllPlayers()).thenReturn(List.of());
        when(assignmentRepository.findByGameIdInAndRole(anyList(), eq("GOALIE"))).thenReturn(List.of());
        when(coordinatorService.getAssignments(SEASON, "GOALIE", WEEK)).thenReturn(List.of());
    }

    private List<ShiftAssignment> proposed() {
        ArgumentCaptor<ShiftAssignment> saved = ArgumentCaptor.forClass(ShiftAssignment.class);
        verify(assignmentRepository, atLeastOnce()).save(saved.capture());
        return saved.getAllValues();
    }

    @Test
    void thursdayOnlyAndFridayOnlyGoaliesLandOnTheirOwnNights() {
        List<GameResponseDTO> games = List.of(
                game(1, THU, 19), game(2, THU, 21), game(3, FRI, 19), game(4, FRI, 21));
        when(gameProxyService.getGamesBySeason(SEASON)).thenReturn(games);
        roster(8);
        // Odd goalies can only make Thursday, even ones only Friday -- interleaved, so pairing in
        // roster order (1+2, 3+4, ...) would put every pair across two nights.
        Map<Long, Set<LocalDate>> out = new HashMap<>();
        for (long uid = 1; uid <= 8; uid++) out.put(uid, Set.of(uid % 2 == 1 ? FRI : THU));
        when(availabilityService.unavailableNights(SEASON, WEEK)).thenReturn(out);

        service.autoPropose(SEASON, WEEK, COORDINATOR);

        List<ShiftAssignment> rows = proposed();
        assertEquals(8, rows.size(), "every slot should be fillable");
        for (ShiftAssignment a : rows) {
            boolean thursdayGame = a.getGameId() == 1L || a.getGameId() == 2L;
            assertEquals(thursdayGame, a.getUserId() % 2 == 1,
                    "goalie " + a.getUserId() + " placed on a night they marked out (game " + a.getGameId() + ")");
        }
    }

    @Test
    void goalieOutEveryNightOfTheWeekIsNeverProposed() {
        when(gameProxyService.getGamesBySeason(SEASON)).thenReturn(List.of(game(1, THU, 19), game(3, FRI, 19)));
        roster(5);
        when(availabilityService.unavailableNights(SEASON, WEEK)).thenReturn(Map.of(3L, Set.of(THU, FRI)));

        service.autoPropose(SEASON, WEEK, COORDINATOR);

        List<ShiftAssignment> rows = proposed();
        assertEquals(4, rows.size());
        assertFalse(rows.stream().anyMatch(a -> a.getUserId() == 3L));
    }

    @Test
    void goalieOutOneNightIsStillUsedOnTheOther() {
        // Only four goalies for four slots: the one out Friday must be used on Thursday.
        when(gameProxyService.getGamesBySeason(SEASON)).thenReturn(List.of(game(1, THU, 19), game(3, FRI, 19)));
        roster(4);
        when(availabilityService.unavailableNights(SEASON, WEEK)).thenReturn(Map.of(2L, Set.of(FRI)));

        service.autoPropose(SEASON, WEEK, COORDINATOR);

        List<ShiftAssignment> rows = proposed();
        assertEquals(4, rows.size());
        assertTrue(rows.stream().anyMatch(a -> a.getUserId() == 2L && a.getGameId() == 1L));
    }
}
