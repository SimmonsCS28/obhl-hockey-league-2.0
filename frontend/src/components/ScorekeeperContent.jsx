import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import GameSchedule from './GameSchedule';
import LiveScoreEntry from './LiveScoreEntry';
import './ScorekeeperContent.css';
import Standings from './Standings';

function ScorekeeperContent() {
    const [currentView, setCurrentView] = useState('schedule');
    const [selectedGame, setSelectedGame] = useState(null);
    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [seasons, setSeasons] = useState([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedSeasonId && teams.length > 0) {
            loadGames(selectedSeasonId);
        }
    }, [selectedSeasonId, teams]);

    // Get unique weeks from games
    const availableWeeks = useMemo(() => {
        const weeks = [...new Set(games.map(g => g.week).filter(w => w != null))];
        return weeks.sort((a, b) => a - b);
    }, [games]);

    // Filter games by selected week
    const filteredGames = useMemo(() => {
        if (selectedWeek === 'all') {
            return games;
        }
        return games.filter(g => g.week === Number(selectedWeek));
    }, [games, selectedWeek]);

    // Reset week filter when season changes
    useEffect(() => {
        setSelectedWeek('all');
    }, [selectedSeasonId]);

    const loadInitialData = async () => {
        try {
            // Load teams and seasons in parallel
            const [teamsData, seasonsData] = await Promise.all([
                api.getTeams(),
                api.getSeasons()
            ]);

            setTeams(teamsData);
            setSeasons(seasonsData);

            // Auto-select the most recent (or active) season
            if (seasonsData.length > 0) {
                const activeSeason = seasonsData.find(s => s.isActive) || seasonsData[0];
                setSelectedSeasonId(activeSeason.id);
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTeamName = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : `Team ${teamId}`;
    };

    const enrichGamesWithTeamNames = (gamesData) => {
        return gamesData.map(game => {
            const homeTeam = teams.find(t => Number(t.id) === Number(game.homeTeamId));
            const awayTeam = teams.find(t => Number(t.id) === Number(game.awayTeamId));
            return {
                ...game,
                homeTeamName: homeTeam?.name || `Team ${game.homeTeamId}`,
                awayTeamName: awayTeam?.name || `Team ${game.awayTeamId}`,
                homeTeamColor: homeTeam?.teamColor || '#6b7280',
                awayTeamColor: awayTeam?.teamColor || '#6b7280'
            };
        });
    };

    const loadGames = async (seasonId) => {
        try {
            const gamesData = await api.getGames(seasonId);
            const enrichedGames = enrichGamesWithTeamNames(gamesData);
            setGames(enrichedGames);
        } catch (error) {
            console.error('Error loading games:', error);
            setGames([]);
        }
    };

    const handleSelectGame = (game) => {
        // Also enrich with team objects for LiveScoreEntry
        const homeTeam = teams.find(t => t.id === game.homeTeamId);
        const awayTeam = teams.find(t => t.id === game.awayTeamId);
        setSelectedGame({ ...game, homeTeam, awayTeam });
        setCurrentView('livescoreentry');
    };

    const handleBackToSchedule = () => {
        setSelectedGame(null);
        setCurrentView('schedule');
        if (selectedSeasonId) {
            loadGames(selectedSeasonId); // Refresh to see updated scores
        }
    };

    const handleGameUpdated = (updatedGame) => {
        const enrichedGame = {
            ...updatedGame,
            homeTeamName: getTeamName(updatedGame.homeTeamId),
            awayTeamName: getTeamName(updatedGame.awayTeamId)
        };
        setGames(games.map(g => g.id === enrichedGame.id ? enrichedGame : g));
        if (selectedGame?.id === enrichedGame.id) {
            const homeTeam = teams.find(t => t.id === enrichedGame.homeTeamId);
            const awayTeam = teams.find(t => t.id === enrichedGame.awayTeamId);
            setSelectedGame({ ...enrichedGame, homeTeam, awayTeam });
        }
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="scorekeeper-content">
            <nav className="scorekeeper-nav">
                <div className="nav-left">
                    <button
                        className={`nav-btn ${currentView === 'schedule' ? 'active' : ''}`}
                        onClick={() => setCurrentView('schedule')}
                    >
                        Game Schedule
                    </button>
                    <button
                        className={`nav-btn ${currentView === 'livescoreentry' ? 'active' : ''}`}
                        onClick={() => setCurrentView('livescoreentry')}
                        disabled={!selectedGame}
                    >
                        Live Score Entry
                    </button>
                    <button
                        className={`nav-btn ${currentView === 'standings' ? 'active' : ''}`}
                        onClick={() => setCurrentView('standings')}
                    >
                        Standings
                    </button>
                </div>
                <div className="nav-right">
                    <label>Season: </label>
                    <select
                        value={selectedSeasonId || ''}
                        onChange={(e) => setSelectedSeasonId(Number(e.target.value))}
                        className="season-select"
                    >
                        {seasons.map(season => (
                            <option key={season.id} value={season.id}>
                                {season.name}
                            </option>
                        ))}
                    </select>

                    <label>Week: </label>
                    <select
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="week-select"
                    >
                        <option value="all">All Weeks</option>
                        {availableWeeks.map(week => (
                            <option key={week} value={week}>
                                Week {week}
                            </option>
                        ))}
                    </select>
                </div>
            </nav>

            <div className="scorekeeper-body">
                {currentView === 'schedule' && (
                    <GameSchedule games={filteredGames} onSelectGame={handleSelectGame} />
                )}

                {currentView === 'livescoreentry' && (
                    <LiveScoreEntry
                        game={selectedGame}
                        teams={teams}
                        onBack={handleBackToSchedule}
                        onGameUpdated={handleGameUpdated}
                    />
                )}

                {currentView === 'standings' && (
                    <Standings />
                )}
            </div>
        </div>
    );
}

export default ScorekeeperContent;
