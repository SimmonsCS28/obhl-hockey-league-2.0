import { useEffect, useMemo, useState } from 'react';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor } from '../../constants/teamColors';
import api from '../../services/api';
import LiveScoreEntry from '../LiveScoreEntry';
import './GameManagementAdmin.css';

function GameManagementAdmin() {
    const { selectedSeasonId } = useSeason();
    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [selectedGameId, setSelectedGameId] = useState('');
    const [selectedGame, setSelectedGame] = useState(null);

    useEffect(() => {
        if (!selectedSeasonId) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [gamesData, teamsData] = await Promise.all([
                    api.getGames(selectedSeasonId),
                    api.getTeams(),
                ]);
                if (cancelled) return;
                const teamMap = Object.fromEntries(teamsData.map(t => [String(t.id), t]));
                const enriched = gamesData.map(g => {
                    const homeTeam = teamMap[String(g.homeTeamId)];
                    const awayTeam = teamMap[String(g.awayTeamId)];
                    return {
                        ...g,
                        homeTeamName: homeTeam?.name || `Team ${g.homeTeamId}`,
                        awayTeamName: awayTeam?.name || `Team ${g.awayTeamId}`,
                        homeTeamColor: resolveTeamColor(homeTeam?.teamColor),
                        awayTeamColor: resolveTeamColor(awayTeam?.teamColor),
                        homeTeam,
                        awayTeam,
                    };
                });
                setGames(enriched);
                setTeams(teamsData);
            } catch (err) {
                if (!cancelled) console.error('GameManagementAdmin load error:', err);
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

    const weekGames = useMemo(() => {
        if (selectedWeek === 'all') return games;
        return games.filter(g => g.week === Number(selectedWeek));
    }, [games, selectedWeek]);

    const handleGameSelect = (gameId) => {
        setSelectedGameId(gameId);
        if (!gameId) {
            setSelectedGame(null);
            return;
        }
        const g = games.find(g => String(g.id) === String(gameId));
        setSelectedGame(g || null);
    };

    const handleGameUpdated = (updatedGame) => {
        setGames(prev => prev.map(g => {
            if (g.id !== updatedGame.id) return g;
            const teamMap = Object.fromEntries(teams.map(t => [String(t.id), t]));
            const homeTeam = teamMap[String(updatedGame.homeTeamId)];
            const awayTeam = teamMap[String(updatedGame.awayTeamId)];
            return {
                ...updatedGame,
                homeTeamName: homeTeam?.name || `Team ${updatedGame.homeTeamId}`,
                awayTeamName: awayTeam?.name || `Team ${updatedGame.awayTeamId}`,
                homeTeamColor: resolveTeamColor(homeTeam?.teamColor),
                awayTeamColor: resolveTeamColor(awayTeam?.teamColor),
                homeTeam,
                awayTeam,
            };
        }));
        if (selectedGame?.id === updatedGame.id) {
            setSelectedGame(prev => ({ ...prev, ...updatedGame }));
        }
    };

    const formatStatus = (status) => {
        if (!status) return 'Unknown';
        if (status === 'Final' || status === 'completed' || status === 'COMPLETED') return 'Final';
        if (status === 'In Progress' || status === 'in_progress' || status === 'IN_PROGRESS') return 'In Progress';
        return 'Scheduled';
    };

    const statusClass = (status) => {
        const s = formatStatus(status);
        if (s === 'Final') return 'is-final';
        if (s === 'In Progress') return 'is-live';
        return 'is-scheduled';
    };

    if (loading) {
        return <div className="obi-gmgmt-loading">Loading games…</div>;
    }

    return (
        <div className="obi-gmgmt">
            {/* Week filter chips */}
            <div className="obi-gmgmt-weeks">
                <span className="obi-gmgmt-weeks-label">Week</span>
                <button
                    className={`obi-chip${selectedWeek === 'all' ? ' is-active' : ''}`}
                    onClick={() => { setSelectedWeek('all'); setSelectedGameId(''); setSelectedGame(null); }}
                >All</button>
                {availableWeeks.map(w => (
                    <button
                        key={w}
                        className={`obi-chip${selectedWeek === w ? ' is-active' : ''}`}
                        onClick={() => { setSelectedWeek(w); setSelectedGameId(''); setSelectedGame(null); }}
                    >{w}</button>
                ))}
            </div>

            {/* Game selector bar */}
            <div className="obi-gmgmt-selector">
                <span className="obi-gmgmt-sel-label">Game</span>
                <select
                    className="obi-gmgmt-game-select"
                    value={selectedGameId}
                    onChange={e => handleGameSelect(e.target.value)}
                >
                    <option value="">— select a game —</option>
                    {weekGames.map(g => (
                        <option key={g.id} value={g.id}>
                            {`Wk ${g.week ?? '?'} · ${g.homeTeamName} vs ${g.awayTeamName} (${formatStatus(g.status)})`}
                        </option>
                    ))}
                </select>
                {selectedGame && (
                    <span className={`obi-gmgmt-status-badge ${statusClass(selectedGame.status)}`}>
                        {formatStatus(selectedGame.status)}
                    </span>
                )}
                <span className="obi-gmgmt-game-count">
                    {weekGames.length} game{weekGames.length !== 1 ? 's' : ''}
                    {selectedWeek !== 'all' ? ` in week ${selectedWeek}` : ''}
                </span>
            </div>

            {/* Content */}
            {!selectedGame ? (
                <div className="obi-gmgmt-prompt">
                    Select a game above to view and edit its box score.
                </div>
            ) : (
                <div className="obi-gmgmt-editor">
                    <LiveScoreEntry
                        game={selectedGame}
                        teams={teams}
                        onBack={() => { setSelectedGameId(''); setSelectedGame(null); }}
                        onGameUpdated={handleGameUpdated}
                    />
                </div>
            )}
        </div>
    );
}

export default GameManagementAdmin;
