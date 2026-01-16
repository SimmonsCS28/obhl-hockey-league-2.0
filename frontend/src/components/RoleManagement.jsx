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
        if (role.isSystemRole) {
            alert('Cannot delete system roles');
            return;
        }

        if (role.userCount > 0) {
            alert(`Cannot delete role "${role.name}". ${role.userCount} user(s) currently have this role.`);
            return;
        }

        if (!window.confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
            return;
        }

        try {
            await api.deleteRole(role.id);
            await loadRoles();
        } catch (err) {
            alert('Failed to delete role: ' + err.message);
        }
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
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="no-users">
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
        </>
    );
};

export default RoleManagement;
