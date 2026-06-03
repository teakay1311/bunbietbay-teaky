import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { deleteImageFromCloudinary } from '../lib/cloudinary';
import { loadPersistedState, savePersistedState } from '../utils/persistence';
import { APP_STATE_VERSION, normalizePersistedState } from '../utils/appState';
import { useAuth, type UserProfile } from './AuthContext';
import { INITIAL_PERSISTED_STATE } from '../constants/mockData';

export type Currency = 'VND' | 'USD' | 'EUR' | 'JPY' | 'KRW' | 'THB' | 'SGD';
export type TripAccessRole = 'owner' | 'admin' | 'editor' | 'viewer';

export const CURRENCIES: Record<Currency, { symbol: string, name: string, defaultRateToVND: number }> = {
  VND: { symbol: 'đ', name: 'Việt Nam Đồng', defaultRateToVND: 1 },
  USD: { symbol: '$', name: 'Đô la Mỹ', defaultRateToVND: 25000 },
  EUR: { symbol: '€', name: 'Euro', defaultRateToVND: 27000 },
  JPY: { symbol: '¥', name: 'Yên Nhật', defaultRateToVND: 170 },
  KRW: { symbol: '₩', name: 'Won Hàn Quốc', defaultRateToVND: 19 },
  THB: { symbol: '฿', name: 'Baht Thái', defaultRateToVND: 700 },
  SGD: { symbol: 'S$', name: 'Đô la Singapore', defaultRateToVND: 18500 },
};

const REMOTE_PINNED_TRIPS_KEY = 'bunbietbay-remote-pinned-trip-ids';

function readRemotePinnedTripIds(userId: string) {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(REMOTE_PINNED_TRIPS_KEY);
    if (!rawValue) {
      return [];
    }

    const storedValue = JSON.parse(rawValue) as Record<string, unknown>;
    const pinnedTripIds = storedValue[userId];
    return Array.isArray(pinnedTripIds) ? pinnedTripIds.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    console.warn('Failed to read remote pinned trips preference', error);
    return [];
  }
}

function writeRemotePinnedTripIds(userId: string, pinnedTripIds: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const rawValue = window.localStorage.getItem(REMOTE_PINNED_TRIPS_KEY);
    const storedValue = rawValue ? JSON.parse(rawValue) as Record<string, unknown> : {};
    storedValue[userId] = pinnedTripIds;
    window.localStorage.setItem(REMOTE_PINNED_TRIPS_KEY, JSON.stringify(storedValue));
  } catch (error) {
    console.warn('Failed to save remote pinned trips preference', error);
  }
}

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
};

export type CalculatedTrip = TripRecord & {
  spent: number;
  members: CalculatedMember[];
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

type InviteTripMemberInput = {
  email: string;
  role: Exclude<TripAccessRole, 'owner'>;
};

type AppContextType = {
  isHydrated: boolean;
  isRemoteMode: boolean;
  isSyncing: boolean;
  snapshot: PersistedAppState;
  trips: CalculatedTrip[];
  activities: Activity[];
  expenses: Expense[];
  savedPlaces: SavedPlace[];
  packingItems: PackingItem[];
  photos: Photo[];
  activityLogs: ActivityLogEntry[];
  invitations: TripInvitation[];
  currentUserProfile: UserProfile | null;
  currentTripId: string | null;
  setCurrentTripId: (id: string | null) => void;
  replacePersistedState: (state: Partial<PersistedAppState>) => void;
  refreshWorkspace: () => Promise<void>;
  batchRemote: (callback: () => Promise<void>) => Promise<void>;
  inviteTripMember: (tripId: string, input: InviteTripMemberInput) => Promise<void>;
  revokeTripInvitation: (invitationId: string) => Promise<void>;
  updateTripMemberRole: (membershipId: string, role: TripAccessRole) => Promise<void>;
  removeTripMember: (membershipId: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  editExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addActivity: (activity: Omit<Activity, 'id'>) => Promise<void>;
  editActivity: (id: string, activity: Partial<Activity>) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  addTrip: (trip: Omit<TripRecord, 'id'>) => Promise<void>;
  duplicateTrip: (id: string, overrideTitle?: string, startOffsetDays?: number) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  editTrip: (id: string, trip: Partial<TripRecord>) => Promise<void>;
  toggleTripPin: (id: string) => Promise<void>;
  updateTripReview: (tripId: string, review: TripReview) => Promise<void>;
  addSavedPlace: (place: Omit<SavedPlace, 'id'>) => Promise<void>;
  editSavedPlace: (id: string, place: Partial<SavedPlace>) => Promise<void>;
  deleteSavedPlace: (id: string) => Promise<void>;
  addPackingItem: (item: Omit<PackingItem, 'id'>) => Promise<void>;
  editPackingItem: (id: string, item: Partial<PackingItem>) => Promise<void>;
  togglePackingItem: (id: string) => Promise<void>;
  deletePackingItem: (id: string) => Promise<void>;
  addPhotos: (photos: Array<Omit<Photo, 'id' | 'createdAt'>>) => Promise<void>;
  editPhoto: (id: string, photo: Partial<Photo>) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  undoLastAction: () => Promise<void>;
};

type RemoteTripRow = {
  id: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  budget: number | string;
  base_currency: Currency;
  status: TripRecord['status'];
  image: string;
  review: TripReview | null;
  created_by: string;
  theme_color: string | null;
  created_at: string;
  updated_at: string;
};

type RemoteMembershipRow = {
  id: string;
  trip_id: string;
  user_id: string;
  role: TripAccessRole;
  created_at: string;
};

type RemoteInvitationRow = {
  id: string;
  trip_id: string;
  email: string;
  role: Exclude<TripAccessRole, 'owner'>;
  status: TripInvitation['status'];
  invited_by: string;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
};

type RemoteProfileRow = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  phone: string | null;
  birthdate: string | null;
  bio: string | null;
};

type RemoteTripSettingRow = {
  trip_id: string;
  category_budgets: TripCategoryBudgets | null;
  exchange_rates: TripExchangeRates | null;
};

type RemoteActivityLogRow = {
  id: string;
  trip_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: ActivityLogEntry['action'];
  entity_type: ActivityLogEntry['entityType'];
  entity_id: string | null;
  summary: string;
  created_at: string;
};

function rolePermissions(role: TripAccessRole | null): TripPermissions {
  switch (role) {
    case 'owner':
      return {
        canEditContent: true,
        canManageMembers: true,
        canManageTrip: true,
        canDeleteTrip: true,
        canInvite: true,
      };
    case 'admin':
      return {
        canEditContent: true,
        canManageMembers: true,
        canManageTrip: true,
        canDeleteTrip: false,
        canInvite: true,
      };
    case 'editor':
      return {
        canEditContent: true,
        canManageMembers: false,
        canManageTrip: false,
        canDeleteTrip: false,
        canInvite: false,
      };
    default:
      return {
        canEditContent: false,
        canManageMembers: false,
        canManageTrip: false,
        canDeleteTrip: false,
        canInvite: false,
      };
  }
}


const AppContext = createContext<AppContextType | undefined>(undefined);

function toUserProfile(row: RemoteProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatar: row.avatar_url,
    phone: row.phone ?? undefined,
    birthdate: row.birthdate ?? undefined,
    bio: row.bio ?? undefined,
  };
}

function toTripRecord(row: RemoteTripRow): TripRecord {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    budget: Number(row.budget),
    baseCurrency: row.base_currency,
    status: row.status,
    image: row.image,
    review: row.review ?? undefined,
    createdBy: row.created_by,
    themeColor: row.theme_color ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchRemoteWorkspace(userId: string, email: string | null): Promise<PersistedAppState> {
  if (!supabase) {
    throw new Error('Supabase chưa được cấu hình');
  }

  const membershipResponse = await supabase
    .from('trip_memberships')
    .select('id, trip_id, user_id, role, created_at')
    .eq('user_id', userId);

  if (membershipResponse.error) {
    const errorMessage = typeof membershipResponse.error === 'object' && membershipResponse.error !== null && 'message' in membershipResponse.error
      ? (membershipResponse.error as { message: string }).message
      : String(membershipResponse.error);
    if (errorMessage.includes('schema cache') || errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      console.warn('Supabase tables chưa được khởi tạo. App sẽ hoạt động ở chế độ local.', membershipResponse.error);
      return {
        version: APP_STATE_VERSION,
        trips: [], profiles: [], memberships: [], invitations: [],
        activities: [], expenses: [], savedPlaces: [], packingItems: [], photos: [], activityLogs: [],
        currentTripId: null, viewerProfileId: userId,
      };
    }
    throw membershipResponse.error;
  }

  const ownMemberships = (membershipResponse.data ?? []) as RemoteMembershipRow[];
  const tripIds = Array.from(new Set(ownMemberships.map((membership) => membership.trip_id)));

  const invitationsForMePromise = email
    ? supabase
      .from('trip_invitations')
      .select('id, trip_id, email, role, status, invited_by, accepted_by, created_at, updated_at')
      .eq('email', email.toLowerCase())
    : Promise.resolve({ data: [], error: null });

  if (tripIds.length === 0) {
    const invitationResponse = await invitationsForMePromise;
    if (invitationResponse.error) {
      throw invitationResponse.error;
    }

    return {
      version: APP_STATE_VERSION,
      trips: [],
      profiles: [],
      memberships: [],
      invitations: ((invitationResponse.data ?? []) as RemoteInvitationRow[]).map((invitation) => ({
        id: invitation.id,
        tripId: invitation.trip_id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        invitedBy: invitation.invited_by,
        acceptedBy: invitation.accepted_by ?? undefined,
        createdAt: invitation.created_at,
        updatedAt: invitation.updated_at,
      })),
      activities: [],
      expenses: [],
      savedPlaces: [],
      packingItems: [],
      photos: [],
      activityLogs: [],
      currentTripId: null,
      viewerProfileId: userId,
    };
  }

  const [
    tripResponse,
    allMembershipResponse,
    invitationResponse,
    activityResponse,
    expenseResponse,
    placeResponse,
    packingResponse,
    photoResponse,
    tripSettingResponse,
    activityLogResponse,
  ] = await Promise.all([
    supabase.from('trips').select('id, title, location, start_date, end_date, budget, base_currency, status, image, review, created_by, theme_color, created_at, updated_at').in('id', tripIds),
    supabase.from('trip_memberships').select('id, trip_id, user_id, role, created_at').in('trip_id', tripIds),
    Promise.all([
      supabase.from('trip_invitations').select('id, trip_id, email, role, status, invited_by, accepted_by, created_at, updated_at').in('trip_id', tripIds),
      invitationsForMePromise,
    ]),
    supabase.from('activities').select('id, trip_id, date, time, title, location, note, type, image, map_url, booking_code, is_completed, created_at, updated_at').in('trip_id', tripIds),
    supabase.from('expenses').select('id, trip_id, date, time, title, category, amount, original_amount, currency, exchange_rate, paid_by, participants, note, receipt_image, is_settlement, created_at, updated_at').in('trip_id', tripIds),
    supabase.from('saved_places').select('id, trip_id, name, type, phone, address, rating, note, created_at, updated_at').in('trip_id', tripIds),
    supabase.from('packing_items').select('id, trip_id, name, is_packed, assignee_id, category, created_at, updated_at').in('trip_id', tripIds),
    supabase.from('photos').select('id, trip_id, url, album, created_at, updated_at, storage, provider, provider_public_id, taken_on, place, people, tags, item_type, content').in('trip_id', tripIds),
    supabase.from('trip_settings').select('trip_id, category_budgets, exchange_rates').in('trip_id', tripIds),
    supabase.from('trip_activity_logs').select('id, trip_id, actor_id, actor_name, action, entity_type, entity_id, summary, created_at').in('trip_id', tripIds).order('created_at', { ascending: false }).limit(120),
  ]);

  for (const response of [tripResponse, allMembershipResponse, activityResponse, expenseResponse, placeResponse, packingResponse, photoResponse]) {
    if (response.error) {
      throw response.error;
    }
  }

  const [tripInvitationsResponse, personalInvitationsResponse] = invitationResponse;
  if (tripInvitationsResponse.error) {
    throw tripInvitationsResponse.error;
  }
  if (personalInvitationsResponse.error) {
    throw personalInvitationsResponse.error;
  }

  const allMemberships = (allMembershipResponse.data ?? []) as RemoteMembershipRow[];
  const profileIds = Array.from(new Set(allMemberships.map((membership) => membership.user_id)));
  const profileResponse = profileIds.length > 0
    ? await supabase.from('profiles').select('id, email, display_name, avatar_url, phone, birthdate, bio').in('id', profileIds)
    : { data: [], error: null };

  if (profileResponse.error) {
    throw profileResponse.error;
  }

  const mergedInvitations = [...((tripInvitationsResponse.data ?? []) as RemoteInvitationRow[]), ...((personalInvitationsResponse.data ?? []) as RemoteInvitationRow[])];
  const uniqueInvitations = Array.from(new Map(mergedInvitations.map((invitation) => [invitation.id, invitation])).values());
  const tripSettings = tripSettingResponse.error
    ? []
    : (tripSettingResponse.data ?? []) as RemoteTripSettingRow[];
  const settingMap = new Map(tripSettings.map((setting) => [setting.trip_id, setting]));
  const activityLogs = activityLogResponse.error
    ? []
    : ((activityLogResponse.data ?? []) as RemoteActivityLogRow[]).map((row) => ({
      id: row.id,
      tripId: row.trip_id,
      actorId: row.actor_id ?? undefined,
      actorName: row.actor_name ?? undefined,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id ?? undefined,
      summary: row.summary,
      createdAt: row.created_at,
    }));

  return {
    version: APP_STATE_VERSION,
    trips: ((tripResponse.data ?? []) as RemoteTripRow[]).map((row) => {
      const trip = toTripRecord(row);
      const settings = settingMap.get(trip.id);
      return {
        ...trip,
        categoryBudgets: settings?.category_budgets ?? undefined,
        exchangeRates: settings?.exchange_rates ?? undefined,
      };
    }),
    profiles: ((profileResponse.data ?? []) as RemoteProfileRow[]).map(toUserProfile),
    memberships: allMemberships.map((membership) => ({
      id: membership.id,
      tripId: membership.trip_id,
      userId: membership.user_id,
      role: membership.role,
      createdAt: membership.created_at,
    })),
    invitations: uniqueInvitations.map((invitation) => ({
      id: invitation.id,
      tripId: invitation.trip_id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      invitedBy: invitation.invited_by,
      acceptedBy: invitation.accepted_by ?? undefined,
      createdAt: invitation.created_at,
      updatedAt: invitation.updated_at,
    })),
    activities: (activityResponse.data ?? []).map((row) => ({
      id: row.id as string,
      tripId: row.trip_id as string,
      date: row.date as string,
      time: row.time as string,
      title: row.title as string,
      location: row.location as string,
      note: (row.note as string | null) ?? '',
      type: row.type as Activity['type'],
      image: (row.image as string | null) ?? undefined,
      mapUrl: (row.map_url as string | null) ?? undefined,
      bookingCode: (row.booking_code as string | null) ?? undefined,
      isCompleted: Boolean(row.is_completed),
      createdAt: (row.created_at as string | null) ?? undefined,
      updatedAt: (row.updated_at as string | null) ?? undefined,
    })),
    expenses: (expenseResponse.data ?? []).map((row) => ({
      id: row.id as string,
      tripId: row.trip_id as string,
      date: row.date as string,
      time: row.time as string,
      title: row.title as string,
      category: row.category as string,
      amount: Number(row.amount),
      originalAmount: row.original_amount == null ? undefined : Number(row.original_amount),
      currency: (row.currency as Currency | null) ?? undefined,
      exchangeRate: row.exchange_rate == null ? undefined : Number(row.exchange_rate),
      paidBy: row.paid_by as string,
      participants: ((row.participants as string[] | null) ?? []).map(String),
      note: (row.note as string | null) ?? undefined,
      receiptImage: (row.receipt_image as string | null) ?? undefined,
      isSettlement: Boolean(row.is_settlement),
      createdAt: (row.created_at as string | null) ?? undefined,
      updatedAt: (row.updated_at as string | null) ?? undefined,
    })),
    savedPlaces: (placeResponse.data ?? []).map((row) => ({
      id: row.id as string,
      tripId: row.trip_id as string,
      name: row.name as string,
      type: row.type as SavedPlace['type'],
      phone: (row.phone as string | null) ?? undefined,
      address: (row.address as string | null) ?? undefined,
      rating: row.rating == null ? undefined : Number(row.rating),
      note: (row.note as string | null) ?? undefined,
      createdAt: (row.created_at as string | null) ?? undefined,
      updatedAt: (row.updated_at as string | null) ?? undefined,
    })),
    packingItems: (packingResponse.data ?? []).map((row) => ({
      id: row.id as string,
      tripId: row.trip_id as string,
      name: row.name as string,
      isPacked: Boolean(row.is_packed),
      assigneeId: (row.assignee_id as string | null) ?? undefined,
      category: row.category as PackingItem['category'],
      createdAt: (row.created_at as string | null) ?? undefined,
      updatedAt: (row.updated_at as string | null) ?? undefined,
    })),
    photos: (photoResponse.data ?? []).map((row) => ({
      id: row.id as string,
      tripId: row.trip_id as string,
      url: row.url as string,
      album: row.album as string,
      createdAt: row.created_at as string,
      updatedAt: (row.updated_at as string | null) ?? undefined,
      storage: (row.storage as Photo['storage'] | null) ?? undefined,
      provider: (row.provider as Photo['provider'] | null) ?? undefined,
      providerPublicId: (row.provider_public_id as string | null) ?? undefined,
      takenOn: (row.taken_on as string | null) ?? undefined,
      place: (row.place as string | null) ?? undefined,
      people: ((row.people as string[] | null) ?? []).map(String),
      tags: ((row.tags as string[] | null) ?? []).map(String),
      itemType: (row.item_type as Photo['itemType'] | null) ?? undefined,
      content: (row.content as string | null) ?? undefined,
    })),
    activityLogs,
    currentTripId: tripIds[0] ?? null,
    viewerProfileId: userId,
  };
}

async function runSupabaseMutation(run: () => PromiseLike<{ error: unknown }>) {
  const response = await Promise.resolve(run());
  if ('error' in response && response.error) {
    throw response.error;
  }
}

function toFinitePositiveNumber(value: unknown, fieldLabel: string) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    throw new Error(`${fieldLabel} phải lớn hơn 0.`);
  }
  return nextValue;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { session, userEmail, profile } = useAuth();
  const [workspaceState, setWorkspaceState] = useState<PersistedAppState>(INITIAL_PERSISTED_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const guestWorkspaceRef = useRef<PersistedAppState>(INITIAL_PERSISTED_STATE);
  const undoStackRef = useRef<Array<() => Promise<void>>>([]);
  const batchDepthRef = useRef(0);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isRemoteMode = isSupabaseConfigured && Boolean(session);

  const remoteUnavailableRef = useRef(false);

  const refreshWorkspace = useCallback(async () => {
    if (!session || !supabase) {
      return;
    }

    setIsSyncing(true);
    try {
      const nextState = await fetchRemoteWorkspace(session.user.id, userEmail);
      const storedPinnedTripIds = readRemotePinnedTripIds(session.user.id);
      const availableTripIds = new Set(nextState.trips.map((trip) => trip.id));
      const pinnedTripIds = storedPinnedTripIds.filter((tripId) => availableTripIds.has(tripId));
      if (pinnedTripIds.length !== storedPinnedTripIds.length) {
        writeRemotePinnedTripIds(session.user.id, pinnedTripIds);
      }
      remoteUnavailableRef.current = false;
      setWorkspaceState((currentState) => ({
        ...currentState,
        ...nextState,
        pinnedTripIds,
        currentTripId: currentState.currentTripId && nextState.trips.some((trip) => trip.id === currentState.currentTripId)
          ? currentState.currentTripId
          : nextState.currentTripId,
      }));
    } catch (error) {
      console.warn('Remote workspace fetch failed, falling back to local data', error);
      remoteUnavailableRef.current = true;
      setWorkspaceState((currentState) => {
        if (currentState.trips.length === 0 && guestWorkspaceRef.current.trips.length > 0) {
          return guestWorkspaceRef.current;
        }
        return currentState;
      });
    } finally {
      setIsSyncing(false);
    }
  }, [session, userEmail]);

  useEffect(() => {
    let isMounted = true;

    void loadPersistedState<PersistedAppState>()
      .then((persistedState) => {
        if (!isMounted) {
          return;
        }

        const normalizedState = normalizePersistedState(persistedState, INITIAL_PERSISTED_STATE);
        guestWorkspaceRef.current = normalizedState;
        if (!isRemoteMode) {
          setWorkspaceState(normalizedState);
        }
      })
      .catch((error) => {
        console.error('Failed to hydrate workspace state', error);
      })
      .finally(() => {
        if (isMounted) {
          setIsHydrated(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isRemoteMode]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (isRemoteMode) {
      void refreshWorkspace().catch((error) => {
        console.error('Failed to refresh remote workspace', error);
      });
      return;
    }

    setWorkspaceState(guestWorkspaceRef.current);
  }, [isHydrated, isRemoteMode, refreshWorkspace]);

  useEffect(() => {
    if (!isHydrated || !isRemoteMode || !supabase || !session) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('app_public_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            void refreshWorkspace().catch((error) => {
              console.error('Failed to auto-refresh remote workspace from realtime event', error);
            });
          }, 800);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [isHydrated, isRemoteMode, refreshWorkspace, session]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const action = undoStackRef.current.pop();
        if (action) {
          e.preventDefault();
          action().catch(console.error);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (isRemoteMode && !remoteUnavailableRef.current) {
      return;
    }

    guestWorkspaceRef.current = workspaceState;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void savePersistedState(workspaceState).catch((error) => {
        console.error('Failed to save local workspace state', error);
      });
    }, 500);
    return () => { if (persistTimerRef.current) clearTimeout(persistTimerRef.current); };
  }, [isHydrated, isRemoteMode, workspaceState]);

  const currentUserProfile = useMemo(() => {
    if (isRemoteMode) {
      return profile ?? workspaceState.profiles.find((item) => item.id === session?.user.id) ?? null;
    }

    return workspaceState.profiles.find((item) => item.id === workspaceState.viewerProfileId) ?? workspaceState.profiles[0] ?? null;
  }, [isRemoteMode, profile, session?.user.id, workspaceState.profiles, workspaceState.viewerProfileId]);

  const trips = useMemo<CalculatedTrip[]>(() => {
    const profileMap = new Map<string, UserProfile>(workspaceState.profiles.map((item) => [item.id, item] as const));
    const membershipsByTrip = new Map<string, TripMembership[]>();
    const invitationsByTrip = new Map<string, TripInvitation[]>();
    const expensesByTrip = new Map<string, Expense[]>();

    workspaceState.memberships.forEach((membership) => {
      const nextMemberships = membershipsByTrip.get(membership.tripId) ?? [];
      nextMemberships.push(membership);
      membershipsByTrip.set(membership.tripId, nextMemberships);
    });

    workspaceState.invitations.forEach((invitation) => {
      const nextInvitations = invitationsByTrip.get(invitation.tripId) ?? [];
      nextInvitations.push(invitation);
      invitationsByTrip.set(invitation.tripId, nextInvitations);
    });

    workspaceState.expenses.forEach((expense) => {
      const nextExpenses = expensesByTrip.get(expense.tripId) ?? [];
      nextExpenses.push(expense);
      expensesByTrip.set(expense.tripId, nextExpenses);
    });

    return workspaceState.trips.map((trip) => {
      const tripMemberships = membershipsByTrip.get(trip.id) ?? [];
      const tripExpenses = expensesByTrip.get(trip.id) ?? [];
      const membershipRole = tripMemberships.find((membership) => membership.userId === currentUserProfile?.id)?.role ?? null;

      const members = tripMemberships.flatMap((membership) => {
        const memberProfile = profileMap.get(membership.userId);
        if (!memberProfile) {
          return [];
        }

        const amountPaid = tripExpenses
          .filter((expense) => expense.paidBy === membership.userId)
          .reduce((sum, expense) => sum + expense.amount, 0);

        const amountOwed = tripExpenses
          .filter((expense) => expense.participants.includes(membership.userId))
          .reduce((sum, expense) => sum + (expense.amount / Math.max(1, expense.participants.length)), 0);

        return [{
          id: memberProfile.id,
          email: memberProfile.email,
          displayName: memberProfile.displayName,
          avatar: memberProfile.avatar,
          phone: memberProfile.phone,
          birthdate: memberProfile.birthdate,
          bio: memberProfile.bio,
          membershipId: membership.id,
          role: membership.role,
          spent: amountPaid,
          balance: amountPaid - amountOwed,
          createdAt: membership.createdAt,
        }];
      });

      const spent = tripExpenses
        .filter((expense) => !expense.isSettlement)
        .reduce((sum, expense) => sum + expense.amount, 0);

      return {
        ...trip,
        spent,
        members,
        membershipRole,
        permissions: rolePermissions(membershipRole),
        invitationCount: (invitationsByTrip.get(trip.id) ?? []).filter((invitation) => invitation.status === 'pending').length,
        isPinned: workspaceState.pinnedTripIds?.includes(trip.id) ?? false,
      };
    });
  }, [currentUserProfile?.id, workspaceState.expenses, workspaceState.invitations, workspaceState.memberships, workspaceState.pinnedTripIds, workspaceState.profiles, workspaceState.trips]);

  const setCurrentTripId = useCallback((id: string | null) => {
    setWorkspaceState((currentState) => ({
      ...currentState,
      currentTripId: id,
    }));
  }, []);

  const replacePersistedState = useCallback((state: Partial<PersistedAppState>) => {
    setWorkspaceState((currentState) => normalizePersistedState(state, currentState));
  }, []);

  const withLocalUpdate = useCallback((updater: (state: PersistedAppState) => PersistedAppState) => {
    setWorkspaceState((currentState) => updater(currentState));
  }, []);

  const getTripPermission = useCallback((tripId: string) => {
    const trip = trips.find((item) => item.id === tripId);
    return trip?.permissions ?? rolePermissions(null);
  }, [trips]);

  const assertCanEditTripContent = useCallback((tripId: string) => {
    if (!getTripPermission(tripId).canEditContent) {
      throw new Error('Bạn không có quyền chỉnh sửa nội dung chuyến đi này.');
    }
  }, [getTripPermission]);

  const assertCanManageTrip = useCallback((tripId: string) => {
    if (!getTripPermission(tripId).canManageTrip) {
      throw new Error('Bạn không có quyền chỉnh sửa thông tin chuyến đi.');
    }
  }, [getTripPermission]);

  const assertCanManageMembers = useCallback((tripId: string) => {
    if (!getTripPermission(tripId).canManageMembers) {
      throw new Error('Bạn không có quyền quản lý thành viên.');
    }
  }, [getTripPermission]);

  const mutateRemote = useCallback(async (run: () => Promise<void>) => {
    if (!isRemoteMode || remoteUnavailableRef.current) {
      return false;
    }

    try {
      await run();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('schema cache') || errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        console.warn('Supabase tables chưa sẵn sàng, lưu local thay thế.', error);
        remoteUnavailableRef.current = true;
        return false;
      }
      throw error;
    }
    if (batchDepthRef.current === 0) {
      try {
        await refreshWorkspace();
      } catch (error) {
        console.error('Remote mutation succeeded but refresh failed', error);
      }
    }
    return true;
  }, [isRemoteMode, refreshWorkspace]);

  const batchRemote = useCallback(async (callback: () => Promise<void>) => {
    batchDepthRef.current++;
    try {
      await callback();
    } finally {
      batchDepthRef.current--;
      if (batchDepthRef.current === 0 && isRemoteMode && !remoteUnavailableRef.current) {
        try {
          await refreshWorkspace();
        } catch (error) {
          console.error('Batch remote refresh failed', error);
        }
      }
    }
  }, [isRemoteMode, refreshWorkspace]);

  const logTripEvent = useCallback((entry: Omit<ActivityLogEntry, 'id' | 'createdAt' | 'actorId' | 'actorName'>) => {
    const createdAt = new Date().toISOString();
    const nextEntry: ActivityLogEntry = {
      ...entry,
      id: crypto.randomUUID?.() ?? `log-${Date.now()}`,
      actorId: currentUserProfile?.id,
      actorName: currentUserProfile?.displayName,
      createdAt,
    };

    withLocalUpdate((currentState) => ({
      ...currentState,
      activityLogs: [nextEntry, ...(currentState.activityLogs ?? [])].slice(0, 200),
    }));

    if (!isRemoteMode || remoteUnavailableRef.current || !supabase) {
      return;
    }

    void supabase.from('trip_activity_logs').insert({
      id: nextEntry.id,
      trip_id: nextEntry.tripId,
      actor_id: nextEntry.actorId,
      actor_name: nextEntry.actorName,
      action: nextEntry.action,
      entity_type: nextEntry.entityType,
      entity_id: nextEntry.entityId,
      summary: nextEntry.summary,
      created_at: nextEntry.createdAt,
    }).then(({ error }) => {
      if (error && !error.message.includes('schema cache') && !error.message.includes('does not exist') && !error.message.includes('relation')) {
        console.warn('Failed to write trip activity log', error);
      }
    });
  }, [currentUserProfile?.displayName, currentUserProfile?.id, isRemoteMode, withLocalUpdate]);

  const contextValue = useMemo<AppContextType>(() => ({
    isHydrated,
    isRemoteMode,
    isSyncing,
    snapshot: workspaceState,
    trips,
    activities: workspaceState.activities,
    expenses: workspaceState.expenses,
    savedPlaces: workspaceState.savedPlaces,
    packingItems: workspaceState.packingItems,
    photos: workspaceState.photos,
    activityLogs: workspaceState.activityLogs,
    invitations: workspaceState.invitations,
    currentUserProfile,
    currentTripId: workspaceState.currentTripId,
    setCurrentTripId,
    replacePersistedState,
    refreshWorkspace,
    batchRemote,
    inviteTripMember: async (tripId, input) => {
      assertCanManageMembers(tripId);
      const normalizedEmail = input.email.trim().toLowerCase();
      if (!normalizedEmail) {
        return;
      }

      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('trip_invitations').upsert({
          trip_id: tripId,
          email: normalizedEmail,
          role: input.role,
          status: 'pending',
          invited_by: session!.user.id,
        }, { onConflict: 'trip_id,email' }));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        invitations: [
          {
            id: crypto.randomUUID(),
            tripId,
            email: normalizedEmail,
            role: input.role,
            status: 'pending',
            invitedBy: currentUserProfile?.id ?? currentState.viewerProfileId ?? 'm1',
            createdAt: new Date().toISOString(),
          },
          ...currentState.invitations.filter((invitation) => !(invitation.tripId === tripId && invitation.email === normalizedEmail)),
        ],
      }));
    },
    revokeTripInvitation: async (invitationId) => {
      const invitation = workspaceState.invitations.find((item) => item.id === invitationId);
      if (!invitation) {
        throw new Error('Không tìm thấy lời mời.');
      }
      assertCanManageMembers(invitation.tripId);

      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('trip_invitations').update({ status: 'revoked' }).eq('id', invitationId));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        invitations: currentState.invitations.map((item) => item.id === invitationId
          ? { ...item, status: 'revoked', updatedAt: new Date().toISOString() }
          : item),
      }));
    },
    updateTripMemberRole: async (membershipId, role) => {
      const membership = workspaceState.memberships.find((item) => item.id === membershipId);
      if (!membership) {
        throw new Error('Không tìm thấy thành viên cần cập nhật.');
      }
      assertCanManageMembers(membership.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('trip_memberships').update({ role }).eq('id', membershipId));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        memberships: currentState.memberships.map((membership) => membership.id === membershipId ? { ...membership, role } : membership),
      }));
    },
    removeTripMember: async (membershipId) => {
      const membership = workspaceState.memberships.find((item) => item.id === membershipId);
      if (!membership) {
        throw new Error('Không tìm thấy thành viên cần xóa.');
      }
      assertCanManageMembers(membership.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('trip_memberships').delete().eq('id', membershipId));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        memberships: currentState.memberships.filter((membership) => membership.id !== membershipId),
      }));
    },
    addExpense: async (expense) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      assertCanEditTripContent(expense.tripId);
      const normalizedAmount = toFinitePositiveNumber(expense.amount, 'Số tiền');
      const normalizedOriginalAmount = expense.originalAmount == null
        ? normalizedAmount
        : toFinitePositiveNumber(expense.originalAmount, 'Số tiền gốc');
      const normalizedRate = expense.exchangeRate == null ? 1 : toFinitePositiveNumber(expense.exchangeRate, 'Tỉ giá');
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('expenses').insert({
          trip_id: expense.tripId,
          date: expense.date,
          time: expense.time,
          title: expense.title,
          category: expense.category,
          amount: normalizedAmount,
          original_amount: normalizedOriginalAmount,
          currency: expense.currency,
          exchange_rate: normalizedRate,
          paid_by: expense.paidBy,
          participants: expense.participants,
          note: expense.note,
          receipt_image: expense.receiptImage,
          is_settlement: expense.isSettlement ?? false,
        }));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: expense.tripId, action: expense.isSettlement ? 'settled' : 'created', entityType: 'expense', summary: expense.isSettlement ? `Ghi nhận thanh toán: ${expense.title}` : `Thêm chi tiêu: ${expense.title}` });
        return;
      }

      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => ({
        ...currentState,
        expenses: [...currentState.expenses, { ...expense, amount: normalizedAmount, originalAmount: normalizedOriginalAmount, exchangeRate: normalizedRate, id: `e${Date.now()}`, createdAt, updatedAt: createdAt }],
      }));
      logTripEvent({ tripId: expense.tripId, action: expense.isSettlement ? 'settled' : 'created', entityType: 'expense', summary: expense.isSettlement ? `Ghi nhận thanh toán: ${expense.title}` : `Thêm chi tiêu: ${expense.title}` });
    },
    editExpense: async (id, expense) => {
      const currentExpense = workspaceState.expenses.find((item) => item.id === id);
      if (!currentExpense) {
        throw new Error('Không tìm thấy khoản chi cần cập nhật.');
      }
      assertCanEditTripContent(currentExpense.tripId);
      const normalizedAmount = expense.amount == null ? currentExpense.amount : toFinitePositiveNumber(expense.amount, 'Số tiền');
      const normalizedOriginalAmount = expense.originalAmount == null
        ? (currentExpense.originalAmount ?? normalizedAmount)
        : toFinitePositiveNumber(expense.originalAmount, 'Số tiền gốc');
      const normalizedRate = expense.exchangeRate == null ? (currentExpense.exchangeRate ?? 1) : toFinitePositiveNumber(expense.exchangeRate, 'Tỉ giá');
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('expenses').update({
          date: expense.date,
          time: expense.time,
          title: expense.title,
          category: expense.category,
          amount: normalizedAmount,
          original_amount: normalizedOriginalAmount,
          currency: expense.currency,
          exchange_rate: normalizedRate,
          paid_by: expense.paidBy,
          participants: expense.participants,
          note: expense.note,
          receipt_image: expense.receiptImage,
          is_settlement: expense.isSettlement,
        }).eq('id', id));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        expenses: currentState.expenses.map((item) => item.id === id ? { ...item, ...expense, amount: normalizedAmount, originalAmount: normalizedOriginalAmount, exchangeRate: normalizedRate, updatedAt: new Date().toISOString() } : item),
      }));
    },
    deleteExpense: async (id) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      const currentExpense = workspaceState.expenses.find((item) => item.id === id);
      if (!currentExpense) {
        throw new Error('Không tìm thấy khoản chi cần xóa.');
      }
      assertCanEditTripContent(currentExpense.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('expenses').delete().eq('id', id));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: currentExpense.tripId, action: 'deleted', entityType: 'expense', entityId: id, summary: `Xóa chi tiêu: ${currentExpense.title}` });
        undoStackRef.current.push(async () => {
          await mutateRemote(async () => {
            await runSupabaseMutation(() => supabase!.from('expenses').insert({
              id: currentExpense.id,
              trip_id: currentExpense.tripId,
              date: currentExpense.date,
              time: currentExpense.time,
              title: currentExpense.title,
              category: currentExpense.category,
              amount: currentExpense.amount,
              original_amount: currentExpense.originalAmount,
              currency: currentExpense.currency || 'VND',
              exchange_rate: currentExpense.exchangeRate || 1,
              paid_by: currentExpense.paidBy,
              participants: currentExpense.participants,
              note: currentExpense.note,
              receipt_image: currentExpense.receiptImage,
              is_settlement: currentExpense.isSettlement ?? false,
            }));
          });
        });
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        expenses: currentState.expenses.filter((item) => item.id !== id),
      }));
      logTripEvent({ tripId: currentExpense.tripId, action: 'deleted', entityType: 'expense', entityId: id, summary: `Xóa chi tiêu: ${currentExpense.title}` });

      undoStackRef.current.push(async () => {
        withLocalUpdate((currentState) => ({
          ...currentState,
          expenses: [...currentState.expenses, currentExpense],
        }));
      });
    },
    addActivity: async (activity) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      assertCanEditTripContent(activity.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('activities').insert({
          trip_id: activity.tripId,
          date: activity.date,
          time: activity.time,
          title: activity.title,
          location: activity.location,
          note: activity.note,
          type: activity.type,
          image: activity.image,
          map_url: activity.mapUrl,
          booking_code: activity.bookingCode,
          is_completed: activity.isCompleted ?? false,
        }));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: activity.tripId, action: 'created', entityType: 'activity', summary: `Thêm hoạt động: ${activity.title}` });
        return;
      }

      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => ({
        ...currentState,
        activities: [...currentState.activities, { ...activity, id: `a${Date.now()}`, createdAt, updatedAt: createdAt }],
      }));
      logTripEvent({ tripId: activity.tripId, action: 'created', entityType: 'activity', summary: `Thêm hoạt động: ${activity.title}` });
    },
    editActivity: async (id, activity) => {
      const currentActivity = workspaceState.activities.find((item) => item.id === id);
      if (!currentActivity) {
        throw new Error('Không tìm thấy hoạt động cần sửa.');
      }
      assertCanEditTripContent(currentActivity.tripId);

      // Optimistic local update — UI cập nhật ngay lập tức
      withLocalUpdate((currentState) => ({
        ...currentState,
        activities: currentState.activities.map((item) => item.id === id ? { ...item, ...activity, updatedAt: new Date().toISOString() } : item),
      }));

      try {
        const didRemoteMutate = await mutateRemote(async () => {
          await runSupabaseMutation(() => supabase!.from('activities').update({
            date: activity.date,
            time: activity.time,
            title: activity.title,
            location: activity.location,
            note: activity.note,
            type: activity.type,
            image: activity.image,
            map_url: activity.mapUrl,
            booking_code: activity.bookingCode,
            is_completed: activity.isCompleted,
          }).eq('id', id));
        });

        if (didRemoteMutate) {
          logTripEvent({ tripId: currentActivity.tripId, action: 'updated', entityType: 'activity', entityId: id, summary: `Cập nhật hoạt động: ${activity.title ?? currentActivity.title}` });
          return;
        }
      } catch (error) {
        // Rollback optimistic update on remote failure
        withLocalUpdate((currentState) => ({
          ...currentState,
          activities: currentState.activities.map((item) => item.id === id ? currentActivity : item),
        }));
        throw error;
      }
    },
    deleteActivity: async (id) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      const currentActivity = workspaceState.activities.find((item) => item.id === id);
      if (!currentActivity) {
        throw new Error('Không tìm thấy hoạt động cần xóa.');
      }
      assertCanEditTripContent(currentActivity.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('activities').delete().eq('id', id));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: currentActivity.tripId, action: 'deleted', entityType: 'activity', entityId: id, summary: `Xóa hoạt động: ${currentActivity.title}` });
        undoStackRef.current.push(async () => {
          await mutateRemote(async () => {
            await runSupabaseMutation(() => supabase!.from('activities').insert({
              id: currentActivity.id,
              trip_id: currentActivity.tripId,
              date: currentActivity.date,
              time: currentActivity.time,
              title: currentActivity.title,
              location: currentActivity.location,
              note: currentActivity.note,
              type: currentActivity.type,
              image: currentActivity.image,
              map_url: currentActivity.mapUrl,
              booking_code: currentActivity.bookingCode,
              is_completed: currentActivity.isCompleted ?? false,
            }));
          });
        });
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        activities: currentState.activities.filter((item) => item.id !== id),
      }));
      logTripEvent({ tripId: currentActivity.tripId, action: 'deleted', entityType: 'activity', entityId: id, summary: `Xóa hoạt động: ${currentActivity.title}` });

      undoStackRef.current.push(async () => {
        withLocalUpdate((currentState) => ({
          ...currentState,
          activities: [...currentState.activities, currentActivity],
        }));
      });
    },
    addTrip: async (trip) => {
      const normalizedBudget = toFinitePositiveNumber(trip.budget, 'Ngân sách');
      const didRemoteMutate = await mutateRemote(async () => {
        const { data, error } = await supabase!.from('trips').insert({
          title: trip.title,
          location: trip.location,
          start_date: trip.startDate,
          end_date: trip.endDate,
          budget: normalizedBudget,
          base_currency: trip.baseCurrency ?? 'VND',
          status: trip.status,
          image: trip.image,
          review: trip.review ?? null,
          created_by: session!.user.id,
          theme_color: trip.themeColor ?? null,
        }).select('id').single();

        if (error) {
          throw error;
        }

        await runSupabaseMutation(() => supabase!.from('trip_memberships').insert({
          trip_id: data.id,
          user_id: session!.user.id,
          role: 'owner',
        }));
      });

      if (didRemoteMutate) {
        return;
      }

      const currentUserId = currentUserProfile?.id ?? workspaceState.viewerProfileId ?? 'm1';
      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => {
        const nextId = `t${Date.now()}`;
        return {
          ...currentState,
          trips: [{ ...trip, budget: normalizedBudget, id: nextId, createdAt, updatedAt: createdAt }, ...currentState.trips],
          memberships: [
            { id: `tm-${Date.now()}`, tripId: nextId, userId: currentUserId, role: 'owner' },
            ...currentState.memberships,
          ],
        };
      });
    },
    toggleTripPin: async (id) => {
      withLocalUpdate((currentState) => {
        const currentPinned = currentState.pinnedTripIds || [];
        const nextPinned = currentPinned.includes(id)
          ? currentPinned.filter(pid => pid !== id)
          : [...currentPinned, id];
        if (isRemoteMode && session) {
          writeRemotePinnedTripIds(session.user.id, nextPinned);
        }
        return {
          ...currentState,
          pinnedTripIds: nextPinned
        };
      });
    },
    duplicateTrip: async (id, overrideTitle, startOffsetDays = 0) => {
      const trip = workspaceState.trips.find((t) => t.id === id);
      if (!trip) throw new Error('Không tìm thấy chuyến đi cần nhân bản.');

      const cloneTitle = overrideTitle || `${trip.title} (Bản sao)`;
      const normalizedBudget = trip.budget;

      const shiftDate = (dateStr: string, days: number) => {
        if (!days || !dateStr) return dateStr;
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + days);
        const yy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
      };

      const newStartDate = shiftDate(trip.startDate, startOffsetDays);
      const newEndDate = shiftDate(trip.endDate, startOffsetDays);

      const didRemoteMutate = await mutateRemote(async () => {
        const { data: newTrip, error: tripError } = await supabase!.from('trips').insert({
          title: cloneTitle,
          location: trip.location,
          start_date: newStartDate,
          end_date: newEndDate,
          budget: normalizedBudget,
          base_currency: trip.baseCurrency ?? 'VND',
          status: 'draft',
          image: trip.image,
          review: null,
          created_by: session!.user.id,
          theme_color: trip.themeColor ?? null,
        }).select('id').single();

        if (tripError) throw tripError;

        const memberships = workspaceState.memberships.filter(m => m.tripId === id);
        if (memberships.length > 0) {
          const memData = memberships.map(m => ({
            trip_id: newTrip.id,
            user_id: m.userId,
            role: m.role,
          }));
          await runSupabaseMutation(() => supabase!.from('trip_memberships').insert(memData));
        } else {
          await runSupabaseMutation(() => supabase!.from('trip_memberships').insert({
            trip_id: newTrip.id,
            user_id: session!.user.id,
            role: 'owner',
          }));
        }

        const activities = workspaceState.activities.filter(a => a.tripId === id);
        if (activities.length > 0) {
          const actData = activities.map(a => ({
            trip_id: newTrip.id,
            date: shiftDate(a.date, startOffsetDays),
            time: a.time,
            title: a.title,
            location: a.location,
            type: a.type,
            note: a.note,
            map_url: a.mapUrl,
            image: a.image,
            booking_code: a.bookingCode,
            is_completed: a.isCompleted ?? false,
          }));
          await runSupabaseMutation(() => supabase!.from('activities').insert(actData));
        }

        const packings = workspaceState.packingItems.filter(p => p.tripId === id);
        if (packings.length > 0) {
          const packData = packings.map(p => ({
            trip_id: newTrip.id,
            name: p.name,
            category: p.category,
            is_packed: false,
            assignee_id: p.assigneeId,
          }));
          await runSupabaseMutation(() => supabase!.from('packing_items').insert(packData));
        }
      });

      if (didRemoteMutate) {
        return;
      }

      const currentUserId = currentUserProfile?.id ?? workspaceState.viewerProfileId ?? 'm1';
      withLocalUpdate((currentState) => {
        const nextId = `t${Date.now()}`;
        const activitiesCopy = currentState.activities.filter(a => a.tripId === id).map((a, i) => ({
          ...a,
          tripId: nextId,
          date: shiftDate(a.date, startOffsetDays),
          id: `a${Date.now()}-${i}`
        }));
        const packingsCopy = currentState.packingItems.filter(p => p.tripId === id).map((p, i) => ({ ...p, tripId: nextId, isPacked: false, id: `p${Date.now()}-${i}` }));
        let membershipsCopy = currentState.memberships.filter(m => m.tripId === id).map((m, i) => ({ ...m, tripId: nextId, id: `tm${Date.now()}-${i}` }));

        if (membershipsCopy.length === 0) {
          membershipsCopy = [{ id: `tm-${Date.now()}`, tripId: nextId, userId: currentUserId, role: 'owner' }];
        }

        return {
          ...currentState,
          trips: [{
            ...trip,
            id: nextId,
            title: cloneTitle,
            startDate: newStartDate,
            endDate: newEndDate,
            status: 'draft',
            review: undefined
          }, ...currentState.trips],
          memberships: [...membershipsCopy, ...currentState.memberships],
          activities: [...activitiesCopy, ...currentState.activities],
          packingItems: [...packingsCopy, ...currentState.packingItems]
        };
      });
    },
    deleteTrip: async (id) => {
      if (!getTripPermission(id).canDeleteTrip) {
        throw new Error('Bạn không có quyền xóa chuyến đi này.');
      }
      const targets = workspaceState.photos.filter(p => p.tripId === id && p.provider === 'cloudinary');

      // delete in remote DB constraints CASCADE or we just delete it.
      const didRemoteMutate = await mutateRemote(async () => {
        const { error } = await supabase!.from('trips').delete().eq('id', id);
        if (error) throw error;
      });

      if (!didRemoteMutate) {
        withLocalUpdate(currentState => ({
          ...currentState,
          trips: currentState.trips.filter(t => t.id !== id),
          memberships: currentState.memberships.filter(m => m.tripId !== id),
          activities: currentState.activities.filter(a => a.tripId !== id),
          packingItems: currentState.packingItems.filter(p => p.tripId !== id),
          expenses: currentState.expenses.filter(e => e.tripId !== id),
          photos: currentState.photos.filter(p => p.tripId !== id),
          savedPlaces: currentState.savedPlaces.filter(sp => sp.tripId !== id),
          invitations: currentState.invitations.filter(inv => inv.tripId !== id),
        }));
      }

      void Promise.allSettled(
        targets.map(p => {
          if (p.providerPublicId) {
            return deleteImageFromCloudinary(p.providerPublicId).catch(() => { });
          }
          return Promise.resolve();
        })
      );
    },
    editTrip: async (id, trip) => {
      assertCanManageTrip(id);
      const normalizedBudget = trip.budget == null ? undefined : toFinitePositiveNumber(trip.budget, 'Ngân sách');
      const remotePayload: Record<string, unknown> = {};
      if (trip.title !== undefined) remotePayload.title = trip.title;
      if (trip.location !== undefined) remotePayload.location = trip.location;
      if (trip.startDate !== undefined) remotePayload.start_date = trip.startDate;
      if (trip.endDate !== undefined) remotePayload.end_date = trip.endDate;
      if (normalizedBudget !== undefined) remotePayload.budget = normalizedBudget;
      if (trip.baseCurrency !== undefined) remotePayload.base_currency = trip.baseCurrency;
      if (trip.status !== undefined) remotePayload.status = trip.status;
      if (trip.image !== undefined) remotePayload.image = trip.image;
      if (trip.review !== undefined) remotePayload.review = trip.review;
      if ('themeColor' in trip) remotePayload.theme_color = trip.themeColor ?? null;
      const didRemoteMutate = await mutateRemote(async () => {
        if (Object.keys(remotePayload).length > 0) {
          await runSupabaseMutation(() => supabase!.from('trips').update(remotePayload).eq('id', id));
        }
        if ('categoryBudgets' in trip || 'exchangeRates' in trip) {
          const { error } = await supabase!.from('trip_settings').upsert({
            trip_id: id,
            category_budgets: trip.categoryBudgets ?? {},
            exchange_rates: trip.exchangeRates ?? {},
          }, { onConflict: 'trip_id' });
          if (error && !error.message.includes('schema cache') && !error.message.includes('does not exist') && !error.message.includes('relation')) {
            throw error;
          }
        }
      });

      if (didRemoteMutate) {
        if ('categoryBudgets' in trip || 'exchangeRates' in trip) {
          logTripEvent({ tripId: id, action: 'updated', entityType: 'trip', entityId: id, summary: 'Cập nhật ngân sách/tỉ giá chuyến đi' });
        }
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        trips: currentState.trips.map((item) => item.id === id ? { ...item, ...trip, ...(normalizedBudget == null ? {} : { budget: normalizedBudget }), updatedAt: new Date().toISOString() } : item),
      }));
      if ('categoryBudgets' in trip || 'exchangeRates' in trip) {
        logTripEvent({ tripId: id, action: 'updated', entityType: 'trip', entityId: id, summary: 'Cập nhật ngân sách/tỉ giá chuyến đi' });
      }
    },
    updateTripReview: async (tripId, review) => {
      assertCanEditTripContent(tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('trips').update({ review }).eq('id', tripId));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        trips: currentState.trips.map((item) => item.id === tripId ? { ...item, review } : item),
      }));
    },
    addSavedPlace: async (place) => {
      assertCanEditTripContent(place.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('saved_places').insert({
          trip_id: place.tripId,
          name: place.name,
          type: place.type,
          phone: place.phone,
          address: place.address,
          rating: place.rating,
          note: place.note,
        }));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: place.tripId, action: 'created', entityType: 'place', summary: `Thêm địa điểm: ${place.name}` });
        return;
      }

      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => ({
        ...currentState,
        savedPlaces: [...currentState.savedPlaces, { ...place, id: `p${Date.now()}`, createdAt, updatedAt: createdAt }],
      }));
      logTripEvent({ tripId: place.tripId, action: 'created', entityType: 'place', summary: `Thêm địa điểm: ${place.name}` });
    },
    editSavedPlace: async (id, place) => {
      const currentPlace = workspaceState.savedPlaces.find((item) => item.id === id);
      if (!currentPlace) {
        throw new Error('Không tìm thấy địa điểm cần sửa.');
      }
      assertCanEditTripContent(currentPlace.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('saved_places').update({
          name: place.name,
          type: place.type,
          phone: place.phone,
          address: place.address,
          rating: place.rating,
          note: place.note,
        }).eq('id', id));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        savedPlaces: currentState.savedPlaces.map((item) => item.id === id ? { ...item, ...place, updatedAt: new Date().toISOString() } : item),
      }));
    },
    deleteSavedPlace: async (id) => {
      const currentPlace = workspaceState.savedPlaces.find((item) => item.id === id);
      if (!currentPlace) {
        throw new Error('Không tìm thấy địa điểm cần xóa.');
      }
      assertCanEditTripContent(currentPlace.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('saved_places').delete().eq('id', id));
      });

      if (didRemoteMutate) {
        undoStackRef.current.push(async () => {
          await mutateRemote(async () => {
            await runSupabaseMutation(() => supabase!.from('saved_places').insert({
              id: currentPlace.id,
              trip_id: currentPlace.tripId,
              name: currentPlace.name,
              type: currentPlace.type,
              phone: currentPlace.phone,
              address: currentPlace.address,
              rating: currentPlace.rating,
              note: currentPlace.note,
            }));
          });
        });
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        savedPlaces: currentState.savedPlaces.filter((item) => item.id !== id),
      }));

      undoStackRef.current.push(async () => {
        withLocalUpdate((currentState) => ({
          ...currentState,
          savedPlaces: [...currentState.savedPlaces, currentPlace],
        }));
      });
    },
    addPackingItem: async (item) => {
      assertCanEditTripContent(item.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('packing_items').insert({
          trip_id: item.tripId,
          name: item.name,
          is_packed: item.isPacked,
          assignee_id: item.assigneeId,
          category: item.category,
        }));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: item.tripId, action: 'created', entityType: 'packing', summary: `Thêm hành lý: ${item.name}` });
        return;
      }

      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => ({
        ...currentState,
        packingItems: [...currentState.packingItems, { ...item, id: `pk-${Date.now()}`, createdAt, updatedAt: createdAt }],
      }));
      logTripEvent({ tripId: item.tripId, action: 'created', entityType: 'packing', summary: `Thêm hành lý: ${item.name}` });
    },
    editPackingItem: async (id, item) => {
      const currentItem = workspaceState.packingItems.find((existingItem) => existingItem.id === id);
      if (!currentItem) {
        throw new Error('Không tìm thấy vật dụng cần sửa.');
      }
      assertCanEditTripContent(currentItem.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('packing_items').update({
          name: item.name,
          is_packed: item.isPacked,
          assignee_id: item.assigneeId,
          category: item.category,
        }).eq('id', id));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        packingItems: currentState.packingItems.map((existingItem) => existingItem.id === id ? { ...existingItem, ...item, updatedAt: new Date().toISOString() } : existingItem),
      }));
    },
    togglePackingItem: async (id) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      const currentItem = workspaceState.packingItems.find((item) => item.id === id);
      if (!currentItem) {
        return;
      }
      assertCanEditTripContent(currentItem.tripId);

      // Đọc giá trị thực tế bên trong updater để tránh stale closure khi tích nhanh
      let newIsPacked = !currentItem.isPacked;
      withLocalUpdate((currentState) => {
        const liveItem = currentState.packingItems.find((item) => item.id === id);
        newIsPacked = liveItem ? !liveItem.isPacked : !currentItem.isPacked;
        return {
          ...currentState,
          packingItems: currentState.packingItems.map((item) => item.id === id ? { ...item, isPacked: newIsPacked, updatedAt: new Date().toISOString() } : item),
        };
      });

      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('packing_items').update({
          is_packed: newIsPacked,
        }).eq('id', id));
      });

      if (didRemoteMutate) {
        return;
      }
    },
    deletePackingItem: async (id) => {
      const currentItem = workspaceState.packingItems.find((item) => item.id === id);
      if (!currentItem) {
        throw new Error('Không tìm thấy vật dụng cần xóa.');
      }
      assertCanEditTripContent(currentItem.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('packing_items').delete().eq('id', id));
      });

      if (didRemoteMutate) {
        undoStackRef.current.push(async () => {
          await mutateRemote(async () => {
            await runSupabaseMutation(() => supabase!.from('packing_items').insert({
              id: currentItem.id,
              trip_id: currentItem.tripId,
              name: currentItem.name,
              is_packed: currentItem.isPacked,
              assignee_id: currentItem.assigneeId,
              category: currentItem.category,
            }));
          });
        });
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        packingItems: currentState.packingItems.filter((item) => item.id !== id),
      }));

      undoStackRef.current.push(async () => {
        withLocalUpdate((currentState) => ({
          ...currentState,
          packingItems: [...currentState.packingItems, currentItem],
        }));
      });
    },
    addPhotos: async (photos) => {
      photos.forEach((photo) => assertCanEditTripContent(photo.tripId));
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('photos').insert(photos.map((photo) => ({
          trip_id: photo.tripId,
          url: photo.url,
          album: photo.album,
          storage: photo.storage,
          provider: photo.provider,
          provider_public_id: photo.providerPublicId,
          taken_on: photo.takenOn,
          place: photo.place,
          people: photo.people ?? [],
          tags: photo.tags ?? [],
          item_type: photo.itemType ?? 'photo',
          content: photo.content,
        }))));
      });

      if (didRemoteMutate) {
        photos.forEach((photo) => logTripEvent({ tripId: photo.tripId, action: 'created', entityType: 'photo', summary: photo.itemType === 'journal' ? 'Thêm nhật ký chuyến đi' : 'Thêm ảnh chuyến đi' }));
        return;
      }

      const timestamp = Date.now();
      withLocalUpdate((currentState) => ({
        ...currentState,
        photos: [
          ...photos.map((photo, index) => ({
            ...photo,
            id: `ph-${timestamp}-${index}`,
            createdAt: new Date(timestamp + index).toISOString(),
          })),
          ...currentState.photos,
        ],
      }));
      photos.forEach((photo) => logTripEvent({ tripId: photo.tripId, action: 'created', entityType: 'photo', summary: photo.itemType === 'journal' ? 'Thêm nhật ký chuyến đi' : 'Thêm ảnh chuyến đi' }));
    },
    editPhoto: async (id, photo) => {
      const currentPhoto = workspaceState.photos.find((item) => item.id === id);
      if (!currentPhoto) {
        throw new Error('Không tìm thấy ảnh cần cập nhật.');
      }
      assertCanEditTripContent(currentPhoto.tripId);
      const nextPhoto = { ...currentPhoto, ...photo, updatedAt: new Date().toISOString() };
      const didRemoteMutate = await mutateRemote(async () => {
        const payload: Record<string, unknown> = {};
        if (photo.album !== undefined) payload.album = photo.album;
        if (photo.takenOn !== undefined) payload.taken_on = photo.takenOn || null;
        if (photo.place !== undefined) payload.place = photo.place || null;
        if (photo.people !== undefined) payload.people = photo.people ?? [];
        if (photo.tags !== undefined) payload.tags = photo.tags ?? [];
        if (photo.itemType !== undefined) payload.item_type = photo.itemType;
        if (photo.content !== undefined) payload.content = photo.content || null;
        if (Object.keys(payload).length === 0) return;
        await runSupabaseMutation(() => supabase!.from('photos').update(payload).eq('id', id));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: currentPhoto.tripId, action: 'updated', entityType: 'photo', summary: currentPhoto.itemType === 'journal' ? 'Cập nhật nhật ký chuyến đi' : 'Cập nhật thông tin ảnh' });
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        photos: currentState.photos.map((item) => (item.id === id ? nextPhoto : item)),
      }));

      undoStackRef.current.push(async () => {
        withLocalUpdate((currentState) => ({
          ...currentState,
          photos: currentState.photos.map((item) => (item.id === id ? currentPhoto : item)),
        }));
      });
      logTripEvent({ tripId: currentPhoto.tripId, action: 'updated', entityType: 'photo', summary: currentPhoto.itemType === 'journal' ? 'Cập nhật nhật ký chuyến đi' : 'Cập nhật thông tin ảnh' });
    },
    deletePhoto: async (id) => {
      const currentPhoto = workspaceState.photos.find((item) => item.id === id);
      if (!currentPhoto) {
        throw new Error('Không tìm thấy ảnh cần xóa.');
      }
      assertCanEditTripContent(currentPhoto.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('photos').delete().eq('id', id));
      });

      if (didRemoteMutate) {
        undoStackRef.current.push(async () => {
          await mutateRemote(async () => {
            await runSupabaseMutation(() => supabase!.from('photos').insert({
              id: currentPhoto.id,
              trip_id: currentPhoto.tripId,
              url: currentPhoto.url,
              album: currentPhoto.album,
              storage: currentPhoto.storage,
              provider: currentPhoto.provider,
              provider_public_id: currentPhoto.providerPublicId,
              taken_on: currentPhoto.takenOn,
              place: currentPhoto.place,
              people: currentPhoto.people ?? [],
              tags: currentPhoto.tags ?? [],
              item_type: currentPhoto.itemType ?? 'photo',
              content: currentPhoto.content,
              created_at: currentPhoto.createdAt,
            }));
          });
        });
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        photos: currentState.photos.filter((item) => item.id !== id),
      }));

      undoStackRef.current.push(async () => {
        withLocalUpdate((currentState) => ({
          ...currentState,
          photos: [...currentState.photos, currentPhoto],
        }));
      });
    },
    undoLastAction: async () => {
      const action = undoStackRef.current.pop();
      if (action) {
        await action();
      }
    },
  }), [assertCanEditTripContent, assertCanManageMembers, assertCanManageTrip, batchRemote, currentUserProfile, isHydrated, isRemoteMode, isSyncing, logTripEvent, mutateRemote, refreshWorkspace, replacePersistedState, setCurrentTripId, trips, withLocalUpdate, workspaceState, session]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }

  return context;
}
