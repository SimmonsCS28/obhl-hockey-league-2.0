import { useEffect, useState } from 'react';
import api from '../services/api';
import RoleModal from './RoleModal';
import './UserManagement.css';

const RoleManagement = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedRole, setSelectedRole] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState(null);

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getRoles();
            setRoles(data);
        } catch (err) {
            setError(err.message || 'Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRole = () => {
        setSelectedRole(null);
        setIsCreating(true);
        setShowModal(true);
    };

    const handleEditRole = (role) => {
        setSelectedRole(role);
        setIsCreating(false);
        setShowModal(true);
    };

    const handleDeleteRole = async (role) => {
        console.log('Delete clicked for role:', role);

        if (role.isSystemRole) {
            alert('Cannot delete system roles');
            return;
        }

        if (role.userCount > 0) {
            alert(`Cannot delete role "${role.name}". ${role.userCount} user(s) currently have this role.`);
            return;
        }

        // Show custom confirmation modal instead of window.confirm
        setRoleToDelete(role);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        const role = roleToDelete;
        setShowDeleteConfirm(false);
        setRoleToDelete(null);

        console.log('Attempting to delete role ID:', role.id);
        try {
            await api.deleteRole(role.id);
            console.log('Delete successful, reloading roles');
            await loadRoles();
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete role: ' + err.message);
        }
    };

    const cancelDelete = () => {
        console.log('User cancelled delete');
        setShowDeleteConfirm(false);
        setRoleToDelete(null);
    };

    const handleModalClose = (roleSaved) => {
        setShowModal(false);
        setSelectedRole(null);
        setIsCreating(false);
        if (roleSaved) {
            loadRoles();
        }
    };

    if (loading) {
        return <div className="user-management-loading">Loading roles...</div>;
    }

    if (error) {
        return <div className="user-management-error">Error: {error}</div>;
    }

    return (
        <>
            <div className="tab-header">
                <button className="btn-create-user" onClick={handleCreateRole}>
                    + Create Role
                </button>
            </div>

            <div className="users-table-container">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>Role Name</th>
                            <th>Description</th>
                            <th>Users</th>
                            <th>Type</th>
                            <th>Created By</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="no-users">
                                    No roles found
                                </td>
                            </tr>
                        ) : (
                            roles.map(role => (
                                <tr key={role.id}>
                                    <td className="username-col">{role.name}</td>
                                    <td>{role.description || '-'}</td>
                                    <td>
                                        <span className="user-count-badge">
                                            {role.userCount}
                                        </span>
                                    </td>
                                    <td>
                                        {role.isSystemRole ? (
                                            <span className="role-badge role-system">
                                                System Role
                                            </span>
                                        ) : (
                                            <span className="role-badge role-custom">
                                                Custom
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {role.createdBy || <span style={{ color: '#9ca3af' }}>N/A</span>}
                                    </td>
                                    <td>{new Date(role.createdAt).toLocaleDateString()}</td>
                                    <td className="actions-col">
                                        <button
                                            className="btn-edit"
                                            onClick={() => handleEditRole(role)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn-delete"
                                            onClick={() => handleDeleteRole(role)}
                                            disabled={role.isSystemRole || role.userCount > 0}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <RoleModal
                    role={selectedRole}
                    isCreating={isCreating}
                    onClose={handleModalClose}
                />
            )}

            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={cancelDelete}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>Confirm Delete</h2>
                            <button className="modal-close" onClick={cancelDelete}>×</button>
                        </div>
                        <div className="user-form">
                            <p>Are you sure you want to delete the role <strong>"{roleToDelete?.name}"</strong>?</p>
                            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '8px' }}>
                                This action cannot be undone.
                            </p>
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={cancelDelete}>
                                    Cancel
                                </button>
                                <button type="button" className="btn-save" onClick={confirmDelete} style={{ background: '#ef4444' }}>
                                    Delete Role
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default RoleManagement;
