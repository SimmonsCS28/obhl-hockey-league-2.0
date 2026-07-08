import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginModal.css';


function LoginModal({ isOpen, onClose }) {
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
                navigate('/change-password', { 
                    state: { 
                        ephemeralToken: result.token, 
                        ephemeralUser: result.user,
                        hasSecurityQuestion: result.hasSecurityQuestion
                    } 
                });
            } else {
                // Everyone lands on the unified dashboard (v5). The Admin/Coordinator consoles
                // are reachable from the user pill; no more role-specific stale dashboards.
                navigate('/dashboard');
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
            <div className="login-modal auth-card">
                <button className="login-modal-close" onClick={onClose} aria-label="Close">&times;</button>

                <div className="login-modal-header">
                    <h2 className="auth-title">Login</h2>
                    <p className="auth-subtitle">Sign in to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="login-modal-form">
                    {error && (
                        <div className="auth-alert auth-alert--error">
                            <span className="auth-alert-icon" aria-hidden="true">⚠</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="auth-form-group">
                        <label className="auth-label" htmlFor="modal-email">Email or Username</label>
                        <input
                            id="modal-email"
                            type="text"
                            className={`auth-input${error ? ' auth-input-error' : ''}`}
                            value={usernameOrEmail}
                            onChange={(e) => setUsernameOrEmail(e.target.value)}
                            placeholder="Enter your email or username"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="auth-form-group">
                        <label className="auth-label" htmlFor="modal-password">Password</label>
                        <div className="auth-password-wrapper">
                            <input
                                id="modal-password"
                                type={showPassword ? "text" : "password"}
                                className={`auth-input${error ? ' auth-input-error' : ''}`}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                        <line x1="1" y1="1" x2="23" y2="23"></line>
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="auth-btn"
                        disabled={loading}
                    >
                        {loading && <span className="auth-spinner" aria-hidden="true"></span>}
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <div className="auth-footer">
                        <span>Don't have an account? <button type="button" className="auth-link" onClick={() => { onClose(); navigate('/signup'); }}>Create Account</button></span>
                        <button type="button" className="auth-link" onClick={() => { onClose(); navigate('/forgot-password'); }}>Forgot Password?</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default LoginModal;
