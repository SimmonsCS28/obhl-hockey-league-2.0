import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeason } from '../../contexts/SeasonContext';
import api from '../../services/api';
import '../public/StandingsPage.css';
import './AdminStandings.css';

// Top N advance to playoffs (drawn as the gold cut-line).
const PLAYOFF_SPOTS = 8;

const TEAM_COLOR_MAP = {
    'Red': '#FF0000', 'Blue': '#0000FF', 'Orange': '#FFA500', 'Green': '#008000',
    'Black': '#000000', 'Maroon': '#800000', 'Gray': '#808080', 'Grey': '#808080',
    'Lt. Blu': '#ADD8E6', 'Lt. Blue': '#ADD8E6', 'Tan': '#D2B48C', 'White': '#FFFFFF',
    'Yellow': '#FFD700', 'Gold': '#FFD700', 'Purple': '#800080', 'Navy': '#000080',
};
const dotColor = (color) => (color ? (TEAM_COLOR_MAP[color] || color) : '#808080');

function AdminStandings() {
    const navigate = useNavigate();
    const { selectedSeasonId } = useSeason();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!selectedSeasonId) return;
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const all = await api.getTeams();
                if (cancelled) return;
                const sorted = (all || [])
                    .filter(t => t.seasonId === selectedSeasonId)
                    .sort((a, b) => {
                        if (b.points !== a.points) return b.points - a.points;
                        const bWins = (b.wins || 0) + (b.overtimeWins || 0);
                        const aWins = (a.wins || 0) + (a.overtimeWins || 0);
                        if (bWins !== aWins) return bWins - aWins;
                        if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
                        return b.goalsFor - a.goalsFor;
                    });
                setTeams(sorted);
                setError(null);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load standings');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedSeasonId]);

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
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/teams/${team.id}`)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/teams/${team.id}`)}
                title="Open team"
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
        <div className="obi-standings admin-standings">
            <div className="admin-standings-note">
                Read-only — standings are derived from finalized box scores. Top {PLAYOFF_SPOTS} advance to playoffs.
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
    );
}

export default AdminStandings;
