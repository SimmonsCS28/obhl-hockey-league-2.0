import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor } from '../../constants/teamColors';
import './Coordinator.css';

const SLOTS_PER_ROLE = { GOALIE: 2, REF: 2, SCOREKEEPER: 1 };

// Status → visual config
const STATUS_STYLE = {
    OPEN:      { label: 'Open',          color: 'var(--obi-icy)',     bg: 'rgba(157,185,205,0.1)',  border: 'rgba(157,185,205,0.28)' },
    SIGNED_UP: { label: 'Signed Up',     color: '#0b0c0f',            bg: 'var(--obi-accent)',       border: 'var(--obi-accent)' },
    PROPOSED:  { label: 'Awaiting',      color: 'var(--obi-icy)',     bg: 'rgba(157,185,205,0.12)', border: 'rgba(157,185,205,0.32)' },
    CONFIRMED: { label: 'Set · Confirmed',color:'var(--obi-success)', bg: 'rgba(127,181,154,0.14)', border: 'rgba(127,181,154,0.32)' },
};

function getName(u) {
    return u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username || `User ${u.id}`;
}

function initials(name) {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function toChicago(dateStr) {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return d;
}

function formatDay(d) {
    return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).toUpperCase();
}

function formatDateShort(d) {
    return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
}

function formatTime(d) {
    return d.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
}

function formatMonthName(d) {
    return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long' });
}

function formatWeekRange(dates) {
    if (!dates.length) return '';
    const sorted = [...dates].sort();
    const first = toChicago(sorted[0]);
    const last = toChicago(sorted[sorted.length - 1]);
    const firstStr = formatDateShort(first);
    const lastStr = formatDateShort(last);
    return firstStr === lastStr ? firstStr : `${firstStr} – ${lastStr}`;
}

function CoordinatorBoard({ role }) {
    const { selectedSeasonId } = useSeason();
    const seasonId = selectedSeasonId ?? 13;

    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [staff, setStaff] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [goaliePool, setGoaliePool] = useState([]);
    const [weekFilter, setWeekFilter] = useState('all');
    const [openPicker, setOpenPicker] = useState(null); // "gameId:slot"
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [publishResult, setPublishResult] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        setPublishResult(null);
        try {
            const [gamesData, teamsData, staffData, assignData] = await Promise.all([
                api.getGames(seasonId),
                api.getTeams(),
                api.getUsers({ role }),
                api.getCoordinatorAssignments(seasonId, role),
            ]);
            setGames(gamesData || []);
            setTeams(teamsData || []);
            setStaff([...(staffData || [])].sort((a, b) => getName(a).localeCompare(getName(b))));
            setAssignments(assignData || []);
        } catch {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [seasonId, role]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (role !== 'GOALIE' || weekFilter === 'all') { setGoaliePool([]); return; }
        api.getCoordinatorGoalieAvailability(seasonId, parseInt(weekFilter))
            .then(data => setGoaliePool(data || []))
            .catch(() => setGoaliePool([]));
    }, [role, seasonId, weekFilter]);

    const reloadAssignments = async () => {
        const data = await api.getCoordinatorAssignments(seasonId, role);
        setAssignments(data || []);
    };

    const teamById = (id) => teams.find(t => t.id === id);

    const assignmentFor = (gameId, slot) =>
        assignments.find(a => a.gameId === gameId && a.slot === slot);

    const handleAssign = async (gameId, slot, userId) => {
        setError('');
        setOpenPicker(null);
        try {
            await api.proposeShift({ gameId, seasonId, role, slot, userId });
            await reloadAssignments();
        } catch (e) {
            setError(e.message || 'Failed to assign');
        }
    };

    const handleConfirm = async (assignmentId) => {
        setError('');
        try {
            await api.confirmSignup(assignmentId, role);
            await reloadAssignments();
        } catch (e) {
            setError(e.message || 'Failed to confirm');
        }
    };

    const handleClear = async (assignmentId) => {
        setError('');
        try {
            await api.withdrawShift(assignmentId, role);
            await reloadAssignments();
        } catch (e) {
            setError(e.message || 'Failed to clear');
        }
    };

    const handlePublish = async (week) => {
        setPublishing(true);
        setPublishResult(null);
        setError('');
        try {
            const result = await api.publishShiftWeek(seasonId, role, week);
            setPublishResult({ week, ...result });
        } catch (e) {
            setError(e.message || 'Failed to publish');
        } finally {
            setPublishing(false);
        }
    };

    // ---- Derived data ----

    const weeks = [...new Set(games.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b);

    const weekDates = weeks.reduce((acc, w) => {
        acc[w] = games.filter(g => g.week === w).map(g => g.gameDate);
        return acc;
    }, {});

    const weekChips = [
        { key: 'all', label: 'All Weeks', range: 'Full Season' },
        ...weeks.map(w => ({ key: w, label: `Week ${w}`, range: formatWeekRange(weekDates[w] || []) })),
    ];

    const filteredGames = games.filter(g => weekFilter === 'all' || g.week === parseInt(weekFilter));

    const filteredAssignments = assignments.filter(a => {
        if (weekFilter === 'all') return true;
        const g = games.find(g => g.id === a.gameId);
        return g && g.week === parseInt(weekFilter);
    });

    const slotsPerGame = SLOTS_PER_ROLE[role] ?? 1;
    const totalSlots = filteredGames.length * slotsPerGame;
    const openCount = totalSlots - filteredAssignments.length;
    const signedUpCount = filteredAssignments.filter(a => a.status === 'SIGNED_UP').length;
    const proposedCount = filteredAssignments.filter(a => a.status === 'PROPOSED').length;
    const confirmedCount = filteredAssignments.filter(a => a.status === 'CONFIRMED').length;

    const summary = [
        { label: 'Open', value: Math.max(0, openCount), color: 'var(--obi-icy)', border: 'rgba(157,185,205,0.2)' },
        { label: 'Signups to Confirm', value: signedUpCount, color: 'var(--obi-accent)', border: 'rgba(246,169,28,0.35)' },
        { label: 'Awaiting Player', value: proposedCount, color: 'var(--obi-icy)', border: 'rgba(157,185,205,0.2)' },
        { label: 'Set', value: confirmedCount, color: 'var(--obi-success)', border: 'rgba(127,181,154,0.3)' },
    ];

    // Group games by month → week
    const monthGroups = (() => {
        const byWeek = {};
        const byMonth = {};
        const monthOrder = [];

        filteredGames.forEach(g => {
            const d = toChicago(g.gameDate);
            const month = formatMonthName(d);
            if (!byWeek[g.week]) byWeek[g.week] = { month, games: [] };
            byWeek[g.week].games.push(g);
        });

        Object.entries(byWeek).forEach(([week, { month, games: wGames }]) => {
            const wNum = parseInt(week);
            const wAssign = assignments.filter(a => wGames.some(g => g.id === a.gameId));
            const wSlots = wGames.length * slotsPerGame;
            const wOpen = Math.max(0, wSlots - wAssign.length);
            const entry = { week: wNum, label: `Week ${wNum}`, range: formatWeekRange(weekDates[wNum] || []), games: wGames, openCount: wOpen };
            if (!byMonth[month]) { byMonth[month] = []; monthOrder.push(month); }
            byMonth[month].push(entry);
        });

        return monthOrder.map(name => ({ name, weeks: byMonth[name] }));
    })();

    const roleLabel = role === 'GOALIE' ? 'Goalie' : role === 'REF' ? 'Referee' : 'Scorekeeper';
    const scopeLabel = weekFilter === 'all' ? 'Full Season' : `Week ${weekFilter}`;

    if (loading) return <div className="cc-loading">Loading…</div>;

    return (
        <>
            {/* Week chips */}
            <div className="cc-week-bar">
                <span className="cc-week-bar-label">Schedule</span>
                <div className="cc-week-chips">
                    {weekChips.map(c => (
                        <div
                            key={c.key}
                            role="button"
                            tabIndex={0}
                            className={`cc-week-chip${weekFilter === c.key ? ' is-active' : ''}`}
                            onClick={() => { setWeekFilter(c.key); setOpenPicker(null); setPublishResult(null); }}
                            onKeyDown={e => e.key === 'Enter' && (() => { setWeekFilter(c.key); setOpenPicker(null); setPublishResult(null); })()}
                        >
                            {c.label}
                            <span className="cc-week-chip-range">{c.range}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Summary */}
            <div className="cc-summary-grid">
                {summary.map(m => (
                    <div key={m.label} className="cc-summary-card" style={{ border: `1px solid ${m.border}` }}>
                        <div className="cc-summary-value" style={{ color: m.color }}>{m.value}</div>
                        <div className="cc-summary-label">{m.label}</div>
                    </div>
                ))}
            </div>

            {/* Publish result */}
            {publishResult && (
                <div className={`cc-publish-result ${publishResult.unconfirmedSlots?.length ? 'has-warnings' : 'is-ok'}`}>
                    <strong>Published {publishResult.publishedCount} confirmed assignment(s) for Week {publishResult.week}.</strong>
                    {publishResult.unconfirmedSlots?.length > 0 && (
                        <ul>{publishResult.unconfirmedSlots.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    )}
                </div>
            )}

            {/* Goalie pool */}
            {role === 'GOALIE' && weekFilter !== 'all' && goaliePool.length > 0 && (
                <div className="cc-goalie-pool">
                    <div className="cc-goalie-pool-hd">
                        <span className="cc-goalie-pool-title">Available Goalie Pool</span>
                        <span className="cc-goalie-pool-sub">Goalies mark availability — they don&apos;t sign up. Assign one to each team&apos;s slot to keep matchups balanced.</span>
                    </div>
                    <div className="cc-goalie-pool-list">
                        {goaliePool.map(g => {
                            const avail = g.status === 'AVAILABLE';
                            return (
                                <div
                                    key={g.userId}
                                    className="cc-goalie-chip"
                                    style={{ border: `1px solid ${avail ? 'rgba(127,181,154,0.32)' : 'rgba(157,185,205,0.16)'}` }}
                                >
                                    <div
                                        className="cc-goalie-chip-dot"
                                        style={{ background: avail ? 'var(--obi-success)' : 'rgba(157,185,205,0.18)', color: avail ? '#0b0c0f' : '#fff' }}
                                    >
                                        {initials(g.userName)}
                                    </div>
                                    <div>
                                        <div className="cc-goalie-chip-name">{g.userName}</div>
                                        <div className="cc-goalie-chip-status" style={{ color: avail ? 'var(--obi-success)' : 'var(--obi-text-muted)' }}>
                                            {avail ? 'Available this week' : 'Not available'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && <div className="cc-error">{error}</div>}

            {/* Section heading */}
            <div className="cc-section-hd">{roleLabel} Assignments · {scopeLabel}</div>

            {/* Game groups */}
            {filteredGames.length === 0 ? (
                <div className="cc-empty">No games found for this filter.</div>
            ) : (
                <div className="cc-months">
                    {monthGroups.map(mo => (
                        <div key={mo.name}>
                            <div className="cc-month-hd">
                                {mo.name}
                                <span className="cc-month-rule" />
                            </div>
                            <div className="cc-weeks">
                                {mo.weeks.map(wg => (
                                    <div key={wg.week}>
                                        <div className="cc-week-hd">
                                            <span className="cc-week-hd-label">{wg.label}</span>
                                            <span className="cc-week-hd-range">{wg.range}</span>
                                            <div className="cc-week-hd-actions">
                                                <span className="cc-week-scope-note">
                                                    {wg.openCount > 0 ? `${wg.openCount} open` : 'All assigned'}
                                                </span>
                                                <button
                                                    className="cc-publish-btn"
                                                    onClick={() => handlePublish(wg.week)}
                                                    disabled={publishing}
                                                >
                                                    {publishing ? 'Publishing…' : `Publish Week ${wg.week}`}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="cc-games">
                                            {wg.games.map(g => (
                                                <GameCard
                                                    key={g.id}
                                                    game={g}
                                                    role={role}
                                                    teamById={teamById}
                                                    assignmentFor={assignmentFor}
                                                    staff={staff}
                                                    goaliePool={goaliePool}
                                                    weekFilter={weekFilter}
                                                    openPicker={openPicker}
                                                    setOpenPicker={setOpenPicker}
                                                    onAssign={handleAssign}
                                                    onConfirm={handleConfirm}
                                                    onClear={handleClear}
                                                    slotsPerGame={slotsPerGame}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="cc-footer-note">
                Confirmed assignments appear on the public schedule, live score entry, and game management pages.
            </p>
        </>
    );
}

function GameCard({ game, role, teamById, assignmentFor, staff, goaliePool, weekFilter, openPicker, setOpenPicker, onAssign, onConfirm, onClear, slotsPerGame }) {
    const homeTeam = teamById(game.homeTeamId);
    const awayTeam = teamById(game.awayTeamId);
    const d = toChicago(game.gameDate);

    const slots = buildSlots(game, role, homeTeam, awayTeam);
    const totalSlots = slotsPerGame;
    const gameAssignments = slots.map(s => assignmentFor(game.id, s.slot)).filter(Boolean);
    const confirmedCount = gameAssignments.filter(a => a.status === 'CONFIRMED').length;
    const openCount = totalSlots - gameAssignments.length;
    const allSet = confirmedCount === totalSlots && openCount === 0;

    const fillLabel = allSet ? 'All Set' : openCount > 0 ? `${openCount} Open` : `${confirmedCount} / ${totalSlots} Set`;
    const fillColor = allSet ? 'var(--obi-success)' : openCount > 0 ? 'var(--obi-icy)' : 'var(--obi-accent)';
    const fillBg = allSet ? 'rgba(127,181,154,0.14)' : openCount > 0 ? 'rgba(157,185,205,0.1)' : 'rgba(246,169,28,0.12)';
    const fillBorder = allSet ? 'rgba(127,181,154,0.32)' : openCount > 0 ? 'rgba(157,185,205,0.25)' : 'rgba(246,169,28,0.32)';

    return (
        <div className="cc-game-card">
            <div className="cc-game-hd">
                <div className="cc-game-date-block">
                    <div className="cc-game-day">{formatDay(d)}</div>
                    <div className="cc-game-date">{formatDateShort(d)}</div>
                </div>
                <div className="cc-game-matchup">
                    <div className="cc-game-teams">
                        <span className="cc-team-dot" style={{ background: resolveTeamColor(homeTeam?.teamColor) }} />
                        <span className="cc-team-name">{homeTeam?.name || `Team ${game.homeTeamId}`}</span>
                        <span className="cc-vs">vs</span>
                        <span className="cc-team-name">{awayTeam?.name || `Team ${game.awayTeamId}`}</span>
                        <span className="cc-team-dot" style={{ background: resolveTeamColor(awayTeam?.teamColor) }} />
                    </div>
                    <div className="cc-game-meta">{formatTime(d)} · {game.rink || 'TBD'}</div>
                </div>
                <span className="cc-fill-badge" style={{ color: fillColor, background: fillBg, border: `1px solid ${fillBorder}` }}>
                    {fillLabel}
                </span>
            </div>

            {slots.map(s => {
                const assignment = assignmentFor(game.id, s.slot);
                const pickerKey = `${game.id}:${s.slot}`;
                return (
                    <SlotRow
                        key={s.slot}
                        slotDef={s}
                        assignment={assignment}
                        pickerOpen={openPicker === pickerKey}
                        onOpenPicker={() => setOpenPicker(pickerKey)}
                        onClosePicker={() => setOpenPicker(null)}
                        onAssign={(userId) => onAssign(game.id, s.slot, userId)}
                        onConfirm={() => onConfirm(assignment?.id)}
                        onClear={() => onClear(assignment?.id)}
                        staff={staff}
                        role={role}
                        goaliePool={goaliePool}
                        weekFilter={weekFilter}
                    />
                );
            })}
        </div>
    );
}

function SlotRow({ slotDef, assignment, pickerOpen, onOpenPicker, onClosePicker, onAssign, onConfirm, onClear, staff, role, goaliePool, weekFilter }) {
    const status = assignment?.status ?? 'OPEN';
    const style = STATUS_STYLE[status] ?? STATUS_STYLE.OPEN;
    const playerName = assignment?.userName ?? null;

    const statusLabel = (() => {
        if (status === 'PROPOSED' && playerName) return `Awaiting ${playerName.split(' ')[0]}`;
        return style.label;
    })();

    const actions = [];
    if (status === 'OPEN') {
        actions.push({ label: 'Assign', color: '#0b0c0f', bg: 'var(--obi-accent)', border: 'var(--obi-accent)', onClick: onOpenPicker });
    } else if (status === 'SIGNED_UP') {
        actions.push({ label: 'Confirm', color: '#0b0c0f', bg: 'var(--obi-accent)', border: 'var(--obi-accent)', onClick: onConfirm });
        actions.push({ label: 'Reassign', color: '#C8D0D8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(157,185,205,0.25)', onClick: onOpenPicker });
    } else if (status === 'PROPOSED') {
        actions.push({ label: 'Reassign', color: '#C8D0D8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(157,185,205,0.25)', onClick: onOpenPicker });
        actions.push({ label: 'Clear', color: 'var(--obi-error)', bg: 'rgba(224,138,138,0.1)', border: 'rgba(224,138,138,0.3)', onClick: onClear });
    } else if (status === 'CONFIRMED') {
        actions.push({ label: 'Reassign', color: '#C8D0D8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(157,185,205,0.25)', onClick: onOpenPicker });
    }

    const pickerTitle = (() => {
        const verb = status === 'OPEN' ? 'Assign' : 'Reassign';
        const who = role === 'GOALIE' ? `${slotDef.label} goalie` : role === 'REF' ? `Ref ${slotDef.slot}` : 'scorekeeper';
        return `${verb} ${who} — they'll get an email to confirm`;
    })();

    // Candidates: for goalie, disable unavailable goalies (not in available pool this week)
    const availableGoalieIds = new Set(
        role === 'GOALIE' && weekFilter !== 'all'
            ? goaliePool.filter(g => g.status === 'AVAILABLE').map(g => g.userId)
            : []
    );

    const candidates = staff.map(u => {
        const name = getName(u);
        const unavailable = role === 'GOALIE' && weekFilter !== 'all' && !availableGoalieIds.has(u.id);
        const poolEntry = role === 'GOALIE' && weekFilter !== 'all' ? goaliePool.find(g => g.userId === u.id) : null;
        const sub = role === 'GOALIE'
            ? (poolEntry ? (poolEntry.status === 'AVAILABLE' ? 'Available this week' : 'Not available') : 'Availability unknown')
            : `Eligible ${role.toLowerCase()}`;
        const subColor = role === 'GOALIE'
            ? (poolEntry?.status === 'AVAILABLE' ? 'var(--obi-success)' : 'var(--obi-text-muted)')
            : 'var(--obi-icy)';
        return { id: u.id, name, unavailable, sub, subColor };
    });

    return (
        <div className="cc-slot-row">
            <div className="cc-slot-inner">
                <div className="cc-slot-label-col">
                    {slotDef.showDot && (
                        <span className="cc-slot-dot" style={{ background: slotDef.teamColor }} />
                    )}
                    <span className="cc-slot-label">{slotDef.label}</span>
                </div>

                <div className="cc-slot-player-col">
                    {playerName ? (
                        <div className="cc-slot-player">
                            <span className="cc-player-avatar">{initials(playerName)}</span>
                            <span className="cc-player-name">{playerName}</span>
                        </div>
                    ) : (
                        <span className="cc-slot-empty">Unassigned</span>
                    )}
                </div>

                <span
                    className="cc-status-chip"
                    style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
                >
                    {statusLabel}
                </span>

                <div className="cc-slot-actions">
                    {actions.map(a => (
                        <button
                            key={a.label}
                            className="cc-action-btn"
                            style={{ color: a.color, background: a.bg, border: `1px solid ${a.border}` }}
                            onClick={a.onClick}
                        >
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>

            {pickerOpen && (
                <div className="cc-picker">
                    <div className="cc-picker-title">{pickerTitle}</div>
                    <div className="cc-picker-candidates">
                        {candidates.map(c => (
                            <button
                                key={c.id}
                                className="cc-candidate-btn"
                                disabled={c.unavailable}
                                onClick={() => !c.unavailable && onAssign(c.id)}
                            >
                                <span className="cc-candidate-avatar">{initials(c.name)}</span>
                                <span>
                                    <span className="cc-candidate-name">{c.name}</span>
                                    <span className="cc-candidate-sub" style={{ color: c.subColor }}>{c.sub}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                    <button className="cc-picker-cancel" onClick={onClosePicker}>Cancel</button>
                </div>
            )}
        </div>
    );
}

function buildSlots(game, role, homeTeam, awayTeam) {
    if (role === 'GOALIE') {
        return [
            { slot: 1, label: homeTeam?.name || 'Home', teamColor: resolveTeamColor(homeTeam?.teamColor), showDot: true },
            { slot: 2, label: awayTeam?.name || 'Away', teamColor: resolveTeamColor(awayTeam?.teamColor), showDot: true },
        ];
    }
    if (role === 'REF') {
        return [
            { slot: 1, label: 'Ref 1', showDot: false },
            { slot: 2, label: 'Ref 2', showDot: false },
        ];
    }
    return [{ slot: 1, label: 'Scorekeeper', showDot: false }];
}

export default CoordinatorBoard;
