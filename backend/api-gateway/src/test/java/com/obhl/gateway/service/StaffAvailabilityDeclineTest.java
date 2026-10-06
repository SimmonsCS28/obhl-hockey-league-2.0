package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.model.GoalieAvailability;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.StaffUnavailability;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.ShiftAssignmentRepository;
import com.obhl.gateway.repository.StaffUnavailabilityRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * A decline becomes unavailability — the goalie's week, or the ref/scorekeeper's game night — unless
 * the person still holds another shift then, in which case the decline was about that game alone.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StaffAvailabilityDeclineTest {

    private static final long SEASON = 15L;
    private static final long USER = 50L;

    @Mock private GoalieShiftService goalieShiftService;
    @Mock private StaffUnavailabilityRepository staffUnavailabilityRepository;
    @Mock private UserRepository userRepository;
    @Mock private GoalieAvailabilityService goalieAvailabilityService;
    @Mock private ShiftAssignmentRepository assignmentRepository;
    @Mock private GameProxyService gameProxyService;

    @InjectMocks private StaffAvailabilityService service;

    private static GameResponseDTO game(long id, int week, LocalDateTime utc) {
        GameResponseDTO g = new GameResponseDTO();
        g.setId(id);
        g.setSeasonId(SEASON);
        g.setWeek(week);
        g.setGameDate(utc);
        return g;
    }

    private static ShiftAssignment shift(long id, long gameId, String role, String status) {
        ShiftAssignment a = new ShiftAssignment();
        a.setId(id);
        a.setGameId(gameId);
        a.setSeasonId(SEASON);
        a.setRole(role);
        a.setSlot(1);
        a.setUserId(USER);
        a.setStatus(status);
        return a;
    }

    @Test
    void goalieDeclineMarksTheWeekUnavailable() {
        ShiftAssignment declined = shift(1L, 100L, "GOALIE", ShiftAssignment.STATUS_DECLINED);
        when(gameProxyService.getGameById(100L)).thenReturn(game(100L, 3, LocalDateTime.of(2026, 10, 12, 1, 0)));
        when(assignmentRepository.findByUserIdAndStatusIn(eq(USER), any())).thenReturn(List.of());

        service.markUnavailableAfterDecline(declined);

        verify(goalieAvailabilityService).setStatus(USER, SEASON, 3, GoalieAvailability.STATUS_UNAVAILABLE);
    }

    @Test
    void goalieStillHoldingAnotherGameThatWeekIsLeftAlone() {
        ShiftAssignment declined = shift(1L, 100L, "GOALIE", ShiftAssignment.STATUS_DECLINED);
        ShiftAssignment kept = shift(2L, 101L, "GOALIE", ShiftAssignment.STATUS_CONFIRMED);
        when(gameProxyService.getGameById(100L)).thenReturn(game(100L, 3, LocalDateTime.of(2026, 10, 12, 1, 0)));
        when(gameProxyService.getGameById(101L)).thenReturn(game(101L, 3, LocalDateTime.of(2026, 10, 12, 2, 15)));
        when(assignmentRepository.findByUserIdAndStatusIn(eq(USER), any())).thenReturn(List.of(kept));

        service.markUnavailableAfterDecline(declined);

        verify(goalieAvailabilityService, never()).setStatus(anyLong(), anyLong(), any(), anyString());
    }

    @Test
    void refDeclineMarksTheGameNightInLeagueTime() {
        // 01:00 UTC on the 12th is 8pm Central on the 11th — the night the board shows the game on.
        ShiftAssignment declined = shift(1L, 100L, "REF", ShiftAssignment.STATUS_DECLINED);
        when(gameProxyService.getGameById(100L)).thenReturn(game(100L, 3, LocalDateTime.of(2026, 10, 12, 1, 0)));
        when(assignmentRepository.findByUserIdAndStatusIn(eq(USER), any())).thenReturn(List.of());
        when(userRepository.findById(USER)).thenReturn(Optional.of(new User()));
        when(staffUnavailabilityRepository.findByUserIdAndRoleAndUnavailableDate(anyLong(), anyString(), any()))
                .thenReturn(Optional.empty());

        service.markUnavailableAfterDecline(declined);

        ArgumentCaptor<StaffUnavailability> saved = ArgumentCaptor.forClass(StaffUnavailability.class);
        verify(staffUnavailabilityRepository).save(saved.capture());
        assertEquals(LocalDate.of(2026, 10, 11), saved.getValue().getUnavailableDate());
        assertEquals("REF", saved.getValue().getRole());
    }

    @Test
    void refStillWorkingAnotherGameThatNightIsLeftAlone() {
        ShiftAssignment declined = shift(1L, 100L, "REF", ShiftAssignment.STATUS_DECLINED);
        ShiftAssignment kept = shift(2L, 101L, "REF", ShiftAssignment.STATUS_PROPOSED);
        when(gameProxyService.getGameById(100L)).thenReturn(game(100L, 3, LocalDateTime.of(2026, 10, 12, 1, 0)));
        when(gameProxyService.getGameById(101L)).thenReturn(game(101L, 3, LocalDateTime.of(2026, 10, 12, 2, 15)));
        when(assignmentRepository.findByUserIdAndStatusIn(eq(USER), any())).thenReturn(List.of(kept));

        service.markUnavailableAfterDecline(declined);

        verify(staffUnavailabilityRepository, never()).save(any());
    }
}
