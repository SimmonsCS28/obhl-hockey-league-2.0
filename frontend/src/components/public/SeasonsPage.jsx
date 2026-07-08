import { useEffect, useState } from 'react';
import { useSeason } from '../../contexts/SeasonContext';
import { computeSeasonStats, seasonStatusMeta } from '../../utils/seasonStats';
import SeasonSelector from '../common/SeasonSelector';
import SeasonOverviewCards from '../common/SeasonOverviewCards';
import heroBg from '../../assets/images/buzzard-full.jpg';
import './SeasonsPage.css';

function SeasonsPage() {
    const { seasons, selectedSeason, selectedSeasonId, setSelectedSeasonId, resetToActiveSeason } = useSeason();
    // Always open on the active season (the selection is app-global and otherwise sticks).
    useEffect(() => { resetToActiveSeason(); }, [resetToActiveSeason]);
    // Stats are tagged with the season they were computed for, so a season switch shows
    // nothing (not stale numbers) until the new fetch lands — and we never setState
    // synchronously in the effect body.
    const [statsState, setStatsState] = useState({ seasonId: null, stats: null });

    // Fetch teams/players/games for the SELECTED season (not just the active one) to
    // compute the "Season by the Numbers" grid; recompute whenever the selection changes.
    useEffect(() => {
        if (!selectedSeasonId || !selectedSeason) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const [teamsRes, playersRes, gamesRes] = await Promise.all([
                    fetch(`/api/v1/teams?seasonId=${selectedSeasonId}`),
                    fetch(`/stats-api/players?seasonId=${selectedSeasonId}`),
                    fetch(`/games-api/games?seasonId=${selectedSeasonId}`),
                ]);
                const teams = teamsRes.ok ? await teamsRes.json() : [];
                const players = playersRes.ok ? await playersRes.json() : [];
                const games = gamesRes.ok ? await gamesRes.json() : [];
                if (!cancelled) {
                    setStatsState({ seasonId: selectedSeasonId, stats: computeSeasonStats(selectedSeason, teams, players, games) });
                }
            } catch (err) {
                console.error('Failed to load season stats:', err);
                if (!cancelled) setStatsState({ seasonId: selectedSeasonId, stats: null });
            }
        })();
        return () => { cancelled = true; };
    }, [selectedSeasonId, selectedSeason]);

    // Only surface stats that belong to the currently-selected season.
    const stats = statsState.seasonId === selectedSeasonId ? statsState.stats : null;
    const isEmpty = !seasons || seasons.length === 0;
    const st = selectedSeason ? seasonStatusMeta(selectedSeason.status) : null;

    return (
        <div className="obi-page obi-seasons">
            <section className="obi-page-hero">
                <img src={heroBg} alt="" className="obi-page-hero-bg" />
                <div className="obi-page-hero-overlay" />
                <div className="obi-page-hero-inner">
                    <div className="obi-eyebrow">Old Buzzard Hockey League</div>
                    <h1 className="obi-page-title">SEASONS</h1>
                    <p className="obi-page-sub">Every campaign in league history — active, upcoming, and archived.</p>
                </div>
            </section>

            <section className="obi-seasons-body">
                {isEmpty ? (
                    <div className="obi-container">
                        <div className="obi-seasons-empty">
                            <div className="obi-seasons-empty-icon" aria-hidden="true">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                                    <path d="M16 2v4M8 2v4M3 10h18"></path>
                                </svg>
                            </div>
                            <h2 className="obi-seasons-empty-title">No Seasons Yet</h2>
                            <p className="obi-seasons-empty-text">
                                There aren't any seasons on record right now. Once the league sets up its first
                                campaign, it'll show up here with dates and details.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="obi-container">
                        {/* Sticky toolbar — season picker + count */}
                        <div className="obi-seasons-toolbar">
                            <SeasonSelector
                                seasons={seasons}
                                selectedSeasonId={selectedSeasonId}
                                onChange={setSelectedSeasonId}
                            />
                            <span className="obi-seasons-count">
                                <b>{seasons.length}</b> season{seasons.length === 1 ? '' : 's'} on record
                            </span>
                        </div>

                        {selectedSeason && (
                            <div className="obi-seasons-panel">
                                <div className="obi-seasons-panel-head">
                                    <div>
                                        <div className={`obi-seasons-status-eyebrow is-${st.mod}`}>{st.eyebrow}</div>
                                        <h2 className="obi-seasons-name">{selectedSeason.name}</h2>
                                    </div>
                                    {selectedSeason.isActive && (
                                        <span className="obi-seasons-active-badge">
                                            <span className="obi-seasons-active-dot" />Active Season
                                        </span>
                                    )}
                                </div>

                                <div className="obi-seasons-grid">
                                    <SeasonOverviewCards season={selectedSeason} />
                                </div>

                                {stats && (
                                    <div className="obi-seasons-numbers">
                                        <div className="obi-seasons-numbers-head">
                                            <span className="obi-seasons-numbers-title">Season by the Numbers</span>
                                            <span className="obi-seasons-numbers-rule" />
                                        </div>
                                        <div className="obi-seasons-numbers-grid">
                                            {stats.map((s) => (
                                                <div key={s.label} className="obi-seasons-stat">
                                                    <div className="obi-seasons-stat-val">{s.value}</div>
                                                    <div className="obi-seasons-stat-label">{s.label}</div>
                                                    <div className="obi-seasons-stat-sub">{s.sub}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}

export default SeasonsPage;
