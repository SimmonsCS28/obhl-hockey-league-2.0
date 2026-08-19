import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSeason } from '../../contexts/SeasonContext';
import { arenaDayKey, formatArenaDay, useCurrentTournament } from '../tournament/tournamentData';
import api from '../../services/api';
import './OpenSlots.css';

const SEASON_FALLBACK = 13;
const TZ = 'America/Chicago';

function toChicagoParts(iso) {
    const dt = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    const f = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        year: 'numeric',
    });
    const map = {};
    f.formatToParts(dt).forEach(p => { map[p.type] = p.value; });
    return map;
}

function formatSlotDate(iso) {
    const p = toChicagoParts(iso);
    return {
        day: p.weekday.toUpperCase().slice(0, 3),
        date: `${p.month} ${p.day}`,
        time: `${p.hour}:${p.minute} ${p.dayPeriod}`,
        monthFull: new Date(iso.endsWith('Z') ? iso : iso + 'Z')
            .toLocaleDateString('en-US', { timeZone: TZ, month: 'long' }),
        monthYear: `${p.month} ${p.year}`,
    };
}

function getWeekBounds(iso) {
    const dt = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    const localStr = dt.toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const [m, d, y] = localStr.split('/');
    const ref = new Date(+y, +m - 1, +d);
    const dow = ref.getDay();
    const monday = new Date(ref);
    monday.setDate(ref.getDate() - ((dow + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
}

function formatRange(monday, sunday) {
    const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const a = `${MO[monday.getMonth()]} ${monday.getDate()}`;
    const b = monday.getMonth() === sunday.getMonth()
        ? sunday.getDate().toString()
        : `${MO[sunday.getMonth()]} ${sunday.getDate()}`;
    return `${a} – ${b}`;
}

function weekLabel(monday) {
    const now = new Date();
    const nowStr = now.toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const [nm, nd, ny] = nowStr.split('/');
    const today = new Date(+ny, +nm - 1, +nd);
    const todayDow = today.getDay();
    const thisMon = new Date(today);
    thisMon.setDate(today.getDate() - ((todayDow + 6) % 7));
    const nextMon = new Date(thisMon);
    nextMon.setDate(thisMon.getDate() + 7);
    if (monday.getTime() === thisMon.getTime()) return 'This Week';
    if (monday.getTime() === nextMon.getTime()) return 'Next Week';
    const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `Week of ${MO[monday.getMonth()]} ${monday.getDate()}`;
}

function buildWeekGroups(slots) {
    const byWeek = {};
    slots.forEach(s => {
        if (!byWeek[s.week]) byWeek[s.week] = [];
        byWeek[s.week].push(s);
    });

    return Object.entries(byWeek)
        .sort(([a], [b]) => +a - +b)
        .map(([weekNum, weekSlots]) => {
            const firstDate = weekSlots[0].gameDate;
            const { monday, sunday } = getWeekBounds(firstDate);
            const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = MO[monday.getMonth()];
            const monthFull = monday.toLocaleDateString('en-US', { month: 'long' });
            return {
                week: +weekNum,
                label: weekLabel(monday),
                range: formatRange(monday, sunday),
                month: monthFull,
                monthShort: monthName,
                slots: weekSlots,
            };
        });
}

function groupByMonth(weekGroups) {
    const order = [];
    const byMonth = {};
    weekGroups.forEach(wg => {
        if (!byMonth[wg.month]) { byMonth[wg.month] = []; order.push(wg.month); }
        byMonth[wg.month].push(wg);
    });
    return order.map(name => ({ name, weeks: byMonth[name] }));
}

/**
 * Tournament equivalent of buildWeekGroups: one group per day of the event.
 *
 * A tournament cannot be grouped by week. `week` doubles as the day index on tournament games, so
 * the league grouping would produce a "Week 1" and a "Week 2" whose Monday-to-Sunday bounds are the
 * same calendar week -- two headers reading "This Week · Sep 21 - 27" over different days. Grouping
 * by the day the games are actually played is both correct and what an official reads off a
 * weekend schedule.
 *
 * Returns the same shape buildWeekGroups does, including `month`, so groupByMonth and the whole
 * render path work on either without knowing which they were given.
 */
function buildDayGroups(slots) {
    const byDay = {};
    slots.forEach(s => {
        const key = arenaDayKey(s.gameDate);
        if (!byDay[key]) byDay[key] = [];
        byDay[key].push(s);
    });

    // Keys are YYYY-MM-DD in rink time, so a plain string sort is chronological.
    return Object.keys(byDay).sort().map(key => {
        const [y, m] = key.split('-').map(Number);
        return {
            week: key,
            label: formatArenaDay(key, { month: undefined, day: undefined }),  // "Saturday"
            range: formatArenaDay(key, { weekday: undefined }),                // "Sep 26"
            month: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            slots: byDay[key],
        };
    });
}

const ROLE_DISPLAY = { REF: 'Referee', SCOREKEEPER: 'Scorekeeper' };

const OpenSlots = ({ mode = 'league' }) => {
    const { user } = useAuth();
    const { selectedSeasonId } = useSeason();
    const { tournament, loading: loadingTournament } = useCurrentTournament();
    const isTournament = mode === 'tournament';

    // One page, two events. Tournament games are ordinary season-scoped rows and the open-slots
    // endpoint only ever filtered by season, so nothing about the data layer changes -- only which
    // season is asked for. The league's comes from context; the tournament's has to come from the
    // tournament itself, because a tournament season can never be the active one (the database
    // forbids it) and so can never be what the season context selected.
    const seasonId = isTournament ? tournament?.seasonId : (selectedSeasonId ?? SEASON_FALLBACK);

    const isRef = !!(user?.roles?.includes('REF') || user?.role === 'REF');
    const isScorekeeper = !!(user?.roles?.includes('SCOREKEEPER') || user?.role === 'SCOREKEEPER');
    const hasBoth = isRef && isScorekeeper;

    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [groupFilter, setGroupFilter] = useState('all');
    const [actionPending, setActionPending] = useState(new Set());

    const fetchSlots = useCallback(async () => {
        // In tournament mode the season is not known until the tournament resolves. Hold the
        // loading state rather than flashing "no open slots" for a frame.
        if (!seasonId) {
            setSlots([]);
            setLoading(loadingTournament);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const fetches = [];
            if (isRef) fetches.push(api.getOpenSlots('REF', seasonId));
            if (isScorekeeper) fetches.push(api.getOpenSlots('SCOREKEEPER', seasonId));
            const results = await Promise.all(fetches);
            const merged = results.flat();
            merged.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
            setSlots(merged);
        } catch {
            setError('Could not load open slots. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [seasonId, isRef, isScorekeeper, loadingTournament]);

    useEffect(() => { fetchSlots(); }, [fetchSlots]);

    const setSlotPending = (slotId, isPending) => {
        setActionPending(prev => {
            const next = new Set(prev);
            if (isPending) next.add(slotId); else next.delete(slotId);
            return next;
        });
    };

    const handleSignup = async (slotId) => {
        setSlotPending(slotId, true);
        try {
            await api.signupForSlot(slotId);
            await fetchSlots();
        } catch {
            // silently fail — user can retry
        } finally {
            setSlotPending(slotId, false);
        }
    };

    const handleDrop = async (slotId) => {
        setSlotPending(slotId, true);
        try {
            await api.dropSlotSignup(slotId);
            await fetchSlots();
        } catch {
            // silently fail — user can retry
        } finally {
            setSlotPending(slotId, false);
        }
    };

    // Weeks for the league, days for the tournament -- see buildDayGroups.
    const buildGroups = isTournament ? buildDayGroups : buildWeekGroups;
    const groupKeyOf = isTournament ? (s) => arenaDayKey(s.gameDate) : (s) => s.week;
    const groupNoun = isTournament ? 'day' : 'week';

    // Apply filters
    const filteredSlots = slots.filter(s => {
        const roleOk = roleFilter === 'ALL' || s.role === roleFilter;
        const groupOk = groupFilter === 'all' || groupKeyOf(s) === groupFilter;
        return roleOk && groupOk;
    });

    const allGroups = buildGroups(filteredSlots);
    const monthGroups = groupByMonth(allGroups);

    // Unfiltered by group, only by role, so the chip counts do not change as you filter
    const allGroupsForChips = buildGroups(
        slots.filter(s => roleFilter === 'ALL' || s.role === roleFilter)
    );

    const openCount = filteredSlots.filter(s => s.state === 'OPEN').length;
    const visibleWeekCount = allGroups.length;

    const roleChips = [
        hasBoth && { key: 'ALL', label: 'All Roles', count: slots.filter(s => s.state === 'OPEN').length },
        isRef && { key: 'REF', label: 'Referee', count: slots.filter(s => s.role === 'REF' && s.state === 'OPEN').length },
        isScorekeeper && { key: 'SCOREKEEPER', label: 'Scorekeeper', count: slots.filter(s => s.role === 'SCOREKEEPER' && s.state === 'OPEN').length },
    ].filter(Boolean);

    const groupChips = [
        {
            key: 'all',
            label: isTournament ? 'All Days' : 'All Weeks',
            range: isTournament ? 'Whole event' : 'Full season',
        },
        ...allGroupsForChips.map(g => ({ key: g.week, label: g.label, range: g.range })),
    ];

    return (
        <div className="os-page">
            {/* Banner */}
            <section className="os-banner">
                <div className="os-banner-overlay" />
                <div className="obi-container os-banner-inner">
                    <Link to="/user" className="os-back-link">← Back to Dashboard</Link>
                    <h1 className="obi-page-title">{isTournament ? tournament?.name ?? 'Tournament' : 'Open Slots'}</h1>
                    <p className="os-banner-sub">
                        {isTournament ? (
                            <>
                                Every unfilled referee and scorekeeper slot for the tournament. Sign up and the
                                coordinator confirms you. Goalies are assigned rather than claimed.
                            </>
                        ) : (
                            <>
                                Every unfilled referee and scorekeeper slot this season. Sign up and the coordinator confirms you.{' '}
                                Goalies — <Link to="/user/goalie-availability" className="os-banner-link">mark your availability</Link> instead.
                            </>
                        )}
                    </p>

                    {/* Only rendered while a tournament is published, so the page is unchanged the
                        rest of the year rather than carrying a dead tab. */}
                    {tournament && (
                        <div className="os-event-switch" role="tablist" aria-label="Which event">
                            <Link
                                to="/user/open-slots"
                                role="tab"
                                aria-selected={!isTournament}
                                className={`os-event-tab${!isTournament ? ' os-event-tab--active' : ''}`}
                            >
                                Regular Season
                            </Link>
                            <Link
                                to="/user/open-slots/tournament"
                                role="tab"
                                aria-selected={isTournament}
                                className={`os-event-tab${isTournament ? ' os-event-tab--active' : ''}`}
                            >
                                {tournament.name}
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Sticky filter bar */}
            <div className="os-filter-bar">
                <div className="obi-container os-filter-inner">
                    {hasBoth && (
                        <div className="os-filter-row">
                            <span className="os-filter-label">Role</span>
                            <div className="os-chips">
                                {roleChips.map(chip => (
                                    <div
                                        key={chip.key}
                                        role="button"
                                        tabIndex={0}
                                        className={`os-chip${roleFilter === chip.key ? ' os-chip--active' : ''}`}
                                        onClick={() => setRoleFilter(chip.key)}
                                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setRoleFilter(chip.key)}
                                    >
                                        {chip.label}
                                        <span className="os-chip-count">{chip.count}</span>
                                    </div>
                                ))}
                            </div>
                            <span className="os-filter-summary">
                                {openCount} open · {visibleWeekCount} {groupNoun}{visibleWeekCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    )}
                    <div className="os-filter-row">
                        {!hasBoth && (
                            <span className="os-filter-summary os-filter-summary--solo">
                                {openCount} open · {visibleWeekCount} {groupNoun}{visibleWeekCount !== 1 ? 's' : ''}
                            </span>
                        )}
                        <span className="os-filter-label">{isTournament ? 'Day' : 'Week'}</span>
                        <div className="os-chips os-chips--weeks">
                            {groupChips.map(chip => (
                                <div
                                    key={chip.key}
                                    role="button"
                                    tabIndex={0}
                                    className={`os-chip os-chip--week${groupFilter === chip.key ? ' os-chip--active' : ''}`}
                                    onClick={() => setGroupFilter(chip.key)}
                                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setGroupFilter(chip.key)}
                                >
                                    {chip.label}
                                    <span className="os-chip-range">{chip.range}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="obi-container os-content">
                {loading && (
                    <div className="os-state">
                        <div className="os-spinner" />
                        <p className="os-state-text">Loading open slots…</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="os-state os-state--error">
                        <p className="os-state-text">{error}</p>
                        <div
                            role="button"
                            tabIndex={0}
                            className="os-retry-btn"
                            onClick={fetchSlots}
                            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fetchSlots()}
                        >
                            Try again
                        </div>
                    </div>
                )}

                {!loading && !error && monthGroups.length === 0 && (
                    <div className="os-state">
                        <p className="os-state-text">
                            {isTournament && slots.length === 0
                                ? 'The tournament schedule has not been posted yet. Check back once games are announced.'
                                : 'No open slots match your current filter.'}
                        </p>
                    </div>
                )}

                {!loading && !error && monthGroups.map(mo => (
                    <div key={mo.name} className="os-month-group">
                        <div className="os-month-header">
                            <span>{mo.name}</span>
                            <span className="os-month-divider" />
                        </div>

                        <div className="os-weeks">
                            {mo.weeks.map(wg => {
                                const weekOpen = wg.slots.filter(s => s.state === 'OPEN').length;
                                return (
                                    <div key={wg.week} className="os-week-group">
                                        <div className="os-week-header">
                                            <span className="os-week-label">{wg.label}</span>
                                            <span className="os-week-range">{wg.range}</span>
                                            <span className="os-week-open">{weekOpen} open</span>
                                        </div>

                                        <div className="os-slots">
                                            {wg.slots.map(s => {
                                                const { day, date, time } = formatSlotDate(s.gameDate);
                                                const pending = actionPending.has(s.slotId);
                                                const isOpen = s.state === 'OPEN';
                                                const isMine = s.state === 'MINE';
                                                const isTaken = s.state === 'TAKEN';
                                                const isRefSlot = s.role === 'REF';

                                                return (
                                                    <div
                                                        key={s.slotId}
                                                        className={`os-slot-card${isMine ? ' os-slot-card--mine' : ''}${isTaken ? ' os-slot-card--taken' : ''}`}
                                                    >
                                                        <div className="os-slot-date">
                                                            <span className="os-slot-day">{day}</span>
                                                            <span className="os-slot-datenum">{date}</span>
                                                        </div>

                                                        <span className={`os-role-badge${isRefSlot ? ' os-role-badge--ref' : ' os-role-badge--sk'}`}>
                                                            {ROLE_DISPLAY[s.role] ?? s.role}
                                                        </span>

                                                        <div className="os-slot-info">
                                                            <div className="os-slot-game">
                                                                {s.homeTeam} vs {s.awayTeam}
                                                            </div>
                                                            <div className="os-slot-meta">
                                                                {time} · {s.rink}
                                                            </div>
                                                        </div>

                                                        <div className="os-slot-action">
                                                            {isMine && s.rowStatus === 'CONFIRMED' && (
                                                                <span className="os-confirmed-badge">✓ Confirmed</span>
                                                            )}
                                                            {isMine && s.rowStatus === 'PROPOSED' && (
                                                                <span className="os-awaiting-badge">Awaiting Your Confirmation</span>
                                                            )}
                                                            {isMine && s.rowStatus !== 'CONFIRMED' && s.rowStatus !== 'PROPOSED' && (
                                                                <>
                                                                    <span className="os-awaiting-badge">Awaiting Coordinator</span>
                                                                    <div
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        className="os-undo-btn"
                                                                        onClick={() => !pending && handleDrop(s.slotId)}
                                                                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && !pending && handleDrop(s.slotId)}
                                                                        aria-disabled={pending}
                                                                    >
                                                                        {pending ? '…' : 'Undo'}
                                                                    </div>
                                                                </>
                                                            )}
                                                            {isOpen && (
                                                                <div
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    className={`os-signup-btn${pending ? ' os-signup-btn--pending' : ''}`}
                                                                    onClick={() => !pending && handleSignup(s.slotId)}
                                                                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && !pending && handleSignup(s.slotId)}
                                                                    aria-disabled={pending}
                                                                >
                                                                    {pending ? '…' : 'Sign Up'}
                                                                </div>
                                                            )}
                                                            {isTaken && s.takenByName && (
                                                                <span className="os-taken-label">
                                                                    Filled · {s.takenByName}
                                                                </span>
                                                            )}
                                                            {isTaken && !s.takenByName && (
                                                                <span className="os-taken-label">Filled</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </main>
        </div>
    );
};

export default OpenSlots;
