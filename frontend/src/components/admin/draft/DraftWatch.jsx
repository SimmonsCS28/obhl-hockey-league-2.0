import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import PlayerCard from './PlayerCard';
import TeamColumn from './TeamColumn';
import { boardBalance } from './draftBalance';
import {
    CARD_SIZE, DENSITY, LAYOUT, TEAM_COLORS, TEAM_COLOR_NAMES,
    boardGeometry, cardMetrics, columnWidth, columnWidthCss
} from './draftLayout';
import { DEFAULT_TEAM_COLOR, DEFAULT_TEAM_SORT, fromDraftPayload } from './draftReducer';
import { WATCH_KEY, loadViewPrefs, saveViewPrefs } from './draftViewPrefs';
import { useBoardSearch } from './useBoardSearch';
import './DraftBoard.css';

/**
 * The read-only draft board GMs watch from their own devices.
 *
 * Three things make this page cheap to build, all of them decisions that were already made
 * elsewhere:
 *
 *   1. PlayerCard gates editing on `isDetailed && isSelected && isLive`, and takes every
 *      interaction as an injected callback. Pass no callbacks and isLive={false} and the same
 *      cards the operator sees render inert. No read-only variant of the card exists, because
 *      none is needed.
 *   2. View options already live in the viewer's own localStorage rather than in the saved draft,
 *      so a GM changing density on their phone cannot reach the operator's board. This page just
 *      points at its own key.
 *   3. boardBalance() derives everything from teams and players, so the balance strip needs no
 *      privileged data to compute.
 *
 * The payload arrives already stripped of personal data by league-service. Emails are replaced
 * with opaque handles rather than removed, so the card keys and buddy links this page renders
 * still work while carrying nothing identifying.
 */

const POLL_MS = 5000;

export default function DraftWatch() {
    const [params] = useSearchParams();
    const token = params.get('t') || '';

    const [doc, setDoc] = useState(null);
    const [seasonName, setSeasonName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    // Only the display options are honoured here; the rest of the saved shape is ignored.
    const [view, setView] = useState(() => loadViewPrefs(WATCH_KEY));
    const setViewField = (patch) => setView(v => {
        const next = { ...v, ...patch };
        saveViewPrefs(next, WATCH_KEY);
        return next;
    });
    const { density, cardSize, layout, perRow, gridRosters } = view;

    // The ETag is kept in a ref rather than state: it changes on every poll and must not
    // re-render anything or re-create the polling effect.
    const etagRef = useRef(null);

    const load = useCallback(async () => {
        if (!token) {
            setError('This link is missing its access code.');
            setLoading(false);
            return;
        }
        try {
            const headers = {};
            if (etagRef.current) headers['If-None-Match'] = etagRef.current;

            const res = await fetch(`/api/v1/auth/draft-watch?t=${encodeURIComponent(token)}`, { headers });

            // The usual answer once the board settles: nothing changed, nothing to redraw.
            if (res.status === 304) {
                setLoading(false);
                return;
            }
            if (!res.ok) {
                let message = 'This draft link is not valid, or sharing has been turned off.';
                try {
                    const body = await res.json();
                    if (body && body.error) message = body.error;
                } catch {
                    // Non-JSON error body; the default message is more useful than parse noise.
                }
                setError(message);
                // 404 means the link itself is dead — revoked, rotated, or never real. Drop the
                // board so the page fails CLOSED and says so. Without this the viewer keeps
                // staring at the last good board indefinitely and believes it is current, which
                // is worse than showing nothing: revoking a link would not actually take it away.
                if (res.status === 404) {
                    setDoc(null);
                    etagRef.current = null;
                }
                // Any other status is treated as a blip — a 502 while the operator's service
                // restarts should not wipe a board that is still perfectly valid.
                setLoading(false);
                return;
            }

            etagRef.current = res.headers.get('ETag');
            const body = await res.json();
            const payload = typeof body.draftData === 'string' ? JSON.parse(body.draftData) : body.draftData;
            setDoc(fromDraftPayload(payload || {}));
            setSeasonName(body.seasonName || '');
            setLastUpdate(new Date());
            setError('');
        } catch {
            // A dropped request on a phone changing cells is normal. Keep showing the last good
            // board and try again on the next tick rather than blanking the screen.
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
        const id = setInterval(() => {
            // A backgrounded tab is not being watched, so it should not be polling. This is
            // the difference between a phone in a pocket costing nothing and costing battery
            // for the whole draft.
            if (!document.hidden) load();
        }, POLL_MS);

        // Coming back to the tab should show the current board immediately, not up to five
        // seconds of stale one.
        const onVisible = () => { if (!document.hidden) load(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [load]);

    // Memoised on `doc` rather than derived inline: a fresh [] each render would make the
    // balance memo below recompute on every tick of a page that exists to poll.
    const teams = useMemo(() => doc?.teams || [], [doc]);
    const playerPool = useMemo(() => doc?.playerPool || [], [doc]);

    const geometry = useMemo(
        () => boardGeometry({ density, cardSize, layout, gridRosters }),
        [density, cardSize, layout, gridRosters]
    );
    const metrics = useMemo(() => cardMetrics(density, cardSize), [density, cardSize]);
    const colW = useMemo(() => columnWidth(density, cardSize), [density, cardSize]);
    const colWCss = useMemo(
        () => columnWidthCss(density, cardSize, layout, perRow),
        [density, cardSize, layout, perRow]
    );

    // Same find-and-reveal the operator has: it narrows the pool rail and jumps the board to a
    // player already drafted, on both axes. includeEmail is off because that field holds an
    // opaque digest here, not an address - see matchesQuery.
    const search = useBoardSearch({ playerPool, teams, density, cardSize, layout, includeEmail: false });

    // Escape clears the find, matching the operator board. Nothing else on this page is
    // dismissible, so it can be unconditional.
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') search.clear(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [search]);

    const visiblePool = useMemo(() => {
        if (!search.hasQuery) return playerPool;
        const hits = new Set(search.poolHits.map(h => h.player.email));
        return playerPool.filter(p => hits.has(p.email));
    }, [playerPool, search.hasQuery, search.poolHits]);

    const balance = useMemo(() => boardBalance(teams), [teams]);
    const balanceById = useMemo(() => {
        const map = {};
        balance.perTeam.forEach(entry => { map[entry.team.id] = entry.balance; });
        return map;
    }, [balance]);

    if (loading && !doc) {
        return <div className="obi-draft-watch-state">Loading the draft board…</div>;
    }
    if (error && !doc) {
        return (
            <div className="obi-draft-watch-state">
                <div className="obi-draft-watch-state-title">Can’t show this board</div>
                <div>{error}</div>
            </div>
        );
    }
    if (!doc) {
        return <div className="obi-draft-watch-state">No draft to show yet.</div>;
    }

    const segmented = (label, options, value, field) => (
        <div className="obi-draft-seg">
            <span className="obi-draft-eyebrow">{label}</span>
            {options.map(opt => (
                <button
                    key={opt.value}
                    type="button"
                    className={`obi-draft-seg-btn ${value === opt.value ? 'is-on' : ''}`}
                    aria-pressed={value === opt.value}
                    onClick={() => setViewField({ [field]: opt.value })}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );

    return (
        <div className="obi-draft-root obi-draft-watch">
            <div className="obi-draft-bar">
                <div className="obi-draft-bar-group">
                    <span className="obi-draft-wordmark">DRAFT</span>
                    <span className="obi-draft-eyebrow">Watching</span>
                    {seasonName && <span className="obi-draft-hint is-ready">{seasonName}</span>}
                </div>

                <div className="obi-draft-find">
                    <div className={`obi-draft-find-box ${search.hasQuery ? 'is-active' : ''}`}>
                        <span aria-hidden="true" style={{ fontSize: 12, color: 'var(--obi-text-muted)' }}>&#8981;</span>
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
                                <button type="button" className="obi-draft-find-nav" onClick={search.previous} title="Previous match" disabled={!search.matches.length}>&#8249;</button>
                                <button type="button" className="obi-draft-find-nav" onClick={search.next} title="Next match (Enter)" disabled={!search.matches.length}>&#8250;</button>
                                <button type="button" className="obi-draft-find-clear" onClick={search.clear} title="Clear (Esc)">&#10005;</button>
                            </span>
                        )}
                    </div>
                </div>

                <div className="obi-draft-bar-group is-trailing">
                    {segmented('Density', [
                        { value: DENSITY.DETAILED, label: 'Detailed' },
                        { value: DENSITY.BALANCED, label: 'Balanced' },
                        { value: DENSITY.OVERVIEW, label: 'Overview' }
                    ], density, 'density')}
                    {segmented('Card size', [
                        { value: CARD_SIZE.S, label: 'S' },
                        { value: CARD_SIZE.M, label: 'M' },
                        { value: CARD_SIZE.L, label: 'L' }
                    ], cardSize, 'cardSize')}
                    {segmented('Layout', [
                        { value: LAYOUT.ROWS, label: 'Rows' },
                        { value: LAYOUT.GRID, label: 'Grid' }
                    ], layout, 'layout')}
                </div>
            </div>

            <div className="obi-draft-strip">
                {balance.chips.map(chip => (
                    <span key={chip.axisId} className={`obi-draft-chip is-static is-${chip.band}`} title={chip.title}>
                        <span className="obi-draft-chip-axis">{chip.axis}</span>
                        <span className="obi-draft-chip-text">{chip.text}</span>
                    </span>
                ))}
                <span className="obi-draft-watch-stamp">
                    {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Waiting for the board…'}
                </span>
            </div>

            <div className="obi-draft-body">
                <div className="obi-draft-pool">
                    <div className="obi-draft-pool-head">
                        <div className="obi-draft-pool-title">
                            <span className="obi-draft-pool-name">STILL AVAILABLE</span>
                            <span className="obi-draft-pool-count">{playerPool.length}</span>
                        </div>
                        {search.hasQuery && (
                            <div className="obi-draft-pool-filtered">
                                <span className="obi-draft-pool-filtered-tag">Filtered by find</span>
                                <span className="obi-draft-pool-filtered-q">&#8220;{search.query}&#8221;</span>
                                <button type="button" className="obi-draft-find-clear" onClick={search.clear}>&#10005;</button>
                            </div>
                        )}
                    </div>
                    <div className="obi-draft-pool-list">
                        {visiblePool.length === 0 && (
                            <div className="obi-draft-empty">
                                <div className="obi-draft-empty-title">
                                    {playerPool.length === 0 ? 'Nobody left' : 'Nothing matches'}
                                </div>
                                <div className="obi-draft-empty-body">
                                    {playerPool.length === 0
                                        ? 'Every player has been drafted.'
                                        : 'They may already be on a team - check the match count above.'}
                                </div>
                            </div>
                        )}
                        {visiblePool.map(player => (
                            <PlayerCard
                                key={player.email}
                                player={player}
                                source="pool"
                                density={density}
                                colW={colW}
                                metrics={metrics}
                                isLive={false}
                                matchMark={search.matchMarks[player.email] || 0}
                                registerRef={search.registerCard}
                            />
                        ))}
                    </div>
                </div>

                <div className="obi-draft-boardwrap">
                    <div
                        className="obi-draft-board"
                        aria-label={`Team board, ${teams.length} teams`}
                        style={{
                            overflowX: geometry.overflowX,
                            overflowY: geometry.overflowY,
                            flexWrap: geometry.flexWrap,
                            alignItems: geometry.alignItems
                        }}
                        ref={search.registerBoard}
                    >
                        {teams.map(team => (
                            <TeamColumn
                                key={team.id}
                                team={team}
                                balance={balanceById[team.id] || { size: 0, stats: [], flagged: false }}
                                colour={TEAM_COLORS[doc.teamColors?.[team.id] || DEFAULT_TEAM_COLOR]}
                                colourName={doc.teamColors?.[team.id] || DEFAULT_TEAM_COLOR}
                                colourOptions={TEAM_COLOR_NAMES}
                                sortOption={doc.teamSortOptions?.[team.id] || DEFAULT_TEAM_SORT}
                                width={colWCss}
                                height={geometry.columnHeight}
                                maxHeight={geometry.columnMaxHeight}
                                rosterMinHeight={geometry.rosterMinHeight}
                                rosterMaxHeight={geometry.rosterMaxHeight}
                                density={density}
                                colW={colW}
                                metrics={metrics}
                                isLive={false}
                                matchCount={search.teamMatchCounts[team.id] || 0}
                                matchMarks={search.matchMarks}
                                showMeta={density !== DENSITY.OVERVIEW}
                                rankDelta={0}
                                isGrid={layout === LAYOUT.GRID}
                                registerColumn={search.registerColumn}
                                registerRoster={search.registerRoster}
                                registerCard={search.registerCard}
                                readOnly
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
