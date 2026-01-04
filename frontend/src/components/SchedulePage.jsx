import axios from 'axios';
import { useEffect, useState } from 'react';
import './SchedulePage.css';

const SchedulePage = () => {
    const [seasons, setSeasons] = useState([]);
    const [teams, setTeams] = useState([]);
    const [games, setGames] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [selectedTeam, setSelectedTeam] = useState('all');
    const [loading, setLoading] = useState(false);

    // Fetch seasons on mount
    useEffect(() => {
        fetchSeasons();
    }, []);

    // Fetch teams and games when season changes
    useEffect(() => {
        if (selectedSeason) {
            fetchTeams(selectedSeason);
            fetchGames(selectedSeason);
        }
    }, [selectedSeason]);

    const fetchSeasons = async () => {
        try {
            const response = await axios.get('http://localhost:8000/api/v1/seasons');
            setSeasons(response.data);
            // Default to active season
            const activeSeason = response.data.find(s => s.isActive);
            if (activeSeason) {
                setSelectedSeason(activeSeason.id);
            }
        } catch (error) {
            console.error('Failed to load seasons:', error);
        }
    };

    const fetchTeams = async (seasonId) => {
        try {
            const response = await axios.get(`http://localhost:8000/api/v1/teams?seasonId=${seasonId}`);
            setTeams(response.data);
        } catch (error) {
            console.error('Failed to load teams:', error);
        }
    };

    const fetchGames = async (seasonId) => {
        setLoading(true);
        try {
            const response = await axios.get(`http://localhost:8002/api/v1/games?seasonId=${seasonId}`);
            setGames(response.data);
        } catch (error) {
            console.error('Failed to load games:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTeamById = (teamId) => {
        return teams.find(t => t.id === teamId);
    };

    // Filter games based on selected week and team
    const filteredGames = games.filter(game => {
        const weekMatch = selectedWeek === 'all' || game.week === parseInt(selectedWeek);
        const teamMatch = selectedTeam === 'all' ||
            game.homeTeamId === parseInt(selectedTeam) ||
            game.awayTeamId === parseInt(selectedTeam);
        return weekMatch && teamMatch;
    });

    // Group games by week
    const groupGamesByWeek = () => {
        const grouped = {};
        filteredGames.forEach(game => {
            const week = game.week || 'Unassigned';
            if (!grouped[week]) {
                grouped[week] = [];
            }
            grouped[week].push(game);
        });

        // Sort games within each week by date
        Object.keys(grouped).forEach(week => {
            grouped[week].sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
        });

        return grouped;
    };

    const gamesByWeek = groupGamesByWeek();
    const weeks = Object.keys(gamesByWeek).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return parseInt(a) - parseInt(b);
    });

    // Get unique weeks for filter dropdown
    const availableWeeks = [...new Set(games.map(g => g.week))].sort((a, b) => a - b);

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <h1>Game Schedule</h1>
            </div>

            <div className="filters">
                <div className="filter-group">
                    <label>Season</label>
                    <select
                        value={selectedSeason || ''}
                        onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                        className="filter-select"
                    >
                        {seasons.map(season => (
                            <option key={season.id} value={season.id}>
                                {season.name} {season.isActive ? '(Active)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Week</label>
                    <select
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Weeks</option>
                        {availableWeeks.map(week => (
                            <option key={week} value={week}>Week {week}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Team</label>
                    <select
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Teams</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading games...</div>
            ) : filteredGames.length === 0 ? (
                <div className="empty-state">
                    <p>No games scheduled yet.</p>
                </div>
            ) : (
                <div className="schedule-grid">
                    {weeks.map(week => (
                        <div key={week} className="week-section">
                            <h2>Week {week}</h2>
                            <div className="games-list">
                                {gamesByWeek[week].map(game => {
                                    const homeTeam = getTeamById(game.homeTeamId);
                                    const awayTeam = getTeamById(game.awayTeamId);
                                    const gameDate = new Date(game.gameDate);
                                    const dayOfWeek = gameDate.getDay(); // 0=Sunday, 5=Friday
                                    const isNotFriday = dayOfWeek !== 5;
                                    const dayName = gameDate.toLocaleDateString('en-US', { weekday: 'long' });

                                    return (
                                        <div
                                            key={game.id}
                                            className={`game-card ${isNotFriday ? 'non-friday-game' : ''}`}
                                        >
                                            {isNotFriday && (
                                                <div className="day-badge">
                                                    ⚠️ {dayName.toUpperCase()}
                                                </div>
                                            )}
                                            <div className="game-date">
                                                {gameDate.toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                            <div className="game-time">
                                                {gameDate.toLocaleTimeString('en-US', {
                                                    hour: 'numeric',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                            <div className="game-teams">
                                                <span
                                                    className="team-badge"
                                                    style={{ backgroundColor: homeTeam?.teamColor || '#95a5a6' }}
                                                >
                                                    {homeTeam?.name || `Team ${game.homeTeamId}`}
                                                </span>
                                                <span className="vs">vs</span>
                                                <span
                                                    className="team-badge"
                                                    style={{ backgroundColor: awayTeam?.teamColor || '#95a5a6' }}
                                                >
                                                    {awayTeam?.name || `Team ${game.awayTeamId}`}
                                                </span>
                                            </div>
                                            <div className="game-location">
                                                📍 {game.rink}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SchedulePage;
