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

function getMonthName(dateStr) {
    return MONTHS[splitDate(dateStr).m - 1];
}

function formatRange(start, end) {
    const s = splitDate(start);
    const e = splitDate(end);
    const sm = MONTHS_SHORT[s.m - 1];
    const em = MONTHS_SHORT[e.m - 1];
    return s.m === e.m
        ? `${sm} ${s.d} – ${e.d}`
        : `${sm} ${s.d} – ${em} ${e.d}`;
}

// "Current" if today falls in the Mon–Sun calendar week that contains the week's games
// (the games themselves may only be on one day, e.g. Thursday).
function isCurrentWeek(start) {
    const { y, m, d } = splitDate(start);
    const monday = new Date(y, m - 1, d);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return today >= monday && today <= sunday;
}

function getWeekLabel(start) {
    if (isCurrentWeek(start)) return 'This Week';
    const s = splitDate(start);
    return `Week of ${MONTHS_SHORT[s.m - 1]} ${s.d}`;
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
                                                {formatRange(w.startDate, w.endDate)} · {w.gamesCount}{' '}
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
