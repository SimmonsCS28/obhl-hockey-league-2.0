package com.obhl.game.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.obhl.game.model.Game;
import com.obhl.game.repository.GameRepository;

/**
 * The playoff bracket: how the first round is laid out, and how each later round is re-seeded.
 *
 * <p>Worth testing for the same reason the tournament format is: a bracket bug does not surface
 * until the semifinal matchups are already published and two teams have shown up expecting a
 * different opponent. Plain JUnit with a stubbed repository, no Spring and no database.
 *
 * <p>Team ids are 100 + seed throughout, so team 101 is the 1 seed and 108 the 8 seed.
 */
class PlayoffReseedingTest {

    private static final Long SEASON = 7L;

    private GameRepository repo;
    private GameService service;
    private List<Game> stored;
    private long nextId;

    /** Ordered team ids, best record first: what the admin UI posts to initializePlayoffBracket. */
    private static List<Long> seeds(int count) {
        List<Long> ids = new ArrayList<>();
        for (int seed = 1; seed <= count; seed++) {
            ids.add(100L + seed);
        }
        return ids;
    }

    private static int seedOf(Long teamId) {
        return (int) (teamId - 100L);
    }

    @BeforeEach
    void setUp() {
        stored = new ArrayList<>();
        nextId = 1L;
        repo = mock(GameRepository.class);
        when(repo.findBySeasonId(anyLong())).thenAnswer(inv -> new ArrayList<>(stored));
        when(repo.save(any(Game.class))).thenAnswer(inv -> {
            Game g = inv.getArgument(0);
            if (g.getId() == null) {
                g.setId(nextId++);
            }
            return g;
        });
        service = new GameService(repo, null, null, null, null);
    }

    /** A playoff-week slot: a time on the ice, before anyone decides what it hosts. */
    private Game slot(int week, int minuteOffset) {
        Game g = new Game();
        g.setId(nextId++);
        g.setSeasonId(SEASON);
        g.setGameType("PLAYOFF");
        g.setWeek(week);
        g.setGameDate(LocalDateTime.of(2026, 8, 21, 18, 0)
                .plusWeeks(week - 12L)
                .plusMinutes(minuteOffset));
        g.setStatus("scheduled");
        stored.add(g);
        return g;
    }

    /** Five slots a week for three weeks: the shape of a 10-team league's playoffs. */
    private void buildPlayoffWeeks() {
        for (int week = 12; week <= 14; week++) {
            for (int i = 0; i < 5; i++) {
                slot(week, i * 30);
            }
        }
    }

    private List<Game> round(String name) {
        return stored.stream()
                .filter(g -> name.equals(g.getPlayoffRound()))
                .sorted(Comparator.comparingInt(Game::getBracketPosition))
                .toList();
    }

    /** Play a game out with the given winner, then let the bracket react. */
    private void complete(Game g, Long winnerId) {
        boolean homeWon = winnerId.equals(g.getHomeTeamId());
        g.setHomeScore(homeWon ? 3 : 1);
        g.setAwayScore(homeWon ? 1 : 3);
        g.setStatus("completed");
        service.reseedNextRound(g);
    }

    private String matchup(Game g) {
        return g.getHomeSeed() + "v" + g.getAwaySeed();
    }

    private List<String> matchups(String roundName) {
        return round(roundName).stream().map(this::matchup).toList();
    }

    @Nested
    @DisplayName("first round")
    class FirstRound {

        @Test
        @DisplayName("uses standard bracket ordering, so seeds 1 and 2 cannot meet before the final")
        void standardOrdering() {
            buildPlayoffWeeks();
            service.initializePlayoffBracket(SEASON, seeds(10));

            // Plain seed order (1v8, 2v7, 3v6, 4v5) would put positions 1 and 2, and therefore
            // seeds 1 and 2, into the same semifinal.
            assertEquals(List.of("1v8", "4v5", "2v7", "3v6"), matchups("QUARTERFINAL"));
        }

        @Test
        @DisplayName("records each participant's seed and gives the better seed home ice")
        void recordsSeeds() {
            buildPlayoffWeeks();
            service.initializePlayoffBracket(SEASON, seeds(10));

            for (Game g : round("QUARTERFINAL")) {
                assertEquals(seedOf(g.getHomeTeamId()), g.getHomeSeed());
                assertEquals(seedOf(g.getAwayTeamId()), g.getAwaySeed());
                assertTrue(g.getHomeSeed() < g.getAwaySeed(),
                        "home seed " + g.getHomeSeed() + " should be better than " + g.getAwaySeed());
            }
        }

        @Test
        @DisplayName("leaves the non-qualifiers in a consolation game carrying no seeds")
        void consolationHasNoSeeds() {
            buildPlayoffWeeks();
            service.initializePlayoffBracket(SEASON, seeds(10));

            Game consolation = stored.stream()
                    .filter(g -> g.getWeek() == 12 && g.getPlayoffRound() == null)
                    .findFirst().orElseThrow();
            assertEquals(109L, consolation.getHomeTeamId());
            assertEquals(110L, consolation.getAwayTeamId());
            assertNull(consolation.getHomeSeed());
            assertNull(consolation.getAwaySeed());
        }
    }

    @Nested
    @DisplayName("re-seeding")
    class Reseeding {

        @BeforeEach
        void seedBracket() {
            buildPlayoffWeeks();
            service.initializePlayoffBracket(SEASON, seeds(10));
        }

        /** Every favourite holds except the 6 seed, who knocks out the 3: the 2026 season's shape. */
        private void playQuarterfinals() {
            for (Game g : round("QUARTERFINAL")) {
                Long winner = g.getAwaySeed() == 6 ? g.getAwayTeamId() : g.getHomeTeamId();
                complete(g, winner);
            }
        }

        @Test
        @DisplayName("pairs the surviving seeds best against worst, not by bracket position")
        void pairsBestAgainstWorst() {
            playQuarterfinals();

            // Survivors are seeds 1, 2, 4 and 6. The fixed tree would have given 1v4 and 2v6.
            assertEquals(List.of("1v6", "2v4"), matchups("SEMIFINAL"));
        }

        @Test
        @DisplayName("waits for the whole round before assigning anything")
        void waitsForTheWholeRound() {
            List<Game> quarterfinals = round("QUARTERFINAL");
            for (Game g : quarterfinals.subList(0, 3)) {
                complete(g, g.getHomeTeamId());
            }

            for (Game sf : round("SEMIFINAL")) {
                assertNull(sf.getHomeTeamId(), "semifinal filled before the last quarterfinal was played");
                assertNull(sf.getAwayTeamId());
            }

            Game last = quarterfinals.get(3);
            complete(last, last.getHomeTeamId());
            assertEquals(List.of("1v4", "2v3"), matchups("SEMIFINAL"));
        }

        @Test
        @DisplayName("will not move a matchup once that game has started")
        void doesNotDisturbAStartedGame() {
            playQuarterfinals();
            round("SEMIFINAL").get(0).setStatus("in_progress");

            // Rescoring a quarterfinal now: the 3 seed actually beat the 6.
            Game upset = round("QUARTERFINAL").stream()
                    .filter(g -> g.getAwaySeed() == 6)
                    .findFirst().orElseThrow();
            complete(upset, upset.getHomeTeamId());

            assertEquals(List.of("1v6", "2v4"), matchups("SEMIFINAL"));
        }

        @Test
        @DisplayName("gives the better seed home ice in the final, whichever slot fed it")
        void finalHomeIceFollowsSeed() {
            playQuarterfinals();
            List<Game> semifinals = round("SEMIFINAL");

            // Position 1 hosts 1v6 and the underdog wins it; position 2 hosts 2v4 and the 2 wins.
            complete(semifinals.get(0), semifinals.get(0).getAwayTeamId());
            complete(semifinals.get(1), semifinals.get(1).getHomeTeamId());

            // Fed by position 1, seed 6 would have taken the home slot under the old fixed tree.
            assertEquals("2v6", matchup(round("FINAL").get(0)));
        }

        @Test
        @DisplayName("falls back to the fixed tree when the bracket has no seeds recorded")
        void fallsBackWhenSeedsAreUnknown() {
            for (Game g : round("QUARTERFINAL")) {
                g.setHomeSeed(null);
                g.setAwaySeed(null);
            }
            for (Game g : round("QUARTERFINAL")) {
                complete(g, g.getHomeTeamId());
            }

            // Position P feeds ceil(P/2): quarterfinals 1 (1v8) and 2 (4v5) feed semifinal 1.
            List<Game> semifinals = round("SEMIFINAL");
            assertEquals(101L, semifinals.get(0).getHomeTeamId());
            assertEquals(104L, semifinals.get(0).getAwayTeamId());
            assertEquals(102L, semifinals.get(1).getHomeTeamId());
            assertEquals(103L, semifinals.get(1).getAwayTeamId());
        }
    }
}
