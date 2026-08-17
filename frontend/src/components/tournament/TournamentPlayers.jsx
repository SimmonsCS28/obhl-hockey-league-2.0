import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from './useTournament';
import { teamMap, useTournamentPlayers, useTournamentTeams } from './tournamentData';
import './TournamentPages.css';

const COLUMNS = [
    { key: 'num', label: '#' },
    { key: 'name', label: 'Player' },
    { key: 'team', label: 'Team' },
    { key: 'pos', label: 'Position' },
];

function TournamentPlayers() {
    const { seasonId, base } = useTournament();
    const { teams } = useTournamentTeams(seasonId);
    const { players, loading, error } = useTournamentPlayers(seasonId);

    const [query, setQuery] = useState('');
    const [teamFilter, setTeamFilter] = useState('All');
    const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

    const byId = teamMap(teams);

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        let out = players.map(p => ({
            id: p.id,
            num: p.jerseyNumber ?? null,
            name: `${p.firstName} ${p.lastName}`,
            pos: p.position || '',
            teamId: p.teamId,
            team: byId[p.teamId]?.name || '—',
        }));

        if (q) out = out.filter(r => r.name.toLowerCase().includes(q));
        if (teamFilter !== 'All') out = out.filter(r => r.team === teamFilter);

        const dir = sort.dir === 'asc' ? 1 : -1;
        out.sort((a, b) => {
            if (sort.key === 'num') return ((a.num ?? 9999) - (b.num ?? 9999)) * dir;
            return String(a[sort.key]).localeCompare(String(b[sort.key])) * dir;
        });
        return out;
    }, [players, byId, query, teamFilter, sort]);

    const toggleSort = (key) =>
        setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

    return (
        <>
            <div className="tcc-head">
                <div className="tcc-head-inner">
                    <div className="tcc-eyebrow">The Field</div>
                    <h1 className="tcc-h1">Players</h1>
                    <p className="tcc-sub">
                        Every roster in this year&rsquo;s Classic, freshly drafted — {players.length} skaters.
                    </p>
                </div>
            </div>

            <div className="tcc-container tcc-section">
                <div className="tcc-players-controls">
                    <div className="tcc-search">
                        <span className="tcc-search-icon" aria-hidden="true">⌕</span>
                        <input
                            className="tcc-search-input"
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search players…"
                            aria-label="Search players"
                        />
                    </div>
                    <div className="tcc-players-count">
                        Showing <b>{rows.length}</b> of {players.length}
                    </div>
                </div>

                <div className="tcc-filters">
                    <button
                        className={`tcc-filter ${teamFilter === 'All' ? 'is-active' : ''}`}
                        onClick={() => setTeamFilter('All')}
                    >
                        All
                    </button>
                    {teams.map(t => (
                        <button
                            key={t.id}
                            className={`tcc-filter ${teamFilter === t.name ? 'is-active' : ''}`}
                            onClick={() => setTeamFilter(t.name)}
                        >
                            <span className="tcc-dot is-sm" style={{ background: t.teamColor || '#888' }} />
                            {t.name}
                        </button>
                    ))}
                </div>

                {loading && <div className="tcc-empty">Loading players…</div>}
                {error && <div className="tcc-empty">{error}</div>}

                {!loading && !error && (
                    <div className="tcc-table">
                        <div className="tcc-thead tcc-players-row">
                            {COLUMNS.map(c => (
                                <button
                                    key={c.key}
                                    className={`tcc-sortbtn ${c.key === 'team' ? 'tcc-col-sm' : ''}`}
                                    onClick={() => toggleSort(c.key)}
                                >
                                    {c.label}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                                </button>
                            ))}
                        </div>

                        {rows.map(r => (
                            <div key={r.id} className="tcc-trow tcc-players-row">
                                <span className="tcc-roster-num">{r.num ?? '—'}</span>
                                <span className="tcc-roster-player">{r.name}</span>
                                <span className="tcc-col-sm">
                                    {r.teamId ? (
                                        <Link to={`${base}/teams/${r.teamId}`} className="tcc-players-team">
                                            <span className="tcc-dot is-sm" style={{ background: byId[r.teamId]?.teamColor || '#888' }} />
                                            {r.team}
                                        </Link>
                                    ) : r.team}
                                </span>
                                <span><span className="tcc-pos-pill">{r.pos}</span></span>
                            </div>
                        ))}

                        {rows.length === 0 && (
                            <div className="tcc-empty">No players match your search.</div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export default TournamentPlayers;
