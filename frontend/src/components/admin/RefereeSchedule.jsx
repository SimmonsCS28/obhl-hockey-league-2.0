import { useEffect, useState } from 'react';
import api from '../services/api';
import './StaffSchedule.css';

function RefereeSchedule() {
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [games, setGames] = useState([]);
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedSeason) {
            loadSeasonData(selectedSeason);
        }
    }, [selectedSeason]);

    const loadInitialData = async () => {
        try {
            const seasonsData = await api.getSeasons();
            setSeasons(seasonsData);

            const activeSeason = seasonsData.find(s => s.isActive) || seasonsData[0];
            if (activeSeason) {
                setSelectedSeason(activeSeason.id);
            }
        } catch (error) {
            console.error('Failed to load seasons:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSeasonData = async (seasonId) => {
        setLoading(true);
        try {
            const [gamesData, playersData, teamsData] = await Promise.all([
                api.getGames(seasonId),
                api.getPlayers({ seasonId, active: true }),
                api.getTeams({ seasonId })
            ]);

            setGames(gamesData);
            setPlayers(playersData);
            setTeams(teamsData);
        } catch (error) {
            console.error('Failed to load season data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignReferee = async (gameId, playerId) => {
        try {
            await api.updateGame(gameId, { refereeId: playerId || null });
            const gamesData = await api.getGames(selectedSeason);
            setGames(gamesData);
        } catch (error) {
            console.error('Failed to assign referee:', error);
            alert('Failed to assign referee. Please try again.');
        }
    };

    const getTeamName = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        return team?.name || `Team ${teamId}`;
    };

    const filteredGames = games.filter(game => {
        if (filter === 'assigned') return game.refereeId != null;
        if (filter === 'unassigned') return game.refereeId == null;
        return true;
    });

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="staff-schedule">
            <div className="schedule-header">
                <h2>👔 Referee Schedule</h2>
                <div className="header-controls">
                    <div className="filter-group">
                        <label>Season:</label>
                        <select
                            value={selectedSeason || ''}
                            onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                            className="season-select"
                        >
                            {seasons.map(season => (
                                <option key={season.id} value={season.id}>
                                    {season.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Filter:</label>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Games</option>
                            <option value="assigned">Assigned</option>
                            <option value="unassigned">Unassigned</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="schedule-stats">
                <div className="stat-card">
                    <div className="stat-value">{games.length}</div>
                    <div className="stat-label">Total Games</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{games.filter(g => g.refereeId).length}</div>
                    <div className="stat-label">Assigned</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{games.filter(g => !g.refereeId).length}</div>
                    <div className="stat-label">Unassigned</div>
                </div>
            </div>

            <div className="games-table-container">
                {filteredGames.length === 0 ? (
                    <div className="empty-state">No games found</div>
                ) : (
                    <table className="games-table">
                        <thead>
                            <tr>
                                <th>Week</th>
                                <th>Date & Time</th>
                                <th>Home Team</th>
                                <th>Away Team</th>
                                <th>Location</th>
                                <th>Assigned Referee</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGames.map(game => {
                                const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                return (
                                    <tr key={game.id}>
                                        <td>Week {game.week}</td>
                                        <td>
                                            <div>{gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                            <div className="time">{gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                                        </td>
                                        <td>{getTeamName(game.homeTeamId)}</td>
                                        <td>{getTeamName(game.awayTeamId)}</td>
                                        <td>{game.rink || 'TBD'}</td>
                                        <td>
                                            <select
                                                value={game.refereeId || ''}
                                                onChange={(e) => handleAssignReferee(game.id, e.target.value ? parseInt(e.target.value) : null)}
                                                className="referee-select"
                                            >
                                                <option value="">-- Select Referee --</option>
                                                {players.map(player => (
                                                    <option key={player.id} value={player.id}>
                                                        #{player.jerseyNumber} {player.firstName} {player.lastName}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default RefereeSchedule;
