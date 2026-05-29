import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
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
    const [editedSkills, setEditedSkills] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'jerseyNumber', direction: 'ascending' });

    // Team name editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [savingName, setSavingName] = useState(false);

    useEffect(() => {
        if (user) {
            fetchAll();
        }
    }, [user]);

    const fetchAll = async () => {
        try {
            // Resolve current team via player dashboard — looks up by email + active season
            // so we always get the current season's team regardless of user.teamId being stale.
            const dashData = await api.getPlayerDashboard();
            const currentTeamId = dashData?.team?.id;
            const currentSeasonId = dashData?.team?.seasonId;

            if (!currentTeamId) {
                setLoading(false);
                return;
            }

            setTeamInfo(dashData.team);

            // Fetch roster scoped to the current season
            const rosterRes = await axios.get(
                `${API_BASE_URL}/gm/team/${currentTeamId}/roster?seasonId=${currentSeasonId}`,
                { headers: getAuthHeaders() }
            );
            setRoster(rosterRes.data);

            if (currentSeasonId) {
                await fetchPlayerStats(currentTeamId, currentSeasonId);
            }
        } catch (error) {
            console.error('Failed to load team data:', error);
            showMessage('error', 'Failed to load team data');
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayerStats = async (teamId, seasonId) => {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/stats/players?seasonId=${seasonId}&teamId=${teamId}`,
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
        setEditedPlayers(prev => ({ ...prev, [playerId]: newValue }));
    };

    const handleSkillChange = (playerId, newValue) => {
        setEditedSkills(prev => ({ ...prev, [playerId]: newValue }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save jersey number changes
            for (const [playerId, jerseyNumber] of Object.entries(editedPlayers)) {
                await axios.patch(
                    `${API_BASE_URL}/gm/players/${playerId}/jersey`,
                    { jerseyNumber: parseInt(jerseyNumber) },
                    { headers: getAuthHeaders() }
                );
            }
            // Save skill rating changes
            for (const [playerId, skillRating] of Object.entries(editedSkills)) {
                await axios.patch(
                    `${API_BASE_URL}/gm/players/${playerId}/skill`,
                    { skillRating: parseInt(skillRating) },
                    { headers: getAuthHeaders() }
                );
            }
            const changedCount = Object.keys(editedPlayers).length + Object.keys(editedSkills).length;
            showMessage('success', `${changedCount} player update(s) saved!`);
            // Refresh roster
            const rosterRes = await axios.get(
                `${API_BASE_URL}/gm/team/${teamInfo.id}/roster?seasonId=${teamInfo.seasonId}`,
                { headers: getAuthHeaders() }
            );
            setRoster(rosterRes.data);
            setEditedPlayers({});
            setEditedSkills({});
        } catch (error) {
            showMessage('error', 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTeamName = async () => {
        const trimmed = editedName.trim();
        if (!trimmed || trimmed === teamInfo?.name) {
            setIsEditingName(false);
            return;
        }
        setSavingName(true);
        try {
            await axios.put(
                `${API_BASE_URL}/teams/${teamInfo.id}`,
                { name: trimmed },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );
            setTeamInfo(prev => ({ ...prev, name: trimmed }));
            setIsEditingName(false);
            showMessage('success', `Team renamed to "${trimmed}"`);
        } catch (error) {
            console.error('Failed to rename team:', error);
            showMessage('error', 'Failed to save team name');
        } finally {
            setSavingName(false);
        }
    };

    const handleCopyEmails = () => {
        const emails = roster
            .map(p => p.email)
            .filter(email => email && email.toLowerCase() !== user?.email?.toLowerCase())
            .join(', ');
        if (!emails) {
            showMessage('error', 'No player emails found');
            return;
        }
        navigator.clipboard.writeText(emails)
            .then(() => showMessage('success', `${emails.split(', ').length} email(s) copied to clipboard!`))
            .catch(() => showMessage('error', 'Failed to copy — check browser clipboard permissions'));
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
                <div className="team-name-section">
                    {teamInfo ? (
                        isEditingName ? (
                            <div className="team-name-edit">
                                <input
                                    className="team-name-input"
                                    value={editedName}
                                    onChange={e => setEditedName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveTeamName();
                                        if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                    autoFocus
                                    maxLength={100}
                                />
                                <button
                                    className="btn-save"
                                    onClick={handleSaveTeamName}
                                    disabled={savingName}
                                >
                                    {savingName ? 'Saving...' : '✓ Save'}
                                </button>
                                <button
                                    className="btn-cancel"
                                    onClick={() => setIsEditingName(false)}
                                    disabled={savingName}
                                >
                                    ✕ Cancel
                                </button>
                            </div>
                        ) : (
                            <TeamBadge
                                teamName={teamInfo.name}
                                teamColor={teamInfo.teamColor}
                                style={{ fontSize: '1.5rem', padding: '10px 24px', cursor: 'pointer' }}
                                title="Click to rename"
                                onClick={() => { setEditedName(teamInfo.name); setIsEditingName(true); }}
                            />
                        )
                    ) : (
                        <h1>My Team</h1>
                    )}

                    {roster.length > 0 && !isEditingName && (
                        <button
                            className="btn-copy-emails"
                            onClick={handleCopyEmails}
                            title="Copy all player emails to clipboard"
                        >
                            📋 Copy Emails
                        </button>
                    )}
                </div>

                <div className="header-actions">
                    {(Object.keys(editedPlayers).length > 0 || Object.keys(editedSkills).length > 0) && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn-save"
                        >
                            {saving ? 'Saving...' : `Save Changes (${Object.keys(editedPlayers).length + Object.keys(editedSkills).length})`}
                        </button>
                    )}
                </div>
            </div>

            {message && (
                <div className={`message message-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="team-roster-card">
                {roster.length > 0 ? (
                    <div className="table-container">
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
                                            <td>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={editedSkills[player.id] ?? player.skillRating ?? ''}
                                                    onChange={(e) => handleSkillChange(player.id, e.target.value)}
                                                    className="skill-input"
                                                />
                                            </td>
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
                    </div>
                ) : (
                    <p className="no-data">No players on roster</p>
                )}
            </div>
        </div>
    );
}

export default GMTeam;
