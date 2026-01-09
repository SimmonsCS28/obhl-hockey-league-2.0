import { Link, Outlet, useNavigate } from 'react-router-dom';
import logo from '../assets/images/obi-logo-nav.png';
import { useAuth } from '../contexts/AuthContext';
import './GMLayout.css';

function GMLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="gm-layout">
            <header className="gm-header">
                <div className="gm-header-content">
                    <Link to="/gm" className="gm-logo">
                        <img src={logo} alt="OBHL Logo" className="gm-logo-img" />
                    </Link>
                    <nav className="gm-nav">
                        <Link to="/gm">Dashboard</Link>
                        <Link to="/gm/team">My Team</Link>
                        <Link to="/gm/schedule">Schedule</Link>
                    </nav>
                    <div className="gm-user-section">
                        <span className="gm-greeting">Hi, {user?.username}</span>
                        <Link to="/" className="btn-secondary">Back to Public Site</Link>
                        <button onClick={handleLogout} className="btn-logout">Logout</button>
                    </div>
                </div>
            </header>

            <main className="gm-main">
                <Outlet />
            </main>

            <footer className="gm-footer">
                <p>&copy; {new Date().getFullYear()} Old Buzzard Hockey League GM Portal</p>
            </footer>
        </div>
    );
}

export default GMLayout;
