import { Link, useParams } from 'react-router-dom';
import { useTournament } from './useTournament';
import {
    STAGE_LABEL,
    formatGameDate,
    formatGameTime,
    teamMap,
    tournamentRecord,
    useTournamentGames,
    useTournamentPlayers,
    useTournamentTeams,
} from './tournamentData';
import './TournamentPages.css';

/** Hex -> rgba, for the tinted glow behind a team's hero. */
function glow(hex, alpha) {
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return `rgba(63,167,214,${alpha})`;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function TournamentTeamRoster() {
    const { teamId } = useParams();
    const { seasonId, base } = useTournament();
    const { teams, loading } = useTournamentTeams(seasonId);
    const { players } = useTournamentPlayers(seasonId);
    const { games } = useTournamentGames(seasonId);

    const id = Number(teamId);
    const team = teams.find(t => t.id === id);
    const byId = teamMap(teams);

    if (loading) return <div className="tcc-empty">Loading…</div>;
    if (!team) {
        return (
            <div className="tcc-empty">
                <div className="tcc-empty-title">Team not found</div>
                <Link to={`${base}/teams`} className="tcc-back">← All Teams</Link>
            </div>
        );
    }

    const roster = players
        .filter(p => p.teamId === id)
        .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));

    const captain = players.find(p => p.id === team.captainPlayerId);
    const rec = tournamentRecord(id, games);
    const teamGames = games.filter(g => g.homeTeamId === id || g.awayTeamId === id);

    return (
        <>
            <div
                className="tcc-roster-hero"
                style={{
                    borderBottomColor: team.teamColor || 'var(--tcc-blue)',
                    backgroundImage:
                        `linear-gradient(180deg, rgba(5,7,10,0.4), #05070a), ` +
                        `radial-gradient(120% 140% at 0% 0%, ${glow(team.teamColor, 0.35)}, rgba(5,7,10,0) 55%)`,
                }}
            >
                <div className="tcc-container">
                    <Link to={`${base}/teams`} className="tcc-back">← All Teams</Link>
                    <div className="tcc-roster-hero-row">
                        <div className="tcc-roster-identity">
                            <span
                                className="tcc-roster-block"
                                style={{ background: team.teamColor || '#888' }}
                                aria-hidden="true"
                            />
                            <div>
                                <div className="tcc-eyebrow">
                                    {team.seed != null ? `Seed ${team.seed} · ` : ''}Conley Classic
                                </div>
                                <h1 className="tcc-roster-name">{team.name}</h1>
                                <div className="tcc-roster-captain">
                                    <span>Captain</span> {captain ? `${captain.firstName} ${captain.lastName}` : 'TBD'}
                                </div>
                            </div>
                        </div>

                        <div className="tcc-roster-stats">
                            <div className="tcc-roster-stat">
                                <div className="tcc-roster-stat-value">{rec.label}</div>
                                <div className="tcc-roster-stat-label">Classic Record</div>
                            </div>
                            <div className="tcc-roster-stat is-status">
                                <div className="tcc-roster-stat-value" style={{ color: 'var(--tcc-blue)' }}>
                                    {team.eliminated ? 'Eliminated' : 'Alive'}
                                </div>
                                <div className="tcc-roster-stat-label">Classic Status</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="tcc-roster-body">
                <div className="tcc-container tcc-roster-grid">
                    <section>
                        <SectionHead title="Roster" meta={`${roster.length} skaters`} />
                        <div className="tcc-table">
                            <div className="tcc-thead tcc-roster-row">
                                <span>#</span><span>Player</span><span>Position</span>
                            </div>
                            {roster.map(p => (
                                <div key={p.id} className="tcc-trow tcc-roster-row">
                                    <span className="tcc-roster-num">{p.jerseyNumber ?? '—'}</span>
                                    <span className="tcc-roster-player">
                                        {p.firstName} {p.lastName}
                                        {/* Same badges as the Players page, so the two agree. */}
                                        {team.captainPlayerId === p.id && <span className="tcc-badge">GM</span>}
                                        {p.twoGoalLimit && (
                                            <span className="tcc-badge is-2gl" title="Two-goal limit applies">2GL</span>
                                        )}
                                    </span>
                                    <span><span className="tcc-pos-pill">{p.position}</span></span>
                                </div>
                            ))}
                            {roster.length === 0 && <div className="tcc-empty">Roster not set yet.</div>}
                        </div>
                    </section>

                    <section>
                        <SectionHead title="Classic Schedule" meta={`${teamGames.length} games`} />
                        <div className="tcc-gamelist">
                            {teamGames.map(g => {
                                const isHome = g.homeTeamId === id;
                                const oppId = isHome ? g.awayTeamId : g.homeTeamId;
                                const opp = byId[oppId];
                                const done = g.status === 'completed';
                                const mine = isHome ? g.homeScore : g.awayScore;
                                const theirs = isHome ? g.awayScore : g.homeScore;
                                const result = !done ? null : mine > theirs ? 'Win' : theirs > mine ? 'Loss' : 'Tie';

                                return (
                                    <div key={g.id} className={`tcc-gamecard ${done ? '' : 'is-upcoming'}`}>
                                        <div className="tcc-gamecard-rail">
                                            <div className="tcc-gamecard-round">
                                                {STAGE_LABEL[g.tournamentStage] || 'Game'}
                                            </div>
                                            <div className="tcc-gamecard-date">{formatGameDate(g.gameDate)}</div>
                                        </div>
                                        <div className="tcc-gamecard-main">
                                            <div className="tcc-gamecard-teams">
                                                <span className="tcc-dot" style={{ background: team.teamColor || '#888' }} />
                                                <span className="tcc-gamecard-self">{team.name}</span>
                                                {done ? (
                                                    <span className="tcc-gamecard-score">
                                                        <b className={mine >= theirs ? '' : 'is-dim'}>{mine}</b>
                                                        <span className="tcc-gamecard-dash">–</span>
                                                        <b className={theirs >= mine ? '' : 'is-dim'}>{theirs}</b>
                                                    </span>
                                                ) : (
                                                    <span className="tcc-gamecard-vs">vs</span>
                                                )}
                                                {opp ? (
                                                    <Link to={`${base}/teams/${opp.id}`} className="tcc-gamecard-opp">
                                                        <span className="tcc-dot" style={{ background: opp.teamColor || '#888' }} />
                                                        {opp.name}
                                                    </Link>
                                                ) : (
                                                    <span className="tcc-gamecard-opp is-tbd">TBD</span>
                                                )}
                                            </div>
                                            <div className="tcc-gamecard-meta">
                                                {g.rink || 'Rink TBD'} · {done ? 'Final' : formatGameTime(g.gameDate)}
                                            </div>
                                        </div>
                                        <div className={`tcc-tag ${result ? `is-${result.toLowerCase()}` : 'is-upcoming'}`}>
                                            {result || 'Upcoming'}
                                        </div>
                                    </div>
                                );
                            })}
                            {teamGames.length === 0 && (
                                <div className="tcc-empty">Schedule not published yet.</div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

function SectionHead({ title, meta }) {
    return (
        <div className="tcc-sechead">
            <h2 className="tcc-sechead-title">{title}</h2>
            <span className="tcc-sechead-meta">{meta}</span>
            <span className="tcc-sechead-rule" />
        </div>
    );
}

export default TournamentTeamRoster;
