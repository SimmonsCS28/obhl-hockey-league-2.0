import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../services/api';
// Same card, same buttons as the shift-confirm page: both are "you arrived here from an email,
// do one thing, leave" screens, and matching them means a goalie recognises the second one.
import './ConfirmShift.css';

/**
 * Public unsubscribe / resubscribe page reached from the footer of a broadcast email. Works with no
 * login — the link's own signature is the authorisation — because the people it matters most for
 * are substitutes who drifted away and won't remember a password.
 */
const EmailAlerts = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const u = searchParams.get('u');
    const k = searchParams.get('k') || '';
    const t = searchParams.get('t') || '';

    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!u || !k || !t) {
            setError('This link is invalid.');
            setLoading(false);
            return;
        }
        (async () => {
            try {
                setStatus(await api.getEmailAlertsByToken(u, k, t));
            } catch (err) {
                setError(err.message || 'This link is no longer valid.');
            } finally {
                setLoading(false);
            }
        })();
    }, [u, k, t]);

    const setSubscribed = async (subscribed) => {
        setSubmitting(true);
        setError('');
        try {
            const updated = await api.setEmailAlertsByToken(u, k, t, subscribed);
            setStatus(updated);
            setMessage(subscribed
                ? "You're back on the list. You'll get an email the next time a net opens up."
                : "Done — you won't get these any more. Your regular assignment emails are unaffected.");
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const pref = status?.pref;

    return (
        <div className="cs-page">
            <div className="cs-card">
                <div className="cs-eyebrow">Old Buzzard Hockey League</div>
                <h2 className="cs-title">Email Alerts</h2>

                {error && <div className="cs-alert cs-alert--error">{error}</div>}
                {message && <div className="cs-alert cs-alert--success">{message}</div>}

                {loading ? (
                    <p className="cs-loading">Loading…</p>
                ) : pref ? (
                    <>
                        <div className="cs-detail">
                            <span className="cs-detail-role">
                                {status.firstName ? `${status.firstName} · ` : ''}{status.maskedEmail}
                            </span>
                            <span className="cs-detail-matchup">{pref.label}</span>
                            <span className="cs-detail-meta">{pref.description}</span>
                            <span className={`cs-detail-status ${pref.subscribed ? 'cs-detail-status--confirmed' : 'cs-detail-status--declined'}`}>
                                {pref.subscribed ? 'Subscribed' : 'Unsubscribed'}
                            </span>
                        </div>

                        <div className="cs-actions">
                            {pref.subscribed ? (
                                <button className="cs-btn cs-btn--confirm" disabled={submitting} onClick={() => setSubscribed(false)}>
                                    {submitting ? 'Saving…' : 'Unsubscribe from these alerts'}
                                </button>
                            ) : (
                                <button className="cs-btn cs-btn--confirm" disabled={submitting} onClick={() => setSubscribed(true)}>
                                    {submitting ? 'Saving…' : 'Resubscribe'}
                                </button>
                            )}
                        </div>
                    </>
                ) : null}

                <button type="button" className="cs-home-link" onClick={() => navigate('/')}>
                    Go to OBHL Home
                </button>
            </div>
        </div>
    );
};

export default EmailAlerts;
