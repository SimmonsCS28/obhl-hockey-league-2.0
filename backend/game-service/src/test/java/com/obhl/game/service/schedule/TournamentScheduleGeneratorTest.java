package com.obhl.game.service.schedule;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.obhl.game.service.schedule.TournamentScheduleGenerator.Config;
import com.obhl.game.service.schedule.TournamentScheduleGenerator.Plan;
import com.obhl.game.service.schedule.TournamentScheduleGenerator.PlannedGame;

/**
 * Implements the tables in docs/tournament/02-format-spec.md.
 *
 * <p>Plain JUnit, no Spring, no database. A format bug does not surface until the weekend's ice is
 * already booked, which is why this is one of the two places in the project where a test earns its
 * keep.
 */
class TournamentScheduleGeneratorTest {

    private static Config cfg(int teams, String group, int pools, int advance,
                              String championship, boolean placement, String consolation, int consolationTeams) {
        return new Config(teams, group, pools, advance, championship, placement, consolation, consolationTeams);
    }

    private static Config roundRobinOnly(int teams) {
        return cfg(teams, "ROUND_ROBIN", 1, 2, "NONE", false, "NONE", 0);
    }

    private static Config singleElimOnly(int teams) {
        return cfg(teams, "NONE", 1, 2, "SINGLE_ELIM", false, "NONE", 0);
    }

    private static long count(Plan plan, String stage) {
        return plan.games().stream().filter(g -> stage.equals(g.stage())).count();
    }

    @Nested
    @DisplayName("Game counts from the spec table")
    class Counts {

        @Test
        @DisplayName("8 teams, round robin only -> 28 games")
        void roundRobin8() {
            Plan p = TournamentScheduleGenerator.generate(roundRobinOnly(8));
            assertEquals(28, p.size());
            assertEquals(28, count(p, "ROUND_ROBIN"));
        }

        @Test
        @DisplayName("8 teams, single elim only -> 7 games")
        void singleElim8() {
            Plan p = TournamentScheduleGenerator.generate(singleElimOnly(8));
            assertEquals(7, p.size());
        }

        @Test
        @DisplayName("16 teams, single elim only -> 15 games")
        void singleElim16() {
            assertEquals(15, TournamentScheduleGenerator.generate(singleElimOnly(16)).size());
        }

        @Test
        @DisplayName("5 teams with byes -> 4 games, only one in the first round")
        void singleElim5() {
            Plan p = TournamentScheduleGenerator.generate(singleElimOnly(5));
            assertEquals(4, p.size(), "a bracket of q teams always plays q-1 games, byes or not");

            long firstRound = p.games().stream().filter(g -> "QUARTERFINAL".equals(g.round())).count();
            assertEquals(1, firstRound, "3 of the 4 first-round pairs are byes");
            assertTrue(p.warnings().stream().anyMatch(w -> w.contains("bye")));
        }

        @Test
        @DisplayName("12 teams with byes -> 11 games")
        void singleElim12() {
            Plan p = TournamentScheduleGenerator.generate(singleElimOnly(12));
            assertEquals(11, p.size());
            // 16-slot bracket, 4 byes, so 4 real first-round games.
            assertEquals(4, p.games().stream().filter(g -> "ROUND_OF_16".equals(g.round())).count());
        }

        @Test
        @DisplayName("6 teams, 2 divisions, top 2 -> 9 games")
        void divisions6() {
            Plan p = TournamentScheduleGenerator.generate(
                    cfg(6, "DIVISIONS", 2, 2, "SINGLE_ELIM", false, "NONE", 0));
            assertEquals(9, p.size());
            assertEquals(6, count(p, "POOL"), "two divisions of three: 3 + 3");
            assertEquals(3, count(p, "BRACKET"), "4 qualifiers -> 2 semifinals + 1 final");
        }

        @Test
        @DisplayName("THE C LEAGUE CLASSIC: 8 teams, 2 divisions, top 2, placement, consolation 4 -> 18")
        void cLeagueClassic() {
            Plan p = TournamentScheduleGenerator.generate(
                    cfg(8, "DIVISIONS", 2, 2, "SINGLE_ELIM", true, "SINGLE_ROUND", 4));

            assertEquals(18, p.size());
            assertEquals(12, count(p, "POOL"), "two divisions of four: 6 + 6");
            assertEquals(3, count(p, "BRACKET"), "2 semifinals + 1 final");
            assertEquals(1, count(p, "PLACEMENT"), "the two semifinal losers");
            assertEquals(2, count(p, "CONSOLATION"), "4 non-qualifiers each play once");
        }
    }

    @Nested
    @DisplayName("Seeding")
    class Seeding {

        @Test
        @DisplayName("divisions are snake-assigned so strength is spread")
        void snake() {
            Map<String, List<Integer>> d =
                    TournamentScheduleGenerator.snakeDivisions(List.of(1, 2, 3, 4, 5, 6, 7, 8), 2);
            assertEquals(List.of(1, 4, 5, 8), d.get("A"));
            assertEquals(List.of(2, 3, 6, 7), d.get("B"));
        }

        @Test
        @DisplayName("standard bracket order pairs 1v8, 4v5, 2v7, 3v6")
        void bracketOrder() {
            assertEquals(List.of(1, 8, 4, 5, 2, 7, 3, 6), TournamentScheduleGenerator.seedOrder(8));
            assertEquals(List.of(1, 4, 2, 3), TournamentScheduleGenerator.seedOrder(4));
        }

        /**
         * With qualifiers ordered A1, B1, A2, B2, the standard pairing (1,4) and (2,3) IS
         * cross-division seeding — A1 v B2 and B1 v A2 — with no special case.
         */
        @Test
        @DisplayName("a 4-team bracket cross-seeds divisions for free")
        void crossSeeding() {
            List<Integer> order = TournamentScheduleGenerator.seedOrder(4);
            // order = [1,4,2,3] -> pairs (1,4) and (2,3)
            // qualifier slots: 1=A1, 2=B1, 3=A2, 4=B2
            assertEquals(1, order.get(0));
            assertEquals(4, order.get(1)); // A1 v B2
            assertEquals(2, order.get(2));
            assertEquals(3, order.get(3)); // B1 v A2
        }

        @Test
        @DisplayName("round names come from distance to the final")
        void roundNames() {
            assertEquals("FINAL", TournamentScheduleGenerator.roundName(3, 3));
            assertEquals("SEMIFINAL", TournamentScheduleGenerator.roundName(3, 2));
            assertEquals("QUARTERFINAL", TournamentScheduleGenerator.roundName(3, 1));
            assertEquals("ROUND_OF_16", TournamentScheduleGenerator.roundName(4, 1));
        }
    }

    @Nested
    @DisplayName("Round robin")
    class RoundRobin {

        @Test
        @DisplayName("everyone plays everyone exactly once")
        void everyPairOnce() {
            List<int[]> matchups = TournamentScheduleGenerator.roundRobin(List.of(1, 2, 3, 4, 5, 6));
            assertEquals(15, matchups.size());

            Set<String> pairs = new HashSet<>();
            for (int[] m : matchups) {
                int lo = Math.min(m[0], m[1]);
                int hi = Math.max(m[0], m[1]);
                assertTrue(pairs.add(lo + "-" + hi), "pair " + lo + "-" + hi + " appears twice");
            }
            assertEquals(15, pairs.size());
        }

        @Test
        @DisplayName("odd counts give one team a bye each round rather than being rejected")
        void oddCount() {
            List<int[]> matchups = TournamentScheduleGenerator.roundRobin(List.of(1, 2, 3, 4, 5));
            assertEquals(10, matchups.size(), "5 teams -> C(5,2) = 10");
            for (int[] m : matchups) {
                assertTrue(m[0] >= 1 && m[0] <= 5 && m[1] >= 1 && m[1] <= 5);
                assertFalse(m[0] == m[1], "a team cannot play itself");
            }
        }

        @Test
        @DisplayName("nobody is always the home team")
        void homeAwayAlternates() {
            List<int[]> matchups = TournamentScheduleGenerator.roundRobin(List.of(1, 2, 3, 4));
            long seed1Home = matchups.stream().filter(m -> m[0] == 1).count();
            assertTrue(seed1Home < 3, "seed 1 should not be home in all three of its games");
        }
    }

    @Nested
    @DisplayName("What is known at generation time")
    class Placeholders {

        @Test
        @DisplayName("group games are fully determined")
        void groupGamesHaveTeams() {
            Plan p = TournamentScheduleGenerator.generate(
                    cfg(8, "DIVISIONS", 2, 2, "SINGLE_ELIM", true, "SINGLE_ROUND", 4));

            p.games().stream().filter(g -> "POOL".equals(g.stage())).forEach(g -> {
                assertFalse(g.isPlaceholder(), "a group matchup follows from the seeds");
                assertEquals(1, g.dayIndex());
            });
        }

        @Test
        @DisplayName("bracket, placement and consolation start as placeholders on day two")
        void laterStagesArePlaceholders() {
            Plan p = TournamentScheduleGenerator.generate(
                    cfg(8, "DIVISIONS", 2, 2, "SINGLE_ELIM", true, "SINGLE_ROUND", 4));

            p.games().stream()
                    .filter(g -> !"POOL".equals(g.stage()))
                    .forEach(g -> {
                        assertTrue(g.isPlaceholder(), g.stage() + " cannot know its teams until the group stage ends");
                        assertEquals(2, g.dayIndex());
                    });
        }

        @Test
        @DisplayName("with no group stage the first round is seeded immediately")
        void noGroupStageSeedsBracket() {
            Plan p = TournamentScheduleGenerator.generate(singleElimOnly(8));
            List<PlannedGame> firstRound = p.games().stream()
                    .filter(g -> "QUARTERFINAL".equals(g.round())).toList();

            assertEquals(4, firstRound.size());
            assertEquals(1, firstRound.get(0).homeSeed());
            assertEquals(8, firstRound.get(0).awaySeed());
        }
    }

    @Nested
    @DisplayName("Guards")
    class Guards {

        @Test
        @DisplayName("a placement game without semifinals is refused, not silently added")
        void placementNeedsSemifinals() {
            Plan p = TournamentScheduleGenerator.generate(
                    cfg(2, "NONE", 1, 2, "SINGLE_ELIM", true, "NONE", 0));
            assertEquals(0, count(p, "PLACEMENT"));
            assertTrue(p.warnings().stream().anyMatch(w -> w.contains("semifinals")));
        }

        @Test
        @DisplayName("an odd consolation count is reported rather than hidden")
        void oddConsolation() {
            Plan p = TournamentScheduleGenerator.generate(
                    cfg(8, "DIVISIONS", 2, 2, "SINGLE_ELIM", false, "SINGLE_ROUND", 3));
            assertEquals(1, count(p, "CONSOLATION"), "3 teams -> 1 game, one sits out");
            assertTrue(p.warnings().stream().anyMatch(w -> w.contains("odd")));
        }

        @Test
        @DisplayName("consolation larger than the non-qualifier pool is flagged")
        void tooManyConsolationTeams() {
            Plan p = TournamentScheduleGenerator.generate(
                    cfg(8, "DIVISIONS", 2, 2, "SINGLE_ELIM", false, "SINGLE_ROUND", 8));
            assertTrue(p.warnings().stream().anyMatch(w -> w.contains("miss the bracket")));
        }

        @Test
        @DisplayName("fewer than two teams produces nothing and says so")
        void tooFewTeams() {
            Plan p = TournamentScheduleGenerator.generate(roundRobinOnly(1));
            assertEquals(0, p.size());
            assertFalse(p.warnings().isEmpty());
        }
    }
}
