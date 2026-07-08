import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../services/api';
import './ConfirmShift.css';

const TZ = 'America/Chicago';

const ConfirmShift = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');
    const token = searchParams.get('token') || '';

    const [shift, setShift] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showDecline, setShowDecline] = useState(false);
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (!id || !token) {
            setError('This confirmation link is invalid.');
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const data = await api.getShiftByToken(id, token);
                setShift(data);
            } catch (err) {
                setError(err.message || 'This confirmation link is invalid or has expired.');
            } finally {
                setLoading(false);
            }
        })();
    }, [id, token]);

    const respond = async (action) => {
        setSubmitting(true);
        setError('');
        try {
            const updated = await api.respondToShiftByToken(id, token, action, action === 'decline' ? reason : null);
            setShift(updated);
            setMessage(action === 'confirm'
                ? 'Thanks! Your shift is confirmed.'
                : 'Thanks for letting us know. Your coordinator has been notified you can\'t make it.');
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const roleLabel = (role) =>
        role === 'REF' ? 'Referee' : role === 'SCOREKEEPER' ? 'Scorekeeper' : 'Goalie';
    const formatDate = (s) => {
        if (!s) return 'TBD';
        const d = new Date(s.endsWith && s.endsWith('Z') ? s : s + 'Z');
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: TZ })
            + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
    };

    return (
        <div className="cs-page">
            <div className="cs-card">
                <div className="cs-eyebrow">Old Buzzard Hockey League</div>
                <h2 className="cs-title">Shift Confirmation</h2>

                {error && <div className="cs-alert cs-alert--error">{error}</div>}
                {message && <div className="cs-alert cs-alert--success">{message}</div>}

                {loading ? (
                    <p className="cs-loading">Loading…</p>
                ) : shift ? (
                    <>
                        <div className="cs-detail">
                            <span className="cs-detail-role">{roleLabel(shift.role)} · Slot {shift.slot}</span>
                            <span className="cs-detail-matchup">{shift.homeTeam} vs {shift.awayTeam}</span>
                            <span className="cs-detail-meta">{formatDate(shift.gameDate)}{shift.rink ? ` · ${shift.rink}` : ''}</span>
                            <span className={`cs-detail-status cs-detail-status--${(shift.status || '').toLowerCase()}`}>
                                {shift.status}
                            </span>
                        </div>

                        {!message && (
                            !showDecline ? (
                                <div className="cs-actions">
                                    <button className="cs-btn cs-btn--confirm" disabled={submitting} onClick={() => respond('confirm')}>
                                        {submitting ? 'Saving…' : '✓ Confirm I can make it'}
                                    </button>
                                    <button className="cs-btn cs-btn--ghost" disabled={submitting} onClick={() => setShowDecline(true)}>
                                        ✗ I can't make it
                                    </button>
                                </div>
                            ) : (
                                <div className="cs-actions">
                                    <label className="cs-field-label" htmlFor="cs-reason">Reason (optional)</label>
                                    <input
                                        id="cs-reason"
                                        className="cs-input"
                                        type="text"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="e.g. Out of town that weekend"
                                    />
                                    <button className="cs-btn cs-btn--confirm" disabled={submitting} onClick={() => respond('decline')}>
                                        {submitting ? 'Saving…' : 'Submit decline'}
                                    </button>
                                    <button className="cs-btn cs-btn--ghost" disabled={submitting} onClick={() => setShowDecline(false)}>
                                        Back
                                    </button>
                                </div>
                            )
                        )}
                    </>
                ) : null}

                <button type="button" className="cs-home-link" onClick={() => navigate('/')}>
                    Go to OBHL Home
                </button>
            </div>
        </div>
    );
};

export default ConfirmShift;
