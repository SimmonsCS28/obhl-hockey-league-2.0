package com.obhl.game.service.schedule;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds a tournament's fixture list from its format configuration.
 *
 * <p>Pure: no Spring, no repositories, no entities. Everything is expressed in <b>seeds</b> (1..N)
 * and the caller maps seeds to team ids, which is what makes the whole thing testable without a
 * database. See {@code docs/tournament/02-format-spec.md} for the tables this implements.
 *
 * <p>A sibling of {@code ScheduleGeneratorService} rather than an extension of it. That one assumes
 * a league season — it throws on odd team counts, requires a week count, cycles matchups to fill
 * leftover slots and balances early/late ice across weeks. Roughly 60% of it would have to be
 * disabled for a two-day event.
 */
public final class TournamentScheduleGenerator {

    private TournamentScheduleGenerator() {
    }

    public static final String GROUP_NONE = "NONE";
    public static final String GROUP_ROUND_ROBIN = "ROUND_ROBIN";
    public static final String GROUP_DIVISIONS = "DIVISIONS";

    public static final String CHAMPIONSHIP_NONE = "NONE";
    public static final String CHAMPIONSHIP_SINGLE_ELIM = "SINGLE_ELIM";

    public static final String CONSOLATION_NONE = "NONE";
    public static final String CONSOLATION_SINGLE_ROUND = "SINGLE_ROUND";
    public static final String CONSOLATION_BRACKET = "BRACKET";

    public static final String STAGE_POOL = "POOL";
    public static final String STAGE_ROUND_ROBIN = "ROUND_ROBIN";
    public static final String STAGE_BRACKET = "BRACKET";
    public static final String STAGE_PLACEMENT = "PLACEMENT";
    public static final String STAGE_CONSOLATION = "CONSOLATION";

    public record Config(
            int teamCount,
            String groupStage,
            int poolCount,
            int advancePerPool,
            String championshipStage,
            boolean placementGame,
            String consolationStage,
            int consolationTeamCount) {
    }

    /**
     * One fixture.
     *
     * @param homeSeed 1-based seed, or null when the participant is not yet known (every bracket,
     *                 placement and consolation game beyond the first round it feeds from)
     * @param pool     division label for group games, null otherwise
     * @param dayIndex 1 for group play, 2 for everything decided on the second day
     */
    public record PlannedGame(
            String stage,
            String round,
            Integer bracketPosition,
            Integer homeSeed,
            Integer awaySeed,
            String pool,
            int dayIndex) {

        public boolean isPlaceholder() {
            return homeSeed == null || awaySeed == null;
        }
    }

    public record Plan(List<PlannedGame> games, List<String> warnings, Map<String, List<Integer>> divisions) {
        public int size() {
            return games.size();
        }
    }

    public static Plan generate(Config cfg) {
        List<PlannedGame> games = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, List<Integer>> divisions = new LinkedHashMap<>();

        if (cfg.teamCount() < 2) {
            warnings.add("At least 2 teams are needed to generate a schedule.");
            return new Plan(games, warnings, divisions);
        }

        List<Integer> seeds = new ArrayList<>();
        for (int s = 1; s <= cfg.teamCount(); s++) seeds.add(s);

        // ---------------------------------------------------------------- group stage
        if (GROUP_ROUND_ROBIN.equals(cfg.groupStage())) {
            divisions.put("", seeds);
            for (int[] m : roundRobin(seeds)) {
                games.add(new PlannedGame(STAGE_ROUND_ROBIN, null, null, m[0], m[1], null, 1));
            }
        } else if (GROUP_DIVISIONS.equals(cfg.groupStage())) {
            divisions.putAll(snakeDivisions(seeds, cfg.poolCount()));
            for (Map.Entry<String, List<Integer>> d : divisions.entrySet()) {
                for (int[] m : roundRobin(d.getValue())) {
                    games.add(new PlannedGame(STAGE_POOL, null, null, m[0], m[1], d.getKey(), 1));
                }
            }
            long distinct = divisions.values().stream().map(List::size).distinct().count();
            if (distinct > 1) {
                warnings.add("Divisions are uneven ("
                        + divisions.values().stream().map(v -> String.valueOf(v.size())).toList()
                        + "), so teams play different numbers of group games.");
            }
        }

        // ---------------------------------------------------------------- championship
        int qualifiers = qualifierCount(cfg);

        if (CHAMPIONSHIP_SINGLE_ELIM.equals(cfg.championshipStage()) && qualifiers >= 2) {
            // With no group stage the bracket is seeded directly from tournament seeds, so the
            // first round can be filled in. With a group stage the qualifiers are not known until
            // it finishes, so every bracket game starts as a placeholder.
            boolean seedsKnown = GROUP_NONE.equals(cfg.groupStage());
            games.addAll(singleElim(qualifiers, seedsKnown, warnings));

            if (cfg.placementGame()) {
                if (qualifiers >= 4) {
                    // Contested by the SEMIFINAL LOSERS, so it is its own stage rather than part of
                    // the bracket: it resolves off the same advancement pass, taking the other branch.
                    games.add(new PlannedGame(STAGE_PLACEMENT, "PLACEMENT", 1, null, null, null, 2));
                } else {
                    warnings.add("A placement game needs at least 4 teams in the bracket to have semifinals.");
                }
            }
        }

        // ---------------------------------------------------------------- consolation
        int consolationTeams = cfg.consolationTeamCount();
        int nonQualifiers = Math.max(cfg.teamCount() - qualifiers, 0);

        if (!CONSOLATION_NONE.equals(cfg.consolationStage()) && consolationTeams >= 2) {
            if (consolationTeams > nonQualifiers) {
                warnings.add("Only " + nonQualifiers + " teams miss the bracket, but consolation is set for "
                        + consolationTeams + ".");
            }

            if (CONSOLATION_SINGLE_ROUND.equals(cfg.consolationStage())) {
                // Crossed pairing: best remaining against worst. For the 8-team shape that is
                // A3 v B4 and A4 v B3, so nobody replays a division opponent they just faced.
                int pairs = consolationTeams / 2;
                for (int p = 1; p <= pairs; p++) {
                    games.add(new PlannedGame(STAGE_CONSOLATION, "CONSOLATION", p, null, null, null, 2));
                }
                if (consolationTeams % 2 == 1) {
                    warnings.add(consolationTeams + " consolation teams is odd — one team would sit out.");
                }
            } else if (CONSOLATION_BRACKET.equals(cfg.consolationStage())) {
                for (int p = 1; p <= consolationTeams - 1; p++) {
                    games.add(new PlannedGame(STAGE_CONSOLATION, "CONSOLATION", p, null, null, null, 2));
                }
            }
        }

        if (games.isEmpty()) {
            warnings.add("This configuration produces no games.");
        }

        return new Plan(games, warnings, divisions);
    }

    /** How many teams reach the bracket. */
    public static int qualifierCount(Config cfg) {
        if (CHAMPIONSHIP_NONE.equals(cfg.championshipStage())) return 0;
        if (GROUP_NONE.equals(cfg.groupStage())) return cfg.teamCount();
        if (GROUP_DIVISIONS.equals(cfg.groupStage())) {
            return Math.min(cfg.poolCount() * cfg.advancePerPool(), cfg.teamCount());
        }
        // A single round robin feeding a bracket: advancePerPool is "how many advance".
        return Math.min(cfg.advancePerPool(), cfg.teamCount());
    }

    /**
     * Single-elimination rounds, first round through the final.
     *
     * @param seedsKnown whether the bracket entrants are known now (no group stage) or only once
     *                   the group stage finishes
     */
    private static List<PlannedGame> singleElim(int qualifiers, boolean seedsKnown, List<String> warnings) {
        List<PlannedGame> out = new ArrayList<>();

        int size = nextPowerOfTwo(qualifiers);
        int byes = size - qualifiers;
        int rounds = Integer.numberOfTrailingZeros(size);

        if (byes > 0) {
            warnings.add(qualifiers + " teams in the bracket is not a power of two — " + byes
                    + " top seed(s) get a first-round bye.");
        }

        List<Integer> order = seedOrder(size);

        // Round 1. A pair where the higher slot exceeds the qualifier count is a bye: no game, and
        // the surviving seed is carried straight into its round-2 slot below.
        Integer[] survivors = new Integer[size / 2];
        int position = 1;
        for (int i = 0; i < size; i += 2, position++) {
            int a = order.get(i);
            int b = order.get(i + 1);
            boolean aIn = a <= qualifiers;
            boolean bIn = b <= qualifiers;

            if (aIn && bIn) {
                out.add(new PlannedGame(STAGE_BRACKET, roundName(rounds, 1), position,
                        seedsKnown ? a : null, seedsKnown ? b : null, null, 2));
                survivors[position - 1] = null;
            } else {
                survivors[position - 1] = aIn ? a : (bIn ? b : null);
            }
        }

        // Later rounds. A slot pre-filled by a bye is only known when the seeds themselves are.
        int gamesInRound = size / 2;
        for (int r = 2; r <= rounds; r++) {
            gamesInRound /= 2;
            Integer[] next = new Integer[Math.max(gamesInRound, 1)];

            for (int p = 1; p <= gamesInRound; p++) {
                Integer home = survivors[2 * p - 2];
                Integer away = survivors[2 * p - 1];
                out.add(new PlannedGame(STAGE_BRACKET, roundName(rounds, r), p,
                        seedsKnown ? home : null, seedsKnown ? away : null, null, 2));
                next[p - 1] = null;
            }
            survivors = next;
        }

        return out;
    }

    /** Round names derive from distance to the final, so any bracket size names itself. */
    static String roundName(int totalRounds, int roundIndex) {
        int fromFinal = totalRounds - roundIndex;
        return switch (fromFinal) {
            case 0 -> "FINAL";
            case 1 -> "SEMIFINAL";
            case 2 -> "QUARTERFINAL";
            case 3 -> "ROUND_OF_16";
            case 4 -> "ROUND_OF_32";
            default -> "ROUND_" + (1 << (fromFinal + 1));
        };
    }

    /**
     * Standard bracket ordering: seedOrder(1) = [1], and seedOrder(2n) interleaves each s from
     * seedOrder(n) with 2n+1-s. Consecutive pairs are the first-round matchups, so
     * seedOrder(8) = [1,8,4,5,2,7,3,6] gives 1v8, 4v5, 2v7, 3v6.
     */
    static List<Integer> seedOrder(int size) {
        List<Integer> order = new ArrayList<>(List.of(1));
        int n = 1;
        while (n < size) {
            n *= 2;
            List<Integer> next = new ArrayList<>(n);
            for (int s : order) {
                next.add(s);
                next.add(n + 1 - s);
            }
            order = next;
        }
        return order;
    }

    static int nextPowerOfTwo(int n) {
        int p = 1;
        while (p < n) p *= 2;
        return p;
    }

    /**
     * Snake-assigns seeds across divisions so strength is spread evenly:
     * 1→A, 2→B, 3→B, 4→A, 5→A, 6→B, 7→B, 8→A.
     */
    static Map<String, List<Integer>> snakeDivisions(List<Integer> seeds, int poolCount) {
        Map<String, List<Integer>> pools = new LinkedHashMap<>();
        for (int i = 0; i < poolCount; i++) {
            pools.put(String.valueOf((char) ('A' + i)), new ArrayList<>());
        }
        List<String> labels = new ArrayList<>(pools.keySet());

        for (int i = 0; i < seeds.size(); i++) {
            int cycle = i / poolCount;
            int within = i % poolCount;
            int idx = (cycle % 2 == 0) ? within : poolCount - 1 - within;
            pools.get(labels.get(idx)).add(seeds.get(i));
        }
        return pools;
    }

    /**
     * Circle-method round robin: everyone plays everyone once. Lifted from
     * ScheduleGeneratorService, which had the same algorithm inline; odd counts get a ghost entry
     * so one team sits out each round rather than the method rejecting them outright.
     */
    static List<int[]> roundRobin(List<Integer> seeds) {
        List<int[]> out = new ArrayList<>();
        List<Integer> teams = new ArrayList<>(seeds);

        boolean odd = teams.size() % 2 == 1;
        if (odd) teams.add(null); // ghost: whoever draws it has the round off

        int n = teams.size();
        if (n < 2) return out;

        for (int round = 0; round < n - 1; round++) {
            for (int game = 0; game < n / 2; game++) {
                Integer home = teams.get(game);
                Integer away = teams.get(n - 1 - game);
                if (home == null || away == null) continue;

                // Alternate which side is home so no seed is always the home team.
                if ((round + game) % 2 == 0) out.add(new int[] { home, away });
                else out.add(new int[] { away, home });
            }
            teams.add(1, teams.remove(n - 1));
        }

        out.sort(Comparator.comparingInt(m -> m[0]));
        return out;
    }
}
