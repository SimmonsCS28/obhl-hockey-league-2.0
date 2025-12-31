import { useEffect, useState } from 'react';
import './TeamsPage.css';

function TeamsPage() {
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSeasons();
    }, []);

    useEffect(() => {
        if (selectedSeason) {
            fetchTeams(selectedSeason.id);
        }
    }, [selectedSeason]);

    const fetchSeasons = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/v1/seasons');
            if (!response.ok) throw new Error('Failed to fetch seasons');

            const data = await response.json();
            setSeasons(data);

            // Set active season as default
            const activeSeason = data.find(season => season.isActive);
            setSelectedSeason(activeSeason || data[0] || null);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const fetchTeams = async (seasonId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:8000/api/v1/teams?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch teams');

            const data = await response.json();
            setTeams(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSeasonChange = (event) => {
        const seasonId = parseInt(event.target.value);
        const season = seasons.find(s => s.id === seasonId);
        setSelectedSeason(season);
    };

    if (loading) return <div className="loading">Loading teams...</div>;
    if (error) return <div className="error">Error: {error}</div>;

    return (
        <div className="teams-page">
            <h1>Teams</h1>

            {selectedSeason && (
                <div className="season-selector">
                    <label htmlFor="season-select">Season:</label>
                    <select
                        id="season-select"
                        value={String(selectedSeason.id)}
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
                    {teams.map(team => (
                        <div key={team.id} className="team-card">
                            <div className="team-header" style={{ backgroundColor: team.teamColor || '#2d3748' }}>
                                <h2>{team.name}</h2>
                            </div>

                            <div className="team-info">
                                <div className="info-row">
                                    <span className="label">General Manager:</span>
                                    <span className="value">{team.gmName || 'Not assigned'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TeamsPage;
