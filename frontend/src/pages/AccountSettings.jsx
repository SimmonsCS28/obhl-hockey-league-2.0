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
        setError('');
        setStaffRoles((prev) =>
            prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
        );
    };

    const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
    const currentPwError = Boolean(error && !currentPassword);

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

            setMessage('Account updated successfully.');
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
            <div className="as-container">
                <div className="as-card">
                    <div className="as-loading">
                        <span className="as-loading-spinner" aria-hidden="true" />
                        <span className="as-loading-text">Loading account settings…</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="as-container">
            <div className="as-card">
                <p className="as-eyebrow">OBHL · My Account</p>
                <h1 className="as-title">Account Settings</h1>
                <p className="as-subtitle">Update your login details, security question, and volunteer roles.</p>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="as-banner">
                            <span className="as-banner-icon" aria-hidden="true">⚠</span>
                            <span className="as-banner-text">{error}</span>
                        </div>
                    )}

                    {/* Username */}
                    <div className="as-field">
                        <label className="as-label" htmlFor="username">Username</label>
                        <input
                            type="text" id="username" className="as-input"
                            value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }}
                            required
                        />
                    </div>

                    {/* Email */}
                    <div className="as-field as-field--gap">
                        <label className="as-label" htmlFor="email">Email</label>
                        <input
                            type="email" id="email" className="as-input"
                            value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                            required
                        />
                    </div>

                    {/* Password */}
                    <div className="as-divider" />
                    <h2 className="as-section-heading">Password</h2>
                    <p className="as-section-hint">Leave blank to keep your current password.</p>

                    <div className="as-field">
                        <label className="as-label" htmlFor="newPassword">New Password</label>
                        <div className="as-pw-wrap">
                            <input
                                type={showNewPassword ? 'text' : 'password'} id="newPassword" className="as-input"
                                value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                                minLength={8} placeholder="Enter a new password" autoComplete="new-password"
                            />
                            <button
                                type="button" className="as-pw-toggle"
                                onClick={() => setShowNewPassword((v) => !v)}
                                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            >{showNewPassword ? 'Hide' : 'Show'}</button>
                        </div>
                        <div className="as-help">Minimum 8 characters</div>
                    </div>

                    <div className="as-field as-field--gap">
                        <label className="as-label" htmlFor="confirmPassword">Confirm New Password</label>
                        <div className="as-pw-wrap">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword"
                                className={`as-input${mismatch ? ' as-input--error' : ''}`}
                                value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                minLength={8} placeholder="Re-enter new password" autoComplete="new-password"
                            />
                            <button
                                type="button" className="as-pw-toggle"
                                onClick={() => setShowConfirmPassword((v) => !v)}
                                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >{showConfirmPassword ? 'Hide' : 'Show'}</button>
                        </div>
                        {mismatch && (
                            <div className="as-mismatch"><span style={{ fontWeight: 700 }} aria-hidden="true">⚠</span>Passwords must match</div>
                        )}
                    </div>

                    {/* Security Question */}
                    <div className="as-divider" />
                    <h2 className="as-section-heading">Security Question</h2>
                    <p className="as-section-hint">This is used to reset your password if you ever forget it.</p>

                    <div className="as-field">
                        <label className="as-label" htmlFor="securityQuestion">Security Question</label>
                        <div className="as-select-wrap">
                            <select
                                id="securityQuestion" className="as-select"
                                value={securityQuestion} onChange={(e) => { setSecurityQuestion(e.target.value); setError(''); }}
                            >
                                {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                            </select>
                            <span className="as-select-chev" aria-hidden="true">▼</span>
                        </div>
                    </div>

                    <div className="as-field as-field--gap">
                        <label className="as-label" htmlFor="securityAnswer">Answer</label>
                        <input
                            type="text" id="securityAnswer" className="as-input"
                            value={securityAnswer} onChange={(e) => { setSecurityAnswer(e.target.value); setError(''); }}
                            placeholder={profile?.securityQuestion ? 'Leave blank to keep your current answer' : 'Enter your answer'}
                            autoComplete="off"
                        />
                        <div className="as-help">Not case-sensitive. Only fill this in if you want to set or change your security question / answer.</div>
                    </div>

                    {/* Volunteer Roles */}
                    <div className="as-divider" />
                    <h2 className="as-section-heading">Volunteer Roles</h2>
                    <p className="as-section-hint">
                        Opt in to volunteer as a goalie, referee, or scorekeeper. Enabling a role
                        unlocks the matching shift sign-up pages; disabling it removes that access.
                    </p>
                    <div className="as-role-cards">
                        {STAFF_ROLES.map((role) => {
                            const checked = staffRoles.includes(role.value);
                            return (
                                <button
                                    type="button" key={role.value}
                                    className={`as-role-card${checked ? ' is-checked' : ''}`}
                                    onClick={() => toggleStaffRole(role.value)}
                                    aria-pressed={checked}
                                >
                                    <span className="as-role-box" aria-hidden="true">{checked ? '✓' : ''}</span>
                                    <span className="as-role-text">
                                        <span className="as-role-name">{role.label}</span>
                                        <span className="as-role-hint">{role.hint}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Confirm Changes */}
                    <div className="as-divider" />
                    <h2 className="as-section-heading">Confirm Changes</h2>

                    <div className="as-field as-field--gap">
                        <label className="as-label" htmlFor="currentPassword">Current Password <span className="as-required">*</span></label>
                        <div className="as-pw-wrap">
                            <input
                                type={showCurrentPassword ? 'text' : 'password'} id="currentPassword"
                                className={`as-input${currentPwError ? ' as-input--error' : ''}`}
                                value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                                required placeholder="Enter your current password" autoComplete="current-password"
                            />
                            <button
                                type="button" className="as-pw-toggle"
                                onClick={() => setShowCurrentPassword((v) => !v)}
                                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                            >{showCurrentPassword ? 'Hide' : 'Show'}</button>
                        </div>
                        <div className="as-current-meta">
                            <span className="as-help" style={{ marginTop: 0 }}>Required to save any changes on this page.</span>
                            <button type="button" className="as-forgot-link" onClick={() => navigate('/forgot-password')}>
                                Forgot your password?
                            </button>
                        </div>
                    </div>

                    <div className="as-actions">
                        <button type="submit" className="as-save" disabled={loading}>
                            {loading && <span className="as-spinner" aria-hidden="true" />}
                            {loading ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button type="button" className="as-back" onClick={() => navigate('/')}>Back to Home</button>
                    </div>
                </form>
            </div>

            {message && (
                <div className="as-modal-overlay" onClick={() => setMessage('')}>
                    <div className="as-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="as-modal-icon" aria-hidden="true">✓</div>
                        <h2>Success</h2>
                        <p>{message}</p>
                        <button type="button" className="as-modal-ok" onClick={() => setMessage('')} autoFocus>OK</button>
                    </div>
                </div>
            )}
        </div>
    );
}
