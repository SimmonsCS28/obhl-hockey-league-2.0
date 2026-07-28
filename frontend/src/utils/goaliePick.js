// Goalie-pick logic: which team in a matchup gets to pick their goalie.
//
// League rule:
//   - Regular season: the team LOWER in the standings gets the pick for that matchup.
//   - Playoffs: reversed — the team HIGHER in the standings gets the pick. Playoff seeds are
//     derived from regular-season standings and re-seeded by those same standings each round,
//     so "higher seed" is always "higher in the standings" — one ranking covers both cases.

/**
 * Rank teams by the league's standings tiebreakers (same order as the Standings page):
 * points → (wins + OT wins) → fewest goals against → most goals for.
 * @returns {Map<number, number>} teamId → rank, 1 = top of the table.
 */
export function rankTeams(teams) {
    const sorted = [...(teams || [])].sort((a, b) => {
        if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
        const bWins = (b.wins || 0) + (b.overtimeWins || 0);
        const aWins = (a.wins || 0) + (a.overtimeWins || 0);
        if (bWins !== aWins) return bWins - aWins;
        if ((a.goalsAgainst || 0) !== (b.goalsAgainst || 0)) return (a.goalsAgainst || 0) - (b.goalsAgainst || 0);
        return (b.goalsFor || 0) - (a.goalsFor || 0);
    });
    const map = new Map();
    sorted.forEach((t, i) => map.set(t.id, i + 1));
    return map;
}

/**
 * Which team gets goalie pick for a game. Returns the team id, or null when it can't be
 * determined (missing team, TBD playoff fixture, or a team absent from the standings).
 * @param {object} game - needs homeTeamId, awayTeamId, gameType.
 * @param {Map<number, number>} rankByTeam - from {@link rankTeams}.
 */
export function goaliePickTeamId(game, rankByTeam) {
    if (!game || !rankByTeam) return null;
    const home = game.homeTeamId;
    const away = game.awayTeamId;
    if (home == null || away == null) return null;
    const rh = rankByTeam.get(home);
    const ra = rankByTeam.get(away);
    if (rh == null || ra == null || rh === ra) return null;
    const isPlayoff = String(game.gameType || 'REGULAR_SEASON').toUpperCase() === 'PLAYOFF';
    // A larger rank number means lower in the standings.
    if (isPlayoff) return rh < ra ? home : away;   // playoffs: higher standing picks
    return rh > ra ? home : away;                   // regular season: lower standing picks
}
