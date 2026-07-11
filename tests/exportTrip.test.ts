import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatIcsDate } from '../src/utils/ics';
import { sortActivitiesByTime } from '../src/utils/activitySort';

test('formats legacy AM/PM activity times correctly for ICS export', () => {
  assert.equal(formatIcsDate('2024-10-15', '08:30 AM'), '20241015T083000');
  assert.equal(formatIcsDate('2024-10-15', '12:05 PM'), '20241015T120500');
});

test('falls back to 09:00 when activity time is not parseable for ICS export', () => {
  assert.equal(formatIcsDate('2024-10-15', 'morning'), '20241015T090000');
});

test('sorts legacy AM/PM activities for markdown export', () => {
  const sorted = sortActivitiesByTime([
    { time: '12:30 PM', title: 'Lunch' },
    { time: '08:30 AM', title: 'Breakfast' },
    { time: '11:00 AM', title: 'Walk' },
  ]);
  assert.deepEqual(sorted.map((activity) => activity.title), ['Breakfast', 'Walk', 'Lunch']);

  const exportSource = readFileSync(new URL('../src/utils/exportTrip.ts', import.meta.url), 'utf8');
  assert.match(exportSource, /sortActivitiesByTime\(activities\.filter/);
});
