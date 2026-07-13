import type { CalculatedMember, CalculatedTrip, Currency, Expense, TripCategoryBudgets } from '../../domain/models';
import { normalizeTimeForInput } from '../../utils/date';
import { chainComparators, compareDate, compareNumber, compareText, stableSort } from '../../utils/listSort';

export type ExpenseSortKey = 'dateDesc' | 'dateAsc' | 'amountDesc' | 'amountAsc' | 'categoryAsc' | 'payerAsc' | 'titleAsc';

export function getExpenseFormMembers(trip: CalculatedTrip | undefined, expense: Expense | null) {
  if (!trip || !expense) return trip?.members ?? [];
  const referencedIds = new Set([expense.paidBy, ...expense.participants]);
  return [
    ...trip.members,
    ...trip.historicalMembers.filter((member) => referencedIds.has(member.id)),
  ];
}

export function filterAndSortExpenses(params: {
  expenses: Expense[]; query: string; category: string; payer: string; participant: string;
  sortBy: ExpenseSortKey; members: CalculatedMember[];
}) {
  const query = params.query.trim().toLowerCase();
  const filtered = params.expenses.filter((expense) => (
    (!query || expense.title.toLowerCase().includes(query) || expense.category.toLowerCase().includes(query) || expense.note?.toLowerCase().includes(query))
    && (params.category === 'all' || expense.category === params.category)
    && (params.payer === 'all' || expense.paidBy === params.payer)
    && (params.participant === 'all' || expense.participants.includes(params.participant))
  ));
  const memberNameById = new Map(params.members.map((member) => [member.id, member.displayName]));
  const dateValue = (expense: Expense) => `${expense.date}T${normalizeTimeForInput(expense.time)}`;
  const fallback = (left: Expense, right: Expense) => compareDate(dateValue(left), dateValue(right), 'desc');
  const comparator = (left: Expense, right: Expense) => {
    switch (params.sortBy) {
      case 'dateAsc': return compareDate(dateValue(left), dateValue(right), 'asc');
      case 'amountDesc': return compareNumber(left.amount, right.amount, 'desc');
      case 'amountAsc': return compareNumber(left.amount, right.amount, 'asc');
      case 'categoryAsc': return compareText(left.category, right.category, 'asc');
      case 'payerAsc': return compareText(memberNameById.get(left.paidBy) ?? left.paidBy, memberNameById.get(right.paidBy) ?? right.paidBy, 'asc');
      case 'titleAsc': return compareText(left.title, right.title, 'asc');
      default: return fallback(left, right);
    }
  };
  return stableSort(filtered, chainComparators(comparator, fallback));
}

export function calculateCurrencyBalances(expenses: Expense[], members: CalculatedMember[], baseCurrency: Currency) {
  const balances: Record<string, Record<string, number>> = {};
  expenses.forEach((expense) => {
    const currency = expense.currency || baseCurrency;
    balances[currency] ??= Object.fromEntries(members.map((member) => [member.id, 0]));
    const amount = expense.originalAmount || expense.amount;
    if (balances[currency][expense.paidBy] !== undefined) balances[currency][expense.paidBy] += amount;
    if (expense.participants.length > 0) {
      const share = amount / expense.participants.length;
      expense.participants.forEach((participantId) => {
        if (balances[currency][participantId] !== undefined) balances[currency][participantId] -= share;
      });
    }
  });
  return balances;
}

export function buildCategoryBudgetRows(expenses: Expense[], budgets: TripCategoryBudgets, categories: string[]) {
  const totals = expenses.reduce<Record<string, number>>((result, expense) => {
    result[expense.category] = (result[expense.category] ?? 0) + expense.amount;
    return result;
  }, {});
  return Array.from(new Set([...categories, ...Object.keys(budgets), ...Object.keys(totals)]))
    .map((category) => ({ category, budget: budgets[category] ?? 0, spent: totals[category] ?? 0 }))
    .filter((row) => row.budget > 0 || row.spent > 0);
}
