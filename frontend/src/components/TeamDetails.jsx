import { useEffect, useState } from 'react';
import * as api from '../services/api';
import './TeamDetails.css';

function TeamDetails({ team, onBack }) {
    const [roster, setRoster] = useState([]);
    const [freeAgents, setFreeAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddPlayer, setShowAddPlayer] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [playerToRemove, setPlayerToRemove] = useState(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [editingPlayerId, setEditingPlayerId] = useState(null);
    const [editedJerseyNumber, setEditedJerseyNumber] = useState('');

    useEffect(() => {
        loadData();
    }, [team.id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [teamPlayers, unassignedPlayers] = await Promise.all([
                api.getPlayers({ teamId: team.id, active: true }),
                api.getPlayers({ unassigned: true })
            ]);
            setRoster(teamPlayers);
            setFreeAgents(unassignedPlayers);
        } catch (error) {
            console.error('Error loading team details:', error);
            alert('Failed to load team details');
        } finally {
            setLoading(false);
        }
    };

    const initiateRemovePlayer = (player) => {
        setPlayerToRemove(player);
        setShowConfirmModal(true);
    };

    const confirmRemovePlayer = async () => {
        if (!playerToRemove) return;

        try {
            // Update player with null teamId
            await api.updatePlayer(playerToRemove.id, {
                ...playerToRemove,
                teamId: null
            });

            setShowConfirmModal(false);
            setPlayerToRemove(null);
            loadData();
        } catch (error) {
            console.error('Error removing player:', error);
            alert('Failed to remove player');
        }
    };

    const cancelRemove = () => {
        setShowConfirmModal(false);
        setPlayerToRemove(null);
    };

    const handleAddPlayer = async () => {
        if (!selectedPlayerId) return;

        try {
            // Get selected player data
            const player = freeAgents.find(p => p.id === parseInt(selectedPlayerId));
            if (!player) return;

            // Update player with new teamId
            await api.updatePlayer(player.id, {
                ...player,
                teamId: team.id
            });

            setShowAddPlayer(false);
            setSelectedPlayerId('');
            loadData();
        } catch (error) {
            console.error('Error adding player:', error);
            alert('Failed to add player');
        }
    };

    const handleEditJersey = (player) => {
        setEditingPlayerId(player.id);
        setEditedJerseyNumber(player.jerseyNumber || '');
    };

    const handleSaveJersey = async (player) => {
        const jerseyNum = editedJerseyNumber === '' ? null : parseInt(editedJerseyNumber);

        // Validate jersey number
        if (jerseyNum !== null && (jerseyNum < 1 || jerseyNum > 99 || isNaN(jerseyNum))) {
            alert('Jersey number must be between 1 and 99');
            return;
        }

        try {
            await api.updatePlayer(player.id, {
                ...player,
                jerseyNumber: jerseyNum
            });
            setEditingPlayerId(null);
            setEditedJerseyNumber('');
            loadData();
        } catch (error) {
            console.error('Error updating jersey number:', error);
            alert('Failed to update jersey number');
        }
    };

    const handleCancelJersey = () => {
        setEditingPlayerId(null);
        setEditedJerseyNumber('');
    };

    if (loading) {
        return <div className="loading">Loading team details...</div>;
    }

    return (
        <div className="team-details">
            <div className="details-header">
                <button onClick={onBack} className="btn-back">
                    ← Back to Teams
                </button>
                <div className="team-info-header">
                    <div className="team-title">
                        <h2 style={{ color: team.teamColor }}>{team.name}</h2>
                        <span className="team-abbr">{team.abbreviation}</span>
                    </div>
                    <div className="team-stats-summary">
                        <div className="stat-item">
                            <span className="label">Wins</span>
                            <span className="value">{team.wins}</span>
                        </div>
                        <div className="stat-item">
                            <span className="label">Losses</span>
                            <span className="value">{team.losses}</span>
                        </div>
                        <div className="stat-item">
                            <span className="label">Points</span>
                            <span className="value">{team.points}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="roster-section">
                <div className="section-header">
                    <h3>Current Roster</h3>
                    <button
                        className="btn-primary"
                        onClick={() => setShowAddPlayer(!showAddPlayer)}
                    >
                        {showAddPlayer ? 'Cancel' : '+ Add Player'}
                    </button>
                </div>

                {showAddPlayer && (
                    <div className="add-player-panel">
                        <h4>Add Free Agent</h4>
                        <div className="add-player-controls">
                            <select
                                value={selectedPlayerId}
                                onChange={(e) => setSelectedPlayerId(e.target.value)}
                                className="player-select"
                            >
                                <option value="">Select a player...</option>
                                {freeAgents.map(player => (
                                    <option key={player.id} value={player.id}>
                                        {player.firstName} {player.lastName} ({player.position})
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleAddPlayer}
                                disabled={!selectedPlayerId}
                                className="btn-confirm"
                            >
                                Add to Team
                            </button>
                        </div>
                        {freeAgents.length === 0 && (
                            <p className="no-agents">No free agents available.</p>
                        )}
                    </div>
                )}

                <table className="roster-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Position</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roster.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="empty-roster">No players on roster</td>
                            </tr>
                        ) : (
                            roster.map(player => (
                                <tr key={player.id}>
                                    <td>
                                        {editingPlayerId === player.id ? (
                                            <div className="jersey-edit">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="99"
                                                    value={editedJerseyNumber}
                                                    onChange={(e) => setEditedJerseyNumber(e.target.value)}
                                                    className="jersey-input"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveJersey(player)}
                                                    className="btn-save-jersey"
                                                    title="Save"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={handleCancelJersey}
                                                    className="btn-cancel-jersey"
                                                    title="Cancel"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                className="jersey-display"
                                                onClick={() => handleEditJersey(player)}
                                                title="Click to edit"
                                            >
                                                {player.jerseyNumber || '-'}
                                            </div>
                                        )}
                                    </td>
                                    <td>{player.firstName} {player.lastName}</td>
                                    <td>{player.position}</td>
                                    <td>
                                        <button
                                            onClick={() => initiateRemovePlayer(player)}
                                            className="btn-remove"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showConfirmModal && (
                <div className="modal-overlay" onClick={cancelRemove}>
                    <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Confirm Removal</h3>
                            <button onClick={cancelRemove} className="modal-close">&times;</button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to remove <strong>{playerToRemove?.firstName} {playerToRemove?.lastName}</strong> from the team?</p>
                            <p className="warning-text">They will become a free agent.</p>
                        </div>
                        <div className="form-actions">
                            <button type="button" onClick={cancelRemove} className="btn-secondary">
                                Cancel
                            </button>
                            <button type="button" onClick={confirmRemovePlayer} className="btn-delete">
                                Remove Player
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeamDetails;
