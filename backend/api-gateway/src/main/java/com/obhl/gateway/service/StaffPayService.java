package com.obhl.gateway.service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.client.LeagueClient;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.StaffPayDto;
import com.obhl.gateway.model.StaffPayLine;
import com.obhl.gateway.model.StaffPayLineGame;
import com.obhl.gateway.model.StaffPayPeriod;
import com.obhl.gateway.model.StaffPayRate;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.StaffPayLineGameRepository;
import com.obhl.gateway.repository.StaffPayLineRepository;
import com.obhl.gateway.repository.StaffPayPeriodRepository;
import com.obhl.gateway.repository.StaffPayRateRepository;
import com.obhl.gateway.repository.UserRepository;
import com.obhl.gateway.service.StaffPayCalculator.Credits;
import com.obhl.gateway.service.StaffPayCalculator.GameCredit;
import com.obhl.gateway.service.StaffPayCalculator.Key;

/**
 * End-of-season referee / scorekeeper pay: rates, the finalize snapshot, the confirm-your-totals
 * emails, and the workbook the rink is invoiced with.
 *
 * <p>The season is never edited from here. Fixing a disputed total means fixing the game's
 * staffing on the Assignments page and finalizing again; only lines whose numbers actually
 * changed lose their confirmation.
 */
@Service
public class StaffPayService {

    private static final Logger logger = LoggerFactory.getLogger(StaffPayService.class);

    private static final ZoneId LEAGUE_TZ = ZoneId.of("America/Chicago");
    private static final DateTimeFormatter GAME_FMT = DateTimeFormatter.ofPattern("EEE MMM d, h:mm a");
    private static final int TOKEN_TTL_DAYS = 7;
    private static final Set<String> ROLES = Set.of(StaffPayRate.ROLE_REF, StaffPayRate.ROLE_SCOREKEEPER);

    @Autowired
    private StaffPayRateRepository rateRepository;
    @Autowired
    private StaffPayPeriodRepository periodRepository;
    @Autowired
    private StaffPayLineRepository lineRepository;
    @Autowired
    private StaffPayLineGameRepository lineGameRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GameProxyService gameProxyService;
    @Autowired
    private TeamService teamService;
    @Autowired
    private LeagueClient leagueClient;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private EmailService emailService;
    @Autowired
    private AppSettingsService appSettingsService;

    @Value("${app.frontend.url:https://oldbuzzardhockey.com}")
    private String frontendUrl;

    // ------------------------------------------------------------------ rates

    /**
     * Everyone who could appear on the pay sheet: active holders of either role, plus anyone the
     * season's games credit who no longer holds the role (or was deactivated) — they still have to
     * be paid, and finalize would otherwise block on a name the admin can't see.
     */
    public List<StaffPayDto.RateView> getRates(Long seasonId) {
        Map<Key, Credits> credits = seasonId == null ? Map.of() : credits(seasonId);
        Map<Key, Integer> rates = rateMap();

        Map<Key, StaffPayDto.RateView> out = new LinkedHashMap<>();
        for (String role : List.of(StaffPayRate.ROLE_REF, StaffPayRate.ROLE_SCOREKEEPER)) {
            for (User u : userRepository.findByRoles_Name(role)) {
                if (!Boolean.TRUE.equals(u.getIsActive())) {
                    continue;
                }
                out.put(new Key(u.getId(), role), rateView(u, role, true, rates, credits));
            }
        }
        Set<Long> missingUsers = credits.keySet().stream()
                .filter(k -> !out.containsKey(k)).map(Key::userId).collect(Collectors.toSet());
        Map<Long, User> extra = usersById(missingUsers);
        for (Key k : credits.keySet()) {
            if (out.containsKey(k)) {
                continue;
            }
            User u = extra.get(k.userId());
            if (u != null) {
                out.put(k, rateView(u, k.role(), false, rates, credits));
            }
        }
        return out.values().stream()
                .sorted(Comparator.comparing(StaffPayDto.RateView::getRole)
                        .thenComparing(v -> v.getName().toLowerCase(Locale.ROOT)))
                .collect(Collectors.toList());
    }

    private StaffPayDto.RateView rateView(User u, String role, boolean hasRole,
            Map<Key, Integer> rates, Map<Key, Credits> credits) {
        Key k = new Key(u.getId(), role);
        Credits c = credits.get(k);
        return new StaffPayDto.RateView(u.getId(), userName(u), u.getEmail(), role, rates.get(k),
                c == null ? 0 : c.getGames(), c == null ? 0 : c.getSoloGames(),
                hasRole, Boolean.TRUE.equals(u.getIsActive()));
    }

    @Transactional
    public StaffPayDto.RateView saveRate(Long userId, String role, Integer rateCents, Long adminId) {
        String r = normalizeRole(role);
        if (rateCents == null || rateCents < 0) {
            throw new RuntimeException("Rate must be zero or more");
        }
        User u = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        StaffPayRate rate = rateRepository.findByUserIdAndRole(userId, r).orElseGet(StaffPayRate::new);
        rate.setUserId(userId);
        rate.setRole(r);
        rate.setRateCents(rateCents);
        rate.setUpdatedBy(adminId);
        rateRepository.save(rate);
        boolean hasRole = u.getRoles() != null && u.getRoles().stream().anyMatch(x -> r.equals(x.getName()));
        return new StaffPayDto.RateView(userId, userName(u), u.getEmail(), r, rateCents, 0, 0, hasRole,
                Boolean.TRUE.equals(u.getIsActive()));
    }

    // ---------------------------------------------------------------- summary

    public StaffPayDto.SummaryView getSummary(Long seasonId) {
        Map<Key, Credits> credits = credits(seasonId);
        Map<Key, Integer> rates = rateMap();
        Map<Long, User> users = usersById(credits.keySet().stream().map(Key::userId).collect(Collectors.toSet()));

        StaffPayDto.SummaryView v = new StaffPayDto.SummaryView();
        v.setSeasonId(seasonId);
        v.setSeasonName(seasonName(seasonId));
        v.setFinanceEmail(appSettingsService.get(AppSettingsService.FINANCE_REPORT_EMAIL).orElse(null));

        List<StaffPayDto.LiveTotal> live = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (Map.Entry<Key, Credits> e : credits.entrySet()) {
            Key k = e.getKey();
            Credits c = e.getValue();
            Integer rate = rates.get(k);
            User u = users.get(k.userId());
            String name = u == null ? ("User " + k.userId()) : userName(u);
            live.add(new StaffPayDto.LiveTotal(k.userId(), name, k.role(), c.getGames(), c.getSoloGames(),
                    rate, rate == null ? null : c.getGames() * rate));
            if (rate == null) {
                missing.add(name + " (" + roleLabel(k.role()) + ")");
            }
        }
        live.sort(Comparator.comparing(StaffPayDto.LiveTotal::getRole)
                .thenComparing(t -> t.getName().toLowerCase(Locale.ROOT)));
        v.setLive(live);
        missing.sort(String.CASE_INSENSITIVE_ORDER);
        v.setMissingRates(missing);

        Optional<StaffPayPeriod> periodOpt = periodRepository.findBySeasonId(seasonId);
        if (periodOpt.isEmpty()) {
            v.setPeriodStatus(StaffPayPeriod.STATUS_DRAFT);
            v.setLines(List.of());
            return v;
        }
        StaffPayPeriod p = periodOpt.get();
        v.setPeriodStatus(p.getStatus());
        v.setTitle(p.getTitle());
        v.setFinalizedAt(p.getFinalizedAt());
        v.setConfirmationsSentAt(p.getConfirmationsSentAt());
        v.setReportSentAt(p.getReportSentAt());
        v.setReportSentTo(p.getReportSentTo());

        List<StaffPayLine> lines = lineRepository.findByPeriodId(p.getId());
        Map<Long, User> lineUsers = usersById(lines.stream().map(StaffPayLine::getUserId).collect(Collectors.toSet()));
        Map<Long, List<StaffPayLineGame>> gamesByLine = lineGameRepository
                .findByLineIdInOrderByGameDateAsc(lines.stream().map(StaffPayLine::getId).toList())
                .stream().collect(Collectors.groupingBy(StaffPayLineGame::getLineId));

        List<StaffPayDto.LineView> views = new ArrayList<>();
        int pending = 0;
        int confirmed = 0;
        int disputed = 0;
        int total = 0;
        boolean anyStale = false;
        for (StaffPayLine l : lines) {
            StaffPayDto.LineView lv = toLineView(l, lineUsers.get(l.getUserId()), gamesByLine.getOrDefault(l.getId(), List.of()));
            Key k = new Key(l.getUserId(), l.getRole());
            Credits c = credits.get(k);
            Integer rate = rates.get(k);
            int liveGames = c == null ? 0 : c.getGames();
            int liveSolo = c == null ? 0 : c.getSoloGames();
            lv.setStale(liveGames != l.getGames() || liveSolo != l.getSoloGames()
                    || rate == null || rate.intValue() != l.getRateCents());
            anyStale |= lv.isStale();
            views.add(lv);
            total += l.getTotalCents();
            if (l.isResolved()) {
                confirmed++;
            } else if (StaffPayLine.STATUS_DISPUTED.equals(l.getConfirmStatus())) {
                disputed++;
            } else {
                pending++;
            }
        }
        // Someone credited now who has no line at all is also drift.
        Set<Key> lineKeys = lines.stream().map(l -> new Key(l.getUserId(), l.getRole())).collect(Collectors.toSet());
        anyStale |= credits.keySet().stream().anyMatch(k -> !lineKeys.contains(k));

        views.sort(Comparator.comparing(StaffPayDto.LineView::getRole)
                .thenComparing(x -> x.getName().toLowerCase(Locale.ROOT)));
        v.setLines(views);
        v.setStale(anyStale);
        v.setPending(pending);
        v.setConfirmed(confirmed);
        v.setDisputed(disputed);
        v.setTotalCents(total);
        v.setReportReady(reportReady(p, lines));
        return v;
    }

    // --------------------------------------------------------------- finalize

    /**
     * Snapshots the season's totals. Refuses while anyone credited has no rate, listing them by
     * name so the admin can go set them. Lines whose numbers haven't moved keep whatever
     * confirmation they already have; changed ones drop back to PENDING with their link burned.
     * People who no longer have credits lose their line.
     */
    @Transactional
    public StaffPayDto.SummaryView finalize(Long seasonId, Long adminId) {
        Map<Key, Credits> credits = credits(seasonId);
        if (credits.isEmpty()) {
            throw new RuntimeException("No worked games yet in this season — nothing to finalize.");
        }
        Map<Key, Integer> rates = rateMap();
        Map<Long, User> users = usersById(credits.keySet().stream().map(Key::userId).collect(Collectors.toSet()));

        List<String> missing = credits.keySet().stream()
                .filter(k -> !rates.containsKey(k))
                .map(k -> (users.containsKey(k.userId()) ? userName(users.get(k.userId())) : "User " + k.userId())
                        + " (" + roleLabel(k.role()) + ")")
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
        if (!missing.isEmpty()) {
            throw new MissingRatesException(missing);
        }

        StaffPayPeriod p = periodRepository.findBySeasonId(seasonId).orElseGet(() -> {
            StaffPayPeriod np = new StaffPayPeriod();
            np.setSeasonId(seasonId);
            return np;
        });
        p.setStatus(StaffPayPeriod.STATUS_FINALIZED);
        p.setFinalizedAt(LocalDateTime.now());
        p.setFinalizedBy(adminId);
        p.setTitle(reportTitle(seasonId, adminId));
        p = periodRepository.save(p);

        Map<Key, StaffPayLine> existing = lineRepository.findByPeriodId(p.getId()).stream()
                .collect(Collectors.toMap(l -> new Key(l.getUserId(), l.getRole()), l -> l));
        Map<Long, String> teamNames = new HashMap<>();

        for (Map.Entry<Key, Credits> e : credits.entrySet()) {
            Key k = e.getKey();
            Credits c = e.getValue();
            int rate = rates.get(k);
            StaffPayLine l = existing.remove(k);
            boolean changed;
            if (l == null) {
                l = new StaffPayLine();
                l.setPeriodId(p.getId());
                l.setUserId(k.userId());
                l.setRole(k.role());
                changed = true;
            } else {
                changed = l.getGames() != c.getGames() || l.getSoloGames() != c.getSoloGames()
                        || l.getRateCents() != rate;
            }
            l.setGames(c.getGames());
            l.setSoloGames(c.getSoloGames());
            l.setRateCents(rate);
            l.setTotalCents(c.getGames() * rate);
            if (changed) {
                // A $0 rate is "doesn't want to be paid" — nothing for them to confirm.
                l.setConfirmStatus(rate == 0 ? StaffPayLine.STATUS_ADMIN_CONFIRMED : StaffPayLine.STATUS_PENDING);
                l.setConfirmTokenHash(null);
                l.setTokenExpiresAt(null);
                l.setEmailSentAt(null);
                l.setRespondedAt(null);
                l.setDisputeNote(null);
            }
            l = lineRepository.save(l);

            lineGameRepository.deleteByLineId(l.getId());
            for (GameCredit gc : c.getGameList()) {
                StaffPayLineGame lg = new StaffPayLineGame();
                lg.setLineId(l.getId());
                lg.setGameId(gc.gameId());
                lg.setGameDate(gc.gameDate());
                lg.setMatchup(teamName(gc.homeTeamId(), teamNames) + " vs " + teamName(gc.awayTeamId(), teamNames));
                lg.setSolo(gc.solo());
                lineGameRepository.save(lg);
            }
        }
        for (StaffPayLine gone : existing.values()) {
            lineGameRepository.deleteByLineId(gone.getId());
            lineRepository.delete(gone);
        }
        return getSummary(seasonId);
    }

    /** Thrown by {@link #finalize} so the controller can hand the names back as structured data. */
    public static class MissingRatesException extends RuntimeException {
        private final List<String> missing;

        public MissingRatesException(List<String> missing) {
            super("Set a rate for everyone who worked a game before finalizing: " + String.join(", ", missing));
            this.missing = missing;
        }

        public List<String> getMissing() {
            return missing;
        }
    }

    // ---------------------------------------------------------- confirmations

    /** Emails every PENDING line a fresh confirm link. Already-confirmed and disputed lines are left alone. */
    @Transactional
    public StaffPayDto.SendResult sendConfirmations(Long seasonId, Long adminId) {
        StaffPayPeriod p = requireFinalized(seasonId);
        List<StaffPayLine> pending = lineRepository.findByPeriodId(p.getId()).stream()
                .filter(l -> StaffPayLine.STATUS_PENDING.equals(l.getConfirmStatus()))
                .toList();
        StaffPayDto.SendResult result = sendLines(p, pending, adminId);
        if (result.getSent() > 0) {
            p.setConfirmationsSentAt(LocalDateTime.now());
            periodRepository.save(p);
        }
        return result;
    }

    /** Re-issues one person's link — a new token, the old one is dead. Works for disputed lines too. */
    @Transactional
    public StaffPayDto.SendResult resendLine(Long lineId, Long adminId) {
        StaffPayLine l = lineRepository.findById(lineId).orElseThrow(() -> new RuntimeException("Line not found"));
        StaffPayPeriod p = periodRepository.findById(l.getPeriodId()).orElseThrow(() -> new RuntimeException("Period not found"));
        if (l.isResolved()) {
            throw new RuntimeException("This total is already confirmed.");
        }
        l.setConfirmStatus(StaffPayLine.STATUS_PENDING);
        l.setDisputeNote(null);
        l.setRespondedAt(null);
        return sendLines(p, List.of(l), adminId);
    }

    private StaffPayDto.SendResult sendLines(StaffPayPeriod p, List<StaffPayLine> lines, Long adminId) {
        User admin = userRepository.findById(adminId).orElse(null);
        String adminName = admin == null ? null : userName(admin);
        String replyTo = admin == null ? null : admin.getEmail();
        String season = seasonName(p.getSeasonId());
        Map<Long, User> users = usersById(lines.stream().map(StaffPayLine::getUserId).collect(Collectors.toSet()));

        int sent = 0;
        int skipped = 0;
        List<String> failed = new ArrayList<>();
        for (StaffPayLine l : lines) {
            User u = users.get(l.getUserId());
            if (u == null || u.getEmail() == null || u.getEmail().isBlank()) {
                skipped++;
                continue;
            }
            String rawToken = UUID.randomUUID().toString() + UUID.randomUUID().toString();
            l.setConfirmTokenHash(passwordEncoder.encode(rawToken));
            l.setTokenExpiresAt(LocalDateTime.now().plusDays(TOKEN_TTL_DAYS));

            String base = frontendUrl + "/pay-confirm?id=" + l.getId() + "&token=" + rawToken;
            String rows = lineGameRepository.findByLineIdOrderByGameDateAsc(l.getId()).stream()
                    .map(g -> EmailService.staffPayGameRow(htmlEscape(dateLabel(g.getGameDate())),
                            htmlEscape(g.getMatchup()), Boolean.TRUE.equals(g.getSolo())))
                    .collect(Collectors.joining());
            boolean ok = emailService.sendStaffPayConfirmEmail(u.getEmail(), htmlEscape(firstName(u)),
                    roleLabel(l.getRole()), htmlEscape(season), l.getGames(), l.getSoloGames(),
                    money(l.getTotalCents()), rows, base + "&action=confirm", base + "&action=dispute",
                    htmlEscape(adminName), replyTo);
            if (ok) {
                l.setEmailSentAt(LocalDateTime.now());
                sent++;
            } else {
                failed.add(userName(u));
            }
            lineRepository.save(l);
        }
        return new StaffPayDto.SendResult(sent, skipped, failed);
    }

    public StaffPayDto.TokenLineView getLineByToken(Long id, String token) {
        return toTokenView(validateToken(id, token));
    }

    @Transactional
    public StaffPayDto.TokenLineView respondByToken(Long id, String token, String action, String note) {
        StaffPayLine l = validateToken(id, token);
        String act = action == null ? "" : action.trim().toLowerCase(Locale.ROOT);
        if (act.equals("confirm")) {
            l.setConfirmStatus(StaffPayLine.STATUS_CONFIRMED);
            l.setDisputeNote(null);
        } else if (act.equals("dispute")) {
            l.setConfirmStatus(StaffPayLine.STATUS_DISPUTED);
            l.setDisputeNote(note == null || note.isBlank() ? null : note.trim());
        } else {
            throw new RuntimeException("Action must be 'confirm' or 'dispute'");
        }
        l.setRespondedAt(LocalDateTime.now());
        // Single use, like the shift confirm link: the email stays in their inbox for weeks.
        l.setConfirmTokenHash(null);
        l.setTokenExpiresAt(null);
        lineRepository.save(l);

        if (StaffPayLine.STATUS_DISPUTED.equals(l.getConfirmStatus())) {
            notifyDispute(l);
        }
        return toTokenView(l);
    }

    private void notifyDispute(StaffPayLine l) {
        try {
            StaffPayPeriod p = periodRepository.findById(l.getPeriodId()).orElse(null);
            User admin = p == null || p.getFinalizedBy() == null ? null
                    : userRepository.findById(p.getFinalizedBy()).orElse(null);
            if (admin == null || admin.getEmail() == null) {
                return;
            }
            User who = userRepository.findById(l.getUserId()).orElse(null);
            String totals = l.getGames() + " games" + (l.getSoloGames() > 0 ? " (" + l.getSoloGames() + " solo)" : "")
                    + " at " + money(l.getRateCents()) + " = " + money(l.getTotalCents());
            emailService.sendStaffPayDisputeNoticeEmail(admin.getEmail(), htmlEscape(firstName(admin)),
                    htmlEscape(who == null ? "Someone" : userName(who)), roleLabel(l.getRole()),
                    htmlEscape(seasonName(p.getSeasonId())), htmlEscape(totals), htmlEscape(l.getDisputeNote()),
                    frontendUrl + "/admin?tab=staffpay");
        } catch (RuntimeException e) {
            // The dispute itself is already saved; the notice is best-effort.
            logger.warn("Dispute notice for pay line {} not sent: {}", l.getId(), e.getMessage());
        }
    }

    @Transactional
    public StaffPayDto.LineView adminConfirmLine(Long lineId) {
        StaffPayLine l = lineRepository.findById(lineId).orElseThrow(() -> new RuntimeException("Line not found"));
        l.setConfirmStatus(StaffPayLine.STATUS_ADMIN_CONFIRMED);
        l.setRespondedAt(LocalDateTime.now());
        l.setConfirmTokenHash(null);
        l.setTokenExpiresAt(null);
        lineRepository.save(l);
        User u = userRepository.findById(l.getUserId()).orElse(null);
        return toLineView(l, u, lineGameRepository.findByLineIdOrderByGameDateAsc(l.getId()));
    }

    // ----------------------------------------------------------------- report

    public String reportFilename(Long seasonId) {
        String s = seasonName(seasonId).replaceAll("[^A-Za-z0-9]+", "_").replaceAll("^_|_$", "");
        return "OBHL_Staff_Pay_" + (s.isBlank() ? seasonId : s) + ".xlsx";
    }

    /** The workbook, from the finalized snapshot. Refuses until every line is confirmed. */
    public byte[] buildReport(Long seasonId) {
        StaffPayPeriod p = requireFinalized(seasonId);
        List<StaffPayLine> lines = lineRepository.findByPeriodId(p.getId());
        if (!reportReady(p, lines)) {
            throw new RuntimeException("Every total has to be confirmed (or marked confirmed by you) before the report can be generated.");
        }
        Map<Key, Integer> lineGames = lines.stream()
                .collect(Collectors.toMap(l -> new Key(l.getUserId(), l.getRole()), StaffPayLine::getGames));
        Map<Key, Integer> lineRates = lines.stream()
                .collect(Collectors.toMap(l -> new Key(l.getUserId(), l.getRole()), StaffPayLine::getRateCents));

        // Everyone with a rate appears, blank games if they didn't work — that is how the rink's
        // sheet reads, and it lets the rink see the whole roster's rates in one place.
        List<StaffPayRate> allRates = rateRepository.findAll();
        Set<Long> ids = allRates.stream().map(StaffPayRate::getUserId).collect(Collectors.toSet());
        ids.addAll(lines.stream().map(StaffPayLine::getUserId).toList());
        Map<Long, User> users = usersById(ids);

        List<StaffPayWorkbookBuilder.Line> refs = new ArrayList<>();
        List<StaffPayWorkbookBuilder.Line> sks = new ArrayList<>();
        Set<Key> seen = new HashSet<>();
        for (StaffPayRate r : allRates) {
            Key k = new Key(r.getUserId(), r.getRole());
            User u = users.get(r.getUserId());
            if (u == null || !seen.add(k)) {
                continue;
            }
            boolean worked = lineGames.containsKey(k);
            if (!worked && !Boolean.TRUE.equals(u.getIsActive())) {
                continue;
            }
            int rate = worked ? lineRates.get(k) : r.getRateCents();
            StaffPayWorkbookBuilder.Line line = new StaffPayWorkbookBuilder.Line(userName(u),
                    lineGames.getOrDefault(k, 0), rate);
            (StaffPayRate.ROLE_REF.equals(k.role()) ? refs : sks).add(line);
        }
        for (StaffPayLine l : lines) {
            Key k = new Key(l.getUserId(), l.getRole());
            User u = users.get(l.getUserId());
            if (u == null || !seen.add(k)) {
                continue;
            }
            StaffPayWorkbookBuilder.Line line = new StaffPayWorkbookBuilder.Line(userName(u), l.getGames(), l.getRateCents());
            (StaffPayRate.ROLE_REF.equals(k.role()) ? refs : sks).add(line);
        }

        String title = p.getTitle() == null ? reportTitle(seasonId, p.getFinalizedBy()) : p.getTitle();
        String skTitle = title.replaceFirst(" \\(", " Scorekeepers (");
        if (skTitle.equals(title)) {
            skTitle = title + " Scorekeepers";
        }
        try {
            return StaffPayWorkbookBuilder.build(seasonName(seasonId), title, skTitle, refs, sks);
        } catch (IOException e) {
            throw new RuntimeException("Could not build the workbook: " + e.getMessage(), e);
        }
    }

    @Transactional
    public StaffPayDto.SummaryView sendReport(Long seasonId, String toEmail, boolean saveAsDefault, Long adminId) {
        if (toEmail == null || !toEmail.contains("@")) {
            throw new RuntimeException("Enter the email address the report should go to.");
        }
        String to = toEmail.trim();
        byte[] xlsx = buildReport(seasonId);
        StaffPayPeriod p = requireFinalized(seasonId);
        List<StaffPayLine> lines = lineRepository.findByPeriodId(p.getId());
        int refCents = lines.stream().filter(l -> StaffPayRate.ROLE_REF.equals(l.getRole())).mapToInt(StaffPayLine::getTotalCents).sum();
        int skCents = lines.stream().filter(l -> StaffPayRate.ROLE_SCOREKEEPER.equals(l.getRole())).mapToInt(StaffPayLine::getTotalCents).sum();
        String summary = "Referees " + money(refCents) + " &middot; Scorekeepers " + money(skCents)
                + " &middot; Total " + money(refCents + skCents);

        User admin = userRepository.findById(adminId).orElse(null);
        String season = seasonName(seasonId);
        boolean ok = emailService.sendStaffPayReportEmail(to, htmlEscape(season),
                admin == null ? null : htmlEscape(userName(admin)), summary, reportFilename(seasonId), xlsx,
                admin == null ? null : admin.getEmail());
        if (!ok) {
            throw new RuntimeException("The email could not be sent. Check the mail configuration and try again.");
        }
        p.setStatus(StaffPayPeriod.STATUS_SENT);
        p.setReportSentAt(LocalDateTime.now());
        p.setReportSentTo(to);
        periodRepository.save(p);
        if (saveAsDefault) {
            appSettingsService.set(AppSettingsService.FINANCE_REPORT_EMAIL, to, adminId);
        }
        return getSummary(seasonId);
    }

    // ---------------------------------------------------------------- helpers

    private Map<Key, Credits> credits(Long seasonId) {
        List<GameResponseDTO> games = gameProxyService.getGamesBySeason(seasonId);
        return StaffPayCalculator.compute(games, LocalDateTime.now(ZoneOffset.UTC));
    }

    private Map<Key, Integer> rateMap() {
        Map<Key, Integer> out = new HashMap<>();
        for (StaffPayRate r : rateRepository.findAll()) {
            out.put(new Key(r.getUserId(), r.getRole()), r.getRateCents());
        }
        return out;
    }

    private Map<Long, User> usersById(Set<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(ids).stream().collect(Collectors.toMap(User::getId, u -> u));
    }

    private StaffPayPeriod requireFinalized(Long seasonId) {
        StaffPayPeriod p = periodRepository.findBySeasonId(seasonId)
                .orElseThrow(() -> new RuntimeException("Finalize the season's assignments first."));
        if (StaffPayPeriod.STATUS_DRAFT.equals(p.getStatus())) {
            throw new RuntimeException("Finalize the season's assignments first.");
        }
        return p;
    }

    static boolean reportReady(StaffPayPeriod p, List<StaffPayLine> lines) {
        return p != null && !StaffPayPeriod.STATUS_DRAFT.equals(p.getStatus())
                && !lines.isEmpty() && lines.stream().allMatch(StaffPayLine::isResolved);
    }

    private StaffPayLine validateToken(Long id, String token) {
        if (id == null || token == null || token.isBlank()) {
            throw new RuntimeException("Invalid confirmation link.");
        }
        StaffPayLine l = lineRepository.findById(id).orElseThrow(() -> new RuntimeException("Invalid confirmation link."));
        if (l.getConfirmTokenHash() == null || l.getTokenExpiresAt() == null
                || LocalDateTime.now().isAfter(l.getTokenExpiresAt())) {
            if (l.isResolved() || StaffPayLine.STATUS_DISPUTED.equals(l.getConfirmStatus())) {
                throw new RuntimeException("This link has already been used. If you need to change your answer, reply to the email.");
            }
            throw new RuntimeException("This link has expired. Ask the league to resend your totals.");
        }
        if (!passwordEncoder.matches(token, l.getConfirmTokenHash())) {
            throw new RuntimeException("Invalid confirmation link.");
        }
        return l;
    }

    private StaffPayDto.TokenLineView toTokenView(StaffPayLine l) {
        StaffPayDto.TokenLineView v = new StaffPayDto.TokenLineView();
        v.setId(l.getId());
        v.setName(userRepository.findById(l.getUserId()).map(this::userName).orElse(""));
        v.setRole(l.getRole());
        v.setSeasonName(periodRepository.findById(l.getPeriodId()).map(p -> seasonName(p.getSeasonId())).orElse(""));
        v.setGames(l.getGames());
        v.setSoloGames(l.getSoloGames());
        v.setRateCents(l.getRateCents());
        v.setTotalCents(l.getTotalCents());
        v.setConfirmStatus(l.getConfirmStatus());
        v.setGameRows(gameRows(lineGameRepository.findByLineIdOrderByGameDateAsc(l.getId())));
        return v;
    }

    private StaffPayDto.LineView toLineView(StaffPayLine l, User u, List<StaffPayLineGame> games) {
        StaffPayDto.LineView v = new StaffPayDto.LineView();
        v.setId(l.getId());
        v.setUserId(l.getUserId());
        v.setName(u == null ? ("User " + l.getUserId()) : userName(u));
        v.setEmail(u == null ? null : u.getEmail());
        v.setRole(l.getRole());
        v.setGames(l.getGames());
        v.setSoloGames(l.getSoloGames());
        v.setRateCents(l.getRateCents());
        v.setTotalCents(l.getTotalCents());
        v.setConfirmStatus(l.getConfirmStatus());
        v.setEmailSentAt(l.getEmailSentAt());
        v.setRespondedAt(l.getRespondedAt());
        v.setDisputeNote(l.getDisputeNote());
        v.setGameRows(gameRows(games));
        return v;
    }

    private List<StaffPayDto.GameRow> gameRows(List<StaffPayLineGame> games) {
        return games.stream()
                .map(g -> new StaffPayDto.GameRow(g.getGameId(), g.getGameDate(), dateLabel(g.getGameDate()),
                        g.getMatchup(), Boolean.TRUE.equals(g.getSolo())))
                .toList();
    }

    private String reportTitle(Long seasonId, Long adminId) {
        String season = seasonName(seasonId);
        String who = adminId == null ? null : userRepository.findById(adminId).map(this::userName).orElse(null);
        String base = season.regionMatches(true, 0, "OBHL", 0, 4) ? season : "OBHL " + season;
        return who == null ? base : base + " (" + who + ")";
    }

    /** league-service returns seasons as loose maps; same lookup as GoaliePerformanceService. */
    private String seasonName(Long seasonId) {
        try {
            List<Map<String, Object>> raw = leagueClient.getSeasons("ALL");
            if (raw != null) {
                for (Map<String, Object> s : raw) {
                    Object id = s.get("id");
                    if (id instanceof Number && ((Number) id).longValue() == seasonId && s.get("name") != null) {
                        return String.valueOf(s.get("name"));
                    }
                }
            }
        } catch (RuntimeException e) {
            logger.warn("Season {} name lookup failed: {}", seasonId, e.getMessage());
        }
        return "Season " + seasonId;
    }

    private String teamName(Long teamId, Map<Long, String> cache) {
        if (teamId == null) {
            return "TBD";
        }
        return cache.computeIfAbsent(teamId,
                id -> teamService.getTeamById(id).map(t -> t.getName()).orElse("Team " + id));
    }

    private static String dateLabel(LocalDateTime utc) {
        return utc == null ? "TBD" : utc.atZone(ZoneOffset.UTC).withZoneSameInstant(LEAGUE_TZ).format(GAME_FMT);
    }

    private static String roleLabel(String role) {
        return StaffPayRate.ROLE_SCOREKEEPER.equals(role) ? "Scorekeeper" : "Referee";
    }

    private static String normalizeRole(String role) {
        String r = role == null ? "" : role.trim().toUpperCase(Locale.ROOT);
        if (r.equals("REFEREE")) {
            r = StaffPayRate.ROLE_REF;
        }
        if (!ROLES.contains(r)) {
            throw new RuntimeException("Role must be REF or SCOREKEEPER");
        }
        return r;
    }

    static String money(int cents) {
        return String.format(Locale.US, "$%,d", cents / 100) + (cents % 100 == 0 ? "" : String.format(Locale.US, ".%02d", cents % 100));
    }

    private String userName(User u) {
        return (u.getFirstName() != null && u.getLastName() != null && !u.getFirstName().isBlank())
                ? (u.getFirstName() + " " + u.getLastName()).trim()
                : u.getUsername();
    }

    private static String firstName(User u) {
        return (u.getFirstName() != null && !u.getFirstName().isBlank()) ? u.getFirstName() : u.getUsername();
    }

    private static String htmlEscape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
