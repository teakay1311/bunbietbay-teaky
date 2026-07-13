import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDefaultAvatar, getDefaultDisplayName } from '../src/domain/profileDefaults';

test('builds deterministic fallback profile fields without changing auth identity', () => {
  assert.equal(getDefaultDisplayName('teakay@example.com'), 'Teakay');
  assert.equal(getDefaultDisplayName(null), 'Traveler');
  assert.match(buildDefaultAvatar('user id'), /seed=user%20id$/);
});
