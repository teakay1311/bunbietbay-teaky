import test from 'node:test';
import assert from 'node:assert/strict';
import { chainComparators, compareDate, compareNumber, compareText, stableSort } from '../src/utils/listSort';

test('stableSort keeps original order when comparator returns equal', () => {
  const sorted = stableSort([
    { id: 'a', group: 1 },
    { id: 'b', group: 1 },
    { id: 'c', group: 2 },
  ], (first, second) => compareNumber(first.group, second.group, 'asc'));

  assert.deepEqual(sorted.map((item) => item.id), ['a', 'b', 'c']);
});

test('compare helpers support Vietnamese text, dates, and descending numbers', () => {
  assert.ok(compareText('Đà Lạt', 'Ha Noi', 'asc') < 0);
  assert.ok(compareDate('2026-04-25T10:00:00.000Z', '2026-04-24T10:00:00.000Z', 'desc') < 0);
  assert.ok(compareNumber(10, 2, 'desc') < 0);
});

test('chainComparators falls back when primary comparator is equal', () => {
  const sorted = stableSort([
    { id: 'b', group: 1 },
    { id: 'a', group: 1 },
  ], chainComparators(
    (first, second) => compareNumber(first.group, second.group, 'asc'),
    (first, second) => compareText(first.id, second.id, 'asc'),
  ));

  assert.deepEqual(sorted.map((item) => item.id), ['a', 'b']);
});
