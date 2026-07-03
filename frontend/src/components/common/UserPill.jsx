import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { resolveTeamColor, textOn } from '../../constants/teamColors';
import './UserPill.css';

/**
 * Shared logged-in identity pill (v4 §2b). Used in the public/dashboard header, the
 * Coordinator Console, and the Admin console so the nav identity is consistent everywhere.
 * Avatar/name → /dashboard; conditional Coordinator/Admin links; Log Out.
 */
function UserPill() {
    const navigate = useNavigate();
    const { user, logout, isAdmin, hasAnyRole } = useAuth();
    if (!user) return null;

    const teamHex = user?.teamColor ? resolveTeamColor(user.teamColor) : '#F6A91C';
    const nameSource = user?.firstName || user?.username || user?.email || 'Account';
    const initials = nameSource.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const isCoord = hasAnyRole('GOALIE_COORDINATOR', 'REF_COORDINATOR', 'SCOREKEEPER_COORDINATOR');

    const handleLogout = () => { logout(); navigate('/'); };

    return (
        <div className="obi-user-pill">
            <button className="obi-pill-id" onClick={() => navigate('/dashboard')} title="My dashboard">
                <span className="obi-pill-avatar" style={{ background: teamHex, color: textOn(teamHex) }}>{initials}</span>
                <span className="obi-pill-name">
                    <span className="obi-pill-first">{user?.firstName || user?.username || 'Account'}</span>
                    {user?.teamName && <span className="obi-pill-team">{user.teamName}</span>}
                </span>
            </button>
            {isCoord && <button className="obi-pill-link" onClick={() => navigate('/coordinator')}>Coordinator</button>}
            {isAdmin && <button className="obi-pill-link obi-pill-link--admin" onClick={() => navigate('/admin')}>Admin</button>}
            <button className="obi-pill-link obi-pill-link--logout" onClick={handleLogout}>Log Out</button>
        </div>
    );
}

export default UserPill;
