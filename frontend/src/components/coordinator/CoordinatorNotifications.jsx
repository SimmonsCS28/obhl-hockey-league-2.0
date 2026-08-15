import { useState, useEffect } from 'react';
import api from '../../services/api';

const ROLE_LABEL = { GOALIE: 'Goalie', REF: 'Referee', SCOREKEEPER: 'Scorekeeper' };

const ROW_COPY = {
    drop: {
        title: "Someone drops a shift they'd confirmed",
        sub: 'They had agreed and the game may already be published with their name on it. '
            + "You'll need a replacement and a republish.",
    },
    decline: {
        title: 'Someone declines a shift',
        sub: 'Nothing was promised, but the slot has nobody in it.',
    },
    confirm: {
        title: 'Someone confirms a shift',
        sub: 'The happy path — roughly ten a week in a five-game week. Off unless you want the receipts.',
    },
};

// Permissive on purpose: a typo guard on a field you type for yourself, not an authority on what an
// address may look like. Mirrors the server's check so the two can't disagree.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function Switch({ on, onToggle, label }) {
    return (
        <button type="button" className="cc-notify-switch" onClick={onToggle} aria-pressed={on} aria-label={label}>
            <span className={`cc-notify-switch-label${on ? ' is-on' : ''}`}>{on ? 'On' : 'Off'}</span>
            <span className={`cc-notify-track${on ? ' is-on' : ''}`}><span className="cc-notify-knob" /></span>
        </button>
    );
}

/**
 * Per-role notification settings for the signed-in coordinator.
 *
 * <p>One consolidated panel rather than a control per role tab: preferences are set about once a
 * season, a multi-role coordinator wants to compare roles side by side, and — the deciding case —
 * only a panel that enumerates *your* roles can tell an admin they hold none. A gear on each tab
 * would offer an admin three preference screens for roles they don't have, which is the exact
 * confusion this feature exists to remove.
 */
function CoordinatorNotifications({ onClose }) {
    const [settings, setSettings] = useState(null);   // null = loading
    const [draft, setDraft] = useState({});           // role -> edited row
    const [saveState, setSaveState] = useState('idle'); // idle | dirty | saving | saved | error
    const [errors, setErrors] = useState({});         // role -> message
    const [loadError, setLoadError] = useState('');

    // Fetched in the effect rather than via a callback so state only ever lands from the promise,
    // not synchronously during the effect body.
    useEffect(() => {
        let cancelled = false;
        api.getNotificationSettings()
            .then(data => {
                if (cancelled) return;
                setSettings(data);
                const d = {};
                (data.roles || []).forEach(r => { d[r.role] = { ...r }; });
                setDraft(d);
            })
            .catch(e => {
                if (cancelled) return;
                setLoadError(e.message || "Couldn't load your settings.");
                setSettings({ roles: [], unfilledRoles: [], admin: false });
            });
        return () => { cancelled = true; };
    }, []);

    const edit = (role, patch) => {
        setDraft(prev => ({ ...prev, [role]: { ...prev[role], ...patch } }));
        setErrors(prev => ({ ...prev, [role]: null }));
        setSaveState('dirty');
    };

    // On blur, never per keystroke — flagging a half-typed address as wrong is just noise.
    const validate = (role) => {
        const v = (draft[role]?.emailOverride || '').trim();
        if (v && !EMAIL_RE.test(v)) {
            setErrors(prev => ({ ...prev, [role]: "That doesn't look like an email address — check for a missing .com." }));
            return false;
        }
        return true;
    };

    const save = async () => {
        const roles = Object.keys(draft);
        const bad = roles.find(r => !validate(r));
        if (bad) {
            // Focus the offending field rather than disabling Save: a dead button with no
            // explanation is the worse failure.
            document.querySelector(`#cc-notify-email-${bad}`)?.focus();
            return;
        }
        setSaveState('saving');
        try {
            let latest = null;
            for (const r of roles) {
                latest = await api.saveNotificationSettings(draft[r]);
            }
            if (latest) {
                setSettings(latest);
                const d = {};
                (latest.roles || []).forEach(x => { d[x.role] = { ...x }; });
                setDraft(d);
            }
            setSaveState('saved');
            setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000);
        } catch {
            setSaveState('error');
        }
    };

    const statusLine = {
        idle: { text: 'Drops always send.', cls: 'is-quiet' },
        dirty: { text: 'Unsaved changes', cls: 'is-dirty' },
        saving: { text: 'Saving…', cls: 'is-quiet' },
        saved: { text: '✓ Saved', cls: 'is-saved' },
        error: { text: 'Still unsaved', cls: 'is-quiet' },
    }[saveState];

    const busy = saveState === 'saving';
    const held = settings?.roles || [];
    const unfilled = settings?.unfilledRoles || [];

    return (
        <div className="cc-notify-overlay" role="dialog" aria-modal="true" onClick={onClose}>
            <div
                className={`cc-notify-panel${saveState === 'error' ? ' has-error' : ''}${held.length === 0 && settings ? ' is-plain' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="cc-notify-hd">
                    <div className="cc-notify-kicker">Notification settings</div>
                    <div className="cc-notify-title">
                        {settings && held.length === 0 ? 'You hold no coordinator roles' : 'Email me when…'}
                    </div>
                    <div className="cc-notify-sub">
                        {settings && held.length === 0
                            ? 'Nothing to set here — these preferences belong to the people who run each role.'
                            : 'Set separately for each role you hold. These are yours alone — other coordinators set their own.'}
                    </div>
                </div>

                {saveState === 'error' && (
                    <div className="cc-notify-alert">
                        Nothing was saved — the server didn&apos;t answer. Your changes are still here; try again.
                    </div>
                )}
                {loadError && <div className="cc-notify-alert">{loadError}</div>}

                <div className="cc-notify-body">
                    {!settings ? (
                        <>
                            <div className="cc-notify-skeleton" />
                            <div className="cc-notify-skeleton" />
                        </>
                    ) : held.length === 0 ? (
                        <AdminNoRoles unfilled={unfilled} />
                    ) : (
                        held.map(r => {
                            const row = draft[r.role] || r;
                            const alone = (r.otherHolders || []).length === 0;
                            return (
                                <div key={r.role} className="cc-notify-role">
                                    <div className="cc-notify-role-hd">
                                        <span className="cc-notify-role-name">{ROLE_LABEL[r.role]} Coordinator</span>
                                        <span className="cc-notify-role-holders">
                                            {alone ? "You're the only one" : `With ${r.otherHolders.join(', ')}`}
                                        </span>
                                    </div>

                                    <div className="cc-notify-rows">
                                        <div className="cc-notify-row">
                                            <span className="cc-notify-row-text">
                                                <span className="cc-notify-row-title">{ROW_COPY.drop.title}</span>
                                                <span className="cc-notify-row-sub">{ROW_COPY.drop.sub}</span>
                                            </span>
                                            {/* A statement, not a control — which is also what makes the two
                                                real switches below read as the actual choice. */}
                                            <span className="cc-notify-always">Always on</span>
                                        </div>

                                        <div className={`cc-notify-row${row.notifyOnDecline ? '' : ' is-off'}`}>
                                            <span className="cc-notify-row-text">
                                                <span className="cc-notify-row-title">{ROW_COPY.decline.title}</span>
                                                <span className="cc-notify-row-sub">{ROW_COPY.decline.sub}</span>
                                            </span>
                                            <Switch
                                                on={row.notifyOnDecline}
                                                label={`Declines for ${ROLE_LABEL[r.role]}`}
                                                onToggle={() => edit(r.role, { notifyOnDecline: !row.notifyOnDecline })}
                                            />
                                        </div>

                                        {alone && !row.notifyOnDecline && (
                                            <div className="cc-notify-note">
                                                <span className="cc-notify-note-mark">&#8213;</span>
                                                <span>
                                                    You&apos;re the only {ROLE_LABEL[r.role].toLowerCase()} coordinator.
                                                    With this off, {ROLE_LABEL[r.role].toLowerCase()} declines go to the
                                                    league admins instead — nobody is left uninformed, but it won&apos;t be you.
                                                </span>
                                            </div>
                                        )}

                                        <div className={`cc-notify-row${row.notifyOnConfirm ? '' : ' is-off'}`}>
                                            <span className="cc-notify-row-text">
                                                <span className="cc-notify-row-title">{ROW_COPY.confirm.title}</span>
                                                <span className="cc-notify-row-sub">{ROW_COPY.confirm.sub}</span>
                                            </span>
                                            <Switch
                                                on={row.notifyOnConfirm}
                                                label={`Confirmations for ${ROLE_LABEL[r.role]}`}
                                                onToggle={() => edit(r.role, { notifyOnConfirm: !row.notifyOnConfirm })}
                                            />
                                        </div>
                                    </div>

                                    <div className="cc-notify-email">
                                        <label className="cc-notify-email-label" htmlFor={`cc-notify-email-${r.role}`}>
                                            Send {ROLE_LABEL[r.role].toLowerCase()} notices to
                                        </label>
                                        <input
                                            id={`cc-notify-email-${r.role}`}
                                            type="email"
                                            className={`cc-notify-email-input${errors[r.role] ? ' has-error' : ''}`}
                                            value={row.emailOverride || ''}
                                            placeholder="Leave empty for your account address"
                                            onChange={e => edit(r.role, { emailOverride: e.target.value })}
                                            onBlur={() => validate(r.role)}
                                        />
                                        {errors[r.role]
                                            ? <span className="cc-notify-email-note is-bad">{errors[r.role]}</span>
                                            : !(row.emailOverride || '').trim() && (
                                                <span className="cc-notify-email-note">
                                                    Empty — going to your account address,{' '}
                                                    <span className="cc-notify-email-fallback">{r.accountEmail}</span>.
                                                </span>
                                            )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="cc-notify-ft">
                    {held.length > 0 && (
                        <span className={`cc-notify-status ${statusLine.cls}`}>{statusLine.text}</span>
                    )}
                    <button type="button" className="cc-notify-cancel" disabled={busy} onClick={onClose}>
                        {saveState === 'error' ? 'Discard' : saveState === 'dirty' ? 'Cancel' : 'Close'}
                    </button>
                    {held.length > 0 && (
                        <button
                            type="button"
                            className={`cc-notify-save${saveState === 'error' ? ' is-retry' : ''}`}
                            disabled={busy || saveState === 'idle' || saveState === 'saved'}
                            onClick={save}
                        >
                            {busy ? 'Saving…'
                                : saveState === 'error' ? 'Retry Save'
                                    : saveState === 'dirty' ? 'Save Settings' : 'Saved'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * What an admin holding no coordinator role sees. Two statements, both needed: what mail *is*
 * reaching them and why, and what isn't. This screen is the reason the feature was asked for, so it
 * must never imply they're subscribed to something they aren't.
 */
function AdminNoRoles({ unfilled }) {
    const names = unfilled.map(r => ROLE_LABEL[r].toLowerCase());
    const list = names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return (
        <>
            {unfilled.length > 0 ? (
                <div className="cc-notify-admin is-warn">
                    <div className="cc-notify-admin-title">You are currently getting {list} mail</div>
                    <div className="cc-notify-admin-sub">
                        Nobody holds {unfilled.length === 1 ? 'that role' : 'those roles'}, so their notices fall back
                        to the admins. It stops the moment someone is appointed.
                    </div>
                </div>
            ) : (
                <div className="cc-notify-admin">
                    <div className="cc-notify-admin-sub">
                        Every coordinator role has a holder, so no coordinator mail is reaching you.
                    </div>
                </div>
            )}
        </>
    );
}

export default CoordinatorNotifications;
