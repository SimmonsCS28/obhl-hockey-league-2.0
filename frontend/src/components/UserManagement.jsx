import { useEffect, useState } from 'react';
import api from '../services/api';
import RoleManagement from './RoleManagement';
import UserGenerationTab from './UserGenerationTab';
import './UserManagement.css';
import UserModal from './UserModal';

const UserManagement = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedPasswordChange, setSelectedPasswordChange] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [sortConfig, setSortConfig] = useState({ key: 'username', direction: 'ascending' });

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

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getClassNamesFor = (name) => {
        if (!sortConfig) {
            return;
        }
        return sortConfig.key === name ? sortConfig.direction : undefined;
    };

    const filteredUsers = users.filter(user => {
        // Role filter
        if (selectedRole !== 'all') {
            const hasRole = (user.roles && user.roles.includes(selectedRole)) || user.role === selectedRole;
            if (!hasRole) return false;
        }

        // Status filter
        if (selectedStatus !== 'all') {
            const isActive = selectedStatus === 'active';
            if (user.isActive !== isActive) return false;
        }

        // Password Change filter
        if (selectedPasswordChange !== 'all') {
            const mustChange = selectedPasswordChange === 'required';
            if (user.mustChangePassword !== mustChange) return false;
        }

        return true;
    });

    const sortedUsers = [...filteredUsers].sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle string comparison case-insensitively
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });

    if (loading && activeTab === 'users' && users.length === 0) {
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
                    Manage Users
                </button>
                <button
                    className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
                    onClick={() => setActiveTab('generate')}
                >
                    Generate Users
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
                        <div className="user-management-filters-row">
                            <div className="user-management-filter-item">
                                <label htmlFor="role-filter">Role:</label>
                                <select
                                    id="role-filter"
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="all">All</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.name}>
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="user-management-filter-item">
                                <label htmlFor="status-filter">Status:</label>
                                <select
                                    id="status-filter"
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="all">All</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <div className="user-management-filter-item">
                                <label htmlFor="pwd-filter">Password:</label>
                                <select
                                    id="pwd-filter"
                                    value={selectedPasswordChange}
                                    onChange={(e) => setSelectedPasswordChange(e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="all">All</option>
                                    <option value="required">Change Required</option>
                                    <option value="not_required">OK</option>
                                </select>
                            </div>

                            <div className="user-management-filter-item user-count-wrapper">
                                <span className="user-count">
                                    Total Users: <strong>{sortedUsers.length}</strong>
                                </span>
                            </div>
                        </div>
                        <button className="btn-create-user" onClick={handleCreateUser}>
                            + Add User
                        </button>
                    </div>

                    <div className="users-table-container">
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th onClick={() => requestSort('username')} className={getClassNamesFor('username')}>
                                        Username {sortConfig.key === 'username' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                    </th>
                                    <th onClick={() => requestSort('email')} className={getClassNamesFor('email')}>
                                        Email {sortConfig.key === 'email' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                    </th>
                                    <th>Roles</th>
                                    <th onClick={() => requestSort('isActive')} className={getClassNamesFor('isActive')}>
                                        Status {sortConfig.key === 'isActive' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                    </th>
                                    <th onClick={() => requestSort('mustChangePassword')} className={getClassNamesFor('mustChangePassword')}>
                                        Password Change {sortConfig.key === 'mustChangePassword' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                    </th>
                                    <th onClick={() => requestSort('createdAt')} className={getClassNamesFor('createdAt')}>
                                        Created {sortConfig.key === 'createdAt' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                    </th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="no-users">
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    sortedUsers.map(user => (
                                        <tr key={user.id}>
                                            <td className="username-col">{user.username}</td>
                                            <td>{user.email}</td>
                                            <td>
                                                {user.roles && user.roles.length > 0 ? (
                                                    user.roles.map((roleName, index) => (
                                                        <span key={index} className={`role-badge ${getRoleBadgeClass(roleName)}`} style={{ marginRight: '4px' }}>
                                                            {roleName}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                                                        {user.role}
                                                    </span>
                                                )}
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

            {activeTab === 'generate' && (
                <UserGenerationTab onUserGenerated={loadUsers} />
            )}

            {activeTab === 'roles' && <RoleManagement />}
        </div>
    );
};

export default UserManagement;
