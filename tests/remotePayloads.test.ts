import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toRemoteActivity,
  toRemoteActivityUpdate,
  toRemoteExpense,
  toRemoteExpenseUpdate,
  toRemotePackingItemUpdate,
  toRemotePhotoUpdate,
  toRemoteSavedPlaceUpdate,
  toRemoteTripUpdate,
} from '../src/data/remotePayloads';

test('maps linked trip entities to the existing Supabase column contract', () => {
  assert.deepEqual(toRemoteActivity({
    id: 'a1', tripId: 't1', date: '2026-01-01', time: '09:00', title: 'Cafe', location: 'Hue', note: '', type: 'cafe', placeId: 'p1',
  }), {
    id: 'a1', trip_id: 't1', date: '2026-01-01', time: '09:00', title: 'Cafe', location: 'Hue', note: '', type: 'cafe',
    image: undefined, map_url: undefined, booking_code: undefined, place_id: 'p1', is_completed: false,
  });

  assert.equal(toRemoteExpense({
    id: 'e1', tripId: 't1', date: '2026-01-01', time: '10:00', title: 'Coffee', category: 'Food', amount: 50,
    paidBy: 'u1', participants: ['u1'], activityId: 'a1', placeId: 'p1',
  }).activity_id, 'a1');
});

test('remote update payloads omit absent fields and preserve explicit clears', () => {
  assert.deepEqual(toRemoteTripUpdate({ themeColor: undefined }), { theme_color: null });
  assert.deepEqual(toRemotePhotoUpdate({ album: 'New', content: '', activityId: undefined, placeId: undefined }), {
    album: 'New', content: null, activity_id: null, place_id: null,
  });
  assert.deepEqual(toRemoteExpenseUpdate({ activityId: undefined, placeId: undefined }), {
    activity_id: null, place_id: null,
  });
  assert.deepEqual(toRemoteActivityUpdate({ bookingCode: undefined, placeId: undefined }), {
    booking_code: null, place_id: null,
  });
  assert.deepEqual(toRemotePackingItemUpdate({ assigneeId: undefined }), { assignee_id: null });
  assert.deepEqual(toRemoteSavedPlaceUpdate({ sourceNotebookPlaceId: undefined }), {
    source_notebook_place_id: null,
  });
  assert.deepEqual(toRemotePhotoUpdate({ album: 'New', content: '', placeId: '' }), {
    album: 'New', content: null, place_id: null,
  });
});
