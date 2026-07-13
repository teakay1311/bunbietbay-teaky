import test from 'node:test';
import assert from 'node:assert/strict';
import { getScheduleConflicts } from '../src/features/schedule/selectors';
import type { Activity } from '../src/domain/models';

const activity = (id: string, date: string, time: string, durationMinutes = 60, travelMinutesAfter = 0): Activity => ({ id, tripId: 't1', date, time, title: id, location: '', note: '', type: 'other', durationMinutes, travelMinutesAfter });

test('detects overlap and insufficient travel without changing the schedule', () => {
  const overlap = getScheduleConflicts([activity('a', '2026-01-01', '09:00', 90), activity('b', '2026-01-01', '10:00')]);
  assert.deepEqual(overlap.map((item) => [item.kind, item.minutes]), [['overlap', 30]]);
  const travel = getScheduleConflicts([activity('a', '2026-01-01', '09:00', 60, 45), activity('b', '2026-01-01', '10:30')]);
  assert.deepEqual(travel.map((item) => [item.kind, item.gapMinutes, item.requiredMinutes]), [['travel-gap', 30, 45]]);
});

test('supports activities crossing midnight and flags missing time without guessing', () => {
  assert.equal(getScheduleConflicts([activity('late', '2026-01-01', '23:30', 90), activity('early', '2026-01-02', '00:30')])[0].kind, 'overlap');
  const missing = getScheduleConflicts([activity('unknown', '2026-01-01', '')]);
  assert.equal(missing[0].kind, 'missing-time');
  assert.equal(missing[0].next, undefined);
});
