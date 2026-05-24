import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_STATE_VERSION, normalizePersistedState, validateImportedSnapshot } from '../src/utils/appState';
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
  activityLogs: [],
  currentTripId: null,
  viewerProfileId: null,
};

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

test('rejects imported snapshot when expense participants is malformed', () => {
  assert.throws(() => {
    validateImportedSnapshot({
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

test('accepts imported snapshot with valid minimal records', () => {
  assert.doesNotThrow(() => {
    validateImportedSnapshot({
      trips: [{
        id: 't1',
        title: 'Trip',
        location: 'Da Lat',
        startDate: '2026-04-10',
        endDate: '2026-04-12',
        budget: 1000000,
        status: 'upcoming',
        image: '',
      }],
      profiles: [{
        id: 'm1',
        email: 'm1@example.com',
        displayName: 'M1',
        avatar: 'https://example.com/a.png',
      }],
    });
  });
});
