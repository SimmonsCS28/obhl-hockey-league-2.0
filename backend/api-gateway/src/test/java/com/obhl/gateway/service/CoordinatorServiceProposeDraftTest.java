package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.ShiftAssignmentRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * A goalie pick made by hand is only <em>staged</em> when the request says {@code draft}: the row
 * lands as AUTO_PROPOSED with no confirm token and nobody is emailed, exactly like the
 * auto-proposer's own rows. The coordinator can then shuffle the week and send every confirmation
 * at once. Emailing on the pick was what left a goalie holding a confirmation for one game while
 * the week card in that same email still showed them in the game they'd just been moved out of.
 */
@ExtendWith(MockitoExtension.class)
class CoordinatorServiceProposeDraftTest {

    private static final Long GAME = 22L;
    private static final Long SEASON = 15L;
    private static final Long GOALIE = 21L;
    private static final Long COORDINATOR = 1L;

    @Mock private ShiftAssignmentRepository assignmentRepository;
    @Mock private GameProxyService gameProxyService;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;
    @Mock private TeamService teamService;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks private CoordinatorService service;

    @BeforeEach
    void gameExists() {
        GameResponseDTO game = new GameResponseDTO();
        game.setId(GAME);
        game.setSeasonId(SEASON);
        game.setWeek(3);
        game.setGameDate(LocalDateTime.of(2026, 9, 23, 1, 30));
        when(gameProxyService.getGameById(GAME)).thenReturn(game);
        lenient().when(assignmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(userRepository.findById(anyLong())).thenReturn(Optional.of(user()));
        lenient().when(teamService.getTeamById(anyLong())).thenReturn(Optional.empty());
        lenient().when(passwordEncoder.encode(anyString())).thenReturn("hash");
    }

    @Test
    void draftPickIsStagedWithoutTokenOrEmail() {
        when(assignmentRepository.findByGameIdAndRoleAndSlot(GAME, "GOALIE", 1)).thenReturn(Optional.empty());

        CoordinatorDto.AssignmentView view = service.propose(draft(GOALIE), COORDINATOR);

        ArgumentCaptor<ShiftAssignment> saved = ArgumentCaptor.forClass(ShiftAssignment.class);
        verify(assignmentRepository).save(saved.capture());
        assertEquals(ShiftAssignment.STATUS_AUTO_PROPOSED, saved.getValue().getStatus());
        assertNull(saved.getValue().getConfirmTokenHash());
        assertNull(saved.getValue().getTokenExpiresAt());
        assertEquals(ShiftAssignment.STATUS_AUTO_PROPOSED, view.getStatus());
        verify(emailService, never()).sendShiftProposalEmail(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void draftSwapReplacesAStagedRowSilently() {
        ShiftAssignment staged = row(99L, ShiftAssignment.STATUS_AUTO_PROPOSED);
        when(assignmentRepository.findByGameIdAndRoleAndSlot(GAME, "GOALIE", 1)).thenReturn(Optional.of(staged));

        service.propose(draft(GOALIE), COORDINATOR);

        assertEquals(GOALIE, staged.getUserId());
        assertEquals(ShiftAssignment.STATUS_AUTO_PROPOSED, staged.getStatus());
        verify(emailService, never()).sendShiftProposalEmail(any(), any(), any(), any(), any(), any(), any(), any());
        verify(emailService, never()).sendShiftCancelledEmail(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void draftOfTheSamePersonNeverDowngradesAnEmailedProposal() {
        ShiftAssignment emailed = row(GOALIE, ShiftAssignment.STATUS_PROPOSED);
        emailed.setConfirmTokenHash("hash");
        emailed.setTokenExpiresAt(LocalDateTime.now().plusDays(7));
        when(assignmentRepository.findByGameIdAndRoleAndSlot(GAME, "GOALIE", 1)).thenReturn(Optional.of(emailed));

        CoordinatorDto.AssignmentView view = service.propose(draft(GOALIE), COORDINATOR);

        assertEquals(ShiftAssignment.STATUS_PROPOSED, view.getStatus());
        assertNotNull(emailed.getConfirmTokenHash());
        verify(assignmentRepository, never()).save(any());
    }

    @Test
    void plainProposeStillMintsATokenAndEmails() {
        when(assignmentRepository.findByGameIdAndRoleAndSlot(GAME, "GOALIE", 1)).thenReturn(Optional.empty());

        CoordinatorDto.ProposeRequest req = draft(GOALIE);
        req.setDraft(null);
        service.propose(req, COORDINATOR);

        ArgumentCaptor<ShiftAssignment> saved = ArgumentCaptor.forClass(ShiftAssignment.class);
        verify(assignmentRepository).save(saved.capture());
        assertEquals(ShiftAssignment.STATUS_PROPOSED, saved.getValue().getStatus());
        assertEquals("hash", saved.getValue().getConfirmTokenHash());
        verify(emailService).sendShiftProposalEmail(any(), any(), any(), any(), any(), any(), any(), any());
    }

    private static CoordinatorDto.ProposeRequest draft(Long userId) {
        return new CoordinatorDto.ProposeRequest(GAME, SEASON, "GOALIE", 1, userId, true);
    }

    private static ShiftAssignment row(Long userId, String status) {
        ShiftAssignment a = new ShiftAssignment();
        a.setId(7L);
        a.setGameId(GAME);
        a.setSeasonId(SEASON);
        a.setRole("GOALIE");
        a.setSlot(1);
        a.setUserId(userId);
        a.setStatus(status);
        a.setPublished(false);
        return a;
    }

    private static User user() {
        User u = new User();
        u.setId(GOALIE);
        u.setUsername("test_goalie");
        u.setEmail("goalie@example.com");
        u.setFirstName("Test");
        u.setLastName("Goalie");
        return u;
    }
}
