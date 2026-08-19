// Shared visual treatment for goalie-slot statuses introduced by the auto-proposer, plus
// a helper to tally a week's goalie assignments into the counts the proposer bar shows.
// Used by both the Coordinator Console (card/list) and Admin → Assignments (table).

// Slot status pill styles. Existing OPEN / SIGNED_UP / PROPOSED / CONFIRMED live in the
// Coordinator board; these are the two the auto-proposer adds.
export const GOALIE_STATUS_STYLE = {
    // Auto-proposer filled it, email not yet sent (design "Proposed", amber).
    AUTO_PROPOSED: {
        label: 'Proposed',
        color: 'var(--obi-accent)',
        bg: 'rgba(246,169,28,0.14)',
        border: 'rgba(246,169,28,0.4)',
    },
    // Goalie declined the emailed confirmation (design "Declined", red).
    DECLINED: {
        label: 'Declined',
        color: 'var(--obi-error)',
        bg: 'rgba(224,138,138,0.14)',
        border: 'rgba(224,138,138,0.32)',
    },
};

// Status-colored <select> treatment for the Admin table (background + border reflect status).
export const GOALIE_SELECT_STYLE = {
    // "Awaiting Player" — coordinator emailed, goalie hasn't confirmed.
    PENDING: { background: 'rgba(246,169,28,0.16)', border: '1px solid rgba(246,169,28,0.55)' },
    CONFIRMED: { background: 'rgba(127,181,154,0.16)', border: '1px solid rgba(127,181,154,0.5)' },
    DECLINED: { background: 'rgba(224,138,138,0.16)', border: '1px solid rgba(224,138,138,0.5)' },
    // No status yet (unassigned) — existing "needs attention" amber-tinted border on dark.
    UNASSIGNED: { background: '#0e1116', border: '1px solid rgba(246,169,28,0.4)' },
};

/**
 * Tally a list of AssignmentView rows (already scoped to one week) into proposer counts.
 * `totalSlots` = games in the week × 2. A DECLINED slot frees the slot, so it counts as open.
 */
export function goalieCounts(assignments, totalSlots) {
    const by = { AUTO_PROPOSED: 0, PROPOSED: 0, CONFIRMED: 0, DECLINED: 0, SIGNED_UP: 0 };
    for (const a of assignments) {
        if (by[a.status] != null) by[a.status] += 1;
    }
    // Rows that hold a slot: everything except DECLINED (which reopens the slot).
    const held = assignments.length - by.DECLINED;
    return {
        proposed: by.AUTO_PROPOSED,
        pending: by.PROPOSED,
        confirmed: by.CONFIRMED,
        declined: by.DECLINED,
        open: Math.max(0, totalSlots - held),
    };
}

/**
 * Confirmed slots split by whether they are already live. `toNotify` is the only number a publish
 * control may show: it is exactly the set the server will write and email, because
 * CoordinatorService.publish skips any row already flagged published. Counting plain `confirmed`
 * instead is what made the proposer bar advertise nine sends when three were pending.
 *
 * Role-agnostic — the week header uses it for refs and scorekeepers too.
 */
export function publishTally(assignments) {
    const confirmed = assignments.filter(a => a.status === 'CONFIRMED');
    const live = confirmed.filter(a => a.published === true).length;
    return { confirmed: confirmed.length, live, toNotify: confirmed.length - live };
}
