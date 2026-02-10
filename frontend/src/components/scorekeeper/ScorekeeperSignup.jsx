import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../services/api';
import SecurityQuestionInput from '../common/SecurityQuestionInput';
import '../referee/Signup.css'; // Shared signup styles

const ScorekeeperSignup = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
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

        if (!formData.securityQuestion || !formData.securityAnswer) {
            return setError('Please complete the security question section');
        }

        setLoading(true);
        try {
            await api.scorekeeperSignup({
                username: formData.username,
                email: formData.email,
                password: formData.password,
                securityQuestion: formData.securityQuestion,
                securityAnswer: formData.securityAnswer
            });
            navigate('/login', { state: { message: 'Account created successfully! Please log in.' } });
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-card">
                <h2>Scorekeeper Signup</h2>
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

export default ScorekeeperSignup;
