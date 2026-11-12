import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor } from '../../constants/teamColors';
import { buildLeaderboard, filterPlayers, paginatePlayers, sortPlayers } from '../../utils/playerLeaderboard';
import SeasonSelector from '../common/SeasonSelector';
import PlayerProfileCard from '../common/PlayerProfileCard';
import heroBg from '../../assets/images/buzzard-full.jpg';
import './PlayersPage.css';

const VIEWS = [{ id: 'roster', label: 'Roster' }, { id: 'skaters', label: 'Skater stats' }, { id: 'goalies', label: 'Goalie stats' }];
const COLUMNS = {
    roster: [['jerseyNumber', '#', 'Jersey number'], ['name', 'Player', 'Player name'], ['team', 'Team', 'Team'], ['position', 'Pos', 'Position']],
    skaters: [['name', 'Player', 'Player name'], ['team', 'Team', 'Team'], ['gamesPlayed', 'GP', 'Games played'],
        ['goals', 'G', 'Goals'], ['assists', 'A', 'Assists'], ['points', 'PTS', 'Points'], ['penaltyMinutes', 'PIM', 'Penalty minutes']],
    goalies: [['name', 'Goalie', 'Goalie name'], ['team', 'Team', 'Team'], ['gamesPlayed', 'GP', 'Games played'],
        ['wins', 'W', 'Wins'], ['losses', 'L', 'Losses'], ['overtimeLosses', 'OTL', 'Overtime losses'],
        ['saves', 'SV', 'Saves'], ['shotsAgainst', 'SA', 'Shots against'], ['savePercentage', 'SV%', 'Save percentage'],
        ['goalsAgainstAverage', 'GAA', 'Goals against average'], ['shutouts', 'SO', 'Shutouts']],
};
const initialSort = (view) => view === 'roster' ? { key: 'name', direction: 'ascending' }
    : { key: view === 'skaters' ? 'points' : 'savePercentage', direction: 'descending' };

async function fetchList(path, signal) {
    const response = await fetch(path, { signal });
    if (!response.ok) throw new Error('This data could not be loaded. Please try again.');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('This data could not be loaded. Please try again.');
    return rows;
}

function PlayersPage() {
    const { seasons, selectedSeason, selectedSeasonId, setSelectedSeasonId, resetToActiveSeason, loadingSeasons } = useSeason();
    const [params, setParams] = useSearchParams();
    const view = VIEWS.some(v => v.id === params.get('view')) ? params.get('view') : 'roster';
    useEffect(() => { resetToActiveSeason(); }, [resetToActiveSeason]);
    const changeView = (next) => {
        setParams(previous => {
            const updated = new URLSearchParams(previous);
            if (next === 'roster') updated.delete('view'); else updated.set('view', next);
            return updated;
        });
    };
    return (
        <div className="obi-page obi-players">
            <section className="obi-page-hero">
                <img src={heroBg} alt="" className="obi-page-hero-bg" />
                <div className="obi-page-hero-overlay" />
                <div className="obi-page-hero-inner">
                    <div className="obi-eyebrow">Old Buzzard Hockey League</div>
                    <h1 className="obi-page-title">PLAYERS</h1>
                    <p className="obi-page-sub">Rosters, scoring leaders &amp; goaltender statistics.</p>
                </div>
            </section>
            <section className="obi-players-body">
                <div className="obi-container">
                    <div className="obi-players-toolbar">
                        <SeasonSelector seasons={seasons} selectedSeasonId={selectedSeasonId} onChange={setSelectedSeasonId} />
                        <nav className="obi-player-views" aria-label="Player views">
                            {VIEWS.map(item => <button key={item.id} type="button" aria-pressed={view === item.id}
                                className={view === item.id ? 'is-active' : ''} onClick={() => changeView(item.id)}>{item.label}</button>)}
                        </nav>
                    </div>
                    {loadingSeasons ? <p className="obi-players-msg" role="status">Loading seasons…</p>
                        : !selectedSeasonId ? <p className="obi-players-msg">No seasons are available yet.</p>
                            : <SeasonPlayers key={selectedSeasonId} seasonId={selectedSeasonId} seasonName={selectedSeason?.name} view={view} />}
                </div>
            </section>
        </div>
    );
}

function SeasonPlayers({ seasonId, seasonName, view }) {
    const [result, setResult] = useState(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        const endpoints = [
            `/api/v1/players?seasonId=${seasonId}`,
            `/api/v1/teams?seasonId=${seasonId}`,
            `/api/v1/stats/players?seasonId=${seasonId}`,
            `/api/v1/stats/goalies?seasonId=${seasonId}`,
        ];
        Promise.allSettled(endpoints.map(path => fetchList(path, controller.signal))).then(results => {
            if (!controller.signal.aborted) setResult(results);
        });
        return () => controller.abort();
    }, [seasonId, attempt]);
    const retry = () => { setResult(null); setAttempt(n => n + 1); };
    if (!result) return <p className="obi-players-msg" role="status">Loading players and statistics…</p>;
    const required = view === 'roster' ? [0, 1] : [0, 1, view === 'skaters' ? 2 : 3];
    if (required.some(i => result[i].status === 'rejected')) {
        return <div className="obi-players-msg" role="alert">Could not load {view === 'roster' ? 'the roster' : 'statistics'}.
            <button className="obi-player-retry" type="button" onClick={retry}>Try again</button></div>;
    }
    const players = result[0].value;
    const teams = result[1].value;
    const teamMap = new Map(teams.map(t => [Number(t.id), t]));
    const rows = view === 'roster' ? players.map(player => ({ ...player,
        teamName: teamMap.get(Number(player.teamId))?.name || 'Free Agent',
        teamColor: teamMap.get(Number(player.teamId))?.teamColor,
        isGM: teamMap.get(Number(player.teamId))?.gmId === player.id,
    })) : buildLeaderboard(players, result[view === 'skaters' ? 2 : 3].value, teams, seasonId, view === 'goalies');
    return <PlayerTable key={view} rows={rows} teams={teams} view={view} seasonName={seasonName} />;
}

function PlayerTable({ rows, teams, view, seasonName }) {
    const [team, setTeam] = useState('all');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState(() => initialSort(view));
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [openPlayerId, setOpenPlayerId] = useState(null);
    const filtered = filterPlayers(rows, team, query);
    const sorted = sortPlayers(filtered, sort, view);
    const paging = paginatePlayers(sorted, page, pageSize);
    const stats = view !== 'roster';
    const changeSort = (key) => {
        setSort(previous => ({ key, direction: previous.key === key
            ? previous.direction === 'ascending' ? 'descending' : 'ascending'
            : ['name', 'team', 'position', 'jerseyNumber', 'goalsAgainstAverage'].includes(key) ? 'ascending' : 'descending' }));
        setPage(1);
    };
    const cell = (row, key) => {
        if (key === 'name') return <button type="button" className="obi-player-name" onClick={() => setOpenPlayerId(row.id)}
            aria-label={`${row.firstName} ${row.lastName} — open profile`}>
            {row.firstName} {row.lastName}
            {row.isGM && <span className="obi-mini-badge">GM</span>}
            {view === 'roster' && row.twoGoalLimit && <span className="obi-mini-badge obi-mini-2gl">2GL</span>}
        </button>;
        if (key === 'team') return <span className="obi-player-team"><span className="obi-team-dot" style={{ background: resolveTeamColor(row.teamColor) }} />{row.teamName}</span>;
        if (key === 'position') return <span className="obi-pos-badge">{row.position || '—'}</span>;
        if (key === 'savePercentage') return row.savePercentage == null ? '—' : row.savePercentage.toFixed(3);
        if (key === 'goalsAgainstAverage') return row.goalsAgainstAverage == null ? '—' : row.goalsAgainstAverage.toFixed(2);
        return row[key] ?? '—';
    };
    return <>
        <div className="obi-player-section-title">
            <div><h2>{view === 'roster' ? 'Season roster' : view === 'skaters' ? 'Scoring leaderboard' : 'Goaltender leaderboard'}</h2>
                <p>{seasonName}{stats ? ' · Season totals' : ` · ${rows.length} players`}</p></div>
            {stats && <span className="obi-player-sort-note">{`Sorted by ${COLUMNS[view].find(([key]) => key === sort.key)?.[2].toLowerCase()} · ${sort.direction === 'ascending' ? 'ascending' : 'descending'}`}</span>}
        </div>
        <div className="obi-players-controls">
            <label className="obi-search">
                <span className="obi-search-icon" aria-hidden="true">⌕</span>
                <span className="obi-player-sr-only">Search players</span>
                <input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}
                    placeholder="Search players…" className="obi-search-input" />
            </label>
            <label className="obi-player-page-size">Per page
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                    {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
            </label>
            <span className="obi-showing obi-showing-push" role="status">Showing <b>{paging.start}–{paging.end}</b> of {sorted.length}
                {sorted.length !== rows.length ? ` (${rows.length} total)` : ''}</span>
        </div>
        <div className="obi-team-chips" aria-label="Filter by team">
            <button type="button" className={`obi-chip ${team === 'all' ? 'is-active' : ''}`} aria-pressed={team === 'all'}
                onClick={() => { setTeam('all'); setPage(1); }}>All teams</button>
            {teams.map(t => <button type="button" key={t.id} className={`obi-chip ${team === String(t.id) ? 'is-active' : ''}`}
                aria-pressed={team === String(t.id)} onClick={() => { setTeam(String(t.id)); setPage(1); }}>
                <span className="obi-chip-dot" style={{ background: resolveTeamColor(t.teamColor) }} />{t.name}</button>)}
        </div>
        {rows.length === 0 ? <p className="obi-players-msg">{view === 'roster' ? 'No players are registered for this season.'
            : `No ${view === 'goalies' ? 'goalie' : 'skater'} statistics have been recorded for this season yet.`}</p>
            : sorted.length === 0 ? <p className="obi-players-msg">No players match your search and team filter.
                <button type="button" className="obi-player-retry" onClick={() => { setTeam('all'); setQuery(''); setPage(1); }}>Clear filters</button></p>
                : <>
                    <div className="obi-player-table-scroll" role="region" aria-label={`${VIEWS.find(v => v.id === view).label} table`} tabIndex={0}>
                        <table className={`obi-player-table obi-player-table--${view}`}>
                            <caption className="obi-player-sr-only">{seasonName} {VIEWS.find(v => v.id === view).label}</caption>
                            <thead><tr>{stats && <th scope="col" className="obi-player-rank">#</th>}
                                {COLUMNS[view].map(([key, label, title]) => <th key={key} scope="col" className={`obi-player-col-${key}`}
                                    aria-sort={sort.key === key ? sort.direction : 'none'}>
                                    <button type="button" onClick={() => changeSort(key)} title={title} aria-label={`Sort by ${title.toLowerCase()}`}>
                                        {label}<span aria-hidden="true">{sort.key === key ? sort.direction === 'ascending' ? ' ↑' : ' ↓' : ' ↕'}</span>
                                    </button></th>)}
                            </tr></thead>
                            <tbody>{paging.rows.map((row, index) => <tr key={row.id}>
                                {stats && <td className="obi-player-rank">{paging.offset + index + 1}</td>}
                                {COLUMNS[view].map(([key]) => <td key={key} className={`obi-player-col-${key}`}>{cell(row, key)}</td>)}
                            </tr>)}</tbody>
                        </table>
                    </div>
                    <nav className="obi-player-pagination" aria-label="Player pagination">
                        <span>Page <b>{paging.page}</b> of {paging.totalPages}</span>
                        <div><button type="button" disabled={paging.page === 1} onClick={() => setPage(paging.page - 1)}>Previous</button>
                            <button type="button" disabled={paging.page === paging.totalPages} onClick={() => setPage(paging.page + 1)}>Next</button></div>
                    </nav>
                </>}
        {stats && <p className="obi-player-stat-key">{view === 'skaters'
            ? 'GP games played · G goals · A assists · PTS points · PIM penalty minutes. Only players with recorded season statistics are listed.'
            : 'GP games played · W wins · L losses · OTL overtime losses · SV saves · SA shots against · SV% save percentage · GAA goals against average · SO shutouts. A dash means the rate is unavailable.'}</p>}
        {openPlayerId != null && <PlayerProfileCard playerId={openPlayerId} onClose={() => setOpenPlayerId(null)} />}
    </>;
}

export default PlayersPage;
