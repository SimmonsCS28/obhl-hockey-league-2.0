import { POSITION_DEFENSE, POSITION_FORWARD } from './draftSelectors';
import { averageSkill } from './draftSelectors';

/**
 * Which order the team columns sit in.
 *
 * The load-bearing idea, from the design hand-back: the visual order is its own piece of
 * state, NOT a sort recomputed from the teams on every render. A comparator produces the
 * *desired* order; the board only catches up to it at deliberate moments - choosing an
 * axis, pressing Re-order, assigning GMs, or a pick while Auto is on. The gap between
 * desired and actual is what the out-of-place count and the per-column rank deltas report.
 *
 * That gap is the whole feature. Re-sorting live on every pick would move the column the
 * operator just dropped onto out from under their cursor.
 */

export const ORDER_AXIS = {
    SKILL: 'skill',
    ROSTER: 'roster',
    DEFENCE: 'defence',
    FORWARDS: 'forwards',
    FIXED: 'fixed'
};

export const DIRECTION = { ASC: 'asc', DESC: 'desc' };

const countAt = (team, position) => (team.players || []).filter(p => p.position === position).length;

/**
 * Each axis owns its default direction, chosen so the team that needs the next pick is
 * leftmost. That means FEWEST defencemen first, not ascending for its own sake.
 */
export const ORDER_AXES = [
    {
        id: ORDER_AXIS.SKILL,
        label: 'Skill avg',
        defaultDirection: DIRECTION.ASC,
        value: (team) => averageSkill(team.players || []),
        wording: { asc: 'Lowest first', desc: 'Highest first' },
        // Sentence form for messages: the compact toggle label does not survive being
        // lowercased into prose ("fewest D first" becomes "fewest d first").
        sentence: { asc: 'lowest average skill first', desc: 'highest average skill first' },
        // The only axis that re-orders on its own by default: it is the long-standing
        // behaviour and the one nobody complains about.
        autoByDefault: true
    },
    {
        id: ORDER_AXIS.ROSTER,
        label: 'Roster',
        defaultDirection: DIRECTION.ASC,
        value: (team) => (team.players || []).length,
        wording: { asc: 'Smallest first', desc: 'Largest first' },
        sentence: { asc: 'smallest roster first', desc: 'largest roster first' },
        autoByDefault: false
    },
    {
        id: ORDER_AXIS.DEFENCE,
        label: 'Defence',
        defaultDirection: DIRECTION.ASC,
        value: (team) => countAt(team, POSITION_DEFENSE),
        wording: { asc: 'Fewest D first', desc: 'Most D first' },
        sentence: { asc: 'fewest defencemen first', desc: 'most defencemen first' },
        autoByDefault: false
    },
    {
        id: ORDER_AXIS.FORWARDS,
        label: 'Forwards',
        defaultDirection: DIRECTION.ASC,
        value: (team) => countAt(team, POSITION_FORWARD),
        wording: { asc: 'Fewest F first', desc: 'Most F first' },
        sentence: { asc: 'fewest forwards first', desc: 'most forwards first' },
        autoByDefault: false
    },
    {
        id: ORDER_AXIS.FIXED,
        label: 'Fixed',
        defaultDirection: DIRECTION.ASC,
        value: null,
        wording: { asc: 'as set up', desc: 'as set up' },
        sentence: { asc: 'setup order', desc: 'setup order' },
        autoByDefault: false
    }
];

export const axisById = (id) => ORDER_AXES.find(a => a.id === id) || ORDER_AXES[0];

/** Worded, never a bare glyph: an arrow on a defence count is ambiguous, and this control
 *  is used once a season by someone who last saw it eleven months ago. */
export function directionLabel(axisId, direction) {
    const axis = axisById(axisId);
    return axis.wording[direction] || axis.wording.asc;
}

/** Prose form, for messages. Never derived by lowercasing directionLabel(). */
export function directionSentence(axisId, direction) {
    const axis = axisById(axisId);
    return (axis.sentence && axis.sentence[direction]) || axis.sentence.asc;
}

export const defaultDirections = () =>
    ORDER_AXES.reduce((acc, a) => ({ ...acc, [a.id]: a.defaultDirection }), {});

/**
 * The order the columns WOULD be in. Ties break on the team's own id, which is the order
 * they were set up in, so equal teams never swap places for free.
 */
export function desiredOrder(teams, axisId, direction) {
    if (axisId === ORDER_AXIS.FIXED) {
        return [...teams].sort((a, b) => a.id - b.id).map(t => t.id);
    }
    const axis = axisById(axisId);
    const sign = direction === DIRECTION.DESC ? -1 : 1;
    return [...teams]
        .sort((a, b) => {
            const diff = (axis.value(a) - axis.value(b)) * sign;
            return diff !== 0 ? diff : a.id - b.id;
        })
        .map(t => t.id);
}

/**
 * How far each column is from where it would be. Positive means it would move LEFT (toward
 * the front) by that many places; negative, right.
 */
export function rankDeltas(teams, desiredIds) {
    const target = new Map(desiredIds.map((id, i) => [id, i]));
    const deltas = {};
    teams.forEach((team, currentIndex) => {
        const wanted = target.get(team.id);
        if (wanted === undefined) return;
        const delta = currentIndex - wanted;
        if (delta !== 0) deltas[team.id] = delta;
    });
    return deltas;
}

export const outOfPlaceCount = (deltas) => Object.keys(deltas).length;

/** True when the board already sits in the desired order, so nothing needs saying. */
export function isInOrder(teams, desiredIds) {
    return teams.every((team, i) => team.id === desiredIds[i]);
}

/** Reorders the teams array to match a list of ids. Any team missing from the list keeps
 *  its relative position at the end, so a stale order can never drop a column. */
export function applyOrder(teams, orderedIds) {
    const byId = new Map(teams.map(t => [t.id, t]));
    const out = [];
    orderedIds.forEach(id => {
        const team = byId.get(id);
        if (team) {
            out.push(team);
            byId.delete(id);
        }
    });
    byId.forEach(team => out.push(team));
    return out;
}

/** Message copy for a completed re-order, so the board says what it just did. */
export function reorderMessage(axisId, direction, moved) {
    if (axisId === ORDER_AXIS.FIXED) {
        return 'Columns returned to setup order.';
    }
    const wording = directionSentence(axisId, direction);
    if (moved === 0) return `Already ordered by ${wording}.`;
    return `Re-ordered by ${wording} — ${moved} column${moved === 1 ? '' : 's'} moved. `
        + 'The ones that moved are ringed for a moment.';
}
