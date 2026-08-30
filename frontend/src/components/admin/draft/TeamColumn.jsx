import PlayerCard from './PlayerCard';
import { jerseyHeader } from './draftLayout';
import { getSortedTeamPlayers } from './draftSelectors';

const TEAM_SORTS = ['Position + Rating', 'Rating: High to Low', 'Rating: Low to High', 'Position'];

/**
 * One team column: jersey header, colour/sort row, balance block, roster, and the
 * assign-here footer that exists only while a player is selected.
 *
 * The header keeps the real jersey colour - the operator picks "Red" because that team
 * wears red - so the discipline comes from rendering: text flips on computed luminance,
 * an inset ring separates it from the page on both light and dark colours, and the roster
 * below it is always the card token. Nothing else on the board uses a jersey colour.
 */
export default function TeamColumn({
    team,
    balance,
    colour,
    colourName,
    colourOptions,
    sortOption,
    width,
    height,
    maxHeight,
    rosterMinHeight,
    rosterMaxHeight,
    density,
    colW,
    metrics,
    isLive,
    isDropTarget,
    matchCount,
    matchMarks,
    selectedEmail,
    draggingEmail,
    hasSelection,
    showMeta,
    onDragOver,
    onDragLeave,
    onDrop,
    onAssign,
    onRename,
    onColour,
    onSort,
    onSelect,
    onDragStart,
    onFieldChange,
    registerColumn,
    registerRoster,
    registerCard
}) {
    const header = jerseyHeader(colour);
    const sorted = getSortedTeamPlayers(team.players || [], sortOption);

    return (
        <div
            className={`obi-draft-col ${balance.flagged ? 'is-flagged' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}
            style={{ width, height, maxHeight }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            ref={(el) => registerColumn(team.id, el)}
        >
            <div
                className="obi-draft-col-head"
                style={{ background: colour, boxShadow: header.ring }}
            >
                <input
                    className="obi-draft-col-name"
                    style={{ color: header.foreground, textShadow: header.nameShadow }}
                    value={team.name}
                    onChange={(e) => onRename(team.id, e.target.value)}
                    title="Click to rename"
                    aria-label={`${team.name} name`}
                />
                {matchCount > 0 && (
                    <span className="obi-draft-col-matches" title={`${matchCount} search match${matchCount === 1 ? '' : 'es'} on this team`}>
                        {matchCount} ⌕
                    </span>
                )}
                <span className="obi-draft-col-size" style={{ color: header.foreground }}>{balance.size}</span>
            </div>

            {showMeta && (
                <div className="obi-draft-col-meta">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                        <span className="obi-draft-col-swatch" style={{ background: colour }} />
                        <select
                            className="obi-draft-select"
                            style={{ width: 74 }}
                            value={colourName}
                            onChange={(e) => onColour(team.id, e.target.value)}
                            title="Jersey colour"
                            aria-label={`${team.name} jersey colour`}
                        >
                            {colourOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </span>
                    <select
                        className="obi-draft-select"
                        style={{ flex: 1, minWidth: 0 }}
                        value={sortOption}
                        onChange={(e) => onSort(team.id, e.target.value)}
                        aria-label={`${team.name} roster sort`}
                    >
                        {TEAM_SORTS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
            )}

            <div className={`obi-draft-stats ${balance.flagged ? 'is-flagged' : ''}`}>
                {balance.stats.map(stat => (
                    <div key={stat.label}>
                        <div className="obi-draft-stat-head">
                            <span className="obi-draft-stat-label">{stat.label}</span>
                            <span className="obi-draft-stat-digits">{stat.digits}</span>
                            <span className={`obi-draft-stat-delta obi-draft-band-${stat.band}`}>{stat.delta}</span>
                        </div>
                        <div className="obi-draft-stat-track">
                            <span className="obi-draft-stat-tick" />
                            <span
                                className={`obi-draft-stat-bar obi-draft-band-${stat.band}`}
                                style={{ left: `${stat.barLeft}%`, width: `${stat.barWidth}%` }}
                            />
                        </div>
                    </div>
                ))}
                {balance.flagged && (
                    <span className={`obi-draft-flag obi-draft-band-${balance.flagBand}`}>{balance.flag}</span>
                )}
            </div>

            <div
                className="obi-draft-roster"
                style={{ minHeight: rosterMinHeight, maxHeight: rosterMaxHeight }}
                ref={(el) => registerRoster(team.id, el)}
            >
                {sorted.length === 0 && <div className="obi-draft-roster-empty">No players yet</div>}
                {sorted.map(player => (
                    <PlayerCard
                        key={player.email}
                        player={player}
                        source={`team-${team.id}`}
                        density={density}
                        colW={colW}
                        metrics={metrics}
                        isLive={isLive}
                        isSelected={selectedEmail === player.email}
                        matchMark={matchMarks[player.email] || 0}
                        isDragging={draggingEmail === player.email}
                        onSelect={onSelect}
                        onDragStart={onDragStart}
                        onFieldChange={onFieldChange}
                        registerRef={registerCard}
                    />
                ))}
            </div>

            {hasSelection && (
                <button type="button" className="obi-draft-assign" onClick={() => onAssign(team.id)}>
                    ＋ Assign here
                </button>
            )}
        </div>
    );
}
