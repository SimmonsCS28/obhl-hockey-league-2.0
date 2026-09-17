import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../services/api';
import './ConfirmShift.css';
import './PayConfirm.css';

const TZ = 'America/Chicago';

const money = (cents) => {
    const dollars = Math.floor((cents || 0) / 100);
    const rest = (cents || 0) % 100;
    return `$${dollars.toLocaleString('en-US')}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
};

const formatDate = (s) => {
    if (!s) return 'TBD';
    const d = new Date(s.endsWith && s.endsWith('Z') ? s : s + 'Z');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })
        + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
};

// Landing page for the "confirm your season pay total" email. The email's two buttons both
// land here with ?action= so the page can open in the right mode, but nothing is written
// until the person clicks on the page itself — a GET that mutated would be fired by every
// mail client that prefetches links.
const PayConfirm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');
    const token = searchParams.get('token') || '';
    const initialAction = searchParams.get('action');

    const [line, setLine] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showDispute, setShowDispute] = useState(initialAction === 'dispute');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (!id || !token) {
            setError('This link is invalid.');
            setLoading(false);
            return;
        }
        (async () => {
            try {
                setLine(await api.getPayLineByToken(id, token));
            } catch (err) {
                setError(err.message || 'This link is invalid or has expired.');
            } finally {
                setLoading(false);
            }
        })();
    }, [id, token]);

    const respond = async (action) => {
        setSubmitting(true);
        setError('');
        try {
            const updated = await api.respondToPayLineByToken(id, token, action, action === 'dispute' ? note : null);
            setLine(updated);
            setMessage(action === 'confirm'
                ? 'Thanks — your total is confirmed.'
                : 'Got it. Reply to the email you received with what needs fixing, and the league will send you an updated total.');
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const roleLabel = line?.role === 'SCOREKEEPER' ? 'Scorekeeper' : 'Referee';
    const gamesWord = line?.games === 1 ? 'game' : 'games';

    return (
        <div className="cs-page">
            <div className="cs-card pc-card">
                <div className="cs-eyebrow">Old Buzzard Hockey League</div>
                <h2 className="cs-title">Season Pay Total</h2>

                {error && <div className="cs-alert cs-alert--error">{error}</div>}
                {message && <div className="cs-alert cs-alert--success">{message}</div>}

                {loading ? (
                    <p className="cs-loading">Loading…</p>
                ) : line ? (
                    <>
                        <div className="cs-detail">
                            <span className="cs-detail-role">{roleLabel} · {line.seasonName}</span>
                            <span className="cs-detail-matchup">{line.games} {gamesWord} · {money(line.totalCents)}</span>
                            <span className="cs-detail-meta">
                                {money(line.rateCents)} per game
                                {line.soloGames > 0 && ` · includes ${line.soloGames} worked alone, paid double (counted twice)`}
                            </span>
                            <span className={`cs-detail-status cs-detail-status--${(line.confirmStatus || '').toLowerCase()}`}>
                                {line.confirmStatus === 'ADMIN_CONFIRMED' ? 'CONFIRMED' : line.confirmStatus}
                            </span>
                        </div>

                        <table className="pc-games">
                            <thead>
                                <tr><th>Date</th><th>Game</th><th></th></tr>
                            </thead>
                            <tbody>
                                {(line.gameRows || []).map((g) => (
                                    <tr key={g.gameId}>
                                        <td className="pc-games-date">{formatDate(g.gameDate)}</td>
                                        <td>{g.matchup}</td>
                                        <td className="pc-games-tag">{g.solo && <span className="pc-solo">solo · ×2</span>}</td>
                                    </tr>
                                ))}
                                {(line.gameRows || []).length === 0 && (
                                    <tr><td colSpan={3} className="pc-games-empty">No games on record.</td></tr>
                                )}
                            </tbody>
                        </table>

                        {!message && (
                            !showDispute ? (
                                <div className="cs-actions">
                                    <button className="cs-btn cs-btn--confirm" disabled={submitting} onClick={() => respond('confirm')}>
                                        {submitting ? 'Saving…' : '✓ Looks right — confirm'}
                                    </button>
                                    <button className="cs-btn cs-btn--ghost" disabled={submitting} onClick={() => setShowDispute(true)}>
                                        ✗ Something's off
                                    </button>
                                </div>
                            ) : (
                                <div className="cs-actions">
                                    <p className="pc-dispute-help">
                                        Tell us what doesn't match — a missing game, one listed twice, or the wrong rate.
                                        You can also just reply to the email; it goes straight to the league admin.
                                    </p>
                                    <label className="cs-field-label" htmlFor="pc-note">What's wrong? (optional)</label>
                                    <textarea
                                        id="pc-note"
                                        className="cs-input pc-note"
                                        rows={3}
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="e.g. I also reffed the Sep 12 late game"
                                    />
                                    <button className="cs-btn cs-btn--confirm" disabled={submitting} onClick={() => respond('dispute')}>
                                        {submitting ? 'Saving…' : 'Send dispute'}
                                    </button>
                                    <button className="cs-btn cs-btn--ghost" disabled={submitting} onClick={() => setShowDispute(false)}>
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

export default PayConfirm;
