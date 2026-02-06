import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './UserDashboard.css';

const UserDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const hasRole = (roleName) => {
        return user?.roles?.includes(roleName);
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="user-dashboard">
            <div className="dashboard-header">
                <h1>My Shifts Dashboard</h1>
                <div className="header-buttons">
                    <button
                        className="home-button"
                        onClick={() => navigate('/')}
                    >
                        OBHL Home
                    </button>
                    <button
                        className="logout-button"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="role-cards">
                {hasRole('GOALIE') && (
                    <div className="role-card">
                        <h2>Goalie</h2>
                        <p>Manage your goalie availability for upcoming games</p>
                        <button onClick={() => navigate('/user/goalie')}>
                            Manage Availability
                        </button>
                    </div>
                )}

                {hasRole('REF') && (
                    <div className="role-card">
                        <h2>Referee</h2>
                        <p>View and sign up for referee shifts</p>
                        <button onClick={() => navigate('/user/referee')}>
                            View & Sign Up for Shifts
                        </button>
                    </div>
                )}

                {hasRole('SCOREKEEPER') && (
                    <div className="role-card">
                        <h2>Scorekeeper</h2>
                        <p>View and sign up for scorekeeper shifts</p>
                        <button onClick={() => navigate('/user/scorekeeper')}>
                            View & Sign Up for Shifts
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserDashboard;
