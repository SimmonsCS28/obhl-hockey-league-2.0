import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import './ForgotPassword.css'; // New CSS

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
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
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.message || 'Failed to reset password. Check your answer.');
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="forgot-password-container">
            <div className="forgot-password-card">
                <h2>Reset Password</h2>
                {error && <div className="error-message">{error}</div>}
                {message && <div className="success-message">{message}</div>}

                {step === 1 && (
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

                {step === 2 && !message && (
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

                <div className="login-link">
                    <a href="/login">Back to Login</a>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
