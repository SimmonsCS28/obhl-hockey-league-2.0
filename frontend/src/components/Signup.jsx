import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import SecurityQuestionInput from './common/SecurityQuestionInput';
import './Signup.css';

const ROLE_OPTIONS = [
    { value: 'GOALIE', label: 'Goalie' },
    { value: 'REF', label: 'Referee' },
    { value: 'SCOREKEEPER', label: 'Scorekeeper' },
];

const Signup = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        roles: [],
        password: '',
        confirmPassword: '',
        securityQuestion: '',
        securityAnswer: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleRoleChange = (e) => {
        const { value, checked } = e.target;
        setFormData(prev => {
            if (checked) {
                return { ...prev, roles: [...prev.roles, value] };
            } else {
                return { ...prev, roles: prev.roles.filter(r => r !== value) };
            }
        });
    };

    const handleQuestionChange = (val) => {
        setFormData({
            ...formData,
            securityQuestion: val
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            return setError('Passwords do not match');
        }

        if (formData.roles.length === 0) {
            return setError('Please select at least one role');
        }

        if (!formData.securityQuestion || !formData.securityAnswer) {
            return setError('Please complete the security question section');
        }

        setLoading(true);
        try {
            await api.signup({
                username: formData.username,
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                roles: formData.roles,
                password: formData.password,
                securityQuestion: formData.securityQuestion,
                securityAnswer: formData.securityAnswer
            });
            navigate('/', { state: { message: 'Account created successfully! Please log in.' } });
        } catch (err) {
            // api.js uses fetch and throws Error(responseBodyText)
            // so err.message is the raw JSON string from the server
            let raw = '';
            try {
                const parsed = JSON.parse(err.message);
                raw = parsed?.error || '';
            } catch {
                raw = '';
            }

            if (raw.toLowerCase().includes('email already exists')) {
                const email = raw.split(':').slice(1).join(':').trim();
                setError(`An account with the email address ${email} already exists. Please contact the site administrator at csimmons@sunprairieice.com for help.`);
            } else if (raw.toLowerCase().includes('username already exists')) {
                const username = raw.split(':').slice(1).join(':').trim();
                setError(`An account with the username "${username}" already exists. Please contact the site administrator at csimmons@sunprairieice.com for help.`);
            } else {
                setError('Failed to create account. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-page auth-page">
            <div className="auth-card">
                <p className="auth-eyebrow">OBHL · Join the League</p>
                <h2 className="auth-title">Create Account</h2>
                <p className="auth-subtitle">Set up your player profile to register for the season.</p>

                {error && (
                    <div className="auth-alert auth-alert--error">
                        <span className="auth-alert-icon" aria-hidden="true">⚠</span>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="auth-form-group">
                        <label className="auth-label">Username</label>
                        <input
                            type="text"
                            name="username"
                            className="auth-input"
                            placeholder="Choose a username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="auth-form-row">
                        <div className="auth-form-group">
                            <label className="auth-label">First Name</label>
                            <input
                                type="text"
                                name="firstName"
                                className="auth-input"
                                placeholder="First"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="auth-form-group">
                            <label className="auth-label">Last Name</label>
                            <input
                                type="text"
                                name="lastName"
                                className="auth-input"
                                placeholder="Last"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="auth-form-group">
                        <label className="auth-label">Email</label>
                        <input
                            type="email"
                            name="email"
                            className="auth-input"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="auth-form-group">
                        <label className="auth-label">I am a...</label>
                        <p className="auth-hint">Select all that apply, or none</p>
                        <div className="role-chip-group">
                            {ROLE_OPTIONS.map(({ value, label }) => {
                                const active = formData.roles.includes(value);
                                return (
                                    <label key={value} className={`role-chip${active ? ' is-active' : ''}`}>
                                        <input
                                            type="checkbox"
                                            value={value}
                                            checked={active}
                                            onChange={handleRoleChange}
                                        />
                                        <span className="role-chip-box" aria-hidden="true">{active ? '✓' : ''}</span>
                                        <span className="role-chip-label">{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="auth-form-row">
                        <div className="auth-form-group">
                            <label className="auth-label">Password</label>
                            <input
                                type="password"
                                name="password"
                                className="auth-input"
                                value={formData.password}
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
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="auth-form-group">
                        <SecurityQuestionInput
                            value={formData.securityQuestion}
                            onChange={handleQuestionChange}
                            disabled={loading}
                        />
                    </div>

                    <div className="auth-form-group">
                        <label className="auth-label">Security Answer</label>
                        <input
                            type="text"
                            name="securityAnswer"
                            className="auth-input"
                            placeholder="Your answer"
                            value={formData.securityAnswer}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" disabled={loading} className="auth-btn">
                        {loading && <span className="auth-spinner" aria-hidden="true"></span>}
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>

                    <div className="auth-footer auth-footer--center">
                        <span>Already have an account? <button type="button" className="auth-link" onClick={() => navigate('/')}>Log In</button></span>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Signup;
