import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/images/buzzard-logo.png';
import { useAuth } from '../contexts/AuthContext';
import UserPill from './common/UserPill';
import DonateButton from './DonateButton';
import DonatePopup from './DonatePopup';
import LoginModal from './LoginModal';
import './PublicLayout.css';

const NAV_LINKS = [
    { to: '/', label: 'Home' },
    { to: '/seasons', label: 'Seasons' },
    { to: '/teams', label: 'Teams' },
    { to: '/players', label: 'Players' },
    { to: '/standings', label: 'Standings' },
    { to: '/schedule', label: 'Schedule' },
    { to: '/rules', label: 'Rules' },
];

function PublicLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { isAuthenticated } = useAuth();

    // Close mobile menu on resize to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 760) {
                setIsMobileMenuOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Open the login modal when navigated here with state.openLogin (e.g. from ForgotPassword/ResetPassword)
    useEffect(() => {
        if (location.state?.openLogin) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to navigation state, not derivable during render
            setIsLoginModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    const isActive = (to) =>
        to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

    const authActions = () => (
        isAuthenticated ? <UserPill /> : (
            <>
                <Link to="/signup" className="obi-ghost-btn" onClick={closeMobileMenu}>Create Account</Link>
                <button
                    className="obi-cta-btn"
                    onClick={() => { setIsLoginModalOpen(true); closeMobileMenu(); }}
                >
                    Log In
                </button>
            </>
        )
    );

    return (
        <div className="obi-public-layout">
            <header className="obi-header">
                <div className="obi-header-inner">
                    <Link to="/" className="obi-brand" onClick={closeMobileMenu}>
                        <img src={logo} alt="OBHL" className="obi-brand-logo" />
                        <span className="obi-wordmark">
                            <span className="obi-wordmark-top">OLD BUZZARD</span>
                            <span className="obi-wordmark-sub">HOCKEY LEAGUE</span>
                        </span>
                    </Link>

                    <button
                        className="obi-burger"
                        onClick={() => setIsMobileMenuOpen(o => !o)}
                        aria-label="Menu"
                    >
                        <span></span><span></span><span></span>
                    </button>

                    <nav className="obi-nav" data-open={isMobileMenuOpen}>
                        {NAV_LINKS.map(link => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`obi-nav-link ${isActive(link.to) ? 'is-active' : ''}`}
                                onClick={closeMobileMenu}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className="obi-nav-actions">
                            <DonateButton />
                            {authActions()}
                        </div>
                    </nav>
                </div>
            </header>

            <main className="obi-public-main">
                <Outlet />
            </main>

            <footer className="obi-footer">
                <div className="obi-footer-top obi-container">
                    <div className="obi-footer-brand">
                        <div className="obi-footer-brand-row">
                            <img src={logo} alt="OBHL" className="obi-footer-logo" />
                            <span className="obi-footer-wordmark">OLD BUZZARD HOCKEY</span>
                        </div>
                        <p className="obi-footer-tagline">
                            Adult beer-league hockey at the Sun Prairie Ice Arena. Old birds, sharp talons, since 2009.
                        </p>
                    </div>
                    <div className="obi-footer-cols">
                        <div className="obi-footer-col">
                            <div className="obi-footer-col-title">League</div>
                            <Link to="/schedule">Schedule</Link>
                            <Link to="/standings">Standings</Link>
                            <Link to="/teams">Teams</Link>
                            <Link to="/players">Players</Link>
                        </div>
                        <div className="obi-footer-col">
                            <div className="obi-footer-col-title">Season</div>
                            <Link to="/">Home</Link>
                            <Link to="/seasons">Seasons</Link>
                            <Link to="/rules">Rules &amp; Bylaws</Link>
                        </div>
                        <div className="obi-footer-col">
                            <div className="obi-footer-col-title">My Account</div>
                            {isAuthenticated ? (
                                <>
                                    <Link to="/dashboard">My Dashboard</Link>
                                    <Link to="/account">Account Settings</Link>
                                </>
                            ) : (
                                <>
                                    <button className="obi-footer-linkbtn" onClick={() => setIsLoginModalOpen(true)}>Log In</button>
                                    <Link to="/signup">Create Account</Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="obi-footer-bottom">
                    <div className="obi-container obi-footer-bottom-inner">
                        <span>© {new Date().getFullYear()} Old Buzzard Hockey League · Sun Prairie, WI</span>
                        <span>All rights reserved.</span>
                    </div>
                </div>
            </footer>

            {isLoginModalOpen && (
                <LoginModal
                    isOpen={isLoginModalOpen}
                    onClose={() => setIsLoginModalOpen(false)}
                />
            )}

            <DonatePopup />
        </div>
    );
}

export default PublicLayout;
