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
                <div className="gm-header-left">
                    <Link to="/gm" className="gm-logo">
                        <img src={logo} alt="OBHL Logo" className="gm-logo-img" />
                    </Link>
                    <h1>GM Portal</h1>
                    <nav className="gm-nav">
                        <Link to="/gm">Dashboard</Link>
                        <Link to="/gm/team">My Team</Link>
                        <Link to="/gm/schedule">Schedule</Link>
                    </nav>
                </div>
                <div className="gm-header-actions">
                    <button className="action-button secondary" onClick={() => navigate('/user')}>
                        My Dashboard
                    </button>
                    <button className="action-button secondary" onClick={() => navigate('/')}>
                        OBHL Home
                    </button>
                    <button className="action-button logout" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </header>

            <main className="gm-main">
                <Outlet />
            </main>
        </div>
    );
}

export default GMLayout;
