import type { CalculatedMember, Expense } from './models';

export function calculateMemberBalances(members: CalculatedMember[], expenses: Expense[]) {
  const balances = Object.fromEntries(members.map((member) => [member.id, 0])) as Record<string, number>;

  expenses.forEach((expense) => {
    if (balances[expense.paidBy] !== undefined) balances[expense.paidBy] += expense.amount;
    if (expense.participants.length === 0) return;

    const share = expense.amount / expense.participants.length;
    expense.participants.forEach((participantId) => {
      if (balances[participantId] !== undefined) balances[participantId] -= share;
    });
  });

  return balances;
}

export function buildExpenseChartData(expenses: Expense[], members: CalculatedMember[], formatDate: (date: string) => string) {
  const categoryTotals: Record<string, number> = {};
  const dateTotals: Record<string, number> = {};
  const memberTotals: Record<string, number> = {};
  const memberNames = new Map(members.map((member) => [member.id, member.displayName]));

  expenses.forEach((expense) => {
    categoryTotals[expense.category] = (categoryTotals[expense.category] ?? 0) + expense.amount;
    dateTotals[expense.date] = (dateTotals[expense.date] ?? 0) + expense.amount;
    memberTotals[expense.paidBy] = (memberTotals[expense.paidBy] ?? 0) + expense.amount;
  });

  return {
    pieData: Object.entries(categoryTotals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    barData: Object.entries(dateTotals).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date: formatDate(date), value, rawDate: date })),
    memberData: Object.entries(memberTotals).map(([id, value]) => ({ name: memberNames.get(id) ?? id, value })).sort((a, b) => b.value - a.value),
  };
}
