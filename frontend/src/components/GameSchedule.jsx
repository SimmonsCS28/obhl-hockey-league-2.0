import { useState } from 'react';
import './GameSchedule.css';

// Color helper functions
const colorNameToHex = {
    'red': '#dc2626', 'blue': '#2563eb', 'green': '#16a34a', 'yellow': '#eab308',
    'orange': '#ea580c', 'purple': '#9333ea', 'pink': '#ec4899', 'black': '#1f2937',
    'white': '#f8fafc', 'gray': '#6b7280', 'grey': '#6b7280', 'navy': '#1e3a5a',
    'teal': '#0d9488', 'cyan': '#06b6d4', 'maroon': '#7f1d1d', 'gold': '#ca8a04',
    'silver': '#9ca3af', 'lime': '#84cc16', 'brown': '#78350f', 'beige': '#d4c4a8',
    'lt. blue': '#60a5fa', 'light blue': '#60a5fa', 'lt blue': '#60a5fa',
    // Truncated versions (DB column is 7 chars)
    'lt. blu': '#60a5fa', 'lt.blue': '#60a5fa', 'l. blue': '#60a5fa',
    'lt. gre': '#22c55e', 'lt. pin': '#f472b6', 'lt. ora': '#fb923c',
    'black &': '#1f2937', 'funboys': '#6b7280', 'tan': '#d4a574', 'khaki': '#c3b091'
};

const getValidColor = (color) => {
    if (!color) return '#6b7280';
    const c = color.toLowerCase().trim();
    if (colorNameToHex[c]) return colorNameToHex[c];
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c;
    if (/^rgb/.test(c)) return c;
    return '#6b7280';
};

const getTextColor = (bgColor) => {
    const hex = getValidColor(bgColor).replace('#', '');
    if (hex.length !== 6) return '#1f2937';
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#1f2937' : '#ffffff';
};

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
                    filteredGames.map(game => {
                        const homeColor = getValidColor(game.homeTeamColor);
                        const awayColor = getValidColor(game.awayTeamColor);

                        return (
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
                                        <div
                                            className="team-name"
                                            style={{
                                                backgroundColor: homeColor,
                                                color: getTextColor(homeColor)
                                            }}
                                        >
                                            {game.homeTeamName}
                                        </div>
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
                                        <div
                                            className="team-name"
                                            style={{
                                                backgroundColor: awayColor,
                                                color: getTextColor(awayColor)
                                            }}
                                        >
                                            {game.awayTeamName}
                                        </div>
                                        {game.status !== 'scheduled' && (
                                            <div className="team-score">{game.awayScore}</div>
                                        )}
                                    </div>
                                </div>
                                {game.venue && (
                                    <div className="game-venue">📍 {game.venue}</div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default GameSchedule;
