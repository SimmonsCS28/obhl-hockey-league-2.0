import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './AccountSettings.css';

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

// Volunteer roles a user can opt into/out of for themselves. The `value` must match
// the backend role names; granting one unlocks the corresponding shift sign-up pages.
const STAFF_ROLES = [
    { value: 'GOALIE', label: 'Goalie', hint: 'Sign up for goalie shifts' },
    { value: 'REF', label: 'Referee', hint: 'Sign up for referee shifts' },
    { value: 'SCOREKEEPER', label: 'Scorekeeper', hint: 'Sign up for scorekeeping shifts' },
];
const STAFF_ROLE_VALUES = STAFF_ROLES.map((r) => r.value);

export default function AccountSettings() {
    const navigate = useNavigate();
    const { user, completeLogin } = useAuth();

    const [profile, setProfile] = useState(null);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [staffRoles, setStaffRoles] = useState([]);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);

    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const data = await api.getProfile();
                setProfile(data);
                setUsername(data.username);
                setEmail(data.email);
                setStaffRoles(data.staffRoles || []);
                if (data.securityQuestion) {
                    setSecurityQuestion(data.securityQuestion);
                }
            } catch (err) {
                setError(err.message || 'Failed to load account information');
            } finally {
                setLoadingProfile(false);
            }
        };
        loadProfile();
    }, []);

    const toggleStaffRole = (role) => {
        setStaffRoles((prev) =>
            prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!currentPassword) {
            setError('Please enter your current password to save changes');
            return;
        }

        if (newPassword || confirmPassword) {
            if (newPassword.length < 8) {
                setError('New password must be at least 8 characters');
                return;
            }
            if (newPassword !== confirmPassword) {
                setError('New passwords do not match');
                return;
            }
        }

        const payload = { currentPassword };
        if (username && username !== profile?.username) payload.username = username;
        if (email && email !== profile?.email) payload.email = email;
        if (newPassword) payload.newPassword = newPassword;
        if (securityAnswer) {
            payload.securityQuestion = securityQuestion;
            payload.securityAnswer = securityAnswer;
        }
        // Always send the current volunteer-role selection; the server reconciles to it.
        payload.staffRoles = staffRoles;

        setLoading(true);
        try {
            const response = await api.updateProfile(payload);

            const newStaffRoles = (response.user.roles || []).filter((r) => STAFF_ROLE_VALUES.includes(r));
            setStaffRoles(newStaffRoles);
            setProfile({
                username: response.user.username,
                email: response.user.email,
                securityQuestion: securityAnswer ? securityQuestion : profile?.securityQuestion,
                staffRoles: newStaffRoles,
            });

            // If the username changed, the server issues a new JWT and user record
            if (response.token) {
                completeLogin(response.token, response.user);
            } else {
                completeLogin(localStorage.getItem('token'), { ...user, ...response.user });
            }

            setMessage('Account updated successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setSecurityAnswer('');
        } catch (err) {
            setError(err.message || 'Failed to update account');
        } finally {
            setLoading(false);
        }
    };

    if (loadingProfile) {
        return (
            <div className="account-settings-container">
                <div className="account-settings-card">
                    <p>Loading account settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="account-settings-container">
            <div className="account-settings-card">
                <h1>Account Settings</h1>
                <p className="account-settings-message">
                    Update your username, email, password, or security question.
                </p>

                <form onSubmit={handleSubmit} className="account-settings-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="as-section-label">Username</div>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="as-section-divider" />
                    <div className="as-section-label">Email</div>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="as-section-divider" />
                    <div className="as-section-label">Password</div>
                    <p className="as-section-hint">Leave blank to keep your current password.</p>
                    <div className="form-group">
                        <label htmlFor="newPassword">New Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                id="newPassword"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={8}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowNewPassword((v) => !v)}
                                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            >
                                {showNewPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <small>Minimum 8 characters</small>
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm New Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                minLength={8}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowConfirmPassword((v) => !v)}
                                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                                {showConfirmPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                            <small className="password-mismatch">Passwords must match</small>
                        )}
                    </div>

                    <div className="as-section-divider" />
                    <div className="as-section-label">Security Question</div>
                    <p className="as-section-hint">
                        This is used to reset your password if you ever forget it.
                    </p>
                    <div className="form-group">
                        <label htmlFor="securityQuestion">Security Question</label>
                        <select
                            id="securityQuestion"
                            value={securityQuestion}
                            onChange={(e) => setSecurityQuestion(e.target.value)}
                            className="security-question-select"
                        >
                            {SECURITY_QUESTIONS.map((q) => (
                                <option key={q} value={q}>{q}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="securityAnswer">Answer</label>
                        <input
                            type="text"
                            id="securityAnswer"
                            value={securityAnswer}
                            onChange={(e) => setSecurityAnswer(e.target.value)}
                            placeholder={profile?.securityQuestion ? 'Leave blank to keep your current answer' : 'Enter your answer'}
                            autoComplete="off"
                        />
                        <small>Not case-sensitive. Only fill this in if you want to set or change your security question/answer.</small>
                    </div>

                    <div className="as-section-divider" />
                    <div className="as-section-label">Volunteer Roles</div>
                    <p className="as-section-hint">
                        Opt in to volunteer as a goalie, referee, or scorekeeper. Enabling a role
                        unlocks the matching shift sign-up pages; disabling it removes that access.
                    </p>
                    <div className="as-role-options">
                        {STAFF_ROLES.map((role) => (
                            <label key={role.value} className="as-role-option">
                                <input
                                    type="checkbox"
                                    checked={staffRoles.includes(role.value)}
                                    onChange={() => toggleStaffRole(role.value)}
                                />
                                <span className="as-role-text">
                                    <span className="as-role-label">{role.label}</span>
                                    <span className="as-role-hint">{role.hint}</span>
                                </span>
                            </label>
                        ))}
                    </div>

                    <div className="as-section-divider" />
                    <div className="as-section-label">Confirm Changes</div>
                    <div className="form-group">
                        <label htmlFor="currentPassword">Current Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showCurrentPassword ? 'text' : 'password'}
                                id="currentPassword"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowCurrentPassword((v) => !v)}
                                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                            >
                                {showCurrentPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <small>Required to save any changes on this page.</small>
                        <button
                            type="button"
                            className="as-forgot-link"
                            onClick={() => navigate('/forgot-password')}
                        >
                            Forgot your password?
                        </button>
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>

                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => navigate('/')}
                    >
                        Back to Home
                    </button>
                </form>
            </div>

            {message && (
                <div className="as-modal-overlay" onClick={() => setMessage('')}>
                    <div className="as-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="as-modal-icon" aria-hidden="true">✓</div>
                        <h2>Success</h2>
                        <p>{message}</p>
                        <button
                            type="button"
                            className="submit-btn"
                            onClick={() => setMessage('')}
                            autoFocus
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
