import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import GameSchedule from './GameSchedule';
import LiveScoreEntry from './LiveScoreEntry';
import Standings from './Standings';

function Scorekeeper() {
    const [currentView, setCurrentView] = useState('schedule');
    const [selectedGame, setSelectedGame] = useState(null);
    const [games, setGames] = useState([]);
    const { user, logout } = useAuth();

    useEffect(() => {
        loadGames();
    }, []);

    const loadGames = async () => {
        try {
            const gamesData = await api.getGames();
            setGames(gamesData);
        } catch (error) {
            console.error('Error loading games:', error);
        }
    };

    const handleSelectGame = (game) => {
        setSelectedGame(game);
        setCurrentView('livescoreentry');
    };

    const handleBackToSchedule = () => {
        setSelectedGame(null);
        setCurrentView('schedule');
    };

    const handleGameUpdated = (updatedGame) => {
        setGames(games.map(g => g.id === updatedGame.id ? updatedGame : g));
        if (selectedGame?.id === updatedGame.id) {
            setSelectedGame(updatedGame);
        }
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>🏒 OBHL Scorekeeper</h1>
                <nav className="app-nav">
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
                </nav>
                <div className="user-info">
                    <span>Welcome, {user?.email}</span>
                    <button onClick={logout} className="logout-btn">Logout</button>
                </div>
            </header>

            <main className="app-main">
                {currentView === 'schedule' && (
                    <GameSchedule games={games} onSelectGame={handleSelectGame} />
                )}

                {currentView === 'livescoreentry' && (
                    <LiveScoreEntry
                        game={selectedGame}
                        onBack={handleBackToSchedule}
                        onGameUpdated={handleGameUpdated}
                    />
                )}

                {currentView === 'standings' && (
                    <Standings />
                )}
            </main>
        </div>
    );
}

export default Scorekeeper;
