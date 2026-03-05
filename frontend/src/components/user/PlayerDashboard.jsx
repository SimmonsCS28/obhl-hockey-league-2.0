import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import TeamBadge from '../common/TeamBadge';
import './PlayerDashboard.css'; // Will create this next

const PlayerDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [teamRecords, setTeamRecords] = useState({});

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const data = await api.getPlayerDashboard();
                setDashboardData(data);

                // Fetch opponent team records for game cards
                try {
                    const { nextGame: ng, schedule: sched, team: t } = data || {};
                    const opponentIds = new Set();

                    // Opponent for next game
                    if (ng && t) {
                        opponentIds.add(ng.homeTeamId === t.id ? ng.awayTeamId : ng.homeTeamId);
                    }

                    // Opponent for previous game (game before next game, or last game)
                    if (sched && sched.length > 0) {
                        let prevGame = null;
                        if (ng) {
                            const idx = sched.findIndex(g => g.id === ng.id);
                            if (idx > 0) prevGame = sched[idx - 1];
                        } else {
                            prevGame = sched[sched.length - 1];
                        }
                        if (prevGame && t) {
                            opponentIds.add(prevGame.homeTeamId === t.id ? prevGame.awayTeamId : prevGame.homeTeamId);
                        }
                    }

                    // Fetch each opponent team's stored record
                    const records = {};
                    await Promise.all([...opponentIds].map(async (id) => {
                        try {
                            const teamData = await api.getTeam(id);
                            records[id] = {
                                wins: teamData.wins || 0,
                                losses: teamData.losses || 0,
                                ties: teamData.ties || 0,
                                otLosses: teamData.overtimeLosses || 0
                            };
                        } catch (e) {
                            console.warn(`Could not fetch team ${id}:`, e.message);
                        }
                    }));
                    setTeamRecords(records);
                } catch (err) {
                    console.warn('Could not fetch opponent records:', err.message);
                }
            } catch (err) {
                console.error("Failed to fetch dashboard:", err);
                setError("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [user?.email]); // Depend on user.email to refetch if user changes

    if (loading) return <div className="loading-container">Loading dashboard...</div>;
    if (error) return <div className="error-container">{error}</div>;

    // Destructure data from dashboardData
    const { team, record, nextGame, schedule, firstName, lastName } = dashboardData || {};

    const hasStaffRole = user?.roles?.some(role =>
        ['REF', 'GOALIE', 'SCOREKEEPER'].includes(role)
    );

    const isGM = user?.roles?.includes('GM');

    // gameDate arrives as UTC ISO datetime without 'Z', e.g. '2026-01-10T04:15:00'
    // Append 'Z' to force UTC parsing, then display in America/Chicago (CST/CDT)
    const toDate = (dateStr) => {
        if (!dateStr) return null;
        // If it already has a timezone offset, use as-is; otherwise treat as UTC
        const normalized = /[Z+\-]\d*$/.test(dateStr) ? dateStr : dateStr + 'Z';
        return new Date(normalized);
    };

    const formatTime = (dateStr) => {
        const d = toDate(dateStr);
        if (!d || isNaN(d)) return '';
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
    };

    const formatDate = (dateStr) => {
        const d = toDate(dateStr);
        if (!d || isNaN(d)) return '';
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
    };

    return (
        <div className="player-dashboard">
            <header className="dashboard-header">
                <h1>Welcome, {firstName ? `${firstName} ${lastName}` : user?.firstName}</h1>
                <div className="header-actions">
                    {user?.roles?.includes('ADMIN') && (
                        <button
                            className="action-button secondary"
                            onClick={() => navigate('/admin')}
                        >
                            Admin Dashboard
                        </button>
                    )}
                    {isGM && (
                        <button
                            className="action-button secondary"
                            onClick={() => navigate('/gm')}
                        >
                            GM Dashboard
                        </button>
                    )}
                    {hasStaffRole && (
                        <button
                            className="action-button secondary"
                            onClick={() => navigate('/user/shifts')}
                        >
                            My Shifts
                        </button>
                    )}
                    <button
                        className="action-button secondary"
                        onClick={() => navigate('/')}
                    >
                        OBHL Home
                    </button>
                    <button className="action-button logout" onClick={logout}>Logout</button>
                </div>
            </header>

            <div className="dashboard-grid">
                {/* Team Card */}
                <div className="dashboard-card team-card">
                    {team ? (
                        <>
                            <div className="team-header">
                                <h2>My Team</h2>
                                <TeamBadge
                                    teamName={team.name}
                                    teamColor={team.teamColor}
                                    onClick={() => navigate(`/teams/${team.id}`)}
                                    style={{ fontSize: '1.1rem', padding: '8px 20px', cursor: 'pointer' }}
                                />
                            </div>
                            <div className="team-stats">
                                <div className="stat-box">
                                    <span className="stat-value">{record?.wins || 0}</span>
                                    <span className="stat-label">Wins</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-value">{record?.losses || 0}</span>
                                    <span className="stat-label">Losses</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-value">{record?.ties || 0}</span>
                                    <span className="stat-label">Ties</span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-value">{record?.otLosses || 0}</span>
                                    <span className="stat-label">OTL</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="no-team">
                            <h2>No Team Assigned</h2>
                            <p>You are not currently assigned to a team for the active season.</p>
                        </div>
                    )}
                </div>

                {/* Next Game Card */}
                <div className="dashboard-card game-info-card">
                    <h2>Next Game</h2>
                    {nextGame ? (
                        <div className="game-info-rows">
                            <div className="game-info-row">
                                <span className="game-info-label">Date:</span>
                                <span className="game-info-value">{formatDate(nextGame.gameDate)}</span>
                            </div>
                            <div className="game-info-row">
                                <span className="game-info-label">Time:</span>
                                <span className="game-info-value">{formatTime(nextGame.gameDate)}</span>
                            </div>
                            <div className="game-info-row">
                                <span className="game-info-label">Opponent:</span>
                                <span className="game-info-value">
                                    <TeamBadge
                                        teamName={nextGame.homeTeamId === team?.id ? nextGame.awayTeamName : nextGame.homeTeamName}
                                        teamColor={nextGame.homeTeamId === team?.id ? nextGame.awayTeamColor : nextGame.homeTeamColor}
                                        className="opponent-link"
                                        onClick={() => navigate(`/teams/${nextGame.homeTeamId === team?.id ? nextGame.awayTeamId : nextGame.homeTeamId}`)}
                                    />
                                </span>
                            </div>
                            <div className="game-info-row">
                                <span className="game-info-label">Rink:</span>
                                <span className="game-info-value">{nextGame.rink || 'TBD'}</span>
                            </div>
                            {(() => {
                                const oppId = nextGame.homeTeamId === team?.id ? nextGame.awayTeamId : nextGame.homeTeamId;
                                const r = teamRecords[oppId];
                                return r ? (
                                    <div className="game-info-row">
                                        <span className="game-info-label">Opp. Record:</span>
                                        <span className="game-info-value">{r.wins}-{r.losses}-{r.ties}-{r.otLosses}</span>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    ) : (
                        <p>No upcoming games scheduled.</p>
                    )}
                </div>

                {/* Previous Game Card */}
                <div className="dashboard-card game-info-card">
                    <h2>Previous Game</h2>
                    {(() => {
                        // Find the game just before the next game in the schedule
                        // If no nextGame, use the last game in the schedule
                        let prevGame = null;
                        if (schedule && schedule.length > 0) {
                            if (nextGame) {
                                const nextGameIndex = schedule.findIndex(g => g.id === nextGame.id);
                                if (nextGameIndex > 0) {
                                    prevGame = schedule[nextGameIndex - 1];
                                }
                            } else {
                                // No next game means season is over, show the last game
                                prevGame = schedule[schedule.length - 1];
                            }
                        }
                        if (!prevGame) return <p>No previous games this season.</p>;
                        const isHome = prevGame.homeTeamId === team?.id;
                        const opponentName = isHome ? prevGame.awayTeamName : prevGame.homeTeamName;
                        const opponentColor = isHome ? prevGame.awayTeamColor : prevGame.homeTeamColor;
                        const opponentId = isHome ? prevGame.awayTeamId : prevGame.homeTeamId;
                        const isCompleted = prevGame.status === 'COMPLETED';
                        const myScore = isHome ? (prevGame.homeScore ?? 0) : (prevGame.awayScore ?? 0);
                        const oppScore = isHome ? (prevGame.awayScore ?? 0) : (prevGame.homeScore ?? 0);
                        return (
                            <div className="game-info-rows">
                                <div className="game-info-row">
                                    <span className="game-info-label">Date:</span>
                                    <span className="game-info-value">{formatDate(prevGame.gameDate)}</span>
                                </div>
                                <div className="game-info-row">
                                    <span className="game-info-label">Time:</span>
                                    <span className="game-info-value">{formatTime(prevGame.gameDate)}</span>
                                </div>
                                <div className="game-info-row">
                                    <span className="game-info-label">Opponent:</span>
                                    <span className="game-info-value">
                                        <TeamBadge
                                            teamName={opponentName}
                                            teamColor={opponentColor}
                                            className="opponent-link"
                                            onClick={() => navigate(`/teams/${opponentId}`)}
                                        />
                                    </span>
                                </div>
                                <div className="game-info-row">
                                    <span className="game-info-label">Rink:</span>
                                    <span className="game-info-value">{prevGame.rink || 'TBD'}</span>
                                </div>
                                {(() => {
                                    const r = teamRecords[opponentId];
                                    return r ? (
                                        <div className="game-info-row">
                                            <span className="game-info-label">Opp. Record:</span>
                                            <span className="game-info-value">{r.wins}-{r.losses}-{r.ties}-{r.otLosses}</span>
                                        </div>
                                    ) : null;
                                })()}
                                <div className="game-info-row">
                                    <span className="game-info-label">Result:</span>
                                    {isCompleted ? (
                                        <span className={`game-info-value result ${myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : ''}`}>
                                            {myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T'} {myScore}-{oppScore}{prevGame.endedInOT ? ' (OT)' : ''}
                                        </span>
                                    ) : (
                                        <span className="game-info-value no-score-badge">No Score Entered</span>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Schedule List */}
                <div className="dashboard-card schedule-card full-width">
                    <h2>Season Schedule</h2>
                    <div className="schedule-list">
                        {schedule && schedule.length > 0 ? (
                            <table className="schedule-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Time</th>
                                        <th>Opponent</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedule.map(game => {
                                        const isHome = game.homeTeamId === team?.id;
                                        const opponentName = isHome ? game.awayTeamName : game.homeTeamName;
                                        const opponentId = isHome ? game.awayTeamId : game.homeTeamId;

                                        let result = '-';
                                        if (game.status === 'COMPLETED') {
                                            const myScore = isHome ? game.homeScore : game.awayScore;
                                            const oppScore = isHome ? game.awayScore : game.homeScore;
                                            const wl = myScore > oppScore ? 'W' : (myScore < oppScore ? 'L' : 'T');
                                            result = `${wl} ${myScore}-${oppScore}`;
                                            if (game.endedInOT) result += ' (OT)';
                                        }

                                        const opponentColor = isHome ? game.awayTeamColor : game.homeTeamColor;

                                        return (
                                            <tr key={game.id}>
                                                <td>{formatDate(game.gameDate)}</td>
                                                <td>{formatTime(game.gameDate)}</td>
                                                <td>
                                                    <TeamBadge
                                                        teamName={opponentName}
                                                        teamColor={opponentColor}
                                                        className="opponent-link"
                                                        onClick={() => navigate(`/teams/${opponentId}`)}
                                                    />
                                                </td>
                                                <td><span className={`result p-tag ${result.startsWith('W') ? 'win' : result.startsWith('L') ? 'loss' : ''}`}>{result}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p>No games found for this season.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerDashboard;
