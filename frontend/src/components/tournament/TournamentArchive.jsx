import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import tournamentApi from '../../services/tournamentApi';
import './TournamentPages.css';

/**
 * Past Classics.
 *
 * Standalone rather than inside TournamentLayout's tournament context: it lists tournaments rather
 * than showing one, so it must not require a resolved tournament to render.
 */
function TournamentArchive() {
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        tournamentApi.list()
            .then(d => { if (!cancelled) setTournaments(d); })
            .catch(e => { if (!cancelled) setError(e.message || 'Failed to load'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    return (
        <>
            <div className="tcc-head">
                <div className="tcc-head-inner">
                    <div className="tcc-eyebrow">Every Classic</div>
                    <h1 className="tcc-h1">Archive</h1>
                    <p className="tcc-sub">
                        The Conley Classic runs once a year. Each one has its own field, its own bracket
                        and its own champion.
                    </p>
                </div>
            </div>

            <div className="tcc-container tcc-section">
                {loading && <div className="tcc-empty">Loading…</div>}
                {error && <div className="tcc-empty">{error}</div>}
                {!loading && !error && tournaments.length === 0 && (
                    <div className="tcc-empty">
                        <div className="tcc-empty-title">Nothing archived yet</div>
                        The first Classic hasn&rsquo;t been published.
                    </div>
                )}

                <div className="tcc-archive-list">
                    {tournaments.map(t => (
                        <Link key={t.id} to={`/tournaments/${t.slug}`} className="tcc-archive-row">
                            <span className="tcc-archive-year">{t.year}</span>
                            <span className="tcc-archive-main">
                                <span className="tcc-archive-name">{t.name}</span>
                                {t.tagline && <span className="tcc-archive-tag">{t.tagline}</span>}
                            </span>
                            <span className="tcc-archive-meta">
                                {t.teamCount} teams
                                {t.status === 'completed' ? ' · Complete' : ` · ${t.status}`}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    );
}

export default TournamentArchive;
