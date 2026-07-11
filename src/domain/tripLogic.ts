import type { CalculatedMember, CalculatedTrip, TripAccessRole, TripPermissions } from './models';

export function getTripPermissions(role: TripAccessRole | null): TripPermissions {
  const canEditContent = role === 'owner' || role === 'admin' || role === 'editor';
  const canManageMembers = role === 'owner' || role === 'admin';
  return {
    canEditContent,
    canManageMembers,
    canManageTrip: canManageMembers,
    canDeleteTrip: role === 'owner',
    canInvite: canManageMembers,
  };
}

export function getFinancialMembers(trip: CalculatedTrip | undefined): CalculatedMember[] {
  return trip ? [...trip.members, ...trip.historicalMembers] : [];
}
