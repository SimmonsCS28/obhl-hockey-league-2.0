// Shared "Season by the Numbers" / "Season at a Glance" stat computation.
// Used by both the Home page (active season) and the Seasons page (any selected
// season) so the two stay in sync. Returns exactly four { value, label, sub } cards:
// Teams · Skaters · Nights per Week · Progress.

// Game dates come back UTC-ish without a trailing Z on some rows; normalize before Date().
const parseGameDate = (s) => new Date(s.endsWith('Z') ? s : s + 'Z');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// --- Season overview formatting (shared by the Home glance + Seasons page cards) ---

// Parse YYYY-MM-DD by parts — never `new Date(string)`, which shifts the day by timezone.
function parseParts(s) {
    const [y, m, d] = (s || '').split('-').map(Number);
    return { y, m, d };
}

export function longDate(s) {
    if (!s) return 'N/A';
    const { y, m, d } = parseParts(s);
    if (!y || !m || !d) return 'N/A';
    return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// Human "X months, Y days" between two YYYY-MM-DD (calendar months + day borrow).
export function duration(a, b) {
    if (!a || !b) return 'N/A';
    const s = parseParts(a), e = parseParts(b);
    let months = (e.y - s.y) * 12 + (e.m - s.m);
    let days = e.d - s.d;
    if (days < 0) {
        months -= 1;
        const prevMonth = e.m - 1 <= 0 ? 12 : e.m - 1;
        const prevYear = e.m - 1 <= 0 ? e.y - 1 : e.y;
        const dim = new Date(prevYear, prevMonth, 0).getDate();
        days += dim;
    }
    const parts = [];
    if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    return parts.length ? parts.join(', ') : '0 days';
}

const STATUS = {
    active: { label: 'Active', eyebrow: 'In Progress', mod: 'active' },
    upcoming: { label: 'Upcoming', eyebrow: 'Not Started', mod: 'upcoming' },
    completed: { label: 'Completed', eyebrow: 'Archived', mod: 'completed' },
};
export const seasonStatusMeta = (status) => STATUS[status] || STATUS.completed;

export function computeSeasonStats(season, teams = [], players = [], games = []) {
    // --- Teams ---
    const teamNames = teams.map((t) => t.name).filter(Boolean);
    const teamsSub = teamNames.length === 0
        ? 'in the league'
        : teamNames.length <= 3
            ? teamNames.join(', ')
            : `${teamNames.slice(0, 3).join(', ')} & ${teamNames.length - 3} more`;

    // --- Skaters vs goaltenders (position F/D = skater, G = goalie) ---
    const goalies = players.filter((p) => p.position === 'G').length;
    const skaters = players.length - goalies;
    const skatersSub = `+ ${goalies} goaltender${goalies === 1 ? '' : 's'} rostered`;

    // --- Nights per week (distinct weekdays among regular-season games) ---
    const regular = games.filter((g) => g.gameType !== 'PLAYOFF' && g.gameDate);
    const weekdayIdxs = [...new Set(regular.map((g) => parseGameDate(g.gameDate).getDay()))].sort((a, b) => a - b);
    const nightCount = weekdayIdxs.length;
    const nightNames = weekdayIdxs.map((i) => WEEKDAYS[i]);
    const nightsSub = nightCount === 0
        ? 'Schedule TBD'
        : nightCount === 1
            ? `${nightNames[0]} nights`
            : `${nightNames.map((n) => n.slice(0, 3)).join(' & ')} nights`;

    // --- Progress ---
    const weeks = regular.map((g) => g.week).filter((w) => w != null);
    const totalWeeks = weeks.length ? Math.max(...weeks) : 0;
    const weeksLabel = totalWeeks ? `${totalWeeks} Weeks` : 'Schedule TBD';

    const playoffs = games
        .filter((g) => g.gameType === 'PLAYOFF' && g.gameDate)
        .sort((a, b) => parseGameDate(a.gameDate) - parseGameDate(b.gameDate));
    const playoffDate = playoffs.length
        ? parseGameDate(playoffs[0].gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    let progress;
    if (season?.status === 'active') {
        // "Current" week = the earliest week that still has an unplayed game (else the last week).
        const unplayedWeeks = regular
            .filter((g) => g.status !== 'completed')
            .map((g) => g.week)
            .filter((w) => w != null);
        const currentWeek = unplayedWeeks.length ? Math.min(...unplayedWeeks) : totalWeeks;
        progress = {
            value: totalWeeks ? `Wk ${currentWeek}` : '—',
            label: totalWeeks ? `Of ${totalWeeks}` : 'Schedule TBD',
            sub: playoffDate ? `Playoffs ${playoffDate}` : 'Regular season',
        };
    } else if (season?.status === 'completed') {
        progress = { value: 'Final', label: weeksLabel, sub: 'Season complete' };
    } else {
        progress = { value: '—', label: weeksLabel, sub: 'Not yet started' };
    }

    return [
        { value: teams.length, label: 'Teams', sub: teamsSub },
        { value: skaters, label: 'Skaters', sub: skatersSub },
        { value: nightCount, label: nightCount === 1 ? 'Night / Week' : 'Nights / Week', sub: nightsSub },
        progress,
    ];
}
