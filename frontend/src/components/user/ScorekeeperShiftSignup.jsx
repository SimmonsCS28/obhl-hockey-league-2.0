import { useEffect, useState } from 'react';
import api from '../services/api';
import './ShiftSignup.css';

const ScorekeeperShiftSignup = () => {
    const [availableGames, setAvailableGames] = useState([]);
    const [myShifts, setMyShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [seasonId, setSeasonId] = useState(1); // TODO: Get current season

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [availableRes, shiftsRes] = await Promise.all([
                api.get(`/shifts/scorekeeper/available?seasonId=${seasonId}`),
                api.get('/shifts/scorekeeper/my-assignments')
            ]);

            setAvailableGames(availableRes.data);
            setMyShifts(shiftsRes.data);
        } catch (error) {
            console.error('Error fetching scorekeeper data:', error);
        } finally {
            setLoading(false);
        }
    };

    const signUpForShift = async (gameId) => {
        try {
            await api.post(`/shifts/scorekeeper/${gameId}`);
            alert('Successfully signed up for shift!');
            fetchData();
        } catch (error) {
            console.error('Error signing up:', error);
            alert('Failed to sign up for shift');
        }
    };

    const cancelShift = async (gameId) => {
        if (!window.confirm('Are you sure you want to cancel this shift?')) return;

        try {
            await api.delete(`/shifts/scorekeeper/${gameId}`);
            alert('Shift cancelled successfully');
            fetchData();
        } catch (error) {
            console.error('Error cancelling shift:', error);
            alert('Failed to cancel shift');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="shift-signup">
            <h1>Scorekeeper Shift Signup</h1>

            <div className="my-shifts-section">
                <h2>My Assigned Shifts</h2>
                {myShifts.length > 0 ? (
                    <table className="shifts-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Matchup</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myShifts.map(game => (
                                <tr key={game.gameId}>
                                    <td>{new Date(game.gameDate).toLocaleDateString()}</td>
                                    <td>{game.gameTime}</td>
                                    <td>{game.homeTeam} vs {game.awayTeam}</td>
                                    <td>
                                        <button onClick={() => cancelShift(game.gameId)} className="cancel-btn">
                                            Cancel
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>No shifts assigned yet</p>
                )}
            </div>

            <div className="available-shifts-section">
                <h2>Available Shifts</h2>
                {availableGames.length > 0 ? (
                    <table className="shifts-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Matchup</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {availableGames.map(game => (
                                <tr key={game.id}>
                                    <td>{new Date(game.gameDate).toLocaleDateString()}</td>
                                    <td>{new Date(game.gameDate).toLocaleTimeString()}</td>
                                    <td>{game.homeTeam} vs {game.awayTeam}</td>
                                    <td>
                                        <button onClick={() => signUpForShift(game.id)} className="signup-btn">
                                            Sign Up
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>No available shifts at this time</p>
                )}
            </div>
        </div>
    );
};

export default ScorekeeperShiftSignup;
