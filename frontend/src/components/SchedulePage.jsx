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
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

    // Responsive detection
    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    // Set default to upcoming week when games load
    useEffect(() => {
        if (games.length > 0 && selectedWeek === 'all') {
            const today = new Date();

            // Find the next week with games after today
            const upcomingGames = games.filter(g => {
                const gameDate = new Date(g.gameDate.endsWith('Z') ? g.gameDate : g.gameDate + 'Z');
                return gameDate >= today;
            });

            if (upcomingGames.length > 0) {
                // Get the earliest upcoming game's week
                const sortedUpcoming = upcomingGames.sort((a, b) => {
                    const dateA = new Date(a.gameDate.endsWith('Z') ? a.gameDate : a.gameDate + 'Z');
                    const dateB = new Date(b.gameDate.endsWith('Z') ? b.gameDate : b.gameDate + 'Z');
                    return dateA - dateB;
                });

                const nextWeek = sortedUpcoming[0].week;
                if (nextWeek) {
                    setSelectedWeek(nextWeek.toString());
                }
            }
        }
    }, [games]);

    const fetchSeasons = async () => {
        try {
            const response = await axios.get('/api/v1/seasons');
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
            const response = await axios.get(`/api/v1/teams?seasonId=${seasonId}`);
            setTeams(response.data);
        } catch (error) {
            console.error('Failed to load teams:', error);
        }
    };

    const fetchGames = async (seasonId) => {
        setLoading(true);
        try {
            const response = await axios.get(`/games-api/games?seasonId=${seasonId}`);
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

    // Filter games based on selected week, team, and completion status
    const filteredGames = games.filter(game => {
        const weekMatch = selectedWeek === 'all' || game.week === parseInt(selectedWeek);
        const teamMatch = selectedTeam === 'all' ||
            game.homeTeamId === parseInt(selectedTeam) ||
            game.awayTeamId === parseInt(selectedTeam);

        // Filter out completed games if showCompleted is false
        const isCompleted = game.homeScore !== null && game.awayScore !== null;
        const completedMatch = showCompleted || !isCompleted;

        return weekMatch && teamMatch && completedMatch;
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

    // Helper to get valid CSS color
    const getValidColor = (color) => {
        if (!color) return '#95a5a6';

        // Map truncated DB values to valid CSS colors
        const colorMap = {
            'Lt. Blu': '#87CEEB', // SkyBlue
            'Dk. Gre': '#006400', // DarkGreen
            'White': '#FFFFFF',
            'Yellow': '#FFD700',
            'Gold': '#FFD700'
        };

        return colorMap[color] || color;
    };

    // Helper to determine text color based on background
    const getTextColor = (bgColor) => {
        if (!bgColor) return 'white';

        const lightColors = [
            'White', '#FFFFFF',
            'Yellow', '#FFD700',
            'Gold',
            'Lt. Blu', '#87CEEB', 'LightBlue'
        ];

        // Check if color is in light list (case insensitive)
        const isLight = lightColors.some(c =>
            c.toLowerCase() === bgColor.toLowerCase()
        );

        return isLight ? '#2c3e50' : 'white';
    };

    // Generate ICS calendar file for a specific team
    const generateICS = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return;

        // Filter games for this team
        const teamGames = games.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId);

        // Start ICS file
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//OBHL//Hockey Schedule//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:${team.name} - OBHL Schedule`,
            'X-WR-TIMEZONE:America/Chicago',
        ];

        // Add each game as an event
        teamGames.forEach((game, index) => {
            const homeTeam = getTeamById(game.homeTeamId);
            const awayTeam = getTeamById(game.awayTeamId);

            // Parse game date (assuming it's in UTC)
            const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');

            // Format datetime for ICS (YYYYMMDDTHHMMSSZ)
            const formatICSDate = (date) => {
                return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };

            // Game duration: 1.5 hours
            const endDate = new Date(gameDate.getTime() + (90 * 60 * 1000));

            const summary = `${homeTeam?.name || 'TBD'} vs ${awayTeam?.name || 'TBD'}`;
            const description = `Week ${game.week || 'TBD'} - ${homeTeam?.name || 'TBD'} vs ${awayTeam?.name || 'TBD'}`;

            icsContent.push(
                'BEGIN:VEVENT',
                `UID:obhl-game-${game.id}@oldbuzzardhockey.com`,
                `DTSTAMP:${formatICSDate(new Date())}`,
                `DTSTART:${formatICSDate(gameDate)}`,
                `DTEND:${formatICSDate(endDate)}`,
                `SUMMARY:${summary}`,
                `LOCATION:${game.rink || 'TBD'}`,
                `DESCRIPTION:${description}`,
                'STATUS:CONFIRMED',
                'SEQUENCE:0',
                'END:VEVENT'
            );
        });

        icsContent.push('END:VCALENDAR');

        // Create blob and trigger download
        const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `${team.name.replace(/\s+/g, '_')}_Schedule.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setShowCalendarModal(false);
    };

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <h1>Game Schedule</h1>
                <button
                    className="download-calendar-btn"
                    onClick={() => setShowCalendarModal(true)}
                    title="Download team schedule as calendar file"
                >
                    📅 Download Calendar
                </button>
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

                <div className="filter-group checkbox-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={showCompleted}
                            onChange={(e) => setShowCompleted(e.target.checked)}
                            className="checkbox-input"
                        />
                        <span>Show Completed Games</span>
                    </label>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading games...</div>
            ) : filteredGames.length === 0 ? (
                <div className="empty-state">
                    <p>No games scheduled yet.</p>
                </div>
            ) : isDesktop ? (
                // Desktop: Table View
                <div className="schedule-table-container">
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
                                const homeTeam = getTeamById(game.homeTeamId);
                                const awayTeam = getTeamById(game.awayTeamId);
                                const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                const dayOfWeek = gameDate.getDay();
                                const isNotFriday = dayOfWeek !== 5;
                                const dayName = gameDate.toLocaleDateString('en-US', { weekday: 'long' });
                                const isCompleted = game.homeScore !== null && game.awayScore !== null;

                                const homeBg = getValidColor(homeTeam?.teamColor);
                                const awayBg = getValidColor(awayTeam?.teamColor);

                                return (
                                    <tr key={game.id} className={isNotFriday ? 'non-friday-row' : ''}>
                                        <td className="week-col">
                                            Week {game.week}
                                            {isNotFriday && (
                                                <span className="day-warning" title={`Game on ${dayName}`}>
                                                    ⚠️
                                                </span>
                                            )}
                                        </td>
                                        <td>
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
                                                backgroundColor: homeBg,
                                                color: getTextColor(homeBg)
                                            }}
                                        >
                                            {homeTeam?.name || `Team ${game.homeTeamId}`}
                                        </td>
                                        <td
                                            className="team-cell"
                                            style={{
                                                backgroundColor: awayBg,
                                                color: getTextColor(awayBg)
                                            }}
                                        >
                                            {awayTeam?.name || `Team ${game.awayTeamId}`}
                                        </td>
                                        <td>{game.rink}</td>
                                        <td>
                                            {isCompleted ? (
                                                <span className="score">{game.homeScore} - {game.awayScore}</span>
                                            ) : (
                                                <span className="upcoming-badge">Upcoming</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                // Mobile: Compact Card View
                <div className="schedule-grid">
                    {weeks.map(week => (
                        <div key={week} className="week-section">
                            <h2>Week {week}</h2>
                            <div className="games-list">
                                {gamesByWeek[week].map(game => {
                                    const homeTeam = getTeamById(game.homeTeamId);
                                    const awayTeam = getTeamById(game.awayTeamId);
                                    const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                    const dayOfWeek = gameDate.getDay();
                                    const isNotFriday = dayOfWeek !== 5;
                                    const dayName = gameDate.toLocaleDateString('en-US', { weekday: 'long' });
                                    const isCompleted = game.homeScore !== null && game.awayScore !== null;

                                    const homeBg = getValidColor(homeTeam?.teamColor);
                                    const awayBg = getValidColor(awayTeam?.teamColor);

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
                                                    style={{
                                                        backgroundColor: homeBg,
                                                        color: getTextColor(homeBg)
                                                    }}
                                                >
                                                    {homeTeam?.name || `Team ${game.homeTeamId}`}
                                                </span>
                                                <span className="vs">vs</span>
                                                <span
                                                    className="team-badge"
                                                    style={{
                                                        backgroundColor: awayBg,
                                                        color: getTextColor(awayBg)
                                                    }}
                                                >
                                                    {awayTeam?.name || `Team ${game.awayTeamId}`}
                                                </span>
                                            </div>
                                            <div className="game-location">
                                                📍 {game.rink}
                                            </div>
                                            {isCompleted && (
                                                <div className="game-score-mobile">
                                                    Final: {game.homeScore} - {game.awayScore}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Calendar Download Modal */}
            {showCalendarModal && (
                <div className="calendar-modal-overlay" onClick={() => setShowCalendarModal(false)}>
                    <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Select Team</h2>
                        <p>Choose a team to download their schedule:</p>
                        <div className="team-selection">
                            {teams.map(team => (
                                <button
                                    key={team.id}
                                    className="team-select-btn"
                                    onClick={() => generateICS(team.id)}
                                    style={{
                                        backgroundColor: getValidColor(team.teamColor),
                                        color: getTextColor(team.teamColor)
                                    }}
                                >
                                    {team.name}
                                </button>
                            ))}
                        </div>
                        <button
                            className="modal-close-btn"
                            onClick={() => setShowCalendarModal(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchedulePage;
