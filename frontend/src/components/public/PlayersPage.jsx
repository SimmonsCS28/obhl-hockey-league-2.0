import { useEffect, useState } from 'react';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor } from '../../constants/teamColors';
import SeasonSelector from '../common/SeasonSelector';
import heroBg from '../../assets/images/buzzard-full.jpg';
import './PlayersPage.css';

function PlayersPage() {
    const { seasons, selectedSeason, selectedSeasonId, setSelectedSeasonId, resetToActiveSeason } = useSeason();
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Always open on the active season (the selection is app-global and otherwise sticks).
    useEffect(() => { resetToActiveSeason(); }, [resetToActiveSeason]);

    useEffect(() => {
        if (selectedSeasonId) {
            fetchPlayers(selectedSeasonId);
            fetchTeams(selectedSeasonId);
        }
    }, [selectedSeasonId]);

    const fetchPlayers = async (seasonId) => {
        try {
            setLoading(true);
            const response = await fetch(`/stats-api/players?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch players');
            setPlayers(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeams = async (seasonId) => {
        try {
            const response = await fetch(`/api/v1/teams?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch teams');
            setTeams(await response.json());
            setSelectedTeam('all');
        } catch (err) {
            console.error('Failed to fetch teams:', err);
        }
    };

    const teamById = (id) => teams.find(t => t.id === id);
    const teamName = (id) => teamById(id)?.name || 'Free Agent';

    // Column sorting — click-to-sort headers with an arrow (functional-only for now, design pass pending)
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

    const requestSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
        }));
    };

    const sortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const sortValue = (player, key) => {
        switch (key) {
            case 'jerseyNumber':
                return player.jerseyNumber ?? -1;
            case 'name':
                return `${(player.lastName || '').toLowerCase()} ${(player.firstName || '').toLowerCase()}`;
            case 'team':
                return teamName(player.teamId).toLowerCase();
            case 'position':
                return (player.position || '').toLowerCase();
            default:
                return 0;
        }
    };

    // Filter by team + search, then sort by the active column
    const filtered = players
        .filter(p => (selectedTeam === 'all' ? true : p.teamId === Number(selectedTeam)))
        .filter(p => {
            if (!searchQuery.trim()) return true;
            return `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.trim().toLowerCase());
        });

    const sorted = [...filtered].sort((a, b) => {
        const aVal = sortValue(a, sortConfig.key);
        const bVal = sortValue(b, sortConfig.key);
        if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
    });

    return (
        <div className="obi-page obi-players">
            <section className="obi-page-hero">
                <img src={heroBg} alt="" className="obi-page-hero-bg" />
                <div className="obi-page-hero-overlay" />
                <div className="obi-page-hero-inner">
                    <div className="obi-eyebrow">Old Buzzard Hockey League</div>
                    <h1 className="obi-page-title">PLAYERS</h1>
                    <p className="obi-page-sub">
                        {selectedSeason?.name || 'This season'} · {players.length} skaters &amp; goaltenders
                    </p>
                </div>
            </section>

            <section className="obi-players-body">
                <div className="obi-container">
                    {/* Controls */}
                    <div className="obi-players-controls">
                        {seasons?.length > 0 && (
                            <>
                                <SeasonSelector
                                    seasons={seasons}
                                    selectedSeasonId={selectedSeasonId}
                                    onChange={setSelectedSeasonId}
                                />
                                <span className="obi-players-divider" />
                            </>
                        )}
                        <div className="obi-search">
                            <span className="obi-search-icon">⌕</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search players…"
                                className="obi-search-input"
                            />
                        </div>
                        <span className="obi-showing obi-showing-push">
                            Showing <b>{sorted.length}</b> of {players.length}
                        </span>
                    </div>

                    {/* Team filter chips */}
                    <div className="obi-team-chips">
                        <button
                            className={`obi-chip ${selectedTeam === 'all' ? 'is-active' : ''}`}
                            onClick={() => setSelectedTeam('all')}
                        >
                            All Teams
                        </button>
                        {teams.map(team => (
                            <button
                                key={team.id}
                                className={`obi-chip ${selectedTeam === String(team.id) ? 'is-active' : ''}`}
                                onClick={() => setSelectedTeam(String(team.id))}
                            >
                                <span className="obi-chip-dot" style={{ background: resolveTeamColor(team.teamColor) }} />
                                {team.name}
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="obi-table-card">
                        <div className="obi-prow obi-prow-head">
                            <span
                                className="obi-pcol-num obi-pcol-sortable"
                                role="button" tabIndex={0}
                                onClick={() => requestSort('jerseyNumber')}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') requestSort('jerseyNumber'); }}
                            >#{sortIcon('jerseyNumber')}</span>
                            <span
                                className="obi-pcol-name obi-pcol-sortable"
                                role="button" tabIndex={0}
                                onClick={() => requestSort('name')}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') requestSort('name'); }}
                            >Player{sortIcon('name')}</span>
                            <span
                                className="obi-pcol-team obi-col-sm obi-pcol-sortable"
                                role="button" tabIndex={0}
                                onClick={() => requestSort('team')}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') requestSort('team'); }}
                            >Team{sortIcon('team')}</span>
                            <span
                                className="obi-pcol-pos obi-pcol-sortable"
                                role="button" tabIndex={0}
                                onClick={() => requestSort('position')}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') requestSort('position'); }}
                            >Position{sortIcon('position')}</span>
                        </div>

                        {loading ? (
                            <div className="obi-players-msg">Loading players…</div>
                        ) : error ? (
                            <div className="obi-players-msg obi-neg">Error: {error}</div>
                        ) : sorted.length === 0 ? (
                            <div className="obi-players-msg">No players match your search.</div>
                        ) : (
                            sorted.map(player => (
                                <div key={player.id} className="obi-prow">
                                    <span className="obi-pcol-num">{player.jerseyNumber ?? '—'}</span>
                                    <span className="obi-pcol-name">{player.firstName} {player.lastName}</span>
                                    <span className="obi-pcol-team obi-col-sm">
                                        <span className="obi-team-dot" style={{ background: resolveTeamColor(teamById(player.teamId)?.teamColor) }} />
                                        <span className="obi-pcol-team-name">{teamName(player.teamId)}</span>
                                    </span>
                                    <span className="obi-pcol-pos">
                                        <span className="obi-pos-badge">{player.position || 'N/A'}</span>
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

export default PlayersPage;
