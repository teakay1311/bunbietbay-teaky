import type { CalculatedTrip, Expense, PersistedAppState, TripInvitation, TripMembership, UserProfile } from './models';
import { getTripPermissions } from './tripLogic';

export function calculateTrips(state: PersistedAppState, currentUserId?: string | null): CalculatedTrip[] {
  const profileMap = new Map<string, UserProfile>(state.profiles.map((profile) => [profile.id, profile]));
  const membershipsByTrip = groupByTrip(state.memberships);
  const invitationsByTrip = groupByTrip(state.invitations);
  const expensesByTrip = groupByTrip(state.expenses);

  return state.trips.map((trip) => {
    const tripMemberships = membershipsByTrip.get(trip.id) ?? [];
    const tripExpenses = expensesByTrip.get(trip.id) ?? [];
    const membershipRole = tripMemberships.find((membership) => !membership.revokedAt && membership.userId === currentUserId)?.role ?? null;

    const allMembers = tripMemberships.flatMap((membership) => {
      const profile = profileMap.get(membership.userId);
      if (!profile) return [];

      const amountPaid = tripExpenses
        .filter((expense) => expense.paidBy === membership.userId)
        .reduce((sum, expense) => sum + expense.amount, 0);
      const amountOwed = tripExpenses
        .filter((expense) => expense.participants.includes(membership.userId))
        .reduce((sum, expense) => sum + expense.amount / Math.max(1, expense.participants.length), 0);

      return [{
        ...profile,
        membershipId: membership.id,
        role: membership.role,
        spent: amountPaid,
        balance: amountPaid - amountOwed,
        createdAt: membership.createdAt,
        isArchived: Boolean(membership.revokedAt),
      }];
    });

    return {
      ...trip,
      spent: tripExpenses.filter((expense) => !expense.isSettlement).reduce((sum, expense) => sum + expense.amount, 0),
      members: allMembers.filter((member) => !member.isArchived),
      historicalMembers: allMembers.filter((member) => member.isArchived),
      membershipRole,
      permissions: getTripPermissions(membershipRole),
      invitationCount: (invitationsByTrip.get(trip.id) ?? []).filter((invitation) => invitation.status === 'pending').length,
      isPinned: state.pinnedTripIds?.includes(trip.id) ?? false,
    };
  });
}

function groupByTrip<T extends TripMembership | TripInvitation | Expense>(items: T[]) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => groups.set(item.tripId, [...(groups.get(item.tripId) ?? []), item]));
  return groups;
}
