import type { NotebookPlace, SavedPlace } from '../../domain/models';
import { chainComparators, compareDate, compareNumber, compareText, stableSort } from '../../utils/listSort';

export type NotebookPlaceSortKey = 'createdDesc' | 'createdAsc' | 'ratingDesc' | 'ratingAsc' | 'nameAsc' | 'nameDesc' | 'typeAsc';

export function buildLibraryUsage(savedPlaces: SavedPlace[]) {
  const usage = new Map<string, Set<string>>();
  savedPlaces.forEach((place) => {
    if (!place.sourceNotebookPlaceId) return;
    const trips = usage.get(place.sourceNotebookPlaceId) ?? new Set<string>();
    trips.add(place.tripId);
    usage.set(place.sourceNotebookPlaceId, trips);
  });
  return usage;
}

export function filterAndSortLibraryPlaces(params: {
  places: NotebookPlace[];
  notebookId: string;
  type: 'all' | NotebookPlace['type'];
  query: string;
  sortBy: NotebookPlaceSortKey;
}) {
  const query = params.query.trim().toLowerCase();
  const filtered = params.places.filter((place) => {
    if (params.notebookId !== 'all' && place.notebookId !== params.notebookId) return false;
    if (params.type !== 'all' && place.type !== params.type) return false;
    return !query || place.name.toLowerCase().includes(query)
      || place.address?.toLowerCase().includes(query)
      || place.note?.toLowerCase().includes(query)
      || place.customFields?.some((field) => field.value.toLowerCase().includes(query));
  });
  const fallback = (left: NotebookPlace, right: NotebookPlace) => compareText(left.name, right.name, 'asc');
  const comparator = (left: NotebookPlace, right: NotebookPlace) => {
    switch (params.sortBy) {
      case 'createdAsc': return compareDate(left.createdAt, right.createdAt, 'asc');
      case 'ratingDesc': return compareNumber(left.rating, right.rating, 'desc');
      case 'ratingAsc': return compareNumber(left.rating, right.rating, 'asc');
      case 'nameAsc': return compareText(left.name, right.name, 'asc');
      case 'nameDesc': return compareText(left.name, right.name, 'desc');
      case 'typeAsc': return compareText(left.type, right.type, 'asc');
      default: return compareDate(left.createdAt, right.createdAt, 'desc');
    }
  };
  return stableSort(filtered, chainComparators(comparator, fallback));
}
