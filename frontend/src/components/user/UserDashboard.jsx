import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './UserDashboard.css';

const UserDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [shifts, setShifts] = useState([]);
    const [teams, setTeams] = useState([]);

    const loadData = async () => {
        try {
            const [shiftsData, teamsData] = await Promise.all([
                api.getMyShifts(),
                api.getTeams()
            ]);
            setShifts(shiftsData);
            setTeams(teamsData);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDropShift = async (shift) => {
        if (!window.confirm(`Are you sure you want to drop your ${shift.role} shift for ${shift.homeTeam} vs ${shift.awayTeam}?`)) {
            return;
        }

        try {
            if (shift.role === 'SCOREKEEPER') {
                await api.updateGame(shift.gameId, { scorekeeperId: -1 });
            } else if (shift.role === 'REF') {
                // Fetch game to find which ref slot I am
                const game = await api.getGame(shift.gameId);
                const updateData = {};
                if (game.referee1Id === user.id) {
                    updateData.referee1Id = null;
                } else if (game.referee2Id === user.id) {
                    updateData.referee2Id = null;
                } else {
                    alert('Could not find your assignment for this game. You might have already been removed.');
                    loadData(); // Refresh anyway
                    return;
                }
                await api.updateGame(shift.gameId, updateData);
            } else {
                alert('Cannot drop this type of shift directly. Please contact the administrator.');
                return;
            }

            await loadData(); // Refresh list
        } catch (error) {
            console.error('Failed to drop shift:', error);
            alert('Failed to drop shift. Please try again.');
        }
    };

    const hasRole = (roleName) => {
        return user?.roles?.includes(roleName);
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Helper to get valid CSS color
    const getValidColor = (color) => {
        if (!color) return '#95a5a6';

        // Map truncated DB values to valid CSS colors
        const colorMap = {
            'Lt. Blu': '#87CEEB', // SkyBlue
            'Dk. Gre': '#006400', // DarkGreen
            'White': '#FFFFFF',
            'Yellow': '#FFD700',
            'Gold': '#FFD700'
        };

        return colorMap[color] || color;
    };

    // Helper to determine text color based on background
    const getTextColor = (bgColor) => {
        if (!bgColor) return 'white';

        const lightColors = [
            'White', '#FFFFFF',
            'Yellow', '#FFD700',
            'Gold',
            'Lt. Blu', '#87CEEB', 'LightBlue'
        ];

        // Check if color is in light list (case insensitive)
        const isLight = lightColors.some(c =>
            c.toLowerCase() === bgColor.toLowerCase()
        );

        return isLight ? '#2c3e50' : 'white';
    };

    const getTeamByName = (name) => {
        return teams.find(t => t.name === name);
    };

    const formatGameTime = (dateStr, timeStr) => {
        if (!dateStr || !timeStr) return '-';

        try {
            // Append Z to force UTC interpretation, allowing proper conversion to local/CST
            const utcDate = new Date(`${dateStr}T${timeStr}Z`);
            return utcDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'America/Chicago' // Force Chicago time display
            });
        } catch (e) {
            return timeStr;
        }
    };

    return (
        <div className="user-dashboard">
            <div className="dashboard-header">
                <h1>My Shifts Dashboard</h1>
                <div className="header-buttons">
                    <button
                        className="home-button"
                        onClick={() => navigate('/')}
                    >
                        OBHL Home
                    </button>
                    <button
                        className="logout-button"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Dashboard Stats / Summary can go here */}

            <div className="dashboard-content">
                <section className="upcoming-shifts-section">
                    <h2>My Upcoming Shifts</h2>
                    {shifts.length > 0 ? (
                        <div className="shifts-table-container">
                            <table className="shifts-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Time</th>
                                        <th>Role</th>
                                        <th>Game</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shifts.map((shift, index) => {
                                        const homeTeam = getTeamByName(shift.homeTeam);
                                        const awayTeam = getTeamByName(shift.awayTeam);
                                        const homeBg = getValidColor(homeTeam?.teamColor);
                                        const awayBg = getValidColor(awayTeam?.teamColor);

                                        return (
                                            <tr key={index}>
                                                <td>{new Date(shift.gameDate).toLocaleDateString()}</td>
                                                <td>{formatGameTime(shift.gameDate, shift.gameTime)}</td>
                                                <td>
                                                    <span className={`role-badge ${shift.role.toLowerCase()}`}>
                                                        {shift.role}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="game-teams-cell">
                                                        <span
                                                            className="team-pill pointer"
                                                            onClick={() => homeTeam && navigate(`/teams/${homeTeam.id}`)}
                                                            title="View Team Page"
                                                            style={{
                                                                backgroundColor: homeBg,
                                                                color: getTextColor(homeBg),
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {shift.homeTeam}
                                                        </span>
                                                        <span className="vs">vs</span>
                                                        <span
                                                            className="team-pill pointer"
                                                            onClick={() => awayTeam && navigate(`/teams/${awayTeam.id}`)}
                                                            title="View Team Page"
                                                            style={{
                                                                backgroundColor: awayBg,
                                                                color: getTextColor(awayBg),
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {shift.awayTeam}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {shift.role === 'SCOREKEEPER' && (
                                                        <button
                                                            className="score-game-btn"
                                                            onClick={() => navigate(`/scorekeeper/game/${shift.gameId}`)}
                                                            title="Enter game scores"
                                                        >
                                                            Score Game
                                                        </button>
                                                    )}

                                                    {shift.role !== 'GOALIE' && (
                                                        <button
                                                            className="drop-shift-btn"
                                                            onClick={() => handleDropShift(shift)}
                                                            title="Drop this shift"
                                                        >
                                                            Drop Shift
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="no-shifts-message">No upcoming shifts assigned.</p>
                    )}
                </section>

                <div className="role-cards">
                    {hasRole('GOALIE') && (
                        <div className="role-card">
                            <h2>Goalie</h2>
                            <p>Manage your goalie availability for upcoming games</p>
                            <button onClick={() => navigate('/user/goalie')}>
                                Manage Availability
                            </button>
                        </div>
                    )}

                    {hasRole('REF') && (
                        <div className="role-card">
                            <h2>Referee</h2>
                            <p>View and sign up for referee shifts</p>
                            <button onClick={() => navigate('/user/referee')}>
                                View & Sign Up for Shifts
                            </button>
                        </div>
                    )}

                    {hasRole('SCOREKEEPER') && (
                        <div className="role-card">
                            <h2>Scorekeeper</h2>
                            <p>View and sign up for scorekeeper shifts</p>
                            <button onClick={() => navigate('/user/scorekeeper')}>
                                View & Sign Up for Shifts
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;
