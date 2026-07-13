import type { Photo } from '../../domain/models';
import { chainComparators, compareDate, compareText, stableSort } from '../../utils/listSort';

export type PhotoSortKey = 'createdDesc' | 'createdAsc' | 'takenDesc' | 'takenAsc' | 'albumAsc' | 'placeAsc' | 'photosFirst' | 'journalsFirst';

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
