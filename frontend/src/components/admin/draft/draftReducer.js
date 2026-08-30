import { buildBuddyPickMap } from './buddyGraph';
import { averageSkill } from './draftSelectors';

/**
 * Draft board state.
 *
 * The state is split in two, and that split is the point of this file:
 *
 *   DOCUMENT state (here) - the board itself. Undoable, and auto-saved.
 *   SESSION state (still useState in the component) - density, filters, search,
 *     modal flags, save status. Never undone, never saved.
 *
 * The old component kept all thirty pieces of state in one bag and hand-rolled undo
 * with a saveHistory() call that every mutating handler had to remember to make. Undo
 * therefore restored the pool filter along with the roster, and adding a field to the
 * snapshot meant auditing every call site. Splitting the two means undo can only ever
 * touch the board, and it falls out of withUndo() for free.
 */

export const HISTORY_LIMIT = 20;

export const DEFAULT_TEAM_COLOR = 'White';
export const DEFAULT_TEAM_SORT = 'Position + Rating';

export const ACTIONS = {
    SET_SEASON: 'SET_SEASON',
    SET_TEAM_COUNT: 'SET_TEAM_COUNT',
    START_DRAFT: 'START_DRAFT',
    SET_POOL: 'SET_POOL',
    HYDRATE: 'HYDRATE',
    NEW_DRAFT: 'NEW_DRAFT',
    FINALIZED: 'FINALIZED',
    SET_TEAM_NAME: 'SET_TEAM_NAME',
    SET_TEAM_COLOR: 'SET_TEAM_COLOR',
    SET_TEAM_SORT: 'SET_TEAM_SORT',
    // Undoable from here down.
    MOVE_PLAYERS: 'MOVE_PLAYERS',
    RETURN_TO_POOL: 'RETURN_TO_POOL',
    ASSIGN_GMS: 'ASSIGN_GMS',
    RESET_BOARD: 'RESET_BOARD',
    UPDATE_PLAYER: 'UPDATE_PLAYER'
};

/**
 * Exactly the five operations the old code called saveHistory() before. Kept as an
 * explicit list rather than a flag on each action so the undoable surface is reviewable
 * in one place.
 */
export const UNDOABLE_ACTIONS = new Set([
    ACTIONS.MOVE_PLAYERS,
    ACTIONS.RETURN_TO_POOL,
    ACTIONS.ASSIGN_GMS,
    ACTIONS.RESET_BOARD,
    ACTIONS.UPDATE_PLAYER
]);

export function buildTeams(teamCount) {
    return Array.from({ length: parseInt(teamCount, 10) || 0 }, (_, i) => ({
        id: i + 1,
        name: `Team ${i + 1}`,
        players: []
    }));
}

export function defaultTeamMaps(teams) {
    const teamColors = {};
    const teamSortOptions = {};
    teams.forEach(team => {
        teamColors[team.id] = DEFAULT_TEAM_COLOR;
        teamSortOptions[team.id] = DEFAULT_TEAM_SORT;
    });
    return { teamColors, teamSortOptions };
}

/**
 * Columns are ordered weakest-average-first, and re-ordered after every pick and every
 * GM assignment. The board visibly reshuffles as a result; that is deliberate and
 * long-standing, so it is preserved here rather than quietly dropped.
 */
function sortTeamsByAverageSkill(teams) {
    return [...teams].sort((a, b) => averageSkill(a.players) - averageSkill(b.players));
}

/** Buddy links are derived from the free text on the cards, so they are recomputed
 *  centrally after anything that changes a roster or a buddyPick value. The old code
 *  did this from a useEffect plus a second bespoke path for inline edits. */
function withBuddies(doc) {
    return { ...doc, buddyPickMap: buildBuddyPickMap(doc.playerPool, doc.teams) };
}

export function initialDocument(teamCount = 4) {
    const teams = buildTeams(teamCount);
    return {
        seasonName: '',
        seasonId: null,
        teamCount,
        isLive: false,
        playerPool: [],
        teams,
        buddyPickMap: {},
        ...defaultTeamMaps(teams)
    };
}

export function documentReducer(doc, action) {
    switch (action.type) {
        case ACTIONS.SET_SEASON:
            return { ...doc, seasonName: action.seasonName, seasonId: action.seasonId };

        case ACTIONS.SET_TEAM_COUNT: {
            // Rebuilding the board would throw away rosters, so once the draft is live
            // the count is display-only. The old effect had the same guard.
            if (doc.isLive) return { ...doc, teamCount: action.teamCount };
            const teams = buildTeams(action.teamCount);
            return { ...doc, teamCount: action.teamCount, teams, ...defaultTeamMaps(teams) };
        }

        case ACTIONS.START_DRAFT:
            return { ...doc, isLive: true };

        case ACTIONS.FINALIZED:
            return { ...doc, isLive: false };

        case ACTIONS.SET_POOL:
            return withBuddies({ ...doc, playerPool: action.players });

        case ACTIONS.HYDRATE:
            return withBuddies({ ...initialDocument(action.doc.teamCount), ...action.doc });

        case ACTIONS.NEW_DRAFT:
            return initialDocument(4);

        case ACTIONS.SET_TEAM_NAME:
            return {
                ...doc,
                teams: doc.teams.map(t => (t.id === action.teamId ? { ...t, name: action.name } : t))
            };

        case ACTIONS.SET_TEAM_COLOR:
            return { ...doc, teamColors: { ...doc.teamColors, [action.teamId]: action.color } };

        case ACTIONS.SET_TEAM_SORT:
            return {
                ...doc,
                teamSortOptions: { ...doc.teamSortOptions, [action.teamId]: action.sortOption }
            };

        case ACTIONS.MOVE_PLAYERS: {
            // Players may come from the pool or from another team, so they are removed
            // from everywhere before being added to the target. That is what makes a
            // team-to-team move safe against duplication.
            const moving = action.players;
            const emails = new Set(moving.map(p => p.email));
            const teams = doc.teams.map(team => {
                const remaining = team.players.filter(p => !emails.has(p.email));
                return team.id === action.targetTeamId
                    ? { ...team, players: [...remaining, ...moving] }
                    : { ...team, players: remaining };
            });
            return withBuddies({
                ...doc,
                playerPool: doc.playerPool.filter(p => !emails.has(p.email)),
                teams: sortTeamsByAverageSkill(teams)
            });
        }

        case ACTIONS.RETURN_TO_POOL: {
            const { player, sourceTeamId } = action;
            return withBuddies({
                ...doc,
                teams: doc.teams.map(t =>
                    t.id === sourceTeamId
                        ? { ...t, players: t.players.filter(p => p.email !== player.email) }
                        : t
                ),
                playerPool: [...doc.playerPool, player]
            });
        }

        case ACTIONS.ASSIGN_GMS: {
            // The shuffle happens in the caller so this stays pure and testable; the
            // reducer just seats the list it is given, one per GM-less team, in order.
            const queue = [...action.gms];
            const teams = doc.teams.map(team => {
                if (team.players.some(p => p.isGm) || queue.length === 0) return team;
                return { ...team, players: [...team.players, queue.shift()] };
            });
            const seated = new Set(
                action.gms.slice(0, action.gms.length - queue.length).map(g => g.email)
            );
            return withBuddies({
                ...doc,
                playerPool: doc.playerPool.filter(p => !seated.has(p.email)),
                teams: sortTeamsByAverageSkill(teams)
            });
        }

        case ACTIONS.RESET_BOARD: {
            // Everyone goes back to the pool. isLive deliberately stays true - this
            // clears the board, it does not end the draft.
            const returning = doc.teams.flatMap(t => t.players);
            const teams = buildTeams(doc.teamCount);
            return withBuddies({
                ...doc,
                playerPool: [...doc.playerPool, ...returning],
                teams,
                ...defaultTeamMaps(teams)
            });
        }

        case ACTIONS.UPDATE_PLAYER: {
            const { email, field, value } = action;
            const apply = p => (p.email === email ? { ...p, [field]: value } : p);
            return withBuddies({
                ...doc,
                playerPool: doc.playerPool.map(apply),
                teams: doc.teams.map(t => ({ ...t, players: t.players.map(apply) }))
            });
        }

        default:
            return doc;
    }
}

/**
 * Wraps a reducer with an undo stack. Only actions in UNDOABLE_ACTIONS push a snapshot,
 * and an action that produces no change pushes nothing - so undo never burns a step on a
 * no-op (dropping a player back onto the team they are already on, for example).
 */
export function withUndo(reducer) {
    return function undoableReducer(state, action) {
        if (action.type === 'UNDO') {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            return {
                past: state.past.slice(0, -1),
                present: previous,
                future: [state.present, ...state.future]
            };
        }

        if (action.type === 'REDO') {
            if (state.future.length === 0) return state;
            const [next, ...rest] = state.future;
            return {
                past: [...state.past, state.present].slice(-HISTORY_LIMIT),
                present: next,
                future: rest
            };
        }

        const present = reducer(state.present, action);
        if (present === state.present) return state;

        if (!UNDOABLE_ACTIONS.has(action.type)) {
            // A non-undoable change invalidates any redo branch, but does not add a step.
            return { past: state.past, present, future: [] };
        }

        return {
            past: [...state.past, state.present].slice(-HISTORY_LIMIT),
            present,
            future: []
        };
    };
}

export function initialUndoableState(teamCount = 4) {
    return { past: [], present: initialDocument(teamCount), future: [] };
}

/**
 * The payload persisted to draft_saves. Kept here next to the state it serialises so the
 * two cannot drift; the shape is what DraftStateDTO on league-service expects.
 */
export function toDraftPayload(doc) {
    const mapPlayer = p => ({
        ...p,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        position: p.position,
        skillRating: p.skillRating,
        isVeteran: !!p.isVeteran,
        isGm: !!p.isGm,
        isRef: !!p.isRef,
        status: p.status || (p.isVeteran ? 'Veteran' : 'Rookie'),
        buddyPick: p.buddyPick || ''
    });

    return {
        seasonName: doc.seasonName,
        seasonId: doc.seasonId,
        teamCount: doc.teamCount,
        isLive: doc.isLive,
        playerPool: doc.playerPool.map(mapPlayer),
        teams: doc.teams.map(t => ({
            id: t.id,
            name: t.name,
            color: doc.teamColors[t.id] || DEFAULT_TEAM_COLOR,
            sortOption: doc.teamSortOptions[t.id] || DEFAULT_TEAM_SORT,
            players: t.players.map(mapPlayer)
        }))
    };
}

/** Inverse of toDraftPayload, for resuming a saved draft. */
export function fromDraftPayload(payload) {
    const teams = (payload.teams || []).map(t => ({
        id: t.id,
        name: t.name,
        players: t.players || []
    }));
    const teamColors = {};
    const teamSortOptions = {};
    (payload.teams || []).forEach(t => {
        teamColors[t.id] = t.color || DEFAULT_TEAM_COLOR;
        teamSortOptions[t.id] = t.sortOption || DEFAULT_TEAM_SORT;
    });

    return {
        seasonName: payload.seasonName || '',
        seasonId: payload.seasonId ?? null,
        teamCount: payload.teamCount || teams.length || 4,
        isLive: payload.isLive !== undefined ? payload.isLive : true,
        playerPool: payload.playerPool || [],
        teams,
        teamColors,
        teamSortOptions
    };
}
