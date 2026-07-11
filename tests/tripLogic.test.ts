import test from 'node:test';
import assert from 'node:assert/strict';
import { getTripPermissions } from '../src/domain/tripLogic';
import { buildExpenseChartData, calculateMemberBalances } from '../src/domain/expenseLogic';
import type { CalculatedMember, Expense } from '../src/domain/models';

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
