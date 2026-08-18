/**
 * The period model a game is scored under.
 *
 * LiveScoreEntry had this hardcoded in about a dozen places — `{1:'1',2:'2',3:'3',4:'OT'}`, a
 * `periodMaxMin` returning 20 or 5, and `['1','2','3','OT']` option lists. That is fine while every
 * game is three twenty-minute periods, and wrong the moment the Conley Classic plays two fifteens.
 *
 * Extracting it rather than forking the component is deliberate: LiveScoreEntry is 1,800 lines with
 * no tests and three separate rounds of bug-fix history behind it (FINALIZE_GAME_HANDBACK,
 * UNFINALIZE_GAME_HANDBACK, PENALTY_ALERT_AND_UNSAVED_HANDBACK). A second copy would double that
 * surface. It takes `rules` as a prop defaulting to leagueRules, so every existing call site
 * behaves exactly as before.
 *
 * Period integers match what game_events stores (CHECK period BETWEEN 1 AND 5): regulation periods
 * count up from 1, then overtime, then shootout.
 */

function makeRules({ regulationPeriods, regulationMinutes, otMinutes, allowsOT, suddenDeath }) {
    const labels = [];
    for (let i = 1; i <= regulationPeriods; i++) labels.push(String(i));
    if (allowsOT) labels.push('OT');

    const intToLabel = {};
    const labelToInt = {};
    for (let i = 1; i <= regulationPeriods; i++) {
        intToLabel[i] = String(i);
        labelToInt[String(i)] = i;
    }
    intToLabel[regulationPeriods + 1] = 'OT';
    labelToInt.OT = regulationPeriods + 1;
    intToLabel[regulationPeriods + 2] = 'SO';
    labelToInt.SO = regulationPeriods + 2;

    const isOvertime = (period) =>
        period === 'OT' || period === labelToInt.OT || period === 'SO' || period === labelToInt.SO;

    return {
        regulationPeriods,
        /** Ordered labels for pickers: ['1','2','3','OT'] or ['1','2'] when there is no overtime. */
        periods: labels,
        intToLabel: (p) => intToLabel[p] || '1',
        labelToInt: (l) => labelToInt[l] ?? 1,
        /** Sort key, so period lists order correctly regardless of label. */
        order: (label) => labelToInt[label] ?? 99,
        maxMinutes: (period) => (isOvertime(period) ? otMinutes : regulationMinutes),
        isOvertime,
        allowsOT,
        /** Overtime ends on the first goal — the scorer should say so rather than imply a clock. */
        suddenDeath,
    };
}

/** Three twenty-minute periods plus a five-minute overtime. Unchanged behaviour. */
export const leagueRules = makeRules({
    regulationPeriods: 3,
    regulationMinutes: 20,
    otMinutes: 5,
    allowsOT: true,
    suddenDeath: false,
});

/**
 * Conley Classic rules for one game.
 *
 * Group-stage games have no overtime and may end tied — that is what the points system is for.
 * Elimination games (bracket, placement, consolation) go to sudden death, because somebody has to
 * advance or be placed.
 *
 * @param game the game row; reads tournamentStage and periodCount
 * @param tournament optional, for periodMinutes. The fallback is 20: the Classic plays 2 x 20,
 *   confirmed against previous years' schedules. It matters because no caller currently passes
 *   the tournament, so this fallback is what the scorekeeper's clock is actually capped at --
 *   at 15 an event could not be entered after 15:00 of a period that runs to 20.
 */
export function tournamentRules(game, tournament) {
    const groupStages = ['POOL', 'ROUND_ROBIN'];
    const isGroupGame = groupStages.includes(game?.tournamentStage);

    return makeRules({
        regulationPeriods: game?.periodCount ?? tournament?.periodCount ?? 2,
        regulationMinutes: tournament?.periodMinutes ?? 20,
        otMinutes: tournament?.periodMinutes ?? 20,
        allowsOT: !isGroupGame,
        suddenDeath: !isGroupGame,
    });
}

/** Picks the right rules for a game without the caller needing to know the game type. */
export function rulesForGame(game, tournament) {
    return game?.gameType === 'TOURNAMENT' ? tournamentRules(game, tournament) : leagueRules;
}
