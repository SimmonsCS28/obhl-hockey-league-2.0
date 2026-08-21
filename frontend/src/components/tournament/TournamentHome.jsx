import { Link } from 'react-router-dom';
import { useTournament } from './useTournament';
import { useTournamentTeams } from './tournamentData';
import { summarizeFormat } from '../admin/tournament/tournamentFormat';
import crest from '../../assets/tournament/crow-crest.png';
import './TournamentHome.css';

const fmtDate = (iso, opts = { month: 'short', day: 'numeric' }) =>
    iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', opts) : null;

function dateRange(start, end) {
    if (!start) return 'Dates to be announced';
    const s = new Date(start + 'T00:00:00');
    const e = end ? new Date(end + 'T00:00:00') : null;
    const month = s.toLocaleDateString('en-US', { month: 'long' });
    if (!e) return `${month} ${s.getDate()}`;
    return s.getMonth() === e.getMonth()
        ? `${month} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
        : `${fmtDate(start)} – ${fmtDate(end)}, ${e.getFullYear()}`;
}

function formatLabel(t) {
    if (t.championshipStage === 'NONE') return 'Round Robin';
    if (t.groupStage === 'DIVISIONS') return 'Pools + Bracket';
    if (t.groupStage === 'NONE') return 'Single-Elim';
    return 'RR + Bracket';
}

function TournamentHome() {
    const { tournament, seasonId, base } = useTournament();
    const { teams } = useTournamentTeams(seasonId);

    const summary = summarizeFormat(tournament);
    const dates = dateRange(tournament.startDate, tournament.endDate);
    // Per person, not per team — players enter individually and are drafted onto teams afterwards.
    const fee = tournament.entryFeeCents != null
        ? `$${(tournament.entryFeeCents / 100).toLocaleString()} per player`
        : null;

    const keyDates = [
        tournament.entryDeadline && {
            date: fmtDate(tournament.entryDeadline),
            title: 'Entry Deadline',
            body: fee ? `Entries close. ${fee}.` : 'Entries close.',
        },
        tournament.draftDate && {
            date: fmtDate(tournament.draftDate),
            title: 'Draft Day',
            body: 'Teams drafted fresh and seeds are set.',
        },
        tournament.startDate && {
            date: fmtDate(tournament.startDate),
            title: 'Day 1',
            body: summary.groupGames
                ? `${summary.groupGames} group games across ${summary.pools.length || 1} division${summary.pools.length > 1 ? 's' : ''}.`
                : 'Opening round.',
        },
        tournament.endDate && {
            date: fmtDate(tournament.endDate),
            title: 'Day 2 — Finals',
            body: 'The Classic awarded ice-side.',
        },
    ].filter(Boolean);

    return (
        <>
            <section className="tcc-hero">
                <div className="tcc-hero-grid" aria-hidden="true" />
                <div className="tcc-hero-glow" aria-hidden="true" />
                <div className="tcc-hero-ring tcc-hero-ring-1" aria-hidden="true" />
                <div className="tcc-hero-ring tcc-hero-ring-2" aria-hidden="true" />

                <div className="tcc-hero-inner">
                    <img src={tournament.crestImageUrl || crest} alt="" className="tcc-hero-crest" />

                    <span className="tcc-hero-pill">
                        <span className="tcc-hero-pill-dot" aria-hidden="true" />
                        OBHL Presents
                    </span>

                    <h1 className="tcc-hero-title">{tournament.name}</h1>
                    {tournament.tagline && <p className="tcc-hero-tagline">{tournament.tagline}</p>}

                    <p className="tcc-hero-body">
                        {dates}{tournament.venue ? ` · ${tournament.venue}` : ''} — OBHL&rsquo;s annual
                        tournament. Teams are freshly drafted each year; one weekend decides the Classic.
                    </p>

                    <div className="tcc-hero-cta">
                        <Link to={`${base}/bracket`} className="tcc-btn tcc-btn-solid tcc-hero-btn">View Bracket</Link>
                        <Link to={`${base}/schedule`} className="tcc-btn tcc-btn-ghost tcc-hero-btn">Game Schedule</Link>
                    </div>
                </div>
            </section>

            <section className="tcc-stats">
                <div className="tcc-stats-grid">
                    <Stat value={tournament.teamCount} label="Teams" sub="Freshly drafted for the Classic" />
                    <Stat value="1" label="Weekend" sub={dates} />
                    <Stat value={formatLabel(tournament)} label="Format" sub="Set by organisers each year" />
                    <Stat
                        value={`${tournament.periodCount} × ${tournament.periodMinutes}`}
                        label="Periods"
                        sub={tournament.venue || 'Sun Prairie Ice Arena'}
                    />
                </div>
            </section>

            {keyDates.length > 0 && (
                <section className="tcc-keydates">
                    <div className="tcc-container">
                        <div className="tcc-eyebrow">Road to the Classic</div>
                        <h2 className="tcc-h2">Key Dates</h2>
                        <div className="tcc-keydates-grid">
                            {keyDates.map(d => (
                                <div key={d.title} className="tcc-keydate">
                                    <div className="tcc-keydate-date">{d.date}</div>
                                    <div className="tcc-keydate-title">{d.title}</div>
                                    <div className="tcc-keydate-body">{d.body}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {teams.length > 0 && (
                <section className="tcc-field">
                    <div className="tcc-container">
                        <div className="tcc-field-head">
                            <div>
                                <div className="tcc-eyebrow">The Field</div>
                                <h2 className="tcc-h2">Seeded &amp; Ready</h2>
                            </div>
                            <Link to={`${base}/teams`} className="tcc-field-more">Full team list →</Link>
                        </div>
                        <div className="tcc-field-grid">
                            {teams.map(t => (
                                <Link key={t.id} to={`${base}/teams/${t.id}`} className="tcc-chip">
                                    {t.seed != null && <span className="tcc-chip-seed">{t.seed}</span>}
                                    <span className="tcc-dot" style={{ background: t.teamColor || '#888' }} />
                                    <span className="tcc-chip-name">{t.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section className="tcc-milk">
                <div className="tcc-container tcc-milk-grid">
                    <div>
                        <div className="tcc-eyebrow is-gold">A Classic Tradition</div>
                        <h2 className="tcc-h2">The Chocolate Milk<br />Player of the Game</h2>
                        <p className="tcc-milk-body">
                            No award at the Classic means more than a carton of chocolate milk. It is
                            the only one handed out by the other team.
                        </p>
                        <p className="tcc-milk-body">
                            After each game, each captain names one player from the opposing bench who
                            showed the best sportsmanship, and a carton finds its way to their locker
                            room. A chocolate-milk-carton trophy is being made for it.
                        </p>
                    </div>
                    <div className="tcc-milk-figure">
                        {tournament.trophyImageUrl ? (
                            <img src={tournament.trophyImageUrl} alt="The Chocolate Milk Carton trophy" className="tcc-milk-img" />
                        ) : (
                            <div className="tcc-milk-placeholder" aria-hidden="true">🥛</div>
                        )}
                        <div className="tcc-milk-caption">The Chocolate Milk Carton</div>
                    </div>
                </div>
            </section>
        </>
    );
}

function Stat({ value, label, sub }) {
    return (
        <div className="tcc-stat">
            <div className="tcc-stat-value">{value}</div>
            <div className="tcc-stat-label">{label}</div>
            {sub && <div className="tcc-stat-sub">{sub}</div>}
        </div>
    );
}

export default TournamentHome;
