import test from 'node:test';
import assert from 'node:assert/strict';
import { formatIcsDate } from '../src/utils/ics';

test('formats legacy AM/PM activity times correctly for ICS export', () => {
  assert.equal(formatIcsDate('2024-10-15', '08:30 AM'), '20241015T083000');
  assert.equal(formatIcsDate('2024-10-15', '12:05 PM'), '20241015T120500');
});

test('falls back to 09:00 when activity time is not parseable for ICS export', () => {
  assert.equal(formatIcsDate('2024-10-15', 'morning'), '20241015T090000');
});
