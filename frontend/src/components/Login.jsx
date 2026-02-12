import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(usernameOrEmail, password);

        if (result.success) {
            const roles = result.user?.roles || (result.user?.role ? [result.user.role] : []);

            if (roles.includes('ADMIN')) {
                navigate('/admin');
            } else if (roles.includes('GM')) {
                navigate('/gm');
            } else if (roles.some(r => ['SCOREKEEPER', 'REF', 'GOALIE'].includes(r))) {
                navigate('/user');
            } else {
                navigate('/');
            }
        } else {
            setError(result.error || 'Login failed. Please check your credentials.');
        }

        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1>OBHL Admin</h1>
                    <p>Sign in to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="usernameOrEmail">Email or Username</label>
                        <input
                            id="usernameOrEmail"
                            type="text"
                            value={usernameOrEmail}
                            onChange={(e) => setUsernameOrEmail(e.target.value)}
                            placeholder="Enter your email or username"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
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

                <div className="login-footer">
                    <div className="login-links">
                        <a href="/signup">Create Account</a> | <a href="/forgot-password">Forgot Password?</a>
                    </div>
                </div>
                {/* 
                <div className="login-footer">
                    <p className="temp-password-note">
                        <strong>Temporary Password:</strong> admin123
                    </p>
                    <p className="help-text">
                        You can change your password after logging in
                    </p>
                </div>
                */}
            </div>
        </div>
    );
};

export default Login;
