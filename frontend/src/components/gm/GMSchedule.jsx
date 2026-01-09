import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './GMSchedule.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function GMSchedule() {
    const { user } = useAuth();
    const [games, setGames] = useState([]);
    const [filteredGames, setFilteredGames] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.teamId) {
            fetchSchedule();
        }
    }, [user]);

    useEffect(() => {
        filterGames();
    }, [selectedWeek, games]);

    const fetchSchedule = async () => {
        try {
            // Get active season
            const seasonsRes = await axios.get(`${API_BASE_URL}/seasons`);
            const activeSeason = seasonsRes.data.find(s => s.isActive);

            if (activeSeason) {
                const gamesRes = await axios.get(`${API_BASE_URL}/gm/team/${user.teamId}/schedule?seasonId=${activeSeason.id}`);
                setGames(gamesRes.data);

                // Extract unique weeks
                const uniqueWeeks = [...new Set(gamesRes.data.map(g => g.week))].sort((a, b) => a - b);
                setWeeks(uniqueWeeks);
            }
        } catch (error) {
            console.error('Failed to fetch schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterGames = () => {
        if (selectedWeek === 'all') {
            setFilteredGames(games);
        } else {
            setFilteredGames(games.filter(g => g.week === parseInt(selectedWeek)));
        }
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="gm-schedule">
            <div className="schedule-header">
                <h1>My Schedule</h1>
                {weeks.length > 0 && (
                    <div className="week-filter">
                        <label>Filter by week:</label>
                        <select
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(e.target.value)}
                            className="week-select"
                        >
                            <option value="all">All Weeks</option>
                            {weeks.map(week => (
                                <option key={week} value={week}>Week {week}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="games-list">
                {filteredGames.length > 0 ? (
                    filteredGames.map(game => {
                        const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                        const isHomeGame = game.homeTeamId === user.teamId;

                        return (
                            <div key={game.id} className="game-card">
                                <div className="game-week">Week {game.week}</div>
                                <div className="game-date-time">
                                    <div className="game-date">{gameDate.toLocaleDateString()}</div>
                                    <div className="game-time">{gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                <div className="game-matchup">
                                    <div className={isHomeGame ? 'team-us' : 'team-opponent'}>
                                        {isHomeGame ? 'Us (Home)' : game.homeTeamName}
                                    </div>
                                    <div className="vs">vs</div>
                                    <div className={!isHomeGame ? 'team-us' : 'team-opponent'}>
                                        {!isHomeGame ? 'Us (Away)' : game.awayTeamName}
                                    </div>
                                </div>
                                <div className="game-location">
                                    📍 {game.rink}
                                </div>
                                {game.homeScore !== null && game.awayScore !== null && (
                                    <div className="game-result">
                                        Result: {game.homeScore} - {game.awayScore}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <p className="no-data">No games scheduled</p>
                )}
            </div>
        </div>
    );
}

export default GMSchedule;
