import { useSeason } from '../../contexts/SeasonContext';
import './SeasonsPage.css';

function SeasonsPage() {
    const { seasons, selectedSeason, selectedSeasonId, setSelectedSeasonId } = useSeason();

    const handleSeasonChange = (event) => {
        setSelectedSeasonId(Number(event.target.value));
    };

    // Format date string (YYYY-MM-DD) without timezone conversion
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (seasons.length === 0) return <div className="no-data">No seasons available.</div>;

    return (
        <>
            <div className="page-header-bar">
                <div className="page-header-inner centered">
                    <h1>Seasons</h1>
                </div>
            </div>
            <div className="seasons-page">

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
                            <p>{formatDate(selectedSeason.startDate)}</p>
                        </div>

                        <div className="info-card">
                            <h3>End Date</h3>
                            <p>{formatDate(selectedSeason.endDate)}</p>
                        </div>

                        <div className="info-card">
                            <h3>Duration</h3>
                            <p>{calculateDuration(selectedSeason.startDate, selectedSeason.endDate)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
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
