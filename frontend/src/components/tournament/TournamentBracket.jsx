import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from './useTournament';
import { STAGE_LABEL, formatGameTime, teamMap, useTournamentGames, useTournamentResult, useTournamentStandings, useTournamentTeams } from './tournamentData';
import { describeBreakdown, summarizeFormat } from '../admin/tournament/tournamentFormat';
import BracketTree from './BracketTree';
import './TournamentPages.css';

/** Order rounds first-to-final. FINAL last, then by how many games each round has. */
const ROUND_RANK = { ROUND_OF_32: 0, ROUND_OF_16: 1, QUARTERFINAL: 2, SEMIFINAL: 3, FINAL: 4 };
const ROUND_LABEL = {
    ROUND_OF_32: 'Round of 32',
    ROUND_OF_16: 'Round of 16',
    QUARTERFINAL: 'Quarterfinals',
    SEMIFINAL: 'Semifinals',
    FINAL: 'Final',
};

function TournamentBracket() {
    const { tournament, seasonId, base } = useTournament();
    const { games, loading } = useTournamentGames(seasonId);
    const { teams } = useTournamentTeams(seasonId);
    const { standings } = useTournamentStandings(seasonId);
    const { championTeamId } = useTournamentResult(seasonId);

    const byId = teamMap(teams);
    const summary = summarizeFormat(tournament);

    const bracketGames = games.filter(g => g.tournamentStage === 'BRACKET');
    const extraGames = games.filter(g => ['PLACEMENT', 'CONSOLATION'].includes(g.tournamentStage));
    const hasGroupStage = tournament.groupStage !== 'NONE';

    const rounds = useMemo(() => {
        const byRound = new Map();
        for (const g of bracketGames) {
            const r = g.playoffRound || 'FINAL';
            if (!byRound.has(r)) byRound.set(r, []);
            byRound.get(r).push(g);
        }
        return [...byRound.entries()]
            .sort((a, b) => (ROUND_RANK[a[0]] ?? 9) - (ROUND_RANK[b[0]] ?? 9))
            .map(([round, list]) => ({
                round,
                label: ROUND_LABEL[round] || round,
                games: list.sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0)),
            }));
    }, [bracketGames]);

    // Standings grouped by division, so a two-division tournament shows two tables side by side.
    const divisions = useMemo(() => {
        const map = new Map();
        for (const s of standings) {
            const pool = byId[s.teamId]?.pool || '';
            if (!map.has(pool)) map.set(pool, []);
            map.get(pool).push(s);
        }
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [standings, byId]);

    const eyebrow = tournament.championshipStage === 'NONE'
        ? `${tournament.teamCount} Teams · Round Robin`
        : tournament.groupStage === 'DIVISIONS'
            ? `${tournament.teamCount} Teams · Divisions + Bracket`
            : `${tournament.teamCount} Teams · Single Elimination`;

    const sub = tournament.championshipStage === 'NONE'
        ? 'Every team plays every other team once. Best record after the weekend wins the Classic.'
        : tournament.groupStage === 'DIVISIONS'
            ? `Division play seeds a ${summary.qualifiers}-team bracket on day two.`
            : "One loss and you're out. Teams are freshly drafted and seeded each year.";

    return (
        <>
            <div className="tcc-head">
                <div className="tcc-head-inner">
                    <div className="tcc-eyebrow">{eyebrow}</div>
                    <h1 className="tcc-h1">Bracket</h1>
                    <p className="tcc-sub">{sub}</p>
                </div>
            </div>

            <div className="tcc-container tcc-section">
                {loading && <div className="tcc-empty">Loading…</div>}

                {/* Nothing generated yet — the state this page is in for most of every year. */}
                {!loading && bracketGames.length === 0 && extraGames.length === 0 && (
                    <FormatPreview tournament={tournament} summary={summary} base={base} />
                )}

                {!loading && hasGroupStage && divisions.length > 0 && (
                    <section className="tcc-standings-wrap">
                        <h2 className="tcc-sechead-title tcc-standings-title">
                            {divisions.length > 1 ? 'Division Standings' : 'Standings'}
                        </h2>
                        <div className="tcc-standings-grid">
                            {divisions.map(([pool, rows]) => (
                                <StandingsTable
                                    key={pool || 'all'}
                                    label={pool ? `Division ${pool}` : 'Standings'}
                                    rows={rows}
                                    byId={byId}
                                    base={base}
                                    advance={tournament.advancePerPool ?? 0}
                                />
                            ))}
                        </div>
                        {/*
                          * The legend is the point of showing PW and PFP at all: without it a team
                          * on 14 points from a 2-1 record looks like an arithmetic error.
                          */}
                        <dl className="tcc-legend">
                            <div><dt>PW</dt><dd>Periods won — 1 point each, for scoring more goals than
                                the opponent in a period. A tied period awards neither team.</dd></div>
                            <div><dt>PFP</dt><dd>Penalty-free periods — 1 point each, for taking no
                                penalties in a period. Both teams can earn this in the same period.</dd></div>
                            <div><dt>PTS</dt><dd>3 for a win, 1 each for a tie, plus PW and PFP. Seven
                                or more penalties in a game costs a point.</dd></div>
                        </dl>
                        <p className="tcc-standings-note">
                            Only division games award points — bracket, placement and consolation games
                            decide placing, not standings.
                            {tournament.championshipStage !== 'NONE' && ` Top ${tournament.advancePerPool} from each division advance.`}
                        </p>
                    </section>
                )}

                {/* The whole weekend decides this one thing, so it leads rather than hides in the tree. */}
                {!loading && championTeamId && byId[championTeamId] && (
                    <section className="tcc-champion">
                        <div className="tcc-champion-eyebrow">Classic Champion</div>
                        <div className="tcc-champion-row">
                            <span className="tcc-dot is-lg" style={{ background: byId[championTeamId].teamColor || '#888' }} />
                            <Link to={`${base}/teams/${championTeamId}`} className="tcc-champion-name">
                                {byId[championTeamId].name}
                            </Link>
                        </div>
                    </section>
                )}

                {!loading && rounds.length > 0 && (
                    <section className="tcc-bracket-section">
                        <h2 className="tcc-sechead-title tcc-standings-title">Championship</h2>
                        <BracketTree rounds={rounds} teamsById={byId} base={base} />
                    </section>
                )}

                {!loading && extraGames.length > 0 && (
                    <section className="tcc-extra">
                        <h2 className="tcc-sechead-title tcc-standings-title">Also on day two</h2>
                        <div className="tcc-extra-list">
                            {extraGames.map(g => (
                                <div key={g.id} className="tcc-extra-row">
                                    <span className="tcc-extra-stage">{STAGE_LABEL[g.tournamentStage]}</span>
                                    <span className="tcc-extra-teams">
                                        {byId[g.homeTeamId]?.name || 'TBD'}
                                        <span className="tcc-extra-vs">
                                            {g.status === 'completed' ? `${g.homeScore}–${g.awayScore}` : 'vs'}
                                        </span>
                                        {byId[g.awayTeamId]?.name || 'TBD'}
                                    </span>
                                    <span className="tcc-extra-meta">
                                        {formatGameTime(g.gameDate)}
                                        {g.rink ? ` · ${g.rink}` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p className="tcc-standings-note">
                            The placement game is contested by the two semifinal losers. Consolation games
                            give every team that misses the bracket one more game.
                        </p>
                    </section>
                )}
            </div>
        </>
    );
}

function StandingsTable({ label, rows, byId, base, advance }) {
    return (
        <div>
            <div className="tcc-standings-label">{label}</div>
            <div className="tcc-table">
                <div className="tcc-thead tcc-standings-row">
                    <span>#</span><span>Team</span><span>GP</span><span>W</span><span>L</span><span>T</span>
                    <span title="Periods won">PW</span>
                    <span title="Penalty-free periods">PFP</span>
                    <span>Pts</span>
                </div>
                {rows.map((s, i) => {
                    const team = byId[s.teamId];
                    return (
                        <div
                            key={s.teamId}
                            className={`tcc-trow tcc-standings-row ${i < advance ? 'is-advancing' : ''}`}
                        >
                            <span className="tcc-standings-rank">{i + 1}</span>
                            <span className="tcc-standings-team">
                                <span className="tcc-dot is-sm" style={{ background: team?.teamColor || '#888' }} />
                                {team ? (
                                    <Link to={`${base}/teams/${team.id}`}>{team.name}</Link>
                                ) : `Team ${s.teamId}`}
                                {s.coinFlipApplied && (
                                    <span className="tcc-coinflip" title="Tied on every tiebreaker — a coin flip decides">
                                        coin flip
                                    </span>
                                )}
                            </span>
                            <span>{s.gamesPlayed}</span>
                            <span>{s.wins}</span>
                            <span>{s.losses}</span>
                            <span>{s.ties}</span>
                            <span className="tcc-standings-bonus">{s.periodsWon}</span>
                            <span className="tcc-standings-bonus">{s.penaltyFreePeriods}</span>
                            <span className="tcc-standings-pts">{s.points}</span>
                        </div>
                    );
                })}
                {rows.length === 0 && <div className="tcc-empty">No games played yet.</div>}
            </div>
        </div>
    );
}

function FormatPreview({ tournament, summary, base }) {
    return (
        <div className="tcc-preview">
            <div className="tcc-empty-title">The bracket isn&rsquo;t drawn yet</div>
            <p className="tcc-preview-lead">
                It gets generated once registration closes and the field is drafted. Here&rsquo;s the shape
                this year&rsquo;s Classic will take.
            </p>

            <div className="tcc-preview-total">
                <span className="tcc-preview-num">{summary.totalGames}</span>
                <span className="tcc-preview-unit">games</span>
            </div>
            <div className="tcc-preview-break">{describeBreakdown(summary)}</div>

            <dl className="tcc-preview-facts">
                <div><dt>Teams</dt><dd>{tournament.teamCount}</dd></div>
                {summary.pools.length > 1 && (
                    <div><dt>Divisions</dt><dd>{summary.pools.join(' / ')}</dd></div>
                )}
                {summary.qualifiers > 0 && (
                    <div><dt>Reach the bracket</dt><dd>{summary.qualifiers}</dd></div>
                )}
                <div><dt>Games per team</dt><dd>
                    {summary.minGamesPerTeam === summary.maxGamesPerTeam
                        ? summary.minGamesPerTeam
                        : `${summary.minGamesPerTeam}–${summary.maxGamesPerTeam}`}
                </dd></div>
                <div><dt>Game length</dt><dd>{tournament.periodCount} × {tournament.periodMinutes} min</dd></div>
            </dl>

            <Link to={`${base}/teams`} className="tcc-btn tcc-btn-ghost tcc-preview-cta">See the field</Link>
        </div>
    );
}

export default TournamentBracket;
