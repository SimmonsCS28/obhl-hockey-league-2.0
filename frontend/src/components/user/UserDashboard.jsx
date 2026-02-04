import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './UserDashboard.css';

const UserDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMyShifts();
    }, []);

    const fetchMyShifts = async () => {
        try {
            const response = await api.get('/shifts/my-shifts');
            setShifts(response.data);
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
            setLoading(false);
        }
    };

    const hasRole = (roleName) => {
        return user?.roles?.includes(roleName);
    };

    const getUpcomingShifts = (role) => {
        return shifts
            .filter(shift => shift.role === role)
            .filter(shift => new Date(shift.gameDate) >= new Date())
            .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate))
            .slice(0, 3);
    };

    return (
        <div className="user-dashboard">
            <h1>My Shifts Dashboard</h1>

            <div className="role-cards">
                {hasRole('GOALIE') && (
                    <div className="role-card">
                        <h2>Goalie</h2>
                        <button onClick={() => navigate('/user/goalie')}>
                            Manage Availability
                        </button>
                        <div className="upcoming-shifts">
                            <h3>Upcoming Games</h3>
                            {getUpcomingShifts('GOALIE').length > 0 ? (
                                <ul>
                                    {getUpcomingShifts('GOALIE').map(shift => (
                                        <li key={shift.gameId}>
                                            {new Date(shift.gameDate).toLocaleDateString()} - {shift.homeTeam} vs {shift.awayTeam}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No upcoming games assigned</p>
                            )}
                        </div>
                    </div>
                )}

                {hasRole('REF') && (
                    <div className="role-card">
                        <h2>Referee</h2>
                        <button onClick={() => navigate('/user/referee')}>
                            View & Sign Up for Shifts
                        </button>
                        <div className="upcoming-shifts">
                            <h3>Upcoming Shifts</h3>
                            {getUpcomingShifts('REF').length > 0 ? (
                                <ul>
                                    {getUpcomingShifts('REF').map(shift => (
                                        <li key={shift.gameId}>
                                            {new Date(shift.gameDate).toLocaleDateString()} - {shift.homeTeam} vs {shift.awayTeam}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No upcoming shifts</p>
                            )}
                        </div>
                    </div>
                )}

                {hasRole('SCOREKEEPER') && (
                    <div className="role-card">
                        <h2>Scorekeeper</h2>
                        <button onClick={() => navigate('/user/scorekeeper')}>
                            View & Sign Up for Shifts
                        </button>
                        <div className="upcoming-shifts">
                            <h3>Upcoming Shifts</h3>
                            {getUpcomingShifts('SCOREKEEPER').length > 0 ? (
                                <ul>
                                    {getUpcomingShifts('SCOREKEEPER').map(shift => (
                                        <li key={shift.gameId}>
                                            {new Date(shift.gameDate).toLocaleDateString()} - {shift.homeTeam} vs {shift.awayTeam}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>No upcoming shifts</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {loading && <p>Loading shifts...</p>}
        </div>
    );
};

export default UserDashboard;
