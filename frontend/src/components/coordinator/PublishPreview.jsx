import './Coordinator.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function initials(name) {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * Shown before every publish — week or matchup, console or admin. Answers the one question that made
 * the week-wide button feel unsafe — "who exactly gets an email" — by naming them, and says plainly
 * who will NOT be re-emailed. The plan comes from a server dry run, so it can't drift from what
 * actually sends.
 *
 * Lives in its own file because Admin → Assignments publishes the same rows through the same
 * endpoint; a publish that skips this panel is a publish nobody previewed.
 */
function PublishPreview({ scope, plan, busy, error, onConfirm, onCancel }) {
    const willEmail = plan?.willEmail || [];
    const alreadyLive = plan?.alreadyLive || [];
    const blocked = plan?.blocked || [];
    const n = willEmail.length;

    const headline = n === 0 ? 'Nobody gets an email'
        : n === 1 ? '1 person will be emailed'
            : `${n} people will be emailed`;

    return (
        <div className="cc-publish-preview" role="dialog" aria-modal="true" onClick={onCancel}>
            <div className={`cc-pp-panel${error ? ' has-error' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="cc-pp-hd">
                    <div className="cc-pp-kicker">
                        {scope.kind === 'matchup' ? 'Publish one matchup' : 'Publish week'}
                    </div>
                    <div className="cc-pp-title">{scope.title}</div>
                    <div className="cc-pp-sub">{scope.sub}</div>
                </div>

                {error && <div className="cc-pp-alert">{error}</div>}

                {!plan && !error ? (
                    <div className="cc-pp-body"><div className="cc-pp-loading">Working out what would be sent…</div></div>
                ) : (
                    <div className="cc-pp-body">
                        <div className="cc-pp-headline">{headline}</div>
                        {n > 0 && (
                            <div className="cc-pp-headline-sub">
                                Final assignment email — their shift is locked in, no action needed.
                            </div>
                        )}

                        {n === 0 ? (
                            <div className="cc-pp-empty">
                                {alreadyLive.length > 0
                                    ? 'Every confirmed assignment in this scope is already published. '
                                      + 'Publishing again would send nothing — you can safely close this.'
                                    : 'Nothing is confirmed here yet. Confirmed slots are the only ones that publish.'}
                            </div>
                        ) : (
                            <div className="cc-pp-people">
                                {willEmail.map(p => (
                                    <div key={p.assignmentId} className="cc-pp-person">
                                        <span className="cc-pp-avatar">{initials(p.userName)}</span>
                                        <span>
                                            <span className="cc-pp-name">{p.userName}</span>
                                            <span className="cc-pp-detail">
                                                {[p.slotLabel, p.matchup, p.dayDate, p.time].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {alreadyLive.length > 0 && (
                            <div className="cc-pp-note is-ok">
                                <span className="cc-pp-note-mark">&#10003;</span>
                                <span>
                                    <span className="cc-pp-note-line">
                                        {plural(alreadyLive.length, 'assignment')}
                                        {alreadyLive.length === 1 ? ' is' : ' are'} already published and will not be re-sent.
                                    </span>
                                    <span className="cc-pp-note-names">
                                        {alreadyLive.map(p => `${p.userName} (${p.slotLabel})`).join(', ')}
                                    </span>
                                </span>
                            </div>
                        )}

                        {blocked.length > 0 && (
                            <div className="cc-pp-note">
                                <span className="cc-pp-note-mark">&#8213;</span>
                                <span>
                                    <span className="cc-pp-note-line">
                                        {plural(blocked.length, 'slot')} won&apos;t publish yet:
                                    </span>
                                    {blocked.map(p => (
                                        <span key={p.assignmentId} className="cc-pp-note-names">
                                            {p.userName} · {p.slotLabel}, {p.matchup} · {p.reason}
                                        </span>
                                    ))}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div className="cc-pp-ft">
                    <button type="button" className="cc-pp-cancel" disabled={busy} onClick={onCancel}>
                        {n === 0 && plan ? 'Close' : 'Cancel'}
                    </button>
                    <button
                        type="button"
                        className="cc-pp-go"
                        disabled={busy || !plan || n === 0}
                        onClick={onConfirm}
                    >
                        {busy ? 'Sending…' : n === 0 ? 'Nothing to send' : `Send ${plural(n, 'Email')}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PublishPreview;
