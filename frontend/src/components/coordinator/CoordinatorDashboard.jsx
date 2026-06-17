import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/images/obi-logo-nav.png';
import CoordinatorBoard from './CoordinatorBoard';
import './Coordinator.css';

function CoordinatorDashboard() {
    const navigate = useNavigate();
    const { user, logout, hasRole, isAdmin } = useAuth();

    const canGoalie = isAdmin || hasRole('GOALIE_COORDINATOR');
    const canRef = isAdmin || hasRole('REF_COORDINATOR');

    const roleTabs = [];
    if (canGoalie) roleTabs.push({ key: 'GOALIE', label: 'Goalie' });
    if (canRef) roleTabs.push({ key: 'REF', label: 'Referee' });

    const [activeRole, setActiveRole] = useState(roleTabs[0]?.key || 'GOALIE');

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="coordinator-layout">
            <header className="coordinator-header">
                <div className="coordinator-header-left">
                    <img src={logo} alt="OBHL" className="coordinator-logo" />
                    <h1>Coordinator Portal</h1>
                    {user && <span className="coordinator-user">{user.firstName || user.username}</span>}
                </div>
                <div className="coordinator-header-actions">
                    <button className="action-button secondary" onClick={() => navigate('/user')}>My Dashboard</button>
                    <button className="action-button secondary" onClick={() => navigate('/')}>OBHL Home</button>
                    <button className="action-button logout" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            <main className="coordinator-main">
                {roleTabs.length === 0 ? (
                    <div className="empty-state">You don't have a coordinator role assigned.</div>
                ) : (
                    <>
                        {roleTabs.length > 1 && (
                            <div className="coordinator-role-tabs">
                                {roleTabs.map(t => (
                                    <button
                                        key={t.key}
                                        className={`coordinator-role-tab ${activeRole === t.key ? 'active' : ''}`}
                                        onClick={() => setActiveRole(t.key)}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <CoordinatorBoard key={activeRole} role={activeRole} />
                    </>
                )}
            </main>
        </div>
    );
}

export default CoordinatorDashboard;
