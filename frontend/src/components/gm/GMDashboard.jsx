import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './GMDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function GMDashboard() {
    const { user } = useAuth();
    const [roster, setRoster] = useState([]);
    const [nextGame, setNextGame] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.teamId) {
            fetchRoster();
            fetchNextGame();
        }
    }, [user]);

    const fetchRoster = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/gm/team/${user.teamId}/roster`);
            setRoster(response.data);
        } catch (error) {
            console.error('Failed to fetch roster:', error);
        }
    };

    const fetchNextGame = async () => {
        try {
            // Get active season first
            const seasonsRes = await axios.get(`${API_BASE_URL}/seasons`);
            const activeSeason = seasonsRes.data.find(s => s.isActive);

            if (activeSeason) {
                const gamesRes = await axios.get(`${API_BASE_URL}/gm/team/${user.teamId}/schedule?seasonId=${activeSeason.id}`);
                const now = new Date();
                const upcomingGames = gamesRes.data
                    .filter(g => new Date(g.gameDate.endsWith('Z') ? g.gameDate : g.gameDate + 'Z') > now)
                    .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());

                if (upcomingGames.length > 0) {
                    setNextGame(upcomingGames[0]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch next game:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="gm-dashboard">
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>GM Dashboard</h1>
                <button
                    className="action-button secondary"
                    onClick={() => window.location.href = '/user'}
                    style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#2c3e50',
                        color: 'white',
                        border: '1px solid #4a6fa5',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    My Dashboard
                </button>
            </div>

            <div className="dashboard-grid">
                {/* Roster Section */}
                <div className="dashboard-card roster-card">
                    <h2>Team Roster</h2>
                    {roster.length > 0 ? (
                        <table className="roster-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>Position</th>
                                    <th>Skill</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roster.map(player => (
                                    <tr key={player.id}>
                                        <td>{player.jerseyNumber || '-'}</td>
                                        <td>{player.firstName} {player.lastName}</td>
                                        <td>{player.position || '-'}</td>
                                        <td>{player.skillRating || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="no-data">No players on roster</p>
                    )}
                </div>

                {/* Next Game Section */}
                <div className="dashboard-card next-game-card">
                    <h2>Next Game</h2>
                    {nextGame ? (
                        <div className="game-info">
                            <div className="game-detail">
                                <span className="label">Date:</span>
                                <span className="value">
                                    {new Date(nextGame.gameDate.endsWith('Z') ? nextGame.gameDate : nextGame.gameDate + 'Z').toLocaleDateString()}
                                </span>
                            </div>
                            <div className="game-detail">
                                <span className="label">Time:</span>
                                <span className="value">
                                    {new Date(nextGame.gameDate.endsWith('Z') ? nextGame.gameDate : nextGame.gameDate + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="game-detail">
                                <span className="label">Location:</span>
                                <span className="value">{nextGame.rink}</span>
                            </div>
                            <div className="game-detail">
                                <span className="label">Week:</span>
                                <span className="value">{nextGame.week}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="no-data">No upcoming games scheduled</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GMDashboard;
