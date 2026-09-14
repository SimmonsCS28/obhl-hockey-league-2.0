package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.server.ResponseStatusException;

import com.obhl.gateway.client.LeagueClient;
import com.obhl.gateway.client.StatsClient;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.GoalieCareerDto;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.UserRepository;

/**
 * A career is every completed league game the goalie was in net for, any season — but
 * never a tournament game, never a game that hasn't been played, and the W/L/T + GAA
 * arithmetic must match the season view exactly.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GoaliePerformanceServiceCareerTest {

    private static final long GOALIE = 187L;
    private static final long OTHER_GOALIE = 188L;

    @Mock private StatsClient statsClient;
    @Mock private LeagueClient leagueClient;
    @Mock private GameProxyService gameProxyService;
    @Mock private UserRepository userRepository;

    @InjectMocks private GoaliePerformanceService service;

    @BeforeEach
    void setUp() {
        User u = new User();
        u.setId(GOALIE);
        u.setUsername("test_goalie_one");
        u.setFirstName("Sam");
        u.setLastName("Netminder");
        when(userRepository.findById(GOALIE)).thenReturn(Optional.of(u));
        when(userRepository.findById(OTHER_GOALIE)).thenReturn(Optional.of(new User()));

        when(leagueClient.getSeasons("ALL")).thenReturn(List.of(
                season(13, "Winter 2025", "LEAGUE", "2025-01-06"),
                season(15, "Fall 2026", "LEAGUE", "2026-09-07"),
                season(14, "C League Classic 2026", "TOURNAMENT", "2026-06-01")));
    }

    @Test
    void aggregatesAcrossSeasonsNewestFirst() {
        when(gameProxyService.getGoalieAssignments(GOALIE)).thenReturn(List.of(
                // season 13: home net, 4-2 W ; away net, 1-3 L ; home net 2-2 T
                game(1, 13, "completed", "REGULAR_SEASON", GOALIE, OTHER_GOALIE, 4, 2),
                game(2, 13, "completed", "REGULAR_SEASON", OTHER_GOALIE, GOALIE, 3, 1),
                game(3, 13, "completed", "PLAYOFF", GOALIE, OTHER_GOALIE, 2, 2),
                // season 15: away net shutout 0-5 (W, SO)
                game(4, 15, "completed", "REGULAR_SEASON", OTHER_GOALIE, GOALIE, 0, 5)));

        GoalieCareerDto c = service.getCareer(GOALIE);

        assertEquals("Sam Netminder", c.getName());
        assertEquals(4, c.getGp());
        assertEquals(2, c.getWins());
        assertEquals(1, c.getLosses());
        assertEquals(1, c.getTies());
        assertEquals(1, c.getShutouts());
        assertEquals(2 + 3 + 2 + 0, c.getGoalsAgainst());
        assertEquals(1.75, c.getGaa());
        assertEquals(2, c.getSeasonsPlayed());

        assertEquals(List.of(15L, 13L),
                c.getSeasons().stream().map(GoalieCareerDto.SeasonLine::getSeasonId).toList());
        GoalieCareerDto.SeasonLine s13 = c.getSeasons().get(1);
        assertEquals("Winter 2025", s13.getSeasonName());
        assertEquals(3, s13.getGp());
        assertEquals(1, s13.getWins());
        assertEquals(1, s13.getLosses());
        assertEquals(1, s13.getTies());
        assertEquals(2.33, s13.getGaa());
        GoalieCareerDto.SeasonLine s15 = c.getSeasons().get(0);
        assertEquals("Fall 2026", s15.getSeasonName());
        assertEquals(1, s15.getShutouts());
        assertEquals(0.0, s15.getGaa());
    }

    @Test
    void ignoresUnplayedAndTournamentGames() {
        when(gameProxyService.getGoalieAssignments(GOALIE)).thenReturn(List.of(
                game(1, 13, "completed", "REGULAR_SEASON", GOALIE, OTHER_GOALIE, 3, 1),
                game(2, 13, "scheduled", "REGULAR_SEASON", GOALIE, OTHER_GOALIE, null, null),
                // tournament by game type
                game(3, 13, "completed", "TOURNAMENT", GOALIE, OTHER_GOALIE, 0, 9),
                // tournament by season type, game type left as regular
                game(4, 14, "completed", "REGULAR_SEASON", GOALIE, OTHER_GOALIE, 0, 9)));

        GoalieCareerDto c = service.getCareer(GOALIE);

        assertEquals(1, c.getGp());
        assertEquals(1, c.getWins());
        assertEquals(1.0, c.getGaa());
        assertEquals(1, c.getSeasonsPlayed());
    }

    @Test
    void nullGameTypeCountsAsRegularSeason() {
        when(gameProxyService.getGoalieAssignments(GOALIE)).thenReturn(List.of(
                game(1, 13, "completed", null, GOALIE, OTHER_GOALIE, 1, 0)));

        assertEquals(1, service.getCareer(GOALIE).getGp());
    }

    @Test
    void noGamesGivesEmptyCareerNotAnError() {
        when(gameProxyService.getGoalieAssignments(GOALIE)).thenReturn(List.of());

        GoalieCareerDto c = service.getCareer(GOALIE);

        assertEquals(0, c.getGp());
        assertNull(c.getGaa());
        assertTrue(c.getSeasons().isEmpty());
        assertEquals(0, c.getSeasonsPlayed());
    }

    @Test
    void unknownUserIs404() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());
        assertThrows(ResponseStatusException.class, () -> service.getCareer(999L));
    }

    private static Map<String, Object> season(long id, String name, String type, String start) {
        return Map.of("id", id, "name", name, "type", type, "startDate", start);
    }

    private static GameResponseDTO game(long id, long seasonId, String status, String gameType,
            Long goalie1, Long goalie2, Integer homeScore, Integer awayScore) {
        GameResponseDTO g = new GameResponseDTO();
        g.setId(id);
        g.setSeasonId(seasonId);
        g.setStatus(status);
        g.setGameType(gameType);
        g.setHomeTeamId(41L);
        g.setAwayTeamId(42L);
        g.setGoalie1Id(goalie1);
        g.setGoalie2Id(goalie2);
        g.setHomeScore(homeScore);
        g.setAwayScore(awayScore);
        g.setGameDate(LocalDateTime.of(2026, 1, 1, 20, 0).plusDays(id));
        return g;
    }
}
