import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRemoteWorkspaceWithOffline } from '../src/utils/offlineWorkspaceMerge';
import { EMPTY_PERSISTED_STATE } from '../src/utils/appState';
import type { Activity, OfflineMutation, PersistedAppState, TripRecord } from '../src/domain/models';

const trip = (id: string, title: string): TripRecord => ({ id, title, location: '', startDate: '2026-01-01', endDate: '2026-01-02', budget: 1, baseCurrency: 'VND', status: 'draft', image: '', createdBy: 'u1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });
const activity = (id: string, title: string): Activity => ({ id, tripId: 'remote-trip', date: '2026-01-01', time: '09:00', title, location: '', note: '', type: 'other', updatedAt: '2026-01-01T00:00:00Z' });
const mutation = (overrides: Partial<OfflineMutation>): OfflineMutation => ({ id: 'm1', entityType: 'activity', entityId: 'a1', tripId: 'remote-trip', action: 'update', payload: { title: 'Local edit' }, createdAt: '2026-01-01T00:00:00Z', status: 'pending', ...overrides });

test('remote refresh preserves only queued entities and still accepts unrelated realtime data', () => {
  const current: PersistedAppState = { ...EMPTY_PERSISTED_STATE, trips: [trip('remote-trip', 'Trip')], activities: [activity('a1', 'Local edit')], offlineMutations: [mutation({})] };
  const remote: PersistedAppState = { ...EMPTY_PERSISTED_STATE, trips: [trip('remote-trip', 'Trip')], activities: [activity('a1', 'Cloud edit'), activity('a2', 'New from cloud')] };
  const merged = mergeRemoteWorkspaceWithOffline(current, remote);
  assert.equal(merged.activities.find((item) => item.id === 'a1')?.title, 'Local edit');
  assert.equal(merged.activities.find((item) => item.id === 'a2')?.title, 'New from cloud');
  assert.equal(merged.offlineMutations.length, 1);
});

test('offline-created trip keeps its owner membership until server creation succeeds', () => {
  const localTrip = trip('offline-trip', 'Offline');
  const current: PersistedAppState = { ...EMPTY_PERSISTED_STATE, trips: [localTrip], memberships: [{ id: 'membership', tripId: localTrip.id, userId: 'u1', role: 'owner' }], offlineMutations: [mutation({ entityType: 'trip', entityId: localTrip.id, tripId: localTrip.id, action: 'create', payload: { row: {} } })] };
  const merged = mergeRemoteWorkspaceWithOffline(current, EMPTY_PERSISTED_STATE);
  assert.equal(merged.trips[0]?.id, localTrip.id);
  assert.equal(merged.memberships[0]?.role, 'owner');
});
