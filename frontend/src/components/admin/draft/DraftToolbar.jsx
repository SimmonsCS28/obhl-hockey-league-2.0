import { useEffect, useRef } from 'react';
import {
    CARD_SIZE_STEPS, DENSITY_STEPS, GRID_ROSTERS, LAYOUT
} from './draftLayout';
import { SAVE_STATES, saveStatusLabel } from './useAutoSave';

const LAYOUT_STEPS = [
    { id: LAYOUT.ROWS, label: 'Rows', title: 'One row of columns - scroll sideways' },
    { id: LAYOUT.GRID, label: 'Grid', title: 'Wraps across several rows - scroll down' }
];

const ROSTER_STEPS = [
    { id: GRID_ROSTERS.FULL, label: 'Full', title: 'Every column as tall as its roster - whole teams visible, no inner scrolling' },
    { id: GRID_ROSTERS.EVEN, label: 'Even', title: 'Equal-height columns that scroll internally - rows line up for comparison' }
];

function Segmented({ label, steps, value, onChange, conditional }) {
    return (
        <span className={`obi-draft-seg ${conditional ? 'is-conditional' : ''}`}>
            <span className="obi-draft-eyebrow obi-draft-seg-label">{label}</span>
            {steps.map(step => (
                <button
                    key={step.id}
                    type="button"
                    className={`obi-draft-seg-btn ${value === step.id ? 'is-on' : ''}`}
                    title={step.title}
                    aria-pressed={value === step.id}
                    onClick={() => onChange(step.id)}
                >
                    {step.label}
                </button>
            ))}
        </span>
    );
}

/**
 * The control bar.
 *
 * Three groups in a fixed order - context, phase actions, endgame - and it WRAPS. It never
 * scrolls horizontally: a control that has slid off the right edge is a control the
 * operator cannot find, and this screen gets used once a year under pressure.
 *
 * The destructive actions (Reset, New draft) live only in the ⋯ drawer under a red
 * heading, so they cannot be hit while reaching for Export.
 */
export default function DraftToolbar({
    phase, seasons, seasonId, seasonsLoading, onSeasonChange, onCreateSeason,
    teamCount, onTeamCount, onUpload, onTemplate, onStart, startDisabled, startHint, ready,
    onAssignGMs, onAssignBuddies, showAssignGMs, showAssignBuddies,
    onUndo, undoDepth, onExport, onFinalize,
    saveStatus, lastSavedAt, onSaveNow, onRetry,
    density, onDensity, cardSize, onCardSize, layout, onLayout,
    perRow, onPerRow, gridRosters, onGridRosters,
    search, menuOpen, onToggleMenu, onNewDraft, onReset
}) {
    const isLive = phase === 'live';
    const menuRef = useRef(null);
    const findRef = useRef(null);

    // Close the popovers on an outside click. Escape is handled globally by the board.
    useEffect(() => {
        if (!menuOpen) return undefined;
        const onDown = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onToggleMenu(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [menuOpen, onToggleMenu]);

    const showResults = search.hasQuery && (search.poolHits.length + search.teamHits.length) > 0;

    return (
        <div className="obi-draft-bar">
            {/* ---- context ---- */}
            <div className="obi-draft-bar-group">
                <span className="obi-draft-wordmark">DRAFT</span>
                <span className={`obi-draft-phase ${isLive ? 'is-live' : 'is-setup'}`}>
                    {isLive ? 'Drafting' : 'Setup'}
                </span>
                <span className="obi-draft-rule" />
                <select
                    className="obi-draft-select"
                    style={{ minWidth: 170 }}
                    value={seasonId || ''}
                    onChange={onSeasonChange}
                    disabled={isLive || seasonsLoading}
                    title="Season this draft will create"
                    aria-label="Season"
                >
                    <option value="">{seasonsLoading ? 'Loading seasons…' : '— Select a season —'}</option>
                    {seasons.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.status === 'active' ? ' (active)' : ''}</option>
                    ))}
                </select>
                {!isLive && (
                    <button type="button" className="obi-draft-btn is-quiet" onClick={onCreateSeason}>+ New season</button>
                )}
            </div>

            {/* ---- find: one box, both jobs ---- */}
            <div className="obi-draft-find" ref={findRef}>
                <div className={`obi-draft-find-box ${search.hasQuery ? 'is-active' : ''}`}>
                    <span aria-hidden="true" style={{ fontSize: 12, color: 'var(--obi-text-muted)' }}>⌕</span>
                    <input
                        className="obi-draft-find-input"
                        value={search.query}
                        onChange={(e) => search.search(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); search.next(); }
                        }}
                        placeholder="Find a player anywhere on the board"
                        aria-label="Find a player anywhere on the board"
                    />
                    {search.hasQuery && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
                            <span className="obi-draft-find-count">
                                {search.matches.length ? `${search.matchIndex + 1} / ${search.matches.length}` : 'none'}
                            </span>
                            <button type="button" className="obi-draft-find-nav" onClick={search.previous} title="Previous match" disabled={!search.matches.length}>‹</button>
                            <button type="button" className="obi-draft-find-nav" onClick={search.next} title="Next match (Enter)" disabled={!search.matches.length}>›</button>
                            <button type="button" className="obi-draft-find-clear" onClick={search.onClear} title="Clear (Esc) — returns the board to where you were">✕</button>
                        </span>
                    )}
                </div>

                {showResults && (
                    <div className="obi-draft-pop is-find">
                        <div className="obi-draft-pop-head">In the pool · {search.poolHits.length}</div>
                        {search.poolHits.length === 0 && <div className="obi-draft-pop-empty">No pool matches</div>}
                        {search.poolHits.map(hit => (
                            <button
                                key={hit.player.email}
                                type="button"
                                className={`obi-draft-hit ${search.currentMatch && search.currentMatch.player.email === hit.player.email ? 'is-current' : ''}`}
                                onClick={() => search.jumpToPlayer(hit.player.email)}
                            >
                                <span className="obi-draft-hit-name">{hit.player.firstName} {hit.player.lastName}</span>
                                <span className="obi-draft-hit-meta">{hit.player.position === 'Defense' ? 'D' : 'F'}:{hit.player.skillRating}</span>
                            </button>
                        ))}
                        <div className="obi-draft-pop-head" style={{ borderTop: '1px solid rgba(157,185,205,0.1)' }}>
                            Already on a team · {search.teamHits.length}
                        </div>
                        {search.teamHits.length === 0 && <div className="obi-draft-pop-empty">No team matches</div>}
                        {search.teamHits.map(hit => (
                            <button
                                key={hit.player.email}
                                type="button"
                                className={`obi-draft-hit ${search.currentMatch && search.currentMatch.player.email === hit.player.email ? 'is-current' : ''}`}
                                onClick={() => search.jumpToPlayer(hit.player.email)}
                            >
                                <span className="obi-draft-hit-swatch" style={{ background: search.colourOf(hit.teamId) }} />
                                <span className="obi-draft-hit-name">{hit.player.firstName} {hit.player.lastName}</span>
                                <span className="obi-draft-hit-team">{hit.team.name}</span>
                                <span className="obi-draft-hit-meta">{hit.player.position === 'Defense' ? 'D' : 'F'}:{hit.player.skillRating}</span>
                            </button>
                        ))}
                        <div className="obi-draft-pop-foot">Enter jumps to the next match · Esc clears and returns the board</div>
                    </div>
                )}
            </div>

            {/* ---- save state ---- */}
            <div className="obi-draft-bar-group">
                <span className="obi-draft-save" data-state={saveStatus}>
                    <span className="obi-draft-save-dot" aria-hidden="true" />
                    {/* polite, not assertive: autosave chatter must never interrupt someone
                        mid-sentence while they are drafting. */}
                    <span className="obi-draft-save-text" role="status" aria-live="polite">
                        {saveStatusLabel(saveStatus, lastSavedAt)}
                    </span>
                    {saveStatus === SAVE_STATES.ERROR && (
                        <button type="button" className="obi-draft-save-retry" onClick={onRetry}>Retry</button>
                    )}
                </span>
                <button
                    type="button"
                    className="obi-draft-btn"
                    onClick={onSaveNow}
                    title="Autosave already has this. Use it when you want an explicit commit point."
                >
                    Save now
                </button>
            </div>

            <div className="obi-draft-bar-break" />

            {/* ---- phase actions ---- */}
            {!isLive ? (
                <div className="obi-draft-bar-group">
                    <span className="obi-draft-eyebrow">Setup</span>
                    <span className="obi-draft-step">
                        <span className="obi-draft-eyebrow">Teams</span>
                        <button type="button" className="obi-draft-step-btn" onClick={() => onTeamCount(teamCount - 1)} disabled={teamCount <= 1} aria-label="Fewer teams">−</button>
                        <span className="obi-draft-step-value">{teamCount}</span>
                        <button type="button" className="obi-draft-step-btn" onClick={() => onTeamCount(teamCount + 1)} disabled={teamCount >= 14} aria-label="More teams">+</button>
                    </span>
                    <button type="button" className="obi-draft-btn" onClick={onUpload}>↑ Upload registrations</button>
                    <button type="button" className="obi-draft-btn is-quiet" onClick={onTemplate}>↓ Template</button>
                    <span className="obi-draft-rule" />
                    <button type="button" className="obi-draft-btn is-primary" onClick={onStart} disabled={startDisabled}>▶ Start draft</button>
                    <span className={`obi-draft-hint ${ready ? 'is-ready' : ''}`}>{startHint}</span>
                </div>
            ) : (
                <div className="obi-draft-bar-group">
                    <span className="obi-draft-eyebrow">Drafting</span>
                    {showAssignGMs && <button type="button" className="obi-draft-btn" onClick={onAssignGMs}>Assign GMs</button>}
                    {showAssignBuddies && <button type="button" className="obi-draft-btn" onClick={onAssignBuddies}>Assign GM buddies</button>}
                    <button type="button" className="obi-draft-btn" onClick={onUndo} disabled={undoDepth === 0}>
                        ↩ Undo {undoDepth > 0 ? `(${undoDepth})` : ''}
                    </button>
                    <button type="button" className="obi-draft-btn is-quiet" onClick={onExport}>Export CSV</button>
                </div>
            )}

            <div className="obi-draft-bar-spacer" />

            {/* ---- endgame: how the board looks, then how it ends ---- */}
            <div className="obi-draft-bar-group">
                <Segmented label="Density" steps={DENSITY_STEPS} value={density} onChange={onDensity} />
                <Segmented label="Card size" steps={CARD_SIZE_STEPS} value={cardSize} onChange={onCardSize} />
                <Segmented label="Layout" steps={LAYOUT_STEPS} value={layout} onChange={onLayout} />
                {layout === LAYOUT.GRID && (
                    <>
                        <span className="obi-draft-step">
                            <span className="obi-draft-eyebrow">Across</span>
                            <button type="button" className="obi-draft-step-btn" onClick={() => onPerRow(perRow - 1)} disabled={perRow <= 3} aria-label="Fewer columns across">−</button>
                            <span className="obi-draft-step-value">{perRow}</span>
                            <button type="button" className="obi-draft-step-btn" onClick={() => onPerRow(perRow + 1)} disabled={perRow >= 7} aria-label="More columns across">+</button>
                        </span>
                        <Segmented label="Rosters" steps={ROSTER_STEPS} value={gridRosters} onChange={onGridRosters} conditional />
                    </>
                )}
                {isLive && (
                    <button type="button" className="obi-draft-btn is-accent" onClick={onFinalize}>Finalize draft…</button>
                )}
                <div style={{ position: 'relative' }} ref={menuRef}>
                    <button
                        type="button"
                        className="obi-draft-btn"
                        style={{ width: 34, padding: 0, fontSize: 15 }}
                        onClick={() => onToggleMenu(!menuOpen)}
                        title="Danger zone: reset, new draft"
                        aria-haspopup="true"
                        aria-expanded={menuOpen}
                    >
                        ⋯
                    </button>
                    {menuOpen && (
                        <div className="obi-draft-pop is-menu">
                            <div className="obi-draft-pop-head">Draft file</div>
                            <button type="button" className="obi-draft-menu-item" onClick={onTemplate}>Download template</button>
                            <button type="button" className="obi-draft-menu-item" onClick={onUpload}>Re-upload registrations…</button>
                            <div className="obi-draft-pop-head is-danger">Can’t be undone</div>
                            <button type="button" className="obi-draft-menu-item is-danger" onClick={onNewDraft}>New draft…</button>
                            <button type="button" className="obi-draft-menu-item is-danger" onClick={onReset}>Reset draft…</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
