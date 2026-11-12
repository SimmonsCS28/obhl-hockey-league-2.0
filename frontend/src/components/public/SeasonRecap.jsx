import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { longDate } from '../../utils/seasonStats';
import './SeasonRecap.css';

const teamName = (name) => name || 'Unknown team';
function Matchup({ game }) {
    return <div className="recap-match"><span>{teamName(game.homeTeam)}</span><strong>{game.homeScore ?? '—'} <i>–</i> {game.awayScore ?? '—'}</strong><span>{teamName(game.awayTeam)}</span></div>;
}
export default function SeasonRecap({ season }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/v1/seasons/${season.id}/recap`, { signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error('The season recap could not be loaded.');
                return response.json();
            }).then(value => { if (!controller.signal.aborted) { setData(value); setError(''); } })
            .catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => controller.abort();
    }, [season.id, attempt]);
    if (error) return <div className="recap-state" role="alert">{error}<button onClick={() => setAttempt(n => n + 1)}>Try again</button></div>;
    if (!data) return <p className="recap-state" role="status">Putting the season in perspective…</p>;
    const final = data.champion?.finalGame;
    const highlight = data.highestScoringGame;
    return <div className="recap">
        <p className="recap-dates">{longDate(season.startDate)} — {longDate(season.endDate)} <span>· The season in review</span></p>
        <section className={`recap-champion ${data.champion ? '' : 'is-unrecorded'}`} aria-labelledby="recap-champion-title">
            <div className="recap-trophy" aria-hidden="true">★</div>
            <div className="recap-champion-copy"><div className="recap-eyebrow">{data.champion ? 'Season champions' : 'Championship'}</div>
                <h3 id="recap-champion-title">{data.champion?.teamName || 'Champion not recorded'}</h3>
                <p>{data.champion ? data.champion.byForfeit ? 'Championship awarded by forfeit.' : `The final word on ${season.name}.` : data.championNote}</p>
            </div>
            {final && <div className="recap-final">{!data.champion.byForfeit && <Matchup game={final} />}
                <Link to={`/game/${final.id}/recap`}>Championship recap {final.overtime ? '· OT ' : ''}↗</Link></div>}
        </section>
        <div className="recap-numbers" aria-label="Season totals">
            <div><strong>{data.gamesPlayed}</strong><span>Games played</span><small>Regular season + playoffs</small></div>
            <div><strong>{data.totalGoals ?? '—'}</strong><span>Goals scored</span><small>{data.scoredGames ? `Across ${data.scoredGames} scored games` : 'No final scores recorded'}</small></div>
            <div><strong>{data.penaltiesRecorded}</strong><span>Penalties recorded</span><small>From completed game reports</small></div>
            <div><strong>{data.penaltyMinutes}</strong><span>Penalty minutes</span><small>Recorded time in the box</small></div>
        </div>
        {data.scoredGames < data.gamesPlayed && <p className="recap-note">{data.gamesPlayed - data.scoredGames} completed {data.gamesPlayed - data.scoredGames === 1 ? 'game has' : 'games have'} no valid final score; goal totals reflect the scored games only.</p>}
        {data.forfeits > 0 && <p className="recap-note">{data.forfeits} {data.forfeits === 1 ? 'forfeit is' : 'forfeits are'} excluded from games played, goals, and penalty totals.</p>}
        {highlight ? <section className="recap-highlight" aria-labelledby="recap-highlight-title">
            <div><div className="recap-eyebrow">One for the scrapbook</div><h3 id="recap-highlight-title">A {highlight.homeScore + highlight.awayScore}-goal night.</h3>
                <p>{data.highestScoringTies > 1 ? `One of ${data.highestScoringTies} games tied for the season’s highest combined score.` : 'The highest combined score of the season.'}</p></div>
            <div><Matchup game={highlight} /><Link to={`/game/${highlight.id}/recap`}>See the game recap ↗</Link></div>
        </section> : <div className="recap-empty"><h3>A season worth remembering.</h3><p>There are no scored games on record yet. Highlights will appear when final scores are available.</p></div>}
        <p className="recap-note">Based on recorded regular-season and playoff games. Tournament games are excluded; penalty figures reflect the events entered by scorekeepers.</p>
    </div>;
}
