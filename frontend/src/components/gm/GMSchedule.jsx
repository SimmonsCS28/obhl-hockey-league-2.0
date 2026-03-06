import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './GMSchedule.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Map non-CSS team color names to valid CSS colors
const COLOR_MAP = {
    'lt. blue': '#add8e6',
    'lt. blu': '#add8e6',
    'light blue': '#add8e6',
    'tan': '#d2b48c',
    'maroon': '#800000',
    'gray': '#808080',
    'grey': '#808080',
    'orange': '#ffa500',
    'black': '#000000',
    'white': '#ffffff',
    'green': '#008000',
    'blue': '#0000ff',
    'red': '#ff0000',
};

const resolveTeamColor = (color) => {
    if (!color) return null;
    return COLOR_MAP[color.toLowerCase()] || color;
};

function GMSchedule() {
    const { user } = useAuth();
    const [games, setGames] = useState([]);
    const [filteredGames, setFilteredGames] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.teamId) {
            fetchSchedule();
        }
    }, [user]);

    useEffect(() => {
        filterGames();
    }, [selectedWeek, games]);

    const fetchSchedule = async () => {
        try {
            // Get active season
            const seasonsRes = await axios.get(`${API_BASE_URL}/seasons`);
            const activeSeason = seasonsRes.data.find(s => s.isActive);

            if (activeSeason) {
                const gamesRes = await axios.get(`${API_BASE_URL}/gm/team/${user.teamId}/schedule?seasonId=${activeSeason.id}`, {
                    headers: getAuthHeaders(),
                });
                setGames(gamesRes.data);

                // Extract unique weeks
                const uniqueWeeks = [...new Set(gamesRes.data.map(g => g.week))].sort((a, b) => a - b);
                setWeeks(uniqueWeeks);
            }
        } catch (error) {
            console.error('Failed to fetch schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterGames = () => {
        if (selectedWeek === 'all') {
            setFilteredGames(games);
        } else {
            setFilteredGames(games.filter(g => g.week === parseInt(selectedWeek)));
        }
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="gm-schedule">
            <div className="schedule-header">
                <h1>My Schedule</h1>
                {weeks.length > 0 && (
                    <div className="week-filter">
                        <label>Filter by week:</label>
                        <select
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(e.target.value)}
                            className="week-select"
                        >
                            <option value="all">All Weeks</option>
                            {weeks.map(week => (
                                <option key={week} value={week}>Week {week}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="games-list-container">
                {filteredGames.length > 0 ? (
                    <table className="gm-schedule-table">
                        <thead>
                            <tr>
                                <th>Week</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Opponent</th>
                                <th>Location</th>
                                <th>Result</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGames.map(game => {
                                const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                const isHomeGame = game.homeTeamId === user.teamId;
                                const opponentId = isHomeGame ? game.awayTeamId : game.homeTeamId;
                                const opponentName = isHomeGame ? game.awayTeamName : game.homeTeamName;
                                const locationContext = isHomeGame ? '(Home)' : '(Away)';
                                const isCompleted = game.gameStatus === 'COMPLETED';

                                return (
                                    <tr key={game.id}>
                                        <td className="week-col">Week {game.week}</td>
                                        <td>{gameDate.toLocaleDateString()}</td>
                                        <td>{gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td
                                            className="opponent-cell"
                                            style={{
                                                backgroundColor: resolveTeamColor(isHomeGame ? game.awayTeamColor : game.homeTeamColor) || '',
                                                color: (() => {
                                                    const rawColor = isHomeGame ? game.awayTeamColor : game.homeTeamColor;
                                                    const resolved = resolveTeamColor(rawColor);
                                                    if (!resolved) return 'inherit';
                                                    const lower = (rawColor || '').toLowerCase();
                                                    return lower === 'white' || lower === '#ffffff' ? '#2d3748' : '#fff';
                                                })()
                                            }}
                                        >
                                            <Link to={`/teams/${opponentId}`} style={{ color: 'inherit', textDecoration: 'none', display: 'block', width: '100%' }}>
                                                <span className="opponent-name">{opponentName}</span>
                                                <span className="game-context"> {locationContext}</span>
                                            </Link>
                                        </td>
                                        <td>{game.rink}</td>
                                        <td>
                                            {isCompleted ? (
                                                <span className="game-score">
                                                    {game.homeScore} - {game.awayScore}
                                                </span>
                                            ) : (
                                                <span className="upcoming-badge">Upcoming</span>
                                            )}
                                        </td>
                                        <td>
                                            {isCompleted ? (
                                                <Link to={`/game/${game.id}/recap`} className="btn-action-small preview-btn">Recap</Link>
                                            ) : (
                                                <Link to={`/game/${game.id}/preview`} className="btn-action-small preview-btn">Preview</Link>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <p className="no-data">No games scheduled</p>
                )}
            </div>
        </div>
    );
}

export default GMSchedule;
