import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import * as api from '../../services/api';
import TeamBadge from '../common/TeamBadge';
import './GameRecap.css';

function GameRecap() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const fromTeamId = location.state?.fromTeamId;

    const [game, setGame] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (gameId) {
            fetchRecapData();
        }
    }, [gameId]);

    const fetchRecapData = async () => {
        try {
            setLoading(true);

            // Fetch game data and teams mapping
            const [gameData, teamsData] = await Promise.all([
                api.getGame(gameId),
                api.getTeams()
            ]);

            if (!gameData) throw new Error('Game not found');

            // Find teams
            const homeTeam = teamsData.find(t => t.id === gameData.homeTeamId);
            const awayTeam = teamsData.find(t => t.id === gameData.awayTeamId);

            const enrichedGame = {
                ...gameData,
                homeTeamName: homeTeam?.name || `Team ${gameData.homeTeamId}`,
                awayTeamName: awayTeam?.name || `Team ${gameData.awayTeamId}`,
                homeTeamColor: homeTeam?.teamColor,
                awayTeamColor: awayTeam?.teamColor
            };

            setGame(enrichedGame);

            // Fetch players to map event IDs
            const [homePlayers, awayPlayers] = await Promise.all([
                api.getPlayers({ teamId: gameData.homeTeamId }),
                api.getPlayers({ teamId: gameData.awayTeamId })
            ]);
            const allPlayers = [...homePlayers, ...awayPlayers];

            // Fetch events
            const backendEvents = await api.getGameEvents(gameData.id);
            if (backendEvents && backendEvents.length > 0) {
                const mappedEvents = backendEvents.map((be) => {
                    const isHome = Number(be.teamId) === Number(gameData.homeTeamId);
                    const teamSide = isHome ? 'home' : 'away';
                    const periodMap = { 1: '1', 2: '2', 3: '3', 4: 'OT', 5: 'SO' };
                    const timeStr = `${String(be.timeMinutes || 0).padStart(2, '0')}:${String(be.timeSeconds || 0).padStart(2, '0')}`;

                    // Resolve Player Names
                    const formatPlayerName = (player, includeInitial = false) => {
                        const name = includeInitial
                            ? `${player.firstName[0]}. ${player.lastName}`
                            : `${player.firstName} ${player.lastName}`;
                        return player.jerseyNumber != null && player.jerseyNumber !== '' ? `#${player.jerseyNumber} ${name}` : name;
                    };

                    const mainPlayer = allPlayers.find(p => Number(p.id) === Number(be.playerId));
                    const assist1 = allPlayers.find(p => Number(p.id) === Number(be.assist1PlayerId));
                    const assist2 = allPlayers.find(p => Number(p.id) === Number(be.assist2PlayerId));

                    const playerName = mainPlayer ? formatPlayerName(mainPlayer) : (be.description || 'Unknown');

                    const assists = [];
                    if (assist1) assists.push(formatPlayerName(assist1, true));
                    if (assist2) assists.push(formatPlayerName(assist2, true));

                    return {
                        id: be.id,
                        type: be.eventType, // 'goal' or 'penalty'
                        period: periodMap[be.period] || String(be.period),
                        time: timeStr,
                        team: teamSide,
                        teamName: isHome ? enrichedGame.homeTeamName : enrichedGame.awayTeamName,
                        player: playerName,
                        assists: assists,
                        minutes: be.penaltyMinutes,
                        description: be.description
                    };
                });

                // Sort by period, then by time ascending (MM:SS string sort works here since format is padded)
                mappedEvents.sort((a, b) => {
                    if (a.period !== b.period) {
                        const pOrder = { '1': 1, '2': 2, '3': 3, 'OT': 4, 'SO': 5 };
                        return (pOrder[a.period] || 99) - (pOrder[b.period] || 99);
                    }
                    return a.time.localeCompare(b.time);
                });

                setEvents(mappedEvents);
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (loading) return <div className="game-recap-container"><div className="loading">Loading Game Recap...</div></div>;
    if (error) return <div className="game-recap-container"><div className="error-container"><h2>Error Loading Recap</h2><p>{error}</p><button onClick={() => navigate(-1)} className="btn-back">Go Back</button></div></div>;
    if (!game) return <div className="game-recap-container"><div className="error-container">Game details could not be found.</div></div>;

    const goals = events.filter(e => e.type === 'goal');
    const penalties = events.filter(e => e.type === 'penalty');

    return (
        <div className="game-recap-container">
            <div className="recap-nav">
                <button onClick={() => navigate(-1)} className="btn-back">
                    ← Back to {fromTeamId ? 'Team' : location.state?.fromDashboard ? 'My Dashboard' : 'Schedule'}
                </button>
            </div>

            <div className="recap-header">
                <div className="recap-sup-header">
                    <h2>Game Recap</h2>
                    <div className="game-logistics">
                        <span className="logistics-item">{formatDate(game.gameDate)}</span>
                        <span className="logistics-item">{game.rink} Rink</span>
                        <span className="logistics-item">Final{game.endedInOT ? ' (OT)' : ''}</span>
                    </div>
                </div>

                <div className="scoreboard">
                    <div className="team-score">
                        <span className="home-away-label">AWAY</span>
                        <Link to={`/teams/${game.awayTeamId}`} className="team-name-link">
                            <div className="team-name">
                                <TeamBadge teamName={game.awayTeamName} teamColor={game.awayTeamColor} />
                            </div>
                        </Link>
                        <div className="score">{game.awayScore}</div>
                    </div>

                    <div className="vs">VS</div>

                    <div className="team-score">
                        <span className="home-away-label">HOME</span>
                        <Link to={`/teams/${game.homeTeamId}`} className="team-name-link">
                            <div className="team-name">
                                <TeamBadge teamName={game.homeTeamName} teamColor={game.homeTeamColor} />
                            </div>
                        </Link>
                        <div className="score">{game.homeScore}</div>
                    </div>
                </div>
            </div>

            <div className="events-container">
                <div className="events-section">
                    <h3>Goal Summary</h3>
                    {goals.length === 0 ? (
                        <p className="no-events">No goals recorded in this game.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="events-table">
                                <thead>
                                    <tr>
                                        <th>Pd</th>
                                        <th>Time</th>
                                        <th>Team</th>
                                        <th>Goal Scorer</th>
                                        <th>Assists</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {goals.map(goal => (
                                        <tr key={goal.id}>
                                            <td className="period-cell">{goal.period}</td>
                                            <td className="time-cell">{goal.time}</td>
                                            <td className="team-cell">{goal.teamName}</td>
                                            <td className="player-cell"><strong>{goal.player}</strong></td>
                                            <td className="assists-cell">
                                                {goal.assists && goal.assists.length > 0
                                                    ? goal.assists.join(', ')
                                                    : <span className="unassisted">Unassisted</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="events-section mt-4">
                    <h3>Penalty Summary</h3>
                    {penalties.length === 0 ? (
                        <p className="no-events">No penalties recorded in this game.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="events-table">
                                <thead>
                                    <tr>
                                        <th>Pd</th>
                                        <th>Time</th>
                                        <th>Team</th>
                                        <th>Player</th>
                                        <th>Min</th>
                                        <th>Infraction</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {penalties.map(penalty => (
                                        <tr key={penalty.id}>
                                            <td className="period-cell">{penalty.period}</td>
                                            <td className="time-cell">{penalty.time}</td>
                                            <td className="team-cell">{penalty.teamName}</td>
                                            <td className="player-cell"><strong>{penalty.player}</strong></td>
                                            <td className="min-cell">{penalty.minutes}</td>
                                            <td className="infraction-cell">{penalty.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GameRecap;
