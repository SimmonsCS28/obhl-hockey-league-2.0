import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import logo from '../assets/images/obi-logo-nav.png';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';
import './PublicLayout.css';

function PublicLayout() {
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { user, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="public-layout">
            <header className="public-header">
                <div className="header-content">
                    <Link to="/" className="logo" onClick={closeMobileMenu}>
                        <img src={logo} alt="OBHL Logo" className="logo-img" />
                    </Link>

                    {/* Hamburger button for mobile */}
                    <button
                        className="mobile-menu-toggle"
                        onClick={toggleMobileMenu}
                        aria-label="Toggle menu"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>

                    <nav className={`main-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                        <Link to="/" onClick={closeMobileMenu}>Home</Link>
                        <Link to="/seasons" onClick={closeMobileMenu}>Seasons</Link>
                        <Link to="/teams" onClick={closeMobileMenu}>Teams</Link>
                        <Link to="/players" onClick={closeMobileMenu}>Players</Link>
                        <Link to="/standings" onClick={closeMobileMenu}>Standings</Link>
                        <Link to="/schedule" onClick={closeMobileMenu}>Schedule</Link>
                    </nav>
                    <div className={`donate-section ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                        <DonateButton />
                    </div>
                    <div className={`auth-section ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                        {isAuthenticated ? (
                            <>
                                <span className="user-greeting">Hi, {user?.username || user?.email}</span>
                                {user?.role === 'GM' && (
                                    <button
                                        className="dashboard-link"
                                        onClick={() => {
                                            navigate('/gm');
                                            closeMobileMenu();
                                        }}
                                    >
                                        GM Dashboard
                                    </button>
                                )}
                                {(user?.role === 'ADMIN' || user?.role === 'SCOREKEEPER') && (
                                    <button
                                        className="dashboard-link"
                                        onClick={() => {
                                            navigate(user?.role === 'SCOREKEEPER' ? '/scorekeeper' : '/admin');
                                            closeMobileMenu();
                                        }}
                                    >
                                        Dashboard
                                    </button>
                                )}
                                <button className="logout-btn" onClick={() => { handleLogout(); closeMobileMenu(); }}>Logout</button>
                            </>
                        ) : (
                            <button
                                className="login-btn"
                                onClick={() => { setIsLoginModalOpen(true); closeMobileMenu(); }}
                            >
                                Login
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="public-main">
                <Outlet />
            </main>

            <footer className="public-footer">
                <p>&copy; {new Date().getFullYear()} Old Buzzard Hockey League. All rights reserved.</p>
            </footer>

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
            />
        </div>
    );
}

export default PublicLayout;
