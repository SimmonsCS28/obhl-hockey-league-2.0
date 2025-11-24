import { useEffect, useState } from 'react';
import './App.css';
import GameSchedule from './components/GameSchedule';
import LiveScoreEntry from './components/LiveScoreEntry';
import Standings from './components/Standings';
import api from './services/api';

function App() {
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
  };

  const handleGameUpdated = (updatedGame) => {
    // Update the game in the games list
    setGames(games.map(g => g.id === updatedGame.id ? updatedGame : g));
    // Update selected game if it's the same one
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

export default App;
