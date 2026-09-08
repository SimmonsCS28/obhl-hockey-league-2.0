/**
 * Pure derivation helpers for the draft board, extracted from DraftDashboard.
 *
 * All of these ran on every render in the original component with no memoization. Pulling
 * them out unchanged makes them testable and lets the rebuilt component memoize them
 * without also changing what they compute.
 *
 * IMPORTANT: `position` is compared against the FULL WORDS 'Forward' and 'Defense', not
 * 'F'/'D'. That is the canonical value on the board and in the registration import; the
 * single-letter form only appears after finalize, where the backend normalizes it.
 */

export const POSITION_FORWARD = 'Forward';
export const POSITION_DEFENSE = 'Defense';

/**
 * Roster size, skill total, and the forward/defense split with per-group averages.
 * Averages are strings (toFixed(1)) for display; `total` and the counts are numbers.
 */
export function calculateTeamStats(players) {
    if (players.length === 0) {
        return { forwards: 0, defense: 0, avgF: 0, avgD: 0, total: 0, avg: 0 };
    }

    const forwards = players.filter(p => p.position === POSITION_FORWARD);
    const defense = players.filter(p => p.position === POSITION_DEFENSE);

    const avgF = forwards.length > 0
        ? (forwards.reduce((sum, p) => sum + (p.skillRating || 0), 0) / forwards.length).toFixed(1)
        : 0;
    const avgD = defense.length > 0
        ? (defense.reduce((sum, p) => sum + (p.skillRating || 0), 0) / defense.length).toFixed(1)
        : 0;
    const total = players.reduce((sum, p) => sum + (p.skillRating || 0), 0);
    const avg = (total / players.length).toFixed(1);

    return { forwards: forwards.length, defense: defense.length, avgF, avgD, total, avg };
}

/** Average skill of a roster. Used to order team columns on the board. */
export function averageSkill(players) {
    if (!players || players.length === 0) return 0;
    return players.reduce((sum, p) => sum + (p.skillRating || 0), 0) / players.length;
}

/**
 * Sorts a team roster. GMs are always pinned to the top regardless of the chosen sort —
 * the GM is the anchor of the column and the operator looks for them first.
 */
export function getSortedTeamPlayers(players, sortOption) {
    const sorted = [...players];

    const compareWithGMPriority = (a, b, normalCompare) => {
        if (a.isGm && !b.isGm) return -1;
        if (!a.isGm && b.isGm) return 1;
        return normalCompare(a, b);
    };

    switch (sortOption) {
        case 'Rating: High to Low':
            return sorted.sort((a, b) => compareWithGMPriority(a, b,
                (p1, p2) => (p2.skillRating || 0) - (p1.skillRating || 0)));
        case 'Rating: Low to High':
            return sorted.sort((a, b) => compareWithGMPriority(a, b,
                (p1, p2) => (p1.skillRating || 0) - (p2.skillRating || 0)));
        case 'Position':
            return sorted.sort((a, b) => compareWithGMPriority(a, b,
                (p1, p2) => p1.position.localeCompare(p2.position)));
        case 'Position + Rating':
            return sorted.sort((a, b) => compareWithGMPriority(a, b, (p1, p2) => {
                if (p1.position !== p2.position) return p1.position.localeCompare(p2.position);
                return (p2.skillRating || 0) - (p1.skillRating || 0);
            }));
        default:
            // Even with no recognized sort, GMs still come first.
            return sorted.sort((a, b) => {
                if (a.isGm && !b.isGm) return -1;
                if (!a.isGm && b.isGm) return 1;
                return 0;
            });
    }
}

/**
 * Search / filter / sort for the player pool.
 *
 * KNOWN GAP, preserved deliberately: the search matches firstName and lastName
 * SEPARATELY, so typing a full name like "John Smith" matches nobody. Email is not
 * searched either. Both are fixed as part of the global-search work, not here.
 */
export function getFilteredPlayers(playerPool, { searchQuery = '', filter = 'All', sortOption = 'Name', sortAsc = true } = {}) {
    let filtered = [...playerPool];

    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(p =>
            (p.firstName && p.firstName.toLowerCase().includes(query)) ||
            (p.lastName && p.lastName.toLowerCase().includes(query))
        );
    }

    switch (filter) {
        case 'Forwards':
            filtered = filtered.filter(p => p.position === POSITION_FORWARD);
            break;
        case 'Defense':
            filtered = filtered.filter(p => p.position === POSITION_DEFENSE);
            break;
        case 'Refs':
            filtered = filtered.filter(p => p.isRef);
            break;
        case 'GMs':
            filtered = filtered.filter(p => p.isGm);
            break;
        case 'Has Buddy':
            filtered = filtered.filter(p => p.buddyPick);
            break;
        default:
            break;
    }

    filtered.sort((a, b) => {
        let comparison = 0;
        switch (sortOption) {
            case 'Name':
                // Surname first, given name only as a tiebreaker. A roster is read out and
                // called by last name, so sorting on "first last" scatters the Smiths down
                // the list and makes a player hard to find by the name you know them by.
                comparison = (a.lastName || '').localeCompare(b.lastName || '')
                    || (a.firstName || '').localeCompare(b.firstName || '');
                break;
            case 'Position':
                comparison = a.position.localeCompare(b.position);
                break;
            case 'Skill':
                comparison = (a.skillRating || 0) - (b.skillRating || 0);
                break;
            case 'Veteran':
                comparison = (b.isVeteran ? 1 : 0) - (a.isVeteran ? 1 : 0);
                break;
            default:
                break;
        }
        return sortAsc ? comparison : -comparison;
    });

    return filtered;
}
