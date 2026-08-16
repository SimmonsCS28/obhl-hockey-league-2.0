// The league's canonical standings order, so every place that shows a team's
// rank agrees: the Standings page, the admin standings table, the player
// dashboard, and the matchup preview.
//
// This lived as a copy-pasted sort block in five components, and one copy drifted
// — the matchup preview tiebroke on `wins` alone and skipped the goal
// tiebreakers, so two teams tied on points could be listed in the opposite order
// there than on the Standings page. Import this instead of rewriting the sort.
//
// Order: points desc → total wins (regulation + overtime) desc → goals against
// asc → goals for desc.

const num = (v) => v || 0;

export const compareStandings = (a, b) => {
    if (num(b.points) !== num(a.points)) return num(b.points) - num(a.points);

    // Overtime wins count toward a team's win total here and in the W column on
    // the Standings page; leaving them out is what caused the preview's drift.
    const bWins = num(b.wins) + num(b.overtimeWins);
    const aWins = num(a.wins) + num(a.overtimeWins);
    if (bWins !== aWins) return bWins - aWins;

    if (num(a.goalsAgainst) !== num(b.goalsAgainst)) return num(a.goalsAgainst) - num(b.goalsAgainst);
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
