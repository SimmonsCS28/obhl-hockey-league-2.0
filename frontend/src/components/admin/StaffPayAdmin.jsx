import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import api from '../../services/api';
import './StaffPayAdmin.css';

const TZ = 'America/Chicago';
const REF_TIERS = [2000, 3000, 4000];
const SK_TIERS = [1500];

const money = (cents) => {
    if (cents == null) return '—';
    const dollars = Math.floor(cents / 100);
    const rest = cents % 100;
    return `$${dollars.toLocaleString('en-US')}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
};

const centsToInput = (cents) => (cents == null ? '' : (cents / 100).toString());
const inputToCents = (s) => {
    const n = Number(String(s).replace(/[$,\s]/g, ''));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

const formatWhen = (s) => {
    if (!s) return '';
    const d = new Date(s.endsWith && s.endsWith('Z') ? s : s + 'Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ })
        + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
};

const formatGameDate = (s) => {
    if (!s) return 'TBD';
    const d = new Date(s.endsWith && s.endsWith('Z') ? s : s + 'Z');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })
        + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
};

const STATUS_LABEL = {
    PENDING: 'Awaiting reply',
    CONFIRMED: 'Confirmed',
    ADMIN_CONFIRMED: 'Confirmed by you',
    DISPUTED: 'Disputed',
};

const roleLabel = (role) => (role === 'SCOREKEEPER' ? 'Scorekeeper' : 'Referee');

function StaffPayAdmin() {
    const { selectedSeasonId, selectedSeason } = useSeason();

    const [summary, setSummary] = useState(null);
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState('');
    const [ratesFilter, setRatesFilter] = useState('worked');
    const [ratesSearch, setRatesSearch] = useState('');
    const [drafts, setDrafts] = useState({});
    const [openLine, setOpenLine] = useState(null);
    const [financeEmail, setFinanceEmail] = useState('');
    const [savedFinanceEmail, setSavedFinanceEmail] = useState('');
    const [saveAsDefault, setSaveAsDefault] = useState(true);
    const [missingNames, setMissingNames] = useState([]);
    const bannerRef = useRef(null);

    // The action buttons sit well below the fold; an outcome that only appears at the top of
    // the page reads as "nothing happened". Bring the banner into view when one lands.
    useEffect(() => {
        if ((error || notice) && bannerRef.current) {
            bannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [error, notice]);

    const load = useCallback(async (quiet = false) => {
        if (!selectedSeasonId) return;
        if (!quiet) setLoading(true);
        try {
            const [s, r] = await Promise.all([
                api.getStaffPaySummary(selectedSeasonId),
                api.getStaffPayRates(selectedSeasonId),
            ]);
            setSummary(s);
            setRates(r);
            const fe = s.financeEmail || '';
            setSavedFinanceEmail(fe);
            setFinanceEmail((cur) => cur || fe);
            setError('');
        } catch (err) {
            setError(err.message || 'Could not load staff pay for this season.');
        } finally {
            setLoading(false);
        }
    }, [selectedSeasonId]);

    useEffect(() => {
        setSummary(null);
        setDrafts({});
        setOpenLine(null);
        setMissingNames([]);
        setNotice('');
        load();
    }, [load]);

    const run = async (key, fn, successMessage) => {
        setBusy(key);
        setError('');
        setNotice('');
        try {
            const result = await fn();
            if (successMessage) setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage);
            return result;
        } catch (err) {
            setError(err.message || 'Something went wrong.');
            return null;
        } finally {
            setBusy('');
        }
    };

    // ---- rates ----

    const saveRate = async (row, cents) => {
        if (cents == null) {
            setError('Enter a dollar amount, e.g. 30.');
            return;
        }
        const key = `${row.role}:${row.userId}`;
        setBusy(key);
        setError('');
        try {
            await api.saveStaffPayRate({ userId: row.userId, role: row.role, rateCents: cents });
            setRates((prev) => prev.map((r) => (r.userId === row.userId && r.role === row.role ? { ...r, rateCents: cents } : r)));
            setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
            setMissingNames((m) => m.filter((name) => !name.startsWith(row.name + ' (')));
            load(true);
        } catch (err) {
            setError(err.message || 'Could not save that rate.');
        } finally {
            setBusy('');
        }
    };

    // Free-entry rate box: save on Enter or blur, drop the draft if nothing changed.
    const commitDraft = (row, key, draft) => {
        if (draft == null) return;
        const cents = inputToCents(draft);
        if (cents === row.rateCents || draft.trim() === '') {
            setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
            return;
        }
        saveRate(row, cents);
    };

    const visibleRates = useMemo(() => {
        const q = ratesSearch.trim().toLowerCase();
        return rates.filter((r) => {
            if (ratesFilter === 'worked' && r.games === 0) return false;
            if (ratesFilter === 'unrated' && r.rateCents != null) return false;
            if (q && !r.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [rates, ratesFilter, ratesSearch]);

    const unratedWorked = useMemo(() => rates.filter((r) => r.games > 0 && r.rateCents == null).length, [rates]);

    const renderRateRow = (row) => {
        const key = `${row.role}:${row.userId}`;
        const draft = drafts[key];
        const tiers = row.role === 'REF' ? REF_TIERS : SK_TIERS;
        const needsRate = row.games > 0 && row.rateCents == null;
        return (
            <div className={`obi-pay-rate-row${needsRate ? ' is-missing' : ''}`} key={key}>
                <div className="obi-pay-rate-name">
                    <span>{row.name}</span>
                    {!row.hasRole && <span className="obi-pay-tag obi-pay-tag--warn" title="Worked games this season but no longer holds the role">no role</span>}
                    {!row.active && <span className="obi-pay-tag obi-pay-tag--warn">inactive</span>}
                    {needsRate && <span className="obi-pay-tag obi-pay-tag--error">needs a rate</span>}
                </div>
                <div className="obi-pay-rate-games">
                    {row.games > 0 ? (
                        <>
                            {row.games} {row.games === 1 ? 'game' : 'games'}
                            {row.soloGames > 0 && <span className="obi-pay-muted"> · {row.soloGames} solo</span>}
                        </>
                    ) : <span className="obi-pay-muted">no games</span>}
                </div>
                <div className="obi-pay-rate-edit">
                    {tiers.map((t) => (
                        <button
                            key={t}
                            type="button"
                            className={`obi-chip obi-pay-chip${row.rateCents === t ? ' is-active' : ''}`}
                            disabled={busy === key}
                            onClick={() => saveRate(row, t)}
                        >
                            {money(t)}
                        </button>
                    ))}
                    <span className="obi-pay-rate-input-wrap">
                        <span className="obi-pay-rate-dollar">$</span>
                        <input
                            className="obi-pay-rate-input"
                            type="text"
                            inputMode="decimal"
                            placeholder="other"
                            value={draft != null ? draft : centsToInput(row.rateCents)}
                            disabled={busy === key}
                            onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(row, key, draft); } }}
                            onBlur={() => commitDraft(row, key, draft)}
                        />
                    </span>
                </div>
            </div>
        );
    };

    // ---- workflow ----

    const period = summary?.periodStatus || 'DRAFT';
    const seasonName = summary?.seasonName || selectedSeason?.name || '';

    const finalize = () => run('finalize', async () => {
        try {
            const s = await api.finalizeStaffPay(selectedSeasonId);
            setSummary(s);
            setMissingNames([]);
            return s;
        } catch (err) {
            // The gateway sends the blocking names as structured data; surface them as a list.
            const m = err.message && err.message.match(/before finalizing: (.*)$/);
            if (m) setMissingNames(m[1].split(', '));
            throw err;
        }
    }, (s) => (s ? `Finalized ${s.lines.length} totals for ${s.seasonName}.` : null));

    const sendConfirmations = () => run('send', async () => {
        const r = await api.sendStaffPayConfirmations(selectedSeasonId);
        await load(true);
        return r;
    }, (r) => r && `Sent ${r.sent} confirmation ${r.sent === 1 ? 'email' : 'emails'}`
        + (r.skipped ? `, ${r.skipped} skipped (no email on file)` : '')
        + (r.failed?.length ? `. Failed: ${r.failed.join(', ')}` : '.'));

    const resendLine = (line) => run(`resend:${line.id}`, async () => {
        const r = await api.resendStaffPayLine(line.id);
        await load(true);
        return r;
    }, (r) => r && (r.sent ? `Resent to ${line.name}.` : `Could not send to ${line.name}.`));

    const adminConfirm = (line) => run(`confirm:${line.id}`, async () => {
        await api.adminConfirmStaffPayLine(line.id);
        await load(true);
    }, `Marked ${line.name} as confirmed.`);

    const download = () => run('download', async () => {
        const { blob, filename } = await api.downloadStaffPayReport(selectedSeasonId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    const sendReport = () => run('sendReport', async () => {
        const s = await api.sendStaffPayReport(selectedSeasonId, financeEmail.trim(), saveAsDefault);
        setSummary(s);
        if (saveAsDefault) setSavedFinanceEmail(financeEmail.trim());
        return s;
    }, `Report emailed to ${financeEmail.trim()}.`);

    const saveFinanceEmail = () => run('saveEmail', async () => {
        const r = await api.setFinanceReportEmail(financeEmail.trim());
        setSavedFinanceEmail(r.value || '');
    }, 'Rink finance email saved.');

    const steps = [
        { id: 'rates', label: 'Rates set', done: unratedWorked === 0 && rates.some((r) => r.games > 0) },
        { id: 'finalized', label: 'Finalized', done: period !== 'DRAFT' },
        { id: 'sent', label: 'Confirmations sent', done: !!summary?.confirmationsSentAt },
        { id: 'confirmed', label: 'All confirmed', done: !!summary?.reportReady },
        { id: 'report', label: 'Report sent', done: period === 'SENT' },
    ];

    if (!selectedSeasonId) {
        return <div className="obi-pay-empty">Pick a season in the top bar to see staff pay.</div>;
    }
    if (loading && !summary) {
        return <div className="obi-pay-empty">Loading staff pay…</div>;
    }

    const liveRefs = (summary?.live || []).filter((l) => l.role === 'REF');
    const liveSks = (summary?.live || []).filter((l) => l.role === 'SCOREKEEPER');
    const lines = summary?.lines || [];

    return (
        <div className="obi-pay">
            <div ref={bannerRef} className="obi-pay-banners">
                {error && <div className="obi-pay-banner obi-pay-banner--error">{error}<button type="button" className="obi-pay-banner-x" onClick={() => setError('')}>×</button></div>}
                {notice && <div className="obi-pay-banner obi-pay-banner--ok">{notice}<button type="button" className="obi-pay-banner-x" onClick={() => setNotice('')}>×</button></div>}
            </div>

            <ol className="obi-pay-steps">
                {steps.map((s, i) => (
                    <li key={s.id} className={`obi-pay-step${s.done ? ' is-done' : ''}`}>
                        <span className="obi-pay-step-num">{s.done ? '✓' : i + 1}</span>
                        <span>{s.label}</span>
                    </li>
                ))}
            </ol>

            {/* ---------------------------------------------------------------- rates */}
            <section className="obi-pay-card">
                <header className="obi-pay-card-hd">
                    <div>
                        <h3>Pay rates</h3>
                        <p>Refs: $20 no training · $30 OBHL clinic · $40 USA Hockey certified. Scorekeepers: $15. Enter $0 for someone who has asked not to be paid.</p>
                    </div>
                    <div className="obi-pay-card-tools">
                        <div className="obi-pay-seg">
                            {[['worked', 'Worked this season'], ['unrated', 'Needs a rate'], ['all', 'Everyone']].map(([v, l]) => (
                                <button key={v} type="button" className={ratesFilter === v ? 'is-active' : ''} onClick={() => setRatesFilter(v)}>{l}</button>
                            ))}
                        </div>
                        <input className="obi-pay-search" type="search" placeholder="Find a name" value={ratesSearch} onChange={(e) => setRatesSearch(e.target.value)} />
                    </div>
                </header>
                {unratedWorked > 0 && (
                    <div className="obi-pay-callout obi-pay-callout--error">
                        {unratedWorked} {unratedWorked === 1 ? 'person' : 'people'} worked games this season and still {unratedWorked === 1 ? 'has' : 'have'} no rate. Finalizing is blocked until they do.
                    </div>
                )}
                {['REF', 'SCOREKEEPER'].map((role) => {
                    const rows = visibleRates.filter((r) => r.role === role);
                    return (
                        <div className="obi-pay-rate-group" key={role}>
                            <div className="obi-pay-rate-group-hd">
                                <span>{role === 'REF' ? 'Referees' : 'Scorekeepers'} <span className="obi-pay-muted">({rows.length})</span></span>
                                <span>Games this season</span>
                                <span>Rate per game</span>
                            </div>
                            {rows.length === 0 ? (
                                <div className="obi-pay-rate-empty">Nobody matches this filter.</div>
                            ) : rows.map(renderRateRow)}
                        </div>
                    );
                })}
            </section>

            {/* ------------------------------------------------------------- totals */}
            <section className="obi-pay-card">
                <header className="obi-pay-card-hd">
                    <div>
                        <h3>{period === 'DRAFT' ? 'Season totals' : 'Finalized totals'}</h3>
                        <p>
                            {period === 'DRAFT'
                                ? 'Live from the games on the Assignments page — every past game, one credit per filled slot, double for a ref working alone. Finalizing freezes these numbers so people can confirm them.'
                                : <>Finalized {formatWhen(summary.finalizedAt)}. Fix any mistakes on <Link to="/admin?tab=assignments">Assignments</Link>, then re-finalize — only totals that actually changed lose their confirmation.</>}
                        </p>
                    </div>
                    <div className="obi-pay-card-actions">
                        {period !== 'DRAFT' && (
                            <button type="button" className="obi-pay-btn obi-pay-btn--ghost" disabled={busy === 'send' || summary.pending === 0} onClick={sendConfirmations}>
                                {busy === 'send' ? 'Sending…' : summary.confirmationsSentAt ? `Send to ${summary.pending} awaiting` : `Send confirmation requests (${summary.pending})`}
                            </button>
                        )}
                        <button
                            type="button"
                            className={`obi-pay-btn ${period === 'DRAFT' || summary.stale ? 'obi-pay-btn--primary' : 'obi-pay-btn--ghost'}`}
                            disabled={busy === 'finalize' || unratedWorked > 0 || (summary?.live || []).length === 0}
                            title={unratedWorked > 0 ? 'Set a rate for everyone who worked first' : undefined}
                            onClick={finalize}
                        >
                            {busy === 'finalize' ? 'Finalizing…' : period === 'DRAFT' ? 'Finalize assignments' : 'Re-finalize'}
                        </button>
                    </div>
                </header>

                {missingNames.length > 0 && (
                    <div className="obi-pay-callout obi-pay-callout--error">
                        <strong>Can't finalize yet.</strong> Set a rate for: {missingNames.join(', ')}.
                    </div>
                )}
                {period !== 'DRAFT' && summary.stale && (
                    <div className="obi-pay-callout obi-pay-callout--warn">
                        Assignments or rates have changed since this was finalized. Re-finalize to bring the totals up to date before sending anything.
                    </div>
                )}

                {period === 'DRAFT' ? (
                    (summary?.live || []).length === 0 ? (
                        <div className="obi-pay-rate-empty">No past games with a ref or scorekeeper assigned yet.</div>
                    ) : (
                        <div className="obi-pay-live">
                            {[['Referees', liveRefs], ['Scorekeepers', liveSks]].map(([label, rows]) => (
                                <div className="obi-pay-live-col" key={label}>
                                    <div className="obi-pay-table-hd"><span>{label}</span><span>Games</span><span>Rate</span><span>Owed</span></div>
                                    {rows.map((l) => (
                                        <div className={`obi-pay-table-row${l.rateCents == null ? ' is-missing' : ''}`} key={`${l.role}:${l.userId}`}>
                                            <span>{l.name}</span>
                                            <span>{l.games}{l.soloGames > 0 && <span className="obi-pay-muted"> ({l.soloGames} solo)</span>}</span>
                                            <span>{money(l.rateCents)}</span>
                                            <span className="obi-pay-money">{money(l.totalCents)}</span>
                                        </div>
                                    ))}
                                    <div className="obi-pay-table-row obi-pay-table-total">
                                        <span>Total</span><span /><span />
                                        <span className="obi-pay-money">{money(rows.reduce((a, l) => a + (l.totalCents || 0), 0))}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    <>
                        <div className="obi-pay-counts">
                            <span className="obi-pay-count"><b>{summary.confirmed}</b> confirmed</span>
                            <span className="obi-pay-count"><b>{summary.pending}</b> awaiting</span>
                            <span className={`obi-pay-count${summary.disputed ? ' is-bad' : ''}`}><b>{summary.disputed}</b> disputed</span>
                            <span className="obi-pay-count obi-pay-count--total">Total owed <b>{money(summary.totalCents)}</b></span>
                        </div>
                        <div className="obi-pay-lines">
                            <div className="obi-pay-line-hd">
                                <span>Person</span><span>Games</span><span>Rate</span><span>Owed</span><span>Status</span><span />
                            </div>
                            {lines.map((l) => (
                                <div className="obi-pay-line-wrap" key={l.id}>
                                    <div className={`obi-pay-line${l.stale ? ' is-stale' : ''}`}>
                                        <span className="obi-pay-line-name">
                                            <button type="button" className="obi-pay-linklike" onClick={() => setOpenLine(openLine === l.id ? null : l.id)}>
                                                {l.name}
                                            </button>
                                            <span className="obi-pay-muted"> · {roleLabel(l.role)}</span>
                                            {l.stale && <span className="obi-pay-tag obi-pay-tag--warn" title="Live totals differ from this snapshot">changed</span>}
                                        </span>
                                        <span>{l.games}{l.soloGames > 0 && <span className="obi-pay-muted"> ({l.soloGames} solo)</span>}</span>
                                        <span>{money(l.rateCents)}</span>
                                        <span className="obi-pay-money">{money(l.totalCents)}</span>
                                        <span>
                                            <span className={`obi-pay-status obi-pay-status--${l.confirmStatus.toLowerCase()}`}>{STATUS_LABEL[l.confirmStatus] || l.confirmStatus}</span>
                                            {l.confirmStatus === 'PENDING' && l.emailSentAt && <span className="obi-pay-muted obi-pay-small"> sent {formatWhen(l.emailSentAt)}</span>}
                                            {l.confirmStatus === 'PENDING' && !l.emailSentAt && <span className="obi-pay-muted obi-pay-small"> not sent</span>}
                                            {l.respondedAt && l.confirmStatus !== 'PENDING' && <span className="obi-pay-muted obi-pay-small"> {formatWhen(l.respondedAt)}</span>}
                                        </span>
                                        <span className="obi-pay-line-actions">
                                            {(l.confirmStatus === 'PENDING' || l.confirmStatus === 'DISPUTED') && (
                                                <>
                                                    <button type="button" className="obi-pay-mini" disabled={busy === `resend:${l.id}`} onClick={() => resendLine(l)}>
                                                        {busy === `resend:${l.id}` ? '…' : l.emailSentAt ? 'Resend' : 'Send'}
                                                    </button>
                                                    <button type="button" className="obi-pay-mini" disabled={busy === `confirm:${l.id}`} onClick={() => adminConfirm(l)}>
                                                        Mark confirmed
                                                    </button>
                                                </>
                                            )}
                                        </span>
                                    </div>
                                    {l.disputeNote && (
                                        <div className="obi-pay-dispute">Dispute note: “{l.disputeNote}”</div>
                                    )}
                                    {openLine === l.id && (
                                        <ul className="obi-pay-games">
                                            {(l.gameRows || []).map((g) => (
                                                <li key={g.gameId}>
                                                    <span className="obi-pay-games-date">{formatGameDate(g.gameDate)}</span>
                                                    <span>{g.matchup}</span>
                                                    {g.solo && <span className="obi-pay-tag">solo · ×2</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </section>

            {/* ------------------------------------------------------------- report */}
            <section className="obi-pay-card">
                <header className="obi-pay-card-hd">
                    <div>
                        <h3>Rink report</h3>
                        <p>
                            The Excel sheet in the rink's usual layout — one tab named for the season, refs on the left, scorekeepers on the right.
                            {summary?.reportReady
                                ? ' Everyone has confirmed, so it can go out.'
                                : period === 'DRAFT'
                                    ? ' Available once the season is finalized and every total is confirmed.'
                                    : ` Locked until every total is confirmed — ${summary.pending + summary.disputed} still open. Use “Mark confirmed” for anyone who won't reply.`}
                        </p>
                    </div>
                    <div className="obi-pay-card-actions">
                        <button type="button" className="obi-pay-btn obi-pay-btn--ghost" disabled={!summary?.reportReady || busy === 'download'} onClick={download}>
                            {busy === 'download' ? 'Building…' : 'Download .xlsx'}
                        </button>
                    </div>
                </header>
                {period === 'SENT' && (
                    <div className="obi-pay-callout obi-pay-callout--ok">
                        Sent to {summary.reportSentTo} on {formatWhen(summary.reportSentAt)}. You can send it again if anything changes.
                    </div>
                )}
                <div className="obi-pay-send">
                    <label className="obi-pay-label" htmlFor="obi-pay-finance-email">Rink finance contact</label>
                    <div className="obi-pay-send-row">
                        <input
                            id="obi-pay-finance-email"
                            className="obi-pay-input"
                            type="email"
                            placeholder="finance@rink.com"
                            value={financeEmail}
                            onChange={(e) => setFinanceEmail(e.target.value)}
                        />
                        <button
                            type="button"
                            className="obi-pay-btn obi-pay-btn--ghost"
                            disabled={busy === 'saveEmail' || financeEmail.trim() === savedFinanceEmail}
                            onClick={saveFinanceEmail}
                        >
                            {financeEmail.trim() === savedFinanceEmail && savedFinanceEmail ? 'Saved' : 'Save as default'}
                        </button>
                        <button
                            type="button"
                            className="obi-pay-btn obi-pay-btn--primary"
                            disabled={!summary?.reportReady || busy === 'sendReport' || !financeEmail.includes('@')}
                            onClick={sendReport}
                        >
                            {busy === 'sendReport' ? 'Sending…' : period === 'SENT' ? 'Send again' : 'Email report to rink'}
                        </button>
                    </div>
                    <label className="obi-pay-check">
                        <input type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} />
                        Remember this address for next season
                    </label>
                    <p className="obi-pay-muted obi-pay-small">
                        The email goes from the league's address with you as the reply-to, with <code>{summary?.title || `OBHL ${seasonName}`}</code> as the sheet title.
                    </p>
                </div>
            </section>
        </div>
    );
}

export default StaffPayAdmin;
