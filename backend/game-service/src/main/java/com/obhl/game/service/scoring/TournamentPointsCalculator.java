package com.obhl.game.service.scoring;

/**
 * Works out tournament points for one game.
 *
 * <p>Deliberately a pure function of its arguments -- no Spring, no repositories, no entities. The
 * formula is the one thing in the tournament most likely to be silently wrong (a bug here awards
 * the wrong champion, quietly), and this shape lets it be tested exhaustively without a database.
 * Callers do the gathering; this does the arithmetic.
 *
 * <p>See {@code docs/tournament/01-scoring-spec.md} for the worked examples this implements.
 */
public final class TournamentPointsCalculator {

    private TournamentPointsCalculator() {
    }

    /** Per-period tallies. Index 0 is period 1. Arrays must be at least {@code periodCount} long. */
    public record PeriodTally(
            int[] homeGoals,
            int[] awayGoals,
            int[] homePenalties,
            int[] awayPenalties) {

        public static PeriodTally ofSize(int periodCount) {
            return new PeriodTally(new int[periodCount], new int[periodCount],
                    new int[periodCount], new int[periodCount]);
        }
    }

    public record Result(int homePoints, int awayPoints) {
    }

    /**
     * @param periodCount        regulation periods. Every one of them is scored, including a period
     *                           in which nothing happened -- that period awards no period win but
     *                           does earn both teams the penalty-free point.
     * @param homeScore          final score, authoritative. Taken from the game rather than summed
     *                           from the tally so the result never disagrees with the scoreboard.
     * @param totalHomePenalties penalties across the WHOLE game including any overtime, for the
     *                           threshold deduction. The per-period penalty-free bonus only looks at
     *                           regulation periods, since only those are periods anyone can win.
     */
    public static Result calculate(
            TournamentScoringProfile profile,
            int periodCount,
            int homeScore,
            int awayScore,
            PeriodTally tally,
            int totalHomePenalties,
            int totalAwayPenalties) {

        if (periodCount < 1) {
            throw new IllegalArgumentException("periodCount must be at least 1, got " + periodCount);
        }
        requireLength(tally.homeGoals(), periodCount, "homeGoals");
        requireLength(tally.awayGoals(), periodCount, "awayGoals");
        requireLength(tally.homePenalties(), periodCount, "homePenalties");
        requireLength(tally.awayPenalties(), periodCount, "awayPenalties");

        int home;
        int away;

        // 1. Game result.
        if (homeScore > awayScore) {
            home = profile.winPoints();
            away = profile.lossPoints();
        } else if (awayScore > homeScore) {
            home = profile.lossPoints();
            away = profile.winPoints();
        } else {
            home = profile.tiePoints();
            away = profile.tiePoints();
        }

        for (int p = 0; p < periodCount; p++) {
            // 2. Period won -- strictly more goals. A tied period awards neither team.
            if (tally.homeGoals()[p] > tally.awayGoals()[p]) {
                home += profile.periodWinPoints();
            } else if (tally.awayGoals()[p] > tally.homeGoals()[p]) {
                away += profile.periodWinPoints();
            }

            // 3. Penalty-free period -- independent per team, so both can earn it in the same period.
            if (tally.homePenalties()[p] == 0) {
                home += profile.penaltyFreePeriodPoints();
            }
            if (tally.awayPenalties()[p] == 0) {
                away += profile.penaltyFreePeriodPoints();
            }
        }

        // 4. The league's heavy-penalty deduction.
        if (totalHomePenalties >= profile.penaltyCountThreshold()) {
            home -= profile.penaltyThresholdDeduction();
        }
        if (totalAwayPenalties >= profile.penaltyCountThreshold()) {
            away -= profile.penaltyThresholdDeduction();
        }

        return new Result(home, away);
    }

    private static void requireLength(int[] arr, int periodCount, String name) {
        if (arr == null || arr.length < periodCount) {
            throw new IllegalArgumentException(
                    name + " must have at least " + periodCount + " entries");
        }
    }
}
