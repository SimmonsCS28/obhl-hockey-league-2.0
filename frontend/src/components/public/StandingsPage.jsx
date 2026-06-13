import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import './StandingsPage.css';

function StandingsPage() {
    const navigate = useNavigate();
    const { seasons, selectedSeason, selectedSeasonId, setSelectedSeasonId } = useSeason();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (selectedSeasonId) {
            fetchTeams(selectedSeasonId);
        }
    }, [selectedSeasonId]);


    const fetchTeams = async (seasonId) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/v1/teams?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch teams');

            const data = await response.json();

            // Sort teams by: 1) points (desc), 2) wins (desc), 3) goals against (asc), 4) goals for (desc)
            const sorted = data.sort((a, b) => {
                // Primary: Points (highest first)
                if (b.points !== a.points) {
                    return b.points - a.points;
                }
                // Tiebreaker 1: Wins (highest first)
                const bTotalWins = (b.wins || 0) + (b.overtimeWins || 0);
                const aTotalWins = (a.wins || 0) + (a.overtimeWins || 0);
                if (bTotalWins !== aTotalWins) {
                    return bTotalWins - aTotalWins;
                }
                // Tiebreaker 2: Goals Against (lowest first - fewer goals against is better)
                if (a.goalsAgainst !== b.goalsAgainst) {
                    return a.goalsAgainst - b.goalsAgainst;
                }
                // Tiebreaker 3: Goals For (highest first)
                return b.goalsFor - a.goalsFor;
            });

            setTeams(sorted);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSeasonChange = (event) => {
        setSelectedSeasonId(Number(event.target.value));
    };

    const calculateGoalDiff = (team) => {
        return team.goalsFor - team.goalsAgainst;
    };

    // Helper to get valid CSS color
    const getValidColor = (color) => {
        if (!color) return '#95a5a6';

        // Map truncated DB values to valid CSS colors
        const colorMap = {
            'Lt. Blu': '#87CEEB', // SkyBlue
            'Dk. Gre': '#006400', // DarkGreen
            'White': '#FFFFFF',
            'Yellow': '#FFD700',
            'Gold': '#FFD700'
        };

        return colorMap[color] || color;
    };

    // Helper to determine text color based on background
    const getTextColor = (bgColor) => {
        if (!bgColor) return 'white';

        const lightColors = [
            'White', '#FFFFFF',
            'Yellow', '#FFD700',
            'Gold',
            'Lt. Blu', '#87CEEB', 'LightBlue'
        ];

        // Check if color is in light list (case insensitive)
        const isLight = lightColors.some(c =>
            c.toLowerCase() === bgColor.toLowerCase()
        );

        return isLight ? '#2c3e50' : 'white';
    };

    if (loading) return <div className="loading">Loading standings...</div>;
    if (error) return <div className="error">Error: {error}</div>;

    return (
        <>
            <div className="page-header-bar">
                <div className="page-header-inner centered">
                    <h1>Standings</h1>
                </div>
            </div>
            <div className="standings-page">

            {selectedSeason && (
                <div className="season-selector">

                    <select
                        id="season-select"
                        value={String(selectedSeasonId || '')}
                        onChange={handleSeasonChange}
                        className="season-dropdown"
                    >
                        {seasons.map(season => (
                            <option
                                key={season.id}
                                value={String(season.id)}
                            >
                                {season.name} {season.isActive ? '(Active)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {teams.length === 0 ? (
                <div className="no-data">No teams found for this season.</div>
            ) : (
                <div className="standings-table-container">
                    <table className="standings-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Team</th>
                                <th>Pts</th>
                                <th>W</th>
                                <th>L</th>
                                <th>T</th>
                                <th>OTL</th>
                                <th>GF</th>
                                <th>GA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teams.map((team, index) => {
                                const bg = getValidColor(team.teamColor);
                                const textColor = getTextColor(bg);

                                return (
                                    <tr
                                        key={team.id}
                                        className="clickable-row"
                                        onClick={() => navigate(`/teams/${team.id}`)}
                                        title="Click to view team roster"
                                    >
                                        <td
                                            className="rank"
                                            style={{ backgroundColor: bg, color: textColor }}
                                        >
                                            {index + 1}
                                        </td>
                                        <td className="team-name">
                                            <strong>{team.name}</strong>
                                        </td>
                                        <td className="points"><strong>{team.points}</strong></td>
                                        <td>{team.wins + (team.overtimeWins || 0)}</td>
                                        <td>{team.losses}</td>
                                        <td>{team.ties}</td>
                                        <td>{team.overtimeLosses}</td>
                                        <td>{team.goalsFor}</td>
                                        <td>{team.goalsAgainst}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        </>
    );
}

export default StandingsPage;
