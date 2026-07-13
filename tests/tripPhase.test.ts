import assert from 'node:assert/strict';
import test from 'node:test';

import { getTripPhase } from '../src/domain/tripPhase';

const trip = { status: 'upcoming' as const, startDate: '2026-07-10', endDate: '2026-07-15' };

test('derives trip phase without mutating persisted status', () => {
  assert.equal(getTripPhase({ ...trip, status: 'draft' }, '2026-07-13'), 'draft');
  assert.equal(getTripPhase(trip, '2026-07-09'), 'upcoming');
  assert.equal(getTripPhase(trip, '2026-07-13'), 'active');
  assert.equal(getTripPhase(trip, '2026-07-16'), 'wrap-up');
  assert.equal(getTripPhase({ ...trip, status: 'completed' }, '2026-07-09'), 'completed');
});
