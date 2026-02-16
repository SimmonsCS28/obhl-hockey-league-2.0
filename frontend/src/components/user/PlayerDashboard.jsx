import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './PlayerDashboard.css'; // Will create this next

const PlayerDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const data = await api.getPlayerDashboard();
                setDashboardData(data);
            } catch (err) {
                console.error("Failed to fetch dashboard:", err);
                setError("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    if (loading) return <div className="loading-container">Loading dashboard...</div>;
    if (error) return <div className="error-container">{error}</div>;

    const { team, record, nextGame, schedule } = dashboardData || {};

    const hasStaffRole = user?.roles?.some(role =>
        ['REF', 'GOALIE', 'SCOREKEEPER'].includes(role)
    );

    const formatTime = (dateStr, timeStr) => {
        if (!dateStr) return '';
        // Combine date and time if needed, or just use dateStr if it's ISO
        // Assuming dateStr is YYYY-MM-DD and timeStr is HH:mm:ss
        const dateTime = new Date(`${dateStr}T${timeStr || '00:00'}`);
        return dateTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div className="player-dashboard">
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Welcome, {user?.firstName}</h1>
                    <div className="header-actions">
                        {hasStaffRole && (
                            <button
                                className="action-button secondary"
                                onClick={() => navigate('/user/shifts')}
                            >
                                My Shifts
                            </button>
                        )}
                        <button className="action-button logout" onClick={logout}>Logout</button>
                    </div>
                </div>
            </header>

            <div className="dashboard-grid">
                {/* Team Card */}
                <div className="dashboard-card team-card">
                    {team ? (
                        <>
                            <div className="team-header">
                                <h2>My Team</h2>
                                <span className="team-name" onClick={() => navigate(`/teams/${team.id}`)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                                    {team.name}
                                </span>
                            </div>
                            <div className="team-stats">
                                <div className="stat-box">
                                    <span className="stat-value">{record?.wins || 0}</span>
                                    <span className="stat-label">Wins</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-value">{record?.losses || 0}</span>
                                    <span className="stat-label">Losses</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-value">{record?.ties || 0}</span>
                                    <span className="stat-label">Ties</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-value">{record?.otLosses || 0}</span>
                                    <span className="stat-label">OTL</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="no-team">
                            <h2>No Team Assigned</h2>
                            <p>You are not currently assigned to a team for the active season.</p>
                        </div>
                    )}
                </div>

                {/* Next Game Callout */}
                <div className="dashboard-card next-game-card">
                    <h2>Next Game</h2>
                    {nextGame ? (
                        <div className="next-game-details">
                            <div className="game-date">
                                <span className="date">{formatDate(nextGame.gameDate)}</span>
                                <span className="time">{formatTime(nextGame.gameDate, nextGame.gameTime)}</span>
                            </div>
                            <div className="game-matchup">
                                <span className="vs">vs</span>
                                <span className="opponent">
                                    {nextGame.homeTeamId === team?.id ? nextGame.awayTeamName : nextGame.homeTeamName}
                                </span>
                            </div>
                            <div className="game-location">
                                <span>{nextGame.rinkName || 'TBD'}</span>
                            </div>
                        </div>
                    ) : (
                        <p>No upcoming games scheduled.</p>
                    )}
                </div>

                {/* Schedule List */}
                <div className="dashboard-card schedule-card full-width">
                    <h2>Season Schedule</h2>
                    <div className="schedule-list">
                        {schedule && schedule.length > 0 ? (
                            <table className="schedule-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Time</th>
                                        <th>Opponent</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedule.map(game => {
                                        const isHome = game.homeTeamId === team?.id;
                                        const opponentName = isHome ? game.awayTeamName : game.homeTeamName;
                                        const opponentId = isHome ? game.awayTeamId : game.homeTeamId;

                                        let result = '-';
                                        if (game.status === 'COMPLETED') {
                                            const myScore = isHome ? game.homeScore : game.awayScore;
                                            const oppScore = isHome ? game.awayScore : game.homeScore;
                                            const wl = myScore > oppScore ? 'W' : (myScore < oppScore ? 'L' : 'T');
                                            result = `${wl} ${myScore}-${oppScore}`;
                                            if (game.endedInOT) result += ' (OT)';
                                        }

                                        return (
                                            <tr key={game.id}>
                                                <td>{formatDate(game.gameDate)}</td>
                                                <td>{formatTime(game.gameDate, game.gameTime)}</td>
                                                <td>
                                                    <span
                                                        className="opponent-link"
                                                        onClick={() => navigate(`/teams/${opponentId}`)}
                                                    >
                                                        {opponentName}
                                                    </span>
                                                </td>
                                                <td><span className={`result p-tag ${result.startsWith('W') ? 'win' : result.startsWith('L') ? 'loss' : ''}`}>{result}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p>No games found for this season.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerDashboard;
