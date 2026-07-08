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
    const [resetDone, setResetDone] = useState(false);
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
            setResetDone(true);
            setTimeout(() => navigate('/', { state: { openLogin: true } }), 2000);
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

    if (resetDone) {
        return (
            <div className="forgot-password-page auth-page">
                <div className="auth-card auth-success">
                    <div className="auth-success-icon" aria-hidden="true">✓</div>
                    <h2 className="auth-success-title">Password Reset</h2>
                    <p className="auth-success-text">Password reset successfully! Redirecting to login...</p>
                </div>
            </div>
        );
    }

    const footerLinks = (
        <div className="auth-footer">
            <button type="button" className="auth-link" onClick={reset}>Choose a different option</button>
            <button type="button" className="auth-link" onClick={() => navigate('/', { state: { openLogin: true } })}>Back to Login</button>
        </div>
    );

    return (
        <div className="forgot-password-page auth-page">
            <div className="auth-card">
                <p className="auth-eyebrow">Account Recovery</p>
                <h2 className="auth-title">Reset Password</h2>

                {!method && (
                    <>
                        <p className="auth-subtitle">How would you like to reset your password?</p>
                        <button type="button" className="recovery-method-btn" onClick={() => setMethod('email')}>
                            <span className="recovery-method-icon" aria-hidden="true">✉</span>
                            <span className="recovery-method-text">
                                <span className="recovery-method-title">Email Me a Reset Link</span>
                                <span className="recovery-method-sub">Sent to your account email</span>
                            </span>
                        </button>
                        <button type="button" className="recovery-method-btn" onClick={() => setMethod('question')}>
                            <span className="recovery-method-icon" aria-hidden="true">🔑</span>
                            <span className="recovery-method-text">
                                <span className="recovery-method-title">Answer My Security Question</span>
                                <span className="recovery-method-sub">Verify with your saved answer</span>
                            </span>
                        </button>
                        <div className="auth-footer auth-footer--center">
                            <button type="button" className="auth-link" onClick={() => navigate('/', { state: { openLogin: true } })}>Back to Login</button>
                        </div>
                    </>
                )}

                {method === 'email' && (
                    <>
                        <p className="auth-subtitle">Enter your account email and we'll send you a link to reset your password.</p>
                        {error && (
                            <div className="auth-alert auth-alert--error">
                                <span className="auth-alert-icon" aria-hidden="true">⚠</span>
                                <span>{error}</span>
                            </div>
                        )}
                        {message && (
                            <div className="auth-alert auth-alert--success">
                                <span className="auth-alert-icon" aria-hidden="true">✓</span>
                                <span>{message}</span>
                            </div>
                        )}
                        <form onSubmit={handleEmailSubmit}>
                            <div className="auth-form-group">
                                <label className="auth-label">Email</label>
                                <input
                                    type="email"
                                    className="auth-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" disabled={loading} className="auth-btn">
                                {loading && <span className="auth-spinner" aria-hidden="true"></span>}
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>
                        {footerLinks}
                    </>
                )}

                {method === 'question' && step === 1 && (
                    <>
                        <p className="auth-subtitle">Enter your username to retrieve your security question.</p>
                        {error && (
                            <div className="auth-alert auth-alert--error">
                                <span className="auth-alert-icon" aria-hidden="true">⚠</span>
                                <span>{error}</span>
                            </div>
                        )}
                        <form onSubmit={handleUsernameSubmit}>
                            <div className="auth-form-group">
                                <label className="auth-label">Username</label>
                                <input
                                    type="text"
                                    className={`auth-input${error ? ' auth-input-error' : ''}`}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" disabled={loading} className="auth-btn">
                                {loading && <span className="auth-spinner" aria-hidden="true"></span>}
                                {loading ? 'Searching...' : 'Next'}
                            </button>
                        </form>
                        {footerLinks}
                    </>
                )}

                {method === 'question' && step === 2 && (
                    <>
                        <p className="auth-step-note">Step 1 — username entered · <span>{username}</span></p>
                        <div className="security-question-box">
                            <div className="security-question-box-label">Your Security Question</div>
                            <div className="security-question-box-text">&ldquo;{securityQuestion}&rdquo;</div>
                        </div>

                        {error && (
                            <div className="auth-alert auth-alert--error">
                                <span className="auth-alert-icon" aria-hidden="true">⚠</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleResetSubmit}>
                            <div className="auth-form-group">
                                <label className="auth-label">Security Answer</label>
                                <input
                                    type="text"
                                    name="answer"
                                    className="auth-input"
                                    value={formData.answer}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="auth-form-group">
                                <label className="auth-label">New Password</label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    className="auth-input"
                                    placeholder="Enter a new password"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="auth-form-group">
                                <label className="auth-label">Confirm Password</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    className="auth-input"
                                    placeholder="Re-enter new password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <button type="submit" disabled={loading} className="auth-btn">
                                {loading && <span className="auth-spinner" aria-hidden="true"></span>}
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
                        {footerLinks}
                    </>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
