import { useCallback, useEffect, useMemo, useState } from 'react';
import tournamentApi from '../../../services/tournamentApi';
import {
    CHAMPIONSHIP_NONE,
    CHAMPIONSHIP_SINGLE_ELIM,
    CONSOLATION_BRACKET,
    CONSOLATION_NONE,
    CONSOLATION_SINGLE_ROUND,
    GROUP_DIVISIONS,
    GROUP_NONE,
    GROUP_ROUND_ROBIN,
    describeBreakdown,
    summarizeFormat,
} from './tournamentFormat';
import './TournamentAdmin.css';

/**
 * Tournament Setup — the organiser's configuration surface for the Conley Classic.
 *
 * Lives inside the admin shell and uses the admin's own obi- styling rather than the microsite's
 * crow theme: the design handoff drew this as a standalone page, but it belongs with the rest of
 * the league's administration, not with the public tournament site.
 *
 * The live format preview is the point of this screen. Which format to run depends on how many
 * teams enter and how much ice is available that weekend, and the only way to answer that is to see
 * the game count change as the options change.
 */
function TournamentAdmin() {
    const [tournaments, setTournaments] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const list = await tournamentApi.list(true);
            setTournaments(list);
            setSelectedId(prev => prev ?? (list.length ? list[0].id : null));
            setError(null);
        } catch (e) {
            setError(e.message || 'Failed to load tournaments');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const selected = useMemo(
        () => tournaments.find(t => t.id === selectedId) || null,
        [tournaments, selectedId]
    );

    // Edits are held locally and saved explicitly, so the preview can be driven without a request
    // per keystroke and a half-typed team count never reaches the server.
    useEffect(() => { setDraft(selected ? { ...selected } : null); }, [selected]);

    /**
     * @param patch an object, or a function of the previous draft returning one. Use the function
     *   form for anything derived from the current value -- an object literal closes over the
     *   render's `draft`, so several clicks before the next render all compute from the same stale
     *   value and only the last one counts (the stepper loses increments when clicked quickly).
     */
    const set = (patch) => {
        setDraft(d => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }));
        setNotice(null);
    };

    const dirty = useMemo(() => {
        if (!draft || !selected) return false;
        return Object.keys(draft).some(k => draft[k] !== selected[k]);
    }, [draft, selected]);

    const summary = useMemo(() => (draft ? summarizeFormat(draft) : null), [draft]);

    const save = async () => {
        if (!draft) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await tournamentApi.update(draft.id, {
                name: draft.name,
                tagline: draft.tagline,
                groupStage: draft.groupStage,
                poolCount: draft.poolCount,
                advancePerPool: draft.advancePerPool,
                championshipStage: draft.championshipStage,
                placementGame: draft.placementGame,
                consolationStage: draft.consolationStage,
                consolationTeamCount: draft.consolationTeamCount,
                teamCount: draft.teamCount,
                startDate: draft.startDate,
                endDate: draft.endDate,
                venue: draft.venue,
                entryFeeCents: draft.entryFeeCents,
                entryDeadline: draft.entryDeadline,
                draftDate: draft.draftDate,
                periodCount: draft.periodCount,
                periodMinutes: draft.periodMinutes,
                status: draft.status,
                isPublished: draft.isPublished,
            });
            setTournaments(list => list.map(t => (t.id === updated.id ? updated : t)));
            setNotice('Saved.');
        } catch (e) {
            setError(e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="obi-tsetup-msg">Loading tournaments…</div>;

    if (creating || tournaments.length === 0) {
        return (
            <CreateTournament
                onCancel={tournaments.length ? () => setCreating(false) : null}
                onCreated={async (created) => {
                    setCreating(false);
                    await load();
                    setSelectedId(created.id);
                }}
            />
        );
    }

    return (
        <div className="obi-tsetup">
            <div className="obi-tsetup-bar">
                <select
                    className="obi-season-select"
                    value={selectedId ?? ''}
                    onChange={e => setSelectedId(Number(e.target.value))}
                >
                    {tournaments.map(t => (
                        <option key={t.id} value={t.id}>
                            {t.name} {t.year}{t.isPublished ? '' : ' — draft'}
                        </option>
                    ))}
                </select>
                <button className="obi-tsetup-btn" onClick={() => setCreating(true)}>+ New tournament</button>
                <span className="obi-tsetup-spacer" />
                {notice && <span className="obi-tsetup-notice">{notice}</span>}
                {dirty && <span className="obi-tsetup-dirty">Unsaved changes</span>}
                <button
                    className="obi-tsetup-btn is-primary"
                    onClick={save}
                    disabled={!dirty || saving}
                >
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
            </div>

            {error && <div className="obi-tsetup-error">{error}</div>}

            {draft && (
                <div className="obi-tsetup-grid">
                    <div className="obi-tsetup-col">
                        <EntriesPanel draft={draft} set={set} />
                        <FormatPanel draft={draft} set={set} />
                    </div>
                    <div className="obi-tsetup-col">
                        <PreviewPanel summary={summary} draft={draft} />
                        <WeekendPanel draft={draft} set={set} />
                        <PublishPanel draft={draft} set={set} />
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ panels */

function Panel({ title, hint, children }) {
    return (
        <section className="obi-tsetup-panel">
            <h3 className="obi-tsetup-panel-title">{title}</h3>
            {hint && <p className="obi-tsetup-hint">{hint}</p>}
            {children}
        </section>
    );
}

function EntriesPanel({ draft, set }) {
    const clamp = (n) => Math.min(32, Math.max(2, n));
    // Functional updates: successive clicks must each see the previous value, not this render's.
    const step = (delta) => set(d => ({ teamCount: clamp((d.teamCount || 0) + delta) }));
    return (
        <Panel title="Entries" hint="How many teams entered this year.">
            <div className="obi-tsetup-stepper">
                <button
                    className="obi-tsetup-step"
                    onClick={() => step(-1)}
                    aria-label="One fewer team"
                >−</button>
                <span className="obi-tsetup-step-value">{draft.teamCount}</span>
                <button
                    className="obi-tsetup-step"
                    onClick={() => step(1)}
                    aria-label="One more team"
                >+</button>
                <span className="obi-tsetup-step-label">teams entered</span>
            </div>
        </Panel>
    );
}

function Radio({ value, current, onChange, label, desc }) {
    const active = current === value;
    return (
        <button
            type="button"
            className={`obi-tsetup-radio ${active ? 'is-active' : ''}`}
            onClick={() => onChange(value)}
            aria-pressed={active}
        >
            <span className="obi-tsetup-radio-dot" aria-hidden="true" />
            <span className="obi-tsetup-radio-text">
                <span className="obi-tsetup-radio-label">{label}</span>
                {desc && <span className="obi-tsetup-radio-desc">{desc}</span>}
            </span>
        </button>
    );
}

function FormatPanel({ draft, set }) {
    /*
     * Seed the stage's own fields when that stage is chosen.
     *
     * The Divisions inputs only render once Divisions is selected, and they display
     * `draft.poolCount ?? 2` -- so before this, picking Divisions showed "2 divisions" while the
     * state still held the null the API returned (pool_count has no database default). The preview
     * read that null and reported no group stage at all, and saving would have been rejected by the
     * server's "Divisions needs at least 2 pools" check. Writing the value the field claims to have
     * keeps the form, the preview and the server looking at the same configuration.
     */
    const setGroupStage = (v) => set(d => ({
        groupStage: v,
        ...(v === GROUP_DIVISIONS && d.poolCount == null ? { poolCount: 2 } : {}),
        ...(v !== GROUP_NONE && d.advancePerPool == null ? { advancePerPool: 2 } : {}),
    }));

    return (
        <Panel
            title="Format"
            hint="Three independent stages. Most shapes — including two divisions feeding a bracket with consolation games — are combinations of these rather than a single preset."
        >
            <div className="obi-tsetup-stage">
                <div className="obi-tsetup-stage-name">Group stage</div>
                <Radio value={GROUP_ROUND_ROBIN} current={draft.groupStage} onChange={setGroupStage}
                    label="Round robin" desc="One group; everyone plays everyone once." />
                <Radio value={GROUP_DIVISIONS} current={draft.groupStage} onChange={setGroupStage}
                    label="Divisions" desc="Split into pools, round robin within each." />
                <Radio value={GROUP_NONE} current={draft.groupStage} onChange={setGroupStage}
                    label="None" desc="Straight to the bracket." />

                {draft.groupStage === GROUP_DIVISIONS && (
                    <div className="obi-tsetup-row">
                        <label className="obi-tsetup-field">
                            <span>Divisions</span>
                            <input type="number" min="2" max="8" value={draft.poolCount ?? 2}
                                onChange={e => set({ poolCount: Number(e.target.value) })} />
                        </label>
                        <label className="obi-tsetup-field">
                            <span>Advance per division</span>
                            <input type="number" min="1" max="8" value={draft.advancePerPool ?? 2}
                                onChange={e => set({ advancePerPool: Number(e.target.value) })} />
                        </label>
                    </div>
                )}
                {draft.groupStage === GROUP_ROUND_ROBIN && draft.championshipStage !== CHAMPIONSHIP_NONE && (
                    <div className="obi-tsetup-row">
                        <label className="obi-tsetup-field">
                            <span>Teams advancing</span>
                            <input type="number" min="2" max="16" value={draft.advancePerPool ?? 2}
                                onChange={e => set({ advancePerPool: Number(e.target.value) })} />
                        </label>
                    </div>
                )}
            </div>

            <div className="obi-tsetup-stage">
                <div className="obi-tsetup-stage-name">Championship</div>
                <Radio value={CHAMPIONSHIP_SINGLE_ELIM} current={draft.championshipStage}
                    onChange={v => set({ championshipStage: v })}
                    label="Single elimination" desc="Seeded from group results. One loss and you're out." />
                <Radio value={CHAMPIONSHIP_NONE} current={draft.championshipStage}
                    onChange={v => set({ championshipStage: v })}
                    label="None" desc="Best record after group play wins the Classic." />

                {draft.championshipStage === CHAMPIONSHIP_SINGLE_ELIM && (
                    <label className="obi-tsetup-check">
                        <input type="checkbox" checked={!!draft.placementGame}
                            onChange={e => set({ placementGame: e.target.checked })} />
                        <span>Placement game between the two semifinal losers</span>
                    </label>
                )}
            </div>

            <div className="obi-tsetup-stage">
                <div className="obi-tsetup-stage-name">Consolation</div>
                <Radio value={CONSOLATION_NONE} current={draft.consolationStage}
                    onChange={v => set({ consolationStage: v })}
                    label="None" desc="Teams that miss the bracket are done." />
                <Radio value={CONSOLATION_SINGLE_ROUND} current={draft.consolationStage}
                    onChange={v => set({ consolationStage: v })}
                    label="One game each" desc="Every non-qualifier plays exactly one more game." />
                <Radio value={CONSOLATION_BRACKET} current={draft.consolationStage}
                    onChange={v => set({ consolationStage: v })}
                    label="Bracket" desc="Elimination bracket among the non-qualifiers." />

                {draft.consolationStage !== CONSOLATION_NONE && (
                    <div className="obi-tsetup-row">
                        <label className="obi-tsetup-field">
                            <span>Consolation teams</span>
                            <input type="number" min="2" max="32" value={draft.consolationTeamCount ?? 0}
                                onChange={e => set({ consolationTeamCount: Number(e.target.value) })} />
                        </label>
                    </div>
                )}
            </div>
        </Panel>
    );
}

function PreviewPanel({ summary, draft }) {
    if (!summary) return null;
    return (
        <Panel title="What this produces" hint="Updates as you change the format above.">
            <div className="obi-tsetup-preview-total">
                <span className="obi-tsetup-preview-num">{summary.totalGames}</span>
                <span className="obi-tsetup-preview-unit">games</span>
            </div>
            <div className="obi-tsetup-preview-break">{describeBreakdown(summary)}</div>

            <dl className="obi-tsetup-facts">
                <div><dt>Games per team</dt><dd>
                    {summary.minGamesPerTeam === summary.maxGamesPerTeam
                        ? summary.minGamesPerTeam
                        : `${summary.minGamesPerTeam}–${summary.maxGamesPerTeam}`}
                </dd></div>
                {summary.pools.length > 1 && (
                    <div><dt>Divisions</dt><dd>{summary.pools.join(' / ')}</dd></div>
                )}
                {summary.qualifiers > 0 && (
                    <div><dt>Reach the bracket</dt><dd>{summary.qualifiers}{summary.byes ? ` (${summary.byes} bye${summary.byes > 1 ? 's' : ''})` : ''}</dd></div>
                )}
                <div><dt>Ice slots needed</dt><dd>{summary.totalGames}</dd></div>
                <div><dt>Game length</dt><dd>{draft.periodCount} × {draft.periodMinutes} min</dd></div>
            </dl>

            {summary.warnings.map((w, i) => (
                <div key={i} className="obi-tsetup-warn">⚠ {w}</div>
            ))}
        </Panel>
    );
}

function WeekendPanel({ draft, set }) {
    const dollars = draft.entryFeeCents != null ? (draft.entryFeeCents / 100).toString() : '';
    return (
        <Panel title="Weekend details" hint="All of these change year to year.">
            <div className="obi-tsetup-row">
                <label className="obi-tsetup-field">
                    <span>Start date</span>
                    <input type="date" value={draft.startDate || ''}
                        onChange={e => set({ startDate: e.target.value })} />
                </label>
                <label className="obi-tsetup-field">
                    <span>End date</span>
                    <input type="date" value={draft.endDate || ''}
                        onChange={e => set({ endDate: e.target.value })} />
                </label>
            </div>
            <div className="obi-tsetup-row">
                <label className="obi-tsetup-field">
                    <span>Entry deadline</span>
                    <input type="date" value={draft.entryDeadline || ''}
                        onChange={e => set({ entryDeadline: e.target.value })} />
                </label>
                <label className="obi-tsetup-field">
                    <span>Draft day</span>
                    <input type="date" value={draft.draftDate || ''}
                        onChange={e => set({ draftDate: e.target.value })} />
                </label>
            </div>
            <div className="obi-tsetup-row">
                <label className="obi-tsetup-field">
                    {/* Per person: entries are individual, and teams are drafted afterwards. */}
                    <span>Entry fee ($ per person)</span>
                    <input type="number" min="0" step="1" value={dollars}
                        onChange={e => set({
                            entryFeeCents: e.target.value === '' ? null : Math.round(Number(e.target.value) * 100),
                        })} />
                </label>
                <label className="obi-tsetup-field">
                    <span>Venue</span>
                    <input type="text" value={draft.venue || ''}
                        onChange={e => set({ venue: e.target.value })} />
                </label>
            </div>
            <div className="obi-tsetup-row">
                <label className="obi-tsetup-field">
                    <span>Periods</span>
                    <input type="number" min="1" max="5" value={draft.periodCount ?? 2}
                        onChange={e => set({ periodCount: Number(e.target.value) })} />
                </label>
                <label className="obi-tsetup-field">
                    <span>Minutes per period</span>
                    <input type="number" min="1" max="60" value={draft.periodMinutes ?? 20}
                        onChange={e => set({ periodMinutes: Number(e.target.value) })} />
                </label>
            </div>
            <label className="obi-tsetup-field">
                <span>Tagline</span>
                <input type="text" value={draft.tagline || ''} placeholder="Survive the Flock"
                    onChange={e => set({ tagline: e.target.value })} />
            </label>
        </Panel>
    );
}

function PublishPanel({ draft, set }) {
    return (
        <Panel
            title="Status"
            hint="Unpublished tournaments are invisible on the public site, so this can be built up in advance."
        >
            <label className="obi-tsetup-field">
                <span>Stage</span>
                <select value={draft.status}
                    onChange={e => set({ status: e.target.value })}>
                    <option value="setup">Setup</option>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                </select>
            </label>
            <label className="obi-tsetup-check">
                <input type="checkbox" checked={!!draft.isPublished}
                    onChange={e => set({ isPublished: e.target.checked })} />
                <span>Visible on the public tournament site</span>
            </label>
            <p className="obi-tsetup-hint">
                Public URL: <code>/tournaments/{draft.slug}</code>
            </p>
        </Panel>
    );
}

/* ------------------------------------------------------------------ create */

function CreateTournament({ onCreated, onCancel }) {
    const thisYear = new Date().getFullYear();
    const [form, setForm] = useState({
        name: 'The Conley Classic',
        year: thisYear,
        startDate: '',
        endDate: '',
        teamCount: 8,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            onCreated(await tournamentApi.create(form));
        } catch (e) {
            setError(e.message || 'Failed to create tournament');
        } finally {
            setBusy(false);
        }
    };

    const ready = form.name.trim() && form.year && form.startDate && form.endDate;

    return (
        <div className="obi-tsetup">
            <Panel
                title="Create a tournament"
                hint="This also creates the season that holds the tournament's teams, players and games. That season is deliberately kept out of league season lists."
            >
                <div className="obi-tsetup-row">
                    <label className="obi-tsetup-field">
                        <span>Name</span>
                        <input type="text" value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </label>
                    <label className="obi-tsetup-field">
                        <span>Year</span>
                        <input type="number" min="2000" max="2200" value={form.year}
                            onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} />
                    </label>
                </div>
                <div className="obi-tsetup-row">
                    <label className="obi-tsetup-field">
                        <span>Start date</span>
                        <input type="date" value={form.startDate}
                            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                    </label>
                    <label className="obi-tsetup-field">
                        <span>End date</span>
                        <input type="date" value={form.endDate}
                            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                    </label>
                </div>
                <label className="obi-tsetup-field">
                    <span>Teams expected</span>
                    <input type="number" min="2" max="32" value={form.teamCount}
                        onChange={e => setForm(f => ({ ...f, teamCount: Number(e.target.value) }))} />
                </label>

                {error && <div className="obi-tsetup-error">{error}</div>}

                <div className="obi-tsetup-actions">
                    {onCancel && <button className="obi-tsetup-btn" onClick={onCancel}>Cancel</button>}
                    <button className="obi-tsetup-btn is-primary" onClick={submit} disabled={!ready || busy}>
                        {busy ? 'Creating…' : 'Create tournament'}
                    </button>
                </div>
            </Panel>
        </div>
    );
}

export default TournamentAdmin;
