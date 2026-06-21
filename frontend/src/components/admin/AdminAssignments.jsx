import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor } from '../../constants/teamColors';
import api from '../../services/api';
import './AdminAssignments.css';

function displayName(user) {
    if (!user) return '';
    return (user.firstName && user.lastName)
        ? `${user.firstName} ${user.lastName}`
        : user.username || `User ${user.id}`;
}

function AdminAssignments() {
    const { selectedSeasonId } = useSeason();

    const [games, setGames] = useState([]);
    const [goaliePool, setGoaliePool] = useState([]);
    const [refPool, setRefPool] = useState([]);
    const [scorerPool, setScorerPool] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWeek, setSelectedWeek] = useState('all');
    // Per-row pending saves: gameId → { field: value }
    const [saving, setSaving] = useState({});
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!selectedSeasonId) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [gamesData, teamsData, goalies, refs, scorers] = await Promise.all([
                    api.getGames(selectedSeasonId),
                    api.getTeams(),
                    api.getUsers({ role: 'GOALIE' }),
                    api.getUsers({ role: 'REF' }),
                    api.getUsers({ role: 'SCOREKEEPER' }),
                ]);
                if (cancelled) return;
                const teamMap = Object.fromEntries(teamsData.map(t => [String(t.id), t]));
                const enriched = gamesData.map(g => ({
                    ...g,
                    homeTeamName: teamMap[String(g.homeTeamId)]?.name || `Team ${g.homeTeamId}`,
                    awayTeamName: teamMap[String(g.awayTeamId)]?.name || `Team ${g.awayTeamId}`,
                    homeTeamColor: resolveTeamColor(teamMap[String(g.homeTeamId)]?.teamColor),
                    awayTeamColor: resolveTeamColor(teamMap[String(g.awayTeamId)]?.teamColor),
                }));
                setGames(enriched);
                setGoaliePool(goalies || []);
                setRefPool(refs || []);
                setScorerPool(scorers || []);
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
            await api.updateGame(gameId, { [field]: numVal });
        } catch (err) {
            console.error('Assignment save error:', err);
            setErrors(prev => ({ ...prev, [gameId]: 'Save failed' }));
        } finally {
            setSaving(prev => { const n = { ...prev }; delete n[gameId]; return n; });
        }
    }, []);

    const formatGameDate = (dateString) => {
        if (!dateString) return '—';
        try {
            const d = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
                ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch { return '—'; }
    };

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

            {/* Coordinator publish workflow placeholder */}
            <div className="obi-asgn-placeholder-note">
                Confirm / publish workflow is on the <code>coordinator-feature</code> branch — placeholder until merged.
            </div>

            {filteredGames.length === 0 ? (
                <div className="obi-asgn-empty">No games for this week.</div>
            ) : (
                <div className="obi-asgn-table-wrap">
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
                                    <span className="obi-asgn-tdot" style={{ background: game.homeTeamColor }} />
                                    <span>{game.homeTeamName}</span>
                                    <span className="obi-asgn-vs">vs</span>
                                    <span>{game.awayTeamName}</span>
                                    <span className="obi-asgn-tdot" style={{ background: game.awayTeamColor }} />
                                </div>
                                <div className="obi-asgn-when">{formatGameDate(game.gameDate)}</div>
                                {errors[game.id] && (
                                    <div className="obi-asgn-error">{errors[game.id]}</div>
                                )}
                            </div>

                            {/* Goalies */}
                            <div className="obi-asgn-col-goalies">
                                <div className="obi-asgn-goalie-row">
                                    <span className="obi-asgn-team-label">
                                        <span className="obi-asgn-tdot" style={{ background: game.homeTeamColor }} />
                                        <span className="obi-asgn-team-abbr">{game.homeTeamName}</span>
                                    </span>
                                    <select
                                        className={`obi-asgn-select${game.goalie1Id ? '' : ' is-unset'}`}
                                        value={game.goalie1Id ?? ''}
                                        onChange={e => handleAssign(game.id, 'goalie1Id', e.target.value)}
                                    >
                                        <option value="">— unassigned —</option>
                                        {goaliePool.map(u => (
                                            <option key={u.id} value={u.id}>{displayName(u)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="obi-asgn-goalie-row">
                                    <span className="obi-asgn-team-label">
                                        <span className="obi-asgn-tdot" style={{ background: game.awayTeamColor }} />
                                        <span className="obi-asgn-team-abbr">{game.awayTeamName}</span>
                                    </span>
                                    <select
                                        className={`obi-asgn-select${game.goalie2Id ? '' : ' is-unset'}`}
                                        value={game.goalie2Id ?? ''}
                                        onChange={e => handleAssign(game.id, 'goalie2Id', e.target.value)}
                                    >
                                        <option value="">— unassigned —</option>
                                        {goaliePool.map(u => (
                                            <option key={u.id} value={u.id}>{displayName(u)}</option>
                                        ))}
                                    </select>
                                </div>
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
