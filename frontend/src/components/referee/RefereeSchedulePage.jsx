import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import '../admin/StaffSchedule.css'; // Reuse styles

function RefereeSchedulePage() {
    const { user } = useAuth();
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [games, setGames] = useState([]);
    const [users, setUsers] = useState([]); // Use users instead of players for staff
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('my-games'); // 'my-games' or 'all'
    const [weekFilter, setWeekFilter] = useState('all');

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
            const [gamesData, usersData, teamsData] = await Promise.all([
                api.getGames(seasonId),
                api.getUsers(), // Fetch all users
                api.getTeams({ seasonId })
            ]);
            setGames(gamesData);
            setUsers(usersData);
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



    const filteredGames = games.filter(game => {
        // Filter logic
        if (filter === 'my-games') {
            if (!user) return false; // If no user, show nothing for "my games"
            return game.referee1Id === user.id || game.referee2Id === user.id;
        }

        // Week filter
        if (weekFilter !== 'all' && game.week !== parseInt(weekFilter)) return false;

        return true;
    });

    const availableWeeks = [...new Set(games.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b);

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="staff-schedule">
            <div className="staff-schedule-container">
                <div className="schedule-header">
                    <h2>My Referee Schedule</h2>
                    <div className="header-controls">
                        <Link to="/user/referee" className="signup-link-btn">
                            Sign Up for Shifts
                        </Link>
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
                        <div className="filter-group">
                            <label>Week:</label>
                            <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="filter-select">
                                <option value="all">All Weeks</option>
                                {availableWeeks.map(w => <option key={w} value={w}>Week {w}</option>)}
                            </select>
                        </div>
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
                                    <th>Referees</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGames.map((game, index) => {
                                    const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                    const previousGame = index > 0 ? filteredGames[index - 1] : null;
                                    const isNewWeek = previousGame && previousGame.week !== game.week;

                                    const ref1 = users.find(u => u.id === game.referee1Id);
                                    const ref2 = users.find(u => u.id === game.referee2Id);

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
                                            <td>
                                                <div>{ref1 ? `${ref1.username}` : '-'}</div>
                                                <div>{ref2 ? `${ref2.username}` : '-'}</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RefereeSchedulePage;
