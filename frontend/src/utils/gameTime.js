// Game times are stored as UTC (ISO, usually without the trailing 'Z') and the league plays in one
// place, so every game time on every screen renders in Central — never the browser's zone. A GM
// travelling for work must still see "8:00 PM", not whatever 8pm Central is where they happen to be.
// Backend emails already pin America/Chicago; this is the frontend's single equivalent.

export const LEAGUE_TZ = 'America/Chicago';

/** Parse a stored game date (UTC ISO with or without 'Z', or a Date) into a Date, or null. */
export function parseGameDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const s = String(value);
    // Anything that already carries an offset ('Z', '+05:00') is unambiguous; a bare ISO string
    // is UTC by our storage convention, so pin it rather than letting the browser read it as local.
    const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s);
    const d = new Date(hasOffset || !s.includes('T') ? s : s + 'Z');
    return Number.isNaN(d.getTime()) ? null : d;
}

/** toLocaleDateString in Central; `opts` are the usual Intl date options. */
export function fmtGameDate(value, opts = { month: 'short', day: 'numeric' }) {
    const d = parseGameDate(value);
    return d ? d.toLocaleDateString('en-US', { ...opts, timeZone: LEAGUE_TZ }) : '';
}

/** toLocaleTimeString in Central, e.g. "8:00 PM". */
export function fmtGameTime(value, opts = { hour: 'numeric', minute: '2-digit' }) {
    const d = parseGameDate(value);
    return d ? d.toLocaleTimeString('en-US', { ...opts, timeZone: LEAGUE_TZ }) : '';
}

/** toLocaleString in Central (date + time in one call). */
export function fmtGameDateTime(value, opts) {
    const d = parseGameDate(value);
    return d ? d.toLocaleString('en-US', { ...opts, timeZone: LEAGUE_TZ }) : '';
}

/** Central calendar date as YYYY-MM-DD — for grouping games by night. */
export function gameDateKey(value) {
    const d = parseGameDate(value);
    return d ? d.toLocaleDateString('en-CA', { timeZone: LEAGUE_TZ }) : '';
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Day of week (0 = Sunday) of the game's Central date — the replacement for Date#getDay(). */
export function gameDayIndex(value) {
    const d = parseGameDate(value);
    if (!d) return null;
    return WEEKDAY_INDEX[d.toLocaleDateString('en-US', { weekday: 'short', timeZone: LEAGUE_TZ })] ?? null;
}

// ---- Central wall clock <-> UTC, for date/time inputs ----

const PARTS_FMT = new Intl.DateTimeFormat('en-US', {
    timeZone: LEAGUE_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function centralParts(date) {
    const out = {};
    for (const { type, value } of PARTS_FMT.formatToParts(date)) {
        if (type !== 'literal') out[type] = Number(value);
    }
    // hourCycle h23 still yields "24" in some engines for midnight.
    if (out.hour === 24) out.hour = 0;
    return out;
}

/**
 * Split a stored game date into Central `date` (YYYY-MM-DD) and `time` (HH:mm) strings for
 * <input type="date"> / <input type="time"> / datetime-local (join with 'T').
 */
export function toCentralInputParts(value) {
    const d = parseGameDate(value);
    if (!d) return { date: '', time: '' };
    const p = centralParts(d);
    const pad = (n) => String(n).padStart(2, '0');
    return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/**
 * Interpret a Central wall-clock date + time (from the inputs above) as UTC ISO without the 'Z',
 * which is what the game-service expects. Handles DST by re-checking the offset once.
 */
export function fromCentralInputParts(date, time) {
    if (!date) return null;
    const [y, mo, d] = date.split('-').map(Number);
    const [h = 0, mi = 0] = (time || '00:00').split(':').map(Number);
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    let utc = wall;
    for (let i = 0; i < 2; i++) {
        const p = centralParts(new Date(utc));
        const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
        utc += wall - seen;
    }
    return new Date(utc).toISOString().slice(0, 19);
}
