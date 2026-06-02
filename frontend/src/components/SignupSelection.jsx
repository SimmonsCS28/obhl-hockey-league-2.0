import { useNavigate } from 'react-router-dom';
import './SignupSelection.css'; // New CSS file for this page

const SignupSelection = () => {
    const navigate = useNavigate();

    return (
        <div className="signup-selection-container">
            <div className="signup-selection-card">
                <h2>Create Your Account</h2>
                <p>Select your role to get started:</p>

                <div className="role-options">
                    <button
                        className="role-btn referee"
                        onClick={() => navigate('/signup/referee')}
                    >
                        I am a Referee
                    </button>

                    <button
                        className="role-btn scorekeeper"
                        onClick={() => navigate('/signup/scorekeeper')}
                    >
                        I am a Scorekeeper
                    </button>

                    <button
                        className="role-btn goalie"
                        onClick={() => navigate('/signup/goalie')}
                    >
                        I am a Goalie
                    </button>
                </div>

                <div className="login-link">
                    Already have an account? <button type="button" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>Log In</button>
                </div>
            </div>
        </div>
    );
};

export default SignupSelection;
