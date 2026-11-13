package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.repository.ShiftAssignmentRepository;

/**
 * Unpublishing a matchup takes its live slots off the game so it can be fixed and published again.
 * The rows stay CONFIRMED (so the re-publish emails them with the corrected details), both columns
 * are cleared in one write, and nobody hears about it in the meantime.
 */
@ExtendWith(MockitoExtension.class)
class CoordinatorServiceUnpublishTest {

    private static final Long GAME = 22L;

    @Mock private ShiftAssignmentRepository assignmentRepository;
    @Mock private GameProxyService gameProxyService;
    @Mock private EmailService emailService;

    @InjectMocks private CoordinatorService service;

    @BeforeEach
    void saveEchoes() {
        lenient().when(assignmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void publishedGoaliesComeOffTheGameButStayConfirmed() {
        ShiftAssignment home = row(1L, "GOALIE", 1, true);
        ShiftAssignment away = row(2L, "GOALIE", 2, true);
        when(assignmentRepository.findByGameId(GAME)).thenReturn(List.of(home, away));

        CoordinatorDto.UnpublishResult result = service.unpublishGame(GAME, "GOALIE");

        assertEquals(2, result.getUnpublishedCount());
        assertFalse(home.getPublished());
        assertFalse(away.getPublished());
        assertEquals(ShiftAssignment.STATUS_CONFIRMED, home.getStatus());
        assertEquals(ShiftAssignment.STATUS_CONFIRMED, away.getStatus());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> fields = ArgumentCaptor.forClass(Map.class);
        verify(gameProxyService).updateGameStaff(org.mockito.ArgumentMatchers.eq(GAME), fields.capture());
        assertEquals(Map.of("goalie1Id", -1L, "goalie2Id", -1L), fields.getValue());
        verifyNoInteractions(emailService);
    }

    @Test
    void onlyThisRolesLiveSlotsAreTouched() {
        ShiftAssignment liveGoalie = row(1L, "GOALIE", 1, true);
        ShiftAssignment unpublishedGoalie = row(2L, "GOALIE", 2, false);
        ShiftAssignment liveRef = row(3L, "REF", 1, true);
        when(assignmentRepository.findByGameId(GAME)).thenReturn(List.of(liveGoalie, unpublishedGoalie, liveRef));

        CoordinatorDto.UnpublishResult result = service.unpublishGame(GAME, "GOALIE");

        assertEquals(1, result.getUnpublishedCount());
        verify(gameProxyService).updateGameStaff(GAME, Map.of("goalie1Id", -1L));
        assertTrue(liveRef.getPublished());
        verify(assignmentRepository, never()).save(liveRef);
    }

    @Test
    void nothingPublishedIsRefusedWithoutWriting() {
        when(assignmentRepository.findByGameId(GAME)).thenReturn(List.of(row(1L, "GOALIE", 1, false)));

        RuntimeException e = assertThrows(RuntimeException.class, () -> service.unpublishGame(GAME, "GOALIE"));

        assertEquals("Nothing is published for this game", e.getMessage());
        verify(gameProxyService, never()).updateGameStaff(anyLong(), anyMap());
        verify(assignmentRepository, never()).save(any());
    }

    private static ShiftAssignment row(Long id, String role, int slot, boolean published) {
        ShiftAssignment a = new ShiftAssignment();
        a.setId(id);
        a.setGameId(GAME);
        a.setSeasonId(15L);
        a.setRole(role);
        a.setSlot(slot);
        a.setUserId(100L + id);
        a.setStatus(ShiftAssignment.STATUS_CONFIRMED);
        a.setPublished(published);
        return a;
    }
}
