import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import '../admin/StaffSchedule.css'; // Reuse styles

function ScorekeeperSchedulePage() {
    const { user } = useAuth();
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [games, setGames] = useState([]);
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('my-games'); // 'my-games' or 'all'

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
            if (activeSeason) setSelectedSeason(activeSeason.id);
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

    const getTeamById = (teamId) => teams.find(t => t.id === teamId);

    const getValidColor = (color) => {
        if (!color) return '#95a5a6';
        const colorMap = { 'Lt. Blu': '#87CEEB', 'Dk. Gre': '#006400', 'White': '#FFFFFF', 'Yellow': '#FFD700', 'Gold': '#FFD700' };
        return colorMap[color] || color;
    };

    const getTextColor = (bgColor) => {
        if (!bgColor) return 'white';
        const lightColors = ['White', '#FFFFFF', 'Yellow', '#FFD700', 'Gold', 'Lt. Blu', '#87CEEB', 'LightBlue'];
        return lightColors.some(c => c.toLowerCase() === bgColor.toLowerCase()) ? '#2c3e50' : 'white';
    };

    const currentPlayer = players.find(p => p.email === user?.email);

    const filteredGames = games.filter(game => {
        if (filter === 'my-games') {
            if (!currentPlayer) return false;
            return game.scorekeeperId === currentPlayer.id;
        }
        return true;
    });

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="staff-schedule">
            <div className="schedule-header">
                <h2>My Scorekeeper Schedule</h2>
                <div className="header-controls">
                    <div className="filter-group">
                        <label>Season:</label>
                        <select value={selectedSeason || ''} onChange={(e) => setSelectedSeason(parseInt(e.target.value))} className="season-select">
                            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>View:</label>
                        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="filter-select">
                            <option value="my-games">My Games</option>
                            <option value="all">All Games</option>
                        </select>
                    </div>
                </div>
            </div>

            {!currentPlayer && filter === 'my-games' && (
                <div className="alert-warning" style={{ margin: '1rem', padding: '1rem', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px' }}>
                    Note: We couldn't find a player profile matching your email ({user?.email}). Please contact an administrator to link your account.
                </div>
            )}

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
                                <th>Scorekeeper</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGames.map((game, index) => {
                                const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                const previousGame = index > 0 ? filteredGames[index - 1] : null;
                                const isNewWeek = previousGame && previousGame.week !== game.week;
                                const sk = players.find(p => p.id === game.scorekeeperId);

                                return (
                                    <tr key={game.id} className={isNewWeek ? 'week-separator' : ''}>
                                        <td>Week {game.week}</td>
                                        <td>{gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                                        <td>
                                            <span className="team-badge" style={{ backgroundColor: getValidColor(getTeamById(game.homeTeamId)?.teamColor), color: getTextColor(getTeamById(game.homeTeamId)?.teamColor) }}>
                                                {getTeamById(game.homeTeamId)?.name || `Team ${game.homeTeamId}`}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="team-badge" style={{ backgroundColor: getValidColor(getTeamById(game.awayTeamId)?.teamColor), color: getTextColor(getTeamById(game.awayTeamId)?.teamColor) }}>
                                                {getTeamById(game.awayTeamId)?.name || `Team ${game.awayTeamId}`}
                                            </span>
                                        </td>
                                        <td>{game.rink || 'TBD'}</td>
                                        <td>{sk ? `${sk.firstName} ${sk.lastName}` : '-'}</td>
                                        <td>
                                            {game.scorekeeperId === currentPlayer?.id && (
                                                <Link to={`/scorekeeper/game/${game.id}`} className="action-btn">Score Game</Link>
                                            )}
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

export default ScorekeeperSchedulePage;
