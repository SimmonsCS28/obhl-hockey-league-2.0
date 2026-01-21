import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '../services/api';
import './TeamDetails.css';

function TeamDetails({ team: propTeam, onBack }) {
    const { teamId } = useParams();
    const navigate = useNavigate();
    const [team, setTeam] = useState(propTeam);
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
        const fetchTeamData = async () => {
            // If we have a prop team but it doesn't match the URL ID (if present), or no prop team
            const targetId = teamId ? parseInt(teamId) : (propTeam?.id);

            if (!targetId) return;

            setLoading(true);
            try {
                // If we don't have the team data or the ID changed, fetch it
                let currentTeam = propTeam;
                if (!currentTeam || (teamId && currentTeam.id !== parseInt(teamId))) {
                    const teamResponse = await api.getTeam(targetId);
                    currentTeam = teamResponse;
                    setTeam(currentTeam);
                }

                const [teamPlayers, unassignedPlayers] = await Promise.all([
                    api.getPlayers({ teamId: targetId, active: true }),
                    api.getPlayers({ unassigned: true })
                ]);

                setRoster(teamPlayers.sort((a, b) => {
                    const jerseyA = parseInt(a.jerseyNumber) || 999;
                    const jerseyB = parseInt(b.jerseyNumber) || 999;
                    return jerseyA - jerseyB;
                }));
                setFreeAgents(unassignedPlayers);
            } catch (error) {
                console.error('Error loading team details:', error);
                // Only alert if we're not just switching views
                if (teamId) alert('Failed to load team details');
            } finally {
                setLoading(false);
            }
        };

        fetchTeamData();
    }, [teamId, propTeam]);

    // Handle back navigation
    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    // If loading and we don't have basic team info yet
    if (loading && !team) {
        return <div className="loading">Loading team details...</div>;
    }

    if (!team && !loading) return <div className="error">Team not found</div>;

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
            window.location.reload();
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
            window.location.reload();
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
            window.location.reload();
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

    // Helper functions for color handling
    const getValidColor = (color) => {
        if (!color) return '#95a5a6';
        const colorMap = {
            'Lt. Blu': '#87CEEB',
            'Dk. Gre': '#006400',
            'White': '#FFFFFF',
            'Yellow': '#FFD700',
            'Gold': '#FFD700'
        };
        return colorMap[color] || color;
    };

    const getTextColor = (bgColor) => {
        if (!bgColor) return 'white';
        const lightColors = ['White', '#FFFFFF', 'Yellow', '#FFD700', 'Gold', 'Lt. Blu', '#87CEEB', 'LightBlue'];
        const isLight = lightColors.some(c => c.toLowerCase() === bgColor.toLowerCase());
        return isLight ? '#2c3e50' : 'white';
    };

    const bg = getValidColor(team.teamColor);
    const textColor = getTextColor(bg);

    return (
        <div className="team-details">
            <button onClick={handleBack} className="btn-back">
                ← Back
            </button>

            <div className="team-header-colored" style={{ backgroundColor: bg, color: textColor }}>
                <h1>{team.name}</h1>
                <div className="team-stats-display">
                    <div className="stat-item">
                        <span className="stat-label">W</span>
                        <span className="stat-value">{team.wins}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">L</span>
                        <span className="stat-value">{team.losses}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">T</span>
                        <span className="stat-value">{team.ties || 0}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">OTL</span>
                        <span className="stat-value">{team.overtimeLosses || 0}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">GF</span>
                        <span className="stat-value">{team.goalsFor || 0}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">GA</span>
                        <span className="stat-value">{team.goalsAgainst || 0}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">DIFF</span>
                        <span className="stat-value">{(team.goalsFor || 0) - (team.goalsAgainst || 0)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">PTS</span>
                        <span className="stat-value">{team.points}</span>
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
                                    <td>
                                        {player.firstName} {player.lastName}
                                        {team.gmId === player.id && <span className="gm-badge">GM</span>}
                                        {player.skillRating >= 9 && <span className="twogl-badge">2GL</span>}
                                    </td>
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
