import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './ShiftSignup.css';

const GoalieShiftSignup = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [gameDays, setGameDays] = useState([]);
    const [initialUnavailableDates, setInitialUnavailableDates] = useState([]);
    const [currentUnavailableDates, setCurrentUnavailableDates] = useState([]);
    const [myAssignments, setMyAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [seasonId, setSeasonId] = useState(null);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    // Browser beforeunload warning
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [currentUnavailableDates, initialUnavailableDates]);

    const fetchData = async () => {
        try {
            // First get the active season
            const seasons = await api.getSeasons();
            const activeSeason = seasons.find(s => s.isActive) || seasons[0];

            if (!activeSeason) {
                console.error('No active season found');
                setLoading(false);
                return;
            }

            setSeasonId(activeSeason.id);

            setSeasonId(activeSeason.id);

            const [gameDaysRes, availabilityRes, assignmentsRes] = await Promise.all([
                api.get(`/shifts/goalie/game-days?seasonId=${activeSeason.id}`),
                api.get('/shifts/goalie/my-availability'),
                api.getMyAssignments()
            ]);

            setGameDays(gameDaysRes);
            const unavailable = availabilityRes || [];
            setInitialUnavailableDates(unavailable);
            setCurrentUnavailableDates(unavailable);
            setMyAssignments(assignmentsRes || []);
        } catch (error) {
            console.error('Error fetching goalie data:', error);
        } finally {
            setLoading(false);
        }
    };

    const hasUnsavedChanges = useCallback(() => {
        const initial = new Set(initialUnavailableDates);
        const current = new Set(currentUnavailableDates);

        if (initial.size !== current.size) return true;

        for (const date of current) {
            if (!initial.has(date)) return true;
        }

        return false;
    }, [initialUnavailableDates, currentUnavailableDates]);

    const getUnsavedChangesList = () => {
        const initial = new Set(initialUnavailableDates);
        const current = new Set(currentUnavailableDates);
        const changes = [];

        // Find newly checked (unavailable)
        for (const date of current) {
            if (!initial.has(date)) {
                changes.push({
                    date,
                    action: 'marked unavailable'
                });
            }
        }

        // Find newly unchecked (available)
        for (const date of initial) {
            if (!current.has(date)) {
                changes.push({
                    date,
                    action: 'marked available'
                });
            }
        }

        return changes;
    };

    const handleCheckboxChange = (date) => {
        setCurrentUnavailableDates(prev => {
            if (prev.includes(date)) {
                return prev.filter(d => d !== date);
            } else {
                return [...prev, date];
            }
        });
        setSaveSuccess(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveSuccess(false);

        try {
            const initial = new Set(initialUnavailableDates);
            const current = new Set(currentUnavailableDates);

            // Dates to mark as unavailable (newly checked)
            const toAdd = [...current].filter(date => !initial.has(date));

            // Dates to mark as available (newly unchecked)
            const toRemove = [...initial].filter(date => !current.has(date));

            // Execute all changes
            await Promise.all([
                ...toAdd.map(date => api.post('/shifts/goalie/unavailable', { dates: [date] })),
                ...toRemove.map(date => api.delete(`/shifts/goalie/unavailable/${date}`))
            ]);

            // Update initial state to match current
            setInitialUnavailableDates([...currentUnavailableDates]);
            setSaveSuccess(true);

            // Hide success message after 3 seconds
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Error saving availability:', error);
            alert('Failed to save availability. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleNavigationClick = (navigationFn) => {
        if (hasUnsavedChanges()) {
            setPendingNavigation(() => navigationFn);
            setShowUnsavedModal(true);
        } else {
            navigationFn();
        }
    };

    const handleSaveAndContinue = async () => {
        await handleSave();
        setShowUnsavedModal(false);
        if (pendingNavigation) {
            pendingNavigation();
        }
    };

    const handleDiscardAndContinue = () => {
        setShowUnsavedModal(false);
        if (pendingNavigation) {
            pendingNavigation();
        }
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="shift-signup">
            <div className="shift-header">
                <h1>Goalie Availability</h1>
                <div className="header-buttons">
                    <button
                        className="back-button"
                        onClick={() => handleNavigationClick(() => navigate('/user'))}
                    >
                        ← Back to Dashboard
                    </button>
                    <button
                        className="home-button"
                        onClick={() => handleNavigationClick(() => navigate('/'))}
                    >
                        OBHL Home
                    </button>
                    <button
                        className="logout-button"
                        onClick={() => handleNavigationClick(() => { logout(); navigate('/'); })}
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="availability-section">
                <h2>Mark Your Unavailable Dates</h2>
                <p className="instructions">Check the box next to any date you are NOT available to play</p>

                <table className="availability-table">
                    <thead>
                        <tr>
                            <th>Game Date</th>
                            <th>Unavailable</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gameDays.map(day => {
                            const dateStr = day.date;
                            const gameDate = new Date(dateStr);
                            const isUnavailable = currentUnavailableDates.includes(dateStr);

                            return (
                                <tr key={dateStr}>
                                    <td>
                                        {gameDate.toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                        {day.gamesCount && <span className="game-count" style={{ marginLeft: '10px', fontSize: '0.8em', color: '#666' }}>({day.gamesCount} games)</span>}
                                    </td>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={isUnavailable}
                                            onChange={() => handleCheckboxChange(dateStr)}
                                            className="availability-checkbox"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* My Assignments Section */}
                {myAssignments.length > 0 && (
                    <div className="assignments-section" style={{ marginTop: '30px' }}>
                        <h2>My Upcoming Assignments</h2>
                        <table className="availability-table assignments-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Game Time</th>
                                    <th>Matchup</th>
                                    <th>Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myAssignments.map((assignment, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            {new Date(assignment.gameDate).toLocaleDateString('en-US', {
                                                weekday: 'short', month: 'short', day: 'numeric'
                                            })}
                                        </td>
                                        <td>{assignment.gameTime}</td>
                                        <td>{assignment.homeTeam} vs {assignment.awayTeam}</td>
                                        <td>{assignment.role}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="save-section">
                    <button
                        className="save-button"
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges() || saving}
                    >
                        {saving ? 'Saving...' : 'Save Availability'}
                    </button>
                    {saveSuccess && (
                        <div className="save-success">
                            ✓ Availability saved successfully!
                        </div>
                    )}
                </div>
            </div>

            {/* Unsaved Changes Modal */}
            {showUnsavedModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Unsaved Changes</h3>
                        <p>You have unsaved changes to your availability:</p>
                        <ul className="changes-list">
                            {getUnsavedChangesList().map((change, idx) => (
                                <li key={idx}>
                                    {new Date(change.date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })} - {change.action}
                                </li>
                            ))}
                        </ul>
                        <p>Would you like to save these changes?</p>
                        <div className="modal-buttons">
                            <button
                                className="save-continue-button"
                                onClick={handleSaveAndContinue}
                            >
                                Save & Continue
                            </button>
                            <button
                                className="discard-continue-button"
                                onClick={handleDiscardAndContinue}
                            >
                                Discard & Continue
                            </button>
                            <button
                                className="cancel-modal-button"
                                onClick={() => setShowUnsavedModal(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoalieShiftSignup;
