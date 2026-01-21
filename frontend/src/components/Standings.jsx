import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Standings.css';

function Standings() {
    const navigate = useNavigate();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStandings();
    }, []);

    const loadStandings = async () => {
        try {
            setLoading(true);

            // Get all teams and games
            const [teamsData, gamesData] = await Promise.all([
                api.getTeams(),
                api.getGames()
            ]);

            // Initialize standings for each team
            const standings = teamsData.map(team => ({
                id: team.id,
                name: team.name,
                teamColor: team.teamColor,
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                overtimeWins: 0,
                overtimeLosses: 0,
                points: 0,
                goalsFor: 0,
                goalsAgainst: 0
            }));

            // Calculate standings from completed games
            const completedGames = gamesData.filter(g => g.status === 'completed');

            completedGames.forEach(game => {
                const homeTeam = standings.find(t => t.id === game.homeTeamId);
                const awayTeam = standings.find(t => t.id === game.awayTeamId);

                if (!homeTeam || !awayTeam) return;

                // Update games played
                homeTeam.gamesPlayed++;
                awayTeam.gamesPlayed++;

                // Update goals
                homeTeam.goalsFor += game.homeScore || 0;
                homeTeam.goalsAgainst += game.awayScore || 0;
                awayTeam.goalsFor += game.awayScore || 0;
                awayTeam.goalsAgainst += game.homeScore || 0;

                // Determine winner and assign points
                if (game.homeScore > game.awayScore) {
                    // Home team wins
                    if (game.endedInOT) {
                        homeTeam.overtimeWins++;
                        awayTeam.overtimeLosses++;
                        homeTeam.points += 2;
                        awayTeam.points += 1; // OT loss gets 1 point
                    } else {
                        homeTeam.wins++;
                        awayTeam.losses++;
                        homeTeam.points += 2;
                        // Regulation loss gets 0 points
                    }
                } else if (game.awayScore > game.homeScore) {
                    // Away team wins
                    if (game.endedInOT) {
                        awayTeam.overtimeWins++;
                        homeTeam.overtimeLosses++;
                        awayTeam.points += 2;
                        homeTeam.points += 1; // OT loss gets 1 point
                    } else {
                        awayTeam.wins++;
                        homeTeam.losses++;
                        awayTeam.points += 2;
                        // Regulation loss gets 0 points
                    }
                } else {
                    // Tie game
                    homeTeam.ties++;
                    awayTeam.ties++;
                    homeTeam.points += 1;
                    awayTeam.points += 1;
                }
            });

            // Sort by: 1) points (desc), 2) wins (desc), 3) goals against (asc), 4) goals for (desc)
            const sorted = standings.sort((a, b) => {
                // Primary: Points (highest first)
                if (b.points !== a.points) {
                    return b.points - a.points;
                }
                // Tiebreaker 1: Wins (highest first)
                if (b.wins !== a.wins) {
                    return b.wins - a.wins;
                }
                // Tiebreaker 2: Goals Against (lowest first - fewer goals against is better)
                if (a.goalsAgainst !== b.goalsAgainst) {
                    return a.goalsAgainst - b.goalsAgainst;
                }
                // Tiebreaker 3: Goals For (highest first)
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
        return team.goalsFor - team.goalsAgainst;
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
                <button className="btn-refresh" onClick={loadStandings}>
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
                            // Helper to get valid CSS color
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

                            // Helper to determine text color based on background
                            const getTextColor = (bgColor) => {
                                if (!bgColor) return 'white';
                                const lightColors = ['White', '#FFFFFF', 'Yellow', '#FFD700', 'Gold', 'Lt. Blu', '#87CEEB', 'LightBlue'];
                                const isLight = lightColors.some(c => c.toLowerCase() === bgColor.toLowerCase());
                                return isLight ? '#2c3e50' : 'white';
                            };

                            const bg = getValidColor(team.teamColor);
                            const textColor = getTextColor(bg);

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
                                    <td>{team.gamesPlayed}</td>
                                    <td>{team.wins}</td>
                                    <td>{team.losses}</td>
                                    <td>{team.ties}</td>
                                    <td>{team.overtimeWins}</td>
                                    <td>{team.overtimeLosses}</td>
                                    <td className="points"><strong>{team.points}</strong></td>
                                    <td>{team.goalsFor}</td>
                                    <td>{team.goalsAgainst}</td>
                                    <td className={calculateGoalDiff(team) >= 0 ? 'positive' : 'negative'}>
                                        {calculateGoalDiff(team) >= 0 ? '+' : ''}{calculateGoalDiff(team)}
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
                    <div className="legend-item">
                        <span className="legend-label">GP:</span> Games Played
                    </div>
                    <div className="legend-item">
                        <span className="legend-label">W:</span> Wins
                    </div>
                    <div className="legend-item">
                        <span className="legend-label">L:</span> Losses
                    </div>
                    <div className="legend-item">
                        <span className="legend-label">T:</span> Ties
                    </div>
                    <div className="legend-item">
                        <span className="legend-label">OTW:</span> Overtime Wins
                    </div>
                    <div className="legend-item">
                        <span className="legend-label">OTL:</span> Overtime Losses
                    </div>
                    <div className="legend-item">
                        <span className="legend-label">PTS:</span> Points
                    </div>
                    <div className="legend-item">
                        <span className="legend-label">GF:</span> Goals For
                    </div>
                    <div className="legend-item">
                        <span className="legend-label">GA:</span> Goals Against
                    </div>
                    <div className="legend-item">
                        <span className="legend-label">DIFF:</span> Goal Differential
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Standings;
