import test from 'node:test';
import assert from 'node:assert/strict';
import { getTripPermissions } from '../src/domain/tripLogic';
import { calculateTrips } from '../src/domain/calculateTrips';
import { buildExpenseChartData, calculateMemberBalances } from '../src/domain/expenseLogic';
import type { CalculatedMember, Expense, PersistedAppState } from '../src/domain/models';

const member = (id: string, isArchived = false): CalculatedMember => ({
  id,
  email: `${id}@example.com`,
  displayName: id,
  avatar: '',
  membershipId: `membership-${id}`,
  role: 'editor',
  spent: 0,
  balance: 0,
  isArchived,
});

test('maps trip roles to the existing permission contract', () => {
  assert.deepEqual(getTripPermissions('viewer'), {
    canEditContent: false,
    canManageMembers: false,
    canManageTrip: false,
    canDeleteTrip: false,
    canInvite: false,
  });
  assert.equal(getTripPermissions('owner').canDeleteTrip, true);
  assert.equal(getTripPermissions('editor').canEditContent, true);
});

test('keeps balances at zero including archived members', () => {
  const expense: Expense = {
    id: 'e1', tripId: 't1', date: '2026-01-01', time: '09:00', title: 'Lunch', category: 'Food',
    amount: 300, paidBy: 'active', participants: ['active', 'archived', 'viewer'],
  };
  const balances = calculateMemberBalances([member('active'), member('archived', true), member('viewer')], [expense]);
  assert.deepEqual(balances, { active: 200, archived: -100, viewer: -100 });
  assert.equal(Object.values(balances).reduce((sum, balance) => sum + balance, 0), 0);
});

test('builds stable chart data and resolves archived member names', () => {
  const expenses: Expense[] = [
    { id: 'e1', tripId: 't1', date: '2026-01-02', time: '09:00', title: 'B', category: 'Food', amount: 100, paidBy: 'archived', participants: ['active'] },
    { id: 'e2', tripId: 't1', date: '2026-01-01', time: '09:00', title: 'A', category: 'Food', amount: 50, paidBy: 'active', participants: ['active'] },
  ];
  const data = buildExpenseChartData(expenses, [member('active'), member('archived', true)], (date) => date);
  assert.deepEqual(data.pieData, [{ name: 'Food', value: 150 }]);
  assert.deepEqual(data.barData.map((item) => item.rawDate), ['2026-01-01', '2026-01-02']);
  assert.equal(data.memberData[0].name, 'archived');
});

test('derives active and historical trip members without changing persisted data', () => {
  const state: PersistedAppState = {
    version: 7,
    trips: [{ id: 't1', title: 'Trip', location: 'Hue', startDate: '2026-01-01', endDate: '2026-01-02', budget: 500, status: 'upcoming', image: '' }],
    profiles: [
      { id: 'active', email: 'active@example.com', displayName: 'Active', avatar: '' },
      { id: 'archived', email: 'archived@example.com', displayName: 'Archived', avatar: '' },
    ],
    memberships: [
      { id: 'm1', tripId: 't1', userId: 'active', role: 'owner' },
      { id: 'm2', tripId: 't1', userId: 'archived', role: 'editor', revokedAt: '2026-01-03T00:00:00.000Z' },
    ],
    invitations: [], activities: [], savedPlaces: [], packingItems: [], photos: [], activityLogs: [], collaborationSettings: [], tasks: [], polls: [], pollOptions: [], pollVotes: [], comments: [], notifications: [], offlineMutations: [],
    expenses: [{ id: 'e1', tripId: 't1', date: '2026-01-01', time: '09:00', title: 'Lunch', category: 'Food', amount: 200, paidBy: 'archived', participants: ['active', 'archived'] }],
    currentTripId: 't1', viewerProfileId: 'active', pinnedTripIds: ['t1'],
  };

  const [trip] = calculateTrips(state, 'active');
  assert.equal(trip.members[0].displayName, 'Active');
  assert.equal(trip.historicalMembers[0].displayName, 'Archived');
  assert.equal(trip.historicalMembers[0].balance, 100);
  assert.equal(trip.membershipRole, 'owner');
  assert.equal(trip.spent, 200);
  assert.equal(trip.isPinned, true);
  assert.equal(state.memberships[1].revokedAt, '2026-01-03T00:00:00.000Z');
});
