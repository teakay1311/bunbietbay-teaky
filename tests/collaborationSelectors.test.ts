import test from 'node:test';
import assert from 'node:assert/strict';
import { coalesceOfflineMutations, getCollaborationPermissions, getPollResults, getTaskDashboard, orderOfflineMutations } from '../src/features/collaboration/selectors';
import type { OfflineMutation, TripPollOption, TripPollVote, TripTask } from '../src/domain/models';

test('viewer collaboration permissions follow each trip setting independently', () => {
  const settings = { tripId: 't1', viewerCanVote: false, viewerCanComment: true, viewerCanUpdateAssignedTasks: false };
  assert.deepEqual(getCollaborationPermissions('viewer', settings), {
    canManageSettings: false,
    canCreateTasks: false,
    canCreatePolls: false,
    canVote: false,
    canComment: true,
    canUpdateAssignedTasks: false,
    canManageShares: false,
  });
  assert.equal(getCollaborationPermissions('editor', settings).canVote, true);
  assert.equal(getCollaborationPermissions('admin', settings).canManageShares, true);
});

test('task dashboard keeps mine, overdue and upcoming sets deterministic', () => {
  const base = { tripId: 't1', description: undefined, priority: 'normal', dueTime: undefined, activityId: undefined, placeId: undefined, createdBy: 'u1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } as const;
  const tasks: TripTask[] = [
    { ...base, id: 'late', title: 'Late', status: 'todo', assigneeId: 'u1', dueDate: '2026-01-09' },
    { ...base, id: 'soon', title: 'Soon', status: 'in_progress', assigneeId: 'u2', dueDate: '2026-01-12' },
    { ...base, id: 'done', title: 'Done', status: 'done', assigneeId: 'u1', dueDate: '2026-01-08' },
  ];
  const result = getTaskDashboard(tasks, 'u1', new Date('2026-01-10T12:00:00Z'));
  assert.deepEqual(result.mine.map((item) => item.id), ['late']);
  assert.deepEqual(result.overdue.map((item) => item.id), ['late']);
  assert.deepEqual(result.upcoming.map((item) => item.id), ['soon']);
});

test('poll results retain options without votes and aggregate public voters', () => {
  const options = [{ id: 'o1', pollId: 'p1', tripId: 't1', label: 'A', createdAt: 'x' }, { id: 'o2', pollId: 'p1', tripId: 't1', label: 'B', createdAt: 'x' }] as TripPollOption[];
  const votes = [{ id: 'v1', pollId: 'p1', optionId: 'o2', tripId: 't1', userId: 'u1', createdAt: 'x' }] as TripPollVote[];
  assert.deepEqual(getPollResults(options, votes).map((item) => [item.option.id, item.votes.length]), [['o1', 0], ['o2', 1]]);
});

test('offline queue coalesces updates and removes create followed by delete', () => {
  const mutation = (action: OfflineMutation['action'], payload: Record<string, unknown>): OfflineMutation => ({ id: crypto.randomUUID(), entityType: 'task', entityId: 'task-1', tripId: 'trip-1', action, payload, createdAt: new Date().toISOString(), status: 'pending' });
  let queue = coalesceOfflineMutations([], mutation('create', { title: 'A' }));
  queue = coalesceOfflineMutations(queue, mutation('update', { status: 'done' }));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].action, 'create');
  assert.deepEqual(queue[0].payload, { title: 'A', status: 'done' });
  queue = coalesceOfflineMutations(queue, mutation('delete', {}));
  assert.equal(queue.length, 0);

  queue = coalesceOfflineMutations([], mutation('update', { title: 'B' }));
  queue = coalesceOfflineMutations(queue, mutation('delete', {}));
  assert.equal(queue[0].action, 'delete');
});

test('offline replay orders parent creates first and parent deletes last', () => {
  const item = (entityType: OfflineMutation['entityType'], action: OfflineMutation['action']): OfflineMutation => ({ id: `${entityType}-${action}`, entityType, entityId: entityType, tripId: 'trip', action, payload: {}, createdAt: '2026-01-01T00:00:00Z', status: 'pending' });
  assert.deepEqual(orderOfflineMutations([item('photo', 'create'), item('comment', 'create'), item('trip', 'create')]).map((entry) => entry.entityType), ['trip', 'comment', 'photo']);
  assert.deepEqual(orderOfflineMutations([item('trip', 'delete'), item('comment', 'delete'), item('photo', 'delete')]).map((entry) => entry.entityType), ['photo', 'comment', 'trip']);
});
