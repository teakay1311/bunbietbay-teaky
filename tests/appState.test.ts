import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_STATE_VERSION, buildDuplicatedMembershipRoles, normalizePersistedState, prepareImportedSnapshot, validateImportedSnapshot } from '../src/utils/appState';
import type { PersistedAppState } from '../src/context/AppContext';

const fallbackState: PersistedAppState = {
  version: APP_STATE_VERSION,
  trips: [],
  profiles: [],
  memberships: [],
  invitations: [],
  activities: [],
  expenses: [],
  savedPlaces: [],
  packingItems: [],
  photos: [],
  collaborationSettings: [], tasks: [], polls: [], pollOptions: [], pollVotes: [], comments: [], notifications: [], offlineMutations: [],
  activityLogs: [],
  currentTripId: null,
  viewerProfileId: null,
};

const validSnapshot: PersistedAppState = {
  ...fallbackState,
  trips: [{
    id: 't1', title: 'Trip', location: 'Da Lat', startDate: '2026-04-10', endDate: '2026-04-12',
    budget: 1000000, status: 'upcoming', image: '',
  }],
  profiles: [{ id: 'm1', email: 'm1@example.com', displayName: 'M1', avatar: 'https://example.com/a.png' }],
  memberships: [{ id: 'tm1', tripId: 't1', userId: 'm1', role: 'owner' }],
  currentTripId: 't1',
  viewerProfileId: 'm1',
};

test('keeps a new production workspace empty instead of injecting demo trips', () => {
  const normalizedState = normalizePersistedState(null, fallbackState);
  assert.deepEqual(normalizedState.trips, []);
  assert.deepEqual(normalizedState.memberships, []);
  assert.equal(normalizedState.currentTripId, null);
});

test('migrates persisted photos to include storage metadata', () => {
  const normalizedState = normalizePersistedState({
    version: 1,
    photos: [
      { id: 'p1', tripId: 't1', url: 'data:image/webp;base64,abc', album: 'Chung', createdAt: '2026-04-09T00:00:00.000Z' },
      { id: 'p2', tripId: 't1', url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', album: 'Cloud', createdAt: '2026-04-09T00:00:00.000Z' },
    ],
  }, fallbackState);

  assert.equal(normalizedState.version, APP_STATE_VERSION);
  assert.equal(normalizedState.photos[0]?.storage, 'embedded');
  assert.equal(normalizedState.photos[1]?.storage, 'remote');
  assert.equal(normalizedState.photos[1]?.provider, 'cloudinary');
});

test('migrates legacy baseTrips and members into trips/profiles/memberships', () => {
  const normalizedState = normalizePersistedState({
    version: 2,
    baseTrips: [{
      id: 'legacy-trip',
      title: 'Legacy',
      location: 'Da Nang',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      budget: 1000,
      status: 'upcoming',
      image: '',
      memberIds: ['legacy-user'],
    }],
    members: [{
      id: 'legacy-user',
      name: 'Legacy User',
      avatar: 'https://example.com/avatar.jpg',
      email: 'legacy@example.com',
    }],
  }, fallbackState);

  assert.equal(normalizedState.trips.length, 1);
  assert.equal(normalizedState.profiles.length, 1);
  assert.equal(normalizedState.memberships.length, 1);
  assert.equal(normalizedState.memberships[0]?.role, 'owner');
  assert.equal(normalizedState.memberships[0]?.revokedAt, undefined);
});

test('falls back to safe defaults when imported lists have invalid shapes', () => {
  const normalizedState = normalizePersistedState({
    version: 3,
    trips: {} as unknown as PersistedAppState['trips'],
    expenses: {} as unknown as PersistedAppState['expenses'],
    photos: {} as unknown as PersistedAppState['photos'],
    currentTripId: 123 as unknown as string,
  }, fallbackState);

  assert.deepEqual(normalizedState.trips, []);
  assert.deepEqual(normalizedState.expenses, []);
  assert.deepEqual(normalizedState.photos, []);
  assert.equal(normalizedState.currentTripId, null);
});

test('preserves fallback data when normalizing a partial state update', () => {
  const currentState: PersistedAppState = {
    ...fallbackState,
    trips: [{
      id: 't1',
      title: 'Trip',
      location: 'Da Nang',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      budget: 1000,
      status: 'upcoming',
      image: '',
    }],
    profiles: [{
      id: 'm1',
      email: 'm1@example.com',
      displayName: 'Old Name',
      avatar: 'https://example.com/a.png',
    }],
    memberships: [{ id: 'tm1', tripId: 't1', userId: 'm1', role: 'owner' }],
    currentTripId: 't1',
    viewerProfileId: 'm1',
  };

  const normalizedState = normalizePersistedState({
    profiles: [{ ...currentState.profiles[0], displayName: 'New Name' }],
  }, currentState);

  assert.equal(normalizedState.profiles[0]?.displayName, 'New Name');
  assert.deepEqual(normalizedState.trips, currentState.trips);
  assert.deepEqual(normalizedState.memberships, currentState.memberships);
  assert.equal(normalizedState.currentTripId, 't1');
  assert.equal(normalizedState.viewerProfileId, 'm1');
});

test('rejects imported snapshot when expense participants is malformed', () => {
  assert.throws(() => {
    validateImportedSnapshot({
      ...validSnapshot,
      expenses: [{
        id: 'e1',
        tripId: 't1',
        date: '2026-04-10',
        time: '10:00',
        title: 'Taxi',
        category: 'Di chuyển',
        amount: 120000,
        paidBy: 'm1',
        participants: [1, 2] as unknown as string[],
      }],
    });
  }, /không hợp lệ/i);
});

test('accepts a complete imported snapshot with valid links', () => {
  assert.doesNotThrow(() => {
    validateImportedSnapshot(validSnapshot);
  });
});

test('rejects current-version partial and orphaned backups', () => {
  assert.throws(() => validateImportedSnapshot({ version: APP_STATE_VERSION }), /không đầy đủ/i);
  assert.throws(() => validateImportedSnapshot({
    ...validSnapshot,
    expenses: [{
      id: 'e1', tripId: 't1', date: '2026-04-10', time: '10:00', title: 'Taxi', category: 'Di chuyển',
      amount: 120000, paidBy: 'missing', participants: ['m1'],
    }],
  }), /chi tiêu không liên kết/i);
});

test('migrates a legacy backup before full validation', () => {
  const imported = prepareImportedSnapshot({
    version: 2,
    baseTrips: [{
      id: 'legacy-trip', title: 'Legacy', location: 'Hue', startDate: '2026-04-10', endDate: '2026-04-12',
      budget: 1000, status: 'upcoming', image: '', memberIds: ['legacy-user'],
    }],
    members: [{ id: 'legacy-user', name: 'Legacy User', avatar: '', email: 'legacy@example.com' }],
  });
  assert.equal(imported.memberships[0]?.role, 'owner');
});

test('accepts linked trip entities and rejects cross-trip links', () => {
  const linked = structuredClone(validSnapshot);
  linked.savedPlaces.push({ id: 'place-1', tripId: 't1', name: 'Quán ăn', type: 'restaurant' });
  linked.activities.push({ id: 'activity-1', tripId: 't1', date: '2026-01-02', time: '09:00', title: 'Ăn sáng', location: 'Quán ăn', note: '', type: 'restaurant', placeId: 'place-1' });
  linked.expenses.push({ id: 'expense-1', tripId: 't1', date: '2026-01-02', time: '09:30', title: 'Ăn sáng', category: 'Ăn uống', amount: 100000, paidBy: 'm1', participants: ['m1'], activityId: 'activity-1', placeId: 'place-1' });
  validateImportedSnapshot(linked);

  linked.expenses[0].activityId = 'missing';
  assert.throws(() => validateImportedSnapshot(linked), /hoạt động không hợp lệ/i);
});

test('rejects replies linked to a different comment target', () => {
  const linked = structuredClone(validSnapshot);
  linked.activities.push(
    { id: 'activity-1', tripId: 't1', date: '2026-01-02', time: '09:00', title: 'Điểm một', location: 'A', note: '', type: 'other' },
    { id: 'activity-2', tripId: 't1', date: '2026-01-02', time: '10:00', title: 'Điểm hai', location: 'B', note: '', type: 'other' },
  );
  linked.comments.push(
    { id: 'comment-1', tripId: 't1', targetType: 'activity', targetId: 'activity-1', authorId: 'm1', body: 'Gốc', mentionedUserIds: [], createdAt: '2026-01-02T09:00:00.000Z', updatedAt: '2026-01-02T09:00:00.000Z' },
    { id: 'comment-2', tripId: 't1', targetType: 'activity', targetId: 'activity-2', parentId: 'comment-1', authorId: 'm1', body: 'Sai luồng', mentionedUserIds: [], createdAt: '2026-01-02T10:00:00.000Z', updatedAt: '2026-01-02T10:00:00.000Z' },
  );

  assert.throws(() => validateImportedSnapshot(linked), /phản hồi bình luận không cùng luồng/i);
});

test('duplicates active memberships with the creator as owner', () => {
  const roles = buildDuplicatedMembershipRoles([
    { id: 'tm1', tripId: 't1', userId: 'old-owner', role: 'owner' },
    { id: 'tm2', tripId: 't1', userId: 'creator', role: 'viewer' },
    { id: 'tm3', tripId: 't1', userId: 'archived', role: 'editor', revokedAt: '2026-04-10T00:00:00.000Z' },
  ], 't1', 'creator');

  assert.deepEqual(roles, [
    { userId: 'creator', role: 'owner' },
    { userId: 'old-owner', role: 'admin' },
  ]);
});
