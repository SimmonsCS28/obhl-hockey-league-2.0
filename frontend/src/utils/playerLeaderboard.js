// These endpoints already return season totals, not individual game events.
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const nameOrder = (a, b) => `${a.lastName || ''} ${a.firstName || ''}`.localeCompare(
    `${b.lastName || ''} ${b.firstName || ''}`, 'en', { sensitivity: 'base' }) || number(a.id) - number(b.id);

export function buildLeaderboard(players, stats, teams, seasonId, goalie = false) {
    const roster = new Map(players.filter(p => Number(p.seasonId) === Number(seasonId)).map(p => [Number(p.id), p]));
    const teamMap = new Map(teams.map(t => [Number(t.id), t]));
    return stats.filter(s => Number(s.seasonId) === Number(seasonId)).flatMap(s => {
        const player = roster.get(Number(s.playerId));
        if (!player || (!goalie && player.position === 'G')) return [];
        const team = teamMap.get(Number(s.teamId ?? player.teamId));
        return [{
            ...player,
            teamId: s.teamId ?? player.teamId,
            teamName: team?.name || 'Free Agent',
            teamColor: team?.teamColor,
            gamesPlayed: number(s.gamesPlayed),
            goals: number(s.goals), assists: number(s.assists), points: number(s.points),
            penaltyMinutes: number(s.penaltyMinutes),
            wins: number(s.wins), losses: number(s.losses), overtimeLosses: number(s.overtimeLosses),
            saves: number(s.saves), shotsAgainst: number(s.shotsAgainst), shutouts: number(s.shutouts),
            savePercentage: number(s.shotsAgainst) > 0 ? number(s.saves) / number(s.shotsAgainst) : null,
            goalsAgainstAverage: number(s.gamesPlayed) > 0 && s.goalsAgainstAverage != null
                ? number(s.goalsAgainstAverage) : null,
        }];
    });
}

export function filterPlayers(rows, team, query) {
    const needle = query.trim().toLocaleLowerCase();
    return rows.filter(p => (team === 'all' || Number(p.teamId) === Number(team)) &&
        `${p.firstName || ''} ${p.lastName || ''}`.toLocaleLowerCase().includes(needle));
}

export function sortPlayers(rows, sort, mode = 'roster') {
    const value = (row) => {
        if (sort.key === 'name') return `${row.lastName || ''} ${row.firstName || ''}`.toLocaleLowerCase();
        if (sort.key === 'team') return row.teamName.toLocaleLowerCase();
        return row[sort.key];
    };
    return [...rows].sort((a, b) => {
        const av = value(a), bv = value(b);
        // Missing goalie rates and jersey numbers sort last in either direction.
        if (av == null && bv != null) return 1;
        if (bv == null && av != null) return -1;
        const order = typeof av === 'string' && typeof bv === 'string'
            ? av.localeCompare(bv, 'en') : av < bv ? -1 : av > bv ? 1 : 0;
        if (order) return sort.direction === 'ascending' ? order : -order;
        if (mode === 'skaters') {
            const tie = b.points - a.points || b.goals - a.goals || b.assists - a.assists;
            if (tie) return tie;
        }
        if (mode === 'goalies') {
            const tie = b.wins - a.wins || b.saves - a.saves;
            if (tie) return tie;
        }
        return nameOrder(a, b);
    });
}

export function paginatePlayers(rows, requestedPage, pageSize) {
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const offset = (page - 1) * pageSize;
    return { rows: rows.slice(offset, offset + pageSize), page, totalPages, offset,
        start: rows.length ? offset + 1 : 0, end: Math.min(offset + pageSize, rows.length) };
}
