import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortTrips, sumExpensesByTrip } from '../src/features/trips/selectors';
import { filterAndSortPhotos, groupPhotosByTimeline } from '../src/features/photos/selectors';
import { buildLibraryUsage, filterAndSortLibraryPlaces } from '../src/features/library/selectors';
import { buildCategoryBudgetRows, calculateCurrencyBalances, filterAndSortExpenses, getExpenseFormMembers } from '../src/features/expenses/selectors';
import { filterAndSortActivities, getScheduleInsights, groupActivitiesByDate } from '../src/features/schedule/selectors';
import { getTripPermissions } from '../src/domain/tripLogic';
import type { CalculatedMember, CalculatedTrip, Expense } from '../src/domain/models';

const member = (id: string): CalculatedMember => ({ id, email: `${id}@example.com`, displayName: id, avatar: '', membershipId: `m-${id}`, role: 'editor', spent: 0, balance: 0, isArchived: false });
const trip = (id: string, title: string, startDate: string, isPinned = false): CalculatedTrip => ({
  id, title, location: 'Hue', startDate, endDate: startDate, budget: 100, status: 'upcoming', image: '',
  spent: 0, members: [], historicalMembers: [], membershipRole: 'owner', permissions: getTripPermissions('owner'), invitationCount: 0, isPinned,
});

test('trip selector keeps pinned trips first and excludes settlements from totals', () => {
  const spent = sumExpensesByTrip([
    { id: 'e1', tripId: 't1', date: '', time: '', title: '', category: '', amount: 10, paidBy: 'u1', participants: [] },
    { id: 'e2', tripId: 't1', date: '', time: '', title: '', category: '', amount: 20, paidBy: 'u1', participants: [], isSettlement: true },
  ]);
  assert.equal(spent.t1, 10);
  assert.deepEqual(filterAndSortTrips({ trips: [trip('t1', 'Old', '2026-01-01'), trip('t2', 'Pinned', '2025-01-01', true)], status: 'all', query: '', startDate: '', endDate: '', sortBy: 'startDateDesc', spentByTrip: spent }).map((item) => item.id), ['t2', 't1']);
});

test('photo and library selectors preserve filtering, sorting and source links', () => {
  const photos = [
    { id: 'p1', tripId: 't1', url: '', album: 'A', createdAt: '2026-01-01T00:00:00Z', tags: ['sea'] },
    { id: 'p2', tripId: 't1', url: '', album: 'B', createdAt: '2026-01-02T00:00:00Z', itemType: 'journal' as const },
  ];
  assert.deepEqual(filterAndSortPhotos(photos, 'Tất cả', 'sea', 'createdDesc').map((item) => item.id), ['p1']);
  assert.equal(groupPhotosByTimeline(photos)[0].date, '2026-01-01');

  const places = [{ id: 'l1', notebookId: 'n1', name: 'Cafe', type: 'cafe' as const, rating: 5, createdAt: '2026-01-01', updatedAt: '2026-01-01' }];
  assert.equal(filterAndSortLibraryPlaces({ places, notebookId: 'n1', type: 'cafe', query: 'caf', sortBy: 'ratingDesc' }).length, 1);
  assert.equal(buildLibraryUsage([{ id: 's1', tripId: 't1', name: 'Cafe', type: 'cafe', sourceNotebookPlaceId: 'l1' }]).get('l1')?.has('t1'), true);
});

test('expense selectors keep archived participants in currency balances and budget totals', () => {
  const expenses: Expense[] = [{ id: 'e1', tripId: 't1', date: '2026-01-01', time: '08:30 AM', title: 'Lunch', category: 'Food', amount: 100, paidBy: 'u1', participants: ['u1', 'u2'], currency: 'USD', originalAmount: 4 }];
  assert.equal(filterAndSortExpenses({ expenses, query: 'lunch', category: 'all', payer: 'all', participant: 'u2', sortBy: 'dateDesc', members: [member('u1'), member('u2')] }).length, 1);
  assert.deepEqual(calculateCurrencyBalances(expenses, [member('u1'), member('u2')], 'VND').USD, { u1: 2, u2: -2 });
  assert.deepEqual(buildCategoryBudgetRows(expenses, { Food: 120 }, ['Food']), [{ category: 'Food', budget: 120, spent: 100 }]);

  const active = member('u1');
  const archived = { ...member('u2'), isArchived: true };
  const expenseTrip = { ...trip('t1', 'Trip', '2026-01-01'), members: [active], historicalMembers: [archived] };
  assert.deepEqual(getExpenseFormMembers(expenseTrip, expenses[0]).map((item) => item.id), ['u1', 'u2']);
  assert.deepEqual(getExpenseFormMembers(expenseTrip, null).map((item) => item.id), ['u1']);
});

test('schedule selectors group activities and report tight time gaps', () => {
  const activities = [
    { id: 'a1', tripId: 't1', date: '2026-01-01', time: '08:00', title: 'A', location: 'Hue', note: '', type: 'cafe' },
    { id: 'a2', tripId: 't1', date: '2026-01-01', time: '08:20', title: 'B', location: 'Hue', note: '', type: 'cafe' },
  ];
  const sorted = filterAndSortActivities(activities, '', 'timeDesc');
  assert.deepEqual(sorted.map((item) => item.id), ['a2', 'a1']);
  assert.equal(groupActivitiesByDate(sorted)['2026-01-01'].length, 2);
  assert.equal(getScheduleInsights(activities)[0].type, 'warning');
});
