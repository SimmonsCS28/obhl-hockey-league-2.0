import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './ChangePassword.css';

const SECURITY_QUESTIONS = [
    "What was the name of your first pet?",
    "What city were you born in?",
    "What is your mother's maiden name?",
    "What was the name of your elementary school?",
    "What was the make and model of your first car?",
    "What is the name of the street you grew up on?",
    "What was your childhood nickname?",
    "What is your oldest sibling's middle name?",
];

export default function ChangePassword() {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { completeLogin } = useAuth();

    // Ephemeral state from Login
    const ephemeralToken = location.state?.ephemeralToken;
    const ephemeralUser = location.state?.ephemeralUser;
    // False means they have never set one — show the section
    const hasSecurityQuestion = location.state?.hasSecurityQuestion ?? true;
    const isFirstLogin = !hasSecurityQuestion;

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

        if (isFirstLogin && !securityAnswer.trim()) {
            setError('Please provide an answer to your security question');
            return;
        }

        setLoading(true);

        try {
            await api.changePassword(
                oldPassword,
                newPassword,
                ephemeralToken,
                isFirstLogin ? securityQuestion : undefined,
                isFirstLogin ? securityAnswer.trim() : undefined
            );

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
                <h1>Welcome to OBHL</h1>
                <p className="change-password-message">
                    For security reasons, you must set a new password before continuing.
                    {isFirstLogin && ' You\'ll also set a security question for account recovery.'}
                </p>

                <form onSubmit={handleSubmit} className="change-password-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="cp-section-label">Password</div>

                    <div className="form-group">
                        <label htmlFor="oldPassword">Temporary Password</label>
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

                    {isFirstLogin && (
                        <>
                            <div className="cp-section-divider" />
                            <div className="cp-section-label">Account Recovery</div>
                            <p className="cp-section-hint">
                                Choose a security question you'll remember. This is used to reset your password if you ever forget it.
                            </p>

                            <div className="form-group">
                                <label htmlFor="securityQuestion">Security Question</label>
                                <select
                                    id="securityQuestion"
                                    value={securityQuestion}
                                    onChange={(e) => setSecurityQuestion(e.target.value)}
                                    className="security-question-select"
                                    required
                                >
                                    {SECURITY_QUESTIONS.map((q) => (
                                        <option key={q} value={q}>{q}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="securityAnswer">Your Answer</label>
                                <input
                                    type="text"
                                    id="securityAnswer"
                                    value={securityAnswer}
                                    onChange={(e) => setSecurityAnswer(e.target.value)}
                                    placeholder="Enter your answer"
                                    required={isFirstLogin}
                                    autoComplete="off"
                                />
                                <small>Not case-sensitive. Remember this answer!</small>
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Set Password & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
