import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlayoffBracket from './PlayoffBracket';
import { resolveTeamColor } from '../constants/teamColors';
import heroBg from '../assets/images/buzzard-full.jpg';
import './SchedulePage.css';

const parseGameDate = (s) => new Date(s.endsWith('Z') ? s : s + 'Z');

// Current week = lowest week number that still has an un-played game, falling
// back to the last week once the whole regular season is complete.
const computeCurrentWeek = (gamesList) => {
    const regular = gamesList.filter(g => g.gameType !== 'PLAYOFF');
    const weeks = [...new Set(regular.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b);
    for (const w of weeks) {
        const wkGames = regular.filter(g => g.week === w);
        if (wkGames.some(g => g.status !== 'completed')) return w;
    }
    return weeks.length ? weeks[weeks.length - 1] : null;
};

const SchedulePage = () => {
    const navigate = useNavigate();
    const [seasons, setSeasons] = useState([]);
    const [teams, setTeams] = useState([]);
    const [games, setGames] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [selectedTeam, setSelectedTeam] = useState('all');
    // Defaults to showing completed games since a specific week (usually the
    // current one) is auto-selected on load — hiding them would make an
    // already-underway week look incomplete.
    const [showCompleted, setShowCompleted] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [activeTab, setActiveTab] = useState('regular'); // 'regular' | 'playoffs'

    useEffect(() => { fetchSeasons(); }, []);

    useEffect(() => {
        if (selectedSeason) {
            fetchTeams(selectedSeason);
            fetchGames(selectedSeason);
        }
    }, [selectedSeason]);

    const fetchSeasons = async () => {
        try {
            const response = await axios.get('/api/v1/seasons');
            setSeasons(response.data);
            const active = response.data.find(s => s.isActive);
            if (active) setSelectedSeason(active.id);
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
            setSelectedWeek(String(computeCurrentWeek(response.data) ?? 'all'));
        } catch (error) {
            console.error('Failed to load games:', error);
        } finally {
            setLoading(false);
        }
    };

    const teamById = (id) => teams.find(t => t.id === id);
    const teamName = (id) => teamById(id)?.name || 'TBD';
    const teamColor = (id) => resolveTeamColor(teamById(id)?.teamColor);

    const regularSeasonGames = games.filter(g => g.gameType !== 'PLAYOFF');
    const playoffGames = games.filter(g => g.gameType === 'PLAYOFF');
    const hasPlayoffs = playoffGames.length > 0;

    const availableWeeks = [...new Set(regularSeasonGames.map(g => g.week).filter(w => w != null))]
        .sort((a, b) => a - b);

    const currentWeek = computeCurrentWeek(games);

    const weekStatus = (w) => {
        const wkGames = regularSeasonGames.filter(g => g.week === w);
        if (wkGames.length > 0 && wkGames.every(g => g.status === 'completed')) {
            return { label: 'Completed', cls: 'is-completed' };
        }
        if (w === currentWeek) return { label: 'This Week', cls: 'is-thisweek' };
        return { label: 'Scheduled', cls: 'is-scheduled' };
    };

    const weekRange = (wkGames) => {
        const dates = wkGames.map(g => parseGameDate(g.gameDate)).sort((a, b) => a - b);
        if (dates.length === 0) return '';
        const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const first = fmt(dates[0]);
        const last = fmt(dates[dates.length - 1]);
        return first === last ? first : `${first} – ${last}`;
    };

    const filtered = regularSeasonGames.filter(g => {
        const weekMatch = selectedWeek === 'all' || g.week === parseInt(selectedWeek);
        const teamMatch = selectedTeam === 'all' ||
            g.homeTeamId === parseInt(selectedTeam) || g.awayTeamId === parseInt(selectedTeam);
        const completedMatch = showCompleted || g.status !== 'completed';
        return weekMatch && teamMatch && completedMatch;
    });

    const weeksToShow = availableWeeks.filter(w => filtered.some(g => g.week === w));

    const generateICS = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return;
        const teamGames = games.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId);
        const lines = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OBHL//Hockey Schedule//EN',
            'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
            `X-WR-CALNAME:${team.name} - OBHL Schedule`, 'X-WR-TIMEZONE:America/Chicago',
        ];
        const fmtICS = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        teamGames.forEach((game) => {
            const start = parseGameDate(game.gameDate);
            const end = new Date(start.getTime() + 90 * 60 * 1000);
            lines.push(
                'BEGIN:VEVENT', `UID:obhl-game-${game.id}@oldbuzzardhockey.com`,
                `DTSTAMP:${fmtICS(new Date())}`, `DTSTART:${fmtICS(start)}`, `DTEND:${fmtICS(end)}`,
                `SUMMARY:${teamName(game.homeTeamId)} vs ${teamName(game.awayTeamId)}`,
                `LOCATION:${game.rink || 'TBD'}`,
                `DESCRIPTION:Week ${game.week || 'TBD'} - ${teamName(game.homeTeamId)} vs ${teamName(game.awayTeamId)}`,
                'STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT'
            );
        });
        lines.push('END:VCALENDAR');
        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `${team.name.replace(/\s+/g, '_')}_Schedule.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowCalendarModal(false);
    };

    const renderGameRow = (game) => {
        const done = game.status === 'completed';
        const d = parseGameDate(game.gameDate);
        const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const homeWin = done && game.homeScore > game.awayScore;
        const awayWin = done && game.awayScore > game.homeScore;

        return (
            <div key={game.id} className={`obi-game-row ${done ? 'is-done' : 'is-upcoming'}`}>
                <div className="obi-game-date">
                    <div className="obi-game-day">{day}</div>
                    <div className="obi-game-datenum">{date}</div>
                </div>

                <div className="obi-game-match">
                    <div className="obi-game-teams">
                        <span className="obi-game-team obi-game-team-home">
                            {game.homeTeamId ? (
                                <Link to={`/teams/${game.homeTeamId}`} className="obi-game-team-name">{teamName(game.homeTeamId)}</Link>
                            ) : <span className="obi-game-team-name obi-tbd">TBD</span>}
                            <span className="obi-team-dot" style={{ background: teamColor(game.homeTeamId) }} />
                        </span>

                        {done ? (
                            <span className="obi-game-score">
                                <span className={homeWin ? 'obi-win' : 'obi-lose'}>{game.homeScore ?? 0}</span>
                                <span className="obi-score-sep">–</span>
                                <span className={awayWin ? 'obi-win' : 'obi-lose'}>{game.awayScore ?? 0}</span>
                            </span>
                        ) : (
                            <span className="obi-game-vs">VS</span>
                        )}

                        <span className="obi-game-team obi-game-team-away">
                            <span className="obi-team-dot" style={{ background: teamColor(game.awayTeamId) }} />
                            {game.awayTeamId ? (
                                <Link to={`/teams/${game.awayTeamId}`} className="obi-game-team-name">{teamName(game.awayTeamId)}</Link>
                            ) : <span className="obi-game-team-name obi-tbd">TBD</span>}
                        </span>
                    </div>
                    <div className="obi-game-meta">
                        {done ? 'Final' : time}{game.rink ? ` · ${game.rink}` : ''}
                    </div>
                </div>

                <button
                    className={`obi-game-btn ${done ? 'obi-btn-recap' : 'obi-btn-preview'}`}
                    onClick={() => navigate(`/game/${game.id}/${done ? 'recap' : 'preview'}`)}
                >
                    {done ? 'Recap' : 'Preview'}
                </button>
            </div>
        );
    };

    return (
        <div className="obi-page obi-schedule">
            <section className="obi-page-hero">
                <img src={heroBg} alt="" className="obi-page-hero-bg" />
                <div className="obi-page-hero-overlay" />
                <div className="obi-page-hero-inner">
                    <div className="obi-eyebrow">Old Buzzard Hockey League</div>
                    <h1 className="obi-page-title">SCHEDULE</h1>
                    <p className="obi-page-sub">All games at the Sun Prairie Ice Arena.</p>
                </div>
            </section>

            <section className="obi-schedule-body">
                <div className="obi-container">
                    {/* Toolbar */}
                    <div className="obi-schedule-toolbar">
                        <div className="obi-schedule-selects">
                            {seasons.length > 0 && (
                                <select
                                    className="obi-season-select"
                                    value={selectedSeason || ''}
                                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                >
                                    {seasons.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}{s.isActive ? ' (Active)' : ''}</option>
                                    ))}
                                </select>
                            )}
                            <select
                                className="obi-season-select"
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                            >
                                <option value="all">All Teams</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            {/* Functionality restored from the pre-redesign schedule; not yet
                                through a design pass — plain checkbox for now. */}
                            <label className="obi-show-completed">
                                <input
                                    type="checkbox"
                                    checked={showCompleted}
                                    onChange={(e) => setShowCompleted(e.target.checked)}
                                />
                                Show Completed Games
                            </label>
                        </div>
                        <button className="obi-ghost-btn" onClick={() => setShowCalendarModal(true)}>
                            ⤓ Download Calendar
                        </button>
                    </div>

                    {/* Playoff tabs */}
                    {hasPlayoffs && (
                        <div className="obi-schedule-tabs">
                            <button
                                className={`obi-chip ${activeTab === 'regular' ? 'is-active' : ''}`}
                                onClick={() => setActiveTab('regular')}
                            >Regular Season</button>
                            <button
                                className={`obi-chip ${activeTab === 'playoffs' ? 'is-active' : ''}`}
                                onClick={() => setActiveTab('playoffs')}
                            >Playoffs</button>
                        </div>
                    )}

                    {/* Week filter chips (regular season) */}
                    {activeTab === 'regular' && availableWeeks.length > 0 && (
                        <div className="obi-week-chips">
                            <button
                                className={`obi-chip ${selectedWeek === 'all' ? 'is-active' : ''}`}
                                onClick={() => setSelectedWeek('all')}
                            >All Weeks</button>
                            {availableWeeks.map(w => (
                                <button
                                    key={w}
                                    className={`obi-chip ${selectedWeek === String(w) ? 'is-active' : ''}`}
                                    onClick={() => setSelectedWeek(String(w))}
                                >Week {w}</button>
                            ))}
                        </div>
                    )}

                    {loading ? (
                        <div className="obi-schedule-msg">Loading games…</div>
                    ) : activeTab === 'playoffs' ? (
                        <PlayoffBracket games={playoffGames} teams={teams} />
                    ) : weeksToShow.length === 0 ? (
                        <div className="obi-schedule-msg">No games scheduled yet.</div>
                    ) : (
                        <div className="obi-weeks">
                            {weeksToShow.map(w => {
                                const wkGames = filtered
                                    .filter(g => g.week === w)
                                    .sort((a, b) => parseGameDate(a.gameDate) - parseGameDate(b.gameDate));
                                const status = weekStatus(w);
                                return (
                                    <div key={w} className="obi-week-block">
                                        <div className="obi-week-block-head">
                                            <span className="obi-week-block-label">Week {w}</span>
                                            <span className="obi-week-block-range">{weekRange(wkGames)}</span>
                                            <span className={`obi-week-badge ${status.cls}`}>{status.label}</span>
                                            <span className="obi-week-rule" />
                                        </div>
                                        <div className="obi-week-games">
                                            {wkGames.map(renderGameRow)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {showCalendarModal && (
                <div className="obi-cal-overlay" onClick={() => setShowCalendarModal(false)}>
                    <div className="obi-cal-modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="obi-cal-title">Download Team Schedule</h2>
                        <p className="obi-cal-sub">Choose a team to download their schedule (.ics):</p>
                        <div className="obi-cal-teams">
                            {teams.map(team => (
                                <button
                                    key={team.id}
                                    className="obi-cal-team-btn"
                                    onClick={() => generateICS(team.id)}
                                >
                                    <span className="obi-team-dot" style={{ background: resolveTeamColor(team.teamColor) }} />
                                    {team.name}
                                </button>
                            ))}
                        </div>
                        <button className="obi-cal-cancel" onClick={() => setShowCalendarModal(false)}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchedulePage;
