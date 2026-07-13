import type { Activity, Expense, PackingItem, Photo, SavedPlace, TripRecord } from '../domain/models';

export function toRemoteExpense(expense: Omit<Expense, 'id'> | Expense, overrides: Partial<Expense> = {}) {
  const value = { ...expense, ...overrides };
  return {
    ...('id' in value ? { id: value.id } : {}),
    trip_id: value.tripId,
    date: value.date,
    time: value.time,
    title: value.title,
    category: value.category,
    amount: value.amount,
    original_amount: value.originalAmount,
    currency: value.currency,
    exchange_rate: value.exchangeRate,
    paid_by: value.paidBy,
    participants: value.participants,
    note: value.note,
    receipt_image: value.receiptImage,
    is_settlement: value.isSettlement ?? false,
    activity_id: value.activityId,
    place_id: value.placeId,
  };
}

export function toRemoteExpenseUpdate(expense: Partial<Expense>) {
  return definedEntries({
    date: expense.date,
    time: expense.time,
    title: expense.title,
    category: expense.category,
    amount: expense.amount,
    original_amount: expense.originalAmount,
    currency: expense.currency,
    exchange_rate: expense.exchangeRate,
    paid_by: expense.paidBy,
    participants: expense.participants,
    note: expense.note,
    receipt_image: expense.receiptImage,
    is_settlement: expense.isSettlement,
    ...('activityId' in expense ? { activity_id: expense.activityId ?? null } : {}),
    ...('placeId' in expense ? { place_id: expense.placeId ?? null } : {}),
  });
}

export function toRemoteActivity(activity: Omit<Activity, 'id'> | Activity, overrides: Partial<Activity> = {}) {
  const value = { ...activity, ...overrides };
  return {
    ...('id' in value ? { id: value.id } : {}),
    trip_id: value.tripId,
    date: value.date,
    time: value.time,
    title: value.title,
    location: value.location,
    note: value.note,
    type: value.type,
    image: value.image,
    map_url: value.mapUrl,
    booking_code: value.bookingCode,
    place_id: value.placeId,
    is_completed: value.isCompleted ?? false,
    duration_minutes: value.durationMinutes ?? 60,
    travel_minutes_after: value.travelMinutesAfter ?? 0,
  };
}

export function toRemoteActivityUpdate(activity: Partial<Activity>) {
  return definedEntries({
    date: activity.date,
    time: activity.time,
    title: activity.title,
    location: activity.location,
    note: activity.note,
    type: activity.type,
    image: activity.image,
    map_url: activity.mapUrl,
    ...('bookingCode' in activity ? { booking_code: activity.bookingCode || null } : {}),
    ...('placeId' in activity ? { place_id: activity.placeId ?? null } : {}),
    is_completed: activity.isCompleted,
    duration_minutes: activity.durationMinutes,
    travel_minutes_after: activity.travelMinutesAfter,
  });
}

export function toRemoteTrip(trip: Omit<TripRecord, 'id'> | TripRecord, createdBy: string, budget = trip.budget) {
  return {
    title: trip.title,
    location: trip.location,
    start_date: trip.startDate,
    end_date: trip.endDate,
    budget,
    base_currency: trip.baseCurrency ?? 'VND',
    status: trip.status,
    image: trip.image,
    review: trip.review ?? null,
    created_by: createdBy,
    theme_color: trip.themeColor ?? null,
  };
}

export function toRemoteTripUpdate(trip: Partial<TripRecord>, normalizedBudget?: number) {
  return definedEntries({
    title: trip.title,
    location: trip.location,
    start_date: trip.startDate,
    end_date: trip.endDate,
    budget: normalizedBudget,
    base_currency: trip.baseCurrency,
    status: trip.status,
    image: trip.image,
    review: trip.review,
    ...('themeColor' in trip ? { theme_color: trip.themeColor ?? null } : {}),
  });
}

export function toRemoteSavedPlace(place: Omit<SavedPlace, 'id'> | SavedPlace) {
  return {
    ...('id' in place ? { id: place.id } : {}),
    trip_id: place.tripId,
    name: place.name,
    type: place.type,
    phone: place.phone,
    address: place.address,
    rating: place.rating,
    note: place.note,
    source_notebook_place_id: place.sourceNotebookPlaceId,
  };
}

export function toRemoteSavedPlaceUpdate(place: Partial<SavedPlace>) {
  return definedEntries({
    name: place.name,
    type: place.type,
    phone: place.phone,
    address: place.address,
    rating: place.rating,
    note: place.note,
    ...('sourceNotebookPlaceId' in place ? { source_notebook_place_id: place.sourceNotebookPlaceId ?? null } : {}),
  });
}

export function toRemotePackingItem(item: Omit<PackingItem, 'id'> | PackingItem) {
  return {
    ...('id' in item ? { id: item.id } : {}),
    trip_id: item.tripId,
    name: item.name,
    is_packed: item.isPacked,
    assignee_id: item.assigneeId,
    category: item.category,
  };
}

export function toRemotePackingItemUpdate(item: Partial<PackingItem>) {
  return definedEntries({
    name: item.name,
    is_packed: item.isPacked,
    ...('assigneeId' in item ? { assignee_id: item.assigneeId ?? null } : {}),
    category: item.category,
  });
}

export function toRemotePhoto(photo: Omit<Photo, 'id' | 'createdAt'> | Photo) {
  return {
    ...('id' in photo ? { id: photo.id } : {}),
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
    activity_id: photo.activityId,
    place_id: photo.placeId,
    content_hash: photo.contentHash,
    perceptual_hash: photo.perceptualHash,
    hash_version: photo.hashVersion,
    ...('createdAt' in photo ? { created_at: photo.createdAt } : {}),
  };
}

export function toRemotePhotoUpdate(photo: Partial<Photo>) {
  return definedEntries({
    album: photo.album,
    taken_on: photo.takenOn === '' ? null : photo.takenOn,
    place: photo.place === '' ? null : photo.place,
    people: photo.people,
    tags: photo.tags,
    item_type: photo.itemType,
    content: photo.content === '' ? null : photo.content,
    ...('activityId' in photo ? { activity_id: photo.activityId || null } : {}),
    ...('placeId' in photo ? { place_id: photo.placeId || null } : {}),
    content_hash: photo.contentHash,
    perceptual_hash: photo.perceptualHash,
    hash_version: photo.hashVersion,
  });
}

function definedEntries<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
