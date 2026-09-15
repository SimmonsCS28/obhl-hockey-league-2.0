package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.NotificationPrefDto;
import com.obhl.gateway.dto.TeamDto;
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
 * The open-spot broadcast goes to the whole season pool — full-time and subs — minus exactly four
 * groups: whoever just left the net, whoever is in the other net, anyone unavailable that week, and
 * anyone unsubscribed. Every one of those exclusions is a real person who would otherwise be
 * annoyed, so each gets its own test.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GoalieOpenSpotNotifyServiceTest {

    private static final long SEASON = 15L;
    private static final long GAME = 900L;
    private static final int WEEK = 4;

    private static final long DECLINER = 1L;
    private static final long OTHER_NET = 2L;
    private static final long UNAVAILABLE = 3L;
    private static final long OPTED_OUT = 4L;
    private static final long FULLTIME = 5L;
    private static final long SUB = 6L;
    private static final long NO_EMAIL = 7L;
    private static final long COORDINATOR = 50L;

    @Mock private SeasonGoalieRepository seasonGoalieRepository;
    @Mock private ShiftAssignmentRepository assignmentRepository;
    @Mock private GoalieAvailabilityRepository goalieAvailabilityRepository;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;
    @Mock private NotificationOptOutService optOutService;
    @Mock private GameProxyService gameProxyService;
    @Mock private TeamService teamService;

    @InjectMocks private GoalieOpenSpotNotifyService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "frontendUrl", "https://example.test");

        GameResponseDTO game = new GameResponseDTO();
        game.setId(GAME);
        game.setWeek(WEEK);
        game.setHomeTeamId(10L);
        game.setAwayTeamId(11L);
        game.setRink("Rink A");
        game.setGameDate(LocalDateTime.of(2026, 9, 20, 1, 15)); // 8:15 PM Chicago on the 19th
        when(gameProxyService.getGameById(GAME)).thenReturn(game);

        when(teamService.getTeamById(10L)).thenReturn(Optional.of(team("Bruins")));
        when(teamService.getTeamById(11L)).thenReturn(Optional.of(team("Sharks")));

        // Pool: everyone, full-time or not.
        when(seasonGoalieRepository.findBySeasonId(SEASON)).thenReturn(List.of(
                pool(DECLINER, true), pool(OTHER_NET, true), pool(UNAVAILABLE, true),
                pool(OPTED_OUT, false), pool(FULLTIME, true), pool(SUB, false), pool(NO_EMAIL, false)));

        // The other net is still held; the decliner's own row is DECLINED and must not count as "on game".
        ShiftAssignment otherNet = row(OTHER_NET, 1, ShiftAssignment.STATUS_CONFIRMED);
        ShiftAssignment declined = row(DECLINER, 2, ShiftAssignment.STATUS_DECLINED);
        when(assignmentRepository.findByGameIdInAndRole(List.of(GAME), "GOALIE"))
                .thenReturn(List.of(otherNet, declined));

        GoalieAvailability away = new GoalieAvailability();
        away.setUserId(UNAVAILABLE);
        away.setStatus(GoalieAvailability.STATUS_UNAVAILABLE);
        when(goalieAvailabilityRepository.findBySeasonIdAndWeek(SEASON, WEEK)).thenReturn(List.of(away));

        when(optOutService.optedOutAtByUser(NotificationOptOut.KIND_GOALIE_OPEN_SPOT))
                .thenReturn(Map.of(OPTED_OUT, LocalDateTime.now()));
        when(optOutService.unsubscribeLink(anyLong(), anyString()))
                .thenAnswer(inv -> "https://example.test/email-alerts?u=" + inv.getArgument(0) + "&k=X&t=sig");

        for (long id : new long[] { DECLINER, OTHER_NET, UNAVAILABLE, OPTED_OUT, FULLTIME, SUB }) {
            when(userRepository.findById(id)).thenReturn(Optional.of(user(id, "G" + id, "g" + id + "@example.test")));
        }
        when(userRepository.findById(NO_EMAIL)).thenReturn(Optional.of(user(NO_EMAIL, "Ghost", null)));

        User coord = user(COORDINATOR, "Cole", "coord@example.test");
        when(userRepository.findById(COORDINATOR)).thenReturn(Optional.of(coord));
        when(userRepository.findByRoles_Name("GOALIE_COORDINATOR")).thenReturn(List.of(coord));
        when(userRepository.findByRole(anyString())).thenReturn(List.of());
        when(userRepository.findByRoles_Name("ADMIN")).thenReturn(List.of());

        when(emailService.sendGoalieOpenSpotEmail(anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), any(), any(), anyString(), anyString(), anyString())).thenReturn(true);
    }

    @Test
    void declineEmailsThePoolMinusTheFourExclusions() {
        NotificationPrefDto.OpenSpotOutcome o = service.notifySpotOpened(
                row(DECLINER, 2, ShiftAssignment.STATUS_DECLINED), GoalieOpenSpotNotifyService.Reason.DECLINED);

        assertEquals(2, o.getSent(), "only the full-timer and the sub are reachable");
        assertEquals(2, o.getEligible());
        assertEquals(1, o.getOptedOut());
        assertEquals(1, o.getUnavailable());
        assertEquals(2, o.getAlreadyOnGame(), "the decliner and the goalie in the other net");
        assertEquals(List.of("G5", "G6"), o.getSentTo());

        verify(emailService, never()).sendGoalieOpenSpotEmail(eq("g1@example.test"), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any());
        verify(emailService, never()).sendGoalieOpenSpotEmail(eq("g4@example.test"), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any());
    }

    @Test
    void cardNamesTheRightNetAndRepliesGoToTheCoordinator() {
        service.notifySpotOpened(row(DECLINER, 2, ShiftAssignment.STATUS_DECLINED),
                GoalieOpenSpotNotifyService.Reason.DECLINED);

        ArgumentCaptor<String> matchup = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> coordEmail = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> oneClick = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendGoalieOpenSpotEmail(eq("g5@example.test"), eq("G5"), eq("Sat Sep 19"),
                anyString(), matchup.capture(), anyString(), eq("Cole"), coordEmail.capture(), anyString(),
                anyString(), oneClick.capture());

        assertTrue(matchup.getValue().contains("Sharks net"), "slot 2 is the away team's net: " + matchup.getValue());
        assertEquals("coord@example.test", coordEmail.getValue());
        assertEquals("https://example.test/api/v1/auth/email-alerts/one-click?u=5&k=X&t=sig", oneClick.getValue());
    }

    @Test
    void manualSendRepliesToWhoeverPressedTheButton() {
        User admin = user(60L, "Amy", "amy@example.test");
        when(userRepository.findById(60L)).thenReturn(Optional.of(admin));

        service.notifySpotOpened(SEASON, GAME, 1, null, GoalieOpenSpotNotifyService.Reason.MANUAL, 60L);

        ArgumentCaptor<String> why = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendGoalieOpenSpotEmail(eq("g5@example.test"), anyString(), anyString(), anyString(),
                anyString(), why.capture(), eq("Amy"), eq("amy@example.test"), anyString(), anyString(), anyString());
        assertTrue(why.getValue().startsWith("Amy is looking"));
    }

    @Test
    void nonGoalieRolesNeverBroadcast() {
        ShiftAssignment ref = row(DECLINER, 1, ShiftAssignment.STATUS_DECLINED);
        ref.setRole("REF");

        NotificationPrefDto.OpenSpotOutcome o = service.notifySpotOpened(ref, GoalieOpenSpotNotifyService.Reason.DECLINED);

        assertEquals(0, o.getEligible());
        verify(emailService, never()).sendGoalieOpenSpotEmail(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any());
    }

    @Test
    void poolNoteIsSilentWhenNobodyWasEligible() {
        assertNull(GoalieOpenSpotNotifyService.poolNote(new NotificationPrefDto.OpenSpotOutcome(0, 0, 0, 0, 0, List.of())));
        assertNull(GoalieOpenSpotNotifyService.poolNote(null));
        String note = GoalieOpenSpotNotifyService.poolNote(new NotificationPrefDto.OpenSpotOutcome(3, 4, 2, 0, 1, List.of()));
        assertEquals("The goalie pool has been alerted that this net is open — 3 of 4 emailed "
                + "(skipped: 2 opted out of these alerts).", note);
    }

    // ---- fixtures ----

    private static SeasonGoalie pool(long userId, boolean fulltime) {
        SeasonGoalie sg = new SeasonGoalie();
        sg.setSeasonId(SEASON);
        sg.setUserId(userId);
        sg.setIsFulltime(fulltime);
        return sg;
    }

    private static ShiftAssignment row(long userId, int slot, String status) {
        ShiftAssignment a = new ShiftAssignment();
        a.setSeasonId(SEASON);
        a.setGameId(GAME);
        a.setRole("GOALIE");
        a.setSlot(slot);
        a.setUserId(userId);
        a.setStatus(status);
        return a;
    }

    private static User user(long id, String first, String email) {
        User u = new User();
        u.setId(id);
        u.setUsername("user" + id);
        u.setFirstName(first);
        u.setEmail(email);
        return u;
    }

    private static TeamDto.Response team(String name) {
        TeamDto.Response t = new TeamDto.Response();
        t.setName(name);
        return t;
    }
}
