import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import logo from '../assets/images/obi-logo-nav.png';
import { useAuth } from '../contexts/AuthContext';
import './GMLayout.css';

function GMLayout() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="gm-layout">
            <header className="gm-header">
                <div className="gm-header-top">
                    <div className="gm-header-left">
                        <Link to="/gm" className="gm-logo" onClick={() => setMobileMenuOpen(false)}>
                            <img src={logo} alt="OBHL Logo" className="gm-logo-img" />
                        </Link>
                        <h1>GM Portal</h1>
                        {user && (
                            <div className="gm-user-info">
                                <span className="user-name">{user.firstName} {user.lastName}</span>
                            </div>
                        )}
                    </div>

                    <button
                        className="hamburger-menu gm-hamburger"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>

                <div className={`gm-header-content ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                    <nav className="gm-nav">
                        <Link to="/gm" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                        <Link to="/gm/team" onClick={() => setMobileMenuOpen(false)}>My Team</Link>
                        <Link to="/gm/schedule" onClick={() => setMobileMenuOpen(false)}>Schedule</Link>
                    </nav>
                    <div className="gm-header-actions">
                        <button className="action-button secondary" onClick={() => { navigate('/user'); setMobileMenuOpen(false); }}>
                            My Dashboard
                        </button>
                        <button className="action-button secondary" onClick={() => { navigate('/'); setMobileMenuOpen(false); }}>
                            OBHL Home
                        </button>
                        <button className="action-button logout" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="gm-main">
                <Outlet />
            </main>
        </div>
    );
}

export default GMLayout;
