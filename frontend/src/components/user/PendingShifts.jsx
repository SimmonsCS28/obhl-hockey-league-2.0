import { useEffect, useState } from 'react';
import api from '../../services/api';
import './PendingShifts.css';

/**
 * In-app list of shifts proposed to the current user, with confirm/decline.
 * Renders nothing when there are no pending shifts.
 */
function PendingShifts() {
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');

    const load = async () => {
        try {
            const data = await api.getPendingShifts();
            setShifts(data || []);
        } catch {
            // Non-fatal: just don't show the section
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const respond = async (shift, action) => {
        let reason = null;
        if (action === 'decline') {
            reason = window.prompt('Optional: let the coordinator know why you can\'t make it', '') || '';
        }
        setBusyId(shift.id);
        setError('');
        try {
            await api.respondToShift(shift.id, action, reason);
            setShifts(prev => prev.filter(s => s.id !== shift.id));
        } catch (e) {
            setError(e.message || 'Failed to update shift');
        } finally {
            setBusyId(null);
        }
    };

    const roleLabel = (role) =>
        role === 'REF' ? 'Referee' : role === 'SCOREKEEPER' ? 'Scorekeeper' : 'Goalie';
    const formatDate = (s) => {
        if (!s) return 'TBD';
        const d = new Date(s.endsWith && s.endsWith('Z') ? s : s + 'Z');
        const TZ = 'America/Chicago';
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })
            + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
    };

    if (loading || shifts.length === 0) return null;

    return (
        <div className="pending-shifts">
            <h2 className="pending-shifts-title">⏳ Pending Shift Confirmations</h2>
            <p className="pending-shifts-sub">You've been assigned the following shift(s). Please confirm or decline.</p>
            {error && <div className="pending-shifts-error">{error}</div>}
            <div className="pending-shifts-list">
                {shifts.map(s => (
                    <div key={s.id} className="pending-shift-card">
                        <div className="pending-shift-info">
                            <span className="pending-shift-role">{roleLabel(s.role)} (Slot {s.slot})</span>
                            <span className="pending-shift-matchup">{s.homeTeam} vs {s.awayTeam}</span>
                            <span className="pending-shift-meta">{formatDate(s.gameDate)}{s.rink ? ` · ${s.rink}` : ''}</span>
                        </div>
                        <div className="pending-shift-actions">
                            <button className="btn-confirm" disabled={busyId === s.id} onClick={() => respond(s, 'confirm')}>
                                {busyId === s.id ? '...' : 'Confirm'}
                            </button>
                            <button className="btn-decline" disabled={busyId === s.id} onClick={() => respond(s, 'decline')}>
                                Decline
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default PendingShifts;
