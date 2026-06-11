import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import './ForgotPassword.css'; // New CSS

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [method, setMethod] = useState(null); // 'question' | 'email'
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState('');
    const [formData, setFormData] = useState({
        answer: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUsernameSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await api.getSecurityQuestion(username);
            setSecurityQuestion(data.question);
            setStep(2);
        } catch (err) {
            setError(err.message || 'User not found or no security question set.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.newPassword !== formData.confirmPassword) {
            return setError('Passwords do not match');
        }

        setLoading(true);
        try {
            await api.resetPassword({
                username,
                answer: formData.answer,
                newPassword: formData.newPassword
            });
            setMessage('Password reset successfully! Redirecting to login...');
            setTimeout(() => navigate('/'), 2000);
        } catch (err) {
            setError(err.message || 'Failed to reset password. Check your answer.');
            setLoading(false);
        }
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.forgotPassword(email);
            setMessage('If an account with that email exists, a password reset link has been sent. Please check your inbox.');
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const reset = () => {
        setMethod(null);
        setStep(1);
        setError('');
        setMessage('');
    };

    return (
        <div className="forgot-password-container">
            <div className="forgot-password-card">
                <h2>Reset Password</h2>
                {error && <div className="error-message">{error}</div>}
                {message && <div className="success-message">{message}</div>}

                {!method && (
                    <div className="reset-method-choice">
                        <p>How would you like to reset your password?</p>
                        <button type="button" className="reset-btn" onClick={() => setMethod('email')}>
                            Email Me a Reset Link
                        </button>
                        <button type="button" className="reset-btn secondary-btn" onClick={() => setMethod('question')}>
                            Answer My Security Question
                        </button>
                    </div>
                )}

                {method === 'email' && !message && (
                    <form onSubmit={handleEmailSubmit}>
                        <p>Enter your account email and we'll send you a link to reset your password.</p>
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" disabled={loading} className="reset-btn">
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>
                )}

                {method === 'question' && step === 1 && (
                    <form onSubmit={handleUsernameSubmit}>
                        <p>Enter your username to retrieve your security question.</p>
                        <div className="form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" disabled={loading} className="reset-btn">
                            {loading ? 'Searching...' : 'Next'}
                        </button>
                    </form>
                )}

                {method === 'question' && step === 2 && !message && (
                    <form onSubmit={handleResetSubmit}>
                        <div className="security-question-display">
                            <strong>Security Question:</strong>
                            <p>"{securityQuestion}"</p>
                        </div>

                        <div className="form-group">
                            <label>Answer</label>
                            <input
                                type="text"
                                name="answer"
                                value={formData.answer}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <button type="submit" disabled={loading} className="reset-btn">
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                )}

                {method && !message && (
                    <div className="login-link">
                        <button
                            type="button"
                            onClick={reset}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                        >
                            Choose a different option
                        </button>
                    </div>
                )}

                <div className="login-link">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
