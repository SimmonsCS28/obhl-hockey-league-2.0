import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import TeamBadge from '../common/TeamBadge';
import './GMDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

function GMDashboard() {
    const { user } = useAuth();
    const [roster, setRoster] = useState([]);
    const [teamInfo, setTeamInfo] = useState(null);
    const [nextGame, setNextGame] = useState(null);
    const [opponent, setOpponent] = useState(null);
    const [loading, setLoading] = useState(true);
    // Track edited jersey numbers: { [playerId]: value }
    const [jerseyEdits, setJerseyEdits] = useState({});
    // Track saving state per player: { [playerId]: boolean }
    const [savingJersey, setSavingJersey] = useState({});
    // Resolved current-season team ID (may differ from user.teamId which can be stale)
    const [currentTeamId, setCurrentTeamId] = useState(null);

    useEffect(() => {
        if (user) {
            fetchAll();
        } else {
            setLoading(false);
        }
    }, [user]);

    const fetchAll = async () => {
        try {
            // Resolve team via player dashboard — looks up by email + active season,
            // so it always returns the current season's team regardless of user.teamId.
            const dashData = await api.getPlayerDashboard();
            const currentTeamId = dashData?.team?.id;
            const currentSeasonId = dashData?.team?.seasonId;

            if (!currentTeamId) {
                setLoading(false);
                return;
            }

            setTeamInfo(dashData.team);
            setCurrentTeamId(currentTeamId);

            // Fetch roster scoped to the current season
            const rosterRes = await axios.get(
                `${API_BASE_URL}/gm/team/${currentTeamId}/roster?seasonId=${currentSeasonId}`,
                { headers: getAuthHeaders() }
            );
            setRoster(rosterRes.data);

            await fetchNextGame(currentTeamId, currentSeasonId);
        } catch (error) {
            console.error('Failed to load GM data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchNextGame = async (teamId, seasonId) => {
        try {
            const gamesRes = await axios.get(
                `${API_BASE_URL}/gm/team/${teamId}/schedule?seasonId=${seasonId}`,
                { headers: getAuthHeaders() }
            );
            const now = new Date();
            const upcomingGames = gamesRes.data
                .filter(g => new Date(g.gameDate.endsWith('Z') ? g.gameDate : g.gameDate + 'Z') > now)
                .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());

            if (upcomingGames.length > 0) {
                setNextGame(upcomingGames[0]);
            }
        } catch (error) {
            console.error('Failed to fetch next game:', error);
        }
    };

    useEffect(() => {
        const fetchOpponent = async () => {
            if (nextGame && currentTeamId) {
                const opponentId = nextGame.homeTeamId === currentTeamId ? nextGame.awayTeamId : nextGame.homeTeamId;
                if (!opponentId) return;

                try {
                    const response = await axios.get(`${API_BASE_URL}/teams/${opponentId}`, {
                        headers: getAuthHeaders()
                    });
                    setOpponent(response.data);
                } catch (error) {
                    console.error('Failed to fetch opponent:', error);
                }
            }
        };

        fetchOpponent();
    }, [nextGame, currentTeamId]);

    const handleJerseyChange = (playerId, value) => {
        setJerseyEdits(prev => ({ ...prev, [playerId]: value }));
    };

    const saveJersey = async (player) => {
        const newJersey = jerseyEdits[player.id];
        const parsed = parseInt(newJersey, 10);
        if (isNaN(parsed) || parsed < 0 || parsed > 99) {
            alert('Jersey number must be between 0 and 99.');
            return;
        }

        setSavingJersey(prev => ({ ...prev, [player.id]: true }));
        try {
            await axios.patch(
                `${API_BASE_URL}/gm/players/${player.id}/jersey`,
                { jerseyNumber: parsed },
                { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
            );
            // Update local roster state
            setRoster(prev =>
                prev.map(p => p.id === player.id ? { ...p, jerseyNumber: parsed } : p)
            );
            // Clear the edit for this player
            setJerseyEdits(prev => {
                const next = { ...prev };
                delete next[player.id];
                return next;
            });
        } catch (error) {
            console.error('Failed to save jersey number:', error);
            alert('Failed to save jersey number. Please try again.');
        } finally {
            setSavingJersey(prev => ({ ...prev, [player.id]: false }));
        }
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="gm-dashboard">
            <div className="gm-dashboard-header">
                {teamInfo ? (
                    <TeamBadge
                        teamName={teamInfo.name}
                        teamColor={teamInfo.teamColor}
                        style={{ fontSize: '1.5rem', padding: '10px 24px', marginBottom: '2rem' }}
                    />
                ) : (
                    <h1>Dashboard</h1>
                )}
            </div>

            <div className="dashboard-grid">
                {/* Roster Section */}
                <div className="dashboard-card roster-card">
                    <h2>Team Roster</h2>
                    {roster.length > 0 ? (
                        <div className="table-container">
                            <table className="roster-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Name</th>
                                        <th>Position</th>
                                        <th>Skill</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {roster.map(player => {
                                        const editValue = jerseyEdits[player.id];
                                        const isEdited = editValue !== undefined && editValue !== String(player.jerseyNumber ?? '');
                                        return (
                                            <tr key={player.id}>
                                                <td>
                                                    <input
                                                        className="jersey-edit-input"
                                                        type="number"
                                                        min="0"
                                                        max="99"
                                                        value={editValue !== undefined ? editValue : (player.jerseyNumber ?? '')}
                                                        onChange={e => handleJerseyChange(player.id, e.target.value)}
                                                    />
                                                    {isEdited && (
                                                        <button
                                                            className="save-jersey-btn"
                                                            disabled={savingJersey[player.id]}
                                                            onClick={() => saveJersey(player)}
                                                        >
                                                            {savingJersey[player.id] ? '...' : 'Save'}
                                                        </button>
                                                    )}
                                                </td>
                                                <td>{player.firstName} {player.lastName}</td>
                                                <td>{player.position || '-'}</td>
                                                <td>{player.skillRating || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="no-data">No roster data available</div>
                    )}
                </div>

                {/* Next Game Section */}
                <div className="dashboard-card next-game-card">
                    <h2>Next Game</h2>
                    {nextGame ? (
                        <div className="game-info">
                            <div className="game-detail">
                                <span className="label">Opponent:</span>
                                <span className="value">
                                    {opponent ? (
                                        <div style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                                            <TeamBadge
                                                teamName={opponent.name}
                                                teamColor={opponent.teamColor || '#888888'}
                                                style={{ fontSize: '0.9rem', padding: '0.2rem 0.6rem' }}
                                            />
                                        </div>
                                    ) : 'Loading...'}
                                </span>
                            </div>
                            <div className="game-detail">
                                <span className="label">Date:</span>
                                <span className="value">
                                    {new Date(nextGame.gameDate.endsWith('Z') ? nextGame.gameDate : nextGame.gameDate + 'Z').toLocaleDateString()}
                                </span>
                            </div>
                            <div className="game-detail">
                                <span className="label">Time:</span>
                                <span className="value">
                                    {new Date(nextGame.gameDate.endsWith('Z') ? nextGame.gameDate : nextGame.gameDate + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="game-detail">
                                <span className="label">Location:</span>
                                <span className="value">{nextGame.rink}</span>
                            </div>
                            <div className="game-detail">
                                <span className="label">Week:</span>
                                <span className="value">{nextGame.week}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="no-data">No upcoming games scheduled</p>
                    )}
                </div>
            </div>
        </div >
    );
}

export default GMDashboard;
