import assert from 'node:assert/strict';
import test from 'node:test';
import { fmtGameDate, fmtGameTime } from '../src/utils/gameTime.js';

const dashboardDate = { weekday: 'short', month: 'short', day: 'numeric' };

test('game cards accept colon offsets and show the Central game night', () => {
    for (const date of ['2026-11-17T19:00:00-06:00', '2026-11-18T01:00:00Z', '2026-11-18T02:00:00+01:00']) {
        assert.equal(fmtGameTime(date), '7:00 PM');
        assert.equal(fmtGameDate(date, dashboardDate), 'Tue, Nov 17');
    }
});

test('bare backend datetimes are interpreted as UTC across midnight', () => {
    assert.equal(fmtGameTime('2026-11-18T01:00:00'), '7:00 PM');
    assert.equal(fmtGameDate('2026-11-18T01:00:00', dashboardDate), 'Tue, Nov 17');
});

test('summer games use Central daylight time', () => {
    assert.equal(fmtGameTime('2026-07-16T01:00:00Z'), '8:00 PM');
    assert.equal(fmtGameDate('2026-07-16T01:00:00Z', dashboardDate), 'Wed, Jul 15');
});

test('missing or invalid dates do not render Invalid Date in game cards', () => {
    for (const date of [undefined, null, '', 'not-a-date']) {
        assert.equal(fmtGameTime(date), '');
        assert.equal(fmtGameDate(date, dashboardDate), '');
    }
});
