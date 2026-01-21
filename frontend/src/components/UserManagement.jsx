import { useEffect, useState } from 'react';
import api from '../services/api';
import RoleManagement from './RoleManagement';
import './UserManagement.css';
import UserModal from './UserModal';

const UserManagement = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadUsers();
        loadRoles();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getUsers();
            setUsers(data);
        } catch (err) {
            setError(err.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const loadRoles = async () => {
        try {
            const data = await api.getRoles();
            setRoles(data);
        } catch (err) {
            console.error('Failed to load roles:', err);
        }
    };

    const handleCreateUser = () => {
        setSelectedUser(null);
        setIsCreating(true);
        setShowModal(true);
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setIsCreating(false);
        setShowModal(true);
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Are you sure you want to deactivate ${user.username}? This will mark them as inactive.`)) {
            return;
        }

        try {
            await api.deleteUser(user.id);
            await loadUsers();
        } catch (err) {
            alert('Failed to deactivate user: ' + err.message);
        }
    };

    const handleModalClose = (userSaved) => {
        setShowModal(false);
        setSelectedUser(null);
        setIsCreating(false);
        if (userSaved) {
            loadUsers();
        }
    };

    const getRoleBadgeClass = (role) => {
        const roleClasses = {
            'ADMIN': 'role-admin',
            'SCOREKEEPER': 'role-scorekeeper',
            'GM': 'role-gm',
            'REF': 'role-ref',
            'USER': 'role-user'
        };
        return roleClasses[role] || 'role-user';
    };

    if (loading) {
        return <div className="user-management-loading">Loading users...</div>;
    }

    if (error) {
        return <div className="user-management-error">Error: {error}</div>;
    }

    return (
        <div className="user-management">
            <div className="user-management-header">
                <h2>User Management</h2>
            </div>

            <div className="user-management-tabs">
                <button
                    className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    Users
                </button>
                <button
                    className={`tab-button ${activeTab === 'roles' ? 'active' : ''}`}
                    onClick={() => setActiveTab('roles')}
                >
                    Roles
                </button>
            </div>

            {activeTab === 'users' && (
                <>
                    <div className="tab-header">
                        <div className="filter-group">
                            <label htmlFor="role-filter">Filter by Role:</label>
                            <select
                                id="role-filter"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="role-filter-select"
                            >
                                <option value="all">All Roles</option>
                                {roles.map(role => (
                                    <option key={role.id} value={role.name}>
                                        {role.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button className="btn-create-user" onClick={handleCreateUser}>
                            + Add User
                        </button>
                    </div>

                    <div className="users-table-container">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Password Change Required</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.filter(user => selectedRole === 'all' || user.role === selectedRole).length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="no-users">
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    users.filter(user => selectedRole === 'all' || user.role === selectedRole).map(user => (
                                        <tr key={user.id}>
                                            <td className="username-col">{user.username}</td>
                                            <td>{user.email}</td>
                                            <td>
                                                <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                                                    {user.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                {user.mustChangePassword ? (
                                                    <span className="password-warning">⚠️ Yes</span>
                                                ) : (
                                                    <span className="password-ok">No</span>
                                                )}
                                            </td>
                                            <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                            <td className="actions-col">
                                                <button
                                                    className="btn-edit"
                                                    onClick={() => handleEditUser(user)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleDeleteUser(user)}
                                                >
                                                    Deactivate
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {showModal && (
                        <UserModal
                            user={selectedUser}
                            isCreating={isCreating}
                            onClose={handleModalClose}
                        />
                    )}
                </>
            )}

            {activeTab === 'roles' && <RoleManagement />}
        </div>
    );
};

export default UserManagement;
