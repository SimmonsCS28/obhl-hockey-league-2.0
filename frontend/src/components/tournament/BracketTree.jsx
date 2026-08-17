import { Link } from 'react-router-dom';

/**
 * Renders a single-elimination bracket with CSS Grid.
 *
 * Not absolute positioning. The design prototype placed cards at fixed pixel offsets
 * (y = 0, 128, 302, 430) purely to show the visual target, and said so — that does not survive a
 * 16-team field or a phone. With grid, a match in round r spans 2^r row tracks and vertical
 * centring falls out of the layout engine at any bracket size.
 *
 * Connectors are drawn as bordered pseudo-elements on the spacer columns, so they track the cards
 * rather than needing their own coordinates.
 */
function BracketTree({ rounds, teamsById, base }) {
    if (!rounds.length) return null;

    // Row tracks = one per first-round slot pair. Every later round spans progressively more.
    const firstRoundGames = rounds[0].games.length;
    const totalRows = Math.max(firstRoundGames, 1) * 2;

    return (
        <div className="tcc-bracket-scroll">
            <div className="tcc-bracket-rounds">
                {rounds.map(r => (
                    <div key={r.round} className="tcc-bracket-roundlabel" style={{ gridColumn: 'span 2' }}>
                        {r.label}
                    </div>
                ))}
            </div>

            <div
                className="tcc-bracket"
                style={{
                    gridTemplateColumns: `repeat(${rounds.length}, 220px 46px)`,
                    gridTemplateRows: `repeat(${totalRows}, 46px)`,
                }}
            >
                {rounds.map((r, ri) => {
                    const span = Math.pow(2, ri + 1);
                    return r.games.map((g, gi) => (
                        <div
                            key={g.id ?? `${ri}-${gi}`}
                            className="tcc-bracket-cell"
                            style={{
                                gridColumn: ri * 2 + 1,
                                gridRow: `${gi * span + 1} / span ${span}`,
                            }}
                        >
                            <MatchCard game={g} teamsById={teamsById} base={base} isFinal={r.round === 'FINAL'} />
                            {ri < rounds.length - 1 && (
                                <span
                                    className={`tcc-bracket-link ${gi % 2 === 0 ? 'is-down' : 'is-up'}`}
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                    ));
                })}
            </div>
        </div>
    );
}

function MatchCard({ game, teamsById, base, isFinal }) {
    const home = teamsById[game.homeTeamId];
    const away = teamsById[game.awayTeamId];
    const done = game.status === 'completed';
    const homeWon = done && game.homeScore > game.awayScore;
    const awayWon = done && game.awayScore > game.homeScore;

    return (
        <div className={`tcc-match ${isFinal ? 'is-final' : ''}`}>
            <Side team={home} score={game.homeScore} won={homeWon} done={done} base={base} />
            <Side team={away} score={game.awayScore} won={awayWon} done={done} base={base} />
            {!done && (
                <div className="tcc-match-meta">
                    {game.gameDate
                        ? new Date(game.gameDate).toLocaleString('en-US',
                            { weekday: 'short', hour: 'numeric', minute: '2-digit' })
                        : 'TBD'}
                    {game.rink ? ` · ${game.rink}` : ''}
                </div>
            )}
        </div>
    );
}

function Side({ team, score, won, done, base }) {
    if (!team) {
        return (
            <div className="tcc-match-side is-tbd">
                <span className="tcc-match-name">TBD</span>
            </div>
        );
    }
    return (
        <div className={`tcc-match-side ${done && !won ? 'is-lost' : ''}`}>
            <span className="tcc-dot is-sm" style={{ background: team.teamColor || '#888' }} />
            <Link to={`${base}/teams/${team.id}`} className="tcc-match-name">{team.name}</Link>
            {done && <span className="tcc-match-score">{score}</span>}
        </div>
    );
}

export default BracketTree;
