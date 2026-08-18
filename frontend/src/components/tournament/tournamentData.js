import { useEffect, useState } from 'react';
import { request } from '../../services/api';

/**
 * Data hooks for the microsite.
 *
 * Tournament teams, players and games are ordinary season-scoped rows, so everything here is a
 * normal league endpoint filtered by the tournament's seasonId. There is no separate tournament
 * data API and there should not be one.
 *
 * Routed through api.js's `request` rather than raw fetch so error messages and 401 handling match
 * the rest of the app — the existing public pages hand-roll fetch and that is a known wart, not a
 * pattern to copy.
 */

function useResource(fetcher, deps, fallback) {
    const [data, setData] = useState(fallback);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetcher()
            .then(d => { if (!cancelled) { setData(d ?? fallback); setError(null); } })
            .catch(e => { if (!cancelled) setError(e.message || 'Failed to load'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { data, loading, error };
}

/** Teams in the tournament, ordered by seed (unseeded last, then by name). */
export function useTournamentTeams(seasonId) {
    const { data, loading, error } = useResource(
        () => (seasonId ? request(`/teams?seasonId=${seasonId}`) : Promise.resolve([])),
        [seasonId],
        []
    );

    const teams = [...data].sort((a, b) => {
        if (a.seed != null && b.seed != null) return a.seed - b.seed;
        if (a.seed != null) return -1;
        if (b.seed != null) return 1;
        return a.name.localeCompare(b.name);
    });

    return { teams, loading, error };
}

export function useTournamentPlayers(seasonId) {
    const { data, loading, error } = useResource(
        () => (seasonId ? request(`/players?seasonId=${seasonId}`) : Promise.resolve([])),
        [seasonId],
        []
    );
    return { players: data, loading, error };
}

export function useTournamentGames(seasonId) {
    const { data, loading, error } = useResource(
        () => (seasonId ? request(`/games?seasonId=${seasonId}`) : Promise.resolve([])),
        [seasonId],
        []
    );

    const games = [...data].sort(
        (a, b) => new Date(a.gameDate || 0) - new Date(b.gameDate || 0)
    );
    return { games, loading, error };
}

/**
 * Standings, computed server-side from completed group-stage games.
 *
 * Deliberately not derived from teams.points — those columns are league-shaped and are never
 * written for tournament games.
 */
export function useTournamentStandings(seasonId) {
    const { data, loading, error } = useResource(
        () => (seasonId ? request(`/games/tournament-standings?seasonId=${seasonId}`) : Promise.resolve([])),
        [seasonId],
        []
    );
    return { standings: data, loading, error };
}

/** Chocolate Milk awards across the whole tournament. */
export function useTournamentAwards(seasonId) {
    const { data, loading, error } = useResource(
        () => (seasonId ? request(`/games/tournament-awards?seasonId=${seasonId}`) : Promise.resolve([])),
        [seasonId],
        []
    );
    return { awards: data, loading, error };
}

/**
 * Champion and eliminated teams, computed server-side from results.
 *
 * Not read from tournaments.champion_team_id or teams.eliminated: deriving them means an
 * unfinalized game simply changes the answer, with nothing to keep in sync.
 */
export function useTournamentResult(seasonId) {
    const { data, loading, error } = useResource(
        () => (seasonId
            ? request(`/games/tournament-result?seasonId=${seasonId}`)
            : Promise.resolve({ championTeamId: null, eliminatedTeamIds: [] })),
        [seasonId],
        { championTeamId: null, eliminatedTeamIds: [] }
    );
    return {
        championTeamId: data?.championTeamId ?? null,
        eliminatedTeamIds: data?.eliminatedTeamIds ?? [],
        loading,
        error,
    };
}

export function useTournamentRules(tournamentId) {
    const { data, loading, error } = useResource(
        () => (tournamentId ? request(`/tournaments/${tournamentId}/rules`) : Promise.resolve([])),
        [tournamentId],
        []
    );
    return { sections: data, loading, error };
}

/* --------------------------------------------------------------- helpers */

/** id -> team, for joining games and players to their teams client-side. */
export function teamMap(teams) {
    return Object.fromEntries(teams.map(t => [t.id, t]));
}

/**
 * Tournament record for a team, computed from completed games.
 *
 * Deliberately NOT read from teams.points/wins/losses: those columns are league-shaped and are
 * never written for tournament games. Showing them would display a season record on a tournament
 * page, which the whole design forbids.
 */
export function tournamentRecord(teamId, games) {
    let w = 0, l = 0, t = 0;
    for (const g of games) {
        if (g.status !== 'completed') continue;
        const isHome = g.homeTeamId === teamId;
        const isAway = g.awayTeamId === teamId;
        if (!isHome && !isAway) continue;

        const mine = isHome ? g.homeScore : g.awayScore;
        const theirs = isHome ? g.awayScore : g.homeScore;
        if (mine > theirs) w++;
        else if (theirs > mine) l++;
        else t++;
    }
    return { wins: w, losses: l, ties: t, label: t > 0 ? `${w}-${l}-${t}` : `${w}-${l}` };
}

export const POSITION_LABEL = { F: 'Forward', D: 'Defense', G: 'Goalie' };

/**
 * games.game_date is stored and served in UTC without a timezone marker, so it has to be told it is
 * UTC before being shown in rink time. Parsing it bare makes the browser read it as local, which
 * happens to look right on a machine in Central time and is silently wrong everywhere else — and
 * disagrees with GamePreview/GameRecap, which do this correctly.
 */
export const ARENA_TZ = 'America/Chicago';

const parseUtc = (iso) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`);

export function formatGameDate(iso, opts = {}) {
    if (!iso) return 'TBD';
    return parseUtc(iso).toLocaleDateString('en-US',
        { weekday: 'short', month: 'short', day: 'numeric', timeZone: ARENA_TZ, ...opts });
}

export function formatGameTime(iso) {
    if (!iso) return 'TBD';
    return parseUtc(iso).toLocaleTimeString('en-US',
        { hour: 'numeric', minute: '2-digit', timeZone: ARENA_TZ });
}

/** Day grouping key in rink time — a late game must not slide into the next day. */
export function arenaDayKey(iso) {
    if (!iso) return 'tbd';
    return parseUtc(iso).toLocaleDateString('en-CA', { timeZone: ARENA_TZ }); // YYYY-MM-DD
}

/**
 * Formats a key from {@link arenaDayKey}.
 *
 * Separate from formatGameDate because that one converts UTC into rink time, and a day key has
 * already been converted. Running it through twice reads midnight local as midnight UTC and lands
 * on the previous evening — which showed up as Saturday's games headed "Friday".
 */
export function formatArenaDay(dayKey, opts = {}) {
    if (!dayKey || dayKey === 'tbd') return 'Date TBD';
    const [y, m, d] = dayKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US',
        { weekday: 'long', month: 'short', day: 'numeric', ...opts });
}

export function formatGameDateTime(iso) {
    if (!iso) return 'TBD';
    return parseUtc(iso).toLocaleString('en-US',
        { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: ARENA_TZ });
}

export const STAGE_LABEL = {
    POOL: 'Division',
    ROUND_ROBIN: 'Round Robin',
    BRACKET: 'Bracket',
    PLACEMENT: 'Placement',
    CONSOLATION: 'Consolation',
};
