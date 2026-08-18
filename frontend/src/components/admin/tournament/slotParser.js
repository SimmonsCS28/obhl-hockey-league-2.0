import * as XLSX from 'xlsx';

/**
 * Parses an ice-slot sheet into schedule slots, in the browser.
 *
 * Same reasoning as the entrant import: the gateway's proxies read bodies as String so multipart
 * cannot reach a service through them, and parsing here lets the organiser see what was understood
 * before a weekend's ice is committed to it.
 *
 * game-service does have a server-side /games/upload-slots endpoint, but it is only reachable by
 * posting a file directly to port 8002 — which is exactly the exposure the tournament work has been
 * keeping off. Reading the file here avoids needing it at all.
 */

const ALIASES = {
    date: ['date', 'day', 'game date'],
    time: ['time', 'start', 'start time', 'game time'],
    rink: ['rink', 'sheet', 'surface', 'location'],
    day: ['day index', 'dayindex', 'week'],
};

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Excel stores dates and times as serial numbers; the sheet may also carry plain strings. */
function toDate(v) {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        if (!d) return null;
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const s = String(v ?? '').trim();
    if (!s) return null;
    const parsed = new Date(s);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function toTime(v) {
    if (v instanceof Date) return v.toTimeString().slice(0, 8);
    if (typeof v === 'number') {
        // Fractional day: 0.5 = midday.
        const total = Math.round(v * 24 * 60);
        const h = Math.floor(total / 60) % 24;
        const m = total % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }
    const s = String(v ?? '').trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
    if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m[2]}:00`;
}

export function parseSlotWorkbook(buffer) {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { slots: [], warnings: ['That file has no sheets.'] };

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
    if (rows.length < 2) return { slots: [], warnings: ['That sheet has no data rows.'] };

    const headers = rows[0].map(h => String(h ?? '').trim());
    const map = {};
    headers.forEach((raw, i) => {
        const h = norm(raw);
        for (const [field, aliases] of Object.entries(ALIASES)) {
            if (map[field] === undefined && aliases.includes(h)) map[field] = i;
        }
    });

    if (map.date === undefined || map.time === undefined) {
        return {
            slots: [],
            warnings: ['Could not find Date and Time columns. Expected headers like '
                + '"Date", "Time" and "Rink".'],
        };
    }

    const warnings = [];
    const slots = [];
    const days = new Map();

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const date = toDate(row[map.date]);
        const time = toTime(row[map.time]);
        if (!date || !time) continue;

        // Day index groups the weekend: first distinct date is day 1, second day 2.
        if (!days.has(date)) days.set(date, days.size + 1);

        slots.push({
            week: map.day !== undefined && row[map.day] ? Number(row[map.day]) : days.get(date),
            date,
            time,
            rink: String(row[map.rink] ?? '').trim() || 'TBD',
        });
    }

    slots.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    if (!slots.length) warnings.push('No rows had a readable date and time.');
    if (map.rink === undefined) warnings.push('No Rink column found — every slot is marked TBD.');
    if (days.size > 0) warnings.push(`${slots.length} slot(s) across ${days.size} day(s).`);

    return { slots, warnings };
}
