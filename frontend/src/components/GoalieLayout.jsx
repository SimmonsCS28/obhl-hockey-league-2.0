import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './GoalieLayout.css'; // We'll create this CSS next

const GoalieLayout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="goalie-layout">
            <nav className="goalie-nav">
                <div className="nav-brand">OBHL Goalie Portal</div>
                <div className="nav-links">
                    <Link to="/goalie">My Schedule</Link>
                </div>
                <div className="nav-user">
                    <span>{user?.username}</span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </nav>
            <main className="goalie-content">
                <Outlet />
            </main>
        </div>
    );
};

export default GoalieLayout;
