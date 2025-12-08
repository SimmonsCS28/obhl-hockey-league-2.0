import { useEffect, useState } from 'react';
import * as api from '../services/api';
import TeamDetails from './TeamDetails';
import './TeamManagement.css';

function TeamManagement() {
    const [teams, setTeams] = useState([]);
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState('all');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [teamToDelete, setTeamToDelete] = useState(null);
    const [editingTeam, setEditingTeam] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null); // New state for details view
    const [formData, setFormData] = useState({
        name: '',
        abbreviation: '',
        teamColor: '#003E7E',
        seasonId: '',
        active: true
    });

    useEffect(() => {
        loadTeams();
    }, []);

    const loadTeams = async () => {
        try {
            setLoading(true);
            const [teamsData, seasonsData] = await Promise.all([
                api.getTeams(),
                api.getSeasons()
            ]);
            setTeams(teamsData);
            setSeasons(seasonsData);
        } catch (error) {
            console.error('Error loading teams:', error);
            alert('Failed to load teams');
        } finally {
            setLoading(false);
        }
    };

    const filteredTeams = selectedSeason === 'all'
        ? teams
        : teams.filter(team => team.seasonId === parseInt(selectedSeason));

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingTeam) {
                await api.updateTeam(editingTeam.id, formData);
            } else {
                await api.createTeam(formData);
            }
            setShowModal(false);
            resetForm();
            loadTeams();
        } catch (error) {
            console.error('Error saving team:', error);
            const message = error.message || 'Failed to save team';
            alert(message);
        }
    };

    const handleEdit = (team) => {
        setEditingTeam(team);
        setFormData({
            name: team.name,
            abbreviation: team.abbreviation,
            teamColor: team.teamColor || '#003E7E',
            seasonId: team.seasonId || '',
            active: team.active
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        setTeamToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            await api.deleteTeam(teamToDelete);
            setShowDeleteModal(false);
            setTeamToDelete(null);
            loadTeams();
        } catch (error) {
            console.error('Error deleting team:', error);
            alert('Failed to delete team');
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setTeamToDelete(null);
    };

    const resetForm = () => {
        setEditingTeam(null);
        setFormData({
            name: '',
            abbreviation: '',
            teamColor: '#003E7E',
            seasonId: '',
            active: true
        });
    };

    const handleCloseModal = () => {
        setShowModal(false);
        resetForm();
    };

    if (loading) {
        return <div className="loading">Loading teams...</div>;
    }

    // Render Team Details View
    if (selectedTeam) {
        return (
            <TeamDetails
                team={selectedTeam}
                onBack={() => {
                    setSelectedTeam(null);
                    loadData(); // Refresh data when returning
                }}
            />
        );
    }

    return (
        <div className="team-management">
            <div className="management-header">
                <h2>Team Management</h2>
                <div className="header-actions">
                    <select
                        value={selectedSeason}
                        onChange={(e) => setSelectedSeason(e.target.value)}
                        className="season-filter"
                    >
                        <option value="all">All Seasons</option>
                        {seasons.map(season => (
                            <option key={season.id} value={season.id}>
                                {season.name}
                            </option>
                        ))}
                    </select>
                    <button onClick={() => setShowModal(true)} className="btn-primary">
                        + Add Team
                    </button>
                </div>
            </div>

            <div className="teams-grid">
                {filteredTeams.map(team => (
                    <div key={team.id} className="team-card">
                        <div
                            className="team-card-header"
                            style={{ backgroundColor: team.teamColor || '#003E7E', cursor: 'pointer' }}
                            onClick={() => setSelectedTeam(team)}
                            title="Click to view details"
                        >
                            <h3>{team.abbreviation}</h3>
                        </div>
                        <div className="team-card-body">
                            <h4>{team.name}</h4>
                            <div className="team-stats">
                                <div className="stat">
                                    <span className="stat-label">W-L-T</span>
                                    <span className="stat-value">
                                        {team.wins}-{team.losses}-{team.ties}
                                    </span>
                                </div>
                                <div className="stat">
                                    <span className="stat-label">Points</span>
                                    <span className="stat-value">{team.points}</span>
                                </div>
                            </div>
                            <div className="team-status">
                                <span className={`status-badge ${team.active ? 'active' : 'inactive'}`}>
                                    {team.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                        <div className="team-card-actions">
                            <button onClick={() => handleEdit(team)} className="btn-edit">
                                Edit
                            </button>
                            <button onClick={() => handleDelete(team.id)} className="btn-delete">
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingTeam ? 'Edit Team' : 'Add New Team'}</h3>
                            <button onClick={handleCloseModal} className="modal-close">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="team-form">
                            <div className="form-group">
                                <label>Team Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="e.g., Toronto Maple Leafs"
                                />
                            </div>
                            <div className="form-group">
                                <label>Abbreviation</label>
                                <input
                                    type="text"
                                    value={formData.abbreviation}
                                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                                    required
                                    maxLength="3"
                                    placeholder="e.g., TOR"
                                />
                            </div>
                            <div className="form-group">
                                <label>Season</label>
                                <select
                                    value={formData.seasonId}
                                    onChange={(e) => setFormData({ ...formData, seasonId: e.target.value })}
                                    required
                                >
                                    <option value="">Select a season</option>
                                    {seasons.map(season => (
                                        <option key={season.id} value={season.id}>
                                            {season.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Team Color</label>
                                <input
                                    type="color"
                                    value={formData.teamColor}
                                    onChange={(e) => setFormData({ ...formData, teamColor: e.target.value })}
                                />
                            </div>
                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.active}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                    />
                                    Active
                                </label>
                            </div>
                            <div className="form-actions">
                                <button type="button" onClick={handleCloseModal} className="btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingTeam ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDeleteModal && (
                <div className="modal-overlay" onClick={cancelDelete}>
                    <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Confirm Delete</h3>
                            <button onClick={cancelDelete} className="modal-close">&times;</button>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete this team?</p>
                            <p className="warning-text">This action cannot be undone.</p>
                        </div>
                        <div className="form-actions">
                            <button type="button" onClick={cancelDelete} className="btn-secondary">
                                Cancel
                            </button>
                            <button type="button" onClick={confirmDelete} className="btn-delete">
                                Delete Team
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeamManagement;
