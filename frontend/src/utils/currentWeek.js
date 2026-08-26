// Which week a schedule view should open on. Shared by the public Schedule page
// and the Coordinator console so "current week" means the same thing in both.

const parseGameDate = (s) => new Date(s.endsWith('Z') ? s : s + 'Z');

// Earliest week whose games haven't all already happened (by date, not by
// whether someone's finalized the score), falling back to the last week once
// every game date in the list is in the past.
export const earliestUpcomingWeek = (gamesList) => {
    const weeks = [...new Set(gamesList.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const w of weeks) {
        const wkGames = gamesList.filter(g => g.week === w);
        const lastGameDay = wkGames.reduce((max, g) => {
            const d = parseGameDate(g.gameDate);
            d.setHours(0, 0, 0, 0);
            return d > max ? d : max;
        }, new Date(0));
        if (lastGameDay >= today) return w;
    }
    return weeks.length ? weeks[weeks.length - 1] : null;
};
