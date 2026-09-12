// The league's canonical standings order, so every place that shows a team's
// rank agrees: the Standings page, the Teams grid, the team roster header, the
// admin standings table, the player dashboard, and the matchup preview.
//
// This lived as a copy-pasted sort block in five components, and the copies
// drifted — at one point the Standings page tiebroke on goals-against, the
// Teams grid on goal differential, and the roster header on regulation wins
// alone, so Orange was 2nd, 4th and 5th on three pages of the same season.
// Import this instead of rewriting the sort.
//
// The official rules (Scoring & Tiebreakers §9) break ties by head-to-head →
// division → regulation wins → total wins → fewest PIM → coin flip. The team
// record doesn't carry head-to-head or penalty minutes, so this applies the two
// win steps and then falls back to goal differential and goals for, the
// conventional hockey fallback and the one people expect to see (a +4 team
// above a +2 team).
//
// Order: points desc → regulation wins desc → total wins (regulation +
// overtime) desc → goal differential desc → goals for desc.

const num = (v) => v || 0;

export const compareStandings = (a, b) => {
    if (num(b.points) !== num(a.points)) return num(b.points) - num(a.points);

    // `wins` is regulation-only; overtime wins are tracked separately (TeamStatsUpdater).
    if (num(b.wins) !== num(a.wins)) return num(b.wins) - num(a.wins);

    const bWins = num(b.wins) + num(b.overtimeWins);
    const aWins = num(a.wins) + num(a.overtimeWins);
    if (bWins !== aWins) return bWins - aWins;

    const bDiff = num(b.goalsFor) - num(b.goalsAgainst);
    const aDiff = num(a.goalsFor) - num(a.goalsAgainst);
    if (bDiff !== aDiff) return bDiff - aDiff;

    return num(b.goalsFor) - num(a.goalsFor);
};

// Sorted copy — callers often hold the fetched array in state, so don't sort in place.
export const sortByStandings = (teams) => [...(teams || [])].sort(compareStandings);

// 1 -> "1st", 2 -> "2nd", 11 -> "11th" …
export const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
