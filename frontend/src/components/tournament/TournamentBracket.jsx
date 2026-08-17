import { Link } from 'react-router-dom';
import { useTournament } from './useTournament';
import { useTournamentGames } from './tournamentData';
import { describeBreakdown, summarizeFormat } from '../admin/tournament/tournamentFormat';
import './TournamentPages.css';

/**
 * The bracket.
 *
 * Bracket rendering itself lands with the schedule generator — until games exist there is no tree to
 * draw. What this page does today is the part that is correct regardless: explain the format that
 * will be run, because between entries opening and the schedule being generated that is genuinely
 * all there is to say, and "no bracket yet" is a state this page will keep having every single year.
 */
function TournamentBracket() {
    const { tournament, seasonId, base } = useTournament();
    const { games, loading } = useTournamentGames(seasonId);

    const summary = summarizeFormat(tournament);
    const bracketGames = games.filter(g =>
        ['BRACKET', 'PLACEMENT', 'CONSOLATION'].includes(g.tournamentStage));

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

                {!loading && bracketGames.length === 0 && (
                    <div className="tcc-preview">
                        <div className="tcc-empty-title">The bracket isn&rsquo;t drawn yet</div>
                        <p className="tcc-preview-lead">
                            It gets generated once entries close and the field is drafted. Here&rsquo;s the
                            shape this year&rsquo;s Classic will take.
                        </p>

                        <div className="tcc-preview-total">
                            <span className="tcc-preview-num">{summary.totalGames}</span>
                            <span className="tcc-preview-unit">games</span>
                        </div>
                        <div className="tcc-preview-break">{describeBreakdown(summary)}</div>

                        <dl className="tcc-preview-facts">
                            <Fact label="Teams" value={tournament.teamCount} />
                            {summary.pools.length > 1 && (
                                <Fact label="Divisions" value={summary.pools.join(' / ')} />
                            )}
                            {summary.qualifiers > 0 && (
                                <Fact label="Reach the bracket" value={summary.qualifiers} />
                            )}
                            <Fact
                                label="Games per team"
                                value={summary.minGamesPerTeam === summary.maxGamesPerTeam
                                    ? summary.minGamesPerTeam
                                    : `${summary.minGamesPerTeam}–${summary.maxGamesPerTeam}`}
                            />
                            <Fact label="Game length" value={`${tournament.periodCount} × ${tournament.periodMinutes} min`} />
                        </dl>

                        <Link to={`${base}/teams`} className="tcc-btn tcc-btn-ghost tcc-preview-cta">
                            See the field
                        </Link>
                    </div>
                )}

                {!loading && bracketGames.length > 0 && (
                    <div className="tcc-empty">
                        <div className="tcc-empty-title">Bracket coming online</div>
                        {bracketGames.length} bracket game{bracketGames.length === 1 ? '' : 's'} scheduled.
                        The full bracket view arrives with the schedule generator.
                    </div>
                )}
            </div>
        </>
    );
}

function Fact({ label, value }) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>{value}</dd>
        </div>
    );
}

export default TournamentBracket;
