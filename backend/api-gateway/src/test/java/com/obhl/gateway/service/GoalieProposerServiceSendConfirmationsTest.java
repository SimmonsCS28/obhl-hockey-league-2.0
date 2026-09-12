package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.model.GoalieBenchNotice;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.repository.GoalieBenchNoticeRepository;
import com.obhl.gateway.repository.ShiftAssignmentRepository;

/**
 * The bench notice — "not scheduled this week" to every full-time goalie without a slot — must
 * go out exactly once per week, and whether it has is a stored fact, not something inferred from
 * the week's assignment statuses.
 *
 * <p>The regression case is the one that bit season 15 week 1: a single slot proposed by hand
 * before the bulk send used to make the week look like a top-up, and the bench was never told.
 */
@ExtendWith(MockitoExtension.class)
class GoalieProposerServiceSendConfirmationsTest {

    private static final Long SEASON = 15L;
    private static final Integer WEEK = 1;
    private static final Long COORDINATOR = 1L;

    @Mock private ShiftAssignmentRepository assignmentRepository;
    @Mock private GoalieBenchNoticeRepository benchNoticeRepository;
    @Mock private GameProxyService gameProxyService;
    @Mock private CoordinatorService coordinatorService;

    @InjectMocks private GoalieProposerService service;

    private void weekHasTwoGames() {
        when(gameProxyService.getGamesBySeason(SEASON)).thenReturn(List.of(game(406L), game(407L)));
        when(coordinatorService.getAssignments(SEASON, "GOALIE", WEEK)).thenReturn(List.of());
    }

    @Test
    void firstSendTellsTheBenchAndRecordsIt() {
        weekHasTwoGames();
        when(assignmentRepository.findByGameIdInAndRole(anyList(), eq("GOALIE")))
                .thenReturn(List.of(row(406L, 1, ShiftAssignment.STATUS_AUTO_PROPOSED),
                        row(406L, 2, ShiftAssignment.STATUS_AUTO_PROPOSED)));
        when(benchNoticeRepository.findBySeasonIdAndWeek(SEASON, WEEK)).thenReturn(Optional.empty());
        when(coordinatorService.notifyUnassignedGoalies(SEASON, WEEK, COORDINATOR))
                .thenReturn(new CoordinatorService.BenchNoticeOutcome(5, 5));

        CoordinatorDto.SendConfirmationsResult result = service.sendConfirmations(SEASON, WEEK, COORDINATOR);

        assertEquals(2, result.getSentCount());
        assertEquals(5, result.getNotifiedUnassignedCount());
        ArgumentCaptor<GoalieBenchNotice> saved = ArgumentCaptor.forClass(GoalieBenchNotice.class);
        verify(benchNoticeRepository).save(saved.capture());
        assertEquals(SEASON, saved.getValue().getSeasonId());
        assertEquals(WEEK, saved.getValue().getWeek());
        assertEquals(COORDINATOR, saved.getValue().getSentBy());
        assertEquals(5, saved.getValue().getRecipientCount());
    }

    /** The season 15 week 1 failure: one hand-proposed row must not silence the bench. */
    @Test
    void aHandProposedSlotBeforeTheBulkSendDoesNotSilenceTheBench() {
        weekHasTwoGames();
        when(assignmentRepository.findByGameIdInAndRole(anyList(), eq("GOALIE")))
                .thenReturn(List.of(row(406L, 1, ShiftAssignment.STATUS_PROPOSED),   // sent by hand earlier
                        row(406L, 2, ShiftAssignment.STATUS_AUTO_PROPOSED),
                        row(407L, 1, ShiftAssignment.STATUS_AUTO_PROPOSED)));
        when(benchNoticeRepository.findBySeasonIdAndWeek(SEASON, WEEK)).thenReturn(Optional.empty());
        when(coordinatorService.notifyUnassignedGoalies(SEASON, WEEK, COORDINATOR))
                .thenReturn(new CoordinatorService.BenchNoticeOutcome(4, 4));

        CoordinatorDto.SendConfirmationsResult result = service.sendConfirmations(SEASON, WEEK, COORDINATOR);

        assertEquals(2, result.getSentCount(), "only the AUTO_PROPOSED rows are sent");
        assertEquals(4, result.getNotifiedUnassignedCount(), "the bench is still told");
        verify(benchNoticeRepository).save(any(GoalieBenchNotice.class));
    }

    @Test
    void topUpSendAfterTheBenchWasToldStaysSilent() {
        weekHasTwoGames();
        when(assignmentRepository.findByGameIdInAndRole(anyList(), eq("GOALIE")))
                .thenReturn(List.of(row(406L, 1, ShiftAssignment.STATUS_CONFIRMED),
                        row(406L, 2, ShiftAssignment.STATUS_AUTO_PROPOSED)));   // replacement after a decline
        when(benchNoticeRepository.findBySeasonIdAndWeek(SEASON, WEEK))
                .thenReturn(Optional.of(new GoalieBenchNotice()));

        CoordinatorDto.SendConfirmationsResult result = service.sendConfirmations(SEASON, WEEK, COORDINATOR);

        assertEquals(1, result.getSentCount());
        assertEquals(0, result.getNotifiedUnassignedCount());
        verify(coordinatorService, never()).notifyUnassignedGoalies(anyLong(), any(), anyLong());
        verify(benchNoticeRepository, never()).save(any());
    }

    /** Resend down: nothing was accepted, so the week must NOT be recorded as told, or it never will be. */
    @Test
    void aFullyFailedBenchSendIsNotRecordedSoTheNextSendRetries() {
        weekHasTwoGames();
        when(assignmentRepository.findByGameIdInAndRole(anyList(), eq("GOALIE")))
                .thenReturn(List.of(row(406L, 1, ShiftAssignment.STATUS_AUTO_PROPOSED)));
        when(benchNoticeRepository.findBySeasonIdAndWeek(SEASON, WEEK)).thenReturn(Optional.empty());
        when(coordinatorService.notifyUnassignedGoalies(SEASON, WEEK, COORDINATOR))
                .thenReturn(new CoordinatorService.BenchNoticeOutcome(5, 0));

        CoordinatorDto.SendConfirmationsResult result = service.sendConfirmations(SEASON, WEEK, COORDINATOR);

        assertEquals(0, result.getNotifiedUnassignedCount(), "count reflects deliveries, not attempts");
        verify(benchNoticeRepository, never()).save(any());
    }

    @Test
    void aSendThatProposesNothingDoesNotTouchTheBench() {
        weekHasTwoGames();
        when(assignmentRepository.findByGameIdInAndRole(anyList(), eq("GOALIE")))
                .thenReturn(List.of(row(406L, 1, ShiftAssignment.STATUS_PROPOSED)));
        when(benchNoticeRepository.findBySeasonIdAndWeek(SEASON, WEEK)).thenReturn(Optional.empty());

        CoordinatorDto.SendConfirmationsResult result = service.sendConfirmations(SEASON, WEEK, COORDINATOR);

        assertEquals(0, result.getSentCount());
        verify(coordinatorService, never()).notifyUnassignedGoalies(anyLong(), any(), anyLong());
        verify(benchNoticeRepository, never()).save(any());
    }

    @Test
    void benchNoticeOutcomeSettlesOnlyWhenSomeoneWasReachedOrNobodyNeededToBe() {
        assertTrue(new CoordinatorService.BenchNoticeOutcome(0, 0).settled(), "nobody on the bench");
        assertTrue(new CoordinatorService.BenchNoticeOutcome(5, 5).settled());
        assertTrue(new CoordinatorService.BenchNoticeOutcome(5, 3).settled(), "partial failure is best-effort");
        assertFalse(new CoordinatorService.BenchNoticeOutcome(5, 0).settled(), "total failure must retry");
    }

    // ---- fixtures ----

    private static GameResponseDTO game(Long id) {
        GameResponseDTO g = new GameResponseDTO();
        g.setId(id);
        g.setSeasonId(SEASON);
        g.setWeek(WEEK);
        return g;
    }

    private static ShiftAssignment row(Long gameId, int slot, String status) {
        ShiftAssignment a = new ShiftAssignment();
        a.setGameId(gameId);
        a.setSeasonId(SEASON);
        a.setRole("GOALIE");
        a.setSlot(slot);
        a.setUserId(100L + slot);
        a.setStatus(status);
        return a;
    }
}
