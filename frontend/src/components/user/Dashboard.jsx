import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor, textOn } from '../../constants/teamColors';
import api from '../../services/api';
import GMTeam from '../gm/GMTeam';
import './Dashboard.css';

const TZ = 'America/Chicago';
const OFFICIAL_ROLES = ['GOALIE', 'REF', 'SCOREKEEPER'];
const ROLE_LABEL = { GOALIE: 'Goalie', REF: 'Referee', SCOREKEEPER: 'Scorekeeper' };

const toDate = (s) => {
    if (!s) return null;
    const normalized = /[Z+]/.test(s) ? s : s + 'Z';
    const d = new Date(normalized);
    return isNaN(d) ? null : d;
};
const fmtTime = (s) => { const d = toDate(s); return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }) : ''; };
const fmtDay = (s) => { const d = toDate(s); return d ? d.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ }).toUpperCase() : ''; };
const fmtDate = (s) => { const d = toDate(s); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ }) : ''; };
const fmtWhen = (s) => { const d = toDate(s); return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ }) + ' · ' + fmtTime(s) : 'TBD'; };

const initialsOf = (name) => (name || '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'OB';

function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { selectedSeasonId } = useSeason();

    const roles = useMemo(() => user?.roles || (user?.role ? [user.role] : []), [user]);
    const officialRoles = useMemo(() => roles.filter(r => OFFICIAL_ROLES.includes(r)), [roles]);
    const isOfficial = officialRoles.length > 0;
    const isGM = roles.includes('GM');

    const [dash, setDash] = useState(null);
    const [teams, setTeams] = useState([]);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    // Officiating
    const [activeRole, setActiveRole] = useState(officialRoles[0] || null);
    const [openSlotsByRole, setOpenSlotsByRole] = useState({}); // { REF: [...], SCOREKEEPER: [...] }
    const [goalieWeeks, setGoalieWeeks] = useState([]);          // for GOALIE
    const [busy, setBusy] = useState(null);

    const teamById = useCallback((id) => teams.find(t => t.id === id), [teams]);
    const teamName = (id) => teamById(id)?.name || 'TBD';

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [d, t] = await Promise.all([
                api.getPlayerDashboard().catch(() => null),
                api.getTeams().catch(() => []),
            ]);
            setDash(d);
            setTeams(t || []);
        } finally {
            setLoading(false);
        }
        api.getPendingShifts().then(setPending).catch(() => setPending([]));
    }, []);

    useEffect(() => { load(); }, [load]);

    // Officiating data — load open slots for every ref/scorekeeper role (for the per-tab
    // "N open" counts) and goalie availability if applicable.
    const loadOfficiating = useCallback(async () => {
        if (!selectedSeasonId) return;
        const slotRoles = officialRoles.filter(r => r === 'REF' || r === 'SCOREKEEPER');
        const entries = await Promise.all(
            slotRoles.map(async r => [r, await api.getOpenSlots(r, selectedSeasonId).catch(() => [])])
        );
        setOpenSlotsByRole(Object.fromEntries(entries));
        if (officialRoles.includes('GOALIE')) {
            api.getGoalieAvailability(selectedSeasonId).then(setGoalieWeeks).catch(() => setGoalieWeeks([]));
        }
    }, [selectedSeasonId, officialRoles]);
    useEffect(() => { loadOfficiating(); }, [loadOfficiating]);

    if (loading) return <div className="dash-state">Loading your dashboard…</div>;

    const team = dash?.team;
    const teamColor = resolveTeamColor(team?.teamColor);
    const fullName = dash?.firstName ? `${dash.firstName} ${dash.lastName || ''}`.trim() : (user?.username || 'Player');
    const initials = initialsOf(fullName);

    // ── My Week: next / last / schedule ──
    const schedule = dash?.schedule || [];
    const now = new Date();
    const upcoming = schedule.filter(g => { const d = toDate(g.gameDate); return d && d >= now; });
    const past = schedule.filter(g => { const d = toDate(g.gameDate); return d && d < now; });
    const nextGame = dash?.nextGame || upcoming[0] || null;
    const lastGame = past[past.length - 1] || null;
    const mySchedule = upcoming.slice(0, 4);

    const lastResult = (() => {
        if (!lastGame || !team) return null;
        const isHome = lastGame.homeTeamId === team.id;
        const my = isHome ? lastGame.homeScore : lastGame.awayScore;
        const opp = isHome ? lastGame.awayScore : lastGame.homeScore;
        if (my == null || opp == null) return null;
        return my > opp ? 'Won' : my < opp ? 'Lost' : 'Tie';
    })();

    // ── Officiating derived ──
    // Open slots for games that already happened just sit there unfilled forever,
    // so the preview should start at the current week rather than week 1.
    const isUpcoming = (s) => { const d = toDate(s.gameDate); return !d || d >= now; };
    const activeSlots = openSlotsByRole[activeRole] || [];
    const myCommitments = activeRole === 'GOALIE'
        ? pending.filter(p => p.role === 'GOALIE')
        : [
            ...pending.filter(p => p.role === activeRole),
            ...activeSlots.filter(s => s.state === 'MINE'),
        ];
    const availableOpen = activeSlots.filter(s => s.state === 'OPEN' && isUpcoming(s)).slice(0, 3);
    const openCount = (r) => (openSlotsByRole[r] || []).filter(s => s.state === 'OPEN' && isUpcoming(s)).length;
    const tabCountLabel = (r) => (r === 'GOALIE' ? 'Set availability' : `${openCount(r)} open`);

    const respondPending = async (id, action) => {
        setBusy(id);
        try { await api.respondToShift(id, action, null); await load(); await loadOfficiating(); }
        catch { /* ignore */ } finally { setBusy(null); }
    };
    const signup = async (slotId) => {
        setBusy(slotId);
        try { await api.signupForSlot(slotId); await loadOfficiating(); }
        catch { /* ignore */ } finally { setBusy(null); }
    };
    const setAvail = async (week, status) => {
        setBusy(week);
        try { const updated = await api.setGoalieAvailability(selectedSeasonId, week, status); setGoalieWeeks(updated); }
        catch { /* ignore */ } finally { setBusy(null); }
    };

    const commitmentStatus = (item) => {
        const st = item.status || item.rowStatus;
        if (st === 'PROPOSED' || st === 'assigned-pending') return { label: 'Needs Confirmation', cls: 'pending' };
        if (st === 'SIGNED_UP') return { label: 'Awaiting Coordinator', cls: 'signed' };
        if (st === 'CONFIRMED') return { label: 'Confirmed · Set', cls: 'confirmed' };
        if (st === 'DECLINED') return { label: 'Declined', cls: 'declined' };
        return { label: st || '—', cls: 'signed' };
    };

    return (
        <div className="dash">
            {/* Welcome banner */}
            <section className="dash-banner">
                <span className="dash-avatar" style={{ background: teamColor, color: textOn(teamColor) }}>{initials}</span>
                <div className="dash-banner-id">
                    <div className="dash-eyebrow">Welcome back</div>
                    <h1 className="dash-name">{fullName}</h1>
                    {team && (
                        <div className="dash-meta">
                            <Link to={`/teams/${team.id}`} className="dash-team-link">{team.name}</Link>
                            {dash?.jersey ? ` · #${dash.jersey}` : ''}{dash?.position ? ` · ${dash.position}` : ''}
                        </div>
                    )}
                </div>
            </section>

            {/* Sub-nav */}
            <div className="dash-subnav">
                <div className="obi-container dash-subnav-inner">
                    <a href="#my-week" className="dash-subnav-link">My Week</a>
                    {isOfficial && <a href="#signups" className="dash-subnav-link">Signups</a>}
                    {isGM && <a href="#team" className="dash-subnav-link">Team Management</a>}
                </div>
            </div>

            {/* ── MY WEEK ── */}
            <section id="my-week" className="dash-zone obi-container">
                {pending.length > 0 && (
                    <div className="dash-action-card">
                        <div className="dash-action-head">
                            <span className="dash-action-bang">!</span>
                            <span className="dash-action-title">Action Needed</span>
                            <span className="dash-action-sub">A coordinator assigned you — confirm or decline</span>
                        </div>
                        <div className="dash-action-list">
                            {pending.map(p => (
                                <div key={p.id} className="dash-action-row">
                                    <span className="dash-role-pill">{ROLE_LABEL[p.role] || p.role}</span>
                                    <div className="dash-action-info">
                                        <div className="dash-action-game">{p.homeTeam} vs {p.awayTeam}</div>
                                        <div className="dash-action-meta">{fmtWhen(p.gameDate)}{p.rink ? ` · ${p.rink}` : ''}</div>
                                    </div>
                                    <div className="dash-action-btns">
                                        <button className="dash-btn dash-btn--gold" disabled={busy === p.id} onClick={() => respondPending(p.id, 'confirm')}>Confirm</button>
                                        <button className="dash-btn dash-btn--ghost" disabled={busy === p.id} onClick={() => respondPending(p.id, 'decline')}>Decline</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="dash-grid-2">
                    {/* Next Game */}
                    <div className="dash-card">
                        <div className="dash-card-title">Your Next Game</div>
                        {nextGame ? (
                            <>
                                <div className="dash-matchup">
                                    <TeamChip id={nextGame.homeTeamId} teamById={teamById} />
                                    <span className="dash-vs">vs</span>
                                    <TeamChip id={nextGame.awayTeamId} teamById={teamById} />
                                </div>
                                <div className="dash-when">{fmtWhen(nextGame.gameDate)}{nextGame.rink ? ` · ${nextGame.rink}` : ''}</div>
                                <button className="dash-preview-btn" onClick={() => navigate(`/game/${nextGame.id}/preview`, { state: { from: '/dashboard', backLabel: 'Dashboard' } })}>View Preview</button>
                            </>
                        ) : <div className="dash-empty">No upcoming games scheduled.</div>}
                    </div>

                    {/* Last Game */}
                    <div className="dash-card">
                        <div className="dash-card-title">Last Game</div>
                        {lastGame ? (
                            <>
                                <div className="dash-score">
                                    <span className="dash-score-team">{teamName(lastGame.homeTeamId)}</span>
                                    <span className="dash-score-num">{lastGame.homeScore ?? '—'}</span>
                                    <span className="dash-score-dash">–</span>
                                    <span className="dash-score-num">{lastGame.awayScore ?? '—'}</span>
                                    <span className="dash-score-team">{teamName(lastGame.awayTeamId)}</span>
                                </div>
                                {lastResult && <div className={`dash-result dash-result--${lastResult.toLowerCase()}`}>{lastResult}</div>}
                                <button className="dash-preview-btn" onClick={() => navigate(`/game/${lastGame.id}/recap`, { state: { from: '/dashboard', backLabel: 'Dashboard' } })}>View Recap</button>
                            </>
                        ) : <div className="dash-empty">No games played yet.</div>}
                    </div>
                </div>

                {/* My Schedule */}
                <div className="dash-sched-head">
                    <span className="dash-zone-title">My Schedule</span>
                    {team && <span className="dash-zone-sub">{team.name} · upcoming games</span>}
                </div>
                <div className="dash-sched-card">
                    {mySchedule.length === 0 ? (
                        <div className="dash-empty" style={{ padding: '20px' }}>No upcoming games.</div>
                    ) : mySchedule.map(g => (
                        <div key={g.id} className="dash-sched-row">
                            <div className="dash-sched-date">
                                <div className="dash-sched-day">{fmtDay(g.gameDate)}</div>
                                <div className="dash-sched-num">{fmtDate(g.gameDate)}</div>
                            </div>
                            <div className="dash-sched-info">
                                <div className="dash-sched-teams">{teamName(g.homeTeamId)} <span className="dash-vs">vs</span> {teamName(g.awayTeamId)}</div>
                                <div className="dash-sched-meta">{fmtTime(g.gameDate)}{g.rink ? ` · ${g.rink}` : ''}</div>
                            </div>
                            <button className="dash-preview-btn dash-preview-btn--sm" onClick={() => navigate(`/game/${g.id}/preview`, { state: { from: '/dashboard', backLabel: 'Dashboard' } })}>Preview</button>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── OFFICIATING ── */}
            {isOfficial && (
                <section id="signups" className="dash-zone dash-zone--alt">
                    <div className="obi-container">
                        <h2 className="dash-zone-h2">Signups</h2>
                        <p className="dash-zone-intro">
                            Goalies mark weekly availability so the coordinator can schedule balanced matchups. Refs and scorekeepers
                            sign up for open slots. Confirm any assignment a coordinator gives you. You only see the roles you're cleared for.
                        </p>

                        <div className="dash-role-tabs">
                            {officialRoles.map(r => (
                                <button key={r} className={`dash-role-tab${activeRole === r ? ' is-active' : ''}`} onClick={() => setActiveRole(r)}>
                                    {ROLE_LABEL[r]}
                                    <span className="dash-role-tab-count">{tabCountLabel(r)}</span>
                                </button>
                            ))}
                        </div>

                        <div className="dash-grid-2">
                            {/* My role schedule */}
                            <div>
                                <div className="dash-col-title">My {ROLE_LABEL[activeRole]} Schedule</div>
                                {myCommitments.length === 0 ? (
                                    <div className="dash-empty-dashed">
                                        {activeRole === 'GOALIE'
                                            ? 'No goalie assignments yet — mark your availability and the coordinator will schedule you.'
                                            : `No ${ROLE_LABEL[activeRole]} commitments yet — grab an open slot.`}
                                    </div>
                                ) : (
                                    <div className="dash-commit-list">
                                        {myCommitments.map((a, i) => {
                                            const s = commitmentStatus(a);
                                            const isPending = s.cls === 'pending';
                                            return (
                                                <div key={a.id || a.slotId || i} className="dash-commit-card">
                                                    <div className="dash-commit-top">
                                                        <span className="dash-commit-game">{(a.homeTeam || teamName(a.homeTeamId))} vs {(a.awayTeam || teamName(a.awayTeamId))}</span>
                                                        <span className={`dash-commit-status dash-commit-status--${s.cls}`}>{s.label}</span>
                                                    </div>
                                                    <div className="dash-commit-meta">{fmtWhen(a.gameDate)}{a.rink ? ` · ${a.rink}` : ''}</div>
                                                    {isPending && a.id && (
                                                        <div className="dash-action-btns" style={{ marginTop: 12 }}>
                                                            <button className="dash-btn dash-btn--gold" disabled={busy === a.id} onClick={() => respondPending(a.id, 'confirm')}>Confirm</button>
                                                            <button className="dash-btn dash-btn--ghost" disabled={busy === a.id} onClick={() => respondPending(a.id, 'decline')}>Decline</button>
                                                        </div>
                                                    )}
                                                    {activeRole === 'SCOREKEEPER' && s.cls === 'confirmed' && a.gameId && (
                                                        <div className="dash-action-btns" style={{ marginTop: 12 }}>
                                                            <button className="dash-btn dash-btn--gold" onClick={() => navigate(`/scorekeeper/game/${a.gameId}`)}>Score Game →</button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Right column */}
                            <div>
                                {activeRole === 'GOALIE' ? (
                                    <>
                                        <div className="dash-col-title">My Availability</div>
                                        <p className="dash-col-note">Mark each week so the goalie coordinator can build balanced matchups. They schedule you — you don't claim shifts.</p>
                                        <div className="dash-week-list">
                                            {goalieWeeks.slice(0, 2).map(w => (
                                                <div key={w.week} className="dash-week-row">
                                                    <div className="dash-week-label">{w.status === 'AVAILABLE' ? 'Available' : w.status === 'UNAVAILABLE' ? 'Unavailable' : 'Not set'} · Week {w.week}</div>
                                                    <div className="dash-week-btns">
                                                        <button className={`dash-week-btn${w.status === 'AVAILABLE' ? ' is-avail' : ''}`} disabled={busy === w.week} onClick={() => setAvail(w.week, w.status === 'AVAILABLE' ? null : 'AVAILABLE')}>Available</button>
                                                        <button className={`dash-week-btn${w.status === 'UNAVAILABLE' ? ' is-unavail' : ''}`} disabled={busy === w.week} onClick={() => setAvail(w.week, w.status === 'UNAVAILABLE' ? null : 'UNAVAILABLE')}>Unavailable</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Link to="/user/goalie-availability" className="dash-deeplink">
                                            <span>Set availability for all weeks</span>
                                            <span className="dash-deeplink-more">{goalieWeeks.length > 2 ? `+${goalieWeeks.length - 2} more weeks →` : 'Open →'}</span>
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <div className="dash-col-title">Open {ROLE_LABEL[activeRole]} Slots</div>
                                        {availableOpen.length === 0 ? (
                                            <div className="dash-empty-dashed">No open {ROLE_LABEL[activeRole]} slots right now.</div>
                                        ) : (
                                            <div className="dash-commit-list">
                                                {availableOpen.map(s => (
                                                    <div key={s.slotId} className="dash-slot-row">
                                                        <div className="dash-slot-info">
                                                            <div className="dash-commit-game">{s.homeTeam} vs {s.awayTeam}</div>
                                                            <div className="dash-commit-meta">{fmtWhen(s.gameDate)}{s.rink ? ` · ${s.rink}` : ''}</div>
                                                        </div>
                                                        <button className="dash-btn dash-btn--gold" disabled={busy === s.slotId} onClick={() => signup(s.slotId)}>Sign Up</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <Link to="/user/open-slots" className="dash-deeplink">
                                            <span>View all open slots</span>
                                            <span className="dash-deeplink-more">Open →</span>
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ── TEAM MANAGEMENT ── */}
            {isGM && (
                <section id="team" className="dash-zone">
                    <div className="obi-container">
                        <div className="dash-team-editor">
                            <GMTeam />
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

function TeamChip({ id, teamById }) {
    const t = teamById(id);
    const color = resolveTeamColor(t?.teamColor);
    return (
        <Link to={`/teams/${id}`} className="dash-team-chip">
            <span className="dash-team-dot" style={{ background: color }} />
            <span>{t?.name || 'TBD'}</span>
        </Link>
    );
}

export default Dashboard;
