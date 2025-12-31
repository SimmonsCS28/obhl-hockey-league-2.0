import { useEffect, useState } from 'react';
import './PlayersPage.css';

function PlayersPage() {
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState('all');
    const [sortField, setSortField] = useState('firstName');
    const [sortDirection, setSortDirection] = useState('asc');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSeasons();
    }, []);

    useEffect(() => {
        if (selectedSeason) {
            fetchPlayers(selectedSeason.id);
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

    const fetchPlayers = async (seasonId) => {
        try {
            setLoading(true);
            const response = await fetch(`http://localhost:8003/api/v1/players?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch players');

            const data = await response.json();
            setPlayers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeams = async (seasonId) => {
        try {
            const response = await fetch(`http://localhost:8000/api/v1/teams?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch teams');

            const data = await response.json();
            setTeams(data);
            setSelectedTeam('all'); // Reset team filter when season changes
        } catch (err) {
            console.error('Failed to fetch teams:', err);
        }
    };

    const handleSeasonChange = (event) => {
        const seasonId = parseInt(event.target.value);
        const season = seasons.find(s => s.id === seasonId);
        setSelectedSeason(season);
    };

    const handleTeamChange = (event) => {
        setSelectedTeam(event.target.value);
    };

    const getTeamName = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : 'Free Agent';
    };

    const isGM = (player) => {
        const team = teams.find(t => t.id === player.teamId);
        return team && team.gmId === player.id;
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Filter players by selected team
    const filteredPlayers = selectedTeam === 'all'
        ? players
        : selectedTeam === 'free-agent'
            ? players.filter(p => !p.teamId)
            : players.filter(p => p.teamId === parseInt(selectedTeam));

    // Sort filtered players
    const sortedPlayers = [...filteredPlayers].sort((a, b) => {
        let aValue, bValue;

        switch (sortField) {
            case 'firstName':
                aValue = a.firstName?.toLowerCase() || '';
                bValue = b.firstName?.toLowerCase() || '';
                break;
            case 'lastName':
                aValue = a.lastName?.toLowerCase() || '';
                bValue = b.lastName?.toLowerCase() || '';
                break;
            case 'position':
                aValue = a.position?.toLowerCase() || '';
                bValue = b.position?.toLowerCase() || '';
                break;
            case 'team':
                aValue = getTeamName(a.teamId).toLowerCase();
                bValue = getTeamName(b.teamId).toLowerCase();
                break;
            default:
                return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    if (loading) return <div className="loading">Loading players...</div>;
    if (error) return <div className="error">Error: {error}</div>;

    return (
        <div className="players-page">
            <h1>Players</h1>

            <div className="filters-container">
                {selectedSeason && (
                    <div className="filter-group">
                        <label htmlFor="season-select">Season:</label>
                        <select
                            id="season-select"
                            value={String(selectedSeason.id)}
                            onChange={handleSeasonChange}
                            className="filter-dropdown"
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

                <div className="filter-group">
                    <label htmlFor="team-select">Team:</label>
                    <select
                        id="team-select"
                        value={selectedTeam}
                        onChange={handleTeamChange}
                        className="filter-dropdown"
                    >
                        <option value="all">All Teams</option>
                        {teams.map(team => (
                            <option key={team.id} value={String(team.id)}>
                                {team.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {sortedPlayers.length === 0 ? (
                <div className="no-data">No players found for this selection.</div>
            ) : (
                <div className="players-table-container">
                    <table className="players-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('firstName')} className="sortable">
                                    First Name {sortField === 'firstName' && (sortDirection === 'asc' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => handleSort('lastName')} className="sortable">
                                    Last Name {sortField === 'lastName' && (sortDirection === 'asc' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => handleSort('position')} className="sortable">
                                    Position {sortField === 'position' && (sortDirection === 'asc' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => handleSort('team')} className="sortable">
                                    Team {sortField === 'team' && (sortDirection === 'asc' ? '▲' : '▼')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPlayers.map(player => (
                                <tr key={player.id}>
                                    <td>
                                        {player.firstName}
                                        {isGM(player) && <span className="gm-badge">GM</span>}
                                    </td>
                                    <td>{player.lastName}</td>
                                    <td>{player.position || 'N/A'}</td>
                                    <td>{getTeamName(player.teamId)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default PlayersPage;
