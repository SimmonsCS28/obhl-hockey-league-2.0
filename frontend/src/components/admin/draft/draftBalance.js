import { POSITION_DEFENSE, POSITION_FORWARD } from './draftSelectors';

/**
 * Team balance, on three axes that are never composited into one score.
 *
 * Roster size, skill average and the forward/defence split are independent: a team can be
 * fine on two and badly off on the third, and a single number would hide exactly the thing
 * the operator needs to see. Each axis reports its own deviation from the league mean, its
 * own colour band, and - when it is the worst axis on that team - a plain-language flag,
 * because "the bar looked about even" is not an argument you can make out loud to a GM.
 */

export const BAND = { OK: 'ok', WARN: 'warn', ERROR: 'error' };

/**
 * Expected defencemen is derived from the league's actual F/D mix, not a hardcoded number,
 * so a deliberately short team is not flagged merely for being small.
 */
export function boardMeans(teams) {
    const sizes = teams.map(t => t.players.length);
    const averages = teams.map(t =>
        t.players.length
            ? t.players.reduce((sum, p) => sum + (p.skillRating || 0), 0) / t.players.length
            : 0
    );
    const divisor = teams.length || 1;
    const everyone = teams.reduce((acc, t) => acc.concat(t.players), []);
    const defenceShare = everyone.length
        ? everyone.filter(p => p.position === POSITION_DEFENSE).length / everyone.length
        : 0.4;

    return {
        meanSize: sizes.reduce((a, b) => a + b, 0) / divisor,
        meanAverage: averages.reduce((a, b) => a + b, 0) / divisor,
        defenceShare
    };
}

const band = (value, warnAt, errorAt) => {
    const magnitude = Math.abs(value);
    if (magnitude >= errorAt) return BAND.ERROR;
    if (magnitude >= warnAt) return BAND.WARN;
    return BAND.OK;
};

/**
 * One axis: the digits, the signed delta, and the geometry of a deviation bar drawn from a
 * centre tick. `barWidth` is a percentage of half the track, capped at 50 so a wildly
 * lopsided team pins the bar rather than overflowing it.
 */
function makeStat(label, short, digits, delta, scale, warnAt, errorAt, deltaText) {
    const width = Math.min(50, Math.abs(delta) * scale);
    const colour = band(delta, warnAt, errorAt);
    return {
        label,
        short,
        digits,
        delta: deltaText,
        band: colour,
        barLeft: delta >= 0 ? 50 : 50 - width,
        barWidth: width
    };
}

/** Per-team stats plus the flag chip, if any axis is out of tolerance. */
export function teamBalance(team, means) {
    const players = team.players || [];
    const size = players.length;
    const total = players.reduce((sum, p) => sum + (p.skillRating || 0), 0);
    const average = size ? total / size : 0;
    const forwards = players.filter(p => p.position === POSITION_FORWARD).length;
    const defence = players.filter(p => p.position === POSITION_DEFENSE).length;
    const expectedDefence = Math.round(size * means.defenceShare);

    const dSize = size - means.meanSize;
    const dAverage = average - means.meanAverage;
    const dDefence = defence - expectedDefence;

    const stats = [
        makeStat('Roster', 'SIZE', String(size), dSize, 16, 1, 2,
            `${dSize >= 0 ? '+' : ''}${dSize.toFixed(1)}`),
        makeStat('Skill avg', 'SKILL', average.toFixed(1), dAverage, 30, 0.5, 1,
            `${dAverage >= 0 ? '+' : ''}${dAverage.toFixed(1)}`),
        makeStat('F / D', 'F-D', `${forwards}/${defence}`, dDefence, 16, 1.5, 2.5,
            dDefence === 0 ? 'even' : dDefence > 0 ? `+${dDefence} D` : `${dDefence} D`)
    ];

    // The worst axis owns the flag; showing three chips would just be the bars again.
    const worst = stats.reduce((a, b) => (b.barWidth > a.barWidth ? b : a), stats[0]);
    const flagged = worst.band !== BAND.OK;

    let flag = '';
    if (flagged) {
        if (worst.label === 'Roster') {
            flag = dSize > 0 ? `Over by ${Math.round(Math.abs(dSize))}` : `Short ${Math.round(Math.abs(dSize))}`;
        } else if (worst.label === 'Skill avg') {
            flag = dAverage > 0 ? `Stacked +${dAverage.toFixed(1)}` : `Light ${dAverage.toFixed(1)}`;
        } else {
            flag = dDefence < 0 ? `Short ${Math.abs(dDefence)} D` : `+${dDefence} D`;
        }
    }

    return { size, total, average, forwards, defence, stats, flagged, flag, flagBand: worst.band };
}

/**
 * The board-level strip: one chip per axis, each naming the first team that offends so the
 * chip can scroll straight to it.
 */
export function boardBalance(teams) {
    const means = boardMeans(teams);
    const perTeam = teams.map(t => ({ team: t, balance: teamBalance(t, means) }));

    const worstOn = (index) => {
        let worst = null;
        perTeam.forEach(entry => {
            const stat = entry.balance.stats[index];
            if (stat.band === BAND.OK) return;
            if (!worst || stat.barWidth > worst.stat.barWidth) worst = { entry, stat };
        });
        return worst;
    };

    const sizes = teams.map(t => t.players.length);
    const minSize = sizes.length ? Math.min(...sizes) : 0;
    const maxSize = sizes.length ? Math.max(...sizes) : 0;

    const rosterWorst = worstOn(0);
    const skillWorst = worstOn(1);
    const splitWorst = worstOn(2);

    const chips = [
        {
            axis: 'Roster',
            text: rosterWorst ? `${minSize}-${maxSize}` : `even, ${minSize}-${maxSize}`,
            band: rosterWorst ? rosterWorst.stat.band : BAND.OK,
            teamId: rosterWorst ? rosterWorst.entry.team.id : null,
            title: rosterWorst
                ? `${rosterWorst.entry.team.name} is furthest from the average roster size`
                : 'Every roster is within one of the average'
        },
        {
            axis: 'Skill',
            text: skillWorst ? `${Math.abs(Number(skillWorst.stat.delta)).toFixed(1)} off avg` : 'even',
            band: skillWorst ? skillWorst.stat.band : BAND.OK,
            teamId: skillWorst ? skillWorst.entry.team.id : null,
            title: skillWorst
                ? `${skillWorst.entry.team.name} is furthest from the average skill`
                : 'Every team is within half a point of the average'
        },
        {
            axis: 'F/D',
            text: splitWorst ? splitWorst.stat.delta : 'even',
            band: splitWorst ? splitWorst.stat.band : BAND.OK,
            teamId: splitWorst ? splitWorst.entry.team.id : null,
            title: splitWorst
                ? `${splitWorst.entry.team.name} is furthest from the expected forward/defence split`
                : 'Every team matches the expected forward/defence split'
        }
    ];

    return { means, perTeam, chips };
}
