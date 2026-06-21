import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor } from '../../constants/teamColors';
import api from '../../services/api';
import './AdminOverview.css';

function AdminOverview() {
    const navigate = useNavigate();
    const { selectedSeasonId } = useSeason();
    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!selectedSeasonId) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [gamesData, teamsData] = await Promise.all([
                    api.getGames(selectedSeasonId),
                    api.getTeams(),
                ]);
                if (cancelled) return;
                const teamMap = Object.fromEntries(teamsData.map(t => [String(t.id), t]));
                const enriched = gamesData.map(g => ({
                    ...g,
                    homeTeamName: teamMap[String(g.homeTeamId)]?.name || `Team ${g.homeTeamId}`,
                    awayTeamName: teamMap[String(g.awayTeamId)]?.name || `Team ${g.awayTeamId}`,
                    homeTeamColor: resolveTeamColor(teamMap[String(g.homeTeamId)]?.teamColor),
                    awayTeamColor: resolveTeamColor(teamMap[String(g.awayTeamId)]?.teamColor),
                }));
                setGames(enriched);
                setTeams(teamsData);
            } catch (err) {
                if (!cancelled) console.error('AdminOverview load error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [selectedSeasonId]);

    const finalGames = useMemo(() => games.filter(g =>
        g.status === 'Final' || g.status === 'completed' || g.status === 'COMPLETED'
    ), [games]);

    const scheduledGames = useMemo(() => games.filter(g =>
        g.status === 'Scheduled' || g.status === 'scheduled' || g.status === 'SCHEDULED'
    ), [games]);

    const inProgressGames = useMemo(() => games.filter(g =>
        g.status === 'In Progress' || g.status === 'in_progress' || g.status === 'IN_PROGRESS'
    ), [games]);

    const unassignedGames = useMemo(() => games.filter(g =>
        !g.scorekeeperId || !g.referee1Id
    ), [games]);

    // Current week = lowest week# with upcoming/in-progress games
    const thisWeekNum = useMemo(() => {
        const active = games.filter(g => g.status !== 'Final' && g.status !== 'completed' && g.status !== 'COMPLETED');
        const weeks = [...new Set(active.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b);
        return weeks[0] ?? null;
    }, [games]);

    const thisWeekGames = useMemo(() =>
        thisWeekNum != null ? games.filter(g => g.week === thisWeekNum) : [],
    [games, thisWeekNum]);

    const stats = [
        { value: teams.length, label: 'Active Teams', sub: 'in current season', color: 'var(--obi-accent)' },
        { value: finalGames.length, label: 'Games Played', sub: 'this season', color: '#fff' },
        { value: scheduledGames.length, label: 'Games Left', sub: 'this season', color: 'var(--obi-icy)' },
        { value: inProgressGames.length + unassignedGames.length, label: 'Needs Attention', sub: 'action required', color: 'var(--obi-warning)' },
    ];

    const attentionItems = [
        ...(inProgressGames.length > 0 ? [{
            dot: 'var(--obi-warning)',
            border: 'rgba(232,194,106,0.3)',
            text: `${inProgressGames.length} game${inProgressGames.length !== 1 ? 's' : ''} in progress — may need finalizing`,
            action: 'Finalize',
            onClick: () => navigate('/admin?tab=livescore'),
        }] : []),
        ...(unassignedGames.length > 0 ? [{
            dot: 'var(--obi-error)',
            border: 'rgba(224,138,138,0.3)',
            text: `${unassignedGames.length} game${unassignedGames.length !== 1 ? 's' : ''} missing referee or scorekeeper`,
            action: 'Assign',
            onClick: () => navigate('/admin?tab=assignments'),
        }] : []),
        ...((inProgressGames.length === 0 && unassignedGames.length === 0) ? [{
            dot: 'var(--obi-success)',
            border: 'rgba(127,181,154,0.3)',
            text: 'All good — no immediate actions needed',
            action: null,
        }] : []),
    ];

    const formatGameDate = (dateString) => {
        if (!dateString) return '—';
        try {
            const d = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        } catch { return '—'; }
    };

    const formatGameTime = (dateString) => {
        if (!dateString) return '';
        try {
            const d = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch { return ''; }
    };

    if (loading) {
        return <div className="obi-ov-loading">Loading overview…</div>;
    }

    return (
        <div className="obi-ov">
            {/* Stat cards */}
            <div className="obi-ov-stats">
                {stats.map((s, i) => (
                    <div key={i} className="obi-ov-stat-card">
                        <div className="obi-ov-stat-val" style={{ color: s.color }}>{s.value}</div>
                        <div className="obi-ov-stat-label">{s.label}</div>
                        <div className="obi-ov-stat-sub">{s.sub}</div>
                    </div>
                ))}
            </div>

            {/* Two-column panels */}
            <div className="obi-ov-grid">
                {/* Needs Attention */}
                <div className="obi-ov-panel">
                    <div className="obi-ov-panel-title">Needs Attention</div>
                    <div className="obi-ov-attention-list">
                        {attentionItems.map((a, i) => (
                            <div
                                key={i}
                                role={a.onClick ? 'button' : undefined}
                                tabIndex={a.onClick ? 0 : undefined}
                                className={`obi-ov-attn-item${a.onClick ? ' is-clickable' : ''}`}
                                style={{ borderColor: a.border }}
                                onClick={a.onClick}
                                onKeyDown={a.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') a.onClick(); } : undefined}
                            >
                                <span className="obi-ov-attn-left">
                                    <span className="obi-ov-attn-dot" style={{ background: a.dot }} />
                                    <span className="obi-ov-attn-text">{a.text}</span>
                                </span>
                                {a.action && <span className="obi-ov-attn-action">{a.action} →</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* This Week */}
                <div className="obi-ov-panel">
                    <div className="obi-ov-panel-title">
                        {thisWeekNum != null ? `This Week · Week ${thisWeekNum}` : 'Season Complete'}
                    </div>
                    {thisWeekGames.length === 0 ? (
                        <div className="obi-ov-week-empty">No upcoming games scheduled.</div>
                    ) : (
                        <div className="obi-ov-week-list">
                            {thisWeekGames.map((g, i) => (
                                <div key={g.id ?? i} className="obi-ov-week-row">
                                    <span className="obi-ov-week-day">{formatGameDate(g.gameDate)}</span>
                                    <span className="obi-ov-week-matchup">
                                        <span className="obi-ov-tdot" style={{ background: g.homeTeamColor }} />
                                        <span>{g.homeTeamName}</span>
                                        <span className="obi-ov-vs">v</span>
                                        <span>{g.awayTeamName}</span>
                                        <span className="obi-ov-tdot" style={{ background: g.awayTeamColor }} />
                                    </span>
                                    <span className="obi-ov-week-time">{formatGameTime(g.gameDate)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminOverview;
