import { useEffect, useState } from 'react';
import api from '../services/api';
import './UserManagement.css';

const UserModal = ({ user, isCreating, onClose }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'USER',
        teamId: null
    });
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        if (user && !isCreating) {
            setFormData({
                username: user.username || '',
                email: user.email || '',
                password: '',
                role: user.role || 'USER',
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

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
                // Create new user
                await api.createUser({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                    teamId: formData.teamId
                });
            } else {
                // Update existing user
                const updateData = {
                    username: formData.username,
                    email: formData.email,
                    role: formData.role,
                    teamId: formData.teamId
                };

                // Only include password if resetting
                if (showPasswordReset && formData.password) {
                    updateData.newPassword = formData.password;
                }

                await api.updateUser(user.id, updateData);
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
                        <label htmlFor="role">Role *</label>
                        <select
                            id="role"
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        >
                            <option value="USER">User</option>
                            <option value="SCOREKEEPER">Scorekeeper</option>
                            <option value="GM">GM</option>
                            <option value="REF">Referee</option>
                            <option value="ADMIN">Admin</option>
                        </select>
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
