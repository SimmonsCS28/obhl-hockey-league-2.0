import { useEffect, useMemo, useState } from 'react';
import { useSeason } from '../contexts/SeasonContext';
import { resolveTeamColor } from '../constants/teamColors';
import api from '../services/api';
import LiveScoreEntry from './LiveScoreEntry';
import './ScorekeeperContent.css';

const TZ = 'America/Chicago';

const toDate = (s) => (s ? new Date(s.endsWith('Z') ? s : s + 'Z') : null);
const fmtDay = (d) => d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ }) : '';
const fmtTime = (d) => d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '';

const normStatus = (s) => {
    const v = String(s || '').toLowerCase();
    if (v === 'completed' || v === 'final') return 'final';
    if (v === 'in_progress' || v === 'in progress') return 'live';
    return 'scheduled';
};

function ScorekeeperContent() {
    const { selectedSeasonId } = useSeason();
    const [selectedGameId, setSelectedGameId] = useState(null);
    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [loading, setLoading] = useState(true);
    const [staffNames, setStaffNames] = useState(null);
    const [isChildDirty, setIsChildDirty] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    // Load teams once
    useEffect(() => {
        api.getTeams().then(setTeams).catch(() => setTeams([]));
    }, []);

    const enrichGames = (data) => data.map(game => {
        const homeTeam = teams.find(t => Number(t.id) === Number(game.homeTeamId));
        const awayTeam = teams.find(t => Number(t.id) === Number(game.awayTeamId));
        return {
            ...game,
            homeTeam,
            awayTeam,
            homeTeamName: homeTeam?.name || `Team ${game.homeTeamId}`,
            awayTeamName: awayTeam?.name || `Team ${game.awayTeamId}`,
            homeTeamColor: homeTeam?.teamColor || '#6b7280',
            awayTeamColor: awayTeam?.teamColor || '#6b7280',
        };
    });

    // Load games whenever the (topbar) season or the teams change
    useEffect(() => {
        if (!selectedSeasonId || !teams.length) return;
        let cancelled = false;
        api.getGames(selectedSeasonId)
            .then(data => {
                if (cancelled) return;
                setGames(enrichGames(data));
                setSelectedWeek('all');
                setSelectedGameId(null);
            })
            .catch(() => { if (!cancelled) setGames([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [selectedSeasonId, teams]);

    const availableWeeks = useMemo(
        () => [...new Set(games.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b),
        [games]
    );

    const filteredGames = useMemo(() => {
        const list = selectedWeek === 'all' ? games : games.filter(g => g.week === Number(selectedWeek));
        return [...list].sort((a, b) => (toDate(a.gameDate) || 0) - (toDate(b.gameDate) || 0));
    }, [games, selectedWeek]);

    // The game being scored: the explicit pick if still visible, else the first in view.
    // Derived from `games` so score/finalize updates always flow through.
    const activeGame = useMemo(() => {
        const picked = selectedGameId != null && filteredGames.find(g => g.id === selectedGameId);
        return picked || filteredGames[0] || null;
    }, [selectedGameId, filteredGames]);

    // Resolve officials for the context card whenever the active game changes.
    useEffect(() => {
        if (!activeGame) return;
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale officials before the async re-fetch
        setStaffNames(null);
        Promise.all([
            api.getUserPublicName(activeGame.goalie1Id),
            api.getUserPublicName(activeGame.goalie2Id),
            api.getUserPublicName(activeGame.referee1Id),
            api.getUserPublicName(activeGame.referee2Id),
            api.getUserPublicName(activeGame.scorekeeperId),
        ]).then(([g1, g2, r1, r2, sk]) => {
            if (cancelled) return;
            setStaffNames({ homeGoalie: g1, awayGoalie: g2, referee1: r1, referee2: r2, scorekeeper: sk });
        }).catch(() => { if (!cancelled) setStaffNames({}); });
        return () => { cancelled = true; };
    }, [activeGame?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Dirty-navigation guard (switching game/week with unsaved scoring) ──
    const executeAction = (action) => {
        setIsChildDirty(false);
        if (action.type === 'WEEK') setSelectedWeek(action.value);
        else if (action.type === 'GAME') setSelectedGameId(action.value);
    };

    const requestAction = (action) => {
        if (action.type === 'GAME' && action.value === activeGame?.id) return;
        if (isChildDirty) setPendingAction(action);
        else executeAction(action);
    };

    const handleNavigationConfirmed = () => {
        if (pendingAction) { executeAction(pendingAction); setPendingAction(null); }
    };
    const handleNavigationCancelled = () => setPendingAction(null);

    const handleGameUpdated = (updatedGame) => {
        setGames(prev => prev.map(g => (g.id === updatedGame.id ? { ...g, ...updatedGame } : g)));
    };

    if (loading) {
        return <div className="sk-live-loading">Loading games…</div>;
    }

    const dot = (color) => resolveTeamColor(color);

    return (
        <div className="sk-live">
            {/* Week filter chips */}
            <div className="sk-live-weekbar">
                <span className="sk-live-weeklabel">Week</span>
                <button
                    className={`sk-live-chip${selectedWeek === 'all' ? ' is-active' : ''}`}
                    onClick={() => requestAction({ type: 'WEEK', value: 'all' })}
                >
                    All Games
                </button>
                {availableWeeks.map(w => (
                    <button
                        key={w}
                        className={`sk-live-chip${String(selectedWeek) === String(w) ? ' is-active' : ''}`}
                        onClick={() => requestAction({ type: 'WEEK', value: w })}
                    >
                        Week {w}
                    </button>
                ))}
            </div>

            {/* Game selector chips */}
            {filteredGames.length > 0 ? (
                <div className="sk-live-gamebar">
                    {filteredGames.map(g => {
                        const status = normStatus(g.status);
                        const active = activeGame?.id === g.id;
                        return (
                            <button
                                key={g.id}
                                className={`sk-live-gamechip status-${status}${active ? ' is-active' : ''}`}
                                onClick={() => requestAction({ type: 'GAME', value: g.id })}
                            >
                                <span className={`sk-live-statusdot status-${status}`} />
                                {g.homeTeamName} vs {g.awayTeamName}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="sk-live-empty">
                    No games for this season yet. Generate a schedule on the Schedule page first.
                </div>
            )}

            {/* Selected game context card */}
            {activeGame && (() => {
                const d = toDate(activeGame.gameDate);
                const staff = (name) => (name ? name : 'Not Assigned');
                const staffCls = (name) => (name ? 'sk-live-staff-val' : 'sk-live-staff-val is-empty');
                return (
                    <div className="sk-live-context">
                        <div className="sk-live-context-top">
                            <div className="sk-live-meta"><span className="sk-live-meta-label">Week</span><span className="sk-live-meta-val">Week {activeGame.week}</span></div>
                            <div className="sk-live-meta"><span className="sk-live-meta-label">Date</span><span className="sk-live-meta-val">{fmtDay(d)}</span></div>
                            <div className="sk-live-meta"><span className="sk-live-meta-label">Time</span><span className="sk-live-meta-val">{fmtTime(d)}</span></div>
                            <div className="sk-live-meta"><span className="sk-live-meta-label">Rink</span><span className="sk-live-meta-val">{activeGame.rink || '—'}</span></div>
                        </div>
                        <div className="sk-live-context-divider" />
                        <div className="sk-live-context-staff">
                            <div className="sk-live-staff">
                                <span className="sk-live-staff-label">{activeGame.homeTeamName} Goalie</span>
                                <span className={staffCls(staffNames?.homeGoalie)}>
                                    <span className="sk-live-staff-dot" style={{ background: dot(activeGame.homeTeamColor) }} />
                                    {staffNames ? staff(staffNames.homeGoalie) : '…'}
                                </span>
                            </div>
                            <div className="sk-live-staff">
                                <span className="sk-live-staff-label">{activeGame.awayTeamName} Goalie</span>
                                <span className={staffCls(staffNames?.awayGoalie)}>
                                    <span className="sk-live-staff-dot" style={{ background: dot(activeGame.awayTeamColor) }} />
                                    {staffNames ? staff(staffNames.awayGoalie) : '…'}
                                </span>
                            </div>
                            <div className="sk-live-staff">
                                <span className="sk-live-staff-label">Referee 1</span>
                                <span className={staffCls(staffNames?.referee1)}>{staffNames ? staff(staffNames.referee1) : '…'}</span>
                            </div>
                            <div className="sk-live-staff">
                                <span className="sk-live-staff-label">Referee 2</span>
                                <span className={staffCls(staffNames?.referee2)}>{staffNames ? staff(staffNames.referee2) : '…'}</span>
                            </div>
                            <div className="sk-live-staff">
                                <span className="sk-live-staff-label">Scorekeeper</span>
                                <span className={staffCls(staffNames?.scorekeeper)}>{staffNames ? staff(staffNames.scorekeeper) : '…'}</span>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Live scoring for the active game */}
            {activeGame && (
                <LiveScoreEntry
                    key={activeGame.id}
                    game={activeGame}
                    teams={teams}
                    embedded
                    onGameUpdated={handleGameUpdated}
                    onDirtyChange={setIsChildDirty}
                    hasPendingNavigation={!!pendingAction}
                    onNavigate={handleNavigationConfirmed}
                    onNavigateCancel={handleNavigationCancelled}
                />
            )}
        </div>
    );
}

export default ScorekeeperContent;
