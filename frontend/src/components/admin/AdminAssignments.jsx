import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor } from '../../constants/teamColors';
import GoalieProposerBar from '../coordinator/GoalieProposerBar';
import {
    GOALIE_SELECT_STYLE,
    goalieCounts,
    isGoalieWeekPublished,
} from '../coordinator/goalieProposerStatus';
import api from '../../services/api';
import { rankTeams, goaliePickTeamId } from '../../utils/goaliePick';
import './AdminAssignments.css';

function displayName(user) {
    if (!user) return '';
    return (user.firstName && user.lastName)
        ? `${user.firstName} ${user.lastName}`
        : user.username || `User ${user.id}`;
}

function sortByName(users) {
    return [...(users || [])].sort((a, b) => displayName(a).localeCompare(displayName(b)));
}

// Maps a select's field name to the coordinator role/slot it corresponds to.
const FIELD_TO_SLOT = {
    goalie1Id: { role: 'GOALIE', slot: 1 },
    goalie2Id: { role: 'GOALIE', slot: 2 },
    referee1Id: { role: 'REF', slot: 1 },
    referee2Id: { role: 'REF', slot: 2 },
    scorekeeperId: { role: 'SCOREKEEPER', slot: 1 },
};

// A week is past (proposer hidden) once all its games are Final.
function weekIsPast(games) {
    if (!games.length) return false;
    return games.every(g => String(g.status || '').toUpperCase() === 'FINAL');
}

// The auto-proposer is regular-season only — playoff matchups are TBD until the bracket is set.
function weekIsPlayoff(games) {
    if (!games.length) return false;
    return games.every(g => String(g.gameType || 'REGULAR_SEASON').toUpperCase() === 'PLAYOFF');
}

// Tooltip explaining why a team has the goalie pick this matchup.
function goaliePickTitle(game) {
    return String(game?.gameType || 'REGULAR_SEASON').toUpperCase() === 'PLAYOFF'
        ? 'Playoffs: higher seed in the standings has goalie pick'
        : 'Lower in the standings has goalie pick this week';
}

// Pill outline in a team's own (already-resolved) color, marking the team with goalie pick this
// matchup. The non-pick side gets a transparent border of the same box size so nothing shifts.
function pickPillStyle(isPick, teamColor) {
    if (!isPick || !teamColor) return { border: '1px solid transparent', background: 'transparent' };
    return { border: `1px solid ${teamColor}`, background: `color-mix(in srgb, ${teamColor} 14%, transparent)` };
}

// Design select styling: PENDING (awaiting), CONFIRMED, DECLINED, or UNASSIGNED (needs attention).
// A pre-filled name with no coordinator row reads as CONFIRMED; an empty slot reads as UNASSIGNED.
function goalieSelectStatus(assignment, hasName) {
    if (assignment) {
        if (assignment.status === 'CONFIRMED') return 'CONFIRMED';
        if (assignment.status === 'DECLINED') return 'DECLINED';
        // AUTO_PROPOSED, PROPOSED, SIGNED_UP all read as "pending / awaiting".
        return 'PENDING';
    }
    return hasName ? 'CONFIRMED' : 'UNASSIGNED';
}

function AdminAssignments() {
    const { selectedSeasonId } = useSeason();

    const [games, setGames] = useState([]);
    const [rankByTeam, setRankByTeam] = useState(new Map()); // teamId -> standings rank, for goalie-pick label
    const [goaliePool, setGoaliePool] = useState([]);
    const [refPool, setRefPool] = useState([]);
    const [scorerPool, setScorerPool] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWeek, setSelectedWeek] = useState('all');
    // Per-row pending saves: gameId → { field: value }
    const [saving, setSaving] = useState({});
    const [errors, setErrors] = useState({});
    // Coordinator goalie assignments drive the status-colored goalie selects + proposer bar.
    const [goalieAssignments, setGoalieAssignments] = useState([]);
    const [proposerBusy, setProposerBusy] = useState(null); // 'generate' | 'send' | 'publish' | null
    const [banner, setBanner] = useState(null);
    const [proposerRun, setProposerRun] = useState(null);   // last auto-propose result ("why" data)

    useEffect(() => {
        if (!selectedSeasonId) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [gamesData, teamsData, goalies, refs, scorers, goalieAsgn, standingsData] = await Promise.all([
                    api.getGames(selectedSeasonId),
                    api.getTeams(),
                    api.getUsers({ role: 'GOALIE' }),
                    api.getUsers({ role: 'REF' }),
                    api.getUsers({ role: 'SCOREKEEPER' }),
                    api.getCoordinatorAssignments(selectedSeasonId, 'GOALIE'),
                    api.getStandings(selectedSeasonId).catch(() => null),
                ]);
                if (cancelled) return;
                setGoalieAssignments(goalieAsgn || []);
                setRankByTeam(rankTeams(standingsData || teamsData || []));
                const teamMap = Object.fromEntries(teamsData.map(t => [String(t.id), t]));
                const enriched = gamesData.map(g => ({
                    ...g,
                    homeTeamName: teamMap[String(g.homeTeamId)]?.name || `Team ${g.homeTeamId}`,
                    awayTeamName: teamMap[String(g.awayTeamId)]?.name || `Team ${g.awayTeamId}`,
                    homeTeamColor: resolveTeamColor(teamMap[String(g.homeTeamId)]?.teamColor),
                    awayTeamColor: resolveTeamColor(teamMap[String(g.awayTeamId)]?.teamColor),
                }));
                setGames(enriched);
                setGoaliePool(sortByName(goalies));
                setRefPool(sortByName(refs));
                setScorerPool(sortByName(scorers));
            } catch (err) {
                if (!cancelled) console.error('AdminAssignments load error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [selectedSeasonId]);

    const availableWeeks = useMemo(() => {
        const weeks = [...new Set(games.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b);
        return weeks;
    }, [games]);

    const filteredGames = useMemo(() => {
        if (selectedWeek === 'all') return games;
        return games.filter(g => g.week === Number(selectedWeek));
    }, [games, selectedWeek]);

    const handleAssign = useCallback(async (gameId, field, value) => {
        const numVal = value === '' ? null : Number(value);
        // Optimistic update
        setGames(prev => prev.map(g => g.id === gameId ? { ...g, [field]: numVal } : g));
        setSaving(prev => ({ ...prev, [gameId]: true }));
        setErrors(prev => { const n = { ...prev }; delete n[gameId]; return n; });
        try {
            const { role, slot } = FIELD_TO_SLOT[field];
            // Routed through the coordinator service so the assignment is immediately
            // CONFIRMED + published — visible on the Coordinator Console and the
            // assigned user's dashboard without a separate confirm/publish step.
            await api.adminAssignShift({ gameId, role, slot, userId: numVal });
        } catch (err) {
            console.error('Assignment save error:', err);
            setErrors(prev => ({ ...prev, [gameId]: 'Save failed' }));
        } finally {
            setSaving(prev => { const n = { ...prev }; delete n[gameId]; return n; });
        }
    }, []);

    const reloadGoalieAssignments = useCallback(async () => {
        const data = await api.getCoordinatorAssignments(selectedSeasonId, 'GOALIE');
        setGoalieAssignments(data || []);
    }, [selectedSeasonId]);

    const goalieSlotFor = useCallback(
        (gameId, slot) => goalieAssignments.find(a => a.gameId === gameId && a.slot === slot),
        [goalieAssignments],
    );

    // Goalie select change routes through the coordinator lifecycle (not admin direct-assign):
    // picking a name proposes it as pending (awaiting the goalie's confirmation); clearing withdraws.
    const handleGoalieChange = useCallback(async (gameId, slot, value) => {
        setErrors(prev => { const n = { ...prev }; delete n[gameId]; return n; });
        setSaving(prev => ({ ...prev, [gameId]: true }));
        try {
            if (value === '') {
                const existing = goalieAssignments.find(a => a.gameId === gameId && a.slot === slot);
                if (existing) {
                    await api.withdrawShift(existing.id, 'GOALIE');
                } else {
                    // No coordinator row but a published game column — clear it directly.
                    await api.adminAssignShift({ gameId, role: 'GOALIE', slot, userId: null });
                }
            } else {
                await api.proposeShift({ gameId, seasonId: selectedSeasonId, role: 'GOALIE', slot, userId: Number(value) });
            }
            await reloadGoalieAssignments();
        } catch (err) {
            console.error('Goalie assignment error:', err);
            setErrors(prev => ({ ...prev, [gameId]: 'Save failed' }));
        } finally {
            setSaving(prev => { const n = { ...prev }; delete n[gameId]; return n; });
        }
    }, [goalieAssignments, selectedSeasonId, reloadGoalieAssignments]);

    // Move both goalies to the other team's slot — keeps their confirmation, sends no email.
    const handleSwap = useCallback(async (gameId) => {
        setErrors(prev => { const n = { ...prev }; delete n[gameId]; return n; });
        setSaving(prev => ({ ...prev, [gameId]: true }));
        try {
            await api.swapGoalieSlots(gameId);
            await reloadGoalieAssignments();
        } catch (err) {
            console.error('Goalie swap error:', err);
            setErrors(prev => ({ ...prev, [gameId]: 'Swap failed' }));
        } finally {
            setSaving(prev => { const n = { ...prev }; delete n[gameId]; return n; });
        }
    }, [reloadGoalieAssignments]);

    // Dev-only: simulate the goalie's email confirm/decline so the flow is testable locally.
    const handleSimulate = useCallback(async (assignmentId, action) => {
        try {
            await api.simulateShiftResponse(assignmentId, action, 'GOALIE');
            await reloadGoalieAssignments();
        } catch (err) {
            console.error('Simulate response error:', err);
        }
    }, [reloadGoalieAssignments]);

    // ---- Proposer bar actions ----
    const handleGenerate = useCallback(async (week) => {
        setProposerBusy('generate');
        try {
            const result = await api.autoProposeGoalies(selectedSeasonId, week);
            await reloadGoalieAssignments();
            setProposerRun({ week, ...result });
            const sat = (result.sitting || []).map(s => s.name).join(', ');
            setBanner(
                `Proposed ${result.filledCount} goalie slot(s) for Week ${week}` +
                (result.openCount ? ` · ${result.openCount} still open` : '') +
                (sat ? ` · sitting out: ${sat}` : ''));
        } catch (err) {
            setBanner(err.message || 'Failed to generate proposals');
        } finally {
            setProposerBusy(null);
        }
    }, [selectedSeasonId, reloadGoalieAssignments]);

    const handleSend = useCallback(async (week) => {
        setProposerBusy('send');
        try {
            const result = await api.sendGoalieConfirmations(selectedSeasonId, week);
            await reloadGoalieAssignments();
            setBanner(`Sent ${result.sentCount} confirmation email(s) for Week ${week}.`);
        } catch (err) {
            setBanner(err.message || 'Failed to send confirmation emails');
        } finally {
            setProposerBusy(null);
        }
    }, [selectedSeasonId, reloadGoalieAssignments]);

    const handleProposerPublish = useCallback(async (week) => {
        setProposerBusy('publish');
        try {
            const result = await api.publishShiftWeek(selectedSeasonId, 'GOALIE', week);
            await reloadGoalieAssignments();
            setBanner(`Published ${result.publishedCount} final assignment(s) for Week ${week}. Assignment emails sent.`);
        } catch (err) {
            setBanner(err.message || 'Failed to publish');
        } finally {
            setProposerBusy(null);
        }
    }, [selectedSeasonId, reloadGoalieAssignments]);

    const formatGameDate = (dateString) => {
        if (!dateString) return '—';
        try {
            const d = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
                ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch { return '—'; }
    };

    // Goalie auto-proposer: only for a single, non-past week.
    const weekGameIds = new Set(filteredGames.map(g => g.id));
    const weekGoalieAssignments = goalieAssignments.filter(a => weekGameIds.has(a.gameId));
    // Playoff weeks are supported too — the backend switches to best-available-goalie mode.
    const isPlayoffWeek = weekIsPlayoff(filteredGames);
    const showProposer = selectedWeek !== 'all' && filteredGames.length > 0 && !weekIsPast(filteredGames);
    const proposerCounts = goalieCounts(weekGoalieAssignments, filteredGames.length * 2);
    const proposerPublished = isGoalieWeekPublished(weekGoalieAssignments);
    const anyFilled = weekGoalieAssignments.some(a => a.status !== 'DECLINED');

    if (loading) {
        return <div className="obi-asgn-loading">Loading assignments…</div>;
    }

    return (
        <div className="obi-asgn">
            {/* Week filter chips */}
            <div className="obi-asgn-weeks">
                <span className="obi-asgn-weeks-label">Week</span>
                <button
                    className={`obi-chip${selectedWeek === 'all' ? ' is-active' : ''}`}
                    onClick={() => setSelectedWeek('all')}
                >All</button>
                {availableWeeks.map(w => (
                    <button
                        key={w}
                        className={`obi-chip${selectedWeek === w ? ' is-active' : ''}`}
                        onClick={() => setSelectedWeek(w)}
                    >{w}</button>
                ))}
            </div>

            {/* This grid is the admin direct-assign override; the sign-up → confirm → publish
                workflow lives in the Coordinator Console. */}
            <div className="obi-asgn-placeholder-note">
                Direct admin override — changes save straight to each game. For the self sign-up →
                confirm → publish workflow, use the <Link to="/coordinator">Coordinator Console</Link>.
            </div>

            {/* Goalie auto-proposer bar (single non-past week) */}
            {showProposer && (
                <GoalieProposerBar
                    week={Number(selectedWeek)}
                    variant="admin"
                    playoff={isPlayoffWeek}
                    counts={proposerCounts}
                    published={proposerPublished}
                    publishedSummary={`Final game & team assignment emails sent to ${proposerCounts.confirmed} goalie(s) for Week ${selectedWeek}.`}
                    busy={proposerBusy}
                    anyFilled={anyFilled}
                    banner={banner}
                    onDismissBanner={() => setBanner(null)}
                    onGenerate={() => handleGenerate(Number(selectedWeek))}
                    onSend={() => handleSend(Number(selectedWeek))}
                    onPublish={() => handleProposerPublish(Number(selectedWeek))}
                    reasoning={proposerRun?.week === Number(selectedWeek) ? proposerRun.reasoning : null}
                    sitting={proposerRun?.week === Number(selectedWeek) ? proposerRun.sitting : null}
                />
            )}

            {filteredGames.length === 0 ? (
                <div className="obi-asgn-empty">No games for this week.</div>
            ) : (
                <div className="obi-asgn-table-wrap">
                    {/* Goalie confirmation-status legend */}
                    <div className="obi-asgn-legend">
                        <span className="obi-asgn-legend-label">Goalie Status</span>
                        <span className="obi-asgn-legend-item">
                            <span className="obi-asgn-swatch" style={{ background: 'rgba(246,169,28,0.55)' }} />
                            Pending
                        </span>
                        <span className="obi-asgn-legend-item">
                            <span className="obi-asgn-swatch" style={{ background: 'rgba(127,181,154,0.5)' }} />
                            Confirmed
                        </span>
                        <span className="obi-asgn-legend-item">
                            <span className="obi-asgn-swatch" style={{ background: 'rgba(224,138,138,0.5)' }} />
                            Declined
                        </span>
                    </div>

                    {/* Table header */}
                    <div className="obi-asgn-header">
                        <span className="obi-asgn-col-game">Game</span>
                        <span className="obi-asgn-col-goalies">Goalies · one per team</span>
                        <span className="obi-asgn-col-refs">Referees · 2</span>
                        <span className="obi-asgn-col-scorer">Scorekeeper</span>
                    </div>

                    {filteredGames.map(game => (
                        <div key={game.id} className={`obi-asgn-row${saving[game.id] ? ' is-saving' : ''}`}>
                            {/* Game info */}
                            <div className="obi-asgn-col-game">
                                <div className="obi-asgn-matchup">
                                    <span className="obi-asgn-team-box"
                                        style={pickPillStyle(goaliePickTeamId(game, rankByTeam) === game.homeTeamId, game.homeTeamColor)}
                                        title={goaliePickTeamId(game, rankByTeam) === game.homeTeamId ? goaliePickTitle(game) : undefined}>
                                        <span className="obi-asgn-tdot" style={{ background: game.homeTeamColor }} />
                                        <span>{game.homeTeamName}</span>
                                    </span>
                                    <span className="obi-asgn-vs">vs</span>
                                    <span className="obi-asgn-team-box"
                                        style={pickPillStyle(goaliePickTeamId(game, rankByTeam) === game.awayTeamId, game.awayTeamColor)}
                                        title={goaliePickTeamId(game, rankByTeam) === game.awayTeamId ? goaliePickTitle(game) : undefined}>
                                        <span>{game.awayTeamName}</span>
                                        <span className="obi-asgn-tdot" style={{ background: game.awayTeamColor }} />
                                    </span>
                                </div>
                                <div className="obi-asgn-when">{formatGameDate(game.gameDate)}</div>
                                {errors[game.id] && (
                                    <div className="obi-asgn-error">{errors[game.id]}</div>
                                )}
                            </div>

                            {/* Goalies */}
                            <div className="obi-asgn-col-goalies">
                                {[1, 2].map(slot => {
                                    const assignment = goalieSlotFor(game.id, slot);
                                    const gameValue = slot === 1 ? game.goalie1Id : game.goalie2Id;
                                    // The coordinator row is the source of truth once one exists.
                                    const value = assignment?.userId ?? gameValue ?? '';
                                    const statusKey = goalieSelectStatus(assignment, !!value);
                                    // Simulating a reply only makes sense once the goalie has
                                    // actually been emailed (PROPOSED), not while auto-proposed.
                                    const awaitingReply = assignment?.status === 'PROPOSED';
                                    const slotTeamId = slot === 1 ? game.homeTeamId : game.awayTeamId;
                                    const slotTeamColor = slot === 1 ? game.homeTeamColor : game.awayTeamColor;
                                    const slotHasPick = goaliePickTeamId(game, rankByTeam) === slotTeamId;
                                    return (
                                        <div className="obi-asgn-goalie-row" key={slot}>
                                            <span className="obi-asgn-team-label"
                                                style={pickPillStyle(slotHasPick, slotTeamColor)}
                                                title={slotHasPick ? goaliePickTitle(game) : undefined}>
                                                <span
                                                    className="obi-asgn-tdot"
                                                    style={{ background: slot === 1 ? game.homeTeamColor : game.awayTeamColor }}
                                                />
                                                <span className="obi-asgn-team-abbr">
                                                    {slot === 1 ? game.homeTeamName : game.awayTeamName}
                                                </span>
                                            </span>
                                            <select
                                                className="obi-asgn-select obi-asgn-select--goalie"
                                                style={GOALIE_SELECT_STYLE[statusKey]}
                                                value={value}
                                                onChange={e => handleGoalieChange(game.id, slot, e.target.value)}
                                            >
                                                <option value="">— unassigned —</option>
                                                {goaliePool.map(u => (
                                                    <option key={u.id} value={u.id}>{displayName(u)}</option>
                                                ))}
                                            </select>
                                            {/* Dev-only: stand in for the goalie's real email confirm/decline. */}
                                            {import.meta.env.DEV && awaitingReply && (
                                                <span className="obi-asgn-sim">
                                                    <button
                                                        type="button"
                                                        className="obi-asgn-sim-btn is-confirm"
                                                        title="Simulate: goalie confirms"
                                                        onClick={() => handleSimulate(assignment.id, 'confirm')}
                                                    >✓</button>
                                                    <button
                                                        type="button"
                                                        className="obi-asgn-sim-btn is-decline"
                                                        title="Simulate: goalie declines"
                                                        onClick={() => handleSimulate(assignment.id, 'decline')}
                                                    >✕</button>
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                                {(goalieSlotFor(game.id, 1) || goalieSlotFor(game.id, 2)) && (
                                    <button
                                        type="button"
                                        className="obi-asgn-swap-btn"
                                        title="Move each goalie to the other team — keeps their confirmation, no new email"
                                        onClick={() => handleSwap(game.id)}
                                    >
                                        ⇄ Swap Teams
                                    </button>
                                )}
                            </div>

                            {/* Referees */}
                            <div className="obi-asgn-col-refs">
                                <select
                                    className={`obi-asgn-select${game.referee1Id ? '' : ' is-unset'}`}
                                    value={game.referee1Id ?? ''}
                                    onChange={e => handleAssign(game.id, 'referee1Id', e.target.value)}
                                >
                                    <option value="">— unassigned —</option>
                                    {refPool.map(u => (
                                        <option key={u.id} value={u.id}>{displayName(u)}</option>
                                    ))}
                                </select>
                                <select
                                    className={`obi-asgn-select${game.referee2Id ? '' : ' is-unset'}`}
                                    value={game.referee2Id ?? ''}
                                    onChange={e => handleAssign(game.id, 'referee2Id', e.target.value)}
                                >
                                    <option value="">— unassigned —</option>
                                    {refPool.map(u => (
                                        <option key={u.id} value={u.id}>{displayName(u)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Scorekeeper */}
                            <div className="obi-asgn-col-scorer">
                                <select
                                    className={`obi-asgn-select${game.scorekeeperId ? '' : ' is-unset'}`}
                                    value={game.scorekeeperId ?? ''}
                                    onChange={e => handleAssign(game.id, 'scorekeeperId', e.target.value)}
                                >
                                    <option value="">— unassigned —</option>
                                    {scorerPool.map(u => (
                                        <option key={u.id} value={u.id}>{displayName(u)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AdminAssignments;
