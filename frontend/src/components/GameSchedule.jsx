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
        // Normalize to UTC if needed
        const normalizedDate = dateString.endsWith('Z') ? dateString : dateString + 'Z';
        const date = new Date(normalizedDate);
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

            <div className="schedule-table-container">
                {filteredGames.length === 0 ? (
                    <div className="no-games">No games found</div>
                ) : (
                    <table className="schedule-table">
                        <thead>
                            <tr>
                                <th>Week</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Home Team</th>
                                <th>Away Team</th>
                                <th>Location</th>
                                <th>Score/Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGames.map(game => {
                                const homeColor = getValidColor(game.homeTeamColor);
                                const awayColor = getValidColor(game.awayTeamColor);
                                const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                const dayOfWeek = gameDate.getDay();
                                const isNotFriday = dayOfWeek !== 5;
                                const dayName = gameDate.toLocaleDateString('en-US', { weekday: 'long' });
                                const isCompleted = game.status === 'completed';

                                return (
                                    <tr
                                        key={game.id}
                                        className={`clickable-row ${isNotFriday ? 'non-friday-row' : ''}`}
                                        onClick={() => onSelectGame(game)}
                                    >
                                        <td className="week-col">
                                            Week {game.week}
                                        </td>
                                        <td className={isNotFriday ? 'date-col non-friday-date' : 'date-col'}>
                                            <span className="day-warning" title={isNotFriday ? `Game on ${dayName}` : ''}>
                                                {isNotFriday ? '⚠️' : ''}
                                            </span>
                                            {gameDate.toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                        <td className="time-col">
                                            {gameDate.toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td
                                            className="team-cell"
                                            style={{
                                                backgroundColor: homeColor,
                                                color: getTextColor(homeColor)
                                            }}
                                        >
                                            {game.homeTeamName}
                                        </td>
                                        <td
                                            className="team-cell"
                                            style={{
                                                backgroundColor: awayColor,
                                                color: getTextColor(awayColor)
                                            }}
                                        >
                                            {game.awayTeamName}
                                        </td>
                                        <td>{game.rink || game.venue || 'TBD'}</td>
                                        <td>
                                            {isCompleted ? (
                                                <span className="score">
                                                    {game.homeScore} - {game.awayScore}
                                                    {game.endedInOT && <span className="ot-badge">OT</span>}
                                                </span>
                                            ) : game.status === 'in_progress' ? (
                                                <span className="in-progress-badge">In Progress</span>
                                            ) : (
                                                <span className="upcoming-badge">Scheduled</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default GameSchedule;
