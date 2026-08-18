package com.obhl.game.service.scoring;

/**
 * A named set of tournament scoring rules.
 *
 * <p>Named rather than stored as columns on the tournament so that changing the formula means
 * adding a new profile, not editing rows. Tournaments already played keep pointing at the profile
 * they were played under, so recomputing their standings still produces the numbers that were on
 * the board at the time.
 *
 * @param key                     value stored in tournaments.scoring_profile
 * @param winPoints               awarded for winning the game
 * @param tiePoints               awarded to EACH team when the game is tied
 * @param lossPoints              awarded for losing (a loser can still earn the period bonuses)
 * @param periodWinPoints         per period in which this team scored STRICTLY more goals; a tied
 *                                period awards neither team
 * @param penaltyFreePeriodPoints per period in which this team took no penalties at all; both teams
 *                                can earn it in the same period
 * @param penaltyCountThreshold   total penalties in the game at which the deduction applies
 * @param penaltyThresholdDeduction points removed on hitting that threshold (a positive number)
 */
public record TournamentScoringProfile(
        String key,
        int winPoints,
        int tiePoints,
        int lossPoints,
        int periodWinPoints,
        int penaltyFreePeriodPoints,
        int penaltyCountThreshold,
        int penaltyThresholdDeduction) {

    /**
     * The Conley Classic, as confirmed by the league: 3 for a win, 1 each for a tie, 0 for a loss;
     * +1 for each period won outright; +1 for each period taken penalty-free. Over two periods the
     * ceiling is 7, which needs a win, both periods, and a clean sheet of penalties.
     *
     * <p>The league's 7-or-more-penalties deduction applies here too.
     */
    public static final TournamentScoringProfile CONLEY_V1 =
            new TournamentScoringProfile("conley-v1", 3, 1, 0, 1, 1, 7, 1);

    public static TournamentScoringProfile byKey(String key) {
        if (key == null || CONLEY_V1.key().equals(key)) {
            return CONLEY_V1;
        }
        throw new IllegalArgumentException("Unknown tournament scoring profile: " + key);
    }
}
