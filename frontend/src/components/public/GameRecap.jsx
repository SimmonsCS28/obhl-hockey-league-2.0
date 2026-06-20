import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import * as api from '../../services/api';
import { resolveTeamColor, textOn } from '../../constants/teamColors';
import heroBg from '../../assets/images/buzzard-full.jpg';
import './GamePreview.css';
import './GameRecap.css';

function GameRecap() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [game, setGame] = useState(null);
    const [events, setEvents] = useState([]);
    const [staffNames, setStaffNames] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (gameId) fetchRecapData();
    }, [gameId]);

    const fetchRecapData = async () => {
        try {
            setLoading(true);
            const [gameData, teamsData] = await Promise.all([api.getGame(gameId), api.getTeams()]);
            if (!gameData) throw new Error('Game not found');

            const homeTeam = teamsData.find(t => t.id === gameData.homeTeamId);
            const awayTeam = teamsData.find(t => t.id === gameData.awayTeamId);
            const enrichedGame = {
                ...gameData,
                homeTeamName: homeTeam?.name || `Team ${gameData.homeTeamId}`,
                awayTeamName: awayTeam?.name || `Team ${gameData.awayTeamId}`,
                homeTeamColor: homeTeam?.teamColor,
                awayTeamColor: awayTeam?.teamColor,
            };
            setGame(enrichedGame);

            const [homePlayers, awayPlayers] = await Promise.all([
                api.getPlayers({ teamId: gameData.homeTeamId }),
                api.getPlayers({ teamId: gameData.awayTeamId }),
            ]);
            const allPlayers = [...homePlayers, ...awayPlayers];

            const backendEvents = await api.getGameEvents(gameData.id);
            if (backendEvents && backendEvents.length > 0) {
                const mapped = backendEvents.map((be) => {
                    const isHome = Number(be.teamId) === Number(gameData.homeTeamId);
                    const periodMap = { 1: '1', 2: '2', 3: '3', 4: 'OT', 5: 'SO' };
                    const timeStr = `${String(be.timeMinutes || 0).padStart(2, '0')}:${String(be.timeSeconds || 0).padStart(2, '0')}`;
                    const fmtName = (p, initial = false) => {
                        const name = initial ? `${p.firstName[0]}. ${p.lastName}` : `${p.firstName} ${p.lastName}`;
                        return p.jerseyNumber != null && p.jerseyNumber !== '' ? `#${p.jerseyNumber} ${name}` : name;
                    };
                    const mainPlayer = allPlayers.find(p => Number(p.id) === Number(be.playerId));
                    const assist1 = allPlayers.find(p => Number(p.id) === Number(be.assist1PlayerId));
                    const assist2 = allPlayers.find(p => Number(p.id) === Number(be.assist2PlayerId));
                    const assists = [];
                    if (assist1) assists.push(fmtName(assist1, true));
                    if (assist2) assists.push(fmtName(assist2, true));
                    return {
                        id: be.id,
                        type: be.eventType,
                        period: periodMap[be.period] || String(be.period),
                        time: timeStr,
                        teamId: be.teamId,
                        teamName: isHome ? enrichedGame.homeTeamName : enrichedGame.awayTeamName,
                        teamColor: isHome ? enrichedGame.homeTeamColor : enrichedGame.awayTeamColor,
                        player: mainPlayer ? fmtName(mainPlayer) : (be.description || 'Unknown'),
                        assists,
                        minutes: be.penaltyMinutes,
                        description: be.description,
                    };
                });
                mapped.sort((a, b) => {
                    if (a.period !== b.period) {
                        const pOrder = { '1': 1, '2': 2, '3': 3, 'OT': 4, 'SO': 5 };
                        return (pOrder[a.period] || 99) - (pOrder[b.period] || 99);
                    }
                    return a.time.localeCompare(b.time);
                });
                setEvents(mapped);
            }

            const [goalie1Name, goalie2Name, ref1Name, ref2Name, skName] = await Promise.all([
                api.getUserPublicName(gameData.goalie1Id),
                api.getUserPublicName(gameData.goalie2Id),
                api.getUserPublicName(gameData.referee1Id),
                api.getUserPublicName(gameData.referee2Id),
                api.getUserPublicName(gameData.scorekeeperId),
            ]);
            setStaffNames({
                homeGoalie: goalie1Name, awayGoalie: goalie2Name,
                referee1: ref1Name, referee2: ref2Name, scorekeeper: skName,
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
    };

    if (loading) return <div className="obi-page obi-gd"><div className="obi-gd-msg">Loading game recap…</div></div>;
    if (error) return (
        <div className="obi-page obi-gd">
            <div className="obi-gd-msg">
                <p className="obi-neg">Error: {error}</p>
                <button className="obi-ghost-btn" onClick={() => navigate(-1)}>Go Back</button>
            </div>
        </div>
    );
    if (!game) return <div className="obi-page obi-gd"><div className="obi-gd-msg">Game details could not be found.</div></div>;

    const goals = events.filter(e => e.type === 'goal');
    const penalties = events.filter(e => e.type === 'penalty');
    const homeWin = game.homeScore > game.awayScore;
    const awayWin = game.awayScore > game.homeScore;
    const metaChips = [formatDate(game.gameDate), game.rink ? `${game.rink} Rink` : null, `Week ${game.week} · Final${game.endedInOT ? ' (OT)' : ''}`].filter(Boolean);

    const officials = [
        { label: 'Referee 1', value: staffNames?.referee1 },
        { label: 'Referee 2', value: staffNames?.referee2 },
        { label: 'Scorekeeper', value: staffNames?.scorekeeper },
    ];

    const scoreSide = (id, name, color, score, win, goalie, designation) => (
        <div className="obi-recap-side">
            <div className="obi-gd-desig">{designation}</div>
            <Link to={`/teams/${id}`} className="obi-gd-teamchip" style={{ background: resolveTeamColor(color), color: textOn(color) }}>
                {name}
            </Link>
            <div className={`obi-recap-score ${win ? 'is-win' : 'is-lose'}`}>{score ?? 0}</div>
            <div className="obi-gd-goalie-label">Goalie</div>
            <div className={`obi-gd-goalie ${goalie ? '' : 'obi-unassigned'}`}>{goalie || 'Not Assigned'}</div>
        </div>
    );

    const teamCell = (name, color, id) => (
        <span className="obi-recap-team" onClick={() => navigate(`/teams/${id}`)}>
            <span className="obi-team-dot" style={{ background: resolveTeamColor(color) }} />
            {name}
        </span>
    );

    return (
        <div className="obi-page obi-gd">
            <section className="obi-page-hero">
                <img src={heroBg} alt="" className="obi-page-hero-bg" />
                <div className="obi-page-hero-overlay" />
                <div className="obi-page-hero-inner">
                    <button
                        className="obi-gd-back"
                        onClick={() => navigate(location.state?.fromDashboard ? '/user' : '/schedule')}
                    >
                        ← Back to {location.state?.fromDashboard ? 'My Dashboard' : 'Schedule'}
                    </button>
                    <div className="obi-eyebrow">Game Recap</div>
                    <h1 className="obi-gd-title">
                        {game.homeTeamName}<span className="obi-gd-title-vs">vs</span>{game.awayTeamName}
                    </h1>
                </div>
            </section>

            <section className="obi-gd-body">
                <div className="obi-gd-detail">
                    <div className="obi-gd-chips">
                        {metaChips.map((c, i) => <span key={i} className="obi-gd-chip">{c}</span>)}
                    </div>

                    <div className="obi-gd-rule" />

                    <div className="obi-recap-board">
                        {scoreSide(game.homeTeamId, game.homeTeamName, game.homeTeamColor, game.homeScore, homeWin, staffNames?.homeGoalie, 'Home')}
                        <div className="obi-recap-mid">Final</div>
                        {scoreSide(game.awayTeamId, game.awayTeamName, game.awayTeamColor, game.awayScore, awayWin, staffNames?.awayGoalie, 'Away')}
                    </div>

                    <div className="obi-gd-rule" />

                    <div className="obi-gd-officials">
                        {officials.map(o => (
                            <div key={o.label} className="obi-gd-official">
                                <div className="obi-gd-official-label">{o.label}</div>
                                <div className={`obi-gd-official-value ${o.value ? '' : 'obi-unassigned'}`}>{o.value || 'Not Assigned'}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="obi-recap-section">
                    <h3 className="obi-recap-section-title">Goal Summary</h3>
                    {goals.length === 0 ? (
                        <div className="obi-roster-empty">No goals recorded in this game.</div>
                    ) : (
                        <div className="obi-recap-table-wrap">
                            <table className="obi-recap-table">
                                <thead>
                                    <tr><th>PD</th><th>Time</th><th>Team</th><th>Goal Scorer</th><th>Assists</th></tr>
                                </thead>
                                <tbody>
                                    {goals.map(g => (
                                        <tr key={g.id}>
                                            <td className="obi-recap-pd">{g.period}</td>
                                            <td className="obi-recap-time">{g.time}</td>
                                            <td>{teamCell(g.teamName, g.teamColor, g.teamId)}</td>
                                            <td className="obi-recap-player">{g.player}</td>
                                            <td className="obi-recap-assists">
                                                {g.assists.length > 0 ? g.assists.join(', ') : <span className="obi-unassigned">Unassisted</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="obi-recap-section">
                    <h3 className="obi-recap-section-title">Penalty Summary</h3>
                    {penalties.length === 0 ? (
                        <div className="obi-roster-empty">No penalties recorded in this game.</div>
                    ) : (
                        <div className="obi-recap-table-wrap">
                            <table className="obi-recap-table">
                                <thead>
                                    <tr><th>PD</th><th>Time</th><th>Team</th><th>Player</th><th>Infraction</th><th>Min</th></tr>
                                </thead>
                                <tbody>
                                    {penalties.map(p => (
                                        <tr key={p.id}>
                                            <td className="obi-recap-pd">{p.period}</td>
                                            <td className="obi-recap-time">{p.time}</td>
                                            <td>{teamCell(p.teamName, p.teamColor, p.teamId)}</td>
                                            <td className="obi-recap-player">{p.player}</td>
                                            <td>{p.description}</td>
                                            <td className="obi-recap-min">{p.minutes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

export default GameRecap;
