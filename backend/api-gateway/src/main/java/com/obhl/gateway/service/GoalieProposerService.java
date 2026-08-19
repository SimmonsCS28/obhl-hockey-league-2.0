package com.obhl.gateway.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.obhl.gateway.dto.CoordinatorDto;
import com.obhl.gateway.dto.GameResponseDTO;
import com.obhl.gateway.dto.PlayerDto;
import com.obhl.gateway.model.GoalieAvailability;
import com.obhl.gateway.model.SeasonGoalie;
import com.obhl.gateway.model.ShiftAssignment;
import com.obhl.gateway.model.User;
import com.obhl.gateway.repository.GoalieAvailabilityRepository;
import com.obhl.gateway.repository.SeasonGoalieRepository;
import com.obhl.gateway.repository.ShiftAssignmentRepository;
import com.obhl.gateway.repository.UserRepository;

/**
 * Weekly goalie auto-proposer. Fills a single week's open goalie slots from the season's
 * full-time goalie roster (season_goalies).
 *
 * <p>Optimizer (ported from the standalone prototype, scratchpad/goalie_assign.py):
 * <ul>
 *   <li><b>HARD:</b> the two goalies in a game are at most one fuzzy tier apart.</li>
 *   <li><b>Who plays</b> = fairness: sit whoever has the most games played so far.</li>
 *   <li><b>Who faces whom</b> = skill: pair goalies close in rating (global min-cost matching).</li>
 *   <li><b>Which game</b> = rotation: push each goalie away from any early/mid/late bucket they've
 *       had more than their fair share of this season, and away from teams they saw last week.</li>
 * </ul>
 *
 * <p>Time buckets are RELATIVE per week — the week's earliest start is "early", the latest is
 * "late", everything between is "mid" — so they survive week-to-week schedule shifts.
 *
 * <p>The output is always a <em>proposal for review</em>: filled slots are written as
 * {@link ShiftAssignment#STATUS_AUTO_PROPOSED} rows with no email sent.
 */
@Service
public class GoalieProposerService {

    private static final int GOALIE_SLOTS_PER_GAME = 2;

    // Cost weights, in the priority order the prototype established:
    // skill closeness > slot rotation > team rotation.
    private static final int W_SKILL = 10;      // per point of rating difference within a game
    private static final int W_NOTSHARE = 60;   // pair is tier-adjacent but shares no tier
    private static final int W_BUCKET = 8;      // per game of over-representation in a time bucket
    private static final int W_TEAM = 5;        // faces a team they played last week

    private static final String EARLY = "EARLY";
    private static final String MID = "MID";
    private static final String LATE = "LATE";
    private static final List<String> BUCKETS = List.of(EARLY, MID, LATE);

    // Guard rails so a pathological week can't hang the request.
    private static final int MAX_BRUTE_FORCE_GOALIES = 14;
    private static final int MAX_BRUTE_FORCE_GAMES = 8;

    @Autowired
    private SeasonGoalieRepository seasonGoalieRepository;

    @Autowired
    private ShiftAssignmentRepository assignmentRepository;

    @Autowired
    private GoalieAvailabilityRepository availabilityRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlayerService playerService;

    @Autowired
    private GameProxyService gameProxyService;

    @Autowired
    private TeamService teamService;

    @Autowired
    private CoordinatorService coordinatorService;

    /**
     * Fill the week's open goalie slots as AUTO_PROPOSED. Only <em>open</em> slots are touched,
     * so re-running is "Fill Remaining Open Slots" and never overwrites a human's edit.
     */
    @Transactional
    public CoordinatorDto.AutoProposeResult autoPropose(Long seasonId, Integer week, Long coordinatorUserId) {
        if (week == null) {
            throw new RuntimeException("week is required");
        }
        List<GameResponseDTO> allGames = gameProxyService.getGamesBySeason(seasonId);
        if (allGames == null) {
            allGames = List.of();
        }
        List<GameResponseDTO> weekGames = allGames.stream()
                .filter(g -> week.equals(g.getWeek()))
                .sorted(Comparator.comparing(GameResponseDTO::getGameDate,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
        if (weekGames.isEmpty()) {
            throw new RuntimeException("No games scheduled for week " + week);
        }
        // Playoff weeks run a different algorithm (see autoProposePlayoff): the bracket games
        // get the best available goalies, and slot rotation doesn't apply because playoff game
        // times are chosen for the teams involved, not to spread the early/mid/late load.
        boolean playoffWeek = weekGames.stream().noneMatch(GoalieProposerService::isRegularSeason);
        if (playoffWeek) {
            return autoProposePlayoff(seasonId, week, weekGames, coordinatorUserId);
        }

        Map<Long, String> bucketByGame = bucketsForWeek(weekGames);

        // --- Roster + ratings ---
        List<SeasonGoalie> fulltime = seasonGoalieRepository.findBySeasonIdAndIsFulltimeTrue(seasonId);
        Map<Long, User> usersById = userRepository.findAllById(
                        fulltime.stream().map(SeasonGoalie::getUserId).collect(Collectors.toList()))
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        Set<Long> unresolvedRating = new LinkedHashSet<>();
        Map<Long, Integer> skill = skillRatings(seasonId, fulltime, usersById, unresolvedRating);

        // --- Availability: exclude only explicit UNAVAILABLE (locked decision) ---
        Set<Long> unavailable = availabilityRepository.findBySeasonIdAndWeek(seasonId, week).stream()
                .filter(a -> GoalieAvailability.STATUS_UNAVAILABLE.equals(a.getStatus()))
                .map(GoalieAvailability::getUserId)
                .collect(Collectors.toSet());

        // --- Season history: games played, bucket counts, and last week's opponents ---
        History hist = buildHistory(allGames, week);
        Map<Long, Integer> gamesPlayed = hist.gamesPlayed;

        // --- What's already assigned this week ---
        List<Long> gameIds = weekGames.stream().map(GameResponseDTO::getId).collect(Collectors.toList());
        Map<String, ShiftAssignment> bySlot = new HashMap<>();
        Set<Long> usedThisWeek = new HashSet<>();
        for (ShiftAssignment a : assignmentRepository.findByGameIdInAndRole(gameIds, "GOALIE")) {
            bySlot.put(a.getGameId() + ":" + a.getSlot(), a);
            if (a.getUserId() != null) {
                usedThisWeek.add(a.getUserId());
            }
        }

        // --- Eligible pool ---
        List<Long> pool = fulltime.stream()
                .map(SeasonGoalie::getUserId)
                .filter(usersById::containsKey)
                .filter(uid -> !unavailable.contains(uid))
                .filter(uid -> !usedThisWeek.contains(uid))
                .collect(Collectors.toList());

        // --- Split the open work: games needing both goalies vs a lone empty slot ---
        List<GameResponseDTO> openGames = new ArrayList<>();   // both slots free -> pair them
        List<Object[]> loneSlots = new ArrayList<>();          // [game, slot, partnerUserId]
        for (GameResponseDTO g : weekGames) {
            ShiftAssignment s1 = bySlot.get(g.getId() + ":1");
            ShiftAssignment s2 = bySlot.get(g.getId() + ":2");
            if (s1 == null && s2 == null) {
                openGames.add(g);
            } else if (s1 == null) {
                loneSlots.add(new Object[]{ g, 1, s2.getUserId() });
            } else if (s2 == null) {
                loneSlots.add(new Object[]{ g, 2, s1.getUserId() });
            }
        }

        int needed = openGames.size() * GOALIE_SLOTS_PER_GAME + loneSlots.size();

        // --- Who plays: balance first. Fewest games played get the ice; ties broken by rating. ---
        pool.sort(Comparator
                .comparingInt((Long uid) -> gamesPlayed.getOrDefault(uid, 0))
                .thenComparing(uid -> -skill.getOrDefault(uid, 0)));
        List<Long> playing = new ArrayList<>(pool.subList(0, Math.min(needed, pool.size())));
        List<Long> sittingOut = pool.size() > playing.size()
                ? new ArrayList<>(pool.subList(playing.size(), pool.size()))
                : new ArrayList<>();

        List<CoordinatorDto.GoaliePlacement> placements = new ArrayList<>();
        int filled = 0;
        int skillCost = 0;
        int rotationCost = 0;

        // --- 1) Lone slots: pick the best partner for whoever is already in that game ---
        for (Object[] ls : loneSlots) {
            if (playing.isEmpty()) {
                break;
            }
            GameResponseDTO g = (GameResponseDTO) ls[0];
            int slot = (Integer) ls[1];
            Long partner = (Long) ls[2];
            Integer partnerRating = partner == null ? null : skill.get(partner);

            Long best = null;
            int bestCost = Integer.MAX_VALUE;
            for (Long uid : playing) {
                int c = rotationCostFor(uid, g, bucketByGame, hist);
                if (partnerRating != null) {
                    if (!tierCompatible(skill.getOrDefault(uid, 0), partnerRating)) {
                        continue;   // hard rule
                    }
                    c += pairSkillCost(skill.getOrDefault(uid, 0), partnerRating);
                }
                if (c < bestCost) {
                    bestCost = c;
                    best = uid;
                }
            }
            if (best == null) {
                best = playing.get(0);   // no tier-legal option; leave it to the human to swap
                bestCost = rotationCostFor(best, g, bucketByGame, hist);
            }
            playing.remove(best);
            rotationCost += bestCost;
            persist(seasonId, g.getId(), slot, best, coordinatorUserId, bySlot);
            placements.add(placementFor(best, usersById, skill, unresolvedRating, g,
                    bucketByGame, hist));
            filled++;
        }

        // --- 2) Fully open games: pair by skill, then assign pairs to games by rotation ---
        if (!openGames.isEmpty() && playing.size() >= GOALIE_SLOTS_PER_GAME) {
            // Only as many games as we have goalies to fill.
            int gamesFillable = Math.min(openGames.size(), playing.size() / GOALIE_SLOTS_PER_GAME);
            List<GameResponseDTO> targetGames = openGames.subList(0, gamesFillable);
            List<Long> seated = new ArrayList<>(playing.subList(0, gamesFillable * GOALIE_SLOTS_PER_GAME));

            List<long[]> pairs = bestPairing(seated, skill);
            for (long[] p : pairs) {
                skillCost += pairSkillCost(skill.getOrDefault(p[0], 0), skill.getOrDefault(p[1], 0));
            }

            List<Integer> order = bestGameOrder(pairs, targetGames, bucketByGame, hist);
            for (int pi = 0; pi < pairs.size(); pi++) {
                GameResponseDTO g = targetGames.get(order.get(pi));
                long[] pair = pairs.get(pi);
                for (int k = 0; k < 2; k++) {
                    Long uid = pair[k];
                    rotationCost += rotationCostFor(uid, g, bucketByGame, hist);
                    persist(seasonId, g.getId(), k + 1, uid, coordinatorUserId, bySlot);
                    placements.add(placementFor(uid, usersById, skill, unresolvedRating, g,
                            bucketByGame, hist));
                    playing.remove(uid);
                    filled++;
                }
            }
        }

        // --- Report ---
        List<CoordinatorDto.SittingGoalie> sitting = sittingOut.stream()
                .map(uid -> new CoordinatorDto.SittingGoalie(uid, userName(usersById.get(uid), uid),
                        "Most games played (" + gamesPlayed.getOrDefault(uid, 0) + ") — rotating out"))
                .collect(Collectors.toList());

        int stillOpen = (int) weekGames.stream()
                .flatMap(g -> java.util.stream.IntStream.rangeClosed(1, GOALIE_SLOTS_PER_GAME)
                        .mapToObj(slot -> g.getId() + ":" + slot))
                .filter(k -> !bySlot.containsKey(k))
                .count();

        List<String> unrated = unresolvedRating.stream()
                .map(uid -> userName(usersById.get(uid), uid))
                .collect(Collectors.toList());

        String pairingNote = placements.stream().anyMatch(p -> p.getFlags().contains(TIER_FLAG))
                ? "Some games could not satisfy the tier rule — review the flagged slots."
                : "Tier rule satisfied for every paired game.";

        CoordinatorDto.ProposalReasoning reasoning = new CoordinatorDto.ProposalReasoning(
                placements, unrated, skillCost, rotationCost, pairingNote);

        List<CoordinatorDto.AssignmentView> views = coordinatorService.getAssignments(seasonId, "GOALIE", week);
        return new CoordinatorDto.AutoProposeResult(filled, stillOpen, sitting, views, reasoning);
    }

    /**
     * Playoff-week proposal. Different rules from the regular season, deliberately:
     * <ul>
     *   <li><b>Bracket games get the best goalies.</b> Take the top 2N available by rating for the
     *       N bracket games, then pair them adjacently (#1 with #2, #3 with #4, …) so each game is
     *       internally competitive. Availability comes first, so when the pool is thin the pairs
     *       are wider apart than ideal — that's expected, not a failure.</li>
     *   <li><b>No time-slot rotation.</b> Playoff games are scheduled at whatever time suits the
     *       teams involved, so balancing a goalie's early/mid/late history against them is
     *       meaningless. Playoff weeks also never count toward regular-season slot history.</li>
     *   <li><b>Consolation games</b> (same week, no bracket role) are filled from whoever is left,
     *       by fewest games played — ordinary fairness.</li>
     * </ul>
     */
    private CoordinatorDto.AutoProposeResult autoProposePlayoff(Long seasonId, Integer week,
            List<GameResponseDTO> weekGames, Long coordinatorUserId) {

        // A game is a bracket game iff it carries a playoff round; consolation games have it cleared.
        List<GameResponseDTO> bracketGames = weekGames.stream()
                .filter(g -> g.getPlayoffRound() != null && !g.getPlayoffRound().isBlank())
                .collect(Collectors.toList());
        List<GameResponseDTO> consolationGames = weekGames.stream()
                .filter(g -> g.getPlayoffRound() == null || g.getPlayoffRound().isBlank())
                .collect(Collectors.toList());

        List<SeasonGoalie> fulltime = seasonGoalieRepository.findBySeasonIdAndIsFulltimeTrue(seasonId);
        Map<Long, User> usersById = userRepository.findAllById(
                        fulltime.stream().map(SeasonGoalie::getUserId).collect(Collectors.toList()))
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        Set<Long> unresolvedRating = new LinkedHashSet<>();
        Map<Long, Integer> skill = skillRatings(seasonId, fulltime, usersById, unresolvedRating);

        Set<Long> unavailable = availabilityRepository.findBySeasonIdAndWeek(seasonId, week).stream()
                .filter(a -> GoalieAvailability.STATUS_UNAVAILABLE.equals(a.getStatus()))
                .map(GoalieAvailability::getUserId)
                .collect(Collectors.toSet());

        List<GameResponseDTO> allGames = gameProxyService.getGamesBySeason(seasonId);
        History hist = buildHistory(allGames == null ? List.of() : allGames, week);

        List<Long> gameIds = weekGames.stream().map(GameResponseDTO::getId).collect(Collectors.toList());
        Map<String, ShiftAssignment> bySlot = new HashMap<>();
        Set<Long> usedThisWeek = new HashSet<>();
        for (ShiftAssignment a : assignmentRepository.findByGameIdInAndRole(gameIds, "GOALIE")) {
            bySlot.put(a.getGameId() + ":" + a.getSlot(), a);
            if (a.getUserId() != null) {
                usedThisWeek.add(a.getUserId());
            }
        }

        List<Long> pool = fulltime.stream()
                .map(SeasonGoalie::getUserId)
                .filter(usersById::containsKey)
                .filter(uid -> !unavailable.contains(uid))
                .filter(uid -> !usedThisWeek.contains(uid))
                .collect(Collectors.toList());

        List<CoordinatorDto.GoaliePlacement> placements = new ArrayList<>();
        int filled = 0;
        int skillCost = 0;

        // --- Bracket games: the best available goalies, paired adjacently ---
        List<GameResponseDTO> openBracket = bracketGames.stream()
                .filter(g -> !bySlot.containsKey(g.getId() + ":1") && !bySlot.containsKey(g.getId() + ":2"))
                .collect(Collectors.toList());

        // Best available first; unrated goalies sit at the league median (see skillRatings).
        pool.sort(Comparator.comparingInt((Long uid) -> -skill.getOrDefault(uid, 0)));
        int bracketNeeded = Math.min(openBracket.size() * GOALIE_SLOTS_PER_GAME, pool.size());
        List<Long> bracketGoalies = new ArrayList<>(pool.subList(0, bracketNeeded));
        pool.subList(0, bracketNeeded).clear();

        List<long[]> bracketPairs = bestPairing(bracketGoalies, skill);
        for (int i = 0; i < bracketPairs.size() && i < openBracket.size(); i++) {
            GameResponseDTO g = openBracket.get(i);
            long[] pair = bracketPairs.get(i);
            skillCost += pairSkillCost(skill.getOrDefault(pair[0], 0), skill.getOrDefault(pair[1], 0));
            for (int k = 0; k < 2; k++) {
                persist(seasonId, g.getId(), k + 1, pair[k], coordinatorUserId, bySlot);
                placements.add(playoffPlacement(pair[k], usersById, skill, unresolvedRating, g, true));
                filled++;
            }
        }

        // --- Consolation games: whoever's left, fewest games played first ---
        pool.sort(Comparator.comparingInt((Long uid) -> hist.gamesPlayed.getOrDefault(uid, 0)));
        for (GameResponseDTO g : consolationGames) {
            for (int slot = 1; slot <= GOALIE_SLOTS_PER_GAME; slot++) {
                if (bySlot.containsKey(g.getId() + ":" + slot) || pool.isEmpty()) {
                    continue;
                }
                Long uid = pool.remove(0);
                persist(seasonId, g.getId(), slot, uid, coordinatorUserId, bySlot);
                placements.add(playoffPlacement(uid, usersById, skill, unresolvedRating, g, false));
                filled++;
            }
        }

        List<CoordinatorDto.SittingGoalie> sitting = pool.stream()
                .map(uid -> new CoordinatorDto.SittingGoalie(uid, userName(usersById.get(uid), uid),
                        "No slot left this playoff week"))
                .collect(Collectors.toList());

        int stillOpen = (int) weekGames.stream()
                .flatMap(g -> java.util.stream.IntStream.rangeClosed(1, GOALIE_SLOTS_PER_GAME)
                        .mapToObj(slot -> g.getId() + ":" + slot))
                .filter(k -> !bySlot.containsKey(k))
                .count();

        List<String> unrated = unresolvedRating.stream()
                .map(uid -> userName(usersById.get(uid), uid))
                .collect(Collectors.toList());

        String note = bracketGames.isEmpty()
                ? "No bracket games designated for this week yet — seed the bracket first."
                : "Playoff week: best available goalies assigned to " + bracketGames.size()
                        + " bracket game(s); slot rotation not applied.";

        CoordinatorDto.ProposalReasoning reasoning = new CoordinatorDto.ProposalReasoning(
                placements, unrated, skillCost, 0, note);

        List<CoordinatorDto.AssignmentView> views = coordinatorService.getAssignments(seasonId, "GOALIE", week);
        return new CoordinatorDto.AutoProposeResult(filled, stillOpen, sitting, views, reasoning);
    }

    /** Placement row for a playoff game — no slot-history flags, since rotation doesn't apply. */
    private CoordinatorDto.GoaliePlacement playoffPlacement(Long uid, Map<Long, User> usersById,
            Map<Long, Integer> skill, Set<Long> unresolved, GameResponseDTO g, boolean bracket) {
        boolean resolved = !unresolved.contains(uid);
        int rating = skill.getOrDefault(uid, 0);
        List<String> flags = new ArrayList<>();
        if (!resolved) {
            flags.add("No skill rating found — treated as league average for pairing");
        }
        String label = bracket
                ? (g.getPlayoffRound() == null ? "BRACKET" : g.getPlayoffRound())
                : "CONSOLATION";
        return new CoordinatorDto.GoaliePlacement(
                uid, userName(usersById.get(uid), uid),
                resolved ? rating : null, resolved, tierLabel(rating),
                g.getId(), teamName(g.getHomeTeamId()) + " vs " + teamName(g.getAwayTeamId()), label,
                0, 0, 0, flags);
    }

    /**
     * Send Email A ("confirm your time") for every AUTO_PROPOSED goalie slot in the week:
     * transitions each to PROPOSED via the existing propose path, which mints a confirm token
     * and emails the goalie.
     */
    @Transactional
    public CoordinatorDto.SendConfirmationsResult sendConfirmations(Long seasonId, Integer week, Long coordinatorUserId) {
        if (week == null) {
            throw new RuntimeException("week is required");
        }
        List<GameResponseDTO> allGames = gameProxyService.getGamesBySeason(seasonId);
        if (allGames == null) {
            allGames = List.of();
        }
        List<Long> gameIds = allGames.stream()
                .filter(g -> week.equals(g.getWeek()))
                .map(GameResponseDTO::getId)
                .collect(Collectors.toList());
        if (gameIds.isEmpty()) {
            throw new RuntimeException("No games scheduled for week " + week);
        }

        List<ShiftAssignment> weekRows = assignmentRepository.findByGameIdInAndRole(gameIds, "GOALIE");

        // Whether this is the week's first send has to be read BEFORE propose() moves rows out of
        // AUTO_PROPOSED. Anything already PROPOSED or CONFIRMED means confirmations went out for
        // this week once already, and the bench was told then — a top-up send (after a decline, say)
        // must not mail them "you have no game" a second time.
        boolean firstSendForWeek = weekRows.stream().noneMatch(a ->
                ShiftAssignment.STATUS_PROPOSED.equals(a.getStatus())
                        || ShiftAssignment.STATUS_CONFIRMED.equals(a.getStatus()));

        int sent = 0;
        for (ShiftAssignment a : weekRows) {
            if (ShiftAssignment.STATUS_AUTO_PROPOSED.equals(a.getStatus()) && a.getUserId() != null) {
                CoordinatorDto.ProposeRequest req = new CoordinatorDto.ProposeRequest(
                        a.getGameId(), seasonId, "GOALIE", a.getSlot(), a.getUserId());
                coordinatorService.propose(req, coordinatorUserId);
                sent++;
            }
        }

        // Only once the week has actually gone out to somebody: a click that sends no confirmations
        // has announced nothing, so there is nothing for the bench to be told about yet.
        int notifiedUnassigned = (sent > 0 && firstSendForWeek)
                ? coordinatorService.notifyUnassignedGoalies(seasonId, week, coordinatorUserId)
                : 0;

        List<CoordinatorDto.AssignmentView> views = coordinatorService.getAssignments(seasonId, "GOALIE", week);
        return new CoordinatorDto.SendConfirmationsResult(sent, notifiedUnassigned, views);
    }

    /**
     * The season's goalie roster split by full-time vs substitute, for the assign picker
     * ("Add a Substitute" reveals the non-full-time goalies).
     */
    public List<CoordinatorDto.SeasonGoalieView> getSeasonRoster(Long seasonId) {
        List<SeasonGoalie> roster = seasonGoalieRepository.findBySeasonId(seasonId);
        Map<Long, User> usersById = userRepository.findAllById(
                        roster.stream().map(SeasonGoalie::getUserId).collect(Collectors.toList()))
                .stream().collect(Collectors.toMap(User::getId, u -> u));
        return roster.stream()
                .map(sg -> new CoordinatorDto.SeasonGoalieView(
                        sg.getUserId(),
                        userName(usersById.get(sg.getUserId()), sg.getUserId()),
                        Boolean.TRUE.equals(sg.getIsFulltime())))
                .sorted(Comparator.comparing(CoordinatorDto.SeasonGoalieView::getUserName))
                .collect(Collectors.toList());
    }

    /**
     * Regular-season games are the only ones the optimizer looks at. Rows predating the
     * game_type column (null) are treated as regular season, which is what they were.
     */
    static boolean isRegularSeason(GameResponseDTO g) {
        return g.getGameType() == null || "REGULAR_SEASON".equalsIgnoreCase(g.getGameType());
    }

    // ---- fuzzy tiers (locked decision: overlapping bands) ----

    /** T1 = 6–10, T2 = 5–6, T3 = 0–5. A rating can belong to more than one tier. */
    static Set<Integer> tiers(int r) {
        Set<Integer> t = new LinkedHashSet<>();
        if (r >= 6 && r <= 10) t.add(1);
        if (r >= 5 && r <= 6) t.add(2);
        if (r >= 0 && r <= 5) t.add(3);
        if (t.isEmpty()) t.add(3);
        return t;
    }

    static int tierGap(int a, int b) {
        int best = Integer.MAX_VALUE;
        for (int x : tiers(a)) {
            for (int y : tiers(b)) {
                best = Math.min(best, Math.abs(x - y));
            }
        }
        return best;
    }

    /** HARD rule: never pair goalies more than one tier apart (a pure T1 never faces a pure T3). */
    static boolean tierCompatible(int a, int b) {
        return tierGap(a, b) <= 1;
    }

    static boolean sharesTier(int a, int b) {
        Set<Integer> ta = tiers(a);
        return tiers(b).stream().anyMatch(ta::contains);
    }

    static String tierLabel(int r) {
        return "T" + tiers(r).stream().map(String::valueOf).collect(Collectors.joining("/"));
    }

    /**
     * Cost of putting these two in the same game. The rating gap is squared on purpose: with a
     * linear cost, "four even games plus one 6-vs-0 blowout" ties "spread the mismatch around",
     * and the optimizer is free to pick the blowout. Squaring makes one lopsided game always
     * worse than several slightly uneven ones, which is how it actually feels on the ice.
     */
    private static int pairSkillCost(int a, int b) {
        int diff = Math.abs(a - b);
        return W_SKILL * diff * diff + (sharesTier(a, b) ? 0 : W_NOTSHARE);
    }

    // ---- rotation ----

    /** Rank the week's games by start time: earliest = EARLY, latest = LATE, the rest MID. */
    private Map<Long, String> bucketsForWeek(List<GameResponseDTO> weekGames) {
        Map<Long, String> out = new HashMap<>();
        int n = weekGames.size();
        for (int i = 0; i < n; i++) {
            String bucket;
            if (n == 1) {
                bucket = MID;
            } else if (i == 0) {
                bucket = EARLY;
            } else if (i == n - 1) {
                bucket = LATE;
            } else {
                bucket = MID;
            }
            out.put(weekGames.get(i).getId(), bucket);
        }
        return out;
    }

    /**
     * Season-long slot balance: how far above their FAIR SHARE is this goalie in that bucket?
     *
     * <p>Fair share matters because the buckets aren't equally sized — a 5-game night has one
     * early, one late and three mid, so mid is 60% of all slots. Measuring against the goalie's
     * own lightest bucket would therefore flag "too much mid" for nearly everyone and quietly
     * push goalies out of mid. Comparing to the expected share instead means a penalty only
     * appears when someone genuinely has more of a slot than the schedule implies — which is
     * what stops the same goalies owning the early game every week.
     */
    private int bucketCost(Long uid, String bucket, History hist) {
        Map<String, Integer> counts = hist.bucketCounts.getOrDefault(uid, Map.of());
        int mine = counts.getOrDefault(bucket, 0);
        return W_BUCKET * Math.max(0, mine - (int) Math.floor(expectedShare(counts, bucket, hist.bucketSupply)));
    }

    /** How many games in this bucket a goalie with their workload would be expected to have. */
    private double expectedShare(Map<String, Integer> counts, String bucket,
            Map<String, Integer> bucketSupply) {
        int totalSupply = BUCKETS.stream().mapToInt(b -> bucketSupply.getOrDefault(b, 0)).sum();
        if (totalSupply == 0) {
            return 0;
        }
        int played = BUCKETS.stream().mapToInt(b -> counts.getOrDefault(b, 0)).sum();
        return played * (bucketSupply.getOrDefault(bucket, 0) / (double) totalSupply);
    }

    private int rotationCostFor(Long uid, GameResponseDTO g, Map<Long, String> bucketByGame, History hist) {
        int c = bucketCost(uid, bucketByGame.getOrDefault(g.getId(), MID), hist);
        if (facedLastWeek(hist.lastWeekTeams.get(uid), g)) {
            c += W_TEAM;
        }
        return c;
    }

    /**
     * Did this goalie see either of the game's teams last week? Team ids are null on games that
     * are scheduled before the matchup is set (playoffs, TBD fixtures), and both null ids and a
     * null/immutable empty set have to be tolerated — {@code Set.of().contains(null)} throws.
     */
    private boolean facedLastWeek(Set<Long> seen, GameResponseDTO g) {
        if (seen == null || seen.isEmpty()) {
            return false;
        }
        Long home = g.getHomeTeamId();
        Long away = g.getAwayTeamId();
        return (home != null && seen.contains(home)) || (away != null && seen.contains(away));
    }

    // ---- optimizers ----

    private List<long[]> bestPairing(List<Long> goalies, Map<Long, Integer> skill) {
        List<long[]> strict = searchPairing(goalies, skill, true);
        return strict != null ? strict : searchPairing(goalies, skill, false);
    }

    /**
     * Minimum-cost perfect matching over the seated goalies. Branch-and-bound brute force —
     * exact for the league's size (10–12 goalies); falls back to greedy beyond the guard rail.
     */
    private List<long[]> searchPairing(List<Long> goalies, Map<Long, Integer> skill, boolean enforceTier) {
        if (goalies.size() > MAX_BRUTE_FORCE_GOALIES) {
            return greedyPairing(goalies, skill, enforceTier);
        }
        List<long[]> best = new ArrayList<>();
        int[] bestCost = { Integer.MAX_VALUE };
        List<long[]> acc = new ArrayList<>();
        pairRecurse(new ArrayList<>(goalies), skill, enforceTier, acc, 0, best, bestCost);
        return bestCost[0] == Integer.MAX_VALUE ? null : best;
    }

    private void pairRecurse(List<Long> remaining, Map<Long, Integer> skill, boolean enforceTier,
            List<long[]> acc, int cost, List<long[]> best, int[] bestCost) {
        if (cost >= bestCost[0]) {
            return;                     // prune
        }
        if (remaining.size() < 2) {
            bestCost[0] = cost;
            best.clear();
            best.addAll(acc);
            return;
        }
        Long first = remaining.get(0);
        for (int i = 1; i < remaining.size(); i++) {
            Long other = remaining.get(i);
            int ra = skill.getOrDefault(first, 0);
            int rb = skill.getOrDefault(other, 0);
            if (enforceTier && !tierCompatible(ra, rb)) {
                continue;
            }
            List<Long> rest = new ArrayList<>(remaining);
            rest.remove(i);
            rest.remove(0);
            acc.add(new long[]{ first, other });
            pairRecurse(rest, skill, enforceTier, acc, cost + pairSkillCost(ra, rb), best, bestCost);
            acc.remove(acc.size() - 1);
        }
    }

    private List<long[]> greedyPairing(List<Long> goalies, Map<Long, Integer> skill, boolean enforceTier) {
        List<Long> rest = new ArrayList<>(goalies);
        rest.sort(Comparator.comparingInt(uid -> -skill.getOrDefault(uid, 0)));
        List<long[]> out = new ArrayList<>();
        while (rest.size() >= 2) {
            Long a = rest.remove(0);
            int bestIdx = 0;
            int bestCost = Integer.MAX_VALUE;
            for (int i = 0; i < rest.size(); i++) {
                int ra = skill.getOrDefault(a, 0);
                int rb = skill.getOrDefault(rest.get(i), 0);
                if (enforceTier && !tierCompatible(ra, rb)) {
                    continue;
                }
                int c = pairSkillCost(ra, rb);
                if (c < bestCost) {
                    bestCost = c;
                    bestIdx = i;
                }
            }
            out.add(new long[]{ a, rest.remove(bestIdx) });
        }
        return out;
    }

    /** Assign pairs to games so total rotation cost is lowest. Returns pair index -> game index. */
    private List<Integer> bestGameOrder(List<long[]> pairs, List<GameResponseDTO> games,
            Map<Long, String> bucketByGame, History hist) {
        int n = Math.min(pairs.size(), games.size());
        List<Integer> identity = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            identity.add(i);
        }
        if (n > MAX_BRUTE_FORCE_GAMES) {
            return identity;
        }
        List<Integer> best = new ArrayList<>(identity);
        int[] bestCost = { Integer.MAX_VALUE };
        permute(pairs, games, new ArrayList<>(), new boolean[n], n,
                bucketByGame, hist, best, bestCost);
        return best;
    }

    private void permute(List<long[]> pairs, List<GameResponseDTO> games, List<Integer> acc,
            boolean[] used, int n, Map<Long, String> bucketByGame, History hist,
            List<Integer> best, int[] bestCost) {
        if (acc.size() == n) {
            int cost = 0;
            for (int pi = 0; pi < n; pi++) {
                GameResponseDTO g = games.get(acc.get(pi));
                for (long uid : pairs.get(pi)) {
                    cost += rotationCostFor(uid, g, bucketByGame, hist);
                }
            }
            if (cost < bestCost[0]) {
                bestCost[0] = cost;
                best.clear();
                best.addAll(acc);
            }
            return;
        }
        for (int i = 0; i < n; i++) {
            if (used[i]) {
                continue;
            }
            used[i] = true;
            acc.add(i);
            permute(pairs, games, acc, used, n, bucketByGame, hist, best, bestCost);
            acc.remove(acc.size() - 1);
            used[i] = false;
        }
    }

    // ---- history ----

    /** Everything the optimizer knows about the season so far. */
    private static final class History {
        final Map<Long, Integer> gamesPlayed = new HashMap<>();
        final Map<Long, Map<String, Integer>> bucketCounts = new HashMap<>();
        final Map<Long, Set<Long>> lastWeekTeams = new HashMap<>();
        /** How many slots the schedule offers per bucket — mid is the biggest by design. */
        final Map<String, Integer> bucketSupply = new HashMap<>();
    }

    /**
     * Walk every week except the target one, deriving that week's relative buckets, so we know
     * each goalie's early/mid/late spread, their fair share of each slot, and who they saw last week.
     */
    private History buildHistory(List<GameResponseDTO> allGames, Integer targetWeek) {
        History h = new History();
        Map<Long, Integer> gamesPlayed = h.gamesPlayed;
        Map<Long, Map<String, Integer>> bucketCounts = h.bucketCounts;
        Map<Long, Set<Long>> lastWeekTeams = h.lastWeekTeams;
        // Regular season only: playoff weeks have TBD matchups and don't reflect the weekly
        // rotation, so counting them would skew both fairness and slot balance.
        Map<Integer, List<GameResponseDTO>> byWeek = allGames.stream()
                .filter(g -> g.getWeek() != null && !targetWeek.equals(g.getWeek()))
                .filter(GoalieProposerService::isRegularSeason)
                .collect(Collectors.groupingBy(GameResponseDTO::getWeek));

        for (Map.Entry<Integer, List<GameResponseDTO>> e : byWeek.entrySet()) {
            List<GameResponseDTO> wg = e.getValue().stream()
                    .sorted(Comparator.comparing(GameResponseDTO::getGameDate,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .collect(Collectors.toList());
            Map<Long, String> buckets = bucketsForWeek(wg);
            boolean isLastWeek = e.getKey() == targetWeek - 1;

            for (GameResponseDTO g : wg) {
                String bucket = buckets.getOrDefault(g.getId(), MID);
                h.bucketSupply.merge(bucket, GOALIE_SLOTS_PER_GAME, Integer::sum);
                for (Long uid : new Long[]{ g.getGoalie1Id(), g.getGoalie2Id() }) {
                    if (uid == null || uid <= 0) {
                        continue;
                    }
                    gamesPlayed.merge(uid, 1, Integer::sum);
                    bucketCounts.computeIfAbsent(uid, k -> new HashMap<>()).merge(bucket, 1, Integer::sum);
                    if (isLastWeek) {
                        Set<Long> teams = lastWeekTeams.computeIfAbsent(uid, k -> new HashSet<>());
                        if (g.getHomeTeamId() != null) teams.add(g.getHomeTeamId());
                        if (g.getAwayTeamId() != null) teams.add(g.getAwayTeamId());
                    }
                }
            }
        }
        return h;
    }

    // ---- persistence + reporting ----

    private void persist(Long seasonId, Long gameId, int slot, Long userId, Long coordinatorUserId,
            Map<String, ShiftAssignment> bySlot) {
        ShiftAssignment a = new ShiftAssignment();
        a.setGameId(gameId);
        a.setSeasonId(seasonId);
        a.setRole("GOALIE");
        a.setSlot(slot);
        a.setUserId(userId);
        a.setStatus(ShiftAssignment.STATUS_AUTO_PROPOSED);
        a.setPublished(false);
        a.setDeclineReason(null);
        a.setConfirmTokenHash(null);
        a.setTokenExpiresAt(null);
        a.setRespondedAt(null);
        a.setAssignedBy(coordinatorUserId);
        assignmentRepository.save(a);
        bySlot.put(gameId + ":" + slot, a);
    }

    private static final String TIER_FLAG = "Tier rule not satisfied — review this matchup";

    private CoordinatorDto.GoaliePlacement placementFor(Long uid, Map<Long, User> usersById,
            Map<Long, Integer> skill, Set<Long> unresolved, GameResponseDTO g,
            Map<Long, String> bucketByGame, History hist) {
        String bucket = bucketByGame.getOrDefault(g.getId(), MID);
        Map<String, Integer> counts = hist.bucketCounts.getOrDefault(uid, Map.of());
        boolean resolved = !unresolved.contains(uid);
        int rating = skill.getOrDefault(uid, 0);

        List<String> flags = new ArrayList<>();
        if (!resolved) {
            flags.add("No skill rating found — treated as league average for pairing");
        }
        int over = bucketCost(uid, bucket, hist) / W_BUCKET;
        if (over > 0) {
            flags.add("Already played " + bucket + " " + counts.getOrDefault(bucket, 0)
                    + "x this season — " + over + " above their fair share of that slot");
        }
        if (facedLastWeek(hist.lastWeekTeams.get(uid), g)) {
            flags.add("Faces a team they played last week");
        }

        return new CoordinatorDto.GoaliePlacement(
                uid, userName(usersById.get(uid), uid),
                resolved ? rating : null, resolved, tierLabel(rating),
                g.getId(), teamName(g.getHomeTeamId()) + " vs " + teamName(g.getAwayTeamId()), bucket,
                counts.getOrDefault(EARLY, 0), counts.getOrDefault(MID, 0), counts.getOrDefault(LATE, 0),
                flags);
    }

    // ---- helpers ----

    /**
     * Map user_id -> skill_rating by crossing users.email to the season's players row. That link is
     * fragile (email + season_id, see migration 039), so anyone who fails to resolve is recorded in
     * {@code unresolved} and given the league median rather than silently scored 0 — a 0 default
     * would bury a strong goalie at the bottom of every matchup.
     */
    private Map<Long, Integer> skillRatings(Long seasonId, List<SeasonGoalie> fulltime,
            Map<Long, User> usersById, Set<Long> unresolved) {
        Map<String, Integer> byEmail = new HashMap<>();
        try {
            List<PlayerDto> players = playerService.getAllPlayers();
            if (players != null) {
                for (PlayerDto p : players) {
                    if (seasonId.equals(p.getSeasonId()) && p.getEmail() != null && p.getSkillRating() != null) {
                        byEmail.put(p.getEmail().trim().toLowerCase(), p.getSkillRating());
                    }
                }
            }
        } catch (RuntimeException e) {
            // Ratings are best-effort; without stats-service everyone lands in the same band.
        }

        Map<Long, Integer> out = new HashMap<>();
        for (SeasonGoalie sg : fulltime) {
            User u = usersById.get(sg.getUserId());
            Integer rating = (u != null && u.getEmail() != null)
                    ? byEmail.get(u.getEmail().trim().toLowerCase())
                    : null;
            if (rating == null) {
                unresolved.add(sg.getUserId());
            } else {
                out.put(sg.getUserId(), rating);
            }
        }
        int median = median(out.values());
        for (Long uid : unresolved) {
            out.put(uid, median);
        }
        return out;
    }

    private static int median(java.util.Collection<Integer> values) {
        if (values.isEmpty()) {
            return 5;
        }
        List<Integer> sorted = values.stream().sorted().collect(Collectors.toList());
        return sorted.get(sorted.size() / 2);
    }

    private String teamName(Long teamId) {
        if (teamId == null) {
            return "TBD";
        }
        return teamService.getTeamById(teamId).map(t -> t.getName()).orElse("Team " + teamId);
    }

    private String userName(User u, Long fallbackId) {
        if (u == null) {
            return "User " + fallbackId;
        }
        if (u.getFirstName() != null && u.getLastName() != null) {
            return u.getFirstName() + " " + u.getLastName();
        }
        return u.getUsername();
    }
}
