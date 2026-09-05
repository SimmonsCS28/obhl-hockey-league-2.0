import { CARD_SIZE, DENSITY, GRID_ROSTERS, LAYOUT } from './draftLayout';
import { DIRECTION, ORDER_AXES, ORDER_AXIS, axisById, defaultDirections } from './draftOrder';

/**
 * How the operator likes to look at the board, remembered between sessions.
 *
 * These are preferences about eyes and screen, not facts about a draft, which is why they
 * live here rather than in the saved draft blob: density is just as right for the next
 * draft as for this one, and putting them in the document would make changing density mark
 * the board dirty and trigger a save.
 *
 * They are also deliberately NOT part of the undo stack. Undoing a roster move must never
 * move the operator's view out from under them - that separation is the point of the
 * document/session split in draftReducer. Persisted and undoable are different questions,
 * and this file answers only the first.
 */

const KEY = 'obi-draft-view-prefs';

export const DEFAULT_VIEW = {
    density: DENSITY.BALANCED,
    cardSize: CARD_SIZE.M,
    layout: LAYOUT.ROWS,
    perRow: 5,
    gridRosters: GRID_ROSTERS.FULL,
    poolOpen: true,
    poolFilter: 'All',
    poolSort: 'Name',
    sortAsc: true,
    orderAxis: ORDER_AXIS.SKILL,
    // Per axis, so switching back to one you used earlier restores how you had it.
    orderDirections: defaultDirections(),
    autoReorder: true
};

const POOL_FILTERS = ['All', 'Forwards', 'Defense', 'Refs', 'GMs', 'Has Buddy'];
const POOL_SORTS = ['Name', 'Position', 'Skill', 'Veteran'];

/**
 * Every field is validated individually and falls back on its own. Stored preferences
 * outlive the code that wrote them: a value dropped in a later version, or a hand-edited
 * entry, must not be able to render the board in a state the controls cannot express.
 */
function coerce(stored) {
    const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
    const perRow = Number(stored.perRow);

    const orderAxis = oneOf(stored.orderAxis, ORDER_AXES.map(a => a.id), DEFAULT_VIEW.orderAxis);
    const storedDirections = (stored.orderDirections && typeof stored.orderDirections === 'object')
        ? stored.orderDirections
        : {};
    const directions = ORDER_AXES.reduce((acc, a) => ({
        ...acc,
        [a.id]: oneOf(storedDirections[a.id], Object.values(DIRECTION), axisById(a.id).defaultDirection)
    }), {});

    return {
        density: oneOf(stored.density, Object.values(DENSITY), DEFAULT_VIEW.density),
        cardSize: oneOf(stored.cardSize, Object.values(CARD_SIZE), DEFAULT_VIEW.cardSize),
        layout: oneOf(stored.layout, Object.values(LAYOUT), DEFAULT_VIEW.layout),
        perRow: Number.isFinite(perRow) ? Math.min(7, Math.max(3, Math.round(perRow))) : DEFAULT_VIEW.perRow,
        gridRosters: oneOf(stored.gridRosters, Object.values(GRID_ROSTERS), DEFAULT_VIEW.gridRosters),
        poolOpen: typeof stored.poolOpen === 'boolean' ? stored.poolOpen : DEFAULT_VIEW.poolOpen,
        poolFilter: oneOf(stored.poolFilter, POOL_FILTERS, DEFAULT_VIEW.poolFilter),
        poolSort: oneOf(stored.poolSort, POOL_SORTS, DEFAULT_VIEW.poolSort),
        sortAsc: typeof stored.sortAsc === 'boolean' ? stored.sortAsc : DEFAULT_VIEW.sortAsc,
        orderAxis,
        orderDirections: directions,
        // Auto only survives a reload on the skill axis. On the others it moves columns
        // for reasons the operator did not ask for mid-pick, so it starts off again -
        // "the columns shouldn't surprise you" outranks remembering the toggle.
        autoReorder: orderAxis === ORDER_AXIS.SKILL
            ? (typeof stored.autoReorder === 'boolean' ? stored.autoReorder : true)
            : false
    };
}

export function loadViewPrefs() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...DEFAULT_VIEW };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_VIEW };
        return coerce(parsed);
    } catch {
        // Unparseable, or storage blocked in a private window. Defaults still work.
        return { ...DEFAULT_VIEW };
    }
}

export function saveViewPrefs(view) {
    try {
        localStorage.setItem(KEY, JSON.stringify(view));
    } catch {
        // Storage full or blocked: the board still works, it just forgets next time.
    }
}
