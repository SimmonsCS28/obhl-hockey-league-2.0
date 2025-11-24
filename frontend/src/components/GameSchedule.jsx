import { useState } from 'react';
import './GameSchedule.css';

function GameSchedule({ games, onSelectGame }) {
    const [filter, setFilter] = useState('all');

    const filteredGames = filter === 'all'
        ? games
        : games.filter(g => g.status === filter);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="game-schedule">
            <div className="schedule-header">
                <h2>Game Schedule</h2>
                <div className="filters">
                    <button
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All Games
                    </button>
                    <button
                        className={`filter-btn ${filter === 'scheduled' ? 'active' : ''}`}
                        onClick={() => setFilter('scheduled')}
                    >
                        Scheduled
                    </button>
                    <button
                        className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
                        onClick={() => setFilter('in_progress')}
                    >
                        In Progress
                    </button>
                    <button
                        className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                        onClick={() => setFilter('completed')}
                    >
                        Completed
                    </button>
                </div>
            </div>

            <div className="games-list">
                {filteredGames.length === 0 ? (
                    <div className="no-games">No games found</div>
                ) : (
                    filteredGames.map(game => (
                        <div
                            key={game.id}
                            className="game-card"
                            onClick={() => onSelectGame(game)}
                        >
                            <div className="game-header">
                                <span className="game-date">{formatDate(game.gameDate)}</span>
                                <span className={`game-status ${game.status}`}>
                                    {game.status.replace('_', ' ')}
                                </span>
                            </div>
                            <div className="game-matchup">
                                <div className="team">
                                    <div className="team-name">{game.homeTeamName}</div>
                                    {game.status !== 'scheduled' && (
                                        <div className="team-score">
                                            {game.homeScore}
                                            {game.endedInOT && game.status === 'completed' && (
                                                <span className="ot-badge">OT</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="vs">VS</div>
                                <div className="team">
                                    <div className="team-name">{game.awayTeamName}</div>
                                    {game.status !== 'scheduled' && (
                                        <div className="team-score">{game.awayScore}</div>
                                    )}
                                </div>
                            </div>
                            {game.venue && (
                                <div className="game-venue">📍 {game.venue}</div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default GameSchedule;
