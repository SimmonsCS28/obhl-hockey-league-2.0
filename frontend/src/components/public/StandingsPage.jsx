import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import SeasonSelector from '../common/SeasonSelector';
import heroBg from '../../assets/images/buzzard-full.jpg';
import './StandingsPage.css';

// Top N teams make the playoffs (drawn as a gold cut-line in the table).
const PLAYOFF_SPOTS = 8;

// Resolve a team's stored color (hex or known name) to a CSS color for the dot.
const TEAM_COLOR_MAP = {
    'Red': '#FF0000', 'Blue': '#0000FF', 'Orange': '#FFA500', 'Green': '#008000',
    'Black': '#000000', 'Maroon': '#800000', 'Gray': '#808080', 'Grey': '#808080',
    'Lt. Blu': '#ADD8E6', 'Lt. Blue': '#ADD8E6', 'Tan': '#D2B48C', 'White': '#FFFFFF',
    'Yellow': '#FFD700', 'Gold': '#FFD700', 'Purple': '#800080', 'Navy': '#000080',
};
const dotColor = (color) => (color ? (TEAM_COLOR_MAP[color] || color) : '#808080');

function StandingsPage() {
    const navigate = useNavigate();
    const { seasons, selectedSeason, selectedSeasonId, setSelectedSeasonId, resetToActiveSeason } = useSeason();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Always open on the active season (the selection is app-global and otherwise sticks).
    useEffect(() => { resetToActiveSeason(); }, [resetToActiveSeason]);

    useEffect(() => {
        if (selectedSeasonId) {
            fetchTeams(selectedSeasonId);
        }
    }, [selectedSeasonId]);

    const fetchTeams = async (seasonId) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/v1/teams?seasonId=${seasonId}`);
            if (!response.ok) throw new Error('Failed to fetch teams');
            const data = await response.json();

            // Sort: points desc, then total wins, then goals against asc, then goals for desc
            const sorted = data.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                const bWins = (b.wins || 0) + (b.overtimeWins || 0);
                const aWins = (a.wins || 0) + (a.overtimeWins || 0);
                if (bWins !== aWins) return bWins - aWins;
                if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
                return b.goalsFor - a.goalsFor;
            });
            setTeams(sorted);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const wins = (t) => (t.wins || 0) + (t.overtimeWins || 0);
    const gamesPlayed = (t) =>
        (t.wins || 0) + (t.overtimeWins || 0) + (t.losses || 0) + (t.ties || 0) + (t.overtimeLosses || 0);
    const goalDiff = (t) => (t.goalsFor || 0) - (t.goalsAgainst || 0);

    const renderRow = (team, index) => {
        const isPlayoff = index < PLAYOFF_SPOTS;
        const diff = goalDiff(team);
        const diffClass = diff > 0 ? 'obi-pos' : diff < 0 ? 'obi-neg' : 'obi-neutral';

        return (
            <div
                key={team.id}
                className={`obi-srow ${isPlayoff ? 'is-playoff' : 'is-out'}`}
                onClick={() => navigate(`/teams/${team.id}`)}
                title="View team roster"
            >
                <span className="obi-col-rank">{index + 1}</span>
                <span className="obi-col-team">
                    <span className="obi-team-dot" style={{ background: dotColor(team.teamColor) }} />
                    <span className="obi-team-name">{team.name}</span>
                </span>
                <span className="obi-col-pts">{team.points || 0}</span>
                <span className="obi-col-num">{gamesPlayed(team)}</span>
                <span className="obi-col-num obi-col-w">{wins(team)}</span>
                <span className="obi-col-num">{team.losses || 0}</span>
                <span className="obi-col-num obi-col-sm">{team.ties || 0}</span>
                <span className="obi-col-num obi-col-sm">{team.overtimeLosses || 0}</span>
                <span className="obi-col-num obi-col-md">{team.goalsFor || 0}</span>
                <span className="obi-col-num obi-col-md">{team.goalsAgainst || 0}</span>
                <span className={`obi-col-num obi-col-sm ${diffClass}`}>
                    {diff > 0 ? '+' : ''}{diff}
                </span>
            </div>
        );
    };

    return (
        <div className="obi-page obi-standings">
            <section className="obi-page-hero">
                <img src={heroBg} alt="" className="obi-page-hero-bg" />
                <div className="obi-page-hero-overlay" />
                <div className="obi-page-hero-inner">
                    <div className="obi-eyebrow">Old Buzzard Hockey League</div>
                    <h1 className="obi-page-title">STANDINGS</h1>
                    <p className="obi-page-sub">
                        {selectedSeason?.name || 'Season'} · Top {PLAYOFF_SPOTS} advance to playoffs
                    </p>
                </div>
            </section>

            <section className="obi-standings-body">
                <div className="obi-container">
                    <div className="obi-standings-toolbar">
                        {seasons?.length > 0 && (
                            <SeasonSelector
                                seasons={seasons}
                                selectedSeasonId={selectedSeasonId}
                                onChange={setSelectedSeasonId}
                            />
                        )}
                        <div className="obi-legend">
                            <span><b>PTS</b> = points · Win = 2 · OT Loss = 1 · Loss = 0</span>
                            <span className="obi-legend-cut">
                                <span className="obi-legend-line" />Playoff cut line
                            </span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="obi-standings-msg">Loading standings…</div>
                    ) : error ? (
                        <div className="obi-standings-msg obi-neg">Error: {error}</div>
                    ) : teams.length === 0 ? (
                        <div className="obi-standings-msg">No teams found for this season.</div>
                    ) : (
                        <div className="obi-table-card">
                            <div className="obi-srow obi-srow-head">
                                <span className="obi-col-rank">#</span>
                                <span className="obi-col-team">Team</span>
                                <span className="obi-col-pts obi-pts-head">PTS</span>
                                <span className="obi-col-num">GP</span>
                                <span className="obi-col-num obi-col-w">W</span>
                                <span className="obi-col-num">L</span>
                                <span className="obi-col-num obi-col-sm">T</span>
                                <span className="obi-col-num obi-col-sm">OTL</span>
                                <span className="obi-col-num obi-col-md">GF</span>
                                <span className="obi-col-num obi-col-md">GA</span>
                                <span className="obi-col-num obi-col-sm">DIFF</span>
                            </div>

                            {teams.map((team, index) => {
                                const row = renderRow(team, index);
                                // Insert the playoff cut divider right before the first non-playoff team
                                if (index === PLAYOFF_SPOTS) {
                                    return [
                                        <div key="cut" className="obi-playoff-cut">
                                            <span className="obi-playoff-cut-label">Playoff Cut · Top {PLAYOFF_SPOTS} Advance</span>
                                            <span className="obi-playoff-cut-line" />
                                        </div>,
                                        row,
                                    ];
                                }
                                return row;
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

export default StandingsPage;
