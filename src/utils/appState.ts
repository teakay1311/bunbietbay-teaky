import type { ActivityLogEntry, PersistedAppState, Photo, TripMembership, TripRecord, TripInvitation } from '../context/AppContext';
import type { UserProfile } from '../context/AuthContext';

export const APP_STATE_VERSION = 7;

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
  collaborationSettings?: PersistedAppState['collaborationSettings'];
  tasks?: PersistedAppState['tasks'];
  polls?: PersistedAppState['polls'];
  pollOptions?: PersistedAppState['pollOptions'];
  pollVotes?: PersistedAppState['pollVotes'];
  comments?: PersistedAppState['comments'];
  notifications?: PersistedAppState['notifications'];
  offlineMutations?: PersistedAppState['offlineMutations'];
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
  return ensureArray<Photo>(photos, []).map((photo, index) => ({
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

function hasOwnField<T extends object>(value: T | null | undefined, field: PropertyKey) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, field));
}

function fallbackTimestamp(index: number) {
  return new Date(Date.UTC(2024, 0, 1, 0, 0, index)).toISOString();
}

function withTimestamps<T extends { createdAt?: string; updatedAt?: string }>(items: T[] | undefined): T[] {
  return ensureArray<T>(items, []).map((item, index) => {
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

export function buildDuplicatedMembershipRoles(memberships: TripMembership[], tripId: string, creatorId: string) {
  return [
    { userId: creatorId, role: 'owner' as const },
    ...memberships
      .filter((membership) => membership.tripId === tripId && !membership.revokedAt && membership.userId !== creatorId)
      .map((membership) => ({
        userId: membership.userId,
        role: membership.role === 'owner' ? 'admin' as const : membership.role,
      })),
  ];
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
    collaborationSettings: legacyState.collaborationSettings ?? [],
    tasks: withTimestamps(legacyState.tasks),
    polls: withTimestamps(legacyState.polls),
    pollOptions: legacyState.pollOptions ?? [],
    pollVotes: legacyState.pollVotes ?? [],
    comments: withTimestamps(legacyState.comments),
    notifications: legacyState.notifications ?? [],
    offlineMutations: legacyState.offlineMutations ?? [],
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
  const sourceState = state as LegacyState | null | undefined;
  const hasTrips = hasOwnField(sourceState, 'trips') || hasOwnField(sourceState, 'baseTrips');
  const hasProfiles = hasOwnField(sourceState, 'profiles') || hasOwnField(sourceState, 'members');
  const hasMemberships = hasOwnField(sourceState, 'memberships') || hasOwnField(sourceState, 'baseTrips');
  const hasViewerProfileId = hasOwnField(sourceState, 'viewerProfileId') || (hasOwnField(sourceState, 'members') && !hasOwnField(sourceState, 'profiles'));

  return {
    version: migratedState?.version ?? APP_STATE_VERSION,
    trips: hasTrips ? ensureArray(migratedState?.trips, fallback.trips) : fallback.trips,
    profiles: hasProfiles ? ensureArray(migratedState?.profiles, fallback.profiles) : fallback.profiles,
    memberships: hasMemberships ? ensureArray(migratedState?.memberships, fallback.memberships) : fallback.memberships,
    invitations: hasOwnField(sourceState, 'invitations') ? ensureArray(migratedState?.invitations, fallback.invitations) : fallback.invitations,
    activities: hasOwnField(sourceState, 'activities') ? ensureArray(migratedState?.activities, fallback.activities) : fallback.activities,
    expenses: hasOwnField(sourceState, 'expenses') ? ensureArray(migratedState?.expenses, fallback.expenses) : fallback.expenses,
    savedPlaces: hasOwnField(sourceState, 'savedPlaces') ? ensureArray(migratedState?.savedPlaces, fallback.savedPlaces) : fallback.savedPlaces,
    packingItems: hasOwnField(sourceState, 'packingItems') ? ensureArray(migratedState?.packingItems, fallback.packingItems) : fallback.packingItems,
    photos: hasOwnField(sourceState, 'photos') ? ensureArray(migratedState?.photos, fallback.photos) : fallback.photos,
    collaborationSettings: hasOwnField(sourceState, 'collaborationSettings') ? ensureArray(migratedState?.collaborationSettings, fallback.collaborationSettings) : fallback.collaborationSettings,
    tasks: hasOwnField(sourceState, 'tasks') ? ensureArray(migratedState?.tasks, fallback.tasks) : fallback.tasks,
    polls: hasOwnField(sourceState, 'polls') ? ensureArray(migratedState?.polls, fallback.polls) : fallback.polls,
    pollOptions: hasOwnField(sourceState, 'pollOptions') ? ensureArray(migratedState?.pollOptions, fallback.pollOptions) : fallback.pollOptions,
    pollVotes: hasOwnField(sourceState, 'pollVotes') ? ensureArray(migratedState?.pollVotes, fallback.pollVotes) : fallback.pollVotes,
    comments: hasOwnField(sourceState, 'comments') ? ensureArray(migratedState?.comments, fallback.comments) : fallback.comments,
    notifications: hasOwnField(sourceState, 'notifications') ? ensureArray(migratedState?.notifications, fallback.notifications) : fallback.notifications,
    offlineMutations: hasOwnField(sourceState, 'offlineMutations') ? ensureArray(migratedState?.offlineMutations, fallback.offlineMutations) : fallback.offlineMutations,
    activityLogs: hasOwnField(sourceState, 'activityLogs') ? ensureArray(migratedState?.activityLogs, fallback.activityLogs) : fallback.activityLogs,
    currentTripId: hasOwnField(sourceState, 'currentTripId') && (typeof migratedState?.currentTripId === 'string' || migratedState?.currentTripId === null)
      ? migratedState.currentTripId
      : fallback.currentTripId,
    viewerProfileId: hasViewerProfileId && (typeof migratedState?.viewerProfileId === 'string' || migratedState?.viewerProfileId === null)
      ? migratedState.viewerProfileId
      : fallback.viewerProfileId,
    pinnedTripIds: hasOwnField(sourceState, 'pinnedTripIds') ? ensureArray(migratedState?.pinnedTripIds, fallback.pinnedTripIds ?? []) : fallback.pinnedTripIds ?? [],
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
    && typeof value.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.startDate)
    && typeof value.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.endDate) && value.startDate <= value.endDate
    && typeof value.budget === 'number' && Number.isFinite(value.budget) && value.budget > 0
    && (value.status === 'upcoming' || value.status === 'completed' || value.status === 'draft')
    && typeof value.image === 'string'
    && (value.createdBy === undefined || typeof value.createdBy === 'string');
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
    && (value.role === 'owner' || value.role === 'admin' || value.role === 'editor' || value.role === 'viewer')
    && (value.revokedAt === undefined || typeof value.revokedAt === 'string');
}

function isValidInvitation(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.email === 'string'
    && (value.role === 'admin' || value.role === 'editor' || value.role === 'viewer')
    && (value.status === 'pending' || value.status === 'accepted' || value.status === 'declined' || value.status === 'revoked')
    && typeof value.invitedBy === 'string'
    && typeof value.createdAt === 'string'
    && (value.acceptedBy === undefined || typeof value.acceptedBy === 'string');
}

function isValidActivity(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && typeof value.time === 'string'
    && typeof value.title === 'string'
    && typeof value.location === 'string'
    && typeof value.note === 'string'
    && typeof value.type === 'string'
    && (value.placeId === undefined || typeof value.placeId === 'string');
}

function isValidExpense(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && typeof value.time === 'string'
    && typeof value.title === 'string'
    && typeof value.category === 'string'
    && typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0
    && typeof value.paidBy === 'string'
    && isStringArray(value.participants)
    && (value.activityId === undefined || typeof value.activityId === 'string')
    && (value.placeId === undefined || typeof value.placeId === 'string');
}

function isValidSavedPlace(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.name === 'string'
    && typeof value.type === 'string'
    && (value.sourceNotebookPlaceId === undefined || typeof value.sourceNotebookPlaceId === 'string');
}

function isValidPackingItem(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.name === 'string'
    && typeof value.isPacked === 'boolean'
    && typeof value.category === 'string'
    && (value.assigneeId === undefined || typeof value.assigneeId === 'string');
}

function isValidPhoto(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.url === 'string'
    && typeof value.album === 'string'
    && (value.people === undefined || isStringArray(value.people))
    && (value.tags === undefined || isStringArray(value.tags))
    && (value.activityId === undefined || typeof value.activityId === 'string')
    && (value.placeId === undefined || typeof value.placeId === 'string');
}

function isValidCollaborationSettings(value: unknown) {
  return isRecord(value)
    && typeof value.tripId === 'string'
    && typeof value.viewerCanVote === 'boolean'
    && typeof value.viewerCanComment === 'boolean'
    && typeof value.viewerCanUpdateAssignedTasks === 'boolean';
}

function isValidTask(value: unknown) {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.title === 'string'
    && ['todo', 'in_progress', 'done'].includes(String(value.status))
    && ['low', 'normal', 'high'].includes(String(value.priority))
    && typeof value.createdBy === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string';
}

function isValidPoll(value: unknown) {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.tripId === 'string'
    && typeof value.question === 'string'
    && ['place', 'hotel', 'restaurant', 'time', 'custom'].includes(String(value.kind))
    && ['single', 'multiple'].includes(String(value.selectionMode))
    && ['open', 'closed'].includes(String(value.status))
    && typeof value.createdBy === 'string';
}

function isValidPollOption(value: unknown) {
  return isRecord(value) && typeof value.id === 'string' && typeof value.pollId === 'string'
    && typeof value.tripId === 'string' && typeof value.label === 'string' && typeof value.createdAt === 'string';
}

function isValidPollVote(value: unknown) {
  return isRecord(value) && typeof value.id === 'string' && typeof value.pollId === 'string'
    && typeof value.optionId === 'string' && typeof value.tripId === 'string'
    && typeof value.userId === 'string' && typeof value.createdAt === 'string';
}

function isValidComment(value: unknown) {
  return isRecord(value) && typeof value.id === 'string' && typeof value.tripId === 'string'
    && ['activity', 'expense', 'place', 'photo', 'task', 'poll'].includes(String(value.targetType))
    && typeof value.targetId === 'string' && typeof value.authorId === 'string'
    && typeof value.body === 'string' && isStringArray(value.mentionedUserIds)
    && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string';
}

function isValidNotification(value: unknown) {
  return isRecord(value) && typeof value.id === 'string' && typeof value.tripId === 'string'
    && typeof value.recipientId === 'string' && typeof value.eventKey === 'string'
    && typeof value.title === 'string' && typeof value.createdAt === 'string';
}

function isValidOfflineMutation(value: unknown) {
  return isRecord(value) && typeof value.id === 'string' && typeof value.entityId === 'string'
    && typeof value.tripId === 'string' && ['create', 'update', 'delete'].includes(String(value.action))
    && ['pending', 'failed', 'conflict'].includes(String(value.status)) && isRecord(value.payload)
    && typeof value.createdAt === 'string';
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

function assertUniqueIds(field: string, items: Array<{ id: string }>) {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error(`Backup chứa ID trùng trong ${field}.`);
  }
}

export function validateImportedSnapshot(state: Partial<PersistedAppState>): asserts state is PersistedAppState {
  const requiredFields: Array<keyof PersistedAppState> = [
    'version', 'trips', 'profiles', 'memberships', 'invitations', 'activities', 'expenses',
    'savedPlaces', 'packingItems', 'photos', 'collaborationSettings', 'tasks', 'polls', 'pollOptions',
    'pollVotes', 'comments', 'notifications', 'offlineMutations', 'activityLogs', 'currentTripId', 'viewerProfileId',
  ];
  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(state, field)) {
      throw new Error(`Backup không đầy đủ: thiếu ${String(field)}.`);
    }
  }
  if (state.version !== APP_STATE_VERSION) {
    throw new Error(`Backup không hợp lệ: phiên bản phải là ${APP_STATE_VERSION}.`);
  }

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
    ['collaborationSettings', isValidCollaborationSettings],
    ['tasks', isValidTask],
    ['polls', isValidPoll],
    ['pollOptions', isValidPollOption],
    ['pollVotes', isValidPollVote],
    ['comments', isValidComment],
    ['notifications', isValidNotification],
    ['offlineMutations', isValidOfflineMutation],
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
  if (state.pinnedTripIds !== undefined && !isStringArray(state.pinnedTripIds)) {
    throw new Error('Backup không hợp lệ: pinnedTripIds phải là mảng chuỗi.');
  }

  const snapshot = state as PersistedAppState;
  for (const [field, items] of checks.map(([field]) => [field, snapshot[field]] as const)) {
    assertUniqueIds(String(field), items as Array<{ id: string }>);
  }

  const tripIds = new Set(snapshot.trips.map((trip) => trip.id));
  const profileIds = new Set(snapshot.profiles.map((profile) => profile.id));
  if (snapshot.trips.some((trip) => trip.createdBy && !profileIds.has(trip.createdBy))) {
    throw new Error('Backup chứa chuyến đi không liên kết với hồ sơ người tạo hợp lệ.');
  }
  const membershipKeys = new Set<string>();
  for (const membership of snapshot.memberships) {
    if (!tripIds.has(membership.tripId) || !profileIds.has(membership.userId)) {
      throw new Error('Backup chứa membership không liên kết với chuyến đi hoặc hồ sơ hợp lệ.');
    }
    const key = `${membership.tripId}:${membership.userId}`;
    if (membershipKeys.has(key)) {
      throw new Error('Backup chứa membership trùng người trong cùng chuyến đi.');
    }
    membershipKeys.add(key);
  }

  const assertTripLink = (tripId: string, field: string) => {
    if (!tripIds.has(tripId)) throw new Error(`Backup chứa ${field} không liên kết với chuyến đi hợp lệ.`);
  };
  snapshot.invitations.forEach((invitation) => {
    assertTripLink(invitation.tripId, 'lời mời');
    if (!profileIds.has(invitation.invitedBy) || (invitation.acceptedBy && !profileIds.has(invitation.acceptedBy))) {
      throw new Error('Backup chứa lời mời không liên kết với hồ sơ hợp lệ.');
    }
  });
  const activityMap = new Map(snapshot.activities.map((activity) => [activity.id, activity]));
  const placeMap = new Map(snapshot.savedPlaces.map((place) => [place.id, place]));
  snapshot.savedPlaces.forEach((place) => assertTripLink(place.tripId, 'địa điểm'));
  snapshot.activities.forEach((activity) => {
    assertTripLink(activity.tripId, 'hoạt động');
    if (activity.placeId && placeMap.get(activity.placeId)?.tripId !== activity.tripId) {
      throw new Error('Backup chứa hoạt động liên kết với địa điểm không hợp lệ.');
    }
  });
  snapshot.photos.forEach((photo) => {
    assertTripLink(photo.tripId, 'ảnh');
    if (photo.activityId && activityMap.get(photo.activityId)?.tripId !== photo.tripId) {
      throw new Error('Backup chứa ảnh liên kết với hoạt động không hợp lệ.');
    }
    if (photo.placeId && placeMap.get(photo.placeId)?.tripId !== photo.tripId) {
      throw new Error('Backup chứa ảnh liên kết với địa điểm không hợp lệ.');
    }
  });
  snapshot.activityLogs.forEach((log) => {
    assertTripLink(log.tripId, 'nhật ký');
    if (log.actorId && !profileIds.has(log.actorId)) throw new Error('Backup chứa nhật ký không liên kết với hồ sơ hợp lệ.');
  });
  snapshot.expenses.forEach((expense) => {
    assertTripLink(expense.tripId, 'chi tiêu');
    if (!membershipKeys.has(`${expense.tripId}:${expense.paidBy}`)
      || expense.participants.some((participantId) => !membershipKeys.has(`${expense.tripId}:${participantId}`))) {
      throw new Error('Backup chứa chi tiêu không liên kết với thành viên hợp lệ.');
    }
    if (expense.activityId && activityMap.get(expense.activityId)?.tripId !== expense.tripId) {
      throw new Error('Backup chứa chi tiêu liên kết với hoạt động không hợp lệ.');
    }
    if (expense.placeId && placeMap.get(expense.placeId)?.tripId !== expense.tripId) {
      throw new Error('Backup chứa chi tiêu liên kết với địa điểm không hợp lệ.');
    }
  });
  snapshot.packingItems.forEach((item) => {
    assertTripLink(item.tripId, 'hành lý');
    if (item.assigneeId && !membershipKeys.has(`${item.tripId}:${item.assigneeId}`)) {
      throw new Error('Backup chứa hành lý không liên kết với thành viên hợp lệ.');
    }
  });
  const taskMap = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const pollMap = new Map(snapshot.polls.map((poll) => [poll.id, poll]));
  const optionMap = new Map(snapshot.pollOptions.map((option) => [option.id, option]));
  snapshot.collaborationSettings.forEach((settings) => assertTripLink(settings.tripId, 'cài đặt cộng tác'));
  snapshot.tasks.forEach((task) => {
    assertTripLink(task.tripId, 'nhiệm vụ');
    if (!membershipKeys.has(`${task.tripId}:${task.createdBy}`) || (task.assigneeId && !membershipKeys.has(`${task.tripId}:${task.assigneeId}`))) throw new Error('Backup chứa nhiệm vụ không liên kết với thành viên hợp lệ.');
    if (task.activityId && activityMap.get(task.activityId)?.tripId !== task.tripId) throw new Error('Backup chứa nhiệm vụ liên kết hoạt động khác chuyến.');
    if (task.placeId && placeMap.get(task.placeId)?.tripId !== task.tripId) throw new Error('Backup chứa nhiệm vụ liên kết địa điểm khác chuyến.');
  });
  snapshot.polls.forEach((poll) => {
    assertTripLink(poll.tripId, 'bình chọn');
    if (!membershipKeys.has(`${poll.tripId}:${poll.createdBy}`)) throw new Error('Backup chứa bình chọn không liên kết với thành viên hợp lệ.');
  });
  snapshot.pollOptions.forEach((option) => {
    if (pollMap.get(option.pollId)?.tripId !== option.tripId) throw new Error('Backup chứa lựa chọn bình chọn không hợp lệ.');
    if (option.activityId && activityMap.get(option.activityId)?.tripId !== option.tripId) throw new Error('Backup chứa lựa chọn liên kết hoạt động khác chuyến.');
    if (option.placeId && placeMap.get(option.placeId)?.tripId !== option.tripId) throw new Error('Backup chứa lựa chọn liên kết địa điểm khác chuyến.');
  });
  snapshot.pollVotes.forEach((vote) => {
    if (pollMap.get(vote.pollId)?.tripId !== vote.tripId || optionMap.get(vote.optionId)?.pollId !== vote.pollId || !membershipKeys.has(`${vote.tripId}:${vote.userId}`)) throw new Error('Backup chứa phiếu bầu không hợp lệ.');
  });
  const targetMaps = { activity: activityMap, expense: new Map(snapshot.expenses.map((item) => [item.id, item])), place: placeMap, photo: new Map(snapshot.photos.map((item) => [item.id, item])), task: taskMap, poll: pollMap };
  snapshot.comments.forEach((comment) => {
    const target = targetMaps[comment.targetType].get(comment.targetId);
    if (!target || target.tripId !== comment.tripId || !membershipKeys.has(`${comment.tripId}:${comment.authorId}`) || comment.mentionedUserIds.some((userId) => !membershipKeys.has(`${comment.tripId}:${userId}`))) throw new Error('Backup chứa bình luận không hợp lệ.');
    if (comment.parentId) {
      const parent = snapshot.comments.find((item) => item.id === comment.parentId);
      if (!parent || parent.parentId || parent.tripId !== comment.tripId || parent.targetType !== comment.targetType || parent.targetId !== comment.targetId) throw new Error('Backup chứa phản hồi bình luận không cùng luồng hợp lệ.');
    }
  });
  snapshot.notifications.forEach((notification) => {
    assertTripLink(notification.tripId, 'thông báo');
    if (!profileIds.has(notification.recipientId)) throw new Error('Backup chứa thông báo không liên kết với hồ sơ hợp lệ.');
  });
  snapshot.offlineMutations.forEach((mutation) => assertTripLink(mutation.tripId, 'thao tác offline'));
  if (snapshot.currentTripId && !tripIds.has(snapshot.currentTripId)) throw new Error('Backup chứa currentTripId không hợp lệ.');
  if (snapshot.viewerProfileId && !profileIds.has(snapshot.viewerProfileId)) throw new Error('Backup chứa viewerProfileId không hợp lệ.');
  if ((snapshot.pinnedTripIds ?? []).some((tripId) => !tripIds.has(tripId))) throw new Error('Backup chứa chuyến đi đã ghim không hợp lệ.');
}

export const EMPTY_PERSISTED_STATE: PersistedAppState = {
  version: APP_STATE_VERSION,
  trips: [], profiles: [], memberships: [], invitations: [], activities: [], expenses: [],
  savedPlaces: [], packingItems: [], photos: [], collaborationSettings: [], tasks: [], polls: [], pollOptions: [], pollVotes: [],
  comments: [], notifications: [], offlineMutations: [], activityLogs: [], currentTripId: null, viewerProfileId: null, pinnedTripIds: [],
};

export function prepareImportedSnapshot(state: Partial<PersistedAppState> | LegacyState) {
  const preparedState = state.version === APP_STATE_VERSION
    ? state
    : normalizePersistedState(state, EMPTY_PERSISTED_STATE);
  validateImportedSnapshot(preparedState);
  return preparedState;
}
