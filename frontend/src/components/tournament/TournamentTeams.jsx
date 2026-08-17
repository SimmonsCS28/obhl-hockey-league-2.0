import { Link } from 'react-router-dom';
import { useTournament } from './useTournament';
import { useTournamentGames, useTournamentPlayers, useTournamentTeams, tournamentRecord } from './tournamentData';
import './TournamentPages.css';

function TournamentTeams() {
    const { tournament, seasonId, base } = useTournament();
    const { teams, loading, error } = useTournamentTeams(seasonId);
    const { games } = useTournamentGames(seasonId);
    const { players } = useTournamentPlayers(seasonId);

    const rosterSize = (teamId) => players.filter(p => p.teamId === teamId).length;
    const captainOf = (team) => players.find(p => p.id === team.captainPlayerId);

    return (
        <>
            <div className="tcc-head">
                <div className="tcc-head-inner">
                    <div className="tcc-eyebrow">{teams.length || tournament.teamCount} Teams</div>
                    <h1 className="tcc-h1">The Field</h1>
                    <p className="tcc-sub">
                        Freshly drafted for this year&rsquo;s Classic — these rosters have no tie to
                        regular-season teams.
                    </p>
                </div>
            </div>

            <div className="tcc-container tcc-section">
                {loading && <div className="tcc-empty">Loading teams…</div>}
                {error && <div className="tcc-empty">{error}</div>}
                {!loading && !error && teams.length === 0 && (
                    <div className="tcc-empty">
                        <div className="tcc-empty-title">The field isn&rsquo;t set yet</div>
                        Teams appear here once the draft is done.
                    </div>
                )}

                <div className="tcc-team-grid">
                    {teams.map(team => {
                        const rec = tournamentRecord(team.id, games);
                        const captain = captainOf(team);
                        return (
                            <Link key={team.id} to={`${base}/teams/${team.id}`} className="tcc-team-card">
                                <div className="tcc-team-card-top">
                                    <span className="tcc-team-seed">
                                        {team.seed != null ? `SEED ${team.seed}` : 'UNSEEDED'}
                                    </span>
                                    <span className="tcc-dot is-lg" style={{ background: team.teamColor || '#888' }} />
                                </div>
                                <div className="tcc-team-name">{team.name}</div>
                                <div className="tcc-team-captain">
                                    {captain ? `${captain.firstName} ${captain.lastName}` : 'Captain TBD'}
                                    {team.pool ? ` · Division ${team.pool}` : ''}
                                </div>
                                <div className="tcc-team-divider" />
                                <div className="tcc-team-stats">
                                    <div>
                                        {/* Tournament record only — never the season record. */}
                                        <div className="tcc-team-stat-value">{rec.label}</div>
                                        <div className="tcc-team-stat-label">Classic Record</div>
                                    </div>
                                    <div>
                                        <div
                                            className="tcc-team-stat-value"
                                            style={{ color: team.eliminated ? 'var(--tcc-out)' : 'var(--tcc-blue)' }}
                                        >
                                            {team.eliminated ? 'Out' : 'Alive'}
                                        </div>
                                        <div className="tcc-team-stat-label">Classic Status</div>
                                    </div>
                                    <div>
                                        <div className="tcc-team-stat-value">{rosterSize(team.id)}</div>
                                        <div className="tcc-team-stat-label">Skaters</div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

export default TournamentTeams;
