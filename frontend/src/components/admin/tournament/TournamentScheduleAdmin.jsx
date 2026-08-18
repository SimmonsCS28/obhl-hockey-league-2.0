import { useEffect, useMemo, useRef, useState } from 'react';
import tournamentApi from '../../../services/tournamentApi';
import { request } from '../../../services/api';
import { parseSlotWorkbook } from './slotParser';
import { describeBreakdown, summarizeFormat } from './tournamentFormat';
import './TournamentDraft.css';
import './TournamentAdmin.css';

/**
 * Generates a tournament's schedule.
 *
 * Preview and save are separate on purpose: the organiser reads the fixture list before a weekend's
 * ice is committed to it. Slot shortfalls are reported before anything is written rather than the
 * generator silently cycling or truncating, which would quietly drop the consolation games.
 */
function TournamentScheduleAdmin() {
    const [tournaments, setTournaments] = useState([]);
    const [slug, setSlug] = useState(null);
    const [tournament, setTournament] = useState(null);
    const [games, setGames] = useState([]);
    const [slots, setSlots] = useState([]);
    const [slotWarnings, setSlotWarnings] = useState([]);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const fileRef = useRef(null);

    useEffect(() => {
        tournamentApi.list(true)
            .then(list => { setTournaments(list); if (list.length) setSlug(s => s ?? list[0].slug); })
            .catch(e => setError(e.message));
    }, []);

    useEffect(() => {
        if (!slug) return;
        setPreview(null);
        setNotice(null);
        tournamentApi.getBySlug(slug)
            .then(async t => {
                setTournament(t);
                setGames(await request(`/games?seasonId=${t.seasonId}`));
            })
            .catch(e => setError(e.message));
    }, [slug]);

    const summary = useMemo(() => (tournament ? summarizeFormat(tournament) : null), [tournament]);
    const existing = games.filter(g => g.gameType === 'TOURNAMENT');
    const played = existing.filter(g => g.status === 'completed').length;

    const body = () => ({
        seasonId: tournament.seasonId,
        teamCount: tournament.teamCount,
        groupStage: tournament.groupStage,
        poolCount: tournament.poolCount,
        advancePerPool: tournament.advancePerPool,
        championshipStage: tournament.championshipStage,
        placementGame: tournament.placementGame,
        consolationStage: tournament.consolationStage,
        consolationTeamCount: tournament.consolationTeamCount,
        periodCount: tournament.periodCount,
        periodMinutes: tournament.periodMinutes,
        venue: tournament.venue,
        slots,
    });

    const run = async (path, successMessage) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const result = await request(path, { method: 'POST', body: JSON.stringify(body()) });
            setPreview(result);
            if (result.errors?.length) setError(result.errors.join(' '));
            else if (successMessage) {
                setNotice(successMessage);
                setGames(await request(`/games?seasonId=${tournament.seasonId}`));
            }
        } catch (e) {
            setError(e.message || 'That did not work');
        } finally {
            setBusy(false);
        }
    };

    const onFile = async (file) => {
        try {
            const parsed = parseSlotWorkbook(await file.arrayBuffer());
            setSlots(parsed.slots);
            setSlotWarnings(parsed.warnings);
            setPreview(null);
        } catch (e) {
            setError(e.message || 'Could not read that file.');
        }
    };

    if (!tournaments.length) return <div className="obi-tdraft-msg">Create a tournament first.</div>;
    if (!tournament) return <div className="obi-tdraft-msg">Loading…</div>;

    return (
        <div className="obi-tdraft">
            <div className="obi-tdraft-bar">
                <select className="obi-season-select" value={slug ?? ''} onChange={e => setSlug(e.target.value)}>
                    {tournaments.map(t => <option key={t.id} value={t.slug}>{t.name} {t.year}</option>)}
                </select>
                <span className="obi-tdraft-spacer" />
                {notice && <span className="obi-tdraft-notice">{notice}</span>}
            </div>

            {error && <div className="obi-tdraft-error">{error}</div>}

            <div className="obi-tsetup-grid">
                <div className="obi-tsetup-col">
                    <section className="obi-tsetup-panel">
                        <h3 className="obi-tsetup-panel-title">1 · Ice slots</h3>
                        <p className="obi-tsetup-hint">
                            A sheet with Date, Time and Rink columns — one row per slot. Read in your
                            browser, so nothing is saved until you generate.
                        </p>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
                        />
                        {slotWarnings.map((w, i) => <div key={i} className="obi-tdraft-warn">⚠ {w}</div>)}

                        {slots.length > 0 && (
                            <div className="obi-tdraft-preview">
                                <div className="obi-tdraft-preview-head"><b>{slots.length}</b> slots read</div>
                                <div className="obi-tdraft-preview-rows">
                                    {slots.slice(0, 6).map((s, i) => (
                                        <div key={i} className="obi-tdraft-preview-row">
                                            <span>Day {s.week}</span><span>{s.date}</span>
                                            <span>{s.time.slice(0, 5)}</span><span>{s.rink}</span>
                                        </div>
                                    ))}
                                    {slots.length > 6 && (
                                        <div className="obi-tdraft-preview-more">…and {slots.length - 6} more</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="obi-tsetup-panel">
                        <h3 className="obi-tsetup-panel-title">2 · Generate</h3>
                        <p className="obi-tsetup-hint">
                            Uses the format set on Tournament Setup. Preview first — saving replaces any
                            previously generated games.
                        </p>

                        {summary && (
                            <div className="obi-tsetup-facts">
                                <div><dt>This format needs</dt><dd>{summary.totalGames} games</dd></div>
                                <div><dt>Slots supplied</dt><dd>
                                    {slots.length || '—'}
                                    {slots.length > 0 && slots.length < summary.totalGames && ' ⚠'}
                                </dd></div>
                                <div><dt>Already scheduled</dt><dd>{existing.length}</dd></div>
                                {played > 0 && <div><dt>Already played</dt><dd>{played}</dd></div>}
                            </div>
                        )}

                        {played > 0 && (
                            <div className="obi-tdraft-warn">
                                ⚠ {played} game(s) have results. Regenerating is refused rather than
                                deleting them.
                            </div>
                        )}

                        <div className="obi-tsetup-actions">
                            <button
                                className="obi-tdraft-btn"
                                disabled={busy}
                                onClick={() => run('/games/tournament-schedule/preview')}
                            >
                                Preview
                            </button>
                            <button
                                className="obi-tdraft-btn is-primary"
                                // Disabled once results exist: the server refuses anyway, and an
                                // enabled button that always fails is worse than an honest one.
                                disabled={busy || !preview || preview.errors?.length > 0 || played > 0}
                                title={played > 0
                                    ? 'Results already exist — remove or unfinalize them first'
                                    : undefined}
                                onClick={() => {
                                    if (!window.confirm(
                                        `Save ${preview.games.length} games?\n\n`
                                        + 'This replaces any previously generated tournament games.')) return;
                                    run('/games/tournament-schedule', 'Schedule saved.');
                                }}
                            >
                                Save schedule
                            </button>
                        </div>
                    </section>
                </div>

                <div className="obi-tsetup-col">
                    <section className="obi-tsetup-panel">
                        <h3 className="obi-tsetup-panel-title">
                            {preview ? 'Preview' : 'Current schedule'}
                        </h3>

                        {preview?.warnings?.map((w, i) => (
                            <div key={i} className="obi-tdraft-warn">⚠ {String(w)}</div>
                        ))}

                        {preview && !preview.errors?.length && (
                            <div className="obi-tsetup-preview-break" style={{ marginBottom: 10 }}>
                                {describeBreakdown(summarizeFormat(tournament))}
                            </div>
                        )}

                        <div className="obi-tdraft-table">
                            {(preview?.games ?? existing).map((g, i) => (
                                <div key={g.id ?? i} className="obi-tdraft-trow">
                                    <span>{g.tournamentStage}</span>
                                    <span className="obi-tdraft-dim">
                                        {g.gameDate
                                            ? new Date(g.gameDate).toLocaleString('en-US',
                                                { weekday: 'short', hour: 'numeric', minute: '2-digit' })
                                            : 'no slot'}
                                    </span>
                                    <span className="obi-tdraft-dim">{g.rink || '—'}</span>
                                    <span>{g.playoffRound || ''}</span>
                                    <span className="obi-tdraft-dim">
                                        {g.homeTeamId ? '' : 'TBD'}
                                    </span>
                                </div>
                            ))}
                            {!preview && existing.length === 0 && (
                                <div className="obi-tdraft-empty">
                                    No schedule generated yet. Upload slots and press Preview.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default TournamentScheduleAdmin;
