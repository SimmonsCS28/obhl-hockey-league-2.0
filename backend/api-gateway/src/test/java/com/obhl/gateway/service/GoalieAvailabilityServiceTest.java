package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.GoalieAvailabilityDto;
import com.obhl.gateway.model.GoalieAvailability;
import com.obhl.gateway.repository.GoalieAvailabilityRepository;
import com.obhl.gateway.repository.UserRepository;

/** Per-night goalie availability: nights come from the games' Central dates, weeks aggregate them. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GoalieAvailabilityServiceTest {

    private static final long SEASON = 15L;
    private static final long USER = 7L;
    private static final LocalDate THU = LocalDate.of(2026, 10, 8);
    private static final LocalDate FRI = LocalDate.of(2026, 10, 9);

    @Mock private GoalieAvailabilityRepository availabilityRepository;
    @Mock private GameProxyService gameProxyService;
    @Mock private UserRepository userRepository;

    @InjectMocks private GoalieAvailabilityService service;

    /** Week 5: two games Thursday night, one Friday night (8pm+ Central = next day in UTC). */
    private void splitWeek() {
        when(gameProxyService.getGamesBySeason(SEASON)).thenReturn(List.of(
                game(1, LocalDateTime.of(2026, 10, 9, 1, 0)),
                game(2, LocalDateTime.of(2026, 10, 9, 2, 15)),
                game(3, LocalDateTime.of(2026, 10, 10, 1, 0))));
    }

    private static GameResponseDTO game(long id, LocalDateTime utc) {
        GameResponseDTO g = new GameResponseDTO();
        g.setId(id);
        g.setSeasonId(SEASON);
        g.setWeek(5);
        g.setGameDate(utc);
        return g;
    }

    private static GoalieAvailability row(long userId, LocalDate night, String status) {
        GoalieAvailability a = new GoalieAvailability();
        a.setUserId(userId);
        a.setSeasonId(SEASON);
        a.setWeek(5);
        a.setGameDate(night);
        a.setStatus(status);
        return a;
    }

    @Test
    void weekListsEachNightInLeagueTimeWithItsOwnStatus() {
        splitWeek();
        when(availabilityRepository.findByUserIdAndSeasonId(USER, SEASON))
                .thenReturn(List.of(row(USER, THU, "AVAILABLE"), row(USER, FRI, "UNAVAILABLE")));

        GoalieAvailabilityDto.WeekAvailability w = service.getForUser(USER, SEASON).get(0);

        assertEquals(3, w.getGamesCount());
        assertEquals(2, w.getNights().size());
        assertEquals(THU, w.getNights().get(0).getDate());
        assertEquals(2, w.getNights().get(0).getGamesCount());
        assertEquals("AVAILABLE", w.getNights().get(0).getStatus());
        assertEquals("UNAVAILABLE", w.getNights().get(1).getStatus());
        assertEquals(GoalieAvailabilityDto.STATUS_PARTIAL, w.getStatus());
    }

    @Test
    void weekLevelSetWritesEveryNight() {
        splitWeek();
        when(availabilityRepository.findByUserIdAndSeasonIdAndGameDate(eq(USER), eq(SEASON), any()))
                .thenReturn(Optional.empty());

        service.setStatus(USER, SEASON, 5, "available");

        ArgumentCaptor<GoalieAvailability> saved = ArgumentCaptor.forClass(GoalieAvailability.class);
        verify(availabilityRepository, times(2)).save(saved.capture());
        assertEquals(List.of(THU, FRI),
                saved.getAllValues().stream().map(GoalieAvailability::getGameDate).collect(Collectors.toList()));
        saved.getAllValues().forEach(a -> assertEquals("AVAILABLE", a.getStatus()));
    }

    @Test
    void nightSetFindsTheWeekFromTheGames() {
        splitWeek();
        when(availabilityRepository.findByUserIdAndSeasonIdAndGameDate(USER, SEASON, FRI)).thenReturn(Optional.empty());

        service.setNightStatus(USER, SEASON, FRI, "UNAVAILABLE");

        ArgumentCaptor<GoalieAvailability> saved = ArgumentCaptor.forClass(GoalieAvailability.class);
        verify(availabilityRepository).save(saved.capture());
        assertEquals(5, saved.getValue().getWeek());
        assertEquals(FRI, saved.getValue().getGameDate());
    }

    @Test
    void poolStatusIsPartialOnlyWhenOutOnSomeButNotAllNights() {
        splitWeek();
        when(userRepository.findById(anyLong())).thenReturn(Optional.empty());
        when(availabilityRepository.findBySeasonIdAndWeek(SEASON, 5)).thenReturn(List.of(
                row(1, THU, "AVAILABLE"), row(1, FRI, "AVAILABLE"),
                row(2, THU, "AVAILABLE"), row(2, FRI, "UNAVAILABLE"),
                row(3, THU, "UNAVAILABLE"), row(3, FRI, "UNAVAILABLE")));

        Map<Long, GoalieAvailabilityDto.GoalieWeekStatus> pool = service.getForWeek(SEASON, 5).stream()
                .collect(Collectors.toMap(GoalieAvailabilityDto.GoalieWeekStatus::getUserId, g -> g));

        assertEquals("AVAILABLE", pool.get(1L).getStatus());
        assertEquals(GoalieAvailabilityDto.STATUS_PARTIAL, pool.get(2L).getStatus());
        assertEquals(List.of(FRI), pool.get(2L).getUnavailableNights());
        assertEquals("UNAVAILABLE", pool.get(3L).getStatus());
    }

    @Test
    void weekStatusAggregation() {
        assertEquals("AVAILABLE", GoalieAvailabilityService.weekStatus(List.of("AVAILABLE", "AVAILABLE")));
        assertNull(GoalieAvailabilityService.weekStatus(Arrays.asList(null, null)));
        assertEquals("PARTIAL", GoalieAvailabilityService.weekStatus(Arrays.asList("AVAILABLE", null)));
        assertEquals("PARTIAL", GoalieAvailabilityService.weekStatus(List.of("AVAILABLE", "UNAVAILABLE")));
    }
}
