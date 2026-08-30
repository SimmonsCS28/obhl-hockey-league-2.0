import { useCallback, useMemo, useRef, useState } from 'react';
import { COLUMN_GAP, LAYOUT, columnWidth, scrollAxisTo } from './draftLayout';

/**
 * Board-wide find.
 *
 * One box doing two honest jobs: it narrows the pool rail (a filter) and it lists players
 * already on a team as jump-to results (find-and-reveal). Those are different verbs, which
 * is why the results are grouped rather than merged, and why the pool rail says out loud
 * that it is being filtered.
 *
 * The matching is trivial. Getting the board to actually GO there is the work, because the
 * board has two nested scroll containers and which one carries the journey depends on the
 * layout: Rows scrolls the board horizontally, Grid scrolls it vertically, and in both
 * cases the team's own roster well then scrolls vertically to the card.
 */

/** first name, last name, full "first last", and email - all case-insensitive substrings. */
export function matchesQuery(player, query) {
    if (!query) return false;
    const first = (player.firstName || '').toLowerCase();
    const last = (player.lastName || '').toLowerCase();
    const email = (player.email || '').toLowerCase();
    return first.includes(query)
        || last.includes(query)
        || `${first} ${last}`.includes(query)
        || email.includes(query);
}

export function findMatches(playerPool, teams, rawQuery) {
    const query = (rawQuery || '').trim().toLowerCase();
    if (!query) return [];

    const out = [];
    playerPool.forEach(p => {
        if (matchesQuery(p, query)) out.push({ player: p, teamId: null, teamIndex: -1, team: null });
    });
    teams.forEach((team, teamIndex) => {
        (team.players || []).forEach(p => {
            if (matchesQuery(p, query)) out.push({ player: p, teamId: team.id, teamIndex, team });
        });
    });
    return out;
}

export function useBoardSearch({ playerPool, teams, density, cardSize, layout }) {
    const [query, setQuery] = useState('');
    const [matchIndex, setMatchIndex] = useState(0);

    const boardRef = useRef(null);
    const columnRefs = useRef({});
    const rosterRefs = useRef({});
    const cardRefs = useRef({});
    // Where the board was before the first jump, plus the layout it was captured in.
    const savedScrollRef = useRef(null);

    const matches = useMemo(
        () => findMatches(playerPool, teams, query),
        [playerPool, teams, query]
    );

    /** email -> 2 for the current match, 1 for the others. Drives the card outline. */
    const matchMarks = useMemo(() => {
        const marks = {};
        matches.forEach((m, i) => { marks[m.player.email] = i === matchIndex ? 2 : 1; });
        return marks;
    }, [matches, matchIndex]);

    const registerBoard = useCallback((el) => { boardRef.current = el; }, []);
    const registerColumn = useCallback((teamId, el) => { columnRefs.current[teamId] = el; }, []);
    const registerRoster = useCallback((teamId, el) => { rosterRefs.current[teamId] = el; }, []);
    const registerCard = useCallback((email, el) => {
        if (el) cardRefs.current[email] = el;
        else delete cardRefs.current[email];
    }, []);

    /**
     * Scrolls the matched card into view on both axes.
     *
     * Offsets are measured from getBoundingClientRect deltas rather than offsetTop: the
     * roster well is not a positioned ancestor, so offsetTop is measured against the wrong
     * element and lands in the wrong place.
     */
    const revealMatch = useCallback((hit) => {
        const board = boardRef.current;
        if (!hit || !hit.teamId || !board) return;

        if (layout === LAYOUT.GRID) {
            const column = columnRefs.current[hit.teamId];
            if (column) {
                const cr = column.getBoundingClientRect();
                const br = board.getBoundingClientRect();
                scrollAxisTo(board, 'scrollTop', board.scrollTop + (cr.top - br.top) - 24);
            }
        } else {
            // Rows: step by real column width, then centre the column in the viewport.
            const step = columnWidth(density, cardSize) + COLUMN_GAP;
            const target = hit.teamIndex * step - Math.max(0, (board.clientWidth - step) / 2);
            scrollAxisTo(board, 'scrollLeft', target);
        }

        // Then the roster's own vertical scroll, after the column has been placed.
        const card = cardRefs.current[hit.player.email];
        const roster = rosterRefs.current[hit.teamId];
        if (card && roster) {
            const cr = card.getBoundingClientRect();
            const rr = roster.getBoundingClientRect();
            const target = roster.scrollTop + (cr.top - rr.top) - roster.clientHeight / 2 + cr.height / 2;
            scrollAxisTo(roster, 'scrollTop', target);
        }
    }, [layout, density, cardSize]);

    const jumpTo = useCallback((index) => {
        if (matches.length === 0) return;
        const next = ((index % matches.length) + matches.length) % matches.length;

        // Remember where we were, once, so Esc can put it back.
        if (savedScrollRef.current === null && boardRef.current) {
            savedScrollRef.current = {
                left: boardRef.current.scrollLeft,
                top: boardRef.current.scrollTop,
                layout
            };
        }

        setMatchIndex(next);
        // The DOM must reflect `next` before the card can be measured.
        requestAnimationFrame(() => revealMatch(matches[next]));
    }, [matches, layout, revealMatch]);

    const jumpToPlayer = useCallback((email) => {
        const index = matches.findIndex(m => m.player.email === email);
        if (index >= 0) jumpTo(index);
    }, [matches, jumpTo]);

    const next = useCallback(() => jumpTo(matchIndex + 1), [jumpTo, matchIndex]);
    const previous = useCallback(() => jumpTo(matchIndex - 1), [jumpTo, matchIndex]);

    /**
     * Clearing restores the scroll position the board had before the first jump - but only
     * if the layout has not changed since. Rows saves a horizontal offset and Grid a
     * vertical one, so restoring one into the other silently does nothing; in that case the
     * capture is dropped and the caller is told plainly rather than promised a restore that
     * did not happen.
     */
    const clear = useCallback(() => {
        const saved = savedScrollRef.current;
        const stale = !saved || saved.layout !== layout;

        setQuery('');
        setMatchIndex(0);
        savedScrollRef.current = null;

        if (saved && boardRef.current && !stale) {
            scrollAxisTo(boardRef.current, 'scrollLeft', saved.left);
            scrollAxisTo(boardRef.current, 'scrollTop', saved.top);
            return { restored: true };
        }
        return { restored: false };
    }, [layout]);

    const search = useCallback((value) => {
        setQuery(value);
        setMatchIndex(0);
        if (!value.trim()) savedScrollRef.current = null;
    }, []);

    /** Per-team match counts, for the `n ⌕` chip in the column header. */
    const teamMatchCounts = useMemo(() => {
        const counts = {};
        matches.forEach(m => {
            if (m.teamId != null) counts[m.teamId] = (counts[m.teamId] || 0) + 1;
        });
        return counts;
    }, [matches]);

    const poolHits = useMemo(() => matches.filter(m => m.teamId == null), [matches]);
    const teamHits = useMemo(() => matches.filter(m => m.teamId != null), [matches]);

    return {
        query,
        hasQuery: query.trim().length > 0,
        matches,
        matchIndex,
        matchMarks,
        teamMatchCounts,
        poolHits,
        teamHits,
        currentMatch: matches[matchIndex] || null,
        search,
        clear,
        next,
        previous,
        jumpTo,
        jumpToPlayer,
        registerBoard,
        registerColumn,
        registerRoster,
        registerCard,
        boardRef,
        columnRefs
    };
}
