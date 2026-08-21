import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import draftApi from '../../../services/draftApi';
import tournamentApi from '../../../services/tournamentApi';
import { parseEntrantWorkbook } from './entrantParser';
import './TournamentDraft.css';

/**
 * The C League Classic draft board.
 *
 * Operator-directed with no pick order: one person runs this from one screen on draft day. That
 * removes the snake, the rounds, the clock and the turn validation — and removes the mechanism that
 * would otherwise keep teams even. The roster-balance read-out in each team column is what replaces
 * it, which is why it is given real weight rather than tucked away.
 *
 * Every action posts immediately and returns the whole board. Draft day is exactly when a browser
 * gets closed, and a hundred round trips over an evening costs nothing.
 */
function TournamentDraft() {
    const [tournaments, setTournaments] = useState([]);
    const [slug, setSlug] = useState(null);
    const [board, setBoard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    const [query, setQuery] = useState('');
    const [posFilter, setPosFilter] = useState('All');
    const [hideAssigned, setHideAssigned] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [tab, setTab] = useState('board');

    useEffect(() => {
        tournamentApi.list(true)
            .then(list => {
                setTournaments(list);
                if (list.length) setSlug(s => s ?? list[0].slug);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const refresh = useCallback(async () => {
        if (!slug) return;
        try {
            setBoard(await draftApi.getBoard(slug));
            setError(null);
        } catch (e) {
            setError(e.message || 'Could not load the draft');
        }
    }, [slug]);

    useEffect(() => { refresh(); }, [refresh]);

    /** Every mutation funnels through here so errors and the busy state behave the same way. */
    const act = async (fn, successMessage) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const result = await fn();
            if (result && result.entrants) setBoard(result);
            else await refresh();
            if (successMessage) setNotice(successMessage);
            return result;
        } catch (e) {
            setError(e.message || 'That did not work');
            return null;
        } finally {
            setBusy(false);
        }
    };

    // Memoised because `?? []` builds a fresh array every render, which would re-run every useMemo
    // below on each keystroke — on a board of a hundred entrants that is felt.
    const entrants = useMemo(() => board?.entrants ?? [], [board]);
    const teams = useMemo(() => board?.teams ?? [], [board]);
    const committed = board?.status === 'committed';

    const pool = useMemo(() => {
        const q = query.trim().toLowerCase();
        return entrants
            // Goalies are assigned through staffing, never drafted, so they are not pool members.
            .filter(e => e.position !== 'G')
            .filter(e => (hideAssigned ? !e.teamId : true))
            .filter(e => (posFilter === 'All' ? true : e.position === posFilter))
            .filter(e => !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q))
            .sort((a, b) => (b.skillRating ?? 0) - (a.skillRating ?? 0)
                || a.lastName.localeCompare(b.lastName));
    }, [entrants, query, posFilter, hideAssigned]);

    const byTeam = useMemo(() => {
        const m = {};
        for (const t of teams) m[t.teamId] = [];
        for (const e of entrants) if (e.teamId && m[e.teamId]) m[e.teamId].push(e);
        for (const k of Object.keys(m)) {
            m[k].sort((a, b) => (b.isGm ? 1 : 0) - (a.isGm ? 1 : 0)
                || a.lastName.localeCompare(b.lastName));
        }
        return m;
    }, [entrants, teams]);

    const assignTo = (teamId) => {
        if (!selectedId) return;
        const entrant = entrants.find(e => e.id === selectedId);
        act(() => draftApi.assign(slug, selectedId, teamId),
            entrant ? `${entrant.firstName} ${entrant.lastName} → ${teams.find(t => t.teamId === teamId)?.teamName}` : null);
        setSelectedId(null);
        setQuery('');
    };

    if (loading) return <div className="obi-tdraft-msg">Loading…</div>;
    if (!tournaments.length) {
        return <div className="obi-tdraft-msg">Create a tournament first — Tournament Setup.</div>;
    }

    return (
        <div className="obi-tdraft">
            <div className="obi-tdraft-bar">
                <select className="obi-season-select" value={slug ?? ''} onChange={e => setSlug(e.target.value)}>
                    {tournaments.map(t => <option key={t.id} value={t.slug}>{t.name} {t.year}</option>)}
                </select>

                <div className="obi-tdraft-tabs">
                    {['board', 'entrants', 'accounts'].map(t => (
                        <button
                            key={t}
                            className={`obi-tdraft-tab ${tab === t ? 'is-active' : ''}`}
                            onClick={() => setTab(t)}
                        >
                            {t === 'board' ? 'Draft Board' : t === 'entrants' ? 'Entrants' : 'Account Links'}
                        </button>
                    ))}
                </div>

                <span className="obi-tdraft-spacer" />
                {committed && <span className="obi-tdraft-committed">Committed</span>}
                {notice && <span className="obi-tdraft-notice">{notice}</span>}
            </div>

            {error && <div className="obi-tdraft-error">{error}</div>}
            {board?.warnings?.map((w, i) => <div key={i} className="obi-tdraft-warn">⚠ {w}</div>)}

            {tab === 'entrants' && (
                <EntrantsTab slug={slug} board={board} act={act} busy={busy} committed={committed} />
            )}

            {tab === 'accounts' && (
                <AccountsTab slug={slug} board={board} act={act} busy={busy} />
            )}

            {tab === 'board' && (
                <>
                    <div className="obi-tdraft-actions">
                        <button
                            className="obi-tdraft-btn"
                            disabled={busy || committed}
                            onClick={() => act(() => draftApi.placeGms(slug), 'GMs placed.')}
                        >
                            Place GMs
                        </button>
                        <button
                            className="obi-tdraft-btn"
                            disabled={busy || committed}
                            onClick={() => act(() => draftApi.undo(slug), 'Last assignment undone.')}
                        >
                            Undo last
                        </button>
                        <span className="obi-tdraft-spacer" />
                        <span className="obi-tdraft-progress">
                            <b>{board?.assigned ?? 0}</b> assigned · {board?.unassigned ?? 0} left
                        </span>
                        <button
                            className="obi-tdraft-btn is-primary"
                            disabled={busy || committed || !board?.assigned}
                            onClick={() => {
                                if (!window.confirm(
                                    'Commit the draft?\n\nThis creates the player records and freezes the board. '
                                    + 'It cannot be undone.')) return;
                                act(async () => {
                                    await draftApi.commit(slug);
                                    // commit returns a summary, not a board, so pull the frozen
                                    // board rather than letting `act` treat the summary as one.
                                    await refresh();
                                    return null;
                                }, 'Draft committed — player records created.');
                            }}
                        >
                            Commit draft
                        </button>
                    </div>

                    <div className="obi-tdraft-grid">
                        <section className="obi-tdraft-pool">
                            <div className="obi-tdraft-pool-head">
                                <input
                                    className="obi-tdraft-search"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Search the pool…"
                                    disabled={committed}
                                />
                                <div className="obi-tdraft-pool-filters">
                                    {['All', 'F', 'D'].map(p => (
                                        <button
                                            key={p}
                                            className={`obi-tdraft-chip ${posFilter === p ? 'is-active' : ''}`}
                                            onClick={() => setPosFilter(p)}
                                        >{p}</button>
                                    ))}
                                    <label className="obi-tdraft-toggle">
                                        <input
                                            type="checkbox"
                                            checked={hideAssigned}
                                            onChange={e => setHideAssigned(e.target.checked)}
                                        />
                                        Available only
                                    </label>
                                </div>
                                <div className="obi-tdraft-pool-count">{pool.length} shown</div>
                            </div>

                            <div className="obi-tdraft-pool-list">
                                {pool.map(e => (
                                    <button
                                        key={e.id}
                                        className={`obi-tdraft-entrant ${selectedId === e.id ? 'is-selected' : ''} ${e.teamId ? 'is-assigned' : ''}`}
                                        onClick={() => setSelectedId(id => (id === e.id ? null : e.id))}
                                        disabled={committed}
                                    >
                                        <span className="obi-tdraft-entrant-main">
                                            <span className="obi-tdraft-entrant-name">
                                                {e.firstName} {e.lastName}
                                                {e.isGm && <span className="obi-tdraft-gm">GM</span>}
                                            </span>
                                            <span className="obi-tdraft-entrant-sub">
                                                {e.position || '—'}
                                                {e.skillRating != null ? ` · skill ${e.skillRating}` : ''}
                                                {e.teamId ? ` · ${teams.find(t => t.teamId === e.teamId)?.teamName}` : ''}
                                            </span>
                                        </span>
                                        {!e.email && <span className="obi-tdraft-noemail" title="No email on file">✉</span>}
                                    </button>
                                ))}
                                {pool.length === 0 && (
                                    <div className="obi-tdraft-empty">
                                        {entrants.length === 0
                                            ? 'No entrants yet — import them on the Entrants tab.'
                                            : 'Nobody left matching this filter.'}
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="obi-tdraft-teams">
                            {teams.map(t => (
                                <div key={t.teamId} className="obi-tdraft-team">
                                    <div className="obi-tdraft-team-head">
                                        <span className="obi-tdraft-team-dot" style={{ background: t.teamColor || '#888' }} />
                                        <span className="obi-tdraft-team-name">{t.teamName}</span>
                                        <span className="obi-tdraft-team-meta">
                                            {t.skaters} · avg {t.averageSkill || '—'}
                                        </span>
                                    </div>

                                    <button
                                        className="obi-tdraft-drop"
                                        disabled={!selectedId || busy || committed}
                                        onClick={() => assignTo(t.teamId)}
                                    >
                                        {selectedId ? 'Assign here' : 'Select a player'}
                                    </button>

                                    <div className="obi-tdraft-roster">
                                        {(byTeam[t.teamId] ?? []).map(e => (
                                            <div key={e.id} className="obi-tdraft-rosterrow">
                                                <span className="obi-tdraft-rostername">
                                                    {e.isGm && <span className="obi-tdraft-gm">GM</span>}
                                                    {e.firstName} {e.lastName}
                                                </span>
                                                <span className="obi-tdraft-rostermeta">{e.position || '—'}</span>
                                                <button
                                                    className="obi-tdraft-remove"
                                                    title="Return to pool"
                                                    disabled={busy || committed}
                                                    onClick={() => act(() => draftApi.unassign(slug, e.id))}
                                                >×</button>
                                            </div>
                                        ))}
                                        {(byTeam[t.teamId] ?? []).length === 0 && (
                                            <div className="obi-tdraft-empty is-sm">Empty</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {teams.length === 0 && (
                                <div className="obi-tdraft-empty">
                                    This tournament has no teams yet. Create them before drafting.
                                </div>
                            )}
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}

/* ------------------------------------------------------------- entrants tab */

function EntrantsTab({ slug, board, act, busy, committed }) {
    const fileRef = useRef(null);
    const [parsed, setParsed] = useState(null);
    const [replace, setReplace] = useState(false);
    const [parseError, setParseError] = useState(null);

    const onFile = async (file) => {
        setParseError(null);
        setParsed(null);
        try {
            const buffer = await file.arrayBuffer();
            const result = parseEntrantWorkbook(buffer);
            if (!result.entrants.length) {
                setParseError(result.warnings.join(' ') || 'Nothing could be read from that file.');
                return;
            }
            setParsed(result);
        } catch (e) {
            setParseError(e.message || 'Could not read that file.');
        }
    };

    return (
        <div className="obi-tdraft-panel">
            <h3 className="obi-tdraft-panel-title">Import entrants</h3>
            <p className="obi-tdraft-hint">
                Reads the first sheet of an .xlsx or .csv. Column names are matched loosely, so
                &ldquo;Email&rdquo;, &ldquo;E-mail&rdquo; and &ldquo;Email Address&rdquo; all work. The file is read
                in your browser — nothing is saved until you confirm.
            </p>

            <div className="obi-tdraft-import">
                <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    disabled={committed}
                    onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
                />
                <label className="obi-tdraft-toggle">
                    <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
                    Replace the existing list (clears the board)
                </label>
            </div>

            {parseError && <div className="obi-tdraft-error">{parseError}</div>}

            {parsed && (
                <>
                    {parsed.warnings.map((w, i) => <div key={i} className="obi-tdraft-warn">⚠ {w}</div>)}
                    <div className="obi-tdraft-preview">
                        <div className="obi-tdraft-preview-head">
                            Read <b>{parsed.entrants.length}</b> entrants
                            {' · '}{parsed.entrants.filter(e => e.isGm).length} GMs
                            {' · '}{parsed.entrants.filter(e => e.position === 'G').length} goalies
                        </div>
                        <div className="obi-tdraft-preview-rows">
                            {parsed.entrants.slice(0, 8).map((e, i) => (
                                <div key={i} className="obi-tdraft-preview-row">
                                    <span>{e.firstName} {e.lastName}</span>
                                    <span>{e.email || <em>no email</em>}</span>
                                    <span>{e.position || '—'}</span>
                                    <span>{e.isGm ? 'GM' : ''}</span>
                                </div>
                            ))}
                            {parsed.entrants.length > 8 && (
                                <div className="obi-tdraft-preview-more">
                                    …and {parsed.entrants.length - 8} more
                                </div>
                            )}
                        </div>
                        <button
                            className="obi-tdraft-btn is-primary"
                            disabled={busy || committed}
                            onClick={async () => {
                                const r = await act(
                                    () => draftApi.importEntrants(slug, parsed.entrants, replace),
                                    null);
                                if (r) {
                                    setParsed(null);
                                    if (fileRef.current) fileRef.current.value = '';
                                }
                            }}
                        >
                            Import {parsed.entrants.length} entrants
                        </button>
                    </div>
                </>
            )}

            <h3 className="obi-tdraft-panel-title" style={{ marginTop: 28 }}>
                Current entrants ({board?.totalEntrants ?? 0})
            </h3>
            <div className="obi-tdraft-table">
                {(board?.entrants ?? []).map(e => (
                    <div key={e.id} className="obi-tdraft-trow">
                        <span>{e.firstName} {e.lastName}</span>
                        <span className="obi-tdraft-dim">{e.email || 'no email'}</span>
                        <span>{e.position || '—'}</span>
                        <span>{e.isGm ? 'GM' : ''}</span>
                        <span className="obi-tdraft-dim">{e.paid ? 'paid' : ''}</span>
                    </div>
                ))}
                {(board?.entrants ?? []).length === 0 && (
                    <div className="obi-tdraft-empty">No entrants imported yet.</div>
                )}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------- accounts tab */

const LINK_LABEL = {
    unmatched: 'Not checked',
    matched: 'One match',
    ambiguous: 'Several matches',
    confirmed: 'Confirmed',
    none: 'No account',
};

function AccountsTab({ slug, board, act, busy }) {
    const entrants = board?.entrants ?? [];
    const counts = entrants.reduce((acc, e) => {
        acc[e.linkStatus] = (acc[e.linkStatus] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="obi-tdraft-panel">
            <h3 className="obi-tdraft-panel-title">Account links</h3>
            <p className="obi-tdraft-hint">
                Links an entrant to their OBHL account so the Classic shows up on their dashboard.
                Entirely optional — the tournament works with none of them linked. Entrants matching
                more than one account are never linked automatically; confirm those yourself.
            </p>

            <div className="obi-tdraft-actions">
                <button
                    className="obi-tdraft-btn"
                    disabled={busy}
                    onClick={() => act(() => draftApi.matchAccounts(slug), 'Matching complete.')}
                >
                    Match against accounts
                </button>
                <span className="obi-tdraft-spacer" />
                <span className="obi-tdraft-progress">
                    {Object.entries(counts).map(([k, v]) => `${LINK_LABEL[k] || k}: ${v}`).join(' · ')}
                </span>
            </div>

            <div className="obi-tdraft-table">
                {entrants.map(e => (
                    <div key={e.id} className="obi-tdraft-trow is-accounts">
                        <span>{e.firstName} {e.lastName}</span>
                        <span className="obi-tdraft-dim">{e.email || 'no email'}</span>
                        <span className={`obi-tdraft-link is-${e.linkStatus}`}>{LINK_LABEL[e.linkStatus]}</span>
                        <span className="obi-tdraft-dim">{e.userId ? `user #${e.userId}` : ''}</span>
                        <span>
                            {e.userId && e.linkStatus !== 'confirmed' && (
                                <button
                                    className="obi-tdraft-mini"
                                    disabled={busy}
                                    onClick={() => act(() => draftApi.setLink(slug, e.id, e.userId), 'Link confirmed.')}
                                >Confirm</button>
                            )}
                            {e.userId && (
                                <button
                                    className="obi-tdraft-mini"
                                    disabled={busy}
                                    onClick={() => act(() => draftApi.setLink(slug, e.id, null), 'Link cleared.')}
                                >Unlink</button>
                            )}
                        </span>
                    </div>
                ))}
                {entrants.length === 0 && <div className="obi-tdraft-empty">No entrants imported yet.</div>}
            </div>
        </div>
    );
}

export default TournamentDraft;
