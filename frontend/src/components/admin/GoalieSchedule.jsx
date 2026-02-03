import { useEffect, useState } from 'react';
import api from '../../services/api';
import './StaffSchedule.css';

function GoalieSchedule() {
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [games, setGames] = useState([]);
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, assigned, unassigned
    const [weekFilter, setWeekFilter] = useState('all'); // all or specific week number

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

    const handleAssignGoalie = async (gameId, slot, playerId) => {
        try {
            const updateData = {};
            if (slot === 1) updateData.goalie1Id = playerId || null;
            if (slot === 2) updateData.goalie2Id = playerId || null;

            await api.updateGame(gameId, updateData);
            // Refresh games
            const gamesData = await api.getGames(selectedSeason);
            setGames(gamesData);
        } catch (error) {
            console.error('Failed to assign goalie:', error);
            alert('Failed to assign goalie. Please try again.');
        }
    };

    const getTeamById = (teamId) => {
        return teams.find(t => t.id === teamId);
    };

    const getValidColor = (color) => {
        if (!color) return '#95a5a6';

        const colorMap = {
            'Lt. Blu': '#87CEEB',
            'Dk. Gre': '#006400',
            'White': '#FFFFFF',
            'Yellow': '#FFD700',
            'Gold': '#FFD700'
        };

        return colorMap[color] || color;
    };

    const getTextColor = (bgColor) => {
        if (!bgColor) return 'white';

        const lightColors = [
            'White', '#FFFFFF',
            'Yellow', '#FFD700',
            'Gold',
            'Lt. Blu', '#87CEEB', 'LightBlue'
        ];

        const isLight = lightColors.some(c =>
            c.toLowerCase() === bgColor.toLowerCase()
        );

        return isLight ? '#2c3e50' : 'white';
    };

    const filteredGames = games.filter(game => {
        const isAssigned = game.goalie1Id != null && game.goalie2Id != null;
        const isPartiallyAssigned = game.goalie1Id != null || game.goalie2Id != null;

        // Apply assignment filter
        if (filter === 'assigned' && !isPartiallyAssigned) return false;
        if (filter === 'unassigned' && isAssigned) return false;

        // Apply week filter
        if (weekFilter !== 'all' && game.week !== parseInt(weekFilter)) return false;

        return true;
    });

    // Get unique weeks for the filter dropdown
    const availableWeeks = [...new Set(games.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b);

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="staff-schedule">
            <div className="schedule-header">
                <h2>🥅 Goalie Schedule</h2>
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

                    <div className="filter-group">
                        <label>Week:</label>
                        <select
                            value={weekFilter}
                            onChange={(e) => setWeekFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Weeks</option>
                            {availableWeeks.map(week => (
                                <option key={week} value={week}>
                                    Week {week}
                                </option>
                            ))}
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
                    <div className="stat-value">
                        {games.reduce((acc, g) => acc + (g.goalie1Id ? 1 : 0) + (g.goalie2Id ? 1 : 0), 0)} / {games.length * 2}
                    </div>
                    <div className="stat-label">Slots Assigned</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">
                        {games.reduce((acc, g) => acc + (!g.goalie1Id ? 1 : 0) + (!g.goalie2Id ? 1 : 0), 0)}
                    </div>
                    <div className="stat-label">Slots Open</div>
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
                                <th>Goalie 1</th>
                                <th>Goalie 2</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGames.map((game, index) => {
                                const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                const previousGame = index > 0 ? filteredGames[index - 1] : null;
                                const isNewWeek = previousGame && previousGame.week !== game.week;
                                return (
                                    <tr key={game.id} className={isNewWeek ? 'week-separator' : ''}>
                                        <td>Week {game.week}</td>
                                        <td>
                                            {gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </td>
                                        <td>
                                            <span
                                                className="team-badge"
                                                style={{
                                                    backgroundColor: getValidColor(getTeamById(game.homeTeamId)?.teamColor),
                                                    color: getTextColor(getTeamById(game.homeTeamId)?.teamColor)
                                                }}
                                            >
                                                {getTeamById(game.homeTeamId)?.name || `Team ${game.homeTeamId}`}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className="team-badge"
                                                style={{
                                                    backgroundColor: getValidColor(getTeamById(game.awayTeamId)?.teamColor),
                                                    color: getTextColor(getTeamById(game.awayTeamId)?.teamColor)
                                                }}
                                            >
                                                {getTeamById(game.awayTeamId)?.name || `Team ${game.awayTeamId}`}
                                            </span>
                                        </td>
                                        <td>{game.rink || 'TBD'}</td>
                                        <td>
                                            <select
                                                value={game.goalie1Id || ''}
                                                onChange={(e) => handleAssignGoalie(game.id, 1, e.target.value ? parseInt(e.target.value) : null)}
                                                className="goalie-select"
                                            >
                                                <option value="">-- Select Goalie 1 --</option>
                                                {players.map(player => (
                                                    <option key={player.id} value={player.id}>
                                                        #{player.jerseyNumber} {player.firstName} {player.lastName}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <select
                                                value={game.goalie2Id || ''}
                                                onChange={(e) => handleAssignGoalie(game.id, 2, e.target.value ? parseInt(e.target.value) : null)}
                                                className="goalie-select"
                                            >
                                                <option value="">-- Select Goalie 2 --</option>
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

export default GoalieSchedule;
