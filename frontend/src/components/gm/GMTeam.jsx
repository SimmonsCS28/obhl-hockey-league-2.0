import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './GMTeam.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Collapse a detailed position code to F / D / G for the roster chip.
const shortPos = (pos) => {
    if (!pos) return '—';
    const p = String(pos).toUpperCase();
    if (p === 'G' || p.startsWith('GOAL')) return 'G';
    if (p === 'D' || p.startsWith('DEF')) return 'D';
    return 'F';
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
    const [emailsCopied, setEmailsCopied] = useState(false);

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

            const rosterRes = await axios.get(
                `${API_BASE_URL}/gm/team/${currentTeamId}/roster?seasonId=${currentSeasonId}`,
                { headers: getAuthHeaders() }
            );
            // Stable order by jersey number
            const sorted = [...rosterRes.data].sort(
                (a, b) => (parseInt(a.jerseyNumber) || 999) - (parseInt(b.jerseyNumber) || 999)
            );
            setRoster(sorted);

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

    const currentSkill = (player) =>
        parseInt(editedSkills[player.id] ?? player.skillRating ?? 0) || 0;

    const stepSkill = (player, delta) => {
        const next = Math.max(1, Math.min(10, currentSkill(player) + delta));
        setEditedSkills(prev => ({ ...prev, [player.id]: next }));
    };

    const changeCount = Object.keys(editedPlayers).length + Object.keys(editedSkills).length;

    const handleSave = async () => {
        setSaving(true);
        try {
            for (const [playerId, jerseyNumber] of Object.entries(editedPlayers)) {
                await axios.patch(
                    `${API_BASE_URL}/gm/players/${playerId}/jersey`,
                    { jerseyNumber: parseInt(jerseyNumber) },
                    { headers: getAuthHeaders() }
                );
            }
            for (const [playerId, skillRating] of Object.entries(editedSkills)) {
                await axios.patch(
                    `${API_BASE_URL}/gm/players/${playerId}/skill`,
                    { skillRating: parseInt(skillRating) },
                    { headers: getAuthHeaders() }
                );
            }
            showMessage('success', `${changeCount} player update(s) saved!`);
            const rosterRes = await axios.get(
                `${API_BASE_URL}/gm/team/${teamInfo.id}/roster?seasonId=${teamInfo.seasonId}`,
                { headers: getAuthHeaders() }
            );
            const sorted = [...rosterRes.data].sort(
                (a, b) => (parseInt(a.jerseyNumber) || 999) - (parseInt(b.jerseyNumber) || 999)
            );
            setRoster(sorted);
            setEditedPlayers({});
            setEditedSkills({});
        } catch {
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
        const flash = () => {
            setEmailsCopied(true);
            clearTimeout(handleCopyEmails._t);
            handleCopyEmails._t = setTimeout(() => setEmailsCopied(false), 2000);
        };
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(emails)
                .then(flash)
                .catch(() => showMessage('error', 'Failed to copy — check browser clipboard permissions'));
        } else {
            // Fallback for non-secure contexts
            const ta = document.createElement('textarea');
            ta.value = emails;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); flash(); }
            catch { showMessage('error', 'Failed to copy'); }
            document.body.removeChild(ta);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    if (loading) return <div className="gm-team-loading">Loading…</div>;

    return (
        <div className="gm-team">
            <div className="gm-team-head">
                <div className="gm-team-headings">
                    <h2 className="gm-team-title">
                        Manage{' '}
                        {isEditingName ? (
                            <input
                                className="gm-team-name-input"
                                value={editedName}
                                onChange={e => setEditedName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveTeamName();
                                    if (e.key === 'Escape') setIsEditingName(false);
                                }}
                                onBlur={handleSaveTeamName}
                                autoFocus
                                maxLength={100}
                                disabled={savingName}
                            />
                        ) : (
                            <button
                                type="button"
                                className="gm-team-name"
                                title="Click to rename your team"
                                onClick={() => { setEditedName(teamInfo?.name || ''); setIsEditingName(true); }}
                            >
                                {teamInfo?.name || 'My Team'}
                            </button>
                        )}
                    </h2>
                    <p className="gm-team-sub">Edit jersey numbers and skill ratings for your roster. Changes save to your team.</p>
                </div>

                <div className="gm-team-actions">
                    {changeCount > 0 && (
                        <button className="gm-save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving…' : `Save Changes (${changeCount})`}
                        </button>
                    )}
                    {roster.length > 0 && (
                        <button
                            className={`gm-copy-btn${emailsCopied ? ' is-copied' : ''}`}
                            onClick={handleCopyEmails}
                            title="Copy all player emails to clipboard"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            {emailsCopied ? 'Copied!' : 'Copy Emails'}
                        </button>
                    )}
                </div>
            </div>

            {message && (
                <div className={`gm-msg gm-msg-${message.type}`}>{message.text}</div>
            )}

            <div className="gm-roster">
                {roster.length > 0 ? (
                    <div className="gm-roster-scroll">
                        <div className="gm-roster-head">
                            <span className="gm-col gm-col-jersey">Jersey</span>
                            <span className="gm-col gm-col-player">Player</span>
                            <span className="gm-col gm-col-email">Email</span>
                            <span className="gm-col gm-col-pos">Pos</span>
                            <span className="gm-col gm-col-stat" title="Goals">G</span>
                            <span className="gm-col gm-col-stat" title="Assists">A</span>
                            <span className="gm-col gm-col-stat" title="Points">P</span>
                            <span className="gm-col gm-col-pim" title="Penalty Minutes">PIM</span>
                            <span className="gm-col gm-col-skill">Skill Rating</span>
                        </div>
                        {roster.map(player => {
                            const stats = playerStats[player.id] || {};
                            const g = stats.goals || 0;
                            const a = stats.assists || 0;
                            const pim = stats.penaltyMinutes || 0;
                            const rating = currentSkill(player);
                            return (
                                <div className="gm-roster-row" key={player.id}>
                                    <span className="gm-col gm-col-jersey">
                                        <span className="gm-hash">#</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="99"
                                            className="gm-jersey-input"
                                            value={editedPlayers[player.id] ?? player.jerseyNumber ?? ''}
                                            onChange={(e) => handleJerseyChange(player.id, e.target.value)}
                                        />
                                    </span>
                                    <span className="gm-col gm-col-player">{player.firstName} {player.lastName}</span>
                                    <span className="gm-col gm-col-email">
                                        <input
                                            type="email"
                                            className="gm-email-input"
                                            value={player.email || ''}
                                            readOnly
                                            title={player.email || ''}
                                        />
                                    </span>
                                    <span className="gm-col gm-col-pos">
                                        <span className="gm-pos-chip">{shortPos(player.position)}</span>
                                    </span>
                                    <span className="gm-col gm-col-stat">{g}</span>
                                    <span className="gm-col gm-col-stat">{a}</span>
                                    <span className="gm-col gm-col-stat gm-col-points">{g + a}</span>
                                    <span className="gm-col gm-col-pim">{pim}</span>
                                    <span className="gm-col gm-col-skill">
                                        <button className="gm-step" onClick={() => stepSkill(player, -1)} aria-label="Decrease skill">−</button>
                                        <span className="gm-skill-meter">
                                            <span className="gm-skill-num">{rating || '—'}</span>
                                            <span className="gm-skill-bar">
                                                <span className="gm-skill-fill" style={{ width: `${Math.max(0, Math.min(10, rating)) * 10}%` }} />
                                            </span>
                                        </span>
                                        <button className="gm-step" onClick={() => stepSkill(player, 1)} aria-label="Increase skill">+</button>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="gm-no-data">No players on roster</p>
                )}
            </div>
        </div>
    );
}

export default GMTeam;
