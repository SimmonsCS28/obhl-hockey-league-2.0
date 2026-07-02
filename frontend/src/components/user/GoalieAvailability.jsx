import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import api from '../../services/api';
import './GoalieAvailability.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Backend sends game datetimes as UTC without a zone suffix, e.g. "2026-08-06T02:15:00".
// Convert to league-local (America/Chicago) and return the calendar Y/M/D.
function splitDate(str) {
    if (!str) return { y: NaN, m: NaN, d: NaN };
    const hasTime = str.includes('T');
    const dt = new Date(hasTime && !str.endsWith('Z') ? `${str}Z` : str);
    if (isNaN(dt)) return { y: NaN, m: NaN, d: NaN };
    const [mm, dd, yy] = dt.toLocaleDateString('en-US', {
        timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    }).split('/');
    return { y: +yy, m: +mm, d: +dd };
}

// Monday (local Date) of the Mon–Sun calendar week that contains the week's games.
// Weeks are labelled/ranged/grouped by this Monday to match the design + Open Slots page,
// even when the games themselves fall on a single day (e.g. Thursday).
function mondayOf(start) {
    const { y, m, d } = splitDate(start);
    const ref = new Date(y, m - 1, d);
    ref.setDate(ref.getDate() - ((ref.getDay() + 6) % 7));
    return ref;
}

function sundayOf(start) {
    const sunday = new Date(mondayOf(start));
    sunday.setDate(sunday.getDate() + 6);
    return sunday;
}

function getMonthName(dateStr) {
    return MONTHS[mondayOf(dateStr).getMonth()];
}

// Full calendar-week span, e.g. "Jun 30 – Jul 6".
function formatRange(start) {
    const monday = mondayOf(start);
    const sunday = sundayOf(start);
    const sm = MONTHS_SHORT[monday.getMonth()];
    return monday.getMonth() === sunday.getMonth()
        ? `${sm} ${monday.getDate()} – ${sunday.getDate()}`
        : `${sm} ${monday.getDate()} – ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getDate()}`;
}

function isCurrentWeek(start) {
    const monday = mondayOf(start);
    const sunday = sundayOf(start);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return today >= monday && today <= sunday;
}

function getWeekLabel(start) {
    const monday = mondayOf(start);
    const now = new Date();
    const thisMon = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    thisMon.setDate(thisMon.getDate() - ((thisMon.getDay() + 6) % 7));
    const nextMon = new Date(thisMon);
    nextMon.setDate(thisMon.getDate() + 7);
    if (monday.getTime() === thisMon.getTime()) return 'This Week';
    if (monday.getTime() === nextMon.getTime()) return 'Next Week';
    return `Week of ${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()}`;
}

const GoalieAvailability = () => {
    const navigate = useNavigate();
    const { selectedSeasonId } = useSeason();
    const seasonId = selectedSeasonId ?? 13;

    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [monthFilter, setMonthFilter] = useState('all');
    const [pending, setPending] = useState(new Set());

    useEffect(() => {
        api.getGoalieAvailability(seasonId)
            .then(setWeeks)
            .catch(() => setError('Failed to load availability.'))
            .finally(() => setLoading(false));
    }, [seasonId]);

    const toggleStatus = async (week, next) => {
        const snapshot = weeks;
        setWeeks(ws => ws.map(w => w.week === week ? { ...w, status: next } : w));
        setPending(p => new Set(p).add(week));
        try {
            const updated = await api.setGoalieAvailability(seasonId, week, next);
            setWeeks(updated);
        } catch {
            setWeeks(snapshot);
        } finally {
            setPending(p => { const n = new Set(p); n.delete(week); return n; });
        }
    };

    const markAllAvailable = async () => {
        const snapshot = weeks;
        setWeeks(ws => ws.map(w => ({ ...w, status: 'AVAILABLE' })));
        try {
            let result;
            for (const w of snapshot) {
                result = await api.setGoalieAvailability(seasonId, w.week, 'AVAILABLE');
            }
            if (result) setWeeks(result);
        } catch {
            setWeeks(snapshot);
        }
    };

    const clearAll = async () => {
        const snapshot = weeks;
        setWeeks(ws => ws.map(w => ({ ...w, status: null })));
        try {
            let result;
            for (const w of snapshot) {
                result = await api.setGoalieAvailability(seasonId, w.week, null);
            }
            if (result) setWeeks(result);
        } catch {
            setWeeks(snapshot);
        }
    };

    if (loading) return <div className="ga-state">Loading availability…</div>;
    if (error) return <div className="ga-state ga-state--err">{error}</div>;

    const countAvailable = weeks.filter(w => w.status === 'AVAILABLE').length;
    const countUnavailable = weeks.filter(w => w.status === 'UNAVAILABLE').length;
    const countUnset = weeks.filter(w => !w.status).length;

    // Month chips derived from actual data
    const seenMonths = [];
    weeks.forEach(w => {
        const m = getMonthName(w.startDate);
        if (!seenMonths.includes(m)) seenMonths.push(m);
    });
    const monthChips = [
        { key: 'all', label: 'All Weeks' },
        ...seenMonths.map(m => ({ key: m, label: m })),
    ];

    // Filter then group by month
    const filtered = monthFilter === 'all'
        ? weeks
        : weeks.filter(w => getMonthName(w.startDate) === monthFilter);
    const groups = [];
    const byMonth = {};
    filtered.forEach(w => {
        const m = getMonthName(w.startDate);
        if (!byMonth[m]) { byMonth[m] = []; groups.push({ name: m, weeks: byMonth[m] }); }
        byMonth[m].push(w);
    });

    return (
        <div className="ga-page">

            {/* ── Banner ── */}
            <section className="ga-banner">
                <div className="ga-banner-overlay" />
                <div className="ga-banner-inner obi-container">
                    <button className="ga-back-link" onClick={() => navigate('/user')}>
                        ← Back to Dashboard
                    </button>
                    <div className="ga-eyebrow-row">
                        <span className="ga-eyebrow-badge">Gated · Goalie</span>
                    </div>
                    <h1 className="ga-title">My Availability</h1>
                    <p className="ga-subtitle">
                        Mark each week of the season so the goalie coordinator can build balanced matchups.
                        You don&apos;t pick games — the coordinator schedules you from the available pool and you confirm.
                    </p>
                </div>
            </section>

            {/* ── Sticky bar ── */}
            <div className="ga-sticky-bar">
                {/* Month filter */}
                <div className="ga-filter-row obi-container">
                    <span className="ga-filter-label">Show</span>
                    <div className="ga-month-chips">
                        {monthChips.map(c => (
                            <button
                                key={c.key}
                                className={`ga-month-chip${monthFilter === c.key ? ' is-active' : ''}`}
                                onClick={() => setMonthFilter(c.key)}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Summary + bulk actions */}
                <div className="ga-summary-row obi-container">
                    <div className="ga-summary-stats">
                        <span className="ga-stat ga-stat--avail">
                            <span className="ga-dot ga-dot--avail" />
                            {countAvailable} Available
                        </span>
                        <span className="ga-stat ga-stat--unavail">
                            <span className="ga-dot ga-dot--unavail" />
                            {countUnavailable} Out
                        </span>
                        <span className="ga-stat ga-stat--unset">
                            <span className="ga-dot ga-dot--unset" />
                            {countUnset} Not Set
                        </span>
                    </div>
                    <div className="ga-bulk-actions">
                        <button className="ga-bulk-btn ga-bulk-btn--mark-all" onClick={markAllAvailable}>
                            Mark All Available
                        </button>
                        <button className="ga-bulk-btn ga-bulk-btn--clear" onClick={clearAll}>
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Week list ── */}
            <div className="obi-container ga-list">
                {groups.map(({ name, weeks: gWeeks }) => (
                    <div key={name} className="ga-month-group">
                        <h2 className="ga-month-heading">{name}</h2>
                        <div className="ga-week-rows">
                            {gWeeks.map(w => {
                                const isAvail = w.status === 'AVAILABLE';
                                const isUnavail = w.status === 'UNAVAILABLE';
                                const mod = isAvail ? 'avail' : isUnavail ? 'unavail' : 'unset';
                                const thisWeek = isCurrentWeek(w.startDate);
                                const isPending = pending.has(w.week);

                                return (
                                    <div
                                        key={w.week}
                                        className={`ga-row ga-row--${mod}${thisWeek ? ' ga-row--current' : ''}`}
                                    >
                                        <div className="ga-row-info">
                                            <div className="ga-row-top">
                                                <span className="ga-week-label">
                                                    {getWeekLabel(w.startDate)}
                                                </span>
                                                <span className={`ga-tag ga-tag--${mod}`}>
                                                    {isAvail ? 'Available' : isUnavail ? 'Out' : 'Not Set'}
                                                </span>
                                            </div>
                                            <div className="ga-row-meta">
                                                {formatRange(w.startDate)} · {w.gamesCount}{' '}
                                                {w.gamesCount === 1 ? 'game' : 'games'} scheduled
                                            </div>
                                        </div>
                                        <div className="ga-row-btns">
                                            <button
                                                className={`ga-toggle ga-toggle--avail${isAvail ? ' is-active' : ''}`}
                                                onClick={() => toggleStatus(w.week, isAvail ? null : 'AVAILABLE')}
                                                disabled={isPending}
                                            >
                                                Available
                                            </button>
                                            <button
                                                className={`ga-toggle ga-toggle--unavail${isUnavail ? ' is-active' : ''}`}
                                                onClick={() => toggleStatus(w.week, isUnavail ? null : 'UNAVAILABLE')}
                                                disabled={isPending}
                                            >
                                                Unavailable
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default GoalieAvailability;
