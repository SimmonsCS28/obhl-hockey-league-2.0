import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../services/api';
import './ForgotPassword.css';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const email = searchParams.get('email') || '';

    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [resetDone, setResetDone] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.newPassword !== formData.confirmPassword) {
            return setError('Passwords do not match');
        }

        setLoading(true);
        try {
            await api.resetPasswordWithToken({
                email,
                token,
                newPassword: formData.newPassword
            });
            setResetDone(true);
            setTimeout(() => navigate('/', { state: { openLogin: true } }), 2000);
        } catch (err) {
            setError(err.message || 'Failed to reset password. The link may have expired.');
            setLoading(false);
        }
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

    const invalidLink = !token || !email;

    return (
        <div className="forgot-password-page auth-page">
            <div className="auth-card">
                <p className="auth-eyebrow">Account Recovery</p>
                <h2 className="auth-title">Reset Password</h2>

                {invalidLink ? (
                    <>
                        <div style={{ height: 22 }} />
                        <div className="auth-alert auth-alert--error">
                            <span className="auth-alert-icon" aria-hidden="true">⚠</span>
                            <span>This reset link is invalid. Please request a new one.</span>
                        </div>
                        <button type="button" className="auth-btn" onClick={() => navigate('/forgot-password')}>
                            Request a New Link
                        </button>
                        <div className="auth-footer auth-footer--center">
                            <button type="button" className="auth-link" onClick={() => navigate('/', { state: { openLogin: true } })}>Back to Login</button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="auth-subtitle">Choose a new password for <strong style={{ color: 'var(--obi-text)' }}>{email}</strong>.</p>

                        {error && (
                            <div className="auth-alert auth-alert--error">
                                <span className="auth-alert-icon" aria-hidden="true">⚠</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
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

                        <div className="auth-footer auth-footer--center">
                            <button type="button" className="auth-link" onClick={() => navigate('/', { state: { openLogin: true } })}>Back to Login</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
