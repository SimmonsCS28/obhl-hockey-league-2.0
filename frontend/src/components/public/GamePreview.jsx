import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import * as api from '../../services/api';
import TeamBadge from '../common/TeamBadge';
import './GamePreview.css';

function GamePreview() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const fromTeamId = location.state?.fromTeamId;

    const [game, setGame] = useState(null);
    const [homeTeam, setHomeTeam] = useState(null);
    const [awayTeam, setAwayTeam] = useState(null);
    const [homeRank, setHomeRank] = useState('');
    const [awayRank, setAwayRank] = useState('');
    const [homeRoster, setHomeRoster] = useState([]);
    const [awayRoster, setAwayRoster] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (gameId) {
            fetchPreviewData();
        }
    }, [gameId]);

    const fetchPreviewData = async () => {
        try {
            setLoading(true);

            // Fetch game
            const gameData = await api.getGame(gameId);
            setGame(gameData);

            if (!gameData) throw new Error('Game not found');

            // Fetch teams
            const [homeTeamData, awayTeamData] = await Promise.all([
                api.getTeam(gameData.homeTeamId),
                api.getTeam(gameData.awayTeamId)
            ]);

            // Fetch and sort all teams in season to determine rank
            const allTeamsResponse = await fetch(`/api/v1/teams?seasonId=${gameData.seasonId}`);
            let homeRankStr = '';
            let awayRankStr = '';

            if (allTeamsResponse.ok) {
                const allTeams = await allTeamsResponse.json();
                allTeams.sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    return b.wins - a.wins;
                });

                const getRankString = (n) => {
                    const s = ["th", "st", "nd", "rd"];
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

            // Fetch players for the season
            const playersResponse = await fetch(`/stats-api/players?seasonId=${gameData.seasonId}`);
            if (!playersResponse.ok) throw new Error('Failed to fetch players');
            const playersData = await playersResponse.json();

            // Filter players to home/away rosters and sort by jersey
            const sortPlayers = (players) => {
                return players.sort((a, b) => {
                    const jerseyA = parseInt(a.jerseyNumber) || 999;
                    const jerseyB = parseInt(b.jerseyNumber) || 999;
                    return jerseyA - jerseyB;
                });
            };

            setHomeRoster(sortPlayers(playersData.filter(p => p.teamId === gameData.homeTeamId)));
            setAwayRoster(sortPlayers(playersData.filter(p => p.teamId === gameData.awayTeamId)));

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const formatTime = (timeString) => {
        if (!timeString) return '';
        // If it's a full ISO string
        if (timeString.includes('T')) {
            const date = new Date(timeString);
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        // If it's just 'HH:mm:ss'
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    if (loading) return <div className="game-preview-container"><div className="loading">Loading Game Preview...</div></div>;
    if (error) return <div className="game-preview-container"><div className="error-container"><h2>Error Loading Preview</h2><p>{error}</p><button onClick={() => navigate(-1)} className="btn-back">Go Back</button></div></div>;
    if (!game || !homeTeam || !awayTeam) return <div className="game-preview-container"><div className="error-container">Game details could not be found.</div></div>;

    const renderRosterTable = (roster, team) => {
        if (!roster || roster.length === 0) {
            return <p className="no-roster">No active roster</p>;
        }

        return (
            <table className="roster-table condensed">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Player Name</th>
                        <th className="hide-mobile">Pos</th>
                    </tr>
                </thead>
                <tbody>
                    {roster.map(player => (
                        <tr key={player.id}>
                            <td>{player.jerseyNumber}</td>
                            <td>
                                {player.firstName} {player.lastName}
                                {team.gmId === player.id && <span className="gm-badge mini">GM</span>}
                                {player.skillRating >= 9 && <span className="twogl-badge mini">2GL</span>}
                            </td>
                            <td className="hide-mobile">{player.position}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <div className="game-preview-container">
            <div className="preview-nav">
                <button onClick={() => navigate(-1)} className="btn-back">
                    ← Back to {fromTeamId ? 'Team' : location.state?.fromDashboard ? 'My Dashboard' : 'Schedule'}
                </button>
            </div>

            <div className="preview-header">
                <div className="preview-sup-header">
                    <h2>Game Preview</h2>
                    <div className="game-logistics">
                        <span className="logistics-item">{formatDate(game.gameDate)}</span>
                        <span className="logistics-item">{formatTime(game.gameDate)}</span>
                        <span className="logistics-item">{game.rink} Rink</span>
                        <span className="logistics-item">Week {game.week}</span>
                    </div>
                </div>

                <div className="matchup-container">
                    {/* Home Team */}
                    <div className="team-column home-team">
                        <div className="team-identity">
                            <span className="designation">HOME</span>
                            <Link to={`/teams/${homeTeam.id}`} className="team-link">
                                <TeamBadge teamName={homeTeam.name} teamColor={homeTeam.teamColor} style={{ fontSize: '1.2rem', padding: '10px 20px' }} />
                            </Link>
                            <div className="team-record">
                                {homeTeam.wins + (homeTeam.overtimeWins || 0)}-{homeTeam.losses}-{homeTeam.ties || 0}-{homeTeam.overtimeLosses || 0}
                            </div>
                            <div className="team-rank">
                                <div className="rank-value">{homeRank || '-'}</div>
                                <div className="rank-label">RANK</div>
                            </div>
                        </div>
                    </div>

                    <div className="matchup-vs">
                        <span className="vs-circle">VS</span>
                    </div>

                    {/* Away Team */}
                    <div className="team-column away-team">
                        <div className="team-identity">
                            <span className="designation">AWAY</span>
                            <Link to={`/teams/${awayTeam.id}`} className="team-link">
                                <TeamBadge teamName={awayTeam.name} teamColor={awayTeam.teamColor} style={{ fontSize: '1.2rem', padding: '10px 20px' }} />
                            </Link>
                            <div className="team-record">
                                {awayTeam.wins + (awayTeam.overtimeWins || 0)}-{awayTeam.losses}-{awayTeam.ties || 0}-{awayTeam.overtimeLosses || 0}
                            </div>
                            <div className="team-rank">
                                <div className="rank-value">{awayRank || '-'}</div>
                                <div className="rank-label">RANK</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rosters-comparison">
                <div className="roster-column">
                    <h4>Home Roster</h4>
                    {renderRosterTable(homeRoster, homeTeam)}
                </div>
                <div className="roster-column">
                    <h4>Away Roster</h4>
                    {renderRosterTable(awayRoster, awayTeam)}
                </div>
            </div>
        </div>
    );
}

export default GamePreview;
