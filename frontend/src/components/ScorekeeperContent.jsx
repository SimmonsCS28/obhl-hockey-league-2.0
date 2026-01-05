import { useEffect, useState } from 'react';
import api from '../services/api';
import GameSchedule from './GameSchedule';
import LiveScoreEntry from './LiveScoreEntry';
import './ScorekeeperContent.css';
import Standings from './Standings';

function ScorekeeperContent() {
    const [currentView, setCurrentView] = useState('schedule');
    const [selectedGame, setSelectedGame] = useState(null);
    const [games, setGames] = useState([]);

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
        loadGames(); // Refresh to see updated scores
    };

    const handleGameUpdated = (updatedGame) => {
        setGames(games.map(g => g.id === updatedGame.id ? updatedGame : g));
        if (selectedGame?.id === updatedGame.id) {
            setSelectedGame(updatedGame);
        }
    };

    return (
        <div className="scorekeeper-content">
            <nav className="scorekeeper-nav">
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

            <div className="scorekeeper-body">
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
            </div>
        </div>
    );
}

export default ScorekeeperContent;
