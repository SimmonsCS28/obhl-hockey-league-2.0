import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import './TeamsPage.css';

function TeamsPage() {
    const navigate = useNavigate();
    const { seasons, selectedSeason, selectedSeasonId, setSelectedSeasonId } = useSeason();
    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (selectedSeasonId) {
            fetchTeams(selectedSeasonId);
            fetchPlayers(selectedSeasonId);
        }
    }, [selectedSeasonId]);


    const fetchTeams = async (seasonId) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/v1/teams?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch teams');

            const data = await response.json();
            setTeams(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayers = async (seasonId) => {
        try {
            const response = await fetch(`/stats-api/players?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch players');

            const data = await response.json();
            setPlayers(data);
        } catch (err) {
            console.error('Failed to fetch players:', err);
        }
    };

    const handleSeasonChange = (event) => {
        setSelectedSeasonId(Number(event.target.value));
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

    const getGMName = (gmId) => {
        if (!gmId) return 'Not assigned';
        const gm = players.find(p => p.id === gmId);
        return gm ? `${gm.firstName} ${gm.lastName}` : 'Not assigned';
    };

    if (loading) return <div className="loading">Loading teams...</div>;
    if (error) return <div className="error">Error: {error}</div>;

    return (
        <>
            <div className="page-header-bar">
                <div className="page-header-inner centered">
                    <h1>Teams</h1>
                </div>
            </div>
            <div className="teams-page">

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
                <div className="teams-grid">
                    {teams.map(team => {
                        const bg = getValidColor(team.teamColor);
                        const textColor = getTextColor(bg);

                        return (
                            <div
                                key={team.id}
                                className="team-card clickable"
                                onClick={() => navigate(`/teams/${team.id}`)}
                            >
                                <div
                                    className="team-header"
                                    style={{
                                        backgroundColor: bg,
                                        color: textColor
                                    }}
                                >
                                    <h2>{team.name}</h2>
                                </div>

                                <div className="team-info">
                                    <div className="info-row">
                                        <span className="label">General Manager:</span>
                                        <span className="value">{getGMName(team.gmId)}</span>
                                    </div>
                                    <p className="click-hint">Click to view roster</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
        </>
    );
}

export default TeamsPage;
