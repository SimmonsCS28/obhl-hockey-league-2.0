import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './TeamRosterPage.css';

function TeamRosterPage() {
    const { teamId } = useParams();
    const navigate = useNavigate();
    const [team, setTeam] = useState(null);
    const [roster, setRoster] = useState([]);
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
                        <span className="stat-value">{team.wins}</span>
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
        </div>
    );
}

export default TeamRosterPage;
