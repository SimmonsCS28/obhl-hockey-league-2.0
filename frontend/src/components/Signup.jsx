import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import SecurityQuestionInput from './common/SecurityQuestionInput';
import './referee/Signup.css'; // Reuse existing styles

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
            const errorMessage = err.message || 'Failed to create account';
            // Extract meaningful message if it's a JSON string
            try {
                const parsed = JSON.parse(errorMessage);
                setError(parsed.message || errorMessage);
            } catch {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-card">
                <h2>Create Account</h2>
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>First Name</label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Last Name</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>I am a... (Select all that apply)</label>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#4a5568' }}>
                                <input
                                    type="checkbox"
                                    value="GOALIE"
                                    checked={formData.roles.includes('GOALIE')}
                                    onChange={handleRoleChange}
                                />
                                Goalie
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#4a5568' }}>
                                <input
                                    type="checkbox"
                                    value="REF"
                                    checked={formData.roles.includes('REF')}
                                    onChange={handleRoleChange}
                                />
                                Referee
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#4a5568' }}>
                                <input
                                    type="checkbox"
                                    value="SCOREKEEPER"
                                    checked={formData.roles.includes('SCOREKEEPER')}
                                    onChange={handleRoleChange}
                                />
                                Scorekeeper
                            </label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
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

                    <SecurityQuestionInput
                        value={formData.securityQuestion}
                        onChange={handleQuestionChange}
                        disabled={loading}
                    />

                    <div className="form-group">
                        <label>Security Answer</label>
                        <input
                            type="text"
                            name="securityAnswer"
                            value={formData.securityAnswer}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" disabled={loading} className="signup-btn">
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                    <div className="login-link">
                        Already have an account? <a href="/login">Log In</a>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Signup;
