import { useEffect, useState } from 'react';
import * as api from '../services/api';
import './SeasonManagement.css';

function SeasonManagement() {
    const [seasons, setSeasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [seasonToDelete, setSeasonToDelete] = useState(null);
    const [editingSeason, setEditingSeason] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        startDate: '',
        endDate: '',
        status: 'upcoming',
        isActive: false
    });

    useEffect(() => {
        loadSeasons();
    }, []);

    const loadSeasons = async () => {
        try {
            setLoading(true);
            const data = await api.getSeasons();
            setSeasons(data);
        } catch (error) {
            console.error('Error loading seasons:', error);
            alert('Failed to load seasons');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSeason) {
                await api.updateSeason(editingSeason.id, formData);
            } else {
                await api.createSeason(formData);
            }
            setShowModal(false);
            resetForm();
            loadSeasons();
        } catch (error) {
            console.error('Error saving season:', error);
            alert('Failed to save season');
        }
    };

    const handleEdit = (season) => {
        setEditingSeason(season);
        setFormData({
            name: season.name,
            startDate: season.startDate,
            endDate: season.endDate,
            status: season.status,
            isActive: season.isActive
        });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        console.log('handleDelete called with id:', id);
        setSeasonToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        console.log('Proceeding with delete for id:', seasonToDelete);
        try {
            await api.deleteSeason(seasonToDelete);
            console.log('Delete successful, reloading seasons');
            setShowDeleteModal(false);
            setSeasonToDelete(null);
            loadSeasons();
        } catch (error) {
            console.error('Error deleting season:', error);
            alert('Failed to delete season');
        }
    };

    const cancelDelete = () => {
        console.log('Delete cancelled by user');
        setShowDeleteModal(false);
        setSeasonToDelete(null);
    };

    const resetForm = () => {
        setEditingSeason(null);
        setFormData({
            name: '',
            startDate: '',
            endDate: '',
            status: 'upcoming',
            isActive: false
        });
    };

    const handleCloseModal = () => {
        setShowModal(false);
        resetForm();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return '#48bb78';
            case 'completed': return '#718096';
            case 'upcoming': return '#4299e1';
            default: return '#a0aec0';
        }
    };

    if (loading) {
        return <div className="loading">Loading seasons...</div>;
    }

    return (
        <div className="season-management">
            <div className="management-header">
                <h2>Season Management</h2>
                <button onClick={() => setShowModal(true)} className="btn-primary">
                    + Add Season
                </button>
            </div>

            <div className="seasons-grid">
                {seasons.map(season => (
                    <div key={season.id} className="season-card">
                        <div className="season-card-header" style={{ backgroundColor: getStatusColor(season.status) }}>
                            <h3>{season.name}</h3>
                            {season.isActive && <span className="active-badge">ACTIVE</span>}
                        </div>
                        <div className="season-card-body">
                            <div className="season-dates">
                                <div className="date-item">
                                    <span className="date-label">Start Date</span>
                                    <span className="date-value">{new Date(season.startDate).toLocaleDateString()}</span>
                                </div>
                                <div className="date-item">
                                    <span className="date-label">End Date</span>
                                    <span className="date-value">{new Date(season.endDate).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="season-status">
                                <span className={`status-badge ${season.status}`}>
                                    {season.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className="season-card-actions">
                            <button onClick={() => handleEdit(season)} className="btn-edit">
                                Edit
                            </button>
                            <button onClick={() => handleDelete(season.id)} className="btn-delete">
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
                            <h3>{editingSeason ? 'Edit Season' : 'Add New Season'}</h3>
                            <button onClick={handleCloseModal} className="modal-close">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="season-form">
                            <div className="form-group">
                                <label>Season Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="e.g., 2024-2025 Season"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Start Date</label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Date</label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    required
                                >
                                    <option value="upcoming">Upcoming</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    />
                                    Set as Active Season
                                </label>
                            </div>
                            <div className="form-actions">
                                <button type="button" onClick={handleCloseModal} className="btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingSeason ? 'Update' : 'Create'}
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
                            <p>Are you sure you want to delete this season?</p>
                            <p className="warning-text">This action cannot be undone.</p>
                        </div>
                        <div className="form-actions">
                            <button type="button" onClick={cancelDelete} className="btn-secondary">
                                Cancel
                            </button>
                            <button type="button" onClick={confirmDelete} className="btn-delete">
                                Delete Season
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SeasonManagement;
