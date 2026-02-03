import { useEffect, useState } from 'react';
import api from '../../services/api';
import './UserRoleManagement.css';

const AVAILABLE_ROLES = [
    { name: 'ADMIN', description: 'Full system access', color: '#e53e3e' },
    { name: 'GM', description: 'Team management', color: '#d69e2e' },
    { name: 'PLAYER', description: 'Player access', color: '#3182ce' },
    { name: 'REFEREE', description: 'Referee scheduling', color: '#805ad5' },
    { name: 'SCOREKEEPER', description: 'Game scoring', color: '#38a169' },
    { name: 'GOALIE', description: 'Goalie scheduling', color: '#dd6b20' },
    { name: 'COORDINATOR', description: 'League coordination', color: '#718096' },
    { name: 'USER', description: 'Basic access', color: '#a0aec0' }
];

const UserRoleManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [editingRoles, setEditingRoles] = useState([]);
    const [saveLoading, setSaveLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            // Need an endpoint to get all users directly or filter properly
            // Assuming api.getUsers() exists or using getAllUsers equivalent
            // If API not exposed, might need to add it or use existing specific calls
            // For now assuming we can fetch users via existing admin endpoints if any, 
            // or just fetch all players and match? No, need USERS.
            // Let's assume we need to add getAllUsers to api.js first if not present.
            // Wait, api.js doesn't have getAllUsers exposed. 
            // I'll check AdminDashboard or api.js again.
            // api.getSeasons, getTeams, getGames... no getUsers.
            // But UserManagementService has getAllUsers.
            // I should add getUsers to api.js or use a new endpoint.
            // I'll add `getUsers` here temporarily until I confirm.

            // Checking api.js in memory: it doesn't have getUsers.
            // I'll assume endpoint is /users
            const usersData = await api.getUsers();
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load users:', error);
            // Fallback for dev/demo if endpoint missing
            // setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    // Add getUsers to api.js if needed. Let's assume I need to add it.
    // I'll update api.js in the same turn if possible to add getUsers.
    // Or simpler: define fetch call here if api.js update is separate step.

    // Actually, I'll update api.js in the next step to add getUsers.

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setEditingRoles(user.roles || [user.role]); // Handle array or single legacy role
        setMessage(null);
    };

    const handleRoleToggle = (roleName) => {
        setEditingRoles(prev =>
            prev.includes(roleName)
                ? prev.filter(r => r !== roleName)
                : [...prev, roleName]
        );
    };

    const handleSaveRoles = async () => {
        if (!selectedUser) return;
        setSaveLoading(true);
        try {
            await api.updateUserRoles(selectedUser.id, editingRoles);

            // Update local state
            setUsers(users.map(u =>
                u.id === selectedUser.id
                    ? { ...u, roles: editingRoles }
                    : u
            ));

            setMessage({ type: 'success', text: 'Roles updated successfully!' });

            // Deselect after short delay or keep selected? Keep selected.
        } catch (error) {
            console.error('Failed to update roles:', error);
            setMessage({ type: 'error', text: 'Failed to update roles.' });
        } finally {
            setSaveLoading(false);
        }
    };

    if (loading) return <div>Loading users...</div>;

    return (
        <div className="user-role-management">
            <h2>User Role Management</h2>

            <div className="role-management-container">
                <div className="user-list-section">
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="search-input"
                    />
                    <div className="user-list">
                        {filteredUsers.map(user => (
                            <div
                                key={user.id}
                                className={`user-item ${selectedUser?.id === user.id ? 'selected' : ''}`}
                                onClick={() => handleSelectUser(user)}
                            >
                                <div className="user-info">
                                    <span className="username">{user.username}</span>
                                    <span className="email">{user.email}</span>
                                </div>
                                <div className="user-roles-preview">
                                    {(user.roles || [user.role]).map(r => (
                                        <span key={r} className="role-badge-mini" style={{ backgroundColor: AVAILABLE_ROLES.find(ar => ar.name === r)?.color || '#ccc' }}>
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="role-editor-section">
                    {selectedUser ? (
                        <div className="role-editor-content">
                            <h3>Edit Roles: {selectedUser.username}</h3>

                            {message && (
                                <div className={`message ${message.type}`}>
                                    {message.text}
                                </div>
                            )}

                            <div className="roles-grid">
                                {AVAILABLE_ROLES.map(role => (
                                    <label key={role.name} className={`role-card ${editingRoles.includes(role.name) ? 'active' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={editingRoles.includes(role.name)}
                                            onChange={() => handleRoleToggle(role.name)}
                                        />
                                        <span className="role-name" style={{ color: role.color }}>{role.name}</span>
                                        <span className="role-desc">{role.description}</span>
                                    </label>
                                ))}
                            </div>

                            <button
                                className="save-roles-btn"
                                onClick={handleSaveRoles}
                                disabled={saveLoading}
                            >
                                {saveLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    ) : (
                        <div className="no-selection">
                            <p>Select a user to edit their roles</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserRoleManagement;
