export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  phone?: string;
  birthdate?: string;
  bio?: string;
};

export type Currency = 'VND' | 'USD' | 'EUR' | 'JPY' | 'KRW' | 'THB' | 'SGD';
export type TripAccessRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type TripPhase = 'draft' | 'upcoming' | 'active' | 'wrap-up' | 'completed';

export const CURRENCIES: Record<Currency, { symbol: string; name: string; defaultRateToVND: number }> = {
  VND: { symbol: 'đ', name: 'Việt Nam Đồng', defaultRateToVND: 1 },
  USD: { symbol: '$', name: 'Đô la Mỹ', defaultRateToVND: 25000 },
  EUR: { symbol: '€', name: 'Euro', defaultRateToVND: 27000 },
  JPY: { symbol: '¥', name: 'Yên Nhật', defaultRateToVND: 170 },
  KRW: { symbol: '₩', name: 'Won Hàn Quốc', defaultRateToVND: 19 },
  THB: { symbol: '฿', name: 'Baht Thái', defaultRateToVND: 700 },
  SGD: { symbol: 'S$', name: 'Đô la Singapore', defaultRateToVND: 18500 },
};

export type TripReview = {
  transport: number;
  accommodation: number;
  food: number;
  entertainment: number;
  memory: string;
};

export type TripCategoryBudgets = Record<string, number>;
export type TripExchangeRates = Partial<Record<Currency, number>>;

export type TripRecord = {
  id: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  budget: number;
  baseCurrency?: Currency;
  status: 'upcoming' | 'completed' | 'draft';
  image: string;
  themeColor?: string;
  categoryBudgets?: TripCategoryBudgets;
  exchangeRates?: TripExchangeRates;
  review?: TripReview;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ActivityLogEntry = {
  id: string;
  tripId: string;
  actorId?: string;
  actorName?: string;
  action: 'created' | 'updated' | 'deleted' | 'settled' | 'imported';
  entityType: 'trip' | 'activity' | 'expense' | 'place' | 'packing' | 'photo' | 'member' | 'notebook' | 'task' | 'poll' | 'comment' | 'share';
  entityId?: string;
  summary: string;
  createdAt: string;
};

export type TripMembership = {
  id: string;
  tripId: string;
  userId: string;
  role: TripAccessRole;
  createdAt?: string;
  revokedAt?: string;
};

export type TripInvitation = {
  id: string;
  tripId: string;
  email: string;
  role: Exclude<TripAccessRole, 'owner'>;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  invitedBy: string;
  acceptedBy?: string;
  createdAt: string;
  updatedAt?: string;
};

export type Activity = {
  id: string;
  tripId: string;
  date: string;
  time: string;
  title: string;
  location: string;
  note: string;
  type: string;
  image?: string;
  mapUrl?: string;
  bookingCode?: string;
  placeId?: string;
  isCompleted?: boolean;
  durationMinutes?: number;
  travelMinutesAfter?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Expense = {
  id: string;
  tripId: string;
  date: string;
  time: string;
  title: string;
  category: string;
  amount: number;
  originalAmount?: number;
  currency?: Currency;
  exchangeRate?: number;
  paidBy: string;
  participants: string[];
  note?: string;
  receiptImage?: string;
  isSettlement?: boolean;
  activityId?: string;
  placeId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SavedPlace = {
  id: string;
  tripId: string;
  name: string;
  type: string;
  phone?: string;
  address?: string;
  rating?: number;
  note?: string;
  sourceNotebookPlaceId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PackingItem = {
  id: string;
  tripId: string;
  name: string;
  isPacked: boolean;
  assigneeId?: string;
  category: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Photo = {
  id: string;
  tripId: string;
  url: string;
  album: string;
  createdAt: string;
  storage?: 'embedded' | 'remote';
  provider?: 'cloudinary';
  providerPublicId?: string;
  takenOn?: string;
  place?: string;
  people?: string[];
  tags?: string[];
  itemType?: 'photo' | 'journal';
  content?: string;
  activityId?: string;
  placeId?: string;
  contentHash?: string;
  perceptualHash?: string;
  hashVersion?: number;
  offlineBlobKey?: string;
  updatedAt?: string;
};

export type TripCollaborationSettings = {
  tripId: string;
  viewerCanVote: boolean;
  viewerCanComment: boolean;
  viewerCanUpdateAssignedTasks: boolean;
  updatedAt?: string;
};

export type TripTaskStatus = 'todo' | 'in_progress' | 'done';
export type TripTaskPriority = 'low' | 'normal' | 'high';

export type TripTask = {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  status: TripTaskStatus;
  priority: TripTaskPriority;
  assigneeId?: string;
  dueDate?: string;
  dueTime?: string;
  activityId?: string;
  placeId?: string;
  createdBy: string;
  completedBy?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TripPollKind = 'place' | 'hotel' | 'restaurant' | 'time' | 'custom';

export type TripPoll = {
  id: string;
  tripId: string;
  question: string;
  kind: TripPollKind;
  selectionMode: 'single' | 'multiple';
  status: 'open' | 'closed';
  deadline?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TripPollOption = {
  id: string;
  pollId: string;
  tripId: string;
  label: string;
  activityId?: string;
  placeId?: string;
  proposedDate?: string;
  proposedTime?: string;
  createdAt: string;
};

export type TripPollVote = {
  id: string;
  pollId: string;
  optionId: string;
  tripId: string;
  userId: string;
  createdAt: string;
};

export type TripCommentTargetType = 'activity' | 'expense' | 'place' | 'photo' | 'task' | 'poll';

export type TripComment = {
  id: string;
  tripId: string;
  targetType: TripCommentTargetType;
  targetId: string;
  parentId?: string;
  authorId: string;
  body: string;
  mentionedUserIds: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type TripNotificationType = 'task_assigned' | 'comment_reply' | 'mention' | 'poll_closed';

export type TripNotification = {
  id: string;
  tripId: string;
  recipientId: string;
  actorId?: string;
  type: TripNotificationType;
  eventKey: string;
  title: string;
  message?: string;
  entityType?: TripCommentTargetType;
  entityId?: string;
  readAt?: string;
  createdAt: string;
};

export type PublicTripShareScope = 'overview' | 'itinerary' | 'places' | 'photos';

export type PublicTripShare = {
  id: string;
  tripId: string;
  scopes: PublicTripShareScope[];
  expiresAt: string;
  revokedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OfflineEntityType = 'trip' | 'activity' | 'expense' | 'place' | 'packing' | 'photo' | 'task' | 'poll' | 'vote' | 'comment';
export type OfflineMutationAction = 'create' | 'update' | 'delete';

export type OfflineMutation = {
  id: string;
  entityType: OfflineEntityType;
  entityId: string;
  tripId: string;
  action: OfflineMutationAction;
  payload: Record<string, unknown>;
  restorePayload?: Record<string, unknown>;
  baseUpdatedAt?: string;
  createdAt: string;
  status: 'pending' | 'failed' | 'conflict';
  error?: string;
  serverValue?: Record<string, unknown>;
};

export type TripPermissions = {
  canEditContent: boolean;
  canManageMembers: boolean;
  canManageTrip: boolean;
  canDeleteTrip: boolean;
  canInvite: boolean;
};

export type CalculatedMember = UserProfile & {
  membershipId: string;
  role: TripAccessRole;
  spent: number;
  balance: number;
  createdAt?: string;
  isArchived: boolean;
};

export type CalculatedTrip = TripRecord & {
  spent: number;
  members: CalculatedMember[];
  historicalMembers: CalculatedMember[];
  membershipRole: TripAccessRole | null;
  permissions: TripPermissions;
  invitationCount: number;
  isPinned: boolean;
};

export type PersistedAppState = {
  version: number;
  trips: TripRecord[];
  profiles: UserProfile[];
  memberships: TripMembership[];
  invitations: TripInvitation[];
  activities: Activity[];
  expenses: Expense[];
  savedPlaces: SavedPlace[];
  packingItems: PackingItem[];
  photos: Photo[];
  collaborationSettings: TripCollaborationSettings[];
  tasks: TripTask[];
  polls: TripPoll[];
  pollOptions: TripPollOption[];
  pollVotes: TripPollVote[];
  comments: TripComment[];
  notifications: TripNotification[];
  offlineMutations: OfflineMutation[];
  activityLogs: ActivityLogEntry[];
  currentTripId: string | null;
  viewerProfileId: string | null;
  pinnedTripIds?: string[];
};

export type Notebook = {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NotebookMembershipRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type NotebookPermissions = {
  canEditNotebook: boolean;
  canEditPlaces: boolean;
  canInvite: boolean;
  canManageMembers: boolean;
  canDeleteNotebook: boolean;
};

export type CalculatedNotebook = Notebook & {
  membershipRole: NotebookMembershipRole;
  permissions: NotebookPermissions;
  memberCount: number;
};

export type NotebookMember = {
  id: string;
  notebookId: string;
  userId: string;
  role: NotebookMembershipRole;
  displayName?: string;
  email?: string;
  avatar?: string;
};

export type NotebookPlace = {
  id: string;
  notebookId: string;
  name: string;
  type: 'hotel' | 'restaurant' | 'cafe' | 'entertainment' | 'other';
  address?: string;
  phone?: string;
  note?: string;
  rating: number;
  customFields?: { label: string; value: string }[];
  coverImage?: string;
  photos?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

export type PendingNotebookInvitation = {
  id: string;
  notebookId: string;
  notebookName: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  invitedByName: string | null;
};

export type AppBackgroundPreference =
  | { source: 'none' }
  | { source: 'library'; photoId: string }
  | {
      source: 'upload';
      imageUrl: string;
      providerPublicId?: string;
      localMediaKey?: string;
    };

export type UserPreferences = {
  themeMode: 'light' | 'dark' | 'system';
  themePresetId: string;
  uiDensity: 'cozy' | 'compact';
  appBackground: AppBackgroundPreference;
  isPrivacyMode: boolean;
  remindersEnabled: boolean;
  activityLeadMinutes: number;
  tripStartLeadMinutes: number;
  updatedAt?: string;
};

export type TripNotificationPreferences = {
  tripId: string;
  userId: string;
  useDefaults: boolean;
  enabled?: boolean;
  activityLeadMinutes?: number;
  tripStartLeadMinutes?: number;
  updatedAt?: string;
};

export type WorkspaceBackupV8 = {
  version: 8;
  workspace: PersistedAppState;
  library: {
    notebooks: Notebook[];
    places: NotebookPlace[];
  };
  preferences: UserPreferences;
  tripNotificationPreferences: TripNotificationPreferences[];
  exportedAt: string;
};

/** Legacy envelope kept so existing backup files remain importable. */
export type WorkspaceBackupV7 = Omit<WorkspaceBackupV8, 'version'> & { version: 7 };
