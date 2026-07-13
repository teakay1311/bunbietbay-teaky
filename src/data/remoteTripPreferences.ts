const REMOTE_PINNED_TRIPS_KEY = 'bunbietbay-remote-pinned-trip-ids';

export function readRemotePinnedTripIds(userId: string) {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(REMOTE_PINNED_TRIPS_KEY);
    if (!rawValue) return [];
    const storedValue = JSON.parse(rawValue) as Record<string, unknown>;
    const pinnedTripIds = storedValue[userId];
    return Array.isArray(pinnedTripIds) ? pinnedTripIds.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    console.warn('Failed to read remote pinned trips preference', error);
    return [];
  }
}

export function writeRemotePinnedTripIds(userId: string, pinnedTripIds: string[]) {
  if (typeof window === 'undefined') return;

  try {
    const rawValue = window.localStorage.getItem(REMOTE_PINNED_TRIPS_KEY);
    const storedValue = rawValue ? JSON.parse(rawValue) as Record<string, unknown> : {};
    storedValue[userId] = pinnedTripIds;
    window.localStorage.setItem(REMOTE_PINNED_TRIPS_KEY, JSON.stringify(storedValue));
  } catch (error) {
    console.warn('Failed to save remote pinned trips preference', error);
  }
}
