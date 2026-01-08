import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
    const [activeSeason, setActiveSeason] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchActiveSeason();
    }, []);

    const fetchActiveSeason = async () => {
        try {
            const response = await fetch('http://44.193.17.173:8000/api/v1/seasons');
            if (!response.ok) throw new Error('Failed to fetch seasons');

            const seasons = await response.json();
            const active = seasons.find(season => season.isActive);
            setActiveSeason(active);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (error) return <div className="error">Error: {error}</div>;

    return (
        <div className="home-container">
            <section className="hero-section">
                <h1>Welcome to OBHL</h1>
                <p className="tagline">Old Buzzard Hockey League</p>
            </section>

            {activeSeason && (
                <section className="active-season-section">
                    <h2>Current Season: {activeSeason.name}</h2>
                    <div className="season-info">
                        <p><strong>Status:</strong> {activeSeason.status}</p>
                        <p><strong>Start Date:</strong> {activeSeason.startDate}</p>
                        <p><strong>End Date:</strong> {activeSeason.endDate}</p>
                    </div>

                    <div className="quick-links">
                        <Link to="/standings" className="quick-link-card">
                            <h3>Standings</h3>
                            <p>View current team rankings</p>
                        </Link>
                        <Link to="/schedule" className="quick-link-card">
                            <h3>Schedule</h3>
                            <p>Check upcoming games</p>
                        </Link>
                        <Link to="/teams" className="quick-link-card">
                            <h3>Teams</h3>
                            <p>Browse all teams</p>
                        </Link>
                        <Link to="/players" className="quick-link-card">
                            <h3>Players</h3>
                            <p>View player stats</p>
                        </Link>
                    </div>
                </section>
            )}

            {!activeSeason && (
                <section className="no-season-section">
                    <p>No active season at this time. Check back soon!</p>
                </section>
            )}
        </div>
    );
}

export default Home;
