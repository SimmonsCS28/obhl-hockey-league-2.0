import './PlayoffBracket.css';

const PlayoffBracket = ({ games, teams }) => {
    const getTeam = (teamId) => {
        if (!teamId) return null;
        return teams.find(t => t.id === teamId);
    };

    const getValidColor = (color) => {
        if (!color) return '#95a5a6';
        const colorMap = {
            'Lt. Blu': '#87CEEB',
            'Dk. Gre': '#006400',
            'White': '#FFFFFF',
            'Yellow': '#FFD700',
            'Gold': '#FFD700'
        };
        return colorMap[color] || color;
    };

    const getTextColor = (bgColor) => {
        if (!bgColor) return 'white';
        const lightColors = ['White', '#FFFFFF', 'Yellow', '#FFD700', 'Gold', 'Lt. Blu', '#87CEEB'];
        return lightColors.some(c => c.toLowerCase() === bgColor.toLowerCase()) ? '#2c3e50' : 'white';
    };

    // Group games by playoff round
    const byRound = {
        QUARTERFINAL: games.filter(g => g.playoffRound === 'QUARTERFINAL')
            .sort((a, b) => (a.bracketPosition || 0) - (b.bracketPosition || 0)),
        SEMIFINAL: games.filter(g => g.playoffRound === 'SEMIFINAL')
            .sort((a, b) => (a.bracketPosition || 0) - (b.bracketPosition || 0)),
        FINAL: games.filter(g => g.playoffRound === 'FINAL')
            .sort((a, b) => (a.bracketPosition || 0) - (b.bracketPosition || 0)),
    };

    // Determine which rounds exist
    const rounds = [];
    if (byRound.QUARTERFINAL.length > 0) rounds.push({ key: 'QUARTERFINAL', label: 'Quarterfinals', games: byRound.QUARTERFINAL });
    if (byRound.SEMIFINAL.length > 0) rounds.push({ key: 'SEMIFINAL', label: 'Semifinals', games: byRound.SEMIFINAL });
    if (byRound.FINAL.length > 0) rounds.push({ key: 'FINAL', label: '🏆 Championship', games: byRound.FINAL });

    if (rounds.length === 0) return null;

    const renderTeamSlot = (teamId, score, isWinner, isTbd) => {
        const team = getTeam(teamId);
        const bg = team ? getValidColor(team.teamColor) : (isTbd ? '#374151' : '#555');
        const fg = team ? getTextColor(bg) : '#9ca3af';

        return (
            <div
                className={`bracket-team-slot ${isWinner ? 'bracket-winner' : ''} ${isTbd ? 'bracket-tbd' : ''}`}
                style={{ backgroundColor: bg, color: fg }}
            >
                <span className="bracket-team-name">
                    {team ? team.name : 'TBD'}
                </span>
                {score !== null && score !== undefined && (
                    <span className={`bracket-score ${isWinner ? 'bracket-score-winner' : ''}`}>
                        {score}
                    </span>
                )}
                {isWinner && <span className="bracket-star">★</span>}
            </div>
        );
    };

    const renderMatchup = (game, isFinal = false) => {
        const homeTbd = !game.homeTeamId;
        const awayTbd = !game.awayTeamId;
        const isCompleted = game.status === 'completed';
        const homeWin = isCompleted && game.homeScore > game.awayScore;
        const awayWin = isCompleted && game.awayScore > game.homeScore;

        const gameDate = game.gameDate
            ? new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z')
            : null;

        const roundLabel = game.playoffRound === 'QUARTERFINAL' ? 'QF' :
            game.playoffRound === 'SEMIFINAL' ? 'SF' : '🏆';

        return (
            <div key={game.id} className={`bracket-matchup ${isFinal ? 'bracket-final' : ''} ${isCompleted ? 'bracket-completed' : ''}`}>
                <div className="bracket-matchup-header">
                    <span className="bracket-round-label">{roundLabel} #{game.bracketPosition}</span>
                    {gameDate && (
                        <span className="bracket-game-date">
                            {gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' · '}
                            {gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            {game.rink ? ` · ${game.rink}` : ''}
                        </span>
                    )}
                    {isCompleted && (
                        <span className="bracket-final-badge">Final</span>
                    )}
                </div>

                <div className="bracket-teams">
                    {renderTeamSlot(
                        game.homeTeamId,
                        isCompleted ? game.homeScore : null,
                        homeWin,
                        homeTbd
                    )}
                    <div className="bracket-vs">VS</div>
                    {renderTeamSlot(
                        game.awayTeamId,
                        isCompleted ? game.awayScore : null,
                        awayWin,
                        awayTbd
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="playoff-bracket">
            <div className="playoff-bracket-header">
                <div className="playoff-bracket-title">
                    <span className="bracket-trophy">🏆</span>
                    Playoff Bracket
                </div>
                <div className="playoff-bracket-legend">
                    <span className="legend-upcoming">⬜ Upcoming</span>
                    <span className="legend-completed">✅ Completed</span>
                </div>
            </div>

            <div className="bracket-rounds" style={{ '--round-count': rounds.length }}>
                {rounds.map((round, roundIdx) => (
                    <div key={round.key} className={`bracket-round bracket-round-${round.key.toLowerCase()}`}>
                        <div className="bracket-round-header">
                            <h3>{round.label}</h3>
                            <div className="round-record">
                                {round.games.filter(g => g.status === 'completed').length}/{round.games.length} played
                            </div>
                        </div>
                        <div className="bracket-matchups">
                            {round.games.map(game => renderMatchup(game, round.key === 'FINAL'))}
                        </div>
                        {/* Connector lines between rounds (desktop only) */}
                        {roundIdx < rounds.length - 1 && (
                            <div className="bracket-connector" aria-hidden="true" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlayoffBracket;
