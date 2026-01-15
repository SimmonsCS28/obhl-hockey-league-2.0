import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './ScorekeeperDashboard.css';

function ScorekeeperDashboard() {
    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadCurrentWeekGames();
    }, []);

    const loadCurrentWeekGames = async () => {
        try {
            setLoading(true);

            // Load teams and seasons
            const [teamsData, seasonsData] = await Promise.all([
                api.getTeams(),
                api.getSeasons()
            ]);

            setTeams(teamsData);

            // Get active season
            const activeSeason = seasonsData.find(s => s.isActive) || seasonsData[0];

            if (activeSeason) {
                // Load all games for the active season
                const gamesData = await api.getGames(activeSeason.id);

                // Get current week number (calculate from current date)
                const currentWeek = getCurrentWeek(gamesData);

                // Filter to current week only
                const currentWeekGames = gamesData
                    .filter(game => game.week === currentWeek)
                    .map(game => enrichGameWithTeamData(game, teamsData));

                setGames(currentWeekGames);
            }
        } catch (error) {
            console.error('Error loading games:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCurrentWeek = (allGames) => {
        // Find the week containing today's date or the next upcoming week
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Group games by week
        const gamesByWeek = {};
        allGames.forEach(game => {
            if (!gamesByWeek[game.week]) {
                gamesByWeek[game.week] = [];
            }
            gamesByWeek[game.week].push(game);
        });

        // Find current or next week
        for (const week of Object.keys(gamesByWeek).sort((a, b) => a - b)) {
            const weekGames = gamesByWeek[week];
            const latestGameInWeek = new Date(Math.max(...weekGames.map(g => new Date(g.gameDate))));

            if (latestGameInWeek >= now) {
                return parseInt(week);
            }
        }

        // Default to highest week if all games are in the past
        return Math.max(...allGames.map(g => g.week));
    };

    const enrichGameWithTeamData = (game, teamsData) => {
        const homeTeam = teamsData.find(t => t.id === game.homeTeamId);
        const awayTeam = teamsData.find(t => t.id === game.awayTeamId);

        return {
            ...game,
            homeTeamName: homeTeam?.name || `Team ${game.homeTeamId}`,
            awayTeamName: awayTeam?.name || `Team ${game.awayTeamId}`,
            homeTeamColor: homeTeam?.teamColor || '#6b7280',
            awayTeamColor: awayTeam?.teamColor || '#6b7280'
        };
    };

    const getValidColor = (color) => {
        if (!color) return '#6b7280';
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

    const handleSelectGame = (game) => {
        navigate(`/scorekeeper/game/${game.id}`);
    };

    const formatGameTime = (gameDate) => {
        const date = new Date(gameDate.endsWith('Z') ? gameDate : gameDate + 'Z');
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="scorekeeper-dashboard">
                <div className="loading">Loading current week games...</div>
            </div>
        );
    }

    return (
        <div className="scorekeeper-dashboard">
            <h2>Select a Game to Score</h2>

            {games.length === 0 ? (
                <div className="no-games">
                    <p>No games scheduled for this week.</p>
                    <p>Check back soon!</p>
                </div>
            ) : (
                <div className="games-grid">
                    {games.map(game => {
                        const homeBg = getValidColor(game.homeTeamColor);
                        const awayBg = getValidColor(game.awayTeamColor);
                        const homeTextColor = getTextColor(homeBg);
                        const awayTextColor = getTextColor(awayBg);
                        const isCompleted = game.homeScore !== null && game.awayScore !== null;

                        return (
                            <div
                                key={game.id}
                                className={`game-card ${isCompleted ? 'completed' : ''}`}
                                onClick={() => handleSelectGame(game)}
                            >
                                <div className="game-time">
                                    {formatGameTime(game.gameDate)}
                                </div>

                                <div className="teams-matchup">
                                    <div
                                        className="team-badge"
                                        style={{
                                            backgroundColor: homeBg,
                                            color: homeTextColor
                                        }}
                                    >
                                        {game.homeTeamName}
                                    </div>
                                    <div className="vs">vs</div>
                                    <div
                                        className="team-badge"
                                        style={{
                                            backgroundColor: awayBg,
                                            color: awayTextColor
                                        }}
                                    >
                                        {game.awayTeamName}
                                    </div>
                                </div>

                                <div className="game-location">
                                    📍 {game.rink}
                                </div>

                                {isCompleted && (
                                    <div className="completed-badge">
                                        ✓ Completed
                                    </div>
                                )}

                                <button className="select-btn">
                                    {isCompleted ? 'View Score Entry' : 'Start Score Entry'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ScorekeeperDashboard;
