import test from 'node:test';
import assert from 'node:assert/strict';
import { hammingDistance, sha256Hex } from '../src/features/photos/duplicateDetection';

test('SHA-256 identifies exact duplicate bytes deterministically', async () => {
  const first = await sha256Hex(new Blob(['bunbietbay']));
  const second = await sha256Hex(new Blob(['bunbietbay']));
  const different = await sha256Hex(new Blob(['bunbietbay!']));
  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.equal(first.length, 64);
});

test('dHash distance uses bit-level difference and rejects incompatible hashes', () => {
  assert.equal(hammingDistance('0000000000000000', '000000000000001f'), 5);
  assert.equal(hammingDistance('0000000000000000', '000000000000003f'), 6);
  assert.equal(hammingDistance('0', '00'), Number.POSITIVE_INFINITY);
});
