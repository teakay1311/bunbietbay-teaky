import type { CalculatedTrip, Photo } from '../../domain/models';
import { chainComparators, compareDate, compareText, stableSort } from '../../utils/listSort';

export type PhotoSortKey = 'createdDesc' | 'createdAsc' | 'takenDesc' | 'takenAsc' | 'albumAsc' | 'placeAsc' | 'photosFirst' | 'journalsFirst';
export type GlobalPhotoSortKey = 'takenDesc' | 'takenAsc' | 'createdDesc' | 'createdAsc' | 'tripAsc' | 'albumAsc';

export type PhotoTripFolder = {
  trip: CalculatedTrip;
  photos: Photo[];
  photoCount: number;
  coverUrl: string;
};

export type GlobalPhotoFilters = {
  query: string;
  tripId: string;
  album: string;
  dateFrom: string;
  dateTo: string;
  place: string;
  tag: string;
  person: string;
  sortBy: GlobalPhotoSortKey;
};

export function normalizePhotoSearchText(value: string | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function buildPhotoTripFolders(trips: CalculatedTrip[], photos: Photo[]): PhotoTripFolder[] {
  const photosByTrip = new Map<string, Photo[]>();
  photos.forEach((photo) => {
    if (photo.itemType === 'journal') return;
    photosByTrip.set(photo.tripId, [...(photosByTrip.get(photo.tripId) ?? []), photo]);
  });

  return stableSort(trips, (left, right) => compareDate(left.startDate, right.startDate, 'desc')).map((trip) => {
    const tripPhotos = stableSort(photosByTrip.get(trip.id) ?? [], (left, right) => compareDate(left.takenOn ?? left.createdAt, right.takenOn ?? right.createdAt, 'desc'));
    return {
      trip,
      photos: tripPhotos,
      photoCount: tripPhotos.length,
      coverUrl: tripPhotos[0]?.url || trip.image,
    };
  });
}

export function filterAndSortGlobalPhotos({
  photos,
  trips,
  filters,
}: {
  photos: Photo[];
  trips: CalculatedTrip[];
  filters: GlobalPhotoFilters;
}) {
  const tripById = new Map(trips.map((trip) => [trip.id, trip]));
  const query = normalizePhotoSearchText(filters.query.trim());
  const matchesValue = (value: string | undefined, filter: string) => !filter || normalizePhotoSearchText(value) === normalizePhotoSearchText(filter);
  const filtered = photos.filter((photo) => {
    if (photo.itemType === 'journal') return false;
    const trip = tripById.get(photo.tripId);
    if (!trip) return false;
    if (filters.tripId && photo.tripId !== filters.tripId) return false;
    if (!matchesValue(photo.album, filters.album)) return false;
    if (!matchesValue(photo.place, filters.place)) return false;
    if (filters.tag && !photo.tags?.some((tag) => matchesValue(tag, filters.tag))) return false;
    if (filters.person && !photo.people?.some((person) => matchesValue(person, filters.person))) return false;
    const photoDate = photo.takenOn || photo.createdAt.slice(0, 10);
    if (filters.dateFrom && photoDate < filters.dateFrom) return false;
    if (filters.dateTo && photoDate > filters.dateTo) return false;
    if (!query) return true;
    const haystack = normalizePhotoSearchText([
      trip.title,
      trip.location,
      photo.album,
      photo.place,
      photo.takenOn,
      photo.createdAt.slice(0, 10),
      ...(photo.tags ?? []),
      ...(photo.people ?? []),
    ].join(' '));
    return query.split(/\s+/).every((token) => haystack.includes(token));
  });

  const fallback = (left: Photo, right: Photo) => compareDate(left.createdAt, right.createdAt, 'desc');
  const comparator = (left: Photo, right: Photo) => {
    switch (filters.sortBy) {
      case 'takenAsc': return compareDate(left.takenOn ?? left.createdAt, right.takenOn ?? right.createdAt, 'asc');
      case 'createdDesc': return fallback(left, right);
      case 'createdAsc': return compareDate(left.createdAt, right.createdAt, 'asc');
      case 'tripAsc': return compareText(tripById.get(left.tripId)?.title, tripById.get(right.tripId)?.title, 'asc');
      case 'albumAsc': return compareText(left.album, right.album, 'asc');
      default: return compareDate(left.takenOn ?? left.createdAt, right.takenOn ?? right.createdAt, 'desc');
    }
  };
  return stableSort(filtered, chainComparators(comparator, fallback));
}

export function getPhotoAlbums(photos: Photo[]) {
  return ['Tất cả', ...Array.from(new Set(photos.map((photo) => photo.album)))];
}

export function filterAndSortPhotos(photos: Photo[], selectedAlbum: string, searchQuery: string, sortBy: PhotoSortKey) {
  const query = searchQuery.trim().toLowerCase();
  const filtered = photos.filter((photo) => {
    if (selectedAlbum !== 'Tất cả' && photo.album !== selectedAlbum) return false;
    if (!query) return true;
    return photo.album.toLowerCase().includes(query)
      || photo.place?.toLowerCase().includes(query)
      || photo.tags?.some((tag) => tag.toLowerCase().includes(query))
      || photo.people?.some((person) => person.toLowerCase().includes(query))
      || photo.takenOn?.includes(query);
  });
  const fallback = (left: Photo, right: Photo) => compareDate(left.createdAt, right.createdAt, 'desc');
  const typeRank = (photo: Photo, journalFirst = false) => {
    const isJournal = photo.itemType === 'journal';
    return journalFirst ? (isJournal ? 0 : 1) : (isJournal ? 1 : 0);
  };
  const comparator = (left: Photo, right: Photo) => {
    switch (sortBy) {
      case 'createdAsc': return compareDate(left.createdAt, right.createdAt, 'asc');
      case 'takenDesc': return compareDate(left.takenOn ?? left.createdAt, right.takenOn ?? right.createdAt, 'desc');
      case 'takenAsc': return compareDate(left.takenOn ?? left.createdAt, right.takenOn ?? right.createdAt, 'asc');
      case 'albumAsc': return compareText(left.album, right.album, 'asc');
      case 'placeAsc': return compareText(left.place, right.place, 'asc');
      case 'photosFirst': return typeRank(left) - typeRank(right);
      case 'journalsFirst': return typeRank(left, true) - typeRank(right, true);
      default: return fallback(left, right);
    }
  };
  return stableSort(filtered, chainComparators(comparator, fallback));
}

export function groupPhotosByTimeline(photos: Photo[]) {
  const groups = new Map<string, Photo[]>();
  photos.forEach((photo) => {
    const date = photo.takenOn || photo.createdAt.slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), photo]);
  });
  return Array.from(groups, ([date, groupPhotos]) => ({ date, photos: groupPhotos }));
}
