import { Link } from 'react-router-dom';
import { useTournament } from './useTournament';
import {
    STAGE_LABEL,
    arenaDayKey,
    formatArenaDay,
    formatGameTime,
    teamMap,
    useTournamentGames,
    useTournamentTeams,
} from './tournamentData';
import './TournamentPages.css';

/** Group games by calendar day, preserving chronological order. */
function byDay(games) {
    const days = new Map();
    for (const g of games) {
        // Group by the rink's calendar day: a late game is still that evening, not the next
        // day in UTC.
        const key = arenaDayKey(g.gameDate);
        if (!days.has(key)) days.set(key, []);
        days.get(key).push(g);
    }
    return [...days.entries()];
}

function TournamentSchedule() {
    const { tournament, seasonId, base } = useTournament();
    const { games, loading, error } = useTournamentGames(seasonId);
    const { teams } = useTournamentTeams(seasonId);
    const byId = teamMap(teams);

    const days = byDay(games);

    return (
        <>
            <div className="tcc-head">
                <div className="tcc-head-inner">
                    <div className="tcc-eyebrow">One Weekend</div>
                    <h1 className="tcc-h1">Game Schedule</h1>
                    <p className="tcc-sub">
                        {tournament.venue || 'Sun Prairie Ice Arena'}. Every game of the Classic, in order.
                    </p>
                </div>
            </div>

            <div className="tcc-schedule">
                {loading && <div className="tcc-empty">Loading schedule…</div>}
                {error && <div className="tcc-empty">{error}</div>}

                {!loading && !error && games.length === 0 && (
                    <div className="tcc-empty">
                        <div className="tcc-empty-title">Schedule not published yet</div>
                        Games appear here once the organisers generate the schedule for this year&rsquo;s format.
                    </div>
                )}

                {days.map(([day, dayGames]) => (
                    <div key={day} className="tcc-day">
                        <div className="tcc-day-head">
                            <div className="tcc-day-label">
                                {formatArenaDay(day)}
                            </div>
                            <div className="tcc-day-meta">
                                {dayGames.length} game{dayGames.length === 1 ? '' : 's'}
                                {dayGames[0]?.tournamentStage ? ` · ${STAGE_LABEL[dayGames[0].tournamentStage]}` : ''}
                            </div>
                        </div>

                        {dayGames.map(g => {
                            const home = byId[g.homeTeamId];
                            const away = byId[g.awayTeamId];
                            const done = g.status === 'completed';
                            // The final and any placement/consolation game read as day-two business;
                            // gold marks the one that decides the Classic.
                            const isFinal = g.playoffRound === 'FINAL';

                            return (
                                <div
                                    key={g.id}
                                    className="tcc-srow"
                                    style={{ borderLeftColor: isFinal ? 'var(--tcc-gold)' : 'var(--tcc-blue)' }}
                                >
                                    <div className="tcc-srow-time">{formatGameTime(g.gameDate)}</div>

                                    <div className="tcc-srow-teams">
                                        <span className="tcc-srow-side is-home">
                                            <TeamLabel team={home} base={base} />
                                        </span>
                                        <span className="tcc-srow-mid">
                                            {done ? `${g.homeScore}–${g.awayScore}` : 'VS'}
                                        </span>
                                        <span className="tcc-srow-side">
                                            <TeamLabel team={away} base={base} />
                                        </span>
                                    </div>

                                    <div className="tcc-srow-rink">
                                        {g.rink || '—'}
                                        {g.tournamentStage && (
                                            <span className="tcc-srow-stage">{STAGE_LABEL[g.tournamentStage]}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </>
    );
}

function TeamLabel({ team, base }) {
    if (!team) return <span className="tcc-srow-team is-tbd">TBD</span>;
    return (
        <Link to={`${base}/teams/${team.id}`} className="tcc-srow-team">
            <span className="tcc-dot" style={{ background: team.teamColor || '#888' }} />
            {team.name}
        </Link>
    );
}

export default TournamentSchedule;
