import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api from '../../services/api';
import './AnnouncementsManagement.css';

function AnnouncementsManagement() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [currentAnnouncement, setCurrentAnnouncement] = useState(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'clean']
        ]
    };

    // Helper: today as YYYY-MM-DD
    const todayStr = () => new Date().toISOString().split('T')[0];

    // Helper: N days from today as YYYY-MM-DD
    const daysFromToday = (n) => {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return d.toISOString().split('T')[0];
    };

    useEffect(() => {
        loadAnnouncements();
    }, []);

    const loadAnnouncements = async () => {
        try {
            setLoading(true);
            const data = await api.getAnnouncements(false); // get all including inactive
            setAnnouncements(data);
        } catch (err) {
            setError(err.message || 'Failed to load announcements');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClick = () => {
        setCurrentAnnouncement(null);
        setTitle('');
        setContent('');
        setIsActive(true);
        setStartDate(todayStr());
        setEndDate(daysFromToday(14));
        setShowForm(true);
    };

    const handleEditClick = (ann) => {
        setCurrentAnnouncement(ann);
        setTitle(ann.title);
        setContent(ann.content);
        setIsActive(ann.isActive);
        setStartDate(ann.startDate || '');
        setEndDate(ann.endDate || '');
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setCurrentAnnouncement(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim() || !content.trim() || content === '<p><br></p>') {
            alert('Title and content are required.');
            return;
        }

        if (startDate && endDate && endDate < startDate) {
            alert('End date must be on or after the start date.');
            return;
        }

        try {
            const payload = {
                title,
                content,
                isActive,
                authorId: null,
                authorName: 'Admin',
                startDate: startDate || null,
                endDate: endDate || null,
            };

            if (currentAnnouncement) {
                await api.updateAnnouncement(currentAnnouncement.id, payload);
            } else {
                await api.createAnnouncement(payload);
            }

            await loadAnnouncements();
            setShowForm(false);
        } catch (err) {
            alert(err.message || 'Failed to save announcement');
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this announcement?')) {
            try {
                await api.deleteAnnouncement(id);
                await loadAnnouncements();
            } catch (err) {
                alert(err.message || 'Failed to delete announcement');
                console.error(err);
            }
        }
    };

    const handleToggleActive = async (id, currentStatus) => {
        try {
            await api.toggleAnnouncementActive(id, !currentStatus);
            await loadAnnouncements();
        } catch (err) {
            alert(err.message || 'Failed to update status');
            console.error(err);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        // Handle both LocalDate (YYYY-MM-DD) and LocalDateTime strings
        const d = new Date(dateString.length === 10 ? dateString + 'T12:00:00' : (dateString.endsWith('Z') ? dateString : dateString + 'Z'));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Determine if an announcement is currently live based on date range
    const isLive = (ann) => {
        if (!ann.isActive) return false;
        const today = todayStr();
        if (ann.startDate && ann.startDate > today) return false;
        if (ann.endDate && ann.endDate < today) return false;
        return true;
    };

    return (
        <div className="announcements-management">
            <div className="management-header">
                <h2>📢 Announcements Management</h2>
                <div className="header-actions">
                    <button onClick={handleAddClick} className="btn-add-announcement">
                        + New Announcement
                    </button>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {showForm && (
                <div className="announcement-form-card">
                    <h3>{currentAnnouncement ? 'Edit Announcement' : 'Create Announcement'}</h3>
                    <form onSubmit={handleSubmit} className="announcement-form">
                        <div className="form-group">
                            <label>Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="E.g., Winter Season Registration Open!"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Content</label>
                            <div className="editor-container">
                                <ReactQuill
                                    theme="snow"
                                    value={content}
                                    onChange={setContent}
                                    modules={modules}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Display Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                <span className="field-hint">Leave blank to show immediately</span>
                            </div>
                            <div className="form-group">
                                <label>Display End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                                <span className="field-hint">Leave blank to show indefinitely</span>
                            </div>
                        </div>

                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                />
                                Active (manual on/off override)
                            </label>
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-save">Save Announcement</button>
                            <button type="button" onClick={handleCancel} className="btn-cancel">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="announcements-table-container">
                    {loading ? (
                        <div className="loading">Loading announcements...</div>
                    ) : announcements.length === 0 ? (
                        <div className="empty-state">No announcements found. Create one to get started!</div>
                    ) : (
                        <table className="announcements-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Title</th>
                                    <th>Start Date</th>
                                    <th>End Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {announcements.map(ann => (
                                    <tr key={ann.id} className={!isLive(ann) ? 'inactive-row' : ''}>
                                        <td>
                                            <button
                                                className={`status-toggle ${isLive(ann) ? 'active' : 'inactive'}`}
                                                onClick={() => handleToggleActive(ann.id, ann.isActive)}
                                                title={ann.isActive ? 'Click to Deactivate' : 'Click to Activate'}
                                            >
                                                {isLive(ann) ? '🟢 Live' : ann.isActive ? '🟡 Scheduled' : '⚪ Inactive'}
                                            </button>
                                        </td>
                                        <td><strong>{ann.title}</strong></td>
                                        <td>{formatDate(ann.startDate)}</td>
                                        <td>{formatDate(ann.endDate)}</td>
                                        <td className="actions-cell">
                                            <button onClick={() => handleEditClick(ann)} className="btn-edit-small">Edit</button>
                                            <button onClick={() => handleDelete(ann.id)} className="btn-delete-small">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

export default AnnouncementsManagement;
