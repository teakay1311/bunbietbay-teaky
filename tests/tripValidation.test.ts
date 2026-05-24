import test from 'node:test';
import assert from 'node:assert/strict';
import { getTripDateValidationError } from '../src/utils/tripValidation';

test('accepts valid trip date ranges', () => {
  assert.equal(getTripDateValidationError('2026-04-09', '2026-04-12'), null);
  assert.equal(getTripDateValidationError('2026-04-09', '2026-04-09'), null);
});

test('rejects trip ranges where end date is before start date', () => {
  assert.equal(
    getTripDateValidationError('2026-04-12', '2026-04-09'),
    'Ngày về phải bằng hoặc sau ngày đi.',
  );
});
