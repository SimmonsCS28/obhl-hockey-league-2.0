import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveTeamColor } from '../../constants/teamColors';
import bannerImg from '../../assets/images/buzzard-banner.png';
import './Home.css';

const parseGameDate = (s) => new Date(s.endsWith('Z') ? s : s + 'Z');

const fmtWhen = (s) => {
    const d = parseGameDate(s);
    return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

const fmtAnnDate = (s) => {
    if (!s) return '';
    const d = new Date(s.length === 10 ? s + 'T12:00:00' : (s.endsWith('Z') ? s : s + 'Z'));
    return `Posted ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

function Home() {
    const [activeSeason, setActiveSeason] = useState(null);
    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [games, setGames] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const seasonsRes = await fetch('/api/v1/seasons');
            if (!seasonsRes.ok) throw new Error('Failed to fetch seasons');
            const seasons = await seasonsRes.json();
            const active = seasons.find(s => s.isActive);
            setActiveSeason(active);

            if (active) {
                const [teamsRes, playersRes, gamesRes] = await Promise.all([
                    fetch(`/api/v1/teams?seasonId=${active.id}`),
                    fetch(`/stats-api/players?seasonId=${active.id}`),
                    fetch(`/games-api/games?seasonId=${active.id}`),
                ]);
                if (teamsRes.ok) setTeams(await teamsRes.json());
                if (playersRes.ok) setPlayers(await playersRes.json());
                if (gamesRes.ok) setGames(await gamesRes.json());
            }

            try {
                const annRes = await fetch('/api/v1/announcements?activeOnly=true');
                if (annRes.ok) setAnnouncements(await annRes.json());
            } catch (err) {
                console.error('Failed to load announcements:', err);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const teamById = (id) => teams.find(t => t.id === id);
    const teamName = (id) => teamById(id)?.name || 'TBD';
    const teamColor = (id) => resolveTeamColor(teamById(id)?.teamColor);

    // Last week = most recent completed week; Upcoming = earliest future week
    const completed = [...games]
        .filter(g => g.status === 'completed')
        .sort((a, b) => (b.week || 0) - (a.week || 0));
    const lastWeekNum = completed.length ? completed[0].week : null;
    const lastWeek = completed.filter(g => g.week === lastWeekNum).slice(0, 4);

    const now = Date.now();
    const upcoming = [...games]
        .filter(g => g.status !== 'completed' && parseGameDate(g.gameDate).getTime() >= now)
        .sort((a, b) => parseGameDate(a.gameDate) - parseGameDate(b.gameDate));
    const nextWeekNum = upcoming.length ? upcoming[0].week : null;
    const nextWeek = upcoming.filter(g => g.week === nextWeekNum).slice(0, 4);

    const playedCount = completed.length;
    const stats = [
        { value: teams.length, label: 'Teams', sub: 'in the league' },
        { value: players.length, label: 'Players', sub: 'rostered this season' },
        { value: games.length, label: 'Games', sub: 'on the schedule' },
        { value: playedCount, label: 'Played', sub: `${Math.max(games.length - playedCount, 0)} remaining` },
    ];

    if (loading) {
        return <div className="obi-page obi-home"><div className="obi-home-loading">Loading…</div></div>;
    }
    if (error) {
        return <div className="obi-page obi-home"><div className="obi-home-loading obi-neg">Error: {error}</div></div>;
    }

    return (
        <div className="obi-page obi-home">
            {/* HERO — banner */}
            <section className="obi-hero">
                <img src={bannerImg} alt="" className="obi-hero-bg" />
                <div className="obi-hero-overlay" />
                <div className="obi-hero-inner">
                    <div className="obi-hero-badge">
                        <span className="obi-pulse-dot" />
                        <span>{activeSeason?.name || 'Old Buzzard Hockey League'} · Now Playing</span>
                    </div>
                    <h1 className="obi-hero-title">OLD BIRDS.<br />SHARP TALONS.</h1>
                    <p className="obi-hero-sub">
                        Adult beer-league hockey at the Sun Prairie Ice Arena. Ten teams, two nights a week,
                        one ugly trophy worth bleeding for.
                    </p>
                    <div className="obi-hero-cta">
                        <Link to="/schedule" className="obi-btn-gold">View Schedule</Link>
                        <Link to="/standings" className="obi-btn-ghost">Standings</Link>
                    </div>
                </div>
            </section>

            {/* ANNOUNCEMENTS */}
            {announcements.length > 0 && (
                <section className="obi-news">
                    <div className="obi-container">
                        <div className="obi-news-head">
                            <span className="obi-news-pill">League News</span>
                            <span className="obi-news-rule" />
                        </div>
                        <div className="obi-news-grid">
                            {announcements.map(ann => (
                                <div key={ann.id} className="obi-news-card">
                                    <div className="obi-news-title">{ann.title}</div>
                                    <div
                                        className="obi-news-body"
                                        dangerouslySetInnerHTML={{ __html: ann.content }}
                                    />
                                    <div className="obi-news-date">{fmtAnnDate(ann.startDate || ann.createdAt)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* SEASON AT A GLANCE */}
            {activeSeason && (
                <section className="obi-glance">
                    <div className="obi-container">
                        <div className="obi-glance-head">
                            <div>
                                <div className="obi-eyebrow">The Season at a Glance</div>
                                <h2 className="obi-glance-title">{activeSeason.name}</h2>
                            </div>
                            <Link to="/seasons" className="obi-glance-link">Full season details →</Link>
                        </div>
                        <div className="obi-stat-grid">
                            {stats.map(s => (
                                <div key={s.label} className="obi-stat-card">
                                    <div className="obi-stat-value">{s.value}</div>
                                    <div className="obi-stat-label">{s.label}</div>
                                    <div className="obi-stat-sub">{s.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* THIS WEEK */}
            {(lastWeek.length > 0 || nextWeek.length > 0) && (
                <section className="obi-week">
                    <div className="obi-container">
                        <div className="obi-week-grid">
                            {/* Last week */}
                            <div>
                                <div className="obi-week-head">
                                    <span className="obi-week-title">Last Week's Results</span>
                                    {lastWeekNum != null && <span className="obi-week-sub">Week {lastWeekNum}</span>}
                                </div>
                                <div className="obi-week-list">
                                    {lastWeek.length === 0 ? (
                                        <div className="obi-week-empty">No results yet this season.</div>
                                    ) : lastWeek.map(g => (
                                        <div key={g.id} className="obi-result-card">
                                            <div className="obi-result-row">
                                                <span className="obi-team-side">
                                                    <span className="obi-team-dot" style={{ background: teamColor(g.homeTeamId) }} />
                                                    <span className="obi-team-side-name">{teamName(g.homeTeamId)}</span>
                                                </span>
                                                <span className="obi-score">{g.homeScore ?? 0}</span>
                                                <span className="obi-score-dash">—</span>
                                                <span className="obi-score">{g.awayScore ?? 0}</span>
                                                <span className="obi-team-side obi-team-side-right">
                                                    <span className="obi-team-side-name">{teamName(g.awayTeamId)}</span>
                                                    <span className="obi-team-dot" style={{ background: teamColor(g.awayTeamId) }} />
                                                </span>
                                            </div>
                                            <div className="obi-result-meta">
                                                {fmtWhen(g.gameDate)}{g.rink ? ` · ${g.rink}` : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Upcoming */}
                            <div>
                                <div className="obi-week-head">
                                    <span className="obi-week-title">Upcoming Week</span>
                                    {nextWeekNum != null && <span className="obi-week-sub">Week {nextWeekNum}</span>}
                                </div>
                                <div className="obi-week-list">
                                    {nextWeek.length === 0 ? (
                                        <div className="obi-week-empty">No upcoming games scheduled.</div>
                                    ) : nextWeek.map(g => (
                                        <div key={g.id} className="obi-upcoming-card">
                                            <div className="obi-result-row">
                                                <span className="obi-team-side">
                                                    <span className="obi-team-dot" style={{ background: teamColor(g.homeTeamId) }} />
                                                    <span className="obi-team-side-name">{teamName(g.homeTeamId)}</span>
                                                </span>
                                                <span className="obi-vs">VS</span>
                                                <span className="obi-team-side obi-team-side-right">
                                                    <span className="obi-team-side-name">{teamName(g.awayTeamId)}</span>
                                                    <span className="obi-team-dot" style={{ background: teamColor(g.awayTeamId) }} />
                                                </span>
                                            </div>
                                            <div className="obi-upcoming-meta">
                                                <span className="obi-when">{fmtWhen(g.gameDate)}</span>
                                                <span className="obi-venue">{g.rink || 'Sun Prairie Ice Arena'}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {nextWeek.length > 0 && (
                                        <Link to="/schedule" className="obi-week-full-btn">Full Schedule</Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {!activeSeason && (
                <section className="obi-glance">
                    <div className="obi-container">
                        <div className="obi-week-empty">No active season at this time. Check back soon!</div>
                    </div>
                </section>
            )}
        </div>
    );
}

export default Home;
