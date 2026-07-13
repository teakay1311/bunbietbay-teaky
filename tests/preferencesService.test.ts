import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRemoteTripPreferences, mapRemoteUserPreferences, toRemoteTripPreferences, toRemoteUserPreferences } from '../src/data/preferencesService';

test('maps remote preferences to safe domain defaults', () => {
  assert.deepEqual(mapRemoteUserPreferences({ theme_mode: 'invalid', activity_lead_minutes: '30' }, 'teal'), {
    themeMode: 'system', themePresetId: 'teal', uiDensity: 'cozy', isPrivacyMode: false,
    appBackground: { source: 'none' },
    remindersEnabled: true, activityLeadMinutes: 30, tripStartLeadMinutes: 1440, updatedAt: undefined,
  });
  assert.deepEqual(mapRemoteTripPreferences([{ trip_id: 't1', user_id: 'u1', use_defaults: false, enabled: true }]).t1, {
    tripId: 't1', userId: 'u1', useDefaults: false, enabled: true,
    activityLeadMinutes: undefined, tripStartLeadMinutes: undefined, updatedAt: undefined,
  });
});

test('maps preference domain values back to the existing Supabase columns', () => {
  const userPayload = toRemoteUserPreferences('u1', {
    themeMode: 'dark', themePresetId: 'ocean', uiDensity: 'compact', isPrivacyMode: true,
    appBackground: { source: 'library', photoId: 'photo-1' },
    remindersEnabled: false, activityLeadMinutes: 60, tripStartLeadMinutes: 720,
  });
  assert.equal(userPayload.theme_mode, 'dark');
  assert.equal(userPayload.user_id, 'u1');
  assert.equal(userPayload.background_source, 'library');
  assert.equal(userPayload.background_photo_id, 'photo-1');
  assert.deepEqual(toRemoteTripPreferences({ tripId: 't1', userId: 'u1', useDefaults: true }), {
    trip_id: 't1', user_id: 'u1', use_defaults: true, enabled: null,
    activity_lead_minutes: null, trip_start_lead_minutes: null, updated_at: undefined,
  });
});

test('accepts HTTPS uploaded backgrounds and never syncs device-only blob keys', () => {
  const remote = mapRemoteUserPreferences({ background_source: 'upload', background_image_url: 'https://res.cloudinary.com/demo/image/upload/background.webp', background_provider_public_id: 'background' }, 'teal');
  assert.deepEqual(remote.appBackground, { source: 'upload', imageUrl: 'https://res.cloudinary.com/demo/image/upload/background.webp', providerPublicId: 'background' });

  const payload = toRemoteUserPreferences('u1', {
    themeMode: 'light', themePresetId: 'teal', uiDensity: 'cozy', isPrivacyMode: false,
    appBackground: { source: 'upload', imageUrl: '', localMediaKey: 'device-only' },
    remindersEnabled: true, activityLeadMinutes: 120, tripStartLeadMinutes: 1440,
  });
  assert.equal(payload.background_source, 'none');
  assert.equal(payload.background_image_url, null);
});
