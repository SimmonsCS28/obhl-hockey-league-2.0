import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSeason } from '../../contexts/SeasonContext';
import api from '../../services/api';
import logo from '../../assets/images/buzzard-logo.png';
import bannerBg from '../../assets/images/buzzard-banner.png';
import CoordinatorBoard from './CoordinatorBoard';
import UserPill from '../common/UserPill';
import './Coordinator.css';

function CoordinatorDashboard() {
    const { hasRole, isAdmin } = useAuth();
    const { selectedSeasonId } = useSeason();
    const seasonId = selectedSeasonId ?? 13;

    const canGoalie = isAdmin || hasRole('GOALIE_COORDINATOR');
    const canRef = isAdmin || hasRole('REF_COORDINATOR');
    const canScorekeeper = isAdmin || hasRole('SCOREKEEPER_COORDINATOR');

    const roleTabs = [];
    if (canGoalie) roleTabs.push({ key: 'GOALIE', label: 'Goalie' });
    if (canRef) roleTabs.push({ key: 'REF', label: 'Referee' });
    if (canScorekeeper) roleTabs.push({ key: 'SCOREKEEPER', label: 'Scorekeeper' });

    const [activeRole, setActiveRole] = useState(roleTabs[0]?.key || 'GOALIE');
    const [alertCounts, setAlertCounts] = useState({});

    useEffect(() => {
        const loadAlerts = async () => {
            const results = {};
            await Promise.allSettled(
                roleTabs.map(async t => {
                    try {
                        const assignments = await api.getCoordinatorAssignments(seasonId, t.key);
                        results[t.key] = (assignments || []).filter(a => a.status === 'SIGNED_UP').length;
                    } catch {
                        results[t.key] = 0;
                    }
                })
            );
            setAlertCounts(results);
        };
        if (roleTabs.length) loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (roleTabs.length === 0) {
        return (
            <div className="cc-page">
                <div className="cc-content" style={{ paddingTop: 80, textAlign: 'center' }}>
                    <p style={{ color: 'var(--obi-text-muted)', fontFamily: 'var(--obi-font-body)' }}>
                        You don&apos;t have a coordinator role assigned.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="cc-page">
            {/* Sticky header */}
            <header className="cc-header">
                <div className="cc-header-inner">
                    <Link to="/" className="cc-header-brand">
                        <img src={logo} alt="OBHL" className="cc-header-logo" />
                        <span className="cc-header-wordmark">
                            <span className="cc-wordmark-top">OLD BUZZARD</span>
                            <span className="cc-wordmark-sub">HOCKEY LEAGUE</span>
                        </span>
                    </Link>
                    <nav className="cc-header-nav">
                        <UserPill />
                    </nav>
                </div>
            </header>

            {/* Banner */}
            <section className="cc-banner">
                <img src={bannerBg} alt="" className="cc-banner-bg" />
                <div className="cc-banner-overlay" />
                <div className="cc-banner-inner">
                    <div className="cc-banner-eyebrow">
                        <span className="cc-banner-badge">Gated · Coordinator</span>
                        <span className="cc-banner-label">Assignment Console</span>
                    </div>
                    <h1 className="cc-banner-title">Scheduling Console</h1>
                    <p className="cc-banner-sub">
                        Assign players to each game&apos;s open slots, confirm self sign-ups, and track who&apos;s confirmed.
                        Assigning sends an email and shows pending until the player accepts.
                        Confirmed slots publish to live score entry and game management.
                    </p>
                </div>
            </section>

            {/* Role tabs */}
            <div className="cc-tabs-bar">
                <div className="cc-tabs-inner">
                    {roleTabs.map(t => {
                        const count = alertCounts[t.key] || 0;
                        const active = activeRole === t.key;
                        return (
                            <button
                                key={t.key}
                                className={`cc-role-tab${active ? ' is-active' : ''}`}
                                onClick={() => setActiveRole(t.key)}
                            >
                                {t.label} Coordinator
                                {count > 0 && <span className="cc-tab-badge">{count}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Board */}
            <div className="cc-content">
                <CoordinatorBoard key={activeRole} role={activeRole} />
            </div>

            {/* Footer */}
            <footer className="cc-footer">
                <div className="cc-footer-inner">
                    <span className="cc-footer-copy">© 2026 Old Buzzard Hockey League · Sun Prairie, WI</span>
                    <Link to="/dashboard" className="cc-footer-link">Back to Dashboard</Link>
                </div>
            </footer>
        </div>
    );
}

export default CoordinatorDashboard;
