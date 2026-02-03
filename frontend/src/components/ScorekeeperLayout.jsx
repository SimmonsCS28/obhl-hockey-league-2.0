import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './ScorekeeperLayout.css'; // We'll create this CSS next

const ScorekeeperLayout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="scorekeeper-layout">
            <nav className="scorekeeper-nav">
                <div className="nav-brand">OBHL Scorekeeper Portal</div>
                <div className="nav-links">
                    <Link to="/scorekeeper">My Schedule</Link>
                </div>
                <div className="nav-user">
                    <span>{user?.username}</span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </nav>
            <main className="scorekeeper-content">
                <Outlet />
            </main>
        </div>
    );
};

export default ScorekeeperLayout;
