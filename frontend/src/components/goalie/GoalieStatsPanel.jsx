import { useEffect, useState } from 'react';
import api from '../../services/api';
import { resolveTeamColor } from '../../constants/teamColors';
import './GoalieStatsPanel.css';

const SORT_DEFAULT_DIR = { name: 'asc', gaa: 'asc', rating: 'desc' };

function ratingBand(rating) {
    if (rating == null) return 'unrated';
    if (rating <= 4) return 'low';
    if (rating <= 7) return 'mid';
    return 'high';
}

function ratingLabel(rating) {
    return rating == null ? 'Not Rated' : String(rating);
}

function sortValue(g, key) {
    if (key === 'name') return (g.name || '').toLowerCase();
    if (key === 'gaa') return g.gaa;
    return g.rating == null ? -1 : g.rating; // rating
}

function GoalieStatsPanel({ seasonId, canEdit }) {
    const [goalies, setGoalies] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
    const [selectedId, setSelectedId] = useState(null);
    const [savingRating, setSavingRating] = useState(false);

    useEffect(() => {
        if (!seasonId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        Promise.all([api.getGoaliePerformance(seasonId), api.getTeams()])
            .then(([perf, teamList]) => {
                if (cancelled) return;
                setGoalies(perf || []);
                setTeams(teamList || []);
            })
            .catch((e) => {
                if (!cancelled) setError(e.message || 'Failed to load goalie stats');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [seasonId]);

    const teamById = (id) => teams.find((t) => t.id === id);

    const filtered = goalies.filter((g) =>
        (g.name || '').toLowerCase().includes(query.toLowerCase())
    );

    const sorted = [...filtered].sort((a, b) => {
        const av = sortValue(a, sort.key);
        const bv = sortValue(b, sort.key);
        if (sort.key === 'gaa') {
            // Goalies with no games played (no GAA) always sort last.
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
        }
        if (av < bv) return sort.dir === 'asc' ? -1 : 1;
        if (av > bv) return sort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSortClick = (key) => {
        setSort((s) => (s.key === key
            ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: SORT_DEFAULT_DIR[key] }));
    };

    const selected = selectedId != null ? goalies.find((g) => g.playerId === selectedId) : null;

    const applyRating = async (playerId, nextRating) => {
        setSavingRating(true);
        try {
            await api.updateGoalieRating(playerId, nextRating);
            const refreshed = await api.getGoaliePerformance(seasonId);
            setGoalies(refreshed || []);
        } catch (e) {
            setError(e.message || 'Failed to update rating');
        } finally {
            setSavingRating(false);
        }
    };

    if (loading) {
        return <div className="gp-empty">Loading goalie stats&hellip;</div>;
    }
    if (error) {
        return <div className="gp-empty gp-empty-error">{error}</div>;
    }

    if (selected) {
        const wins5 = (selected.last5 || []).filter((g) => g.result === 'W').length;
        const losses5 = (selected.last5 || []).filter((g) => g.result === 'L').length;
        const band = ratingBand(selected.rating);

        return (
            <div className="gp-panel">
                <button className="gp-back" onClick={() => setSelectedId(null)}>&larr; All Goalies</button>

                <div className="gp-detail-header">
                    <div className="gp-detail-name-card">
                        <h3 className="gp-detail-name">{selected.name}</h3>
                        <div className="gp-detail-record">
                            {wins5}-{losses5} in last 5 &middot; {selected.gp} GP this season
                        </div>
                        <div className="gp-dots">
                            {(selected.last5 || []).map((g, i) => (
                                <span key={i} className={`gp-dot gp-dot-${g.result === 'W' ? 'win' : g.result === 'L' ? 'loss' : 'tie'}`}>
                                    {g.result || '-'}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="gp-stat-tile">
                        <span className="gp-stat-value">{selected.gaa != null ? selected.gaa.toFixed(2) : '—'}</span>
                        <span className="gp-stat-label">Season GAA</span>
                    </div>

                    <div className="gp-stat-tile gp-rating-tile">
                        <span className="gp-stat-label">Coordinator Rating</span>
                        {canEdit ? (
                            selected.rating != null ? (
                                <>
                                    <div className="gp-stepper">
                                        <button
                                            disabled={savingRating}
                                            onClick={() => applyRating(selected.playerId, Math.max(0, selected.rating - 1))}
                                        >&minus;</button>
                                        <span className={`gp-stepper-value gp-rating-${band}`}>{selected.rating}</span>
                                        <button
                                            disabled={savingRating}
                                            onClick={() => applyRating(selected.playerId, Math.min(10, selected.rating + 1))}
                                        >+</button>
                                    </div>
                                    <button
                                        className="gp-clear-rating"
                                        disabled={savingRating}
                                        onClick={() => applyRating(selected.playerId, null)}
                                    >clear rating</button>
                                </>
                            ) : (
                                <button
                                    className="gp-add-rating"
                                    disabled={savingRating}
                                    onClick={() => applyRating(selected.playerId, 5)}
                                >+ Add Rating</button>
                            )
                        ) : (
                            <span className={`gp-rating-pill gp-rating-${band}`}>{ratingLabel(selected.rating)}</span>
                        )}
                    </div>
                </div>

                <div className="gp-games-heading">Last 5 Games</div>
                <div className="gp-games-list">
                    {(selected.last5 || []).length === 0 && (
                        <div className="gp-empty">No completed games yet this season.</div>
                    )}
                    {(selected.last5 || []).map((g) => {
                        const team = teamById(g.teamId);
                        const opp = teamById(g.oppTeamId);
                        return (
                            <div className="gp-game-row" key={g.gameId}>
                                <span className="gp-game-date">
                                    {g.date ? new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                </span>
                                <span className="gp-game-team">
                                    <span className="gp-team-dot" style={{ background: resolveTeamColor(team?.teamColor) }} />
                                    {team?.name || 'Free Agent'}
                                </span>
                                <span className="gp-game-vs">VS</span>
                                <span className="gp-game-team">
                                    <span className="gp-team-dot" style={{ background: resolveTeamColor(opp?.teamColor) }} />
                                    {opp?.name || 'Free Agent'}
                                </span>
                                <span className="gp-game-opp-goalie">vs {g.oppGoalieName}</span>
                                <span className="gp-game-score">{g.gf}-{g.ga}</span>
                                <span className={`gp-result-pill gp-result-${g.result === 'W' ? 'win' : g.result === 'L' ? 'loss' : 'tie'}`}>
                                    {g.result || '-'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="gp-panel">
            <div className="gp-controls">
                <input
                    type="text"
                    className="gp-search"
                    placeholder="Search goalies&hellip;"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <div className="gp-sort">
                    <span className="gp-sort-label">Sort</span>
                    {['name', 'gaa', 'rating'].map((key) => {
                        const active = sort.key === key;
                        const label = key === 'name' ? 'Name' : key === 'gaa' ? 'GAA' : 'Rating';
                        return (
                            <button
                                key={key}
                                className={`gp-sort-btn${active ? ' is-active' : ''}`}
                                onClick={() => handleSortClick(key)}
                            >
                                {label}{active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                        );
                    })}
                </div>
                <span className="gp-count">Showing <b>{sorted.length}</b> of {goalies.length} goalies</span>
            </div>

            {sorted.length === 0 ? (
                <div className="gp-empty">No goalies match your search.</div>
            ) : (
                <div className="gp-grid">
                    {sorted.map((g) => {
                        const band = ratingBand(g.rating);
                        return (
                            <div className="gp-card" key={g.playerId} onClick={() => setSelectedId(g.playerId)}>
                                <div className="gp-card-top">
                                    <span className="gp-card-name">{g.name}</span>
                                    <span className={`gp-rating-pill gp-rating-${band}`}>{ratingLabel(g.rating)}</span>
                                </div>
                                <div className="gp-card-stats">
                                    <div>
                                        <div className="gp-card-stat-value">{g.gaa != null ? g.gaa.toFixed(2) : '—'}</div>
                                        <div className="gp-card-stat-label">Season GAA</div>
                                    </div>
                                    <div>
                                        <div className="gp-card-stat-value">{g.gp}</div>
                                        <div className="gp-card-stat-label">Games</div>
                                    </div>
                                </div>
                                <div className="gp-card-bottom">
                                    <div className="gp-dots">
                                        {(g.last5 || []).map((line, i) => (
                                            <span key={i} className={`gp-dot gp-dot-${line.result === 'W' ? 'win' : line.result === 'L' ? 'loss' : 'tie'}`}>
                                                {line.result || '-'}
                                            </span>
                                        ))}
                                    </div>
                                    <span className="gp-detail-link">Detail &rarr;</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default GoalieStatsPanel;
