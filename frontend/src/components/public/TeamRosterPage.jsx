import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '../../services/api';
import { resolveTeamColor } from '../../constants/teamColors';
import './TeamRosterPage.css';

const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const posLabel = (pos) => {
    const p = (pos || '').toUpperCase();
    if (p === 'D') return 'Defense';
    if (p === 'G') return 'Goalie';
    if (['C', 'LW', 'RW', 'F'].includes(p)) return 'Forward';
    return pos || '—';
};

const parseGameDate = (s) => new Date(s.endsWith('Z') ? s : s + 'Z');

function TeamRosterPage() {
    const { teamId } = useParams();
    const navigate = useNavigate();
    const [team, setTeam] = useState(null);
    const [roster, setRoster] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [leagueTeams, setLeagueTeams] = useState([]);
    const [rank, setRank] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (teamId) fetchTeamData();
    }, [teamId]);

    const fetchTeamData = async () => {
        try {
            setLoading(true);
            const teamResponse = await fetch(`/api/v1/teams/${teamId}`);
            if (!teamResponse.ok) throw new Error('Failed to fetch team');
            const teamData = await teamResponse.json();
            setTeam(teamData);

            const seasonTeamsResponse = await fetch(`/api/v1/teams?seasonId=${teamData.seasonId}`);
            if (seasonTeamsResponse.ok) {
                const seasonTeams = await seasonTeamsResponse.json();
                setLeagueTeams(seasonTeams);
                const sorted = [...seasonTeams].sort((a, b) =>
                    (b.points || 0) !== (a.points || 0) ? (b.points || 0) - (a.points || 0) : (b.wins || 0) - (a.wins || 0));
                const idx = sorted.findIndex(t => t.id === parseInt(teamId));
                if (idx !== -1) setRank(idx + 1);
            }

            const gamesResponse = await fetch(`/games-api/games?seasonId=${teamData.seasonId}`);
            if (gamesResponse.ok) {
                const gamesData = await gamesResponse.json();
                const teamGames = gamesData
                    .filter(g => g.homeTeamId === parseInt(teamId) || g.awayTeamId === parseInt(teamId))
                    .sort((a, b) => parseGameDate(a.gameDate) - parseGameDate(b.gameDate));
                setSchedule(teamGames);
            }

            const playersData = await api.getPlayers({ teamId, seasonId: teamData.seasonId });
            const teamPlayers = [...playersData]
                .sort((a, b) => (parseInt(a.jerseyNumber) || 999) - (parseInt(b.jerseyNumber) || 999));
            setRoster(teamPlayers);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const teamName = (id) => leagueTeams.find(t => t.id === id)?.name || 'TBD';
    const teamColorFor = (id) => resolveTeamColor(leagueTeams.find(t => t.id === id)?.teamColor);

    const generateICS = () => {
        if (!team || schedule.length === 0) return;
        const fmtICS = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const lines = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OBHL//Hockey Schedule//EN',
            'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
            `X-WR-CALNAME:${team.name} - OBHL Schedule`, 'X-WR-TIMEZONE:America/Chicago',
        ];
        schedule.forEach((game) => {
            const start = parseGameDate(game.gameDate);
            const end = new Date(start.getTime() + 90 * 60 * 1000);
            const summary = `${teamName(game.homeTeamId)} vs ${teamName(game.awayTeamId)}`;
            lines.push(
                'BEGIN:VEVENT', `UID:obhl-game-${game.id}@oldbuzzardhockey.com`,
                `DTSTAMP:${fmtICS(new Date())}`, `DTSTART:${fmtICS(start)}`, `DTEND:${fmtICS(end)}`,
                `SUMMARY:${summary}`, `LOCATION:${game.rink || 'TBD'}`,
                `DESCRIPTION:Week ${game.week || 'TBD'} - ${summary}`, 'STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT'
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
    };

    if (loading) return <div className="obi-page obi-tr"><div className="obi-tr-msg">Loading team…</div></div>;
    if (error) return <div className="obi-page obi-tr"><div className="obi-tr-msg obi-neg">Error: {error}</div></div>;
    if (!team) return <div className="obi-page obi-tr"><div className="obi-tr-msg">Team not found.</div></div>;

    const color = resolveTeamColor(team.teamColor);
    const record = `${(team.wins || 0) + (team.overtimeWins || 0)}-${team.losses || 0}-${team.overtimeLosses || 0}`;
    const gm = roster.find(p => p.id === team.gmId);
    const gmName = gm ? `${gm.firstName} ${gm.lastName}` : 'TBD';

    const renderGameRow = (game) => {
        const done = game.status === 'completed';
        const isHome = game.homeTeamId === parseInt(teamId);
        const d = parseGameDate(game.gameDate);
        const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const homeWin = done && game.homeScore > game.awayScore;
        const awayWin = done && game.awayScore > game.homeScore;

        let tag = { label: 'Sched', cls: 'is-sched' };
        if (done) {
            const myScore = isHome ? game.homeScore : game.awayScore;
            const oppScore = isHome ? game.awayScore : game.homeScore;
            tag = myScore > oppScore ? { label: 'Win', cls: 'is-win' }
                : myScore < oppScore ? { label: 'Loss', cls: 'is-loss' }
                : { label: 'Tie', cls: 'is-tie' };
        }

        return (
            <div
                key={game.id}
                className={`obi-game-row ${done ? 'is-done' : 'is-upcoming'} obi-tr-game`}
                onClick={() => navigate(`/game/${game.id}/${done ? 'recap' : 'preview'}`, { state: { fromTeamId: teamId } })}
                title={done ? 'View recap' : 'View preview'}
            >
                <div className="obi-game-date">
                    <div className="obi-game-day">{day}</div>
                    <div className="obi-game-datenum">{date}</div>
                </div>
                <div className="obi-game-match">
                    <div className="obi-game-teams">
                        <span className="obi-game-team obi-game-team-home">
                            <span className="obi-game-team-name">{teamName(game.homeTeamId)}</span>
                            <span className="obi-team-dot" style={{ background: teamColorFor(game.homeTeamId) }} />
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
                            <span className="obi-team-dot" style={{ background: teamColorFor(game.awayTeamId) }} />
                            <span className="obi-game-team-name">{teamName(game.awayTeamId)}</span>
                        </span>
                    </div>
                    <div className="obi-game-meta">
                        {done ? 'Final' : time}{game.rink ? ` · ${game.rink}` : ''} · {isHome ? 'Home' : 'Away'}
                    </div>
                </div>
                <span className={`obi-tr-tag ${tag.cls}`}>{tag.label}</span>
            </div>
        );
    };

    return (
        <div className="obi-page obi-tr">
            <section
                className="obi-tr-hero"
                style={{ background: `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${color} 26%, transparent) 0%, rgba(11,12,15,0) 55%), var(--obi-bg)` }}
            >
                <div className="obi-container obi-tr-hero-inner">
                    <button className="obi-gd-back" onClick={() => navigate('/teams')}>← All Teams</button>
                    <div className="obi-tr-hero-top">
                        <span className="obi-tr-swatch" style={{ background: color }} />
                        <div className="obi-tr-id">
                            <div className="obi-tr-rank" style={{ color }}>
                                {rank ? `${ordinal(rank)} Place` : 'Unranked'}
                            </div>
                            <h1 className="obi-tr-name">{team.name}</h1>
                        </div>
                        <div className="obi-tr-stats">
                            <div className="obi-tr-stat">
                                <div className="obi-tr-stat-val">{record}</div>
                                <div className="obi-tr-stat-label">W · L · OTL</div>
                            </div>
                            <div className="obi-tr-stat obi-tr-stat-pts">
                                <div className="obi-tr-stat-val">{team.points || 0}</div>
                                <div className="obi-tr-stat-label">Points</div>
                            </div>
                            <div className="obi-tr-stat">
                                <div className="obi-tr-stat-val">{roster.length}</div>
                                <div className="obi-tr-stat-label">Skaters</div>
                            </div>
                        </div>
                    </div>
                    <div className="obi-tr-gm">
                        <span className="obi-tr-gm-label">General Manager</span>
                        <span className="obi-tr-gm-name">{gmName}</span>
                    </div>
                </div>
            </section>

            <section className="obi-tr-body">
                <div className="obi-container">
                    {/* Roster */}
                    <div className="obi-tr-section-head">
                        <span className="obi-tr-section-title">Roster</span>
                        <span className="obi-tr-section-sub">{roster.length} skaters</span>
                        <span className="obi-tr-section-rule" />
                    </div>
                    <div className="obi-table-card obi-tr-roster">
                        <div className="obi-trr-row obi-trr-head">
                            <span className="obi-trr-num">#</span>
                            <span className="obi-trr-name">Player</span>
                            <span className="obi-trr-pos">Position</span>
                        </div>
                        {roster.length === 0 ? (
                            <div className="obi-tr-msg">No players on roster.</div>
                        ) : roster.map(p => (
                            <div key={p.id} className="obi-trr-row">
                                <span className="obi-trr-num">{p.jerseyNumber ?? '—'}</span>
                                <span className="obi-trr-name">
                                    {p.firstName} {p.lastName}
                                    {team.gmId === p.id && <span className="obi-mini-badge">GM</span>}
                                    {p.twoGoalLimit && <span className="obi-mini-badge obi-mini-2gl">2GL</span>}
                                </span>
                                <span className="obi-trr-pos">
                                    <span className="obi-pos-badge">{posLabel(p.position)}</span>
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Schedule */}
                    <div className="obi-tr-section-head obi-tr-sched-head">
                        <span className="obi-tr-section-title">Season Schedule</span>
                        {schedule.length > 0 && (
                            <button className="obi-ghost-btn" onClick={generateICS}>⤓ Download Calendar</button>
                        )}
                        <span className="obi-tr-section-rule" />
                    </div>
                    {schedule.length === 0 ? (
                        <div className="obi-tr-msg">No games scheduled for this team.</div>
                    ) : (
                        <div className="obi-tr-games">
                            {schedule.map(renderGameRow)}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

export default TeamRosterPage;
