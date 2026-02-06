import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './ShiftSignup.css';

const GoalieShiftSignup = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [gameDays, setGameDays] = useState([]);
    const [unavailableDates, setUnavailableDates] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [seasonId, setSeasonId] = useState(1); // TODO: Get current season

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [gameDaysRes, availabilityRes, assignmentsRes, profileRes] = await Promise.all([
                api.get(`/shifts/goalie/game-days?seasonId=${seasonId}`),
                api.get('/shifts/goalie/my-availability'),
                api.get('/shifts/goalie/my-assignments'),
                api.get('/shifts/goalie/my-profile')
            ]);

            setGameDays(gameDaysRes.data);
            setUnavailableDates(availabilityRes.data);
            setAssignments(assignmentsRes.data);
            setProfile(profileRes.data);
        } catch (error) {
            console.error('Error fetching goalie data:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleDateAvailability = async (date) => {
        try {
            if (unavailableDates.includes(date)) {
                // Remove from unavailable
                await api.delete(`/shifts/goalie/unavailable/${date}`);
                setUnavailableDates(prev => prev.filter(d => d !== date));
            } else {
                // Mark as unavailable
                await api.post('/shifts/goalie/unavailable', { dates: [date] });
                setUnavailableDates(prev => [...prev, date]);
            }
        } catch (error) {
            console.error('Error updating availability:', error);
            alert('Failed to update availability');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="shift-signup">
            <div className="shift-header">
                <h1>Goalie Availability</h1>
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

            {profile && (
                <div className="goalie-stats">
                    <p>Games Played This Season: {profile.gamesPlayedCurrentSeason || 0}</p>
                </div>
            )}

            <div className="availability-section">
                <h2>Mark Unavailable Dates</h2>
                <p className="instructions">Click on dates you are NOT available to play</p>
                <div className="game-days-grid">
                    {gameDays.map(date => (
                        <div
                            key={date}
                            className={`game-day ${unavailableDates.includes(date) ? 'unavailable' : 'available'}`}
                            onClick={() => toggleDateAvailability(date)}
                        >
                            {new Date(date).toLocaleDateString()}
                        </div>
                    ))}
                </div>
            </div>

            <div className="assignments-section">
                <h2>My Assigned Games</h2>
                {assignments.length > 0 ? (
                    <table className="assignments-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Matchup</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assignments.map(game => (
                                <tr key={game.gameId}>
                                    <td>{new Date(game.gameDate).toLocaleDateString()}</td>
                                    <td>{game.gameTime}</td>
                                    <td>{game.homeTeam} vs {game.awayTeam}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>No games assigned yet</p>
                )}
            </div>
        </div>
    );
};

export default GoalieShiftSignup;
