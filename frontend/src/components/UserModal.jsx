import { useEffect, useState } from 'react';
import api from '../services/api';
import './UserManagement.css';

const AVAILABLE_ROLES = [
    { name: 'ADMIN', description: 'Full system access' },
    { name: 'GM', description: 'Team management' },
    { name: 'PLAYER', description: 'Player access' },
    { name: 'REFEREE', description: 'Referee scheduling' },
    { name: 'SCOREKEEPER', description: 'Game scoring' },
    { name: 'GOALIE', description: 'Goalie scheduling' },
    { name: 'USER', description: 'Basic access' }
];

const UserModal = ({ user, isCreating, onClose }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        roles: ['USER'], // Changed from role to roles array
        teamId: null
    });
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        if (user && !isCreating) {
            console.log('User data:', user);
            console.log('User roles:', user.roles);
            console.log('User role (deprecated):', user.role);

            // Handle migration from old single role to new multi-role system
            let rolesArray;
            if (user.roles && user.roles.length > 0) {
                // New multi-role system
                rolesArray = Array.isArray(user.roles) ? user.roles : Array.from(user.roles);
            } else if (user.role) {
                // Fallback to old single role field
                rolesArray = [user.role];
            } else {
                // Default
                rolesArray = ['USER'];
            }

            console.log('Final roles array:', rolesArray);

            setFormData({
                username: user.username || '',
                email: user.email || '',
                password: '',
                roles: rolesArray,
                teamId: user.teamId || null
            });
        }
    }, [user, isCreating]);

    const validatePassword = (password) => {
        if (!password) return '';

        // Min 8 chars, 1 uppercase, 1 special char, no spaces
        const minLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasSpecial = /[!@#$%^&*()\-_=+\[\]{}|;:',.<>?/~`]/.test(password);
        const noSpaces = !/\s/.test(password);

        if (!minLength) return 'Password must be at least 8 characters';
        if (!hasUppercase) return 'Password must contain at least 1 uppercase letter';
        if (!hasSpecial) return 'Password must contain at least 1 special character';
        if (!noSpaces) return 'Password cannot contain spaces';

        return '';
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'teamId' ? (value ? parseInt(value) : null) : value
        }));

        // Validate password on change
        if (name === 'password') {
            const error = validatePassword(value);
            setPasswordError(error);
        }
    };

    const handleRoleToggle = (roleName) => {
        setFormData(prev => ({
            ...prev,
            roles: prev.roles.includes(roleName)
                ? prev.roles.filter(r => r !== roleName)
                : [...prev.roles, roleName]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate that at least one role is selected
        if (!formData.roles || formData.roles.length === 0) {
            setError('Please select at least one role');
            return;
        }

        // Validate password if provided
        if ((isCreating && formData.password) || (!isCreating && showPasswordReset && formData.password)) {
            const passwordValidation = validatePassword(formData.password);
            if (passwordValidation) {
                setPasswordError(passwordValidation);
                return;
            }
        }

        // For creation, password is required
        if (isCreating && !formData.password) {
            setError('Password is required for new users');
            return;
        }

        setLoading(true);

        try {
            if (isCreating) {
                // Create new user - for now use first role as primary role
                // Backend will need to be updated to accept roles array
                await api.createUser({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password,
                    role: formData.roles[0], // Use first role as primary for now
                    teamId: formData.teamId
                });

                // After creation, if multiple roles, update with all roles
                // This is a workaround until backend supports roles array on creation
                // We'll need the user ID from the response to do this properly
            } else {
                // Update existing user
                const updateData = {
                    username: formData.username,
                    email: formData.email,
                    teamId: formData.teamId
                };

                // Only include password if resetting
                if (showPasswordReset && formData.password) {
                    updateData.newPassword = formData.password;
                }

                await api.updateUser(user.id, updateData);

                // Update roles separately using the multi-role endpoint
                await api.updateUserRoles(user.id, formData.roles);
            }

            onClose(true); // User saved successfully
        } catch (err) {
            setError(err.message || 'Failed to save user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={() => onClose(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{isCreating ? 'Create New User' : `Edit User: ${user?.username}`}</h2>
                    <button className="modal-close" onClick={() => onClose(false)}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="user-form">
                    {error && <div className="form-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">Username *</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email *</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Roles * (Select at least one)</label>
                        <div className="roles-checkbox-grid">
                            {AVAILABLE_ROLES.map(role => (
                                <label key={role.name} className="role-checkbox-item">
                                    <input
                                        type="checkbox"
                                        checked={formData.roles.includes(role.name)}
                                        onChange={() => handleRoleToggle(role.name)}
                                        disabled={loading}
                                    />
                                    <div className="role-checkbox-label">
                                        <span className="role-checkbox-name">{role.name}</span>
                                        <span className="role-checkbox-desc">{role.description}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="teamId">Team ID (optional, for GMs)</label>
                        <input
                            type="number"
                            id="teamId"
                            name="teamId"
                            value={formData.teamId || ''}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="Leave blank if not GM"
                        />
                    </div>

                    {/* Password Section */}
                    {isCreating ? (
                        <div className="form-group">
                            <label htmlFor="password">Password *</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                disabled={loading}
                            />
                            {passwordError && <div className="field-error">{passwordError}</div>}
                            <small className="password-hint">
                                Min 8 characters, 1 uppercase, 1 special character, no spaces
                            </small>
                        </div>
                    ) : (
                        <div className="form-group password-reset-section">
                            {!showPasswordReset ? (
                                <button
                                    type="button"
                                    className="btn-reset-password"
                                    onClick={() => setShowPasswordReset(true)}
                                    disabled={loading}
                                >
                                    Reset Password
                                </button>
                            ) : (
                                <>
                                    <label htmlFor="password">New Password</label>
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        disabled={loading}
                                    />
                                    {passwordError && <div className="field-error">{passwordError}</div>}
                                    <small className="password-hint">
                                        Min 8 characters, 1 uppercase, 1 special character, no spaces
                                    </small>
                                    <button
                                        type="button"
                                        className="btn-cancel-reset"
                                        onClick={() => {
                                            setShowPasswordReset(false);
                                            setFormData(prev => ({ ...prev, password: '' }));
                                            setPasswordError('');
                                        }}
                                        disabled={loading}
                                    >
                                        Cancel Reset
                                    </button>
                                </>
                            )}
                        </div>
                    )}

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
                            disabled={loading || (passwordError && formData.password)}
                        >
                            {loading ? 'Saving...' : (isCreating ? 'Create User' : 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
