import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TeamBadge from '../common/TeamBadge';
import './TeamRosterPage.css';

function TeamRosterPage() {
    const { teamId } = useParams();
    const navigate = useNavigate();
    const [team, setTeam] = useState(null);
    const [roster, setRoster] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [leagueTeams, setLeagueTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (teamId) {
            fetchTeamData();
        }
    }, [teamId]);

    const fetchTeamData = async () => {
        try {
            setLoading(true);

            // First fetch the team to get seasonId
            const teamResponse = await fetch(`/api/v1/teams/${teamId}`);
            if (!teamResponse.ok) throw new Error('Failed to fetch team');
            const teamData = await teamResponse.json();
            setTeam(teamData);

            // Fetch all teams to support team badge lookups
            const allTeamsResponse = await fetch('/api/v1/teams');
            if (allTeamsResponse.ok) {
                const allTeams = await allTeamsResponse.json();
                setLeagueTeams(allTeams);
            }

            // Fetch schedule for this team
            const gamesResponse = await fetch(`/games-api/games?seasonId=${teamData.seasonId}`);
            if (gamesResponse.ok) {
                const gamesData = await gamesResponse.json();
                const teamGames = gamesData.filter(g => g.homeTeamId === parseInt(teamId) || g.awayTeamId === parseInt(teamId));
                teamGames.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
                setSchedule(teamGames);
            }

            // Then fetch all players for that season and filter by teamId
            const playersResponse = await fetch(`/stats-api/players?seasonId=${teamData.seasonId}`);
            if (!playersResponse.ok) throw new Error('Failed to fetch players');
            const playersData = await playersResponse.json();

            // Filter to only players on this team and sort by jersey number
            const teamPlayers = playersData
                .filter(p => p.teamId === parseInt(teamId))
                .sort((a, b) => {
                    const jerseyA = parseInt(a.jerseyNumber) || 999;
                    const jerseyB = parseInt(b.jerseyNumber) || 999;
                    return jerseyA - jerseyB;
                });

            setRoster(teamPlayers);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
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
        const lightColors = ['White', '#FFFFFF', 'Yellow', '#FFD700', 'Gold', 'Lt. Blu', '#87CEEB', 'LightBlue'];
        const isLight = lightColors.some(c => c.toLowerCase() === bgColor.toLowerCase());
        return isLight ? '#2c3e50' : 'white';
    };

    if (loading) return <div className="loading">Loading team details...</div>;
    if (error) return <div className="error">Error: {error}</div>;
    if (!team) return <div className="error">Team not found</div>;

    const bg = getValidColor(team.teamColor);
    const textColor = getTextColor(bg);

    // Find GM from roster
    const gm = roster.find(player => player.id === team.gmId);
    const gmName = gm ? `${gm.firstName} ${gm.lastName}` : 'TBD';

    return (
        <div className="team-roster-page">
            <button onClick={() => navigate(-1)} className="btn-back">
                ← Back
            </button>

            <div className="roster-header" style={{ backgroundColor: bg, color: textColor }}>
                <h1>{team.name}</h1>
                <p className="gm-info">GM: {gmName}</p>
                <div className="team-stats-display">
                    <div className="stat-item">
                        <span className="stat-label">W</span>
                        <span className="stat-value">{team.wins + (team.overtimeWins || 0)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">L</span>
                        <span className="stat-value">{team.losses}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">T</span>
                        <span className="stat-value">{team.ties || 0}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">OTL</span>
                        <span className="stat-value">{team.overtimeLosses || 0}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">GF</span>
                        <span className="stat-value">{team.goalsFor || 0}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">GA</span>
                        <span className="stat-value">{team.goalsAgainst || 0}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">DIFF</span>
                        <span className="stat-value">{(team.goalsFor || 0) - (team.goalsAgainst || 0)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">PTS</span>
                        <span className="stat-value">{team.points}</span>
                    </div>
                </div>
            </div>

            <div className="roster-content">
                <h2>Current Roster</h2>
                {roster.length === 0 ? (
                    <p className="no-roster">No players on roster</p>
                ) : (
                    <table className="roster-table">
                        <thead>
                            <tr>
                                <th>Jersey #</th>
                                <th>Name</th>
                                <th>Position</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roster.map(player => (
                                <tr key={player.id}>
                                    <td>{player.jerseyNumber}</td>
                                    <td>
                                        {player.firstName} {player.lastName}
                                        {team.gmId === player.id && <span className="gm-badge">GM</span>}
                                        {player.skillRating >= 9 && <span className="twogl-badge">2GL</span>}
                                    </td>
                                    <td>{player.position}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="team-schedule-content" style={{ marginTop: '2rem' }}>
                <h2>Team Schedule</h2>
                {schedule.length === 0 ? (
                    <p className="no-roster">No games scheduled for this team.</p>
                ) : (
                    <div className="schedule-table-container">
                        <table className="roster-table schedule-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Opponent</th>
                                    <th>Result</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schedule.map(game => {
                                    const isHomeGame = game.homeTeamId === parseInt(teamId);
                                    const opponentId = isHomeGame ? game.awayTeamId : game.homeTeamId;
                                    const opponentTeam = leagueTeams.find(t => t.id === opponentId) || {};
                                    const opponentName = opponentTeam.name || 'Unknown';
                                    const opponentColor = opponentTeam.teamColor || null;

                                    const isCompleted = game.gameStatus === 'COMPLETED';
                                    const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');

                                    let result = '-';
                                    if (isCompleted) {
                                        const myScore = isHomeGame ? game.homeScore : game.awayScore;
                                        const oppScore = isHomeGame ? game.awayScore : game.homeScore;
                                        const wl = myScore > oppScore ? 'W' : (myScore < oppScore ? 'L' : 'T');
                                        result = `${wl} ${myScore}-${oppScore}`;
                                        if (game.endedInOT) result += ' (OT)';
                                    } else {
                                        result = 'Scheduled';
                                    }

                                    return (
                                        <tr key={game.id}>
                                            <td>{gameDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}<br />{gameDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <TeamBadge
                                                        teamName={opponentName}
                                                        teamColor={opponentColor}
                                                        onClick={() => navigate(`/teams/${opponentId}`)}
                                                        style={{ cursor: 'pointer', margin: 0 }}
                                                    />
                                                    <span style={{ fontSize: '0.85em', color: '#aaa', fontWeight: 'bold' }}>
                                                        {isHomeGame ? '(H)' : '(A)'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`result-badge ${result.startsWith('W') ? 'win' : result.startsWith('L') ? 'loss' : ''}`}>{result}</span>
                                            </td>
                                            <td>
                                                {isCompleted ? (
                                                    <Link to={`/game/${game.id}/recap`} state={{ fromTeamId: teamId }} className="btn-action-small preview-btn">Recap</Link>
                                                ) : (
                                                    <Link to={`/game/${game.id}/preview`} state={{ fromTeamId: teamId }} className="btn-action-small preview-btn">Preview</Link>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TeamRosterPage;
