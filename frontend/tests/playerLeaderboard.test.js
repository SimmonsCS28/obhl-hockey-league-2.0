import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLeaderboard, filterPlayers, paginatePlayers, sortPlayers } from '../src/utils/playerLeaderboard.js';

const players = [
    { id: 1, seasonId: 10, firstName: 'Alex', lastName: 'Baker', position: 'F', teamId: 20 },
    { id: 2, seasonId: 10, firstName: 'Sam', lastName: 'Carter', position: 'D', teamId: 21 },
    { id: 3, seasonId: 11, firstName: 'Old', lastName: 'Season', position: 'F', teamId: 20 },
    { id: 4, seasonId: 10, firstName: 'Jamie', lastName: 'Davis', position: 'G', teamId: 20 },
];
const teams = [{ id: 20, name: 'Gold', teamColor: '#ffd700' }, { id: 21, name: 'Navy' }];
const records = [
    { playerId: 1, seasonId: 10, teamId: 20, gamesPlayed: 4, goals: 3, assists: 5, points: 8, penaltyMinutes: 6 },
    { playerId: 2, seasonId: 10, teamId: 21, gamesPlayed: 4, goals: 4, assists: 4, points: 8, penaltyMinutes: 2 },
    { playerId: 3, seasonId: 11, goals: 100, points: 100 },
    { playerId: 999, seasonId: 10, goals: 50, points: 50 },
    { playerId: 4, seasonId: 10, points: 2 },
];
test('season totals join the right roster and teams without leaking other seasons or orphan rows', () => {
    const rows = buildLeaderboard(players, records, teams, 10);
    assert.deepEqual(rows.map(r => r.id), [1, 2]);
    assert.equal(rows[0].teamName, 'Gold');
    assert.equal(rows[0].points, 8);
    assert.equal(rows[0].penaltyMinutes, 6);
});
test('no recorded statistics gives an empty leaderboard, not invented zero totals', () => {
    assert.deepEqual(buildLeaderboard(players, [], teams, 10), []);
});
test('points ties use goals, then assists, name and player ID consistently', () => {
    const rows = buildLeaderboard(players, records, teams, 10);
    assert.deepEqual(sortPlayers(rows, { key: 'points', direction: 'descending' }, 'skaters').map(r => r.id), [2, 1]);
    const tie = [{ id: 9, firstName: 'Alex', lastName: 'Baker', points: 3, goals: 1, assists: 2 },
        { id: 8, firstName: 'Alex', lastName: 'Baker', points: 3, goals: 1, assists: 2 }];
    assert.deepEqual(sortPlayers(tie, { key: 'points', direction: 'descending' }, 'skaters').map(r => r.id), [8, 9]);
});
test('sorts numeric values in both directions without mutating input', () => {
    const rows = buildLeaderboard(players, records, teams, 10);
    assert.deepEqual(sortPlayers(rows, { key: 'penaltyMinutes', direction: 'ascending' }, 'skaters').map(r => r.id), [2, 1]);
    assert.deepEqual(sortPlayers(rows, { key: 'penaltyMinutes', direction: 'descending' }, 'skaters').map(r => r.id), [1, 2]);
    assert.deepEqual(rows.map(r => r.id), [1, 2]);
});
test('search and team filters combine and normalize numeric IDs', () => {
    assert.deepEqual(filterPlayers(players, '20', ' ALEX ').map(r => r.id), [1]);
    assert.equal(filterPlayers(players, '21', 'Alex').length, 0);
});
test('154 players paginate into seven pages with stable boundaries', () => {
    const rows = Array.from({ length: 154 }, (_, id) => ({ id }));
    const first = paginatePlayers(rows, 1, 25), last = paginatePlayers(rows, 7, 25);
    assert.deepEqual([first.start, first.end, first.totalPages], [1, 25, 7]);
    assert.deepEqual([last.start, last.end, last.rows.length], [151, 154, 4]);
    assert.equal(paginatePlayers(rows, 2, 25).rows[0].id, 25);
    assert.equal(paginatePlayers(rows, 1, 50).totalPages, 4);
});
test('pagination clamps stale pages after filtering and handles an empty result', () => {
    const page = paginatePlayers(players.slice(0, 2), 7, 25);
    assert.equal(page.page, 1);
    const empty = paginatePlayers([], 9, 25);
    assert.deepEqual([empty.page, empty.totalPages, empty.start, empty.end], [1, 1, 0, 0]);
});
test('goalie percentages use raw saves and shots rather than rounded stored percentages', () => {
    const [row] = buildLeaderboard(players, [{ playerId: 4, seasonId: 10, gamesPlayed: 2, saves: 54,
        shotsAgainst: 60, savePercentage: .5, goalsAgainstAverage: '3.00' }], teams, 10, true);
    assert.equal(row.savePercentage, .9);
    assert.equal(row.goalsAgainstAverage, 3);
});
test('missing goalie denominators remain unavailable and sort last both ways', () => {
    const [row] = buildLeaderboard(players, [{ playerId: 4, seasonId: 10, saves: 0, shotsAgainst: 0, gamesPlayed: 0 }], teams, 10, true);
    assert.equal(row.savePercentage, null);
    assert.equal(row.goalsAgainstAverage, null);
    const rows = [row, { ...row, id: 6, savePercentage: .9 }];
    for (const direction of ['ascending', 'descending']) {
        assert.deepEqual(sortPlayers(rows, { key: 'savePercentage', direction }, 'goalies').map(r => r.id), [6, 4]);
    }
});
test('empty or missing jersey numbers stay last instead of becoming jersey zero', () => {
    const rows = [{ id: 1, jerseyNumber: null }, { id: 2, jerseyNumber: 0 }, { id: 3, jerseyNumber: 12 }];
    assert.deepEqual(sortPlayers(rows, { key: 'jerseyNumber', direction: 'ascending' }).map(r => r.id), [2, 3, 1]);
});
