import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import TeamBadge from '../common/TeamBadge';
import './GMTeam.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

function GMTeam() {
    const { user } = useAuth();
    const [roster, setRoster] = useState([]);
    const [teamInfo, setTeamInfo] = useState(null);
    const [playerStats, setPlayerStats] = useState({});
    const [editedPlayers, setEditedPlayers] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'jerseyNumber', direction: 'ascending' });

    useEffect(() => {
        if (user?.teamId) {
            fetchAll();
        }
    }, [user]);

    const fetchAll = async () => {
        try {
            // Fetch roster and team info in parallel
            const [rosterRes, teamRes, seasonsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/gm/team/${user.teamId}/roster`, {
                    headers: getAuthHeaders(),
                }),
                axios.get(`${API_BASE_URL}/teams/${user.teamId}`, {
                    headers: getAuthHeaders(),
                }),
                axios.get(`${API_BASE_URL}/seasons`),
            ]);

            setRoster(rosterRes.data);
            setTeamInfo(teamRes.data);

            // Get active season and fetch stats
            const activeSeason = seasonsRes.data.find(s => s.isActive);
            if (activeSeason) {
                await fetchPlayerStats(activeSeason.id);
            }
        } catch (error) {
            console.error('Failed to load team data:', error);
            showMessage('error', 'Failed to load team data');
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayerStats = async (seasonId) => {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/stats/players?seasonId=${seasonId}&teamId=${user.teamId}`,
                { headers: getAuthHeaders() }
            );
            const statsMap = {};
            (response.data || []).forEach(stat => {
                statsMap[stat.playerId] = stat;
            });
            setPlayerStats(statsMap);
        } catch (error) {
            console.error('Failed to load player stats:', error);
            // Non-fatal — stats just won't show
        }
    };

    const handleJerseyChange = (playerId, newValue) => {
        setEditedPlayers({
            ...editedPlayers,
            [playerId]: newValue
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = Object.entries(editedPlayers);
            for (const [playerId, jerseyNumber] of updates) {
                await axios.patch(
                    `${API_BASE_URL}/gm/players/${playerId}/jersey`,
                    { jerseyNumber: parseInt(jerseyNumber) },
                    { headers: getAuthHeaders() }
                );
            }
            showMessage('success', 'Jersey numbers updated successfully!');
            // Refresh roster
            const rosterRes = await axios.get(`${API_BASE_URL}/gm/team/${user.teamId}/roster`, {
                headers: getAuthHeaders(),
            });
            setRoster(rosterRes.data);
            setEditedPlayers({});
        } catch (error) {
            showMessage('error', 'Failed to update jersey numbers');
        } finally {
            setSaving(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortedRoster = () => {
        const sorted = [...roster].sort((a, b) => {
            let aValue, bValue;
            if (['goals', 'assists', 'points', 'penaltyMinutes'].includes(sortConfig.key)) {
                const aStats = playerStats[a.id] || {};
                const bStats = playerStats[b.id] || {};
                aValue = aStats[sortConfig.key] || 0;
                bValue = bStats[sortConfig.key] || 0;
            } else {
                aValue = a[sortConfig.key];
                bValue = b[sortConfig.key];
            }
            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return sorted;
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="gm-team">
            <div className="team-header">
                {teamInfo ? (
                    <TeamBadge
                        teamName={teamInfo.name}
                        teamColor={teamInfo.teamColor}
                        style={{ fontSize: '1.5rem', padding: '10px 24px' }}
                    />
                ) : (
                    <h1>My Team</h1>
                )}
                {Object.keys(editedPlayers).length > 0 && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-save"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                )}
            </div>

            {message && (
                <div className={`message message-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="team-roster-card">
                {roster.length > 0 ? (
                    <table className="team-roster-table">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('jerseyNumber')} style={{ cursor: 'pointer' }}>Jersey #{getSortIcon('jerseyNumber')}</th>
                                <th onClick={() => requestSort('lastName')} style={{ cursor: 'pointer' }}>Name{getSortIcon('lastName')}</th>
                                <th onClick={() => requestSort('position')} style={{ cursor: 'pointer' }}>Position{getSortIcon('position')}</th>
                                <th onClick={() => requestSort('skillRating')} style={{ cursor: 'pointer' }}>Skill{getSortIcon('skillRating')}</th>
                                <th onClick={() => requestSort('goals')} style={{ cursor: 'pointer' }}>G{getSortIcon('goals')}</th>
                                <th onClick={() => requestSort('assists')} style={{ cursor: 'pointer' }}>A{getSortIcon('assists')}</th>
                                <th onClick={() => requestSort('points')} style={{ cursor: 'pointer' }}>P{getSortIcon('points')}</th>
                                <th onClick={() => requestSort('penaltyMinutes')} style={{ cursor: 'pointer' }}>PM{getSortIcon('penaltyMinutes')}</th>
                                <th>Email</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getSortedRoster().map(player => {
                                const stats = playerStats[player.id] || {};
                                return (
                                    <tr key={player.id}>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                max="99"
                                                value={editedPlayers[player.id] ?? player.jerseyNumber ?? ''}
                                                onChange={(e) => handleJerseyChange(player.id, e.target.value)}
                                                className="jersey-input"
                                            />
                                        </td>
                                        <td className="player-name">{player.firstName} {player.lastName}</td>
                                        <td>{player.position || '-'}</td>
                                        <td>{player.skillRating || '-'}</td>
                                        <td>{stats.goals || 0}</td>
                                        <td>{stats.assists || 0}</td>
                                        <td>{stats.points || 0}</td>
                                        <td>{stats.penaltyMinutes || 0}</td>
                                        <td className="player-email">{player.email || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <p className="no-data">No players on roster</p>
                )}
            </div>
        </div>
    );
}

export default GMTeam;
