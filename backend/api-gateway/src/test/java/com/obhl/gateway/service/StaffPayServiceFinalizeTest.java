package com.obhl.gateway.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.obhl.gateway.client.LeagueClient;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.StaffPayDto;
import com.obhl.gateway.dto.TeamDto;
import com.obhl.gateway.model.StaffPayLine;
import com.obhl.gateway.model.StaffPayPeriod;
import com.obhl.gateway.model.StaffPayRate;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.StaffPayLineGameRepository;
import com.obhl.gateway.repository.StaffPayLineRepository;
import com.obhl.gateway.repository.StaffPayPeriodRepository;
import com.obhl.gateway.repository.StaffPayRateRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Finalizing is a snapshot: it refuses while anyone credited has no rate, and a re-run only
 * disturbs the lines whose numbers actually moved.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StaffPayServiceFinalizeTest {

    private static final long SEASON = 15L;
    private static final long ADMIN = 1L;
    private static final long REF_A = 10L;
    private static final long REF_B = 11L;
    private static final long SK = 20L;

    @Mock private StaffPayRateRepository rateRepository;
    @Mock private StaffPayPeriodRepository periodRepository;
    @Mock private StaffPayLineRepository lineRepository;
    @Mock private StaffPayLineGameRepository lineGameRepository;
    @Mock private UserRepository userRepository;
    @Mock private GameProxyService gameProxyService;
    @Mock private TeamService teamService;
    @Mock private LeagueClient leagueClient;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private EmailService emailService;
    @Mock private AppSettingsService appSettingsService;

    @InjectMocks private StaffPayService service;

    private final List<StaffPayRate> rates = new ArrayList<>();
    private final List<StaffPayLine> lines = new ArrayList<>();
    private StaffPayPeriod period;

    @BeforeEach
    void setUp() {
        when(userRepository.findById(ADMIN)).thenReturn(Optional.of(user(ADMIN, "Cole", "Simmons")));
        when(userRepository.findById(REF_A)).thenReturn(Optional.of(user(REF_A, "Adam", "Rogers")));
        when(userRepository.findById(REF_B)).thenReturn(Optional.of(user(REF_B, "Jake", "Ruesch")));
        when(userRepository.findById(SK)).thenReturn(Optional.of(user(SK, "Sue", "Keeper")));
        when(userRepository.findAllById(any())).thenAnswer(inv -> {
            List<User> out = new ArrayList<>();
            for (Long id : (Iterable<Long>) inv.getArgument(0)) {
                userRepository.findById(id).ifPresent(out::add);
            }
            return out;
        });
        when(leagueClient.getSeasons("ALL")).thenReturn(List.of(Map.of("id", SEASON, "name", "Fall 2026 C League")));
        when(teamService.getTeamById(anyLong())).thenAnswer(inv -> {
            TeamDto.Response t = new TeamDto.Response();
            t.setName("Team " + inv.getArgument(0));
            return Optional.of(t);
        });
        when(appSettingsService.get(any())).thenReturn(Optional.empty());

        when(rateRepository.findAll()).thenAnswer(inv -> new ArrayList<>(rates));

        when(periodRepository.findBySeasonId(SEASON)).thenAnswer(inv -> Optional.ofNullable(period));
        when(periodRepository.findById(anyLong())).thenAnswer(inv -> Optional.ofNullable(period));
        when(periodRepository.save(any())).thenAnswer(inv -> {
            period = inv.getArgument(0);
            if (period.getId() == null) {
                period.setId(100L);
            }
            return period;
        });

        AtomicLong lineIds = new AtomicLong(500);
        when(lineRepository.findByPeriodId(anyLong())).thenAnswer(inv -> new ArrayList<>(lines));
        when(lineRepository.save(any())).thenAnswer(inv -> {
            StaffPayLine l = inv.getArgument(0);
            if (l.getId() == null) {
                l.setId(lineIds.incrementAndGet());
                lines.add(l);
            }
            return l;
        });
        when(lineGameRepository.findByLineIdInOrderByGameDateAsc(any())).thenReturn(List.of());
        when(lineGameRepository.findByLineIdOrderByGameDateAsc(anyLong())).thenReturn(List.of());

        // Two past games: A + B ref game 1; A refs game 2 alone; SK keeps both.
        LocalDateTime past = LocalDateTime.now(ZoneOffset.UTC).minusDays(2);
        when(gameProxyService.getGamesBySeason(SEASON)).thenReturn(List.of(
                game(1, past, REF_A, REF_B, SK),
                game(2, past.plusHours(2), REF_A, null, SK)));
    }

    @Test
    void finalizeRefusesAndNamesEveryoneWithoutARate() {
        rate(REF_A, "REF", 3000);

        StaffPayService.MissingRatesException e = assertThrows(StaffPayService.MissingRatesException.class,
                () -> service.finalize(SEASON, ADMIN));

        assertEquals(List.of("Jake Ruesch (Referee)", "Sue Keeper (Scorekeeper)"), e.getMissing());
        assertTrue(lines.isEmpty());
    }

    @Test
    void finalizeSnapshotsTotalsAndAutoConfirmsZeroRates() {
        rate(REF_A, "REF", 3000);
        rate(REF_B, "REF", 0);
        rate(SK, "SCOREKEEPER", 1500);

        StaffPayDto.SummaryView v = service.finalize(SEASON, ADMIN);

        assertEquals(StaffPayPeriod.STATUS_FINALIZED, v.getPeriodStatus());
        assertEquals("OBHL Fall 2026 C League (Cole Simmons)", v.getTitle());
        assertEquals(3, v.getLines().size());

        StaffPayLine a = line(REF_A, "REF");
        assertEquals(3, a.getGames());          // 1 + 2 (solo)
        assertEquals(1, a.getSoloGames());
        assertEquals(9000, a.getTotalCents());
        assertEquals(StaffPayLine.STATUS_PENDING, a.getConfirmStatus());

        StaffPayLine b = line(REF_B, "REF");
        assertEquals(1, b.getGames());
        assertEquals(0, b.getTotalCents());
        assertEquals(StaffPayLine.STATUS_ADMIN_CONFIRMED, b.getConfirmStatus());

        assertEquals(3000, line(SK, "SCOREKEEPER").getTotalCents());
        assertEquals(2, v.getPending());
        assertEquals(1, v.getConfirmed());
        assertFalse(v.isReportReady());
        assertFalse(v.isStale());
    }

    @Test
    void refinalizeKeepsConfirmationsWhoseNumbersDidNotMoveAndResetsTheRest() {
        rate(REF_A, "REF", 3000);
        rate(REF_B, "REF", 2000);
        rate(SK, "SCOREKEEPER", 1500);
        service.finalize(SEASON, ADMIN);
        for (StaffPayLine l : lines) {
            l.setConfirmStatus(StaffPayLine.STATUS_CONFIRMED);
            l.setRespondedAt(LocalDateTime.now());
        }
        assertTrue(service.getSummary(SEASON).isReportReady());

        // Ref A gets promoted to $40 between finalizes; nothing else changes.
        rates.stream().filter(r -> r.getUserId() == REF_A).forEach(r -> r.setRateCents(4000));
        StaffPayDto.SummaryView before = service.getSummary(SEASON);
        assertTrue(before.isStale());
        assertTrue(before.getLines().stream().filter(l -> l.getUserId() == REF_A).findFirst().orElseThrow().isStale());

        StaffPayDto.SummaryView v = service.finalize(SEASON, ADMIN);

        assertEquals(StaffPayLine.STATUS_PENDING, line(REF_A, "REF").getConfirmStatus());
        assertEquals(12000, line(REF_A, "REF").getTotalCents());
        assertEquals(StaffPayLine.STATUS_CONFIRMED, line(REF_B, "REF").getConfirmStatus());
        assertEquals(StaffPayLine.STATUS_CONFIRMED, line(SK, "SCOREKEEPER").getConfirmStatus());
        assertFalse(v.isReportReady());
        assertFalse(v.isStale());
    }

    @Test
    void reportReadyOnlyOnceEveryLineIsResolved() {
        StaffPayPeriod p = new StaffPayPeriod();
        p.setStatus(StaffPayPeriod.STATUS_FINALIZED);
        StaffPayLine pending = new StaffPayLine();
        StaffPayLine confirmed = new StaffPayLine();
        confirmed.setConfirmStatus(StaffPayLine.STATUS_CONFIRMED);
        StaffPayLine adminConfirmed = new StaffPayLine();
        adminConfirmed.setConfirmStatus(StaffPayLine.STATUS_ADMIN_CONFIRMED);
        StaffPayLine disputed = new StaffPayLine();
        disputed.setConfirmStatus(StaffPayLine.STATUS_DISPUTED);

        assertFalse(StaffPayService.reportReady(p, List.of()));
        assertFalse(StaffPayService.reportReady(p, List.of(confirmed, pending)));
        assertFalse(StaffPayService.reportReady(p, List.of(confirmed, disputed)));
        assertTrue(StaffPayService.reportReady(p, List.of(confirmed, adminConfirmed)));
        p.setStatus(StaffPayPeriod.STATUS_DRAFT);
        assertFalse(StaffPayService.reportReady(p, List.of(confirmed)));
    }

    @Test
    void moneyFormatsWholeDollarsWithoutCents() {
        assertEquals("$90", StaffPayService.money(9000));
        assertEquals("$1,230", StaffPayService.money(123000));
        assertEquals("$12.50", StaffPayService.money(1250));
        assertEquals("$0", StaffPayService.money(0));
    }

    // ---- fixtures ----

    private void rate(long userId, String role, int cents) {
        StaffPayRate r = new StaffPayRate();
        r.setUserId(userId);
        r.setRole(role);
        r.setRateCents(cents);
        rates.add(r);
    }

    private StaffPayLine line(long userId, String role) {
        return lines.stream().filter(l -> l.getUserId() == userId && role.equals(l.getRole())).findFirst().orElseThrow();
    }

    private static User user(long id, String first, String last) {
        User u = new User();
        u.setId(id);
        u.setUsername(first.toLowerCase() + last.toLowerCase());
        u.setFirstName(first);
        u.setLastName(last);
        u.setEmail(first.toLowerCase() + "@example.com");
        u.setIsActive(true);
        return u;
    }

    private static GameResponseDTO game(long id, LocalDateTime when, Long ref1, Long ref2, Long sk) {
        GameResponseDTO g = new GameResponseDTO();
        g.setId(id);
        g.setSeasonId(SEASON);
        g.setGameDate(when);
        g.setStatus("completed");
        g.setReferee1Id(ref1);
        g.setReferee2Id(ref2);
        g.setScorekeeperId(sk);
        g.setHomeTeamId(1L);
        g.setAwayTeamId(2L);
        return g;
    }
}
