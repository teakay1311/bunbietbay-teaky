import type { OfflineMutation, TripCollaborationSettings, TripPollOption, TripPollVote, TripTask, TripAccessRole } from '../../domain/models';

export const DEFAULT_COLLABORATION_SETTINGS: Omit<TripCollaborationSettings, 'tripId'> = {
  viewerCanVote: true,
  viewerCanComment: true,
  viewerCanUpdateAssignedTasks: true,
};

export function getCollaborationPermissions(role: TripAccessRole | null, settings?: TripCollaborationSettings) {
  const effective = settings ?? { tripId: '', ...DEFAULT_COLLABORATION_SETTINGS };
  const canEdit = role === 'owner' || role === 'admin' || role === 'editor';
  return {
    canManageSettings: role === 'owner' || role === 'admin',
    canCreateTasks: canEdit,
    canCreatePolls: canEdit,
    canVote: canEdit || (role === 'viewer' && effective.viewerCanVote),
    canComment: canEdit || (role === 'viewer' && effective.viewerCanComment),
    canUpdateAssignedTasks: canEdit || (role === 'viewer' && effective.viewerCanUpdateAssignedTasks),
    canManageShares: role === 'owner' || role === 'admin',
  };
}

export function getTaskDashboard(tasks: TripTask[], viewerId: string | undefined, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const upcomingLimit = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  return {
    mine: viewerId ? tasks.filter((task) => task.assigneeId === viewerId && task.status !== 'done') : [],
    overdue: tasks.filter((task) => task.status !== 'done' && task.dueDate && task.dueDate < today),
    upcoming: tasks.filter((task) => task.status !== 'done' && task.dueDate && task.dueDate >= today && task.dueDate <= upcomingLimit),
  };
}

export function getPollResults(options: TripPollOption[], votes: TripPollVote[]) {
  return options.map((option) => ({ option, votes: votes.filter((vote) => vote.optionId === option.id) }));
}

export function coalesceOfflineMutations(mutations: OfflineMutation[], next: OfflineMutation) {
  const index = mutations.findIndex((item) => item.entityType === next.entityType && item.entityId === next.entityId && item.status === 'pending');
  if (index < 0) return [...mutations, next];
  const current = mutations[index];
  if (current.action === 'create' && next.action === 'delete') return mutations.filter((_, itemIndex) => itemIndex !== index);
  const action: OfflineMutation['action'] = next.action === 'delete' ? 'delete' : current.action === 'create' ? 'create' : 'update';
  const merged: OfflineMutation = { ...current, ...next, action, payload: action === 'delete' ? {} : { ...current.payload, ...next.payload }, baseUpdatedAt: current.baseUpdatedAt };
  return mutations.map((item, itemIndex) => itemIndex === index ? merged : item);
}

export function orderOfflineMutations(mutations: OfflineMutation[]) {
  const createPriority: Record<OfflineMutation['entityType'], number> = { trip: 0, activity: 1, place: 1, expense: 2, packing: 2, task: 2, poll: 2, vote: 3, comment: 3, photo: 4 };
  return mutations.map((mutation, index) => ({ mutation, index })).sort((left, right) => {
    const leftPriority = left.mutation.action === 'delete' ? 10 - createPriority[left.mutation.entityType] : createPriority[left.mutation.entityType];
    const rightPriority = right.mutation.action === 'delete' ? 10 - createPriority[right.mutation.entityType] : createPriority[right.mutation.entityType];
    return leftPriority - rightPriority || left.index - right.index;
  }).map((item) => item.mutation);
}
