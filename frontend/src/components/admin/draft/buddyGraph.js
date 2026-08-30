/**
 * Buddy-pick resolution, extracted from DraftDashboard as pure functions.
 *
 * Buddy picks are collected on the registration form as FREE TEXT — a comma-separated
 * list of names typed by a player, e.g. "Dave Jones, Sam Bell". There is no id, so the
 * only way to turn that into a real person is a case-insensitive "first last" lookup
 * across everyone who registered. Names that don't match anyone are silently dropped,
 * which is a real source of quiet disappointment on draft night and the reason the UI
 * should eventually surface unmatched picks.
 *
 * NOTE ON SEMANTICS: the tool currently applies two DIFFERENT rules depending on how a
 * player is being placed — one level (direct + reverse) when dragging, full transitive
 * closure in the GM-buddy wizard. Both are preserved here verbatim so this extraction is
 * behavior-neutral. Unifying them onto transitive closure is a deliberate, separate change.
 */

/**
 * Flattens the pool and every team roster into one list. Buddy resolution has to see
 * players who are already drafted, otherwise a pick pointing at someone on a team
 * resolves to nothing.
 */
export function collectAllPlayers(players, teamsData = null) {
    const allPlayers = [...players];
    if (teamsData) {
        teamsData.forEach(team => {
            if (team.players) {
                allPlayers.push(...team.players);
            }
        });
    }
    return allPlayers;
}

/**
 * Builds the email -> [buddy emails] map by resolving free-text names.
 * Players whose picks all fail to resolve are omitted entirely.
 */
export function buildBuddyPickMap(players, teamsData = null) {
    const allPlayers = collectAllPlayers(players, teamsData);

    // name -> email, case-insensitive. Later duplicates win, matching prior behavior.
    const nameToEmail = {};
    allPlayers.forEach(player => {
        const fullName = `${player.firstName} ${player.lastName}`.toLowerCase().trim();
        nameToEmail[fullName] = player.email;
    });

    const buddyMap = {};
    allPlayers.forEach(player => {
        if (player.buddyPick && player.buddyPick.trim() !== '') {
            const buddyNames = player.buddyPick.split(',').map(name => name.trim().toLowerCase());
            const buddyEmails = buddyNames
                .map(name => nameToEmail[name])
                .filter(email => email !== undefined); // Remove unmatched names

            if (buddyEmails.length > 0) {
                buddyMap[player.email] = buddyEmails;
            }
        }
    });

    return buddyMap;
}

/**
 * One level only: who this player picked, plus who picked this player.
 *
 * The reverse direction is deliberate — a one-sided request still prompts. Note this is
 * looser than the league's written rule, which honours only mutual pairs.
 */
export function directAndReverseBuddyEmails(buddyPickMap, email) {
    const buddyEmails = buddyPickMap[email] || [];
    const reverseBuddyEmails = [];
    Object.entries(buddyPickMap).forEach(([otherEmail, picks]) => {
        if (picks.includes(email) && !buddyEmails.includes(otherEmail)) {
            reverseBuddyEmails.push(otherEmail);
        }
    });
    return [...buddyEmails, ...reverseBuddyEmails];
}

/**
 * Full transitive closure: follows buddy-of-a-buddy chains outward from the starting
 * player, excluding the starting player. Used by the GM-buddy wizard, where a GM can pull
 * an entire connected cluster onto their team.
 */
export function transitiveBuddyEmails(buddyPickMap, email) {
    const allBuddyEmails = new Set();
    const searchQueue = [...(buddyPickMap[email] || [])];
    const visited = new Set([email]);

    while (searchQueue.length > 0) {
        const currentEmail = searchQueue.shift();
        if (visited.has(currentEmail)) continue;
        visited.add(currentEmail);
        allBuddyEmails.add(currentEmail);
        (buddyPickMap[currentEmail] || []).forEach(b => {
            if (!visited.has(b)) searchQueue.push(b);
        });
    }

    return Array.from(allBuddyEmails);
}

/**
 * True when two players picked each other — surfaced in the buddy modal, because a
 * mutual request carries more weight than a one-sided one.
 */
export function isReciprocal(buddyPickMap, emailA, emailB) {
    const aPicks = buddyPickMap[emailA] || [];
    const bPicks = buddyPickMap[emailB] || [];
    return aPicks.includes(emailB) && bPicks.includes(emailA);
}
