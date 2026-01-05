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
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="admin-dashboard">
            <nav className="admin-nav">
                <div className="admin-nav-header">
                    <h1>OBHL Admin</h1>
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
                <div className="admin-nav-tabs">
                    <button
                        className={`nav-tab ${activeTab === 'teams' ? 'active' : ''}`}
                        onClick={() => setActiveTab('teams')}
                    >
                        Teams
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'players' ? 'active' : ''}`}
                        onClick={() => setActiveTab('players')}
                    >
                        Players
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'seasons' ? 'active' : ''}`}
                        onClick={() => setActiveTab('seasons')}
                    >
                        Seasons
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'draft' ? 'active' : ''}`}
                        onClick={() => setActiveTab('draft')}
                    >
                        Draft Tool
                    </button>
                    <button
                        className={`nav-tab ${activeTab === 'gameManagement' ? 'active' : ''}`}
                        onClick={() => setActiveTab('gameManagement')}
                    >
                        Game Management
                    </button>
                    <button
                        className="nav-tab"
                        onClick={() => navigate('/admin/schedule')}
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
