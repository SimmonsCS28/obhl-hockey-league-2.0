import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './ShiftSignup.css';

const RefereeShiftSignup = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [users, setUsers] = useState([]); // To show names of assigned refs
    const [loading, setLoading] = useState(true);

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
            const [gamesData, teamsData, usersData] = await Promise.all([
                api.getGames(seasonId),
                api.getTeams({ seasonId }),
                api.getUsers() // Get all users to display names
            ]);

            setGames(gamesData);
            setTeams(teamsData);
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load season data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTakeShift = async (gameId, slot) => {
        try {
            const updateData = {};
            if (slot === 1) updateData.referee1Id = user.id;
            if (slot === 2) updateData.referee2Id = user.id;

            await api.updateGame(gameId, updateData);
            await loadSeasonData(selectedSeason);
        } catch (error) {
            console.error('Failed to take shift:', error);
            alert('Failed to take shift. Please try again.');
        }
    };

    const handleCancelShift = async (gameId, slot) => {
        if (!window.confirm('Are you sure you want to cancel this shift?')) return;

        try {
            const updateData = {};
            if (slot === 1) updateData.referee1Id = null;
            if (slot === 2) updateData.referee2Id = null;

            await api.updateGame(gameId, updateData);
            await loadSeasonData(selectedSeason);
        } catch (error) {
            console.error('Failed to cancel shift:', error);
            alert('Failed to cancel shift. Please try again.');
        }
    };

    const getUserById = (userId) => {
        return users.find(u => u.id === userId);
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
        const lightColors = ['White', '#FFFFFF', 'Yellow', '#FFD700', 'Gold', 'Lt. Blu', '#87CEEB', 'LightBlue'];
        const isLight = lightColors.some(c => c.toLowerCase() === bgColor.toLowerCase());
        return isLight ? '#2c3e50' : 'white';
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="shift-signup">
            <div className="shift-header">
                <h1>Referee Shift Signup</h1>
                <div className="header-buttons">
                    <button
                        className="back-button"
                        onClick={() => navigate('/user')}
                    >
                        ← Back to Dashboard
                    </button>
                    <button
                        className="home-button"
                        onClick={() => navigate('/')}
                    >
                        OBHL Home
                    </button>
                    <button
                        className="logout-button"
                        onClick={() => { logout(); navigate('/'); }}
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="season-selector">
                <label>Season:</label>
                <select
                    value={selectedSeason || ''}
                    onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                >
                    {seasons.map(season => (
                        <option key={season.id} value={season.id}>
                            {season.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="games-table-container">
                {games.length === 0 ? (
                    <p>No games scheduled for this season</p>
                ) : (
                    <table className="shifts-table">
                        <thead>
                            <tr>
                                <th>Week</th>
                                <th>Date & Time</th>
                                <th>Home Team</th>
                                <th>Away Team</th>
                                <th>Location</th>
                                <th>Referee 1</th>
                                <th>Referee 2</th>
                            </tr>
                        </thead>
                        <tbody>
                            {games.map(game => {
                                const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                const ref1 = getUserById(game.referee1Id);
                                const ref2 = getUserById(game.referee2Id);

                                return (
                                    <tr key={game.id}>
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
                                            {game.referee1Id ? (
                                                <div className="assigned-shift">
                                                    <span className="assigned-name">{ref1?.username || 'Unknown'}</span>
                                                    {game.referee1Id === user?.id && (
                                                        <button
                                                            onClick={() => handleCancelShift(game.id, 1)}
                                                            className="cancel-btn-small"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleTakeShift(game.id, 1)}
                                                    className="take-shift-btn"
                                                >
                                                    Take Shift
                                                </button>
                                            )}
                                        </td>
                                        <td>
                                            {game.referee2Id ? (
                                                <div className="assigned-shift">
                                                    <span className="assigned-name">{ref2?.username || 'Unknown'}</span>
                                                    {game.referee2Id === user?.id && (
                                                        <button
                                                            onClick={() => handleCancelShift(game.id, 2)}
                                                            className="cancel-btn-small"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleTakeShift(game.id, 2)}
                                                    className="take-shift-btn"
                                                >
                                                    Take Shift
                                                </button>
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
};

export default RefereeShiftSignup;
