/**
 * Helpers for showing a tournament game on the shared game pages.
 *
 * GamePreview and GameRecap are reused for tournament games rather than duplicated: a tournament
 * game is an ordinary games row, so the pages are already 90% correct. What differs is the small
 * amount of league-specific framing — "Week 3" means nothing at a two-day tournament, and the back
 * link has to return to the Classic rather than the league schedule.
 */

const STAGE_LABEL = {
    POOL: 'Division',
    ROUND_ROBIN: 'Round Robin',
    BRACKET: 'Bracket',
    PLACEMENT: 'Placement',
    CONSOLATION: 'Consolation',
};

const ROUND_LABEL = {
    FINAL: 'Final',
    SEMIFINAL: 'Semifinal',
    QUARTERFINAL: 'Quarterfinal',
    ROUND_OF_16: 'Round of 16',
    ROUND_OF_32: 'Round of 32',
    PLACEMENT: 'Placement game',
    CONSOLATION: 'Consolation',
};

export const isTournamentGame = (game) => game?.gameType === 'TOURNAMENT';

/**
 * What to show where a league game shows "Week N".
 *
 * Prefers the round because it is the more specific thing — "Final" tells you more than "Bracket" —
 * and falls back to the stage, then to the day.
 */
export function tournamentGameLabel(game) {
    if (!isTournamentGame(game)) return null;
    const round = game.playoffRound && ROUND_LABEL[game.playoffRound];
    if (round) return round;
    const stage = game.tournamentStage && STAGE_LABEL[game.tournamentStage];
    if (stage) return stage;
    return game.week ? `Day ${game.week}` : null;
}

/** Where "back" should go. Null for league games, so their existing behaviour is untouched. */
export function tournamentBackTarget(game, tournamentSlug) {
    if (!isTournamentGame(game) || !tournamentSlug) return null;
    return { to: `/tournaments/${tournamentSlug}/schedule`, label: 'Classic Schedule' };
}
