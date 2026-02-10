import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginModal.css';

function LoginModal({ isOpen, onClose }) {
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(usernameOrEmail, password);

        if (result.success) {
            onClose();
            setUsernameOrEmail('');
            setPassword('');

            // Check if password change is required first
            if (result.mustChangePassword) {
                navigate('/change-password');
            } else {
                // Role-based redirect (priority: ADMIN > SCOREKEEPER > GM > default)
                if (result.user?.roles?.includes('ADMIN')) {
                    navigate('/admin');
                } else if (result.user?.roles?.includes('SCOREKEEPER')) {
                    navigate('/scorekeeper');
                } else if (result.user?.roles?.includes('GM')) {
                    navigate('/gm');
                } else {
                    // For other roles, stay on public site or go to a generic dashboard
                    navigate('/');
                }
            }
        } else {
            setError(result.error || 'Login failed. Please check your credentials.');
        }

        setLoading(false);
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="login-modal-overlay" onClick={handleOverlayClick}>
            <div className="login-modal">
                <button className="modal-close" onClick={onClose}>&times;</button>

                <div className="modal-header">
                    <h2>Login</h2>
                    <p>Sign in to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="modal-email">Email or Username</label>
                        <input
                            id="modal-email"
                            type="text"
                            value={usernameOrEmail}
                            onChange={(e) => setUsernameOrEmail(e.target.value)}
                            placeholder="Enter your email or username"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="modal-password">Password</label>
                        <input
                            id="modal-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default LoginModal;
