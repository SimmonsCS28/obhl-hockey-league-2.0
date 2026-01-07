import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import logo from '../assets/images/obi-logo-nav.png';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';
import './PublicLayout.css';

function PublicLayout() {
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const { user, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="public-layout">
            <header className="public-header">
                <div className="header-content">
                    <Link to="/" className="logo">
                        <img src={logo} alt="OBHL Logo" className="logo-img" />
                    </Link>
                    <nav className="main-nav">
                        <Link to="/">Home</Link>
                        <Link to="/seasons">Seasons</Link>
                        <Link to="/teams">Teams</Link>
                        <Link to="/players">Players</Link>
                        <Link to="/standings">Standings</Link>
                        <Link to="/schedule">Schedule</Link>
                    </nav>
                    <div className="auth-section">
                        {isAuthenticated ? (
                            <>
                                <span className="user-greeting">Hi, {user?.username || user?.email}</span>
                                {(user?.role === 'ADMIN' || user?.role === 'SCOREKEEPER') && (
                                    <button
                                        className="dashboard-link"
                                        onClick={() => navigate(user?.role === 'SCOREKEEPER' ? '/scorekeeper' : '/admin')}
                                    >
                                        Dashboard
                                    </button>
                                )}
                                <button className="logout-btn" onClick={handleLogout}>Logout</button>
                            </>
                        ) : (
                            <button
                                className="login-btn"
                                onClick={() => setIsLoginModalOpen(true)}
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
