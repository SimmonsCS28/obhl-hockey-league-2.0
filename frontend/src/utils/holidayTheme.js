// Holiday themes for the public site. The calendar lives here (the gateway only stores the admin's
// master switch and overrides), so the public layout and the admin panel agree on what is "on".
//
// Dates are plain 'YYYY-MM-DD' strings in Central, so comparing them as strings is comparing dates.
// A holiday's "occurrence year" is the year its window starts in: New Year's Eve 2026 runs
// 2026-12-31 → 2027-01-01 and is the 2026 occurrence.

import { gameDateKey } from './gameTime';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const wholeMonth = (m) => (y) => ({ start: ymd(y, m, 1), end: ymd(y, m, lastDayOfMonth(y, m)) });

/** Easter Sunday for a Gregorian year (Anonymous Gregorian / Meeus-Jones-Butcher). */
export function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return ymd(year, month, day);
}

// Month themes turn on the 1st of the holiday's month. Easter and New Year's Eve are day-of,
// because a whole month would collide with St. Patrick's and Christmas.
export const HOLIDAYS = [
    { key: 'valentines', name: "Valentine's Day", window: wholeMonth(2) },
    { key: 'stpatricks', name: "St. Patrick's Day", window: wholeMonth(3) },
    { key: 'easter', name: 'Easter', window: (y) => ({ start: easterSunday(y), end: easterSunday(y) }) },
    { key: 'july4', name: '4th of July', window: wholeMonth(7) },
    { key: 'halloween', name: 'Halloween', window: wholeMonth(10) },
    { key: 'thanksgiving', name: 'Thanksgiving', window: wholeMonth(11) },
    { key: 'christmas', name: 'Christmas', window: (y) => ({ start: ymd(y, 12, 1), end: ymd(y, 12, 30) }) },
    { key: 'nye', name: "New Year's Eve", window: (y) => ({ start: ymd(y, 12, 31), end: ymd(y + 1, 1, 1) }) },
];

const BY_KEY = Object.fromEntries(HOLIDAYS.map(h => [h.key, h]));

export const isHolidayKey = (key) => Object.hasOwn(BY_KEY, key);

/** Today's date in Central as 'YYYY-MM-DD'. */
export const todayKey = () => gameDateKey(new Date());

export function getDefaultWindow(key, year) {
    return BY_KEY[key].window(year);
}

/** The window for one occurrence: the admin's dates if they set them for that year, else the default. */
export function getWindow(key, year, overrides = {}) {
    const o = overrides[key];
    if (o && o.year === year && o.start && o.end) return { start: o.start, end: o.end, custom: true };
    return { ...getDefaultWindow(key, year), custom: false };
}

export const isEnabled = (key, overrides = {}) => overrides[key]?.enabled !== false;

/**
 * The occurrence the admin panel should show: the current one if it's running, otherwise the
 * next one. Checks last year too, so New Year's Day still shows the NYE that started Dec 31.
 */
export function getUpcomingOccurrence(key, overrides = {}, today = todayKey()) {
    const year = Number(today.slice(0, 4));
    // An edit for this year stays on screen even after it ends (an admin who cut Halloween short
    // should still see the dates they chose), until the calendar year rolls over.
    const o = overrides[key];
    if (o?.year && o.start && o.end && (o.end >= today || o.year >= year)) {
        return { year: o.year, ...getWindow(key, o.year, overrides) };
    }
    for (const y of [year - 1, year, year + 1]) {
        const w = getWindow(key, y, overrides);
        if (w.end >= today) return { year: y, ...w };
    }
    return { year: year + 1, ...getWindow(key, year + 1, overrides) };
}

/**
 * Which theme is on today, or null. When windows overlap (Easter Sunday in March, NYE vs a
 * stretched Christmas) the later-starting one wins, since it's the more specific occasion.
 */
export function resolveActiveTheme({ mode = 'auto', overrides = {} } = {}, today = todayKey()) {
    if (mode === 'off') return null;
    const year = Number(today.slice(0, 4));
    let best = null;
    for (const h of HOLIDAYS) {
        if (!isEnabled(h.key, overrides)) continue;
        for (const y of [year - 1, year]) {
            const w = getWindow(h.key, y, overrides);
            if (w.start <= today && today <= w.end && (!best || w.start > best.start)) {
                best = { key: h.key, start: w.start };
            }
        }
    }
    return best?.key ?? null;
}

/** `?theme=halloween` forces a theme and `?theme=none` forces none (previews); otherwise undefined. */
export function getThemeFromUrl(search = window.location.search) {
    const t = new URLSearchParams(search).get('theme');
    if (t === 'none') return null;
    return t && isHolidayKey(t) ? t : undefined;
}
