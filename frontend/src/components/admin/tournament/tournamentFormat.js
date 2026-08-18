/**
 * Tournament format arithmetic.
 *
 * Pure functions, no React. This is what the admin's live preview reads, and it answers the
 * question that actually decides the format: "how many games is this, and do we have the ice?"
 *
 * The backend generator (TournamentScheduleGenerator) must agree with these numbers exactly. When
 * it lands, this stays the single statement of the arithmetic and the preview stays honest.
 */

export const GROUP_NONE = 'NONE';
export const GROUP_ROUND_ROBIN = 'ROUND_ROBIN';
export const GROUP_DIVISIONS = 'DIVISIONS';

export const CHAMPIONSHIP_NONE = 'NONE';
export const CHAMPIONSHIP_SINGLE_ELIM = 'SINGLE_ELIM';

export const CONSOLATION_NONE = 'NONE';
export const CONSOLATION_SINGLE_ROUND = 'SINGLE_ROUND';
export const CONSOLATION_BRACKET = 'BRACKET';

/** Everyone plays everyone once. */
const roundRobinGames = (n) => (n < 2 ? 0 : (n * (n - 1)) / 2);

/**
 * Split n teams into p pools as evenly as possible, largest first.
 * 8 into 2 -> [4,4];  9 into 2 -> [5,4];  7 into 3 -> [3,2,2].
 */
export function poolSizes(teamCount, poolCount) {
    if (poolCount < 1) return [];
    const base = Math.floor(teamCount / poolCount);
    const remainder = teamCount % poolCount;
    return Array.from({ length: poolCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Next power of two at or above n. */
const nextPowerOfTwo = (n) => {
    let p = 1;
    while (p < n) p *= 2;
    return p;
};

/**
 * Summary of what a given configuration produces.
 *
 * @returns {{
 *   totalGames: number, groupGames: number, bracketGames: number,
 *   placementGames: number, consolationGames: number,
 *   qualifiers: number, byes: number, bracketRounds: number,
 *   pools: number[], minGamesPerTeam: number, maxGamesPerTeam: number,
 *   warnings: string[]
 * }}
 */
export function summarizeFormat(config = {}) {
    // Read every field with `??` rather than destructuring defaults. Those only fire on `undefined`,
    // and the API hands back `null` for any unset column -- `pool_count` has no database default at
    // all (048_create_tournaments.sql). A null poolCount reaching the arithmetic below took the
    // `poolCount < 1` branch in poolSizes and produced "zero divisions": no group games, no
    // qualifiers, no bracket, and a preview confidently reporting that an eight-team tournament was
    // two consolation games. The form already displays these fields as `draft.poolCount ?? 2`, so
    // coalescing here is what makes the preview agree with what the admin is actually looking at.
    const teamCount = config.teamCount ?? 0;
    const groupStage = config.groupStage ?? GROUP_ROUND_ROBIN;
    const poolCount = config.poolCount ?? 2;
    const advancePerPool = config.advancePerPool ?? 2;
    const championshipStage = config.championshipStage ?? CHAMPIONSHIP_SINGLE_ELIM;
    const placementGame = config.placementGame ?? false;
    const consolationStage = config.consolationStage ?? CONSOLATION_NONE;
    const consolationTeamCount = config.consolationTeamCount ?? 0;

    const warnings = [];

    // --- Group stage ---
    let pools = [];
    let groupGames = 0;
    let groupGamesPerTeam = 0;

    if (groupStage === GROUP_ROUND_ROBIN) {
        pools = [teamCount];
        groupGames = roundRobinGames(teamCount);
        groupGamesPerTeam = Math.max(teamCount - 1, 0);
    } else if (groupStage === GROUP_DIVISIONS) {
        pools = poolSizes(teamCount, poolCount);
        groupGames = pools.reduce((sum, size) => sum + roundRobinGames(size), 0);
        // Uneven pools mean uneven schedules; report the smaller so "every team plays at least".
        groupGamesPerTeam = pools.length ? Math.max(Math.min(...pools) - 1, 0) : 0;
        if (new Set(pools).size > 1) {
            warnings.push(
                `Divisions are uneven (${pools.join(' / ')}), so teams play different numbers of group games.`
            );
        }
    }

    // --- How many reach the bracket ---
    let qualifiers;
    if (championshipStage === CHAMPIONSHIP_NONE) {
        qualifiers = 0;
    } else if (groupStage === GROUP_NONE) {
        qualifiers = teamCount;
    } else if (groupStage === GROUP_DIVISIONS) {
        qualifiers = Math.min(poolCount * advancePerPool, teamCount);
    } else {
        // A single round robin feeding a bracket: treat advancePerPool as "how many advance".
        qualifiers = Math.min(advancePerPool, teamCount);
    }

    // --- Championship ---
    // A single-elimination bracket always plays qualifiers - 1 games, byes or not: every game
    // eliminates exactly one team and all but one must be eliminated.
    const bracketGames = qualifiers >= 2 ? qualifiers - 1 : 0;
    const bracketSize = qualifiers >= 2 ? nextPowerOfTwo(qualifiers) : 0;
    const byes = bracketSize ? bracketSize - qualifiers : 0;
    const bracketRounds = bracketSize ? Math.log2(bracketSize) : 0;

    // --- Placement (semifinal losers) ---
    // Needs semifinals to exist, i.e. a bracket of at least four.
    const placementGames = placementGame && qualifiers >= 4 ? 1 : 0;
    if (placementGame && qualifiers > 0 && qualifiers < 4) {
        warnings.push('A placement game needs at least 4 teams in the bracket to have semifinals.');
    }

    // --- Consolation ---
    let consolationGames = 0;
    if (consolationStage === CONSOLATION_SINGLE_ROUND) {
        consolationGames = Math.floor(consolationTeamCount / 2);
        if (consolationTeamCount % 2 === 1) {
            warnings.push(`${consolationTeamCount} consolation teams is odd — one team would sit out.`);
        }
    } else if (consolationStage === CONSOLATION_BRACKET) {
        consolationGames = consolationTeamCount >= 2 ? consolationTeamCount - 1 : 0;
    }

    const nonQualifiers = Math.max(teamCount - qualifiers, 0);
    if (consolationStage !== CONSOLATION_NONE && consolationTeamCount > nonQualifiers) {
        warnings.push(
            `Only ${nonQualifiers} teams miss the bracket, but consolation is set for ${consolationTeamCount}.`
        );
    }

    if (teamCount > 0 && groupStage === GROUP_NONE && championshipStage === CHAMPIONSHIP_SINGLE_ELIM
        && byes > 0) {
        warnings.push(`${teamCount} teams is not a power of two — ${byes} team(s) get a first-round bye.`);
    }

    // --- Games per team ---
    // Everyone plays their group games. After that, a qualifier plays at least one bracket game
    // (and a semifinal loser then plays the placement game); a non-qualifier plays its consolation
    // game if there is one.
    const consolationPerTeam = consolationStage === CONSOLATION_NONE ? 0 : 1;
    const minGamesPerTeam = groupGamesPerTeam
        + (nonQualifiers > 0 ? consolationPerTeam : (bracketGames > 0 ? 1 : 0));
    const maxGamesPerTeam = groupGamesPerTeam + (bracketRounds || 0);

    const totalGames = groupGames + bracketGames + placementGames + consolationGames;

    return {
        totalGames,
        groupGames,
        bracketGames,
        placementGames,
        consolationGames,
        qualifiers,
        byes,
        bracketRounds,
        pools,
        minGamesPerTeam,
        maxGamesPerTeam,
        warnings,
    };
}

/** Human-readable breakdown, e.g. "12 round robin · 3 bracket · 1 placement · 2 consolation". */
export function describeBreakdown(summary) {
    const parts = [];
    if (summary.groupGames) parts.push(`${summary.groupGames} group`);
    if (summary.bracketGames) parts.push(`${summary.bracketGames} bracket`);
    if (summary.placementGames) parts.push(`${summary.placementGames} placement`);
    if (summary.consolationGames) parts.push(`${summary.consolationGames} consolation`);
    return parts.join(' · ') || 'no games';
}
