import type { TripNotificationPreferences } from './models';

export type ReminderDefaults = { enabled: boolean; activityLeadMinutes: number; tripStartLeadMinutes: number };

export function resolveTripReminders(defaults: ReminderDefaults, override?: TripNotificationPreferences) {
  if (!override || override.useDefaults) return { ...defaults, usesDefaults: true };
  return {
    enabled: override.enabled ?? defaults.enabled,
    activityLeadMinutes: override.activityLeadMinutes ?? defaults.activityLeadMinutes,
    tripStartLeadMinutes: override.tripStartLeadMinutes ?? defaults.tripStartLeadMinutes,
    usesDefaults: false,
  };
}
