import { useEffect, useMemo, useState } from 'react';
import { request } from '../../services/api';
import './ChocolateMilkPicker.css';

/**
 * Chocolate Milk Player of the Game.
 *
 * A separate component rather than more surface inside LiveScoreEntry, which is already 1,800 lines.
 * It appears once a tournament game is final, because that is when the captains actually decide.
 *
 * Each bench names one player from the OTHER bench -- the tournament's signature tradition, and the
 * reason this is two pickers rather than one. The rule is enforced server-side as well; here it is
 * expressed by simply never offering a captain their own roster.
 */
function ChocolateMilkPicker({ game, homeTeam, awayTeam, homeRoster, awayRoster, readOnly = false }) {
    const [awards, setAwards] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!game?.id) return;
        request(`/games/${game.id}/awards`).then(setAwards).catch(() => setAwards([]));
    }, [game?.id]);

    const byBench = useMemo(() => {
        const m = {};
        for (const a of awards) m[a.awardedByTeamId] = a;
        return m;
    }, [awards]);

    if (!game || game.gameType !== 'TOURNAMENT') return null;

    const pick = async (awardedByTeamId, player, playerTeamId) => {
        setBusy(true);
        setError(null);
        try {
            await request(`/games/${game.id}/awards`, {
                method: 'POST',
                body: JSON.stringify({ awardedByTeamId, playerId: player.id, playerTeamId }),
            });
            setAwards(await request(`/games/${game.id}/awards`));
        } catch (e) {
            setError(e.message || 'Could not record that pick');
        } finally {
            setBusy(false);
        }
    };

    const renderBench = (bench, opponent, opponentRoster) => {
        const chosen = byBench[bench?.id];
        const chosenPlayer = chosen && opponentRoster.find(p => p.id === chosen.playerId);

        return (
            <div className="cmp-bench">
                <div className="cmp-bench-head">
                    <span className="cmp-dot" style={{ background: bench?.teamColor || '#888' }} />
                    <span className="cmp-bench-name">{bench?.name}</span>
                    <span className="cmp-bench-sub">names a {opponent?.name} player</span>
                </div>

                {chosenPlayer ? (
                    <div className="cmp-chosen">
                        <span className="cmp-chosen-name">
                            {chosenPlayer.firstName} {chosenPlayer.lastName}
                        </span>
                        {!readOnly && (
                            <button
                                className="cmp-change"
                                disabled={busy}
                                onClick={() => setAwards(awards.filter(a => a.id !== chosen.id))}
                            >
                                Change
                            </button>
                        )}
                    </div>
                ) : readOnly ? (
                    <div className="cmp-empty">Not yet awarded</div>
                ) : (
                    <select
                        className="cmp-select"
                        defaultValue=""
                        disabled={busy}
                        onChange={e => {
                            const player = opponentRoster.find(p => String(p.id) === e.target.value);
                            if (player) pick(bench.id, player, opponent.id);
                        }}
                    >
                        <option value="" disabled>Choose a player...</option>
                        {opponentRoster.map(p => (
                            <option key={p.id} value={p.id}>
                                #{p.jerseyNumber ?? '-'} {p.firstName} {p.lastName}
                            </option>
                        ))}
                    </select>
                )}
            </div>
        );
    };

    return (
        <section className="cmp">
            <div className="cmp-head">
                <span className="cmp-icon" aria-hidden="true">&#129371;</span>
                <div>
                    <h3 className="cmp-title">Chocolate Milk Player of the Game</h3>
                    <p className="cmp-sub">
                        Each captain names one player from the other bench who showed the best
                        sportsmanship.
                    </p>
                </div>
            </div>

            {error && <div className="cmp-error">{error}</div>}

            <div className="cmp-benches">
                {renderBench(homeTeam, awayTeam, awayRoster || [])}
                {renderBench(awayTeam, homeTeam, homeRoster || [])}
            </div>
        </section>
    );
}

export default ChocolateMilkPicker;
