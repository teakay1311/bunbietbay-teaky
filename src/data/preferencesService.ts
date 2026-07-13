import type { AppBackgroundPreference, TripNotificationPreferences, UserPreferences } from '../domain/models';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeAppBackgroundPreference(value: unknown): AppBackgroundPreference {
  if (!isRecord(value) || value.source === 'none') return { source: 'none' };
  if (value.source === 'library' && typeof value.photoId === 'string' && value.photoId.trim()) {
    return { source: 'library', photoId: value.photoId };
  }
  if (value.source === 'upload') {
    const imageUrl = isHttpsUrl(value.imageUrl) ? value.imageUrl : '';
    const localMediaKey = typeof value.localMediaKey === 'string' && value.localMediaKey.trim() ? value.localMediaKey : undefined;
    if (!imageUrl && !localMediaKey) return { source: 'none' };
    return {
      source: 'upload',
      imageUrl,
      ...(typeof value.providerPublicId === 'string' && value.providerPublicId.trim() ? { providerPublicId: value.providerPublicId } : {}),
      ...(localMediaKey ? { localMediaKey } : {}),
    };
  }
  return { source: 'none' };
}

export function readStoredAppBackground(storage: Pick<Storage, 'getItem'> = localStorage): AppBackgroundPreference {
  try {
    return normalizeAppBackgroundPreference(JSON.parse(storage.getItem('appBackground') ?? 'null'));
  } catch {
    return { source: 'none' };
  }
}

export function readStoredTripPreferences(storageKey: string, storage: Pick<Storage, 'getItem'> = localStorage): Record<string, TripNotificationPreferences> {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function mapRemoteUserPreferences(row: Record<string, unknown>, fallbackThemePresetId: string): UserPreferences {
  const appBackground = normalizeAppBackgroundPreference({
    source: row.background_source,
    photoId: row.background_photo_id,
    imageUrl: row.background_image_url,
    providerPublicId: row.background_provider_public_id,
  });
  return {
    themeMode: row.theme_mode === 'light' || row.theme_mode === 'dark' ? row.theme_mode : 'system',
    themePresetId: typeof row.theme_preset_id === 'string' ? row.theme_preset_id : fallbackThemePresetId,
    uiDensity: row.ui_density === 'compact' ? 'compact' : 'cozy',
    appBackground,
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
  const background = normalizeAppBackgroundPreference(preferences.appBackground);
  const remoteBackground = background.source === 'upload' && !background.imageUrl ? { source: 'none' as const } : background;
  return {
    user_id: userId,
    theme_mode: preferences.themeMode,
    theme_preset_id: preferences.themePresetId,
    ui_density: preferences.uiDensity,
    background_source: remoteBackground.source,
    background_photo_id: remoteBackground.source === 'library' ? remoteBackground.photoId : null,
    background_image_url: remoteBackground.source === 'upload' ? remoteBackground.imageUrl : null,
    background_provider_public_id: remoteBackground.source === 'upload' ? remoteBackground.providerPublicId ?? null : null,
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
