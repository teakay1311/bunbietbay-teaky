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
  entityType: 'trip' | 'activity' | 'expense' | 'place' | 'packing' | 'photo' | 'member' | 'notebook';
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
  updatedAt?: string;
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

export type UserPreferences = {
  themeMode: 'light' | 'dark' | 'system';
  themePresetId: string;
  uiDensity: 'cozy' | 'compact';
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

export type WorkspaceBackupV7 = {
  version: 7;
  workspace: PersistedAppState;
  library: {
    notebooks: Notebook[];
    places: NotebookPlace[];
  };
  preferences: UserPreferences;
  tripNotificationPreferences: TripNotificationPreferences[];
  exportedAt: string;
};
