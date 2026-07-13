import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRemoteWorkspaceError, hasUnsyncedLocalChanges, shouldOpenSyncConflict } from '../src/utils/cloudSyncDecisions';

test('detects unsynced local changes using snapshot hashes', () => {
  assert.equal(hasUnsyncedLocalChanges('abc', 'abc'), false);
  assert.equal(hasUnsyncedLocalChanges('abc', 'xyz'), true);
  assert.equal(hasUnsyncedLocalChanges(null, 'xyz'), true);
});

test('opens sync conflict only when remote is newer and local is dirty', () => {
  assert.equal(shouldOpenSyncConflict({
    remoteUpdatedAt: '2026-04-09T10:00:00.000Z',
    lastSyncedAt: '2026-04-09T09:00:00.000Z',
    lastSyncedHash: 'old',
    currentHash: 'new',
  }), true);

  assert.equal(shouldOpenSyncConflict({
    remoteUpdatedAt: '2026-04-09T10:00:00.000Z',
    lastSyncedAt: '2026-04-09T11:00:00.000Z',
    lastSyncedHash: 'old',
    currentHash: 'new',
  }), false);

  assert.equal(shouldOpenSyncConflict({
    remoteUpdatedAt: '2026-04-09T10:00:00.000Z',
    lastSyncedAt: '2026-04-09T09:00:00.000Z',
    lastSyncedHash: 'same',
    currentHash: 'same',
  }), false);
});

test('falls back safely when timestamps are non-ISO strings', () => {
  assert.equal(shouldOpenSyncConflict({
    remoteUpdatedAt: '2026/04/09 10:00:00',
    lastSyncedAt: 'invalid-date',
    lastSyncedHash: 'old',
    currentHash: 'new',
  }), true);
});

test('classifies Supabase workspace failures without relying on one message shape', () => {
  assert.equal(classifyRemoteWorkspaceError({ code: '42703', message: 'column revoked_at does not exist' }), 'schema-incompatible');
  assert.equal(classifyRemoteWorkspaceError({ code: 'PGRST204', message: 'missing schema cache field' }), 'schema-incompatible');
  assert.equal(classifyRemoteWorkspaceError({ status: 401, message: 'JWT expired' }), 'auth');
  assert.equal(classifyRemoteWorkspaceError({ code: '42501', message: 'permission denied' }), 'permission');
  assert.equal(classifyRemoteWorkspaceError(new TypeError('Failed to fetch')), 'network');
});
