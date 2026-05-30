import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Standings.css';

function Standings({ seasonId }) {
    const navigate = useNavigate();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (seasonId) {
            loadStandings(seasonId);
        }
    }, [seasonId]);

    const loadStandings = async (id) => {
        try {
            setLoading(true);
            // Fetch teams with pre-computed stats for this season
            // (same endpoint the public standings page uses)
            const response = await axios.get(`/api/v1/teams?seasonId=${id}`);
            const data = response.data;

            // Sort by: 1) points (desc), 2) wins (desc), 3) goals against (asc), 4) goals for (desc)
            const sorted = data.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                const bWins = (b.wins || 0) + (b.overtimeWins || 0);
                const aWins = (a.wins || 0) + (a.overtimeWins || 0);
                if (bWins !== aWins) return bWins - aWins;
                if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
                return b.goalsFor - a.goalsFor;
            });

            setTeams(sorted);
        } catch (error) {
            console.error('Error loading standings:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateGoalDiff = (team) => {
        return (team.goalsFor || 0) - (team.goalsAgainst || 0);
    };

    if (loading) {
        return (
            <div className="standings">
                <div className="loading">Loading standings...</div>
            </div>
        );
    }

    return (
        <div className="standings">
            <div className="standings-header">
                <h2>Team Standings</h2>
                <button className="btn-refresh" onClick={() => loadStandings(seasonId)}>
                    🔄 Refresh
                </button>
            </div>

            <div className="standings-table">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Team</th>
                            <th>GP</th>
                            <th>W</th>
                            <th>L</th>
                            <th>T</th>
                            <th>OTW</th>
                            <th>OTL</th>
                            <th>PTS</th>
                            <th>GF</th>
                            <th>GA</th>
                            <th>DIFF</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map((team, index) => {
                            const getValidColor = (color) => {
                                if (!color) return '#95a5a6';
                                const colorMap = {
                                    'Lt. Blu': '#87CEEB',
                                    'Dk. Gre': '#006400',
                                    'White': '#FFFFFF',
                                    'Yellow': '#FFD700',
                                    'Gold': '#FFD700'
                                };
                                return colorMap[color] || color;
                            };

                            const getTextColor = (bgColor) => {
                                if (!bgColor) return 'white';
                                const lightColors = ['White', '#FFFFFF', 'Yellow', '#FFD700', 'Gold', 'Lt. Blu', '#87CEEB', 'LightBlue'];
                                const isLight = lightColors.some(c => c.toLowerCase() === bgColor.toLowerCase());
                                return isLight ? '#2c3e50' : 'white';
                            };

                            const bg = getValidColor(team.teamColor);
                            const textColor = getTextColor(bg);
                            const diff = calculateGoalDiff(team);

                            return (
                                <tr
                                    key={team.id}
                                    className="clickable-row"
                                    onClick={() => navigate(`/admin/teams/${team.id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td className="rank" style={{ backgroundColor: bg, color: textColor }}>{index + 1}</td>
                                    <td className="team-name">
                                        <strong>{team.name}</strong>
                                    </td>
                                    <td>{team.gamesPlayed || 0}</td>
                                    <td>{team.wins || 0}</td>
                                    <td>{team.losses || 0}</td>
                                    <td>{team.ties || 0}</td>
                                    <td>{team.overtimeWins || 0}</td>
                                    <td>{team.overtimeLosses || 0}</td>
                                    <td className="points"><strong>{team.points || 0}</strong></td>
                                    <td>{team.goalsFor || 0}</td>
                                    <td>{team.goalsAgainst || 0}</td>
                                    <td className={diff >= 0 ? 'positive' : 'negative'}>
                                        {diff >= 0 ? '+' : ''}{diff}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="standings-legend">
                <h3>📊 Scoring Rules</h3>
                <div className="scoring-rules">
                    <div className="rule-item">
                        <span className="rule-value">2 PTS</span>
                        <span className="rule-desc">Win (Regulation or OT)</span>
                    </div>
                    <div className="rule-item">
                        <span className="rule-value">1 PT</span>
                        <span className="rule-desc">Tie or OT Loss</span>
                    </div>
                    <div className="rule-item">
                        <span className="rule-value">0 PTS</span>
                        <span className="rule-desc">Regulation Loss</span>
                    </div>
                </div>

                <h3>📋 Column Definitions</h3>
                <div className="column-definitions">
                    <div className="legend-item"><span className="legend-label">GP:</span> Games Played</div>
                    <div className="legend-item"><span className="legend-label">W:</span> Wins</div>
                    <div className="legend-item"><span className="legend-label">L:</span> Losses</div>
                    <div className="legend-item"><span className="legend-label">T:</span> Ties</div>
                    <div className="legend-item"><span className="legend-label">OTW:</span> Overtime Wins</div>
                    <div className="legend-item"><span className="legend-label">OTL:</span> Overtime Losses</div>
                    <div className="legend-item"><span className="legend-label">PTS:</span> Points</div>
                    <div className="legend-item"><span className="legend-label">GF:</span> Goals For</div>
                    <div className="legend-item"><span className="legend-label">GA:</span> Goals Against</div>
                    <div className="legend-item"><span className="legend-label">DIFF:</span> Goal Differential</div>
                </div>
            </div>
        </div>
    );
}

export default Standings;
