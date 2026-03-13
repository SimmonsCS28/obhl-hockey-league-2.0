import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AdminLayout.css';

function AdminLayout({ children, activeTab }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleTabClick = (tabId) => {
        navigate(`/admin?tab=${tabId}`);
        setMobileMenuOpen(false);
    };

    const handleScheduleClick = () => {
        navigate('/admin/schedule');
        setMobileMenuOpen(false);
    };

    return (
        <div className="admin-layout">
            <nav className="admin-nav">
                <div className="admin-nav-header">
                    <h1>OBHL Admin</h1>
                    <button
                        className="hamburger-menu"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                    <div className="admin-user-info">
                        <div className="admin-user-details">
                            <span className="user-name">{user?.firstName} {user?.lastName}</span>
                            <span className="user-email">{user?.email}</span>
                        </div>
                        <button
                            onClick={() => navigate('/user')}
                            className="public-site-btn"
                            title="Go to my personal dashboard"
                        >
                            My Dashboard
                        </button>
                        {user?.roles?.some(role => ['REF', 'GOALIE', 'SCOREKEEPER'].includes(role)) && (
                            <button
                                onClick={() => navigate('/user/shifts')}
                                className="public-site-btn"
                                title="View my shifts"
                            >
                                My Shifts
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/')}
                            className="public-site-btn"
                        >
                            Public Site
                        </button>
                        <button onClick={handleLogout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
                <div className={`admin-nav-tabs ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                    <button
                        className={`nav-tab ${activeTab === 'teams' ? 'active' : ''}`}
                        onClick={() => handleTabClick('teams')}
                    >
                        Teams
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'players' ? 'active' : ''}`}
                        onClick={() => handleTabClick('players')}
                    >
                        Players
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'seasons' ? 'active' : ''}`}
                        onClick={() => handleTabClick('seasons')}
                    >
                        Seasons
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'draft' ? 'active' : ''}`}
                        onClick={() => handleTabClick('draft')}
                    >
                        Draft Tool
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'gameManagement' ? 'active' : ''}`}
                        onClick={() => handleTabClick('gameManagement')}
                    >
                        Game Management
                    </button>
                    <button
                        className="nav-tab"
                        onClick={handleScheduleClick}
                    >
                        📅 Schedule Manager
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => handleTabClick('users')}
                    >
                        Users
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'goalies' ? 'active' : ''}`}
                        onClick={() => handleTabClick('goalies')}
                    >
                        🥅 Goalie Schedule
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'referees' ? 'active' : ''}`}
                        onClick={() => handleTabClick('referees')}
                    >
                        👔 Referee Schedule
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'scorekeepers' ? 'active' : ''}`}
                        onClick={() => handleTabClick('scorekeepers')}
                    >
                        📋 Scorekeeper Schedule
                    </button>
                    <div className="mobile-admin-actions">
                        <div className="mobile-user-email">{user?.email}</div>
                        <button onClick={() => navigate('/user')} className="nav-tab action-tab">
                            👤 My Dashboard
                        </button>
                        {user?.roles?.some(role => ['REF', 'GOALIE', 'SCOREKEEPER'].includes(role)) && (
                            <button onClick={() => navigate('/user/shifts')} className="nav-tab action-tab">
                                ⏱️ My Shifts
                            </button>
                        )}
                        <button onClick={() => navigate('/')} className="nav-tab action-tab">
                            🌐 Public Site
                        </button>
                        <button onClick={handleLogout} className="nav-tab logout-tab">
                            🚪 Logout
                        </button>
                    </div>
                </div>
            </nav>

            <main className="admin-content">
                {children}
            </main>
        </div>
    );
}

export default AdminLayout;
