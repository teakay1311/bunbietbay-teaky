import test from 'node:test';
import assert from 'node:assert/strict';
import { readStoredOption } from '../src/hooks/useStoredOption';

test('stored UI options restore only valid values', () => {
  const options = ['grid', 'list'] as const;
  assert.equal(readStoredOption('view', options, 'grid', { getItem: () => 'list' }), 'list');
  assert.equal(readStoredOption('view', options, 'grid', { getItem: () => 'broken' }), 'grid');
  assert.equal(readStoredOption('view', options, 'grid', { getItem: () => { throw new Error('blocked'); } }), 'grid');
});
