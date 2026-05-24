import type { ActivityLogEntry, PersistedAppState, Photo, TripMembership, TripRecord, TripInvitation } from '../context/AppContext';
import type { UserProfile } from '../context/AuthContext';

export const APP_STATE_VERSION = 4;

type LegacyState = {
  version?: number;
  baseTrips?: Array<TripRecord & { memberIds?: string[] }>;
  members?: Array<{
    id: string;
    name: string;
    avatar: string;
    role?: string;
    phone?: string;
    email?: string;
    birthdate?: string;
  }>;
  activities?: PersistedAppState['activities'];
  expenses?: PersistedAppState['expenses'];
  savedPlaces?: PersistedAppState['savedPlaces'];
  packingItems?: PersistedAppState['packingItems'];
  photos?: PersistedAppState['photos'];
  activityLogs?: PersistedAppState['activityLogs'];
  currentTripId?: string | null;
  profiles?: UserProfile[];
  trips?: TripRecord[];
  memberships?: TripMembership[];
  invitations?: TripInvitation[];
  viewerProfileId?: string | null;
  pinnedTripIds?: string[];
};

function inferPhotoStorage(url: string): Photo['storage'] {
  return url.startsWith('data:') ? 'embedded' : 'remote';
}

function inferPhotoProvider(url: string): Photo['provider'] {
  return url.includes('res.cloudinary.com') ? 'cloudinary' : undefined;
}

function migratePhotos(photos: Photo[] | undefined): Photo[] {
  return ensureArray(photos, []).map((photo, index) => ({
    ...photo,
    createdAt: photo.createdAt ?? new Date(Date.UTC(2024, 0, 1, 0, 0, index)).toISOString(),
    updatedAt: photo.updatedAt ?? photo.createdAt ?? new Date(Date.UTC(2024, 0, 1, 0, 0, index)).toISOString(),
    storage: photo.storage ?? inferPhotoStorage(photo.url),
    provider: photo.provider ?? inferPhotoProvider(photo.url),
    people: photo.people ?? [],
    tags: photo.tags ?? [],
  }));
}

function ensureArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? value as T[] : fallback;
}

function fallbackTimestamp(index: number) {
  return new Date(Date.UTC(2024, 0, 1, 0, 0, index)).toISOString();
}

function withTimestamps<T extends { createdAt?: string; updatedAt?: string }>(items: T[] | undefined): T[] {
  return ensureArray(items, []).map((item, index) => {
    const createdAt = item.createdAt ?? fallbackTimestamp(index);
    return {
      ...item,
      createdAt,
      updatedAt: item.updatedAt ?? createdAt,
    };
  });
}

function migrateLegacyProfiles(state: LegacyState): UserProfile[] {
  if (state.profiles?.length) {
    return state.profiles;
  }

  return (state.members ?? []).map((member) => ({
    id: member.id,
    email: member.email ?? `${member.id}@local.bunbietbay`,
    displayName: member.name,
    avatar: member.avatar,
    phone: member.phone,
    birthdate: member.birthdate,
  }));
}

function migrateLegacyTrips(state: LegacyState): TripRecord[] {
  if (state.trips?.length) {
    return state.trips;
  }

  return (state.baseTrips ?? []).map((trip) => ({
    id: trip.id,
    title: trip.title,
    location: trip.location,
    startDate: trip.startDate,
    endDate: trip.endDate,
    budget: trip.budget,
    baseCurrency: trip.baseCurrency,
    status: trip.status,
    image: trip.image,
    themeColor: trip.themeColor,
    review: trip.review,
    createdBy: trip.createdBy ?? trip.memberIds?.[0] ?? undefined,
  }));
}

function migrateLegacyMemberships(state: LegacyState): TripMembership[] {
  if (state.memberships?.length) {
    return state.memberships;
  }

  return (state.baseTrips ?? []).flatMap((trip) => {
    const memberIds = trip.memberIds ?? [];
    return memberIds.map((memberId, index) => ({
      id: `legacy-${trip.id}-${memberId}`,
      tripId: trip.id,
      userId: memberId,
      role: index === 0 ? 'owner' : 'editor',
    }));
  });
}

export function migratePersistedState(
  state: Partial<PersistedAppState> | LegacyState | null | undefined,
): Partial<PersistedAppState> | null {
  if (!state) {
    return null;
  }

  const legacyState = state as LegacyState;

  return {
    version: APP_STATE_VERSION,
    trips: withTimestamps(migrateLegacyTrips(legacyState)),
    profiles: migrateLegacyProfiles(legacyState),
    memberships: migrateLegacyMemberships(legacyState),
    invitations: legacyState.invitations ?? [],
    activities: withTimestamps(legacyState.activities),
    expenses: withTimestamps(legacyState.expenses),
    savedPlaces: withTimestamps(legacyState.savedPlaces),
    packingItems: withTimestamps(legacyState.packingItems),
    photos: migratePhotos(legacyState.photos),
    activityLogs: withTimestamps(legacyState.activityLogs),
    currentTripId: legacyState.currentTripId ?? null,
    viewerProfileId: legacyState.viewerProfileId ?? legacyState.members?.[0]?.id ?? legacyState.profiles?.[0]?.id ?? null,
    pinnedTripIds: legacyState.pinnedTripIds ?? [],
  };
}

export function normalizePersistedState(
  state: Partial<PersistedAppState> | LegacyState | null | undefined,
  fallback: PersistedAppState,
): PersistedAppState {
  const migratedState = migratePersistedState(state);

  return {
    version: migratedState?.version ?? APP_STATE_VERSION,
    trips: ensureArray(migratedState?.trips, fallback.trips),
    profiles: ensureArray(migratedState?.profiles, fallback.profiles),
    memberships: ensureArray(migratedState?.memberships, fallback.memberships),
    invitations: ensureArray(migratedState?.invitations, fallback.invitations),
    activities: ensureArray(migratedState?.activities, fallback.activities),
    expenses: ensureArray(migratedState?.expenses, fallback.expenses),
    savedPlaces: ensureArray(migratedState?.savedPlaces, fallback.savedPlaces),
    packingItems: ensureArray(migratedState?.packingItems, fallback.packingItems),
    photos: ensureArray(migratedState?.photos, fallback.photos),
    activityLogs: ensureArray(migratedState?.activityLogs, fallback.activityLogs),
    currentTripId: typeof migratedState?.currentTripId === 'string' || migratedState?.currentTripId === null
      ? migratedState.currentTripId
      : fallback.currentTripId,
    viewerProfileId: typeof migratedState?.viewerProfileId === 'string' || migratedState?.viewerProfileId === null
      ? migratedState.viewerProfileId
      : fallback.viewerProfileId,
    pinnedTripIds: ensureArray(migratedState?.pinnedTripIds, fallback.pinnedTripIds ?? []),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidTripRecord(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.location === 'string'
    && typeof value.startDate === 'string'
    && typeof value.endDate === 'string'
    && typeof value.budget === 'number'
    && typeof value.status === 'string'
    && typeof value.image === 'string';
}

function isValidProfile(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.email === 'string'
    && typeof value.displayName === 'string'
    && typeof value.avatar === 'string';
}

function isValidMembership(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.userId === 'string'
    && typeof value.role === 'string';
}

function isValidInvitation(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.email === 'string'
    && typeof value.role === 'string'
    && typeof value.status === 'string'
    && typeof value.invitedBy === 'string'
    && typeof value.createdAt === 'string';
}

function isValidActivity(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.date === 'string'
    && typeof value.time === 'string'
    && typeof value.title === 'string'
    && typeof value.location === 'string'
    && typeof value.note === 'string'
    && typeof value.type === 'string';
}

function isValidExpense(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.date === 'string'
    && typeof value.time === 'string'
    && typeof value.title === 'string'
    && typeof value.category === 'string'
    && typeof value.amount === 'number'
    && typeof value.paidBy === 'string'
    && isStringArray(value.participants);
}

function isValidSavedPlace(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.name === 'string'
    && typeof value.type === 'string';
}

function isValidPackingItem(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.name === 'string'
    && typeof value.isPacked === 'boolean'
    && typeof value.category === 'string';
}

function isValidPhoto(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.url === 'string'
    && typeof value.album === 'string';
}

function isValidActivityLog(value: unknown): value is ActivityLogEntry {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.action === 'string'
    && typeof value.entityType === 'string'
    && typeof value.summary === 'string'
    && typeof value.createdAt === 'string';
}

export function validateImportedSnapshot(state: Partial<PersistedAppState>) {
  const checks: Array<[keyof PersistedAppState, (value: unknown) => boolean]> = [
    ['trips', isValidTripRecord],
    ['profiles', isValidProfile],
    ['memberships', isValidMembership],
    ['invitations', isValidInvitation],
    ['activities', isValidActivity],
    ['expenses', isValidExpense],
    ['savedPlaces', isValidSavedPlace],
    ['packingItems', isValidPackingItem],
    ['photos', isValidPhoto],
    ['activityLogs', isValidActivityLog],
  ];

  for (const [field, validator] of checks) {
    const value = state[field];
    if (value === undefined) {
      continue;
    }
    if (!Array.isArray(value)) {
      throw new Error(`Backup không đúng định dạng: ${String(field)} phải là mảng.`);
    }
    if (!(value as unknown[]).every(validator)) {
      throw new Error(`Backup chứa dữ liệu không hợp lệ trong ${String(field)}.`);
    }
  }

  if (state.currentTripId !== undefined && state.currentTripId !== null && typeof state.currentTripId !== 'string') {
    throw new Error('Backup không hợp lệ: currentTripId phải là chuỗi hoặc null.');
  }
  if (state.viewerProfileId !== undefined && state.viewerProfileId !== null && typeof state.viewerProfileId !== 'string') {
    throw new Error('Backup không hợp lệ: viewerProfileId phải là chuỗi hoặc null.');
  }
}
