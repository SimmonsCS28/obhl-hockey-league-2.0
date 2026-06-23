import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../services/api';
import './ForgotPassword.css';

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

    const roleLabel = (role) => (role === 'REF' ? 'Referee' : 'Goalie');
    const formatDate = (s) => {
        if (!s) return 'TBD';
        const d = new Date(s.endsWith && s.endsWith('Z') ? s : s + 'Z');
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
            + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    return (
        <div className="forgot-password-container">
            <div className="forgot-password-card">
                <h2>Shift Confirmation</h2>
                {error && <div className="error-message">{error}</div>}
                {message && <div className="success-message">{message}</div>}

                {loading ? (
                    <p>Loading…</p>
                ) : shift ? (
                    <>
                        <div className="security-question-display">
                            <strong>{roleLabel(shift.role)} — {shift.homeTeam} vs {shift.awayTeam}</strong>
                            <p>{formatDate(shift.gameDate)}{shift.rink ? ` · ${shift.rink}` : ''}</p>
                            <p>Status: <strong>{shift.status}</strong></p>
                        </div>

                        {!message && (
                            <>
                                {!showDecline ? (
                                    <>
                                        <button className="reset-btn" disabled={submitting} onClick={() => respond('confirm')}>
                                            {submitting ? 'Saving…' : '✓ Confirm I can make it'}
                                        </button>
                                        <button className="reset-btn secondary-btn" disabled={submitting} onClick={() => setShowDecline(true)}>
                                            ✗ I can't make it
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="form-group">
                                            <label>Reason (optional)</label>
                                            <input
                                                type="text"
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                placeholder="e.g. Out of town that weekend"
                                            />
                                        </div>
                                        <button className="reset-btn" disabled={submitting} onClick={() => respond('decline')}>
                                            {submitting ? 'Saving…' : 'Submit decline'}
                                        </button>
                                        <button className="reset-btn secondary-btn" disabled={submitting} onClick={() => setShowDecline(false)}>
                                            Back
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </>
                ) : null}

                <div className="login-link">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                    >
                        Go to OBHL Home
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmShift;
