import { useState } from 'react';
import './GoalieProposerBar.css';

const BUCKET_ORDER = { EARLY: 0, MID: 1, LATE: 2 };

/**
 * "Why" panel — the optimizer's reasoning for the last run, so the algorithm can be eyeballed
 * and tuned. Collapsed by default; shows sit-outs, per-goalie slot history, and soft-rule flags.
 */
function WhyPanel({ reasoning, sitting, week }) {
    const [open, setOpen] = useState(false);
    if (!reasoning) return null;

    const placements = [...(reasoning.placements || [])].sort((a, b) => {
        const d = (BUCKET_ORDER[a.bucket] ?? 1) - (BUCKET_ORDER[b.bucket] ?? 1);
        return d !== 0 ? d : (a.gameId - b.gameId);
    });

    // Group by game so each matchup reads as a pair.
    const byGame = [];
    for (const p of placements) {
        const last = byGame[byGame.length - 1];
        if (last && last.gameId === p.gameId) last.goalies.push(p);
        else byGame.push({ gameId: p.gameId, matchup: p.matchup, bucket: p.bucket, goalies: [p] });
    }

    return (
        <div className="gpb-why">
            <button type="button" className="gpb-why-toggle" onClick={() => setOpen(o => !o)}>
                {open ? '▾' : '▸'} Why these assignments?
            </button>

            {open && (
                <div className="gpb-why-body">
                    <div className="gpb-why-summary">
                        <span>{reasoning.pairingNote}</span>
                        <span className="gpb-why-costs">
                            skill cost {reasoning.skillCost} · rotation cost {reasoning.rotationCost}
                            <span className="gpb-why-hint"> (lower is better)</span>
                        </span>
                    </div>

                    {reasoning.unratedGoalies?.length > 0 && (
                        <div className="gpb-why-warn">
                            No skill rating resolved for: {reasoning.unratedGoalies.join(', ')} — paired at
                            league average. Check their player record for this season.
                        </div>
                    )}

                    {byGame.map(g => (
                        <div key={g.gameId} className="gpb-why-game">
                            <div className="gpb-why-game-hd">
                                <span className={`gpb-why-bucket is-${(g.bucket || '').toLowerCase()}`}>{g.bucket}</span>
                                <span className="gpb-why-matchup">{g.matchup}</span>
                            </div>
                            {g.goalies.map(p => (
                                <div key={p.userId} className="gpb-why-goalie">
                                    <span className="gpb-why-name">{p.userName}</span>
                                    <span className="gpb-why-rating">
                                        {p.ratingResolved ? `rating ${p.rating}` : 'unrated'} · {p.tierLabel}
                                    </span>
                                    <span className="gpb-why-slots">
                                        season slots — E{p.priorEarly} / M{p.priorMid} / L{p.priorLate}
                                    </span>
                                    {p.flags?.length > 0 && (
                                        <span className="gpb-why-flags">
                                            {p.flags.map((f, i) => <span key={i} className="gpb-why-flag">⚠ {f}</span>)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}

                    {sitting?.length > 0 && (
                        <div className="gpb-why-sitting">
                            <span className="gpb-why-sitting-label">Sitting out Week {week}</span>
                            {sitting.map(s => (
                                <span key={s.userId} className="gpb-why-sitting-item">
                                    {s.name} — {s.reason}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Weekly goalie auto-proposer bar, shared by the Coordinator Console (variant="console")
 * and Admin → Assignments (variant="admin"). Presentational only — the parent owns state
 * and passes counts + handlers. Shown only for a single, non-past week (parent decides).
 */
function GoalieProposerBar({
    week,
    variant = 'console',
    counts,
    published = false,
    publishedSummary,
    busy = null,          // 'generate' | 'send' | 'publish' | null
    anyFilled = false,    // any slot already filled → "Fill Remaining Open Slots"
    banner = null,
    onDismissBanner,
    onGenerate,
    onSend,
    onPublish,
    reasoning = null,     // last auto-propose run's "why" data
    sitting = null,
    playoff = false,      // playoff week: best-available-goalie mode, no slot rotation
}) {
    const { open, proposed, pending, confirmed } = counts;

    const statusParts = [
        `${open} open`,
        `${proposed} proposed`,
        `${pending} awaiting confirmation`,
        `${confirmed} confirmed`,
    ];

    return (
        <>
            {banner && (
                <div className={`gpb-banner gpb-banner--${variant}`}>
                    <span>{banner}</span>
                    {onDismissBanner && (
                        <button type="button" className="gpb-banner-x" onClick={onDismissBanner} aria-label="Dismiss">
                            ×
                        </button>
                    )}
                </div>
            )}

            <div className={`gpb-wrap gpb-wrap--${variant}`}>
            <div className={`gpb gpb--${variant}${(!published && reasoning) ? ' has-why' : ''}`}>
                {published ? (
                    <div className="gpb-published">
                        <span className="gpb-published-tag">✓ Published</span>
                        <span className="gpb-published-summary">{publishedSummary}</span>
                    </div>
                ) : (
                    <>
                        <div className="gpb-lead">
                            <div className="gpb-title">
                                Auto-Propose Goalies · Week {week}
                                {playoff && <span className="gpb-playoff-tag">Playoffs</span>}
                            </div>
                            <div className="gpb-status">
                                {playoff && <span className="gpb-mode-note">Best available goalies to bracket games · </span>}
                                {statusParts.join(' · ')}
                            </div>
                        </div>
                        <div className="gpb-actions">
                            {open > 0 && (
                                <button
                                    type="button"
                                    className="gpb-btn gpb-btn--generate"
                                    onClick={onGenerate}
                                    disabled={!!busy}
                                >
                                    {busy === 'generate'
                                        ? 'Working…'
                                        : anyFilled ? 'Fill Remaining Open Slots' : 'Generate Proposed Assignments'}
                                </button>
                            )}
                            {proposed > 0 && (
                                <button
                                    type="button"
                                    className="gpb-btn gpb-btn--send"
                                    onClick={onSend}
                                    disabled={!!busy}
                                >
                                    {busy === 'send' ? 'Sending…' : `Send Confirmation Emails (${proposed})`}
                                </button>
                            )}
                            {confirmed > 0 && (
                                <button
                                    type="button"
                                    className="gpb-btn gpb-btn--publish"
                                    onClick={onPublish}
                                    disabled={!!busy}
                                >
                                    {busy === 'publish' ? 'Publishing…' : `Publish Final Assignments (${confirmed})`}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {!published && (
                <WhyPanel reasoning={reasoning} sitting={sitting} week={week} />
            )}
            </div>
        </>
    );
}

export default GoalieProposerBar;
