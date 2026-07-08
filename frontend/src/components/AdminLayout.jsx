import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/images/buzzard-logo.png';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import UserPill from './common/UserPill';
import SeasonSelector from './common/SeasonSelector';
import './AdminLayout.css';

// Sidebar nav. Items use ?tab= except Schedule which is its own route.
const NAV = [
    { group: 'Operations' },
    { id: 'overview', label: 'Overview' },
    { id: 'livescore', label: 'Live Score Entry' },
    { id: 'gamemgmt', label: 'Game Management' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'standings', label: 'Standings' },
    { group: 'League Setup' },
    { route: '/admin/schedule', label: 'Schedule' },
    { id: 'seasons', label: 'Seasons' },
    { id: 'teams', label: 'Teams' },
    { id: 'players', label: 'Players' },
    { id: 'draft', label: 'Draft Tool', badge: true },
    { group: 'People' },
    { id: 'users', label: 'Users & Roles' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'rules', label: 'Rules Editor' },
    // Launcher — opens the role-scoped Coordinator Console (external to the admin shell), per v4 §2c
    { route: '/coordinator', label: 'Coordinator Console' },
    { group: 'Scheduling' },
    { id: 'goalies', label: 'Goalie Schedule' },
    { id: 'referees', label: 'Referee Schedule' },
    { id: 'scorekeepers', label: 'Scorekeeper Schedule' },
];

function AdminLayout({ children, activeTab }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const { user } = useAuth();
    const { seasons, selectedSeasonId, setSelectedSeasonId, isHistoricalView } = useSeason();
    const navigate = useNavigate();
    const location = useLocation();

    const isScheduleRoute = location.pathname === '/admin/schedule';

    // Map legacy tab id to current equivalent for highlighting
    const resolvedTab = activeTab === 'gameManagement' ? 'livescore' : activeTab;

    const isActive = (item) =>
        item.route ? location.pathname === item.route : (resolvedTab === item.id && !isScheduleRoute);

    const handleNav = (item) => {
        navigate(item.route ? item.route : `/admin?tab=${item.id}`);
        setMobileOpen(false);
    };

    const activeItem = NAV.find(i => i.id && isActive(i)) || (isScheduleRoute ? NAV.find(i => i.route) : null);
    const pageTitle = activeItem?.label || 'Admin Console';
    const pageSub = activeItem?.id === 'overview' ? 'League snapshot and action items'
        : activeItem?.id === 'livescore' ? 'Live game scoring'
        : activeItem?.id === 'gamemgmt' ? 'Box-score editor for completed games'
        : activeItem?.id === 'assignments' ? 'Assign goalies, referees and scorekeepers'
        : 'OBHL administration';

    const initials = (() => {
        if (user?.firstName || user?.lastName) {
            return `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase() || 'AD';
        }
        return (user?.username || 'AD').slice(0, 2).toUpperCase();
    })();

    const activeSeasonName = seasons?.find(s => s.id === selectedSeasonId)?.name || 'No season';

    return (
        <div className="obi-admin-shell">
            <aside className={`obi-side ${mobileOpen ? 'is-open' : ''}`}>
                <div className="obi-side-brand">
                    <img src={logo} alt="OBHL" className="obi-side-logo" />
                    <span className="obi-side-brand-text">
                        <span className="obi-side-brand-top">OBHL</span>
                        <span className="obi-side-brand-sub">ADMIN CONSOLE</span>
                    </span>
                    <button className="obi-side-burger" onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu">
                        <span></span><span></span><span></span>
                    </button>
                </div>

                <nav className="obi-side-nav">
                    {NAV.map((item, i) => (
                        item.group ? (
                            <div key={`g-${i}`} className="obi-side-group">{item.group}</div>
                        ) : (
                            <button
                                key={item.id || item.route}
                                className={`obi-side-item ${isActive(item) ? 'is-active' : ''}`}
                                onClick={() => handleNav(item)}
                            >
                                {item.label}
                                {item.badge && <span className="obi-side-item-badge">Soon</span>}
                            </button>
                        )
                    ))}
                </nav>

                <div className="obi-side-foot">
                    <span className="obi-side-avatar">{initials}</span>
                    <span className="obi-side-foot-text">
                        <span className="obi-side-foot-name">{user?.firstName || user?.username || 'Admin'}</span>
                        <button className="obi-side-foot-link" onClick={() => navigate('/')}>← View public site</button>
                    </span>
                </div>
            </aside>

            <main className="obi-admin-main">
                <div className="obi-admin-topbar">
                    <button className="obi-side-burger obi-topbar-burger" onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu">
                        <span></span><span></span><span></span>
                    </button>
                    <div className="obi-admin-titles">
                        <div className="obi-admin-title">{pageTitle}</div>
                        <div className="obi-admin-sub">{pageSub}</div>
                    </div>
                    <div className="obi-admin-topbar-right">
                        {seasons?.length > 0 ? (
                            <SeasonSelector
                                seasons={seasons}
                                selectedSeasonId={selectedSeasonId}
                                onChange={setSelectedSeasonId}
                                size="sm"
                                align="right"
                                caption="Drives every admin tab"
                                menuHint="Select Season · applies everywhere"
                            />
                        ) : (
                            <span className="obi-admin-season-badge">{activeSeasonName}</span>
                        )}
                        <UserPill />
                    </div>
                </div>

                <div className="obi-admin-content">
                    {isHistoricalView && (
                        <div className="obi-admin-historical">📚 Viewing historical season — this view is read-only</div>
                    )}
                    {children}
                </div>
            </main>

            {mobileOpen && <div className="obi-side-scrim" onClick={() => setMobileOpen(false)} />}
        </div>
    );
}

export default AdminLayout;
