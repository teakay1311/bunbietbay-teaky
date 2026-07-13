import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTripReminders } from '../src/domain/notificationPreferences';

const defaults = { enabled: true, activityLeadMinutes: 120, tripStartLeadMinutes: 1440 };

test('uses account reminder defaults until a trip overrides them', () => {
  assert.deepEqual(resolveTripReminders(defaults), { ...defaults, usesDefaults: true });
  assert.deepEqual(resolveTripReminders(defaults, { tripId: 't1', userId: 'u1', useDefaults: false, enabled: false, activityLeadMinutes: 30 }), { enabled: false, activityLeadMinutes: 30, tripStartLeadMinutes: 1440, usesDefaults: false });
});
