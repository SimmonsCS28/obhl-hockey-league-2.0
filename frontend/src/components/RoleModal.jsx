import { useEffect, useState } from 'react';
import api from '../services/api';
import './UserManagement.css';

const RoleModal = ({ role, isCreating, onClose }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [systemRoleWarningAccepted, setSystemRoleWarningAccepted] = useState(false);

    useEffect(() => {
        if (role && !isCreating) {
            setFormData({
                name: role.name || '',
                description: role.description || ''
            });
        }
    }, [role, isCreating]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate role name format
        if (!/^[A-Z_]+$/.test(formData.name)) {
            setError('Role name must contain only uppercase letters and underscores');
            return;
        }

        // Check system role warning acceptance
        if (!isCreating && role?.isSystemRole && formData.name !== role.name && !systemRoleWarningAccepted) {
            setError('You must accept the warning to change a system role name');
            return;
        }

        setLoading(true);

        try {
            if (isCreating) {
                await api.createRole({
                    name: formData.name,
                    description: formData.description
                });
            } else {
                await api.updateRole(role.id, {
                    name: formData.name,
                    description: formData.description
                });
            }

            onClose(true); // Role saved successfully
        } catch (err) {
            setError(err.message || 'Failed to save role');
        } finally {
            setLoading(false);
        }
    };

    const isSystemRoleNameChange = !isCreating && role?.isSystemRole && formData.name !== role?.name;

    return (
        <div className="modal-overlay" onClick={() => onClose(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{isCreating ? 'Create New Role' : `Edit Role: ${role?.name}`}</h2>
                    <button className="modal-close" onClick={() => onClose(false)}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="user-form">
                    {error && <div className="form-error">{error}</div>}

                    {isSystemRoleNameChange && (
                        <div className="system-role-warning">
                            <strong>⚠️ WARNING</strong>
                            <p>
                                Changing this system role name may require code changes to avoid breaking functionality.
                                System roles like ADMIN, SCOREKEEPER, etc. are referenced directly in code.
                            </p>
                            <label className="warning-checkbox">
                                <input
                                    type="checkbox"
                                    checked={systemRoleWarningAccepted}
                                    onChange={(e) => setSystemRoleWarningAccepted(e.target.checked)}
                                    disabled={loading}
                                />
                                I understand changing this role may affect functionality
                            </label>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="name">Role Name *</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            disabled={loading}
                            placeholder="EXAMPLE_ROLE"
                        />
                        <small className="field-hint">Uppercase letters and underscores only</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            disabled={loading}
                            rows="3"
                            placeholder="Brief description of this role's purpose"
                        />
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => onClose(false)}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-save"
                            disabled={loading || (isSystemRoleNameChange && !systemRoleWarningAccepted)}
                        >
                            {loading ? 'Saving...' : (isCreating ? 'Create Role' : 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoleModal;
