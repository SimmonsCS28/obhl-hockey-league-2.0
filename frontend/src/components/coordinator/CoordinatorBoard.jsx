import { useEffect, useState } from 'react';
import api from '../../services/api';
import '../admin/StaffSchedule.css';
import './Coordinator.css';

// role: 'GOALIE' | 'REF'
function CoordinatorBoard({ role }) {
    const roleLabel = role === 'REF' ? 'Referee' : 'Goalie';
    const staffRole = role; // getUsers role filter matches the role name

    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [games, setGames] = useState([]);
    const [staff, setStaff] = useState([]);
    const [teams, setTeams] = useState([]);
    const [unavailability, setUnavailability] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [weekFilter, setWeekFilter] = useState('all');
    const [publishing, setPublishing] = useState(false);
    const [publishResult, setPublishResult] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const seasonsData = await api.getSeasons();
                setSeasons(seasonsData);
                const active = seasonsData.find(s => s.isActive) || seasonsData[0];
                if (active) setSelectedSeason(active.id);
            } catch {
                setError('Failed to load seasons');
            }
        })();
    }, []);

    useEffect(() => {
        if (selectedSeason) loadSeasonData(selectedSeason);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSeason, role]);

    const loadSeasonData = async (seasonId) => {
        setLoading(true);
        setError('');
        try {
            const [gamesData, staffData, teamsData, availData, assignData] = await Promise.all([
                api.getGames(seasonId),
                api.getUsers({ role: staffRole }),
                api.getTeams({ seasonId }),
                api.getCoordinatorAvailability(role),
                api.getCoordinatorAssignments(seasonId, role),
            ]);
            setGames(gamesData || []);
            const sorted = (staffData || []).sort((a, b) => getName(a).toLowerCase().localeCompare(getName(b).toLowerCase()));
            setStaff(sorted);
            setTeams(teamsData || []);
            setUnavailability(availData || []);
            setAssignments(assignData || []);
        } catch {
            setError('Failed to load schedule data');
        } finally {
            setLoading(false);
        }
    };

    const reloadAssignments = async () => {
        const data = await api.getCoordinatorAssignments(selectedSeason, role);
        setAssignments(data || []);
    };

    const getName = (u) => (u.firstName && u.lastName) ? `${u.firstName} ${u.lastName}` : (u.username || `User ${u.id}`);
    const getTeamById = (id) => teams.find(t => t.id === id);

    const getValidColor = (color) => {
        if (!color) return '#95a5a6';
        const map = { 'Lt. Blu': '#87CEEB', 'Dk. Gre': '#006400', 'White': '#FFFFFF', 'Yellow': '#FFD700', 'Gold': '#FFD700' };
        return map[color] || color;
    };
    const getTextColor = (bg) => {
        if (!bg) return 'white';
        const light = ['White', '#FFFFFF', 'Yellow', '#FFD700', 'Gold', 'Lt. Blu', '#87CEEB', 'LightBlue'];
        return light.some(c => c.toLowerCase() === bg.toLowerCase()) ? '#2c3e50' : 'white';
    };

    const getLocalDateStr = (gameDateStr) => {
        const d = new Date(gameDateStr.endsWith('Z') ? gameDateStr : gameDateStr + 'Z');
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const isUnavailable = (userId, gameDateStr) => {
        const dateStr = getLocalDateStr(gameDateStr);
        return unavailability.some(u => u.userId === userId && u.date === dateStr);
    };

    const assignmentFor = (gameId, slot) => assignments.find(a => a.gameId === gameId && a.slot === slot);

    const handleAssign = async (game, slot, userId) => {
        setError('');
        try {
            const existing = assignmentFor(game.id, slot);
            if (!userId) {
                if (existing) {
                    await api.withdrawShift(existing.id, role);
                }
            } else {
                await api.proposeShift({ gameId: game.id, seasonId: selectedSeason, role, slot, userId: parseInt(userId) });
            }
            await reloadAssignments();
        } catch (e) {
            setError(e.message || 'Failed to update assignment');
        }
    };

    const handlePublish = async () => {
        if (weekFilter === 'all') return;
        setPublishing(true);
        setPublishResult(null);
        setError('');
        try {
            const result = await api.publishShiftWeek(selectedSeason, role, parseInt(weekFilter));
            setPublishResult(result);
        } catch (e) {
            setError(e.message || 'Failed to publish');
        } finally {
            setPublishing(false);
        }
    };

    const availableWeeks = [...new Set(games.map(g => g.week).filter(w => w != null))].sort((a, b) => a - b);
    const filteredGames = games.filter(g => weekFilter === 'all' || g.week === parseInt(weekFilter));

    const weekGameDates = weekFilter !== 'all'
        ? [...new Set(games.filter(g => g.week === parseInt(weekFilter)).map(g => getLocalDateStr(g.gameDate)))].sort()
        : [];

    const formatPanelDate = (dateStr) => new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const StatusChip = ({ a }) => {
        if (!a) return null;
        if (a.status === 'CONFIRMED') return <span className="shift-chip chip-confirmed">✓ Confirmed{a.published ? ' · Published' : ''}</span>;
        if (a.status === 'DECLINED') return <span className="shift-chip chip-declined" title={a.declineReason || ''}>✗ Declined</span>;
        return <span className="shift-chip chip-pending">⏳ Pending</span>;
    };

    const renderSlot = (game, slot) => {
        const a = assignmentFor(game.id, slot);
        return (
            <td>
                <select
                    value={a?.userId || ''}
                    onChange={(e) => handleAssign(game, slot, e.target.value)}
                    className="goalie-select"
                >
                    <option value="">-- Select {roleLabel} {slot} --</option>
                    {staff
                        .filter(s => (a && s.id === a.userId) || !isUnavailable(s.id, game.gameDate))
                        .map(s => <option key={s.id} value={s.id}>{getName(s)}</option>)}
                </select>
                <div className="slot-status"><StatusChip a={a} /></div>
            </td>
        );
    };

    if (loading) return <div className="loading">Loading...</div>;

    const confirmedCount = assignments.filter(a => a.status === 'CONFIRMED').length;
    const pendingCount = assignments.filter(a => a.status === 'PROPOSED').length;
    const declinedCount = assignments.filter(a => a.status === 'DECLINED').length;

    return (
        <div className="staff-schedule">
            <div className="schedule-header">
                <h2>{role === 'REF' ? '👔' : '🥅'} {roleLabel} Coordinator</h2>
                <div className="header-controls">
                    <div className="filter-group">
                        <label>Season:</label>
                        <select value={selectedSeason || ''} onChange={(e) => setSelectedSeason(parseInt(e.target.value))} className="season-select">
                            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Week:</label>
                        <select value={weekFilter} onChange={(e) => { setWeekFilter(e.target.value); setPublishResult(null); }} className="filter-select">
                            <option value="all">All Weeks</option>
                            {availableWeeks.map(w => <option key={w} value={w}>Week {w}</option>)}
                        </select>
                    </div>
                    {weekFilter !== 'all' && (
                        <button className="publish-btn" onClick={handlePublish} disabled={publishing}>
                            {publishing ? 'Publishing...' : `Publish Week ${weekFilter}`}
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {publishResult && (
                <div className={`publish-result ${publishResult.unconfirmedSlots.length ? 'has-warnings' : 'all-clear'}`}>
                    <strong>Published {publishResult.publishedCount} confirmed assignment(s).</strong>
                    {publishResult.unconfirmedSlots.length > 0 && (
                        <ul>
                            {publishResult.unconfirmedSlots.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    )}
                </div>
            )}

            <div className="schedule-stats">
                <div className="stat-card"><div className="stat-value">{pendingCount}</div><div className="stat-label">Pending</div></div>
                <div className="stat-card"><div className="stat-value">{confirmedCount}</div><div className="stat-label">Confirmed</div></div>
                <div className="stat-card"><div className="stat-value">{declinedCount}</div><div className="stat-label">Declined</div></div>
            </div>

            <div className="games-table-container">
                {filteredGames.length === 0 ? (
                    <div className="empty-state">No games found</div>
                ) : (
                    <table className="games-table">
                        <thead>
                            <tr>
                                <th>Week</th>
                                <th>Date & Time</th>
                                <th>Home</th>
                                <th>Away</th>
                                <th>Location</th>
                                <th>{roleLabel} 1</th>
                                <th>{roleLabel} 2</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGames.map((game, index) => {
                                const gameDate = new Date(game.gameDate.endsWith('Z') ? game.gameDate : game.gameDate + 'Z');
                                const prev = index > 0 ? filteredGames[index - 1] : null;
                                const newWeek = prev && prev.week !== game.week;
                                return (
                                    <tr key={game.id} className={newWeek ? 'week-separator' : ''}>
                                        <td>Week {game.week}</td>
                                        <td>{gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                                        <td><span className="team-badge" style={{ backgroundColor: getValidColor(getTeamById(game.homeTeamId)?.teamColor), color: getTextColor(getTeamById(game.homeTeamId)?.teamColor) }}>{getTeamById(game.homeTeamId)?.name || `Team ${game.homeTeamId}`}</span></td>
                                        <td><span className="team-badge" style={{ backgroundColor: getValidColor(getTeamById(game.awayTeamId)?.teamColor), color: getTextColor(getTeamById(game.awayTeamId)?.teamColor) }}>{getTeamById(game.awayTeamId)?.name || `Team ${game.awayTeamId}`}</span></td>
                                        <td>{game.rink || 'TBD'}</td>
                                        {renderSlot(game, 1)}
                                        {renderSlot(game, 2)}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {weekFilter !== 'all' && weekGameDates.length > 0 && (
                <div className="availability-panel">
                    <h3 className="availability-panel-title">{roleLabel} Availability — Week {weekFilter}</h3>
                    <div className="goalie-avail-table-wrapper">
                        <table className="goalie-avail-table">
                            <thead>
                                <tr>
                                    <th className="goalie-avail-name-col">{roleLabel}</th>
                                    {weekGameDates.map(d => <th key={d} className="goalie-avail-date-col">{formatPanelDate(d)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {staff.length === 0 ? (
                                    <tr><td colSpan={weekGameDates.length + 1} className="goalie-avail-empty">No {roleLabel.toLowerCase()}s found.</td></tr>
                                ) : staff.map(s => (
                                    <tr key={s.id}>
                                        <td className="goalie-avail-name-cell">{getName(s)}</td>
                                        {weekGameDates.map(d => {
                                            const unavail = unavailability.some(u => u.userId === s.id && u.date === d);
                                            return (
                                                <td key={d} className="availability-cell">
                                                    <span className={`availability-badge ${unavail ? 'badge-unavailable' : 'badge-available'}`}>
                                                        {unavail ? '✗ Unavailable' : '✓ Available'}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CoordinatorBoard;
