import { useEffect, useState } from 'react';
import './SeasonsPage.css';

function SeasonsPage() {
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSeasons();
    }, []);

    const fetchSeasons = async () => {
        try {
            const response = await fetch('http://44.193.17.173:8000/api/v1/seasons');
            if (!response.ok) throw new Error('Failed to fetch seasons');

            const data = await response.json();
            setSeasons(data);

            // Set active season as default, or first season if no active
            const activeSeason = data.find(season => season.isActive);
            setSelectedSeason(activeSeason || data[0] || null);
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

    if (loading) return <div className="loading">Loading seasons...</div>;
    if (error) return <div className="error">Error: {error}</div>;
    if (seasons.length === 0) return <div className="no-data">No seasons available.</div>;

    return (
        <div className="seasons-page">
            <h1>Seasons</h1>

            {selectedSeason && (
                <div className="season-selector">
                    <label htmlFor="season-select">Select Season:</label>
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

            {selectedSeason && (
                <div className="season-details">
                    <div className="season-header">
                        <h2>{selectedSeason.name}</h2>
                        {selectedSeason.isActive && (
                            <span className="active-badge">Active Season</span>
                        )}
                    </div>

                    <div className="season-info-grid">
                        <div className="info-card">
                            <h3>Status</h3>
                            <p className="status-value">{selectedSeason.status}</p>
                        </div>

                        <div className="info-card">
                            <h3>Start Date</h3>
                            <p>{new Date(selectedSeason.startDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}</p>
                        </div>

                        <div className="info-card">
                            <h3>End Date</h3>
                            <p>{new Date(selectedSeason.endDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}</p>
                        </div>

                        <div className="info-card">
                            <h3>Duration</h3>
                            <p>{calculateDuration(selectedSeason.startDate, selectedSeason.endDate)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function calculateDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;

    if (months > 0) {
        return `${months} month${months > 1 ? 's' : ''}, ${days} day${days !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''}`;
}

export default SeasonsPage;
