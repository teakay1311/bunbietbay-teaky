import type { TripNotificationPreferences, UserPreferences } from '../domain/models';

export function readStoredTripPreferences(storageKey: string, storage: Pick<Storage, 'getItem'> = localStorage): Record<string, TripNotificationPreferences> {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function mapRemoteUserPreferences(row: Record<string, unknown>, fallbackThemePresetId: string): UserPreferences {
  return {
    themeMode: row.theme_mode === 'light' || row.theme_mode === 'dark' ? row.theme_mode : 'system',
    themePresetId: typeof row.theme_preset_id === 'string' ? row.theme_preset_id : fallbackThemePresetId,
    uiDensity: row.ui_density === 'compact' ? 'compact' : 'cozy',
    isPrivacyMode: Boolean(row.is_privacy_mode),
    remindersEnabled: row.reminders_enabled !== false,
    activityLeadMinutes: Number(row.activity_lead_minutes) || 120,
    tripStartLeadMinutes: Number(row.trip_start_lead_minutes) || 1440,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
}

export function mapRemoteTripPreferences(rows: Record<string, unknown>[]) {
  return Object.fromEntries(rows.flatMap((row) => {
    if (typeof row.trip_id !== 'string' || typeof row.user_id !== 'string') return [];
    return [[row.trip_id, {
      tripId: row.trip_id,
      userId: row.user_id,
      useDefaults: row.use_defaults !== false,
      enabled: typeof row.enabled === 'boolean' ? row.enabled : undefined,
      activityLeadMinutes: typeof row.activity_lead_minutes === 'number' ? row.activity_lead_minutes : undefined,
      tripStartLeadMinutes: typeof row.trip_start_lead_minutes === 'number' ? row.trip_start_lead_minutes : undefined,
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    } satisfies TripNotificationPreferences]];
  })) as Record<string, TripNotificationPreferences>;
}

export function toRemoteUserPreferences(userId: string, preferences: UserPreferences) {
  return {
    user_id: userId,
    theme_mode: preferences.themeMode,
    theme_preset_id: preferences.themePresetId,
    ui_density: preferences.uiDensity,
    is_privacy_mode: preferences.isPrivacyMode,
    reminders_enabled: preferences.remindersEnabled,
    activity_lead_minutes: preferences.activityLeadMinutes,
    trip_start_lead_minutes: preferences.tripStartLeadMinutes,
    ...(preferences.updatedAt ? { updated_at: preferences.updatedAt } : {}),
  };
}

export function toRemoteTripPreferences(preferences: TripNotificationPreferences) {
  return {
    trip_id: preferences.tripId,
    user_id: preferences.userId,
    use_defaults: preferences.useDefaults,
    enabled: preferences.enabled ?? null,
    activity_lead_minutes: preferences.activityLeadMinutes ?? null,
    trip_start_lead_minutes: preferences.tripStartLeadMinutes ?? null,
    updated_at: preferences.updatedAt,
  };
}
