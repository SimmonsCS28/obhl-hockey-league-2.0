import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AdminDashboard.css';
import DraftDashboard from './DraftDashboard';
import PlayerManagement from './PlayerManagement';
import ScorekeeperContent from './ScorekeeperContent';
import SeasonManagement from './SeasonManagement';
import TeamManagement from './TeamManagement';

function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('teams');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        setMobileMenuOpen(false); // Auto-collapse on mobile
    };

    const handleScheduleClick = () => {
        navigate('/admin/schedule');
        setMobileMenuOpen(false); // Auto-collapse on mobile
    };

    return (
        <div className="admin-dashboard">
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
                        <span className="user-email">{user?.email}</span>
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
                </div>
            </nav>

            <main className="admin-content">
                {activeTab === 'teams' && <TeamManagement />}
                {activeTab === 'players' && <PlayerManagement />}
                {activeTab === 'seasons' && <SeasonManagement />}
                {activeTab === 'draft' && <DraftDashboard />}
                {activeTab === 'gameManagement' && <ScorekeeperContent />}
            </main>
        </div>
    );
}

export default AdminDashboard;
