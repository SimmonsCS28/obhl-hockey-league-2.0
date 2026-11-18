import assert from 'node:assert/strict';
import test from 'node:test';
import { ordinal, sortByStandings } from '../src/utils/standings.js';

test('points outrank wins and goal differential', () => {
    const teams = [
        { id: 'wins', points: 10, wins: 5, goalsFor: 100 },
        { id: 'points', points: 11, wins: 4, goalsFor: 15 },
    ];
    assert.deepEqual(sortByStandings(teams).map(t => t.id), ['points', 'wins']);
});

test('regulation wins break equal points before overtime wins', () => {
    assert.deepEqual(sortByStandings([
        { id: 'overtime', points: 10, wins: 2, overtimeWins: 3 },
        { id: 'regulation', points: 10, wins: 3, overtimeWins: 1 },
    ]).map(t => t.id), ['regulation', 'overtime']);
});

test('total wins break a tie before goal differential', () => {
    assert.deepEqual(sortByStandings([
        { id: 'goals', points: 10, wins: 3, overtimeWins: 1, goalsFor: 100 },
        { id: 'wins', points: 10, wins: 3, overtimeWins: 2, goalsFor: 5 },
    ]).map(t => t.id), ['wins', 'goals']);
});

test('goal differential and then goals for resolve remaining ties', () => {
    assert.deepEqual(sortByStandings([
        { id: 'lower-difference', goalsFor: 30, goalsAgainst: 29 },
        { id: 'fewer-goals', goalsFor: 5, goalsAgainst: 2 },
        { id: 'more-goals', goalsFor: 8, goalsAgainst: 5 },
    ]).map(t => t.id), ['more-goals', 'fewer-goals', 'lower-difference']);
});

test('empty and incomplete records are safe and do not mutate fetched state', () => {
    assert.deepEqual(sortByStandings(null), []);
    const teams = Object.freeze([Object.freeze({ id: 1 }), Object.freeze({ id: 2, points: 2 })]);
    assert.deepEqual(sortByStandings(teams).map(t => t.id), [2, 1]);
    assert.deepEqual(teams.map(t => t.id), [1, 2]);
});

test('equal records keep their input order', () => {
    assert.deepEqual(sortByStandings([{ id: 2 }, { id: 1 }]).map(t => t.id), [2, 1]);
});

test('standings rank suffixes handle teens and later decades', () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 111].map(ordinal),
        ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '111th']);
});
