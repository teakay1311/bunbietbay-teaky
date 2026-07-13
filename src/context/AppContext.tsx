import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { deleteImageFromCloudinary } from '../lib/cloudinary';
import { deleteOfflineMedia, loadPersistedState, loadRemoteCachedState, savePersistedState, saveRemoteCachedState } from '../utils/persistence';
import { buildDuplicatedMembershipRoles, EMPTY_PERSISTED_STATE, normalizePersistedState, validateImportedSnapshot } from '../utils/appState';
import { classifyRemoteWorkspaceError, type RemoteWorkspaceErrorCode } from '../utils/cloudSyncDecisions';
import { useAuth } from './AuthContext';
import { INITIAL_PERSISTED_STATE } from '../constants/mockData';
import { getTripPermissions } from '../domain/tripLogic';
import { calculateTrips } from '../domain/calculateTrips';
import { fetchRemoteWorkspace } from '../data/remoteWorkspace';
import { readRemotePinnedTripIds, writeRemotePinnedTripIds } from '../data/remoteTripPreferences';
import { runSupabaseMutation } from '../data/supabaseMutation';
import { getTripDateValidationError } from '../utils/tripValidation';
import { coalesceOfflineMutations } from '../features/collaboration/selectors';
import { mergeRemoteWorkspaceWithOffline } from '../utils/offlineWorkspaceMerge';
import {
  toRemoteActivity,
  toRemoteActivityUpdate,
  toRemoteExpense,
  toRemoteExpenseUpdate,
  toRemotePackingItem,
  toRemotePackingItemUpdate,
  toRemotePhoto,
  toRemotePhotoUpdate,
  toRemoteSavedPlace,
  toRemoteSavedPlaceUpdate,
  toRemoteTrip,
  toRemoteTripUpdate,
} from '../data/remotePayloads';
import {
  type Activity,
  type ActivityLogEntry,
  type CalculatedTrip,
  type Expense,
  type PackingItem,
  type PersistedAppState,
  type Photo,
  type SavedPlace,
  type TripAccessRole,
  type TripInvitation,
  type TripRecord,
  type TripReview,
  type UserProfile,
  type OfflineMutation,
} from '../domain/models';

export { CURRENCIES } from '../domain/models';
export type {
  Activity,
  ActivityLogEntry,
  CalculatedMember,
  CalculatedTrip,
  Currency,
  Expense,
  PackingItem,
  PersistedAppState,
  Photo,
  SavedPlace,
  TripAccessRole,
  TripCategoryBudgets,
  TripExchangeRates,
  TripInvitation,
  TripMembership,
  TripPermissions,
  TripRecord,
  TripReview,
  TripTask,
  TripPoll,
  TripPollOption,
  TripPollVote,
  TripComment,
  TripNotification,
  TripCollaborationSettings,
  OfflineMutation,
} from '../domain/models';

type InviteTripMemberInput = {
  email: string;
  role: Exclude<TripAccessRole, 'owner'>;
};

export type LibraryPlaceTripInput = {
  tripId: string;
  notebookPlaceId: string;
  place: Pick<SavedPlace, 'name' | 'type' | 'phone' | 'address' | 'rating' | 'note'>;
  createActivity?: boolean;
  date?: string;
  time?: string;
};

export type WorkspaceStatus = 'hydrating' | 'loading-remote' | 'ready-local' | 'ready-remote' | 'remote-unavailable' | 'schema-incompatible';

export type WorkspaceError = {
  code: RemoteWorkspaceErrorCode;
  message: string;
};

type AppContextType = {
  isHydrated: boolean;
  isRemoteMode: boolean;
  isSyncing: boolean;
  workspaceStatus: WorkspaceStatus;
  workspaceError: WorkspaceError | null;
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
  replacePersistedState: (state: PersistedAppState) => void;
  updatePersistedState: (updater: (state: PersistedAppState) => PersistedAppState) => void;
  refreshWorkspace: () => Promise<void>;
  retryWorkspaceSync: () => Promise<void>;
  batchRemote: (callback: () => Promise<void>) => Promise<void>;
  recordActivityLog: (entry: Omit<ActivityLogEntry, 'id' | 'createdAt' | 'actorId' | 'actorName'>) => void;
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
  addLibraryPlaceToTrip: (input: LibraryPlaceTripInput) => Promise<void>;
  getLinkedTripsForLibraryPlace: (notebookPlaceId: string) => CalculatedTrip[];
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

const AppContext = createContext<AppContextType | undefined>(undefined);


function toFinitePositiveNumber(value: unknown, fieldLabel: string) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    throw new Error(`${fieldLabel} phải lớn hơn 0.`);
  }
  return nextValue;
}

function toIntegerInRange(value: unknown, fieldLabel: string, minimum: number, maximum: number) {
  const nextValue = Number(value);
  if (!Number.isInteger(nextValue) || nextValue < minimum || nextValue > maximum) throw new Error(`${fieldLabel} phải từ ${minimum} đến ${maximum}.`);
  return nextValue;
}

const DEFAULT_LOCAL_WORKSPACE = import.meta.env.DEV ? INITIAL_PERSISTED_STATE : EMPTY_PERSISTED_STATE;

function prepareStoredWorkspace(state: unknown) {
  const normalizedState = normalizePersistedState(state as Partial<PersistedAppState>, EMPTY_PERSISTED_STATE);
  validateImportedSnapshot(normalizedState);
  return normalizedState;
}

function toWorkspaceError(error: unknown): WorkspaceError {
  const code = classifyRemoteWorkspaceError(error);
  const messages: Record<RemoteWorkspaceErrorCode, string> = {
    'schema-incompatible': 'Phiên bản cơ sở dữ liệu chưa tương thích. Hãy chạy migration Supabase mới nhất rồi thử lại.',
    auth: 'Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại rồi thử lại.',
    permission: 'Tài khoản không có quyền đọc workspace này.',
    network: 'Không thể kết nối Supabase. Dữ liệu cloud gần nhất được giữ nguyên.',
    unknown: 'Không thể tải workspace từ Supabase. Hãy thử lại sau.',
  };
  return { code, message: messages[code] };
}

function queueOfflineWorkspaceChanges(before: PersistedAppState, after: PersistedAppState) {
  let queue = before.offlineMutations;
  const add = (value: Omit<OfflineMutation, 'id' | 'createdAt' | 'status'>) => {
    queue = coalesceOfflineMutations(queue, { ...value, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'pending' });
  };
  const diff = <T extends { id: string; tripId?: string; updatedAt?: string }>(
    entityType: OfflineMutation['entityType'],
    oldItems: T[],
    newItems: T[],
    createPayload: (item: T) => Record<string, unknown>,
    updatePayload: (item: T) => Record<string, unknown>,
    deletePayload: (item: T) => Record<string, unknown> = () => ({}),
  ) => {
    const oldMap = new Map(oldItems.map((item) => [item.id, item]));
    const newMap = new Map(newItems.map((item) => [item.id, item]));
    newItems.forEach((item) => {
      const previous = oldMap.get(item.id);
      const tripId = item.tripId ?? item.id;
      if (!previous) add({ entityType, entityId: item.id, tripId, action: 'create', payload: createPayload(item) });
      else {
        const previousPayload = updatePayload(previous);
        const nextPayload = updatePayload(item);
        if (JSON.stringify(previousPayload) !== JSON.stringify(nextPayload)) add({ entityType, entityId: item.id, tripId, action: 'update', payload: nextPayload, restorePayload: createPayload(item), baseUpdatedAt: previous.updatedAt });
      }
    });
    oldItems.forEach((item) => {
      if (!newMap.has(item.id)) add({ entityType, entityId: item.id, tripId: item.tripId ?? item.id, action: 'delete', payload: deletePayload(item), baseUpdatedAt: item.updatedAt });
    });
  };
  diff('trip', before.trips, after.trips,
    (trip) => ({ row: { id: trip.id, ...toRemoteTrip(trip, trip.createdBy ?? before.viewerProfileId ?? '') }, ownerId: trip.createdBy ?? before.viewerProfileId }),
    (trip) => toRemoteTripUpdate(trip, trip.budget));
  diff('activity', before.activities, after.activities, (item) => toRemoteActivity(item), (item) => toRemoteActivityUpdate(item));
  diff('expense', before.expenses, after.expenses, (item) => toRemoteExpense(item), (item) => toRemoteExpenseUpdate(item));
  diff('place', before.savedPlaces, after.savedPlaces, (item) => toRemoteSavedPlace(item), (item) => toRemoteSavedPlaceUpdate(item));
  diff('packing', before.packingItems, after.packingItems, (item) => toRemotePackingItem(item), (item) => toRemotePackingItemUpdate(item));
  diff('photo', before.photos, after.photos, (item) => ({ row: toRemotePhoto(item), offlineBlobKey: item.offlineBlobKey }), (item) => toRemotePhotoUpdate(item), (item) => ({ providerPublicId: item.providerPublicId }));
  return { ...after, offlineMutations: queue };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { session, userEmail, profile } = useAuth();
  const [workspaceState, setWorkspaceState] = useState<PersistedAppState>(DEFAULT_LOCAL_WORKSPACE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>('hydrating');
  const [workspaceError, setWorkspaceError] = useState<WorkspaceError | null>(null);
  const guestWorkspaceRef = useRef<PersistedAppState>(DEFAULT_LOCAL_WORKSPACE);
  const undoStackRef = useRef<Array<() => Promise<void>>>([]);
  const batchDepthRef = useRef(0);

  const isRemoteMode = isSupabaseConfigured && Boolean(session);

  const remoteUnavailableRef = useRef(false);
  const hasLoadedRemoteRef = useRef(false);
  const loadedRemoteUserIdRef = useRef<string | null>(null);

  const refreshWorkspace = useCallback(async () => {
    if (!session || !supabase) {
      return;
    }

    setIsSyncing(true);
    if (!hasLoadedRemoteRef.current) {
      setWorkspaceStatus('loading-remote');
    }
    try {
      const nextState = await fetchRemoteWorkspace(session.user.id, userEmail);
      const storedPinnedTripIds = readRemotePinnedTripIds(session.user.id);
      const availableTripIds = new Set(nextState.trips.map((trip) => trip.id));
      const pinnedTripIds = storedPinnedTripIds.filter((tripId) => availableTripIds.has(tripId));
      if (pinnedTripIds.length !== storedPinnedTripIds.length) {
        writeRemotePinnedTripIds(session.user.id, pinnedTripIds);
      }
      remoteUnavailableRef.current = false;
      hasLoadedRemoteRef.current = true;
      loadedRemoteUserIdRef.current = session.user.id;
      setWorkspaceError(null);
      setWorkspaceStatus('ready-remote');
      setWorkspaceState((currentState) => ({
        ...mergeRemoteWorkspaceWithOffline(currentState, nextState),
        profiles: nextState.profiles,
        memberships: nextState.memberships,
        invitations: nextState.invitations,
        pinnedTripIds,
        currentTripId: currentState.currentTripId && (nextState.trips.some((trip) => trip.id === currentState.currentTripId) || currentState.offlineMutations.some((mutation) => mutation.entityType === 'trip' && mutation.entityId === currentState.currentTripId && mutation.action === 'create'))
          ? currentState.currentTripId
          : nextState.currentTripId,
      }));
    } catch (error) {
      console.warn('Remote workspace fetch failed', error);
      const nextError = toWorkspaceError(error);
      remoteUnavailableRef.current = true;
      setWorkspaceError(nextError);
      setWorkspaceStatus(nextError.code === 'schema-incompatible' ? 'schema-incompatible' : 'remote-unavailable');
      if (!hasLoadedRemoteRef.current) {
        setWorkspaceState(EMPTY_PERSISTED_STATE);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [session, userEmail]);

  useEffect(() => {
    let isMounted = true;

    void loadPersistedState<PersistedAppState>(prepareStoredWorkspace)
      .then((persistedState) => {
        if (!isMounted) {
          return;
        }

        const normalizedState = persistedState ?? DEFAULT_LOCAL_WORKSPACE;
        guestWorkspaceRef.current = normalizedState;
        if (!isRemoteMode) {
          setWorkspaceState(normalizedState);
          setWorkspaceStatus('ready-local');
        }
      })
      .catch((error) => {
        console.error('Failed to hydrate workspace state', error);
        guestWorkspaceRef.current = EMPTY_PERSISTED_STATE;
        if (!isRemoteMode) {
          setWorkspaceState(EMPTY_PERSISTED_STATE);
          setWorkspaceStatus('ready-local');
        }
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
      if (loadedRemoteUserIdRef.current !== session?.user.id) {
        hasLoadedRemoteRef.current = false;
        remoteUnavailableRef.current = false;
        setWorkspaceError(null);
        setWorkspaceState(EMPTY_PERSISTED_STATE);
      }
      const userId = session!.user.id;
      void loadRemoteCachedState(userId, prepareStoredWorkspace).then((cached) => {
        if (cached && loadedRemoteUserIdRef.current !== userId) {
          setWorkspaceState(cached);
          hasLoadedRemoteRef.current = true;
          loadedRemoteUserIdRef.current = userId;
        }
      }).finally(() => refreshWorkspace()).catch((error) => console.error('Failed to refresh remote workspace', error));
      return;
    }

    loadedRemoteUserIdRef.current = null;
    hasLoadedRemoteRef.current = false;
    remoteUnavailableRef.current = false;
    setWorkspaceError(null);
    setWorkspaceStatus('ready-local');
    setWorkspaceState(guestWorkspaceRef.current);
  }, [isHydrated, isRemoteMode, refreshWorkspace, session?.user.id]);

  useEffect(() => {
    if (!isHydrated || !isRemoteMode || !supabase || !session) {
      return;
    }

    const client = supabase;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = client
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
      void client.removeChannel(channel);
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

    if (isRemoteMode) {
      if (session?.user.id && workspaceState.viewerProfileId === session.user.id) {
        void saveRemoteCachedState(session.user.id, workspaceState).catch((error) => console.error('Failed to cache remote workspace', error));
      }
      return;
    }

    guestWorkspaceRef.current = workspaceState;
    void savePersistedState(workspaceState).catch((error) => {
      console.error('Failed to save local workspace state', error);
    });
  }, [isHydrated, isRemoteMode, session?.user.id, workspaceState]);

  const currentUserProfile = useMemo(() => {
    if (isRemoteMode) {
      return profile ?? workspaceState.profiles.find((item) => item.id === session?.user.id) ?? null;
    }

    return workspaceState.profiles.find((item) => item.id === workspaceState.viewerProfileId) ?? workspaceState.profiles[0] ?? null;
  }, [isRemoteMode, profile, session?.user.id, workspaceState.profiles, workspaceState.viewerProfileId]);

  const trips = useMemo<CalculatedTrip[]>(
    () => calculateTrips(workspaceState, currentUserProfile?.id),
    [currentUserProfile?.id, workspaceState.expenses, workspaceState.invitations, workspaceState.memberships, workspaceState.pinnedTripIds, workspaceState.profiles, workspaceState.trips],
  );

  const setCurrentTripId = useCallback((id: string | null) => {
    setWorkspaceState((currentState) => ({
      ...currentState,
      currentTripId: id,
    }));
  }, []);

  const replacePersistedState = useCallback((state: PersistedAppState) => {
    setWorkspaceState(normalizePersistedState(state, state));
  }, []);

  const updatePersistedState = useCallback((updater: (state: PersistedAppState) => PersistedAppState) => {
    setWorkspaceState((currentState) => updater(currentState));
  }, []);

  const withLocalUpdate = useCallback((updater: (state: PersistedAppState) => PersistedAppState) => {
    setWorkspaceState((currentState) => {
      const nextState = updater(currentState);
      return isRemoteMode && remoteUnavailableRef.current ? queueOfflineWorkspaceChanges(currentState, nextState) : nextState;
    });
  }, [isRemoteMode]);

  const getTripPermission = useCallback((tripId: string) => {
    const trip = trips.find((item) => item.id === tripId);
    return trip?.permissions ?? getTripPermissions(null);
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

  const assertTripEntityLinks = useCallback((tripId: string, activityId?: string, placeId?: string) => {
    if (activityId && workspaceState.activities.find((item) => item.id === activityId)?.tripId !== tripId) {
      throw new Error('Hoạt động liên kết phải thuộc cùng chuyến đi.');
    }
    if (placeId && workspaceState.savedPlaces.find((item) => item.id === placeId)?.tripId !== tripId) {
      throw new Error('Địa điểm liên kết phải thuộc cùng chuyến đi.');
    }
  }, [workspaceState.activities, workspaceState.savedPlaces]);

  const mutateRemote = useCallback(async (run: () => Promise<void>) => {
    if (!isRemoteMode) {
      return false;
    }
    if (remoteUnavailableRef.current || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      remoteUnavailableRef.current = true;
      setWorkspaceStatus('remote-unavailable');
      return false;
    }

    try {
      await run();
    } catch (error) {
      const nextError = toWorkspaceError(error);
      if (nextError.code === 'network') {
        remoteUnavailableRef.current = true;
        setWorkspaceError(nextError);
        setWorkspaceStatus('remote-unavailable');
        return false;
      }
      if (nextError.code === 'schema-incompatible' || nextError.code === 'auth') {
        remoteUnavailableRef.current = true;
        setWorkspaceError(nextError);
        setWorkspaceStatus(nextError.code === 'schema-incompatible' ? 'schema-incompatible' : 'remote-unavailable');
        throw new Error(nextError.message);
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
    workspaceStatus,
    workspaceError,
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
    updatePersistedState,
    refreshWorkspace,
    retryWorkspaceSync: refreshWorkspace,
    batchRemote,
    recordActivityLog: logTripEvent,
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
      if (membership.role === 'owner' || role === 'owner') {
        throw new Error('Không thể thay đổi vai trò owner của chuyến đi.');
      }
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
      if (membership.role === 'owner') {
        throw new Error('Không thể thu hồi owner khỏi chuyến đi.');
      }
      const revokedAt = new Date().toISOString();
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('trip_memberships').update({ revoked_at: revokedAt }).eq('id', membershipId));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        memberships: currentState.memberships.map((membership) => membership.id === membershipId ? { ...membership, revokedAt } : membership),
      }));
    },
    addExpense: async (expense) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      assertCanEditTripContent(expense.tripId);
      assertTripEntityLinks(expense.tripId, expense.activityId, expense.placeId);
      const normalizedAmount = toFinitePositiveNumber(expense.amount, 'Số tiền');
      const normalizedOriginalAmount = expense.originalAmount == null
        ? normalizedAmount
        : toFinitePositiveNumber(expense.originalAmount, 'Số tiền gốc');
      const normalizedRate = expense.exchangeRate == null ? 1 : toFinitePositiveNumber(expense.exchangeRate, 'Tỉ giá');
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('expenses').insert(toRemoteExpense(expense, {
          amount: normalizedAmount,
          originalAmount: normalizedOriginalAmount,
          exchangeRate: normalizedRate,
        })));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: expense.tripId, action: expense.isSettlement ? 'settled' : 'created', entityType: 'expense', summary: expense.isSettlement ? `Ghi nhận thanh toán: ${expense.title}` : `Thêm chi tiêu: ${expense.title}` });
        return;
      }

      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => ({
        ...currentState,
        expenses: [...currentState.expenses, { ...expense, amount: normalizedAmount, originalAmount: normalizedOriginalAmount, exchangeRate: normalizedRate, id: crypto.randomUUID(), createdAt, updatedAt: createdAt }],
      }));
      logTripEvent({ tripId: expense.tripId, action: expense.isSettlement ? 'settled' : 'created', entityType: 'expense', summary: expense.isSettlement ? `Ghi nhận thanh toán: ${expense.title}` : `Thêm chi tiêu: ${expense.title}` });
    },
    editExpense: async (id, expense) => {
      const currentExpense = workspaceState.expenses.find((item) => item.id === id);
      if (!currentExpense) {
        throw new Error('Không tìm thấy khoản chi cần cập nhật.');
      }
      assertCanEditTripContent(currentExpense.tripId);
      assertTripEntityLinks(currentExpense.tripId, expense.activityId ?? currentExpense.activityId, expense.placeId ?? currentExpense.placeId);
      const normalizedAmount = expense.amount == null ? currentExpense.amount : toFinitePositiveNumber(expense.amount, 'Số tiền');
      const normalizedOriginalAmount = expense.originalAmount == null
        ? (currentExpense.originalAmount ?? normalizedAmount)
        : toFinitePositiveNumber(expense.originalAmount, 'Số tiền gốc');
      const normalizedRate = expense.exchangeRate == null ? (currentExpense.exchangeRate ?? 1) : toFinitePositiveNumber(expense.exchangeRate, 'Tỉ giá');
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('expenses').update(toRemoteExpenseUpdate({
          ...expense,
          amount: normalizedAmount,
          originalAmount: normalizedOriginalAmount,
          exchangeRate: normalizedRate,
        })).eq('id', id));
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
            await runSupabaseMutation(() => supabase!.from('expenses').insert(toRemoteExpense(currentExpense, {
              currency: currentExpense.currency || 'VND',
              exchangeRate: currentExpense.exchangeRate || 1,
            })));
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
      assertTripEntityLinks(activity.tripId, undefined, activity.placeId);
      const normalizedActivity = { ...activity, durationMinutes: toIntegerInRange(activity.durationMinutes ?? 60, 'Thời lượng', 5, 1440), travelMinutesAfter: toIntegerInRange(activity.travelMinutesAfter ?? 0, 'Thời gian di chuyển', 0, 720) };
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('activities').insert(toRemoteActivity(normalizedActivity)));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: activity.tripId, action: 'created', entityType: 'activity', summary: `Thêm hoạt động: ${activity.title}` });
        return;
      }

      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => ({
        ...currentState,
        activities: [...currentState.activities, { ...normalizedActivity, id: crypto.randomUUID(), createdAt, updatedAt: createdAt }],
      }));
      logTripEvent({ tripId: activity.tripId, action: 'created', entityType: 'activity', summary: `Thêm hoạt động: ${activity.title}` });
    },
    editActivity: async (id, activity) => {
      const currentActivity = workspaceState.activities.find((item) => item.id === id);
      if (!currentActivity) {
        throw new Error('Không tìm thấy hoạt động cần sửa.');
      }
      assertCanEditTripContent(currentActivity.tripId);
      assertTripEntityLinks(currentActivity.tripId, undefined, activity.placeId ?? currentActivity.placeId);
      const normalizedActivity = { ...activity, ...(activity.durationMinutes === undefined ? {} : { durationMinutes: toIntegerInRange(activity.durationMinutes, 'Thời lượng', 5, 1440) }), ...(activity.travelMinutesAfter === undefined ? {} : { travelMinutesAfter: toIntegerInRange(activity.travelMinutesAfter, 'Thời gian di chuyển', 0, 720) }) };

      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('activities').update(toRemoteActivityUpdate(normalizedActivity)).eq('id', id));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: currentActivity.tripId, action: 'updated', entityType: 'activity', entityId: id, summary: `Cập nhật hoạt động: ${activity.title ?? currentActivity.title}` });
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        activities: currentState.activities.map((item) => item.id === id ? { ...item, ...normalizedActivity, updatedAt: new Date().toISOString() } : item),
      }));
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
            await runSupabaseMutation(() => supabase!.from('activities').insert(toRemoteActivity(currentActivity)));
          });
        });
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        activities: currentState.activities.filter((item) => item.id !== id),
        expenses: currentState.expenses.map((item) => item.activityId === id ? { ...item, activityId: undefined } : item),
        photos: currentState.photos.map((item) => item.activityId === id ? { ...item, activityId: undefined } : item),
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
      const dateError = getTripDateValidationError(trip.startDate, trip.endDate);
      if (dateError) throw new Error(dateError);
      const normalizedBudget = toFinitePositiveNumber(trip.budget, 'Ngân sách');
      const didRemoteMutate = await mutateRemote(async () => {
        const { data, error } = await supabase!.from('trips').insert(
          toRemoteTrip(trip, session!.user.id, normalizedBudget),
        ).select('id').single();

        if (error) {
          throw error;
        }

        try {
          await runSupabaseMutation(() => supabase!.from('trip_memberships').insert({
            trip_id: data.id,
            user_id: session!.user.id,
            role: 'owner',
          }));
        } catch (membershipError) {
          await supabase!.from('trips').delete().eq('id', data.id);
          throw membershipError;
        }
      });

      if (didRemoteMutate) {
        return;
      }

      const currentUserId = currentUserProfile?.id ?? workspaceState.viewerProfileId ?? 'm1';
      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => {
        const nextId = crypto.randomUUID();
        return {
          ...currentState,
          trips: [{ ...trip, budget: normalizedBudget, id: nextId, createdBy: currentUserId, createdAt, updatedAt: createdAt }, ...currentState.trips],
          memberships: [
            { id: crypto.randomUUID(), tripId: nextId, userId: currentUserId, role: 'owner' },
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
        const { data: newTrip, error: tripError } = await supabase!.from('trips').insert(toRemoteTrip({
          ...trip,
          title: cloneTitle,
          startDate: newStartDate,
          endDate: newEndDate,
          status: 'draft',
          review: undefined,
        }, session!.user.id, normalizedBudget)).select('id').single();

        if (tripError) throw tripError;

        try {
          const memberships = buildDuplicatedMembershipRoles(workspaceState.memberships, id, session!.user.id);
          const duplicatedUserIds = new Set(memberships.map((membership) => membership.userId));
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
              place_id: null,
              is_completed: a.isCompleted ?? false,
              duration_minutes: a.durationMinutes ?? 60,
              travel_minutes_after: a.travelMinutesAfter ?? 0,
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
              assignee_id: p.assigneeId && duplicatedUserIds.has(p.assigneeId) ? p.assigneeId : null,
            }));
            await runSupabaseMutation(() => supabase!.from('packing_items').insert(packData));
          }

          const tasks = workspaceState.tasks.filter((task) => task.tripId === id && task.status !== 'done');
          if (tasks.length > 0) {
            const taskData = tasks.map((task) => ({
              trip_id: newTrip.id,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              assignee_id: task.assigneeId && duplicatedUserIds.has(task.assigneeId) ? task.assigneeId : null,
              due_date: task.dueDate ? shiftDate(task.dueDate, startOffsetDays) : null,
              due_time: task.dueTime,
              activity_id: null,
              place_id: null,
              created_by: task.createdBy && duplicatedUserIds.has(task.createdBy) ? task.createdBy : session!.user.id,
            }));
            await runSupabaseMutation(() => supabase!.from('trip_tasks').insert(taskData));
          }
        } catch (duplicationError) {
          const { error: cleanupError } = await supabase!.from('trips').delete().eq('id', newTrip.id);
          if (cleanupError) console.error('Failed to clean up incomplete duplicated trip', cleanupError);
          throw duplicationError;
        }
      });

      if (didRemoteMutate) {
        return;
      }

      const currentUserId = currentUserProfile?.id ?? workspaceState.viewerProfileId ?? 'm1';
      withLocalUpdate((currentState) => {
        const nextId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const duplicatedMemberships = buildDuplicatedMembershipRoles(currentState.memberships, id, currentUserId);
        const duplicatedUserIds = new Set(duplicatedMemberships.map((membership) => membership.userId));
        const activitiesCopy = currentState.activities.filter(a => a.tripId === id).map((a) => ({
          ...a,
          tripId: nextId,
          date: shiftDate(a.date, startOffsetDays),
          id: crypto.randomUUID(),
          placeId: undefined,
        }));
        const packingsCopy = currentState.packingItems.filter(p => p.tripId === id).map((p) => ({
          ...p,
          tripId: nextId,
          isPacked: false,
          id: crypto.randomUUID(),
          assigneeId: p.assigneeId && duplicatedUserIds.has(p.assigneeId) ? p.assigneeId : undefined,
        }));
        const membershipsCopy = duplicatedMemberships
          .map((membership) => ({ ...membership, id: crypto.randomUUID(), tripId: nextId }));
        const tasksCopy = currentState.tasks.filter((task) => task.tripId === id && task.status !== 'done').map((task) => ({
          ...task,
          id: crypto.randomUUID(),
          tripId: nextId,
          assigneeId: task.assigneeId && duplicatedUserIds.has(task.assigneeId) ? task.assigneeId : undefined,
          dueDate: task.dueDate ? shiftDate(task.dueDate, startOffsetDays) : undefined,
          activityId: undefined,
          placeId: undefined,
          createdBy: task.createdBy && duplicatedUserIds.has(task.createdBy) ? task.createdBy : currentUserId,
          updatedAt: createdAt,
          createdAt,
        }));

        return {
          ...currentState,
          trips: [{
            ...trip,
            id: nextId,
            title: cloneTitle,
            startDate: newStartDate,
            endDate: newEndDate,
            status: 'draft',
            review: undefined,
            createdBy: currentUserId,
            createdAt,
            updatedAt: createdAt,
          }, ...currentState.trips],
          memberships: [...membershipsCopy, ...currentState.memberships],
          activities: [...activitiesCopy, ...currentState.activities],
          packingItems: [...packingsCopy, ...currentState.packingItems],
          tasks: [...tasksCopy, ...currentState.tasks],
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
          activityLogs: currentState.activityLogs.filter((entry) => entry.tripId !== id),
          collaborationSettings: currentState.collaborationSettings.filter((settings) => settings.tripId !== id),
          tasks: currentState.tasks.filter((task) => task.tripId !== id),
          polls: currentState.polls.filter((poll) => poll.tripId !== id),
          pollOptions: currentState.pollOptions.filter((option) => option.tripId !== id),
          pollVotes: currentState.pollVotes.filter((vote) => vote.tripId !== id),
          comments: currentState.comments.filter((comment) => comment.tripId !== id),
          notifications: currentState.notifications.filter((notification) => notification.tripId !== id),
          offlineMutations: currentState.offlineMutations.filter((mutation) => mutation.tripId !== id),
          pinnedTripIds: (currentState.pinnedTripIds ?? []).filter((tripId) => tripId !== id),
          currentTripId: currentState.currentTripId === id ? null : currentState.currentTripId,
        }));
      }

      if (didRemoteMutate || !isRemoteMode) {
        void Promise.allSettled(
          targets.map(p => p.providerPublicId ? deleteImageFromCloudinary(p.providerPublicId) : Promise.resolve())
        );
      }
    },
    editTrip: async (id, trip) => {
      assertCanManageTrip(id);
      const currentTrip = workspaceState.trips.find((item) => item.id === id);
      if (!currentTrip) throw new Error('Không tìm thấy chuyến đi cần sửa.');
      const dateError = getTripDateValidationError(trip.startDate ?? currentTrip.startDate, trip.endDate ?? currentTrip.endDate);
      if (dateError) throw new Error(dateError);
      const normalizedBudget = trip.budget == null ? undefined : toFinitePositiveNumber(trip.budget, 'Ngân sách');
      const remotePayload = toRemoteTripUpdate(trip, normalizedBudget);
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
        await runSupabaseMutation(() => supabase!.from('saved_places').insert(toRemoteSavedPlace(place)));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: place.tripId, action: 'created', entityType: 'place', summary: `Thêm địa điểm: ${place.name}` });
        return;
      }

      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => ({
        ...currentState,
        savedPlaces: [...currentState.savedPlaces, { ...place, id: crypto.randomUUID(), createdAt, updatedAt: createdAt }],
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
        await runSupabaseMutation(() => supabase!.from('saved_places').update(toRemoteSavedPlaceUpdate(place)).eq('id', id));
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
            await runSupabaseMutation(() => supabase!.from('saved_places').insert(toRemoteSavedPlace(currentPlace)));
          });
        });
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        savedPlaces: currentState.savedPlaces.filter((item) => item.id !== id),
        activities: currentState.activities.map((item) => item.placeId === id ? { ...item, placeId: undefined } : item),
        expenses: currentState.expenses.map((item) => item.placeId === id ? { ...item, placeId: undefined } : item),
        photos: currentState.photos.map((item) => item.placeId === id ? { ...item, placeId: undefined } : item),
      }));

      undoStackRef.current.push(async () => {
        withLocalUpdate((currentState) => ({
          ...currentState,
          savedPlaces: [...currentState.savedPlaces, currentPlace],
        }));
      });
    },
    addLibraryPlaceToTrip: async ({ tripId, notebookPlaceId, place, createActivity = false, date, time = '09:00' }) => {
      assertCanEditTripContent(tripId);
      if (createActivity && !date) {
        throw new Error('Cần chọn ngày khi thêm địa điểm vào lịch trình.');
      }

      const didRemoteMutate = await mutateRemote(async () => {
        const { error } = await supabase!.rpc('add_library_place_to_trip', {
          p_notebook_place_id: notebookPlaceId,
          p_trip_id: tripId,
          p_create_activity: createActivity,
          p_date: date ?? null,
          p_time: time,
        });
        if (error) throw error;
      });
      if (didRemoteMutate) return;

      const timestamp = Date.now();
      const savedPlaceId = crypto.randomUUID();
      const createdAt = new Date(timestamp).toISOString();
      const tripPlaceType = place.type === 'hotel' ? 'hotel' : place.type === 'restaurant' || place.type === 'cafe' ? 'restaurant' : 'other';
      withLocalUpdate((currentState) => ({
        ...currentState,
        savedPlaces: [...currentState.savedPlaces, {
          ...place,
          type: tripPlaceType,
          id: savedPlaceId,
          tripId,
          sourceNotebookPlaceId: notebookPlaceId,
          createdAt,
          updatedAt: createdAt,
        }],
        activities: createActivity ? [...currentState.activities, {
          id: crypto.randomUUID(),
          tripId,
          date: date!,
          time,
          title: place.name,
          location: place.address || place.name,
          note: place.note || '',
          type: tripPlaceType,
          placeId: savedPlaceId,
          createdAt,
          updatedAt: createdAt,
        }] : currentState.activities,
      }));
      logTripEvent({ tripId, action: 'imported', entityType: 'place', entityId: savedPlaceId, summary: `Thêm từ Thư viện: ${place.name}` });
    },
    addPackingItem: async (item) => {
      assertCanEditTripContent(item.tripId);
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('packing_items').insert(toRemotePackingItem(item)));
      });

      if (didRemoteMutate) {
        logTripEvent({ tripId: item.tripId, action: 'created', entityType: 'packing', summary: `Thêm hành lý: ${item.name}` });
        return;
      }

      const createdAt = new Date().toISOString();
      withLocalUpdate((currentState) => ({
        ...currentState,
        packingItems: [...currentState.packingItems, { ...item, id: crypto.randomUUID(), createdAt, updatedAt: createdAt }],
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
        await runSupabaseMutation(() => supabase!.from('packing_items').update(toRemotePackingItemUpdate(item)).eq('id', id));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        packingItems: currentState.packingItems.map((existingItem) => existingItem.id === id ? { ...existingItem, ...item, updatedAt: new Date().toISOString() } : existingItem),
      }));
    },
    getLinkedTripsForLibraryPlace: (notebookPlaceId) => {
      const linkedTripIds = new Set(workspaceState.savedPlaces.filter((place) => place.sourceNotebookPlaceId === notebookPlaceId).map((place) => place.tripId));
      return trips.filter((trip) => linkedTripIds.has(trip.id));
    },
    togglePackingItem: async (id) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      const currentItem = workspaceState.packingItems.find((item) => item.id === id);
      if (!currentItem) {
        return;
      }
      assertCanEditTripContent(currentItem.tripId);
      const newIsPacked = !currentItem.isPacked;

      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('packing_items').update(toRemotePackingItemUpdate({ isPacked: newIsPacked })).eq('id', id));
      });

      if (didRemoteMutate) {
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        packingItems: currentState.packingItems.map((item) => item.id === id ? { ...item, isPacked: newIsPacked, updatedAt: new Date().toISOString() } : item),
      }));
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
            await runSupabaseMutation(() => supabase!.from('packing_items').insert(toRemotePackingItem(currentItem)));
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
      photos.forEach((photo) => {
        assertCanEditTripContent(photo.tripId);
        assertTripEntityLinks(photo.tripId, photo.activityId, photo.placeId);
      });
      const didRemoteMutate = await mutateRemote(async () => {
        await runSupabaseMutation(() => supabase!.from('photos').insert(photos.map(toRemotePhoto)));
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
            id: crypto.randomUUID(),
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
      assertTripEntityLinks(currentPhoto.tripId, photo.activityId ?? currentPhoto.activityId, photo.placeId ?? currentPhoto.placeId);
      const nextPhoto = { ...currentPhoto, ...photo, updatedAt: new Date().toISOString() };
      const didRemoteMutate = await mutateRemote(async () => {
        const payload = toRemotePhotoUpdate(photo);
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
        if (currentPhoto.provider !== 'cloudinary') {
          undoStackRef.current.push(async () => {
            await mutateRemote(async () => {
              await runSupabaseMutation(() => supabase!.from('photos').insert(toRemotePhoto(currentPhoto)));
            });
          });
        }
        return;
      }

      withLocalUpdate((currentState) => ({
        ...currentState,
        photos: currentState.photos.filter((item) => item.id !== id),
      }));
      if (currentPhoto.offlineBlobKey) void deleteOfflineMedia(currentPhoto.offlineBlobKey);

      if (currentPhoto.provider !== 'cloudinary') {
        undoStackRef.current.push(async () => {
          withLocalUpdate((currentState) => ({
            ...currentState,
            photos: [...currentState.photos, currentPhoto],
          }));
        });
      }
    },
    undoLastAction: async () => {
      const action = undoStackRef.current.pop();
      if (action) {
        await action();
      }
    },
  }), [assertCanEditTripContent, assertCanManageMembers, assertCanManageTrip, assertTripEntityLinks, batchRemote, currentUserProfile, isHydrated, isRemoteMode, isSyncing, logTripEvent, mutateRemote, refreshWorkspace, replacePersistedState, setCurrentTripId, trips, updatePersistedState, withLocalUpdate, workspaceError, workspaceState, workspaceStatus, session]);

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
