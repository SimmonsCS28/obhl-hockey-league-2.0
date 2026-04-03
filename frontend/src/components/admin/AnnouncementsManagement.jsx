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

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'clean']
        ]
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
        setShowForm(true);
    };

    const handleEditClick = (ann) => {
        setCurrentAnnouncement(ann);
        setTitle(ann.title);
        setContent(ann.content);
        setIsActive(ann.isActive);
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

        try {
            const payload = {
                title,
                content,
                isActive,
                // In a real app we'd get authorId from the decoded JWT or a context Auth stub
                // but since we need an author name for display, we'll request the user id here if available somewhere.
                // Assuming admin user ID is 1 for now if we can't extract it easily, or null.
                authorId: null,
                authorName: 'Admin'
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
        if (!dateString) return '';
        const d = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
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

                        <div className="form-group checkbox-group">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={isActive} 
                                    onChange={(e) => setIsActive(e.target.checked)} 
                                />
                                Active (Show on Public Home Page)
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
                                    <th>Created At</th>
                                    <th>Last Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {announcements.map(ann => (
                                    <tr key={ann.id} className={!ann.isActive ? 'inactive-row' : ''}>
                                        <td>
                                            <button 
                                                className={`status-toggle ${ann.isActive ? 'active' : 'inactive'}`}
                                                onClick={() => handleToggleActive(ann.id, ann.isActive)}
                                                title={ann.isActive ? 'Click to Deactivate' : 'Click to Activate'}
                                            >
                                                {ann.isActive ? '🟢 Active' : '⚪ Inactive'}
                                            </button>
                                        </td>
                                        <td><strong>{ann.title}</strong></td>
                                        <td>{formatDate(ann.createdAt)}</td>
                                        <td>{formatDate(ann.updatedAt)}</td>
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
