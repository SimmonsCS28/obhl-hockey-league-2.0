import { DENSITY, badgeCap, dotCap } from './draftLayout';

const POSITION_OPTIONS = ['Forward', 'Defense'];
const STATUS_OPTIONS = ['Veteran', 'Rookie'];
const SKILL_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

const BADGE_NAMES = {
    gm: 'General manager',
    ref: 'Referee',
    vet: 'Veteran',
    buddy: 'Has a buddy request'
};

function badgesFor(player) {
    const out = [];
    if (player.isGm) out.push({ key: 'gm', label: 'GM' });
    if (player.isRef) out.push({ key: 'ref', label: 'REF' });
    if (player.isVeteran || player.status === 'Veteran') out.push({ key: 'vet', label: 'V' });
    if (player.buddyPick) out.push({ key: 'buddy', label: '↔' });
    return out;
}

const skillClass = (n) => {
    const v = Number(n) || 0;
    if (v >= 8) return 'obi-draft-skill-high';
    if (v <= 3) return 'obi-draft-skill-low';
    return 'obi-draft-skill-mid';
};

const shortName = (p) => `${(p.firstName || '?')[0]}. ${p.lastName || ''}`.trim();
const initials = (p) => `${(p.firstName || '?')[0]}${(p.lastName || '?')[0]}`.toUpperCase();
const posLetter = (p) => (p.position === 'Defense' ? 'D' : p.position === 'Goalie' ? 'G' : 'F');

/**
 * One player card, in all three densities.
 *
 * Editing lives on the SELECTED card only, and only in Detailed. Rendering editors on
 * every card is roughly 670 native controls and 2,500 option nodes on a full board, which
 * does not merely feel heavy - it wedges the page. The read-only chips occupy identical
 * geometry, so selecting a card never changes its height and the card the operator is
 * aiming at never moves.
 */
export default function PlayerCard({
    player,
    source,
    density,
    colW,
    metrics,
    isLive,
    isSelected,
    matchMark,
    isDragging,
    onSelect,
    onDragStart,
    onFieldChange,
    registerRef
}) {
    const inPool = source === 'pool';
    const isOverview = density === DENSITY.OVERVIEW;
    const isDetailed = density === DENSITY.DETAILED;
    const editing = isDetailed && isSelected && isLive;

    const badges = badgesFor(player);
    const cap = badgeCap(density, colW);
    const shown = badges.slice(0, cap);
    const overflow = badges.slice(cap, cap + dotCap(density));

    const posSkill = `${posLetter(player)}:${player.skillRating ?? '-'}`;
    const status = player.status || (player.isVeteran ? 'Veteran' : 'Rookie');

    const title = [
        `${player.firstName} ${player.lastName}`,
        player.position || 'Forward',
        `skill ${player.skillRating ?? '-'}`,
        status,
        player.buddyPick ? `buddies: ${player.buddyPick}` : null,
        isDetailed && !isSelected && isLive ? '— click the card to edit these fields' : null
    ].filter(Boolean).join(' · ');

    const classes = [
        'obi-draft-card',
        inPool ? 'in-pool' : 'on-team',
        isLive ? 'is-live' : '',
        isSelected ? 'is-selected' : '',
        matchMark ? 'is-match' : '',
        matchMark === 2 ? 'is-match-current' : '',
        isDragging ? 'is-dragging' : ''
    ].filter(Boolean).join(' ');

    // Editors must not let their clicks reach the card, or selecting the card closes the
    // dropdown the operator just opened.
    const stop = (e) => e.stopPropagation();
    const set = (field) => (e) => onFieldChange(player.email, field, e.target.value);
    const setInt = (field) => (e) => onFieldChange(player.email, field, parseInt(e.target.value, 10));

    return (
        <div
            className={classes}
            style={{ padding: metrics.padding }}
            title={title}
            draggable={isLive}
            onDragStart={isLive ? (e) => onDragStart(e, player, source) : undefined}
            onClick={isLive ? () => onSelect(player.email) : undefined}
            ref={(el) => registerRef && registerRef(player.email, el)}
        >
            {isOverview ? (
                <div className="obi-draft-card-row is-overview">
                    <span className="obi-draft-card-initials" style={{ fontSize: metrics.nameSize }}>
                        {initials(player)}
                    </span>
                    <span className="obi-draft-card-slack" />
                    {badges.slice(0, dotCap(density)).map(b => (
                        <span key={b.key} className={`obi-draft-dot is-${b.key}`} title={BADGE_NAMES[b.key]} />
                    ))}
                    <span className={`obi-draft-card-skill ${skillClass(player.skillRating)}`} style={{ fontSize: metrics.skillSize }}>
                        {posSkill}
                    </span>
                </div>
            ) : (
                <>
                    <div className="obi-draft-card-row">
                        <span
                            className="obi-draft-card-name"
                            style={{ fontSize: inPool ? metrics.poolNameSize : metrics.nameSize }}
                        >
                            {isDetailed ? `${player.firstName} ${player.lastName}` : shortName(player)}
                        </span>
                        {shown.map(b => (
                            <span key={b.key} className={`obi-draft-badge is-${b.key}`}>{b.label}</span>
                        ))}
                        {overflow.length > 0 && (
                            <span
                                className="obi-draft-dots"
                                title={overflow.map(b => BADGE_NAMES[b.key]).join(' · ')}
                            >
                                {overflow.map(b => <span key={b.key} className={`obi-draft-dot is-${b.key}`} />)}
                            </span>
                        )}
                        <span
                            className={`obi-draft-card-skill ${skillClass(player.skillRating)}`}
                            style={{ fontSize: inPool ? metrics.poolNameSize : metrics.skillSize }}
                        >
                            {posSkill}
                        </span>
                    </div>

                    {isDetailed && (editing ? (
                        <>
                            <div className="obi-draft-fields" onClick={stop} onMouseDown={stop}>
                                <select className="obi-draft-field is-pos" value={player.position || 'Forward'} onChange={set('position')} aria-label="Position">
                                    {POSITION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <select className="obi-draft-field is-skill" value={String(player.skillRating ?? 5)} onChange={setInt('skillRating')} aria-label="Skill rating">
                                    {SKILL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <select className="obi-draft-field is-status" value={status} onChange={set('status')} aria-label="Status">
                                    {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div className="obi-draft-fields" onClick={stop} onMouseDown={stop}>
                                <button
                                    type="button"
                                    className={`obi-draft-toggle is-gm ${player.isGm ? 'is-on' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); onFieldChange(player.email, 'isGm', !player.isGm); }}
                                >GM</button>
                                <button
                                    type="button"
                                    className={`obi-draft-toggle is-ref ${player.isRef ? 'is-on' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); onFieldChange(player.email, 'isRef', !player.isRef); }}
                                >REF</button>
                                <input
                                    className="obi-draft-field is-buddies"
                                    value={player.buddyPick || ''}
                                    onChange={set('buddyPick')}
                                    placeholder="buddies"
                                    aria-label="Buddy requests"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="obi-draft-fields">
                                <span className="obi-draft-chipfield is-pos">{posLetter(player)}</span>
                                <span className="obi-draft-chipfield is-skill">{player.skillRating ?? '-'}</span>
                                <span className="obi-draft-chipfield is-status">{status}</span>
                            </div>
                            <div className="obi-draft-fields">
                                <span className={`obi-draft-toggle is-gm ${player.isGm ? 'is-on' : ''}`}>GM</span>
                                <span className={`obi-draft-toggle is-ref ${player.isRef ? 'is-on' : ''}`}>REF</span>
                                <span className={`obi-draft-chipfield is-buddies ${player.buddyPick ? '' : 'is-muted'}`}>
                                    {player.buddyPick || 'no buddies'}
                                </span>
                            </div>
                        </>
                    ))}
                </>
            )}
        </div>
    );
}
