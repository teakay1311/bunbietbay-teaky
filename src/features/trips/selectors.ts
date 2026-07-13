import type { CalculatedTrip, Expense, PackingItem, Photo } from '../../domain/models';
import { chainComparators, compareDate, compareNumber, compareText, stableSort } from '../../utils/listSort';

export type TripSortKey = 'startDateDesc' | 'startDateAsc' | 'createdDesc' | 'createdAsc' | 'budgetDesc' | 'budgetAsc' | 'spentDesc' | 'spentAsc' | 'titleAsc' | 'titleDesc';

export function countPackingByTrip(items: PackingItem[], packedOnly = false) {
  return items.reduce<Record<string, number>>((counts, item) => {
    if (!packedOnly || item.isPacked) counts[item.tripId] = (counts[item.tripId] ?? 0) + 1;
    return counts;
  }, {});
}

export function countPhotosByTrip(photos: Photo[]) {
  return photos.reduce<Record<string, number>>((counts, photo) => {
    counts[photo.tripId] = (counts[photo.tripId] ?? 0) + 1;
    return counts;
  }, {});
}

export function sumExpensesByTrip(expenses: Expense[]) {
  return expenses.reduce<Record<string, number>>((totals, expense) => {
    if (!expense.isSettlement) totals[expense.tripId] = (totals[expense.tripId] ?? 0) + expense.amount;
    return totals;
  }, {});
}

export function filterAndSortTrips(params: {
  trips: CalculatedTrip[];
  status: 'all' | 'upcoming' | 'completed' | 'draft';
  query: string;
  startDate: string;
  endDate: string;
  sortBy: TripSortKey;
  spentByTrip: Record<string, number>;
}) {
  const { trips, status, query, startDate, endDate, sortBy, spentByTrip } = params;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = trips.filter((trip) => {
    if (status !== 'all' && trip.status !== status) return false;
    if (normalizedQuery && !trip.title.toLowerCase().includes(normalizedQuery) && !trip.location.toLowerCase().includes(normalizedQuery)) return false;
    if (startDate && trip.startDate < startDate) return false;
    if (endDate && trip.startDate > endDate) return false;
    return true;
  });
  const pinnedFirst = (left: CalculatedTrip, right: CalculatedTrip) => Number(right.isPinned) - Number(left.isPinned);
  const fallback = (left: CalculatedTrip, right: CalculatedTrip) => compareDate(left.startDate, right.startDate, 'desc');
  const comparator = (left: CalculatedTrip, right: CalculatedTrip) => {
    switch (sortBy) {
      case 'startDateAsc': return compareDate(left.startDate, right.startDate, 'asc');
      case 'createdDesc': return compareDate(left.createdAt ?? left.startDate, right.createdAt ?? right.startDate, 'desc');
      case 'createdAsc': return compareDate(left.createdAt ?? left.startDate, right.createdAt ?? right.startDate, 'asc');
      case 'budgetDesc': return compareNumber(left.budget, right.budget, 'desc');
      case 'budgetAsc': return compareNumber(left.budget, right.budget, 'asc');
      case 'spentDesc': return compareNumber(spentByTrip[left.id] ?? 0, spentByTrip[right.id] ?? 0, 'desc');
      case 'spentAsc': return compareNumber(spentByTrip[left.id] ?? 0, spentByTrip[right.id] ?? 0, 'asc');
      case 'titleAsc': return compareText(left.title, right.title, 'asc');
      case 'titleDesc': return compareText(left.title, right.title, 'desc');
      default: return fallback(left, right);
    }
  };
  return stableSort(filtered, chainComparators(pinnedFirst, comparator, fallback));
}
