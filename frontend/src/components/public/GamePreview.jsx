import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import * as api from '../../services/api';
import { resolveTeamColor, textOn } from '../../constants/teamColors';
import heroBg from '../../assets/images/buzzard-full.jpg';
import './GamePreview.css';

function GamePreview() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [game, setGame] = useState(null);
    const [homeTeam, setHomeTeam] = useState(null);
    const [awayTeam, setAwayTeam] = useState(null);
    const [homeRank, setHomeRank] = useState('');
    const [awayRank, setAwayRank] = useState('');
    const [homeRoster, setHomeRoster] = useState([]);
    const [awayRoster, setAwayRoster] = useState([]);
    const [staffNames, setStaffNames] = useState(null);
    const [seasonGames, setSeasonGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (gameId) fetchPreviewData();
    }, [gameId]);

    const fetchPreviewData = async () => {
        try {
            setLoading(true);
            const gameData = await api.getGame(gameId);
            setGame(gameData);
            if (!gameData) throw new Error('Game not found');

            api.getGames(gameData.seasonId).then(setSeasonGames).catch(() => setSeasonGames([]));

            const [homeTeamData, awayTeamData] = await Promise.all([
                api.getTeam(gameData.homeTeamId),
                api.getTeam(gameData.awayTeamId),
            ]);

            const allTeamsResponse = await fetch(`/api/v1/teams?seasonId=${gameData.seasonId}`);
            let homeRankStr = '';
            let awayRankStr = '';
            if (allTeamsResponse.ok) {
                const allTeams = await allTeamsResponse.json();
                allTeams.sort((a, b) => (b.points !== a.points ? b.points - a.points : b.wins - a.wins));
                const getRankString = (n) => {
                    const s = ['th', 'st', 'nd', 'rd'];
                    const v = n % 100;
                    return n + (s[(v - 20) % 10] || s[v] || s[0]);
                };
                const hIndex = allTeams.findIndex(t => t.id === gameData.homeTeamId);
                const aIndex = allTeams.findIndex(t => t.id === gameData.awayTeamId);
                if (hIndex !== -1) homeRankStr = getRankString(hIndex + 1);
                if (aIndex !== -1) awayRankStr = getRankString(aIndex + 1);
            }
            setHomeRank(homeRankStr);
            setAwayRank(awayRankStr);
            setHomeTeam(homeTeamData);
            setAwayTeam(awayTeamData);

            const sortPlayers = (players) => players.sort((a, b) =>
                (parseInt(a.jerseyNumber) || 999) - (parseInt(b.jerseyNumber) || 999));
            const [homePlayersData, awayPlayersData] = await Promise.all([
                api.getPlayers({ teamId: gameData.homeTeamId, seasonId: gameData.seasonId }),
                api.getPlayers({ teamId: gameData.awayTeamId, seasonId: gameData.seasonId }),
            ]);
            setHomeRoster(sortPlayers(homePlayersData));
            setAwayRoster(sortPlayers(awayPlayersData));

            const [goalie1Name, goalie2Name, ref1Name, ref2Name, skName] = await Promise.all([
                api.getUserPublicName(gameData.goalie1Id),
                api.getUserPublicName(gameData.goalie2Id),
                api.getUserPublicName(gameData.referee1Id),
                api.getUserPublicName(gameData.referee2Id),
                api.getUserPublicName(gameData.scorekeeperId),
            ]);
            setStaffNames({
                homeGoalie: goalie1Name,
                awayGoalie: goalie2Name,
                referee1: ref1Name,
                referee2: ref2Name,
                scorekeeper: skName,
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

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
    };

    const record = (t) => t
        ? `${(t.wins || 0) + (t.overtimeWins || 0)}-${t.losses || 0}-${t.overtimeLosses || 0}`
        : '—';

    const parseDate = (s) => new Date(s.endsWith('Z') ? s : s + 'Z');
    // Scope prev/next to the entry point: a team's own dashboard/schedule view
    // only steps through that team's games; the public Schedule page (no
    // fromTeamId in nav state) steps through every game in the season.
    const navTeamId = location.state?.fromTeamId;
    const scopedGames = navTeamId
        ? seasonGames.filter(g => g.homeTeamId === navTeamId || g.awayTeamId === navTeamId)
        : seasonGames;
    const sortedGames = [...scopedGames].sort((a, b) => parseDate(a.gameDate) - parseDate(b.gameDate));
    const gameIndex = sortedGames.findIndex(g => Number(g.id) === Number(gameId));
    const prevGame = gameIndex > 0 ? sortedGames[gameIndex - 1] : null;
    const nextGame = gameIndex !== -1 && gameIndex < sortedGames.length - 1 ? sortedGames[gameIndex + 1] : null;
    const navHref = (g) => `/game/${g.id}/${g.status === 'completed' ? 'recap' : 'preview'}`;

    if (loading) return <div className="obi-page obi-gd"><div className="obi-gd-msg">Loading game preview…</div></div>;
    if (error) return (
        <div className="obi-page obi-gd">
            <div className="obi-gd-msg">
                <p className="obi-neg">Error: {error}</p>
                <button className="obi-ghost-btn" onClick={() => navigate(-1)}>Go Back</button>
            </div>
        </div>
    );
    if (!game || !homeTeam || !awayTeam) return <div className="obi-page obi-gd"><div className="obi-gd-msg">Game details could not be found.</div></div>;

    const metaChips = [formatDate(game.gameDate), formatTime(game.gameDate), game.rink ? `${game.rink} Rink` : null, `Week ${game.week}`].filter(Boolean);

    const officials = [
        { label: 'Referee 1', value: staffNames?.referee1 },
        { label: 'Referee 2', value: staffNames?.referee2 },
        { label: 'Scorekeeper', value: staffNames?.scorekeeper },
    ];

    const renderTeamCard = (team, designation, rank, goalie) => {
        const color = resolveTeamColor(team.teamColor);
        return (
            <div className="obi-gd-teamcard">
                <div className="obi-gd-desig">{designation}</div>
                <Link
                    to={`/teams/${team.id}`}
                    className="obi-gd-teamchip"
                    style={{ background: color, color: textOn(team.teamColor) }}
                >
                    {team.name}
                </Link>
                <div className="obi-gd-record">{record(team)}</div>
                <div className="obi-gd-rank">{rank || '—'}</div>
                <div className="obi-gd-rank-label">Rank</div>
                <div className="obi-gd-divider" />
                <div className="obi-gd-goalie-label">Goalie</div>
                <div className={`obi-gd-goalie ${goalie ? '' : 'obi-unassigned'}`}>{goalie || 'Not Assigned'}</div>
            </div>
        );
    };

    const renderRoster = (roster, team, title) => (
        <div className="obi-roster-card">
            <div className="obi-roster-title">{title}</div>
            <div className="obi-roster-head">
                <span className="obi-roster-num">#</span>
                <span className="obi-roster-name">Player Name</span>
                <span className="obi-roster-pos">Pos</span>
            </div>
            {(!roster || roster.length === 0) ? (
                <div className="obi-roster-empty">No active roster</div>
            ) : roster.map(p => (
                <div key={p.id} className="obi-roster-row">
                    <span className="obi-roster-num">{p.jerseyNumber ?? '—'}</span>
                    <span className="obi-roster-name">
                        {p.firstName} {p.lastName}
                        {team.gmId === p.id && <span className="obi-mini-badge">GM</span>}
                        {p.skillRating >= 9 && <span className="obi-mini-badge obi-mini-2gl">2GL</span>}
                    </span>
                    <span className="obi-roster-pos">{p.position || '—'}</span>
                </div>
            ))}
        </div>
    );

    return (
        <div className="obi-page obi-gd">
            <section className="obi-page-hero">
                <img src={heroBg} alt="" className="obi-page-hero-bg" />
                <div className="obi-page-hero-overlay" />
                <div className="obi-page-hero-inner">
                    <button
                        className="obi-gd-back"
                        onClick={() => navigate(location.state?.from || (location.state?.fromDashboard ? '/dashboard' : '/schedule'))}
                    >
                        ← Back to {location.state?.backLabel || (location.state?.fromDashboard ? 'My Dashboard' : 'Schedule')}
                    </button>
                    <div className="obi-eyebrow">Matchup Preview</div>
                    <h1 className="obi-gd-title">
                        {homeTeam.name}<span className="obi-gd-title-vs">vs</span>{awayTeam.name}
                    </h1>
                </div>
            </section>

            <section className="obi-gd-body">
                <div className="obi-gd-detail">
                    <div className="obi-gd-navrow">
                        {prevGame ? (
                            <Link to={navHref(prevGame)} state={location.state} className="obi-gd-navlink obi-gd-navlink--prev">‹ Previous Game</Link>
                        ) : <span className="obi-gd-navlink-spacer" />}
                        <div className="obi-gd-chips">
                            {metaChips.map((c, i) => <span key={i} className="obi-gd-chip">{c}</span>)}
                        </div>
                        {nextGame ? (
                            <Link to={navHref(nextGame)} state={location.state} className="obi-gd-navlink obi-gd-navlink--next">Next Game ›</Link>
                        ) : <span className="obi-gd-navlink-spacer" />}
                    </div>

                    <div className="obi-gd-rule" />

                    <div className="obi-vs-grid">
                        {renderTeamCard(homeTeam, 'Home', homeRank, staffNames?.homeGoalie)}
                        <div className="obi-vs-mid"><span className="obi-vs-circle">VS</span></div>
                        {renderTeamCard(awayTeam, 'Away', awayRank, staffNames?.awayGoalie)}
                    </div>

                    <div className="obi-gd-rule" />

                    <div className="obi-gd-officials">
                        {officials.map(o => (
                            <div key={o.label} className="obi-gd-official">
                                <div className="obi-gd-official-label">{o.label}</div>
                                <div className={`obi-gd-official-value ${o.value ? '' : 'obi-unassigned'}`}>
                                    {o.value || 'Not Assigned'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="obi-roster-grid">
                    {renderRoster(homeRoster, homeTeam, 'Home Roster')}
                    {renderRoster(awayRoster, awayTeam, 'Away Roster')}
                </div>
            </section>
        </div>
    );
}

export default GamePreview;
