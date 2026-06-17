import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './ShiftSignup.css';

/**
 * Referee self-service availability. Refs check the dates they are NOT available;
 * the ref coordinator sees this when proposing shifts. Dates are derived from the
 * season's game days using the same local-date logic as the coordinator board so
 * they line up exactly.
 */
const RefAvailability = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [dates, setDates] = useState([]);
    const [unavailable, setUnavailable] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingDate, setSavingDate] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const seasons = await api.getSeasons();
                const active = seasons.find(s => s.isActive) || seasons[0];
                if (!active) { setLoading(false); return; }
                const [games, mine] = await Promise.all([
                    api.getGames(active.id),
                    api.getMyStaffAvailability('REF'),
                ]);
                const uniqueDates = [...new Set((games || []).map(g => getLocalDateStr(g.gameDate)))].sort();
                setDates(uniqueDates);
                setUnavailable(mine || []);
            } catch {
                setError('Failed to load availability.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const getLocalDateStr = (gameDateStr) => {
        const d = new Date(gameDateStr.endsWith('Z') ? gameDateStr : gameDateStr + 'Z');
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const toggle = async (dateStr) => {
        const currentlyUnavailable = unavailable.includes(dateStr);
        setSavingDate(dateStr);
        setError('');
        try {
            if (currentlyUnavailable) {
                await api.removeStaffUnavailable('REF', dateStr);
                setUnavailable(prev => prev.filter(d => d !== dateStr));
            } else {
                await api.markStaffUnavailable('REF', [dateStr]);
                setUnavailable(prev => [...prev, dateStr]);
            }
        } catch (e) {
            setError(e.message || 'Failed to save. Please try again.');
        } finally {
            setSavingDate(null);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="shift-signup">
            <div className="shift-header">
                <h1>Referee Availability</h1>
                <div className="header-buttons">
                    <button className="back-button" onClick={() => navigate('/user')}>← Back to Dashboard</button>
                    <button className="home-button" onClick={() => navigate('/')}>OBHL Home</button>
                    <button className="logout-button" onClick={() => { logout(); navigate('/'); }}>Logout</button>
                </div>
            </div>

            <div className="availability-section">
                <h2>Mark Your Unavailable Dates</h2>
                <p className="instructions">Check the box next to any date you are NOT available to referee. Changes save automatically.</p>
                {error && <div className="save-error" style={{ color: '#c53030', marginBottom: '1rem' }}>{error}</div>}

                {dates.length === 0 ? (
                    <p>No game dates found for the current season.</p>
                ) : (
                    <table className="availability-table">
                        <thead>
                            <tr>
                                <th>Game Date</th>
                                <th>Unavailable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dates.map(dateStr => {
                                const gameDate = new Date(dateStr + 'T12:00:00');
                                const isUnavailable = unavailable.includes(dateStr);
                                return (
                                    <tr key={dateStr}>
                                        <td>{gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={isUnavailable}
                                                disabled={savingDate === dateStr}
                                                onChange={() => toggle(dateStr)}
                                                className="availability-checkbox"
                                            />
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

export default RefAvailability;
