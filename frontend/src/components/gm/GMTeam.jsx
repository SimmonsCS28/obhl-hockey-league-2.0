import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './GMTeam.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function GMTeam() {
    const { user } = useAuth();
    const [roster, setRoster] = useState([]);
    const [editedPlayers, setEditedPlayers] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (user?.teamId) {
            fetchRoster();
        }
    }, [user]);

    const fetchRoster = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/gm/team/${user.teamId}/roster`);
            setRoster(response.data);
        } catch (error) {
            showMessage('error', 'Failed to load roster');
        } finally {
            setLoading(false);
        }
    };

    const handleJerseyChange = (playerId, newValue) => {
        setEditedPlayers({
            ...editedPlayers,
            [playerId]: newValue
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = Object.entries(editedPlayers);
            for (const [playerId, jerseyNumber] of updates) {
                await axios.patch(`${API_BASE_URL}/gm/players/${playerId}/jersey`, {
                    jerseyNumber: parseInt(jerseyNumber)
                });
            }

            showMessage('success', 'Jersey numbers updated successfully!');
            setEditedPlayers({});
            await fetchRoster();
        } catch (error) {
            showMessage('error', 'Failed to update jersey numbers');
        } finally {
            setSaving(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="gm-team">
            <div className="team-header">
                <h1>My Team</h1>
                {Object.keys(editedPlayers).length > 0 && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-save"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                )}
            </div>

            {message && (
                <div className={`message message-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="team-roster-card">
                {roster.length > 0 ? (
                    <table className="team-roster-table">
                        <thead>
                            <tr>
                                <th>Jersey #</th>
                                <th>Name</th>
                                <th>Position</th>
                                <th>Email</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roster.map(player => (
                                <tr key={player.id}>
                                    <td>
                                        <input
                                            type="number"
                                            min="0"
                                            max="99"
                                            value={editedPlayers[player.id] ?? player.jerseyNumber ?? ''}
                                            onChange={(e) => handleJerseyChange(player.id, e.target.value)}
                                            className="jersey-input"
                                        />
                                    </td>
                                    <td className="player-name">{player.firstName} {player.lastName}</td>
                                    <td>{player.position || '-'}</td>
                                    <td className="player-email">{player.email || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="no-data">No players on roster</p>
                )}
            </div>
        </div>
    );
}

export default GMTeam;
