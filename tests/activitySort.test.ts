import test from 'node:test';
import assert from 'node:assert/strict';
import { sortActivitiesByTime } from '../src/utils/activitySort';

test('sorts activities in ascending order even when time formats differ', () => {
  const sortedActivities = sortActivitiesByTime([
    { id: 'a2', time: '09:00 AM' },
    { id: 'a3', time: '14:30' },
    { id: 'a1', time: '07:15' },
  ]);

  assert.deepEqual(sortedActivities.map((activity) => activity.id), ['a1', 'a2', 'a3']);
});
