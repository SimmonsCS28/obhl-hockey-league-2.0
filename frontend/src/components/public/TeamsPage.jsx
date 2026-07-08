import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import { resolveTeamColor } from '../../constants/teamColors';
import SeasonSelector from '../common/SeasonSelector';
import heroBg from '../../assets/images/buzzard-full.jpg';
import './TeamsPage.css';

const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function TeamsPage() {
    const navigate = useNavigate();
    const { seasons, selectedSeason, selectedSeasonId, setSelectedSeasonId, resetToActiveSeason } = useSeason();
    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Always open on the active season (the selection is app-global and otherwise sticks).
    useEffect(() => { resetToActiveSeason(); }, [resetToActiveSeason]);

    useEffect(() => {
        if (selectedSeasonId) {
            fetchTeams(selectedSeasonId);
            fetchPlayers(selectedSeasonId);
        }
    }, [selectedSeasonId]);

    const fetchTeams = async (seasonId) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/v1/teams?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch teams');
            const data = await response.json();
            // Rank by points, then total wins, then goal differential
            const sorted = data.sort((a, b) => {
                if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
                const bw = (b.wins || 0) + (b.overtimeWins || 0);
                const aw = (a.wins || 0) + (a.overtimeWins || 0);
                if (bw !== aw) return bw - aw;
                return ((b.goalsFor || 0) - (b.goalsAgainst || 0)) - ((a.goalsFor || 0) - (a.goalsAgainst || 0));
            });
            setTeams(sorted);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayers = async (seasonId) => {
        try {
            const response = await fetch(`/stats-api/players?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch players');
            setPlayers(await response.json());
        } catch (err) {
            console.error('Failed to fetch players:', err);
        }
    };

    const getGMName = (gmId) => {
        if (!gmId) return 'Not assigned';
        const gm = players.find(p => p.id === gmId);
        return gm ? `${gm.firstName} ${gm.lastName}` : 'Not assigned';
    };

    const rosterCount = (teamId) => players.filter(p => p.teamId === teamId).length;

    const record = (t) =>
        `${(t.wins || 0) + (t.overtimeWins || 0)}-${t.losses || 0}-${t.overtimeLosses || 0}`;

    return (
        <div className="obi-page obi-teams">
            <section className="obi-page-hero">
                <img src={heroBg} alt="" className="obi-page-hero-bg" />
                <div className="obi-page-hero-overlay" />
                <div className="obi-page-hero-inner">
                    <div className="obi-eyebrow">Old Buzzard Hockey League</div>
                    <h1 className="obi-page-title">TEAMS</h1>
                    <p className="obi-page-sub">
                        Ten clubs. One ugly trophy. {selectedSeason?.name || 'This season'}.
                    </p>
                </div>
            </section>

            {seasons?.length > 0 && (
                <div className="obi-teams-subbar">
                    <div className="obi-container obi-teams-subbar-inner">
                        <SeasonSelector
                            seasons={seasons}
                            selectedSeasonId={selectedSeasonId}
                            onChange={setSelectedSeasonId}
                        />
                        <span className="obi-showing">Showing <b>{teams.length}</b> clubs</span>
                    </div>
                </div>
            )}

            <section className="obi-teams-body">
                <div className="obi-container">
                    {loading ? (
                        <div className="obi-teams-msg">Loading teams…</div>
                    ) : error ? (
                        <div className="obi-teams-msg obi-neg">Error: {error}</div>
                    ) : teams.length === 0 ? (
                        <div className="obi-teams-msg">No teams found for this season.</div>
                    ) : (
                        <div className="obi-teams-grid">
                            {teams.map((team, index) => {
                                const color = resolveTeamColor(team.teamColor);
                                return (
                                    <div
                                        key={team.id}
                                        className="obi-team-card"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => navigate(`/teams/${team.id}`)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/teams/${team.id}`); }}
                                    >
                                        <div className="obi-team-card-bar" style={{ background: color }} />
                                        <div className="obi-team-card-body">
                                            <div className="obi-team-card-head">
                                                <div className="obi-team-card-id">
                                                    <span className="obi-team-swatch" style={{ background: color }} />
                                                    <span className="obi-team-card-name">{team.name}</span>
                                                </div>
                                                <span className="obi-rank-pill">{ordinal(index + 1)} Place</span>
                                            </div>

                                            <div className="obi-team-card-stats">
                                                <div className="obi-stat-box">
                                                    <div className="obi-stat-box-val">{record(team)}</div>
                                                    <div className="obi-stat-box-label">W · L · OTL</div>
                                                </div>
                                                <div className="obi-stat-box obi-stat-box-pts">
                                                    <div className="obi-stat-box-val">{team.points || 0}</div>
                                                    <div className="obi-stat-box-label">PTS</div>
                                                </div>
                                            </div>

                                            <div className="obi-team-card-meta">
                                                <div className="obi-meta-row">
                                                    <span className="obi-meta-label">General Manager</span>
                                                    <span className="obi-meta-val">{getGMName(team.gmId)}</span>
                                                </div>
                                                <div className="obi-meta-row">
                                                    <span className="obi-meta-label">Roster</span>
                                                    <span className="obi-meta-val">{rosterCount(team.id)} skaters</span>
                                                </div>
                                            </div>

                                            <div className="obi-team-card-cta">View Roster →</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

export default TeamsPage;
