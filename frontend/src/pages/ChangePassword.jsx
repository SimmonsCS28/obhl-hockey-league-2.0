import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './ChangePassword.css';

export default function ChangePassword() {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { completeLogin } = useAuth();

    // Ephemeral state from Login
    const ephemeralToken = location.state?.ephemeralToken;
    const ephemeralUser = location.state?.ephemeralUser;

    useEffect(() => {
        // Redir if no ephemeral session
        if (!ephemeralToken || !ephemeralUser) {
            console.warn('No ephemeral session found, redirecting to home');
            navigate('/', { replace: true });
        }
    }, [ephemeralToken, ephemeralUser, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setLoading(true);

        try {
            await api.changePassword(oldPassword, newPassword, ephemeralToken);

            // Success: Finalize login
            completeLogin(ephemeralToken, ephemeralUser);

            const roles = ephemeralUser.roles || [ephemeralUser.role];
            if (roles.includes('ADMIN')) {
                navigate('/admin');
            } else if (roles.includes('GM')) {
                navigate('/gm');
            } else {
                navigate('/user');
            }
        } catch (err) {
            console.error('Error changing password:', err);
            setError(err.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="change-password-container">
            <div className="change-password-card">
                <h1>Change Password</h1>
                <p className="change-password-message">
                    For security reasons, you must change your password before continuing.
                </p>

                <form onSubmit={handleSubmit} className="change-password-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="oldPassword">Current Password</label>
                        <input
                            type="password"
                            id="oldPassword"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="newPassword">New Password</label>
                        <input
                            type="password"
                            id="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                        <small>Minimum 8 characters</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm New Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                    </div>

                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={loading}
                    >
                        {loading ? 'Changing Password...' : 'Change Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
