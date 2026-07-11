import { supabase } from '../lib/supabase';
import { APP_STATE_VERSION } from '../utils/appState';
import type {
  Activity,
  ActivityLogEntry,
  Currency,
  PackingItem,
  PersistedAppState,
  Photo,
  SavedPlace,
  TripAccessRole,
  TripCategoryBudgets,
  TripExchangeRates,
  TripInvitation,
  TripRecord,
  TripReview,
  UserProfile,
} from '../domain/models';

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
  revoked_at: string | null;
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

export function getRemoteErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return error instanceof Error ? error.message : String(error);
}

export async function fetchRemoteWorkspace(userId: string, email: string | null): Promise<PersistedAppState> {
  if (!supabase) {
    throw new Error('Supabase chưa được cấu hình');
  }

  const membershipResponse = await supabase
    .from('trip_memberships')
    .select('id, trip_id, user_id, role, created_at, revoked_at')
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (membershipResponse.error) {
    const errorMessage = getRemoteErrorMessage(membershipResponse.error);
    if (errorMessage.includes('schema cache') || errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      throw membershipResponse.error;
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
    supabase.from('trip_memberships').select('id, trip_id, user_id, role, created_at, revoked_at').in('trip_id', tripIds),
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
      revokedAt: membership.revoked_at ?? undefined,
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
