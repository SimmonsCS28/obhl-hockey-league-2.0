import { useEffect, useState } from 'react';
import * as api from '../services/api';
import { getPlayerStats } from '../services/api';
import './TeamDetails.css';

function TeamDetails({ team, onBack }) {
    const [roster, setRoster] = useState([]);
    const [freeAgents, setFreeAgents] = useState([]);
    const [playerStats, setPlayerStats] = useState({});  // Map of playerId -> stats
    const [loading, setLoading] = useState(true);
    const [showAddPlayer, setShowAddPlayer] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [playerToRemove, setPlayerToRemove] = useState(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [editingPlayerId, setEditingPlayerId] = useState(null);
    const [editedJerseyNumber, setEditedJerseyNumber] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'jersey Number', direction: 'ascending' });

    useEffect(() => {
        loadData();
        fetchPlayerStats();
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

    const fetchPlayerStats = async () => {
        try {
            if (!team.seasonId) return;
            const stats = await getPlayerStats(team.seasonId, team.id);
            // Create a map of playerId -> stats for easy lookup
            const statsMap = {};
            stats.forEach(stat => {
                statsMap[stat.playerId] = stat;
            });
            setPlayerStats(statsMap);
        } catch (error) {
            console.error('Failed to load player stats:', error);
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

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortedRoster = () => {
        return [...roster].sort((a, b) => {
            let aValue, bValue;

            // Handle stats fields
            if (['goals', 'assists', 'points', 'penaltyMinutes'].includes(sortConfig.key)) {
                const aStats = playerStats[a.id] || {};
                const bStats = playerStats[b.id] || {};
                aValue = aStats[sortConfig.key] || 0;
                bValue = bStats[sortConfig.key] || 0;
            } else {
                aValue = a[sortConfig.key];
                bValue = b[sortConfig.key];
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
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
                            <th onClick={() => requestSort('jerseyNumber')} style={{ cursor: 'pointer' }}># {getSortIcon('jerseyNumber')}</th>
                            <th onClick={() => requestSort('lastName')} style={{ cursor: 'pointer' }}>Name{getSortIcon('lastName')}</th>
                            <th onClick={() => requestSort('position')} style={{ cursor: 'pointer' }}>Position{getSortIcon('position')}</th>
                            <th onClick={() => requestSort('goals')} style={{ cursor: 'pointer' }}>G{getSortIcon('goals')}</th>
                            <th onClick={() => requestSort('assists')} style={{ cursor: 'pointer' }}>A{getSortIcon('assists')}</th>
                            <th onClick={() => requestSort('points')} style={{ cursor: 'pointer' }}>P{getSortIcon('points')}</th>
                            <th onClick={() => requestSort('penaltyMinutes')} style={{ cursor: 'pointer' }}>PM{getSortIcon('penaltyMinutes')}</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roster.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="empty-roster">No players on roster</td>
                            </tr>
                        ) : (
                            getSortedRoster().map(player => {
                                const stats = playerStats[player.id] || {};
                                return (
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
                                        <td>{stats.goals || 0}</td>
                                        <td>{stats.assists || 0}</td>
                                        <td>{stats.points || 0}</td>
                                        <td>{stats.penaltyMinutes || 0}</td>
                                        <td>
                                            <button
                                                onClick={() => initiateRemovePlayer(player)}
                                                className="btn-remove"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
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
