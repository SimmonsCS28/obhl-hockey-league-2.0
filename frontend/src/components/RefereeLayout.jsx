import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './RefereeLayout.css'; // We'll create this CSS next

const RefereeLayout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="referee-layout">
            <nav className="referee-nav">
                <div className="nav-brand">OBHL Referee Portal</div>
                <div className="nav-links">
                    <Link to="/referee">My Schedule</Link>
                    {/* Add more links as needed */}
                </div>
                <div className="nav-user">
                    <span>{user?.username}</span>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </nav>
            <main className="referee-content">
                <Outlet />
            </main>
        </div>
    );
};

export default RefereeLayout;
