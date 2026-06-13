import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import './AdminLayout.css';

function AdminLayout({ children, activeTab }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { seasons, selectedSeasonId, setSelectedSeasonId, isHistoricalView } = useSeason();

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <h1>OBHL Admin</h1>
                        <div className="season-selector-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px' }}>
                            <label className="season-selector-label" style={{ margin: 0, lineHeight: 1 }}>Season</label>
                            <select
                                className="admin-season-selector"
                                value={selectedSeasonId || ''}
                                onChange={e => setSelectedSeasonId(Number(e.target.value))}
                                style={{
                                    background: '#1e293b',
                                    backgroundColor: '#1e293b',
                                    color: '#e2e8f0',
                                    border: '1px solid #475569',
                                    borderRadius: '6px',
                                    padding: '0.5rem 1.8rem 0.5rem 0.6rem',
                                    fontSize: '0.82rem',
                                    maxWidth: '200px',
                                    minWidth: '120px',
                                    cursor: 'pointer',
                                    appearance: 'none',
                                    WebkitAppearance: 'none',
                                    MozAppearance: 'none',
                                    lineHeight: '1.4',
                                    height: '36px',
                                    boxSizing: 'border-box',
                                }}
                            >
                                {seasons.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}{s.isActive ? ' ★' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        className="hamburger-menu"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                    <div className="admin-user-info" style={{ alignItems: 'center' }}>
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
                        <button
                            onClick={() => navigate('/account')}
                            className="public-site-btn"
                            title="Manage your account settings"
                        >
                            Account Settings
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
                        className={`nav-tab ${activeTab === 'announcements' ? 'active' : ''}`}
                        onClick={() => handleTabClick('announcements')}
                    >
                        📢 Announcements
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'rules' ? 'active' : ''}`}
                        onClick={() => handleTabClick('rules')}
                    >
                        📜 League Rules
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
                        <button onClick={() => { navigate('/account'); setMobileMenuOpen(false); }} className="nav-tab action-tab">
                            ⚙️ Account Settings
                        </button>
                        <button onClick={handleLogout} className="nav-tab logout-tab">
                            🚪 Logout
                        </button>
                    </div>
                </div>
            </nav>

            <main className="admin-content">
                {isHistoricalView && (
                    <div className="historical-banner">
                        📚 Viewing historical season — this view is read-only
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}

export default AdminLayout;
