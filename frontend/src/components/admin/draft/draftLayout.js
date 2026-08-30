/**
 * Board layout maths: density, card size, and the Rows/Grid split.
 *
 * The single most important rule here, and the reason the old zoom slider is gone:
 * NOTHING in this file produces a CSS transform. Card size is a real width and type
 * multiplier. A `transform: scale()` wrapper makes getBoundingClientRect() report
 * transformed pixels while scrollLeft stays untransformed, which is what made
 * scroll-to-match arithmetic unreliable in the first place.
 */

export const DENSITY = { DETAILED: 'detailed', BALANCED: 'balanced', OVERVIEW: 'overview' };
export const CARD_SIZE = { S: 's', M: 'm', L: 'l' };
export const LAYOUT = { ROWS: 'rows', GRID: 'grid' };
export const GRID_ROSTERS = { FULL: 'full', EVEN: 'even' };

/** Column gap, in px. Shared by the CSS and by the Rows scroll arithmetic. */
export const COLUMN_GAP = 8;

/** Each density is a fixed base column width, so "can I see all 14?" has one answer per step. */
const BASE_COLUMN_WIDTH = {
    [DENSITY.DETAILED]: 256,
    [DENSITY.BALANCED]: 168,
    [DENSITY.OVERVIEW]: 92
};

const SIZE_MULTIPLIER = {
    [CARD_SIZE.S]: 0.88,
    [CARD_SIZE.M]: 1,
    [CARD_SIZE.L]: 1.34
};

export const DENSITY_STEPS = [
    { id: DENSITY.DETAILED, label: 'Detailed', title: 'Full names and editable fields on the selected card' },
    { id: DENSITY.BALANCED, label: 'Balanced', title: 'Initial, surname, badges and rating - the working default' },
    { id: DENSITY.OVERVIEW, label: 'Overview', title: 'Initials and rating only - all 14 teams at once' }
];

export const CARD_SIZE_STEPS = [
    { id: CARD_SIZE.S, label: 'S', title: 'Smaller cards, more columns' },
    { id: CARD_SIZE.M, label: 'M', title: 'Default card size' },
    { id: CARD_SIZE.L, label: 'L', title: 'Larger cards, easier to read across the room' }
];

export const sizeMultiplier = (cardSize) => SIZE_MULTIPLIER[cardSize] ?? 1;

/** Actual column width in px. Used directly in Rows, and for the Rows scroll step. */
export function columnWidth(density, cardSize) {
    const base = BASE_COLUMN_WIDTH[density] ?? BASE_COLUMN_WIDTH[DENSITY.BALANCED];
    return Math.round(base * sizeMultiplier(cardSize));
}

/**
 * The width to actually put on a column.
 *
 * In Grid this is a CSS percentage, never a measured value. Deriving it from a measured
 * container makes column width depend on a width that depends on column width; that cycle
 * hung the design prototype and left the board stuck at 4 across. The trailing 14px is a
 * vertical-scrollbar allowance: the percentage resolves against the padding box, which
 * still includes the scrollbar the grid always shows, so without it the last column
 * overflows by ~9px and silently wraps.
 *
 * Detailed opts out and keeps its px width - its inline editors need real width more than
 * the row needs one more column.
 */
export function columnWidthCss(density, cardSize, layout, perRow) {
    if (layout !== LAYOUT.GRID || density === DENSITY.DETAILED) {
        return `${columnWidth(density, cardSize)}px`;
    }
    const gaps = (perRow - 1) * COLUMN_GAP + 14;
    return `calc((100% - ${gaps}px) / ${perRow})`;
}

/**
 * Geometry for the board container and the roster wells.
 *
 * Rows scrolls horizontally with full-height columns. Grid wraps and scrolls vertically;
 * its roster cap is density-aware because a fixed cap that shows 7 Balanced cards shows
 * only 2 Detailed ones.
 */
export function boardGeometry({ density, cardSize, layout, gridRosters }) {
    const isGrid = layout === LAYOUT.GRID;
    const isDetailed = density === DENSITY.DETAILED;
    const z = sizeMultiplier(cardSize);
    const full = gridRosters === GRID_ROSTERS.FULL;

    return {
        isGrid,
        overflowX: isGrid ? 'hidden' : 'auto',
        overflowY: isGrid ? 'auto' : 'hidden',
        flexWrap: isGrid ? 'wrap' : 'nowrap',
        alignItems: isGrid ? 'flex-start' : 'stretch',
        columnHeight: isGrid ? 'auto' : '100%',
        columnMaxHeight: isGrid
            ? (full ? 'none' : `${Math.round((isDetailed ? 700 : 430) * z)}px`)
            : '100%',
        rosterMinHeight: isGrid ? `${Math.round((isDetailed ? 300 : 120) * z)}px` : '0',
        rosterMaxHeight: isGrid
            ? (full ? 'none' : `${Math.round((isDetailed ? 520 : 300) * z)}px`)
            : 'none'
    };
}

/** Card typography and padding, scaled with card size. */
export function cardMetrics(density, cardSize) {
    const z = sizeMultiplier(cardSize);
    const isOverview = density === DENSITY.OVERVIEW;
    const isDetailed = density === DENSITY.DETAILED;
    const round1 = (n) => Math.round(n * 10) / 10;

    return {
        padding: isOverview ? '5px 7px' : isDetailed ? '8px 9px' : '7px 8px',
        nameSize: `${round1((isOverview ? 12 : 13.5) * z)}px`,
        skillSize: `${round1((isOverview ? 12 : 13) * z)}px`,
        poolNameSize: `${round1(14 * z)}px`
    };
}

/**
 * How many badges a card can show before they start crowding out the name.
 *
 * In px deliberately, never `ch`: a font-relative floor shrinks with the card size and so
 * evaporates exactly at size S, the step that needs it most. Below 160px nothing but dots
 * fits, and the name has to win.
 */
export function badgeCap(density, colW) {
    if (density === DENSITY.DETAILED) return 4;
    if (colW >= 180) return 2;
    if (colW >= 160) return 1;
    return 0;
}

export const dotCap = (density) => (density === DENSITY.OVERVIEW ? 1 : 2);

/**
 * Relative luminance, used to decide whether a jersey colour needs dark or light text.
 * The 12 team colours are real jersey colours and cannot be remapped, so the discipline
 * has to come from how they are rendered.
 */
export function luminance(hex) {
    const s = String(hex || '').replace('#', '');
    if (s.length < 6) return 0;
    const channels = [0, 2, 4]
        .map(i => parseInt(s.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Everything a jersey-coloured header needs to stay legible on any of the 12 colours. */
export function jerseyHeader(hex) {
    const light = luminance(hex) > 0.34;
    return {
        light,
        foreground: light ? '#0b0c0f' : '#ffffff',
        nameShadow: light ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
        ring: `${light ? 'inset 0 0 0 1px rgba(0,0,0,0.4)' : 'inset 0 0 0 1px rgba(255,255,255,0.26)'}, inset 0 -1px 0 0 rgba(0,0,0,0.35)`
    };
}

/**
 * Writes a scroll position synchronously, clamped to the scrollable range.
 *
 * Never animated, and that is a decision rather than laziness: rAF callbacks AND timers are
 * throttled when the tab is occluded, backgrounded, or on an inactive monitor, so an eased
 * scroll can strand the board with the match off-screen and no completion guarantee. If
 * easing is ever wanted, write the destination first and treat the animation as decoration
 * gated on document.visibilityState.
 */
export function scrollAxisTo(el, axis, to) {
    if (!el) return;
    const max = axis === 'scrollLeft'
        ? el.scrollWidth - el.clientWidth
        : el.scrollHeight - el.clientHeight;
    el[axis] = Math.max(0, Math.min(Math.max(0, max), to));
}
