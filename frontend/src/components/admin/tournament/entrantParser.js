import * as XLSX from 'xlsx';

/**
 * Parses a sign-up spreadsheet into entrant records, in the browser.
 *
 * Client-side deliberately. The gateway's proxy controllers read request bodies as String, which
 * breaks multipart, so a file upload cannot reach league-service through it. Parsing here also
 * means the operator sees exactly what was understood — and can fix a bad column header — before
 * anything is written.
 *
 * Header matching is forgiving because these sheets are made by hand each year and the column
 * names drift ("Email" / "E-mail" / "Email Address").
 */

const FIELD_ALIASES = {
    firstName: ['first name', 'firstname', 'first', 'given name'],
    lastName: ['last name', 'lastname', 'last', 'surname', 'family name'],
    email: ['email', 'e-mail', 'email address', 'e-mail address'],
    phone: ['phone', 'phone number', 'mobile', 'cell', 'cell phone'],
    position: ['position', 'pos', 'preferred position'],
    jerseyNumber: ['jersey', 'jersey number', 'number', '#', 'sweater'],
    skillRating: ['skill', 'skill rating', 'rating', 'tier'],
    isGm: ['gm', 'is gm', 'captain', 'is captain', 'team gm'],
    paid: ['paid', 'has paid', 'payment', 'paid?'],
    notes: ['notes', 'note', 'comments', 'comment'],
};

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** "Yes"/"Y"/"TRUE"/"1"/"x" all mean true; blank means false. */
function toBool(v) {
    if (typeof v === 'boolean') return v;
    const s = norm(v);
    return ['y', 'yes', 'true', '1', 'x', '✓'].includes(s);
}

function toInt(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
    return Number.isNaN(n) ? null : n;
}

/** F/D/G from anything recognisable; unknown becomes null so it defaults to forward at commit. */
function toPosition(v) {
    const s = norm(v);
    if (!s) return null;
    if (s.startsWith('g')) return 'G';
    if (s.startsWith('d')) return 'D';
    if (s.startsWith('f') || s.startsWith('c') || s.startsWith('w')) return 'F';
    return null;
}

/** Maps sheet headers onto our field names, returning {field: columnIndex}. */
function mapHeaders(headerRow) {
    const map = {};
    headerRow.forEach((raw, i) => {
        const h = norm(raw);
        if (!h) return;
        for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
            if (map[field] === undefined && aliases.includes(h)) {
                map[field] = i;
                return;
            }
        }
    });
    return map;
}

/**
 * @param {ArrayBuffer} buffer the uploaded file's contents
 * @returns {{entrants: Array, warnings: string[], headers: string[], matched: object}}
 */
export function parseEntrantWorkbook(buffer) {
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { entrants: [], warnings: ['That file has no sheets.'], headers: [], matched: {} };

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
    if (rows.length < 2) {
        return { entrants: [], warnings: ['That sheet has no data rows.'], headers: [], matched: {} };
    }

    const headers = rows[0].map(h => String(h ?? '').trim());
    const map = mapHeaders(headers);
    const warnings = [];

    if (map.firstName === undefined || map.lastName === undefined) {
        // A single combined "Name" column is common enough to be worth handling rather than
        // failing: split on the last space so "Jean Luc Picard" keeps the surname intact.
        const nameCol = headers.findIndex(h => ['name', 'player', 'player name', 'full name'].includes(norm(h)));
        if (nameCol === -1) {
            return {
                entrants: [],
                headers,
                matched: map,
                warnings: ['Could not find first/last name columns. Expected "First Name" and '
                    + '"Last Name", or a single "Name" column.'],
            };
        }
        map.__combinedName = nameCol;
        warnings.push('Using a single "Name" column, split on the last space.');
    }

    const entrants = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        let firstName, lastName;

        if (map.__combinedName !== undefined) {
            const whole = String(row[map.__combinedName] ?? '').trim();
            if (!whole) continue;
            const idx = whole.lastIndexOf(' ');
            firstName = idx === -1 ? whole : whole.slice(0, idx);
            lastName = idx === -1 ? '' : whole.slice(idx + 1);
        } else {
            firstName = String(row[map.firstName] ?? '').trim();
            lastName = String(row[map.lastName] ?? '').trim();
        }

        if (!firstName || !lastName) continue;

        const get = (f) => (map[f] === undefined ? '' : row[map[f]]);

        entrants.push({
            firstName,
            lastName,
            email: String(get('email') ?? '').trim().toLowerCase() || null,
            phone: String(get('phone') ?? '').trim() || null,
            position: toPosition(get('position')),
            jerseyNumber: toInt(get('jerseyNumber')),
            skillRating: toInt(get('skillRating')),
            isGm: toBool(get('isGm')),
            paid: toBool(get('paid')),
            notes: String(get('notes') ?? '').trim() || null,
        });
    }

    // Duplicate emails within the sheet itself would be rejected one-by-one by the database's
    // case-insensitive index; saying so up front is more useful than a row-level failure.
    const seen = new Map();
    for (const e of entrants) {
        if (!e.email) continue;
        seen.set(e.email, (seen.get(e.email) || 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([email]) => email);
    if (dupes.length) {
        warnings.push(`Duplicate email(s) in the sheet: ${dupes.join(', ')}. Only the last of each will be kept.`);
    }

    const missingEmail = entrants.filter(e => !e.email).length;
    if (missingEmail) {
        warnings.push(`${missingEmail} entrant(s) have no email — they can still be drafted.`);
    }

    const gms = entrants.filter(e => e.isGm).length;
    if (gms === 0) warnings.push('No entrants are flagged as GMs. Add a "GM" column, or set the flag after importing.');

    const goalies = entrants.filter(e => e.position === 'G').length;
    if (goalies) {
        warnings.push(`${goalies} goalie(s) found. Goalies are assigned through staffing rather than drafted, `
            + 'so they will not appear in the pool.');
    }

    return { entrants, warnings, headers, matched: map };
}
