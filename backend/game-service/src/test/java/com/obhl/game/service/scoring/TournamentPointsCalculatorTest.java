package com.obhl.game.service.scoring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.obhl.game.service.scoring.TournamentPointsCalculator.PeriodTally;
import com.obhl.game.service.scoring.TournamentPointsCalculator.Result;

/**
 * Implements the worked-example table in docs/tournament/01-scoring-spec.md, row for row.
 *
 * <p>Plain JUnit: no Spring context, no database. The formula is the thing most likely to be
 * silently wrong -- a bug here awards the wrong champion without anything looking broken -- and it
 * is pure arithmetic, so it is the one place in this project where a test is cheap and obviously
 * worth having.
 */
class TournamentPointsCalculatorTest {

    private static final TournamentScoringProfile CLASSIC = TournamentScoringProfile.CLASSIC_V1;

    /**
     * @param p1 "homeGoals-awayGoals" in period 1
     * @param homePen penalty counts per period for home, e.g. {1, 0}
     */
    private static Result score(String p1, String p2, int homeScore, int awayScore,
                                int[] homePen, int[] awayPen) {
        PeriodTally tally = new PeriodTally(
                new int[] { goals(p1, true), goals(p2, true) },
                new int[] { goals(p1, false), goals(p2, false) },
                homePen, awayPen);

        return TournamentPointsCalculator.calculate(
                CLASSIC, 2, homeScore, awayScore, tally,
                homePen[0] + homePen[1], awayPen[0] + awayPen[1]);
    }

    private static int goals(String period, boolean home) {
        String[] parts = period.split("-");
        return Integer.parseInt(home ? parts[0] : parts[1]);
    }

    private static int[] pen(int p1, int p2) {
        return new int[] { p1, p2 };
    }

    @Nested
    @DisplayName("Worked examples from the spec")
    class SpecTable {

        @Test
        @DisplayName("1: win, one period won, one tied, no penalties -> 6 / 2")
        void row1() {
            Result r = score("2-0", "1-1", 3, 1, pen(0, 0), pen(0, 0));
            assertEquals(6, r.homePoints());   // 3 win + 1 period + 2 clean
            assertEquals(2, r.awayPoints());   // 0 loss + 0 periods + 2 clean
        }

        @Test
        @DisplayName("2: split periods, home penalised once -> 5 / 3")
        void row2() {
            Result r = score("1-2", "3-0", 4, 2, pen(1, 0), pen(0, 0));
            assertEquals(5, r.homePoints());   // 3 + 1 (P2) + 1 (P2 clean)
            assertEquals(3, r.awayPoints());   // 0 + 1 (P1) + 2 clean
        }

        @Test
        @DisplayName("3: tie with both periods tied -> 3 / 2")
        void row3() {
            Result r = score("1-1", "2-2", 3, 3, pen(0, 0), pen(0, 1));
            assertEquals(3, r.homePoints());   // 1 tie + 0 + 2 clean
            assertEquals(2, r.awayPoints());   // 1 tie + 0 + 1 clean
        }

        @Test
        @DisplayName("4: perfect score -> 2 / 7")
        void row4() {
            Result r = score("0-1", "0-1", 0, 2, pen(0, 0), pen(0, 0));
            assertEquals(2, r.homePoints());
            assertEquals(7, r.awayPoints());   // 3 + 2 periods + 2 clean = the ceiling
        }

        @Test
        @DisplayName("5: scoreless draw -- empty periods still pay the clean-sheet point -> 3 / 3")
        void row5() {
            Result r = score("0-0", "0-0", 0, 0, pen(0, 0), pen(0, 0));
            assertEquals(3, r.homePoints());   // 1 tie + 0 periods + 2 clean
            assertEquals(3, r.awayPoints());
        }

        @Test
        @DisplayName("6: home penalised in both periods -> 2 / 4")
        void row6() {
            Result r = score("1-0", "0-1", 1, 1, pen(1, 1), pen(0, 0));
            assertEquals(2, r.homePoints());   // 1 tie + 1 (P1) + 0 clean
            assertEquals(4, r.awayPoints());   // 1 tie + 1 (P2) + 2 clean
        }

        @Test
        @DisplayName("7: sweeps both periods but penalised in both -> 5 / 2")
        void row7() {
            Result r = score("3-0", "2-0", 5, 0, pen(2, 1), pen(0, 0));
            assertEquals(5, r.homePoints());   // 3 + 2 periods + 0 clean
            assertEquals(2, r.awayPoints());   // 0 + 0 + 2 clean
        }

        @Test
        @DisplayName("8: floor case -- shut out, 7 penalties -> -1 / 7")
        void row8() {
            Result r = score("0-3", "0-2", 0, 5, pen(4, 3), pen(0, 0));
            assertEquals(-1, r.homePoints());  // 0 + 0 + 0 - 1, exactly the chk_points floor
            assertEquals(7, r.awayPoints());
        }

        @Test
        @DisplayName("9: each wins a period, each penalised once -> 3 / 3")
        void row9() {
            Result r = score("2-1", "1-2", 3, 3, pen(1, 0), pen(0, 1));
            assertEquals(3, r.homePoints());   // 1 tie + 1 (P1) + 1 (P2 clean)
            assertEquals(3, r.awayPoints());   // 1 tie + 1 (P2) + 1 (P1 clean)
        }

        @Test
        @DisplayName("10: six penalties is one short of the deduction -> 7 / 1")
        void row10() {
            Result r = score("1-0", "1-0", 2, 0, pen(0, 0), pen(6, 0));
            assertEquals(7, r.homePoints());
            assertEquals(1, r.awayPoints());   // 0 + 0 + 1 (P2 clean), no deduction at 6
        }

        @Test
        @DisplayName("11: the seventh penalty triggers the deduction -> 7 / 0")
        void row11() {
            Result r = score("1-0", "1-0", 2, 0, pen(0, 0), pen(7, 0));
            assertEquals(7, r.homePoints());
            assertEquals(0, r.awayPoints());   // 0 + 0 + 1 - 1
        }
    }

    @Nested
    @DisplayName("Rule properties")
    class Properties {

        @Test
        @DisplayName("a tied period awards neither team")
        void tiedPeriodAwardsNobody() {
            Result r = score("2-2", "0-0", 2, 2, pen(0, 0), pen(0, 0));
            // Both: 1 tie + 0 period wins + 2 clean.
            assertEquals(3, r.homePoints());
            assertEquals(3, r.awayPoints());
        }

        @Test
        @DisplayName("penalty-free is per team, so both can earn it in the same period")
        void penaltyFreeIsIndependent() {
            Result r = score("1-0", "0-0", 1, 0, pen(0, 0), pen(0, 0));
            assertEquals(6, r.homePoints());   // 3 + 1 + 2
            assertEquals(2, r.awayPoints());   // 0 + 0 + 2 -- away is clean too
        }

        @Test
        @DisplayName("a losing team can still out-earn the ceiling floor via bonuses")
        void loserCanEarnBonuses() {
            // Away loses but takes no penalties and wins nothing: still 2 points.
            Result r = score("1-0", "1-0", 2, 0, pen(0, 0), pen(0, 0));
            assertEquals(2, r.awayPoints());
        }

        @Test
        @DisplayName("overtime penalties count toward the threshold but win no period")
        void overtimePenaltiesCountTowardThresholdOnly() {
            // Regulation clean for away, but 7 penalties across the whole game (3 of them in OT).
            PeriodTally tally = new PeriodTally(
                    new int[] { 1, 1 }, new int[] { 0, 0 },
                    new int[] { 0, 0 }, new int[] { 2, 2 });

            Result r = TournamentPointsCalculator.calculate(
                    CLASSIC, 2, 2, 0, tally, 0, 7);

            assertEquals(7, r.homePoints());
            // Away: 0 loss + 0 periods + 0 clean (penalised in both regulation periods) - 1 = -1
            assertEquals(-1, r.awayPoints());
        }

        @Test
        @DisplayName("a three-period profile scores three periods")
        void honoursPeriodCount() {
            PeriodTally tally = new PeriodTally(
                    new int[] { 1, 1, 1 }, new int[] { 0, 0, 0 },
                    new int[] { 0, 0, 0 }, new int[] { 0, 0, 0 });

            Result r = TournamentPointsCalculator.calculate(CLASSIC, 3, 3, 0, tally, 0, 0);
            assertEquals(9, r.homePoints());   // 3 win + 3 periods + 3 clean
            assertEquals(3, r.awayPoints());   // 0 + 0 + 3 clean
        }

        @Test
        @DisplayName("rejects a tally shorter than the period count rather than scoring silently")
        void rejectsShortTally() {
            PeriodTally tooShort = PeriodTally.ofSize(1);
            assertThrows(IllegalArgumentException.class,
                    () -> TournamentPointsCalculator.calculate(CLASSIC, 2, 1, 0, tooShort, 0, 0));
        }

        @Test
        @DisplayName("rejects a nonsensical period count")
        void rejectsZeroPeriods() {
            assertThrows(IllegalArgumentException.class,
                    () -> TournamentPointsCalculator.calculate(
                            CLASSIC, 0, 1, 0, PeriodTally.ofSize(1), 0, 0));
        }
    }

    @Nested
    @DisplayName("Profile registry")
    class Profiles {

        @Test
        @DisplayName("classic-v1 is the default, and the legacy conley-v1 key still resolves")
        void resolvesByKey() {
            assertEquals(CLASSIC, TournamentScoringProfile.byKey("classic-v1"));
            assertEquals(CLASSIC, TournamentScoringProfile.byKey("conley-v1"));
            assertEquals(CLASSIC, TournamentScoringProfile.byKey(null));
        }

        @Test
        @DisplayName("an unknown profile fails loudly rather than falling back")
        void unknownProfileThrows() {
            assertThrows(IllegalArgumentException.class,
                    () -> TournamentScoringProfile.byKey("made-up-v9"));
        }
    }
}
