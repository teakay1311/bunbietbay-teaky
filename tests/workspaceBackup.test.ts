import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceBackupV8, prepareWorkspaceBackup } from '../src/utils/workspaceBackup';
import { EMPTY_PERSISTED_STATE } from '../src/utils/appState';

const preferences = { themeMode: 'system' as const, themePresetId: 'teal-editorial', uiDensity: 'cozy' as const, isPrivacyMode: false, remindersEnabled: true, activityLeadMinutes: 120, tripStartLeadMinutes: 1440 };
const timestamp = '2026-01-01T00:00:00.000Z';

test('accepts a complete workspace backup v8', () => {
  const backup = createWorkspaceBackupV8({ workspace: EMPTY_PERSISTED_STATE, library: { notebooks: [{ id: 'local', name: 'Cá nhân', type: 'personal' }], places: [{ id: 'place', notebookId: 'local', name: 'Huế', type: 'other', rating: 5, createdAt: timestamp, updatedAt: timestamp }] }, preferences, tripNotificationPreferences: [] });
  assert.equal(prepareWorkspaceBackup(backup).library?.places[0].name, 'Huế');
});

test('rejects orphaned library places in workspace backup v8', () => {
  const backup = createWorkspaceBackupV8({ workspace: EMPTY_PERSISTED_STATE, library: { notebooks: [], places: [{ id: 'place', notebookId: 'missing', name: 'Huế', type: 'other', rating: 5, createdAt: timestamp, updatedAt: timestamp }] }, preferences, tripNotificationPreferences: [] });
  assert.throws(() => prepareWorkspaceBackup(backup), /không tồn tại/i);
});

test('rejects a trip place linked to a missing library place in v7', () => {
  const workspace = structuredClone(EMPTY_PERSISTED_STATE);
  workspace.profiles.push({ id: 'user', email: 'user@example.com', displayName: 'User', avatar: 'https://example.com/avatar.png' });
  workspace.trips.push({ id: 'trip', title: 'Huế', location: 'Huế', startDate: '2026-01-01', endDate: '2026-01-02', budget: 1000, status: 'upcoming', image: '', createdBy: 'user' });
  workspace.memberships.push({ id: 'membership', tripId: 'trip', userId: 'user', role: 'owner' });
  workspace.viewerProfileId = 'user';
  workspace.currentTripId = 'trip';
  workspace.savedPlaces.push({ id: 'trip-place', tripId: 'trip', name: 'Huế', type: 'other', rating: 5, sourceNotebookPlaceId: 'missing-library-place' });
  const backup = createWorkspaceBackupV8({ workspace, library: { notebooks: [], places: [] }, preferences, tripNotificationPreferences: [] });
  assert.throws(() => prepareWorkspaceBackup(backup), /Thư viện không tồn tại/i);
});
