import type { OfflineMutation, PersistedAppState } from '../domain/models';

export function mergeRemoteWorkspaceWithOffline(current: PersistedAppState, remote: PersistedAppState): PersistedAppState {
  if (!current.offlineMutations.length) return { ...current, ...remote };
  const queuedIds = (entityType: OfflineMutation['entityType']) => new Set(current.offlineMutations.filter((item) => item.entityType === entityType).map((item) => item.entityId));
  const structuralTripIds = new Set(current.offlineMutations.filter((item) => item.entityType === 'trip' && item.action !== 'update').map((item) => item.entityId));
  const merge = <T extends { id: string; tripId?: string }>(serverItems: T[], localItems: T[], ids: Set<string>) => {
    const preserve = (item: T) => ids.has(item.id) || Boolean(item.tripId && structuralTripIds.has(item.tripId));
    return [...serverItems.filter((item) => !preserve(item)), ...localItems.filter(preserve)];
  };
  const pollIds = queuedIds('poll');
  const voteTripIds = new Set(current.offlineMutations.filter((item) => item.entityType === 'vote').map((item) => item.tripId));
  return {
    ...remote,
    trips: merge(remote.trips, current.trips, queuedIds('trip')),
    memberships: merge(remote.memberships, current.memberships, new Set()),
    activities: merge(remote.activities, current.activities, queuedIds('activity')),
    expenses: merge(remote.expenses, current.expenses, queuedIds('expense')),
    savedPlaces: merge(remote.savedPlaces, current.savedPlaces, queuedIds('place')),
    packingItems: merge(remote.packingItems, current.packingItems, queuedIds('packing')),
    photos: merge(remote.photos, current.photos, queuedIds('photo')),
    tasks: merge(remote.tasks, current.tasks, queuedIds('task')),
    polls: merge(remote.polls, current.polls, pollIds),
    pollOptions: [...remote.pollOptions.filter((item) => !pollIds.has(item.pollId) && !structuralTripIds.has(item.tripId)), ...current.pollOptions.filter((item) => pollIds.has(item.pollId) || structuralTripIds.has(item.tripId))],
    pollVotes: [...remote.pollVotes.filter((item) => !voteTripIds.has(item.tripId) && !structuralTripIds.has(item.tripId)), ...current.pollVotes.filter((item) => voteTripIds.has(item.tripId) || structuralTripIds.has(item.tripId))],
    comments: merge(remote.comments, current.comments, queuedIds('comment')),
    activityLogs: [...remote.activityLogs.filter((item) => !structuralTripIds.has(item.tripId)), ...current.activityLogs.filter((item) => structuralTripIds.has(item.tripId))],
    offlineMutations: current.offlineMutations,
    currentTripId: current.currentTripId,
    pinnedTripIds: current.pinnedTripIds,
  };
}
