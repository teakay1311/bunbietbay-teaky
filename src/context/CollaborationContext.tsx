import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppContext } from './AppContext';
import { supabase } from '../lib/supabase';
import { classifyRemoteWorkspaceError } from '../utils/cloudSyncDecisions';
import { coalesceOfflineMutations, DEFAULT_COLLABORATION_SETTINGS, getCollaborationPermissions, orderOfflineMutations } from '../features/collaboration/selectors';
import type {
  OfflineMutation,
  PublicTripShare,
  PublicTripShareScope,
  TripCollaborationSettings,
  TripComment,
  TripCommentTargetType,
  TripPoll,
  TripPollKind,
  TripPollOption,
  TripTask,
  TripTaskStatus,
} from '../domain/models';
import { deleteOfflineMedia, loadOfflineMedia } from '../utils/persistence';
import { deleteImageFromCloudinary, isCloudinaryConfigured, uploadImageToCloudinary } from '../lib/cloudinary';

type TaskInput = Pick<TripTask, 'tripId' | 'title'> & Partial<Pick<TripTask, 'description' | 'priority' | 'assigneeId' | 'dueDate' | 'dueTime' | 'activityId' | 'placeId'>>;
type PollInput = { tripId: string; question: string; kind: TripPollKind; selectionMode: TripPoll['selectionMode']; deadline?: string; options: Array<Pick<TripPollOption, 'label' | 'activityId' | 'placeId' | 'proposedDate' | 'proposedTime'>> };
type CommentInput = { tripId: string; targetType: TripCommentTargetType; targetId: string; body: string; parentId?: string; mentionedUserIds?: string[] };

type CollaborationContextValue = {
  settings: TripCollaborationSettings[];
  tasks: TripTask[];
  polls: TripPoll[];
  pollOptions: TripPollOption[];
  pollVotes: ReturnType<typeof useAppContext>['snapshot']['pollVotes'];
  comments: TripComment[];
  notifications: ReturnType<typeof useAppContext>['snapshot']['notifications'];
  offlineMutations: OfflineMutation[];
  publicShares: PublicTripShare[];
  getSettings: (tripId: string) => TripCollaborationSettings;
  getPermissions: (tripId: string) => ReturnType<typeof getCollaborationPermissions>;
  updateSettings: (tripId: string, input: Omit<TripCollaborationSettings, 'tripId' | 'updatedAt'>) => Promise<void>;
  addTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: string, input: Partial<TaskInput & { status: TripTaskStatus }>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createPoll: (input: PollInput) => Promise<void>;
  setPollVote: (pollId: string, optionId: string) => Promise<void>;
  closePoll: (pollId: string) => Promise<void>;
  reopenPoll: (pollId: string) => Promise<void>;
  deletePoll: (pollId: string) => Promise<void>;
  addComment: (input: CommentInput) => Promise<void>;
  editComment: (id: string, body: string, mentionedUserIds?: string[]) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  syncOfflineMutations: () => Promise<void>;
  resolveOfflineConflict: (id: string, resolution: 'server' | 'local', mergedPayload?: Record<string, unknown>) => Promise<void>;
  refreshPublicShares: (tripId: string) => Promise<void>;
  createPublicShare: (tripId: string, scopes: PublicTripShareScope[], expiresAt: string) => Promise<string>;
  revokePublicShare: (id: string) => Promise<void>;
};

const CollaborationContext = createContext<CollaborationContextValue | null>(null);
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function isNetworkFailure(error: unknown) {
  return typeof navigator !== 'undefined' && !navigator.onLine || classifyRemoteWorkspaceError(error) === 'network';
}

export function CollaborationProvider({ children }: { children: ReactNode }) {
  const app = useAppContext();
  const { snapshot, trips, currentUserProfile, isRemoteMode, workspaceStatus, updatePersistedState, refreshWorkspace, recordActivityLog } = app;
  const [publicShares, setPublicShares] = useState<PublicTripShare[]>([]);
  const viewerId = currentUserProfile?.id;

  const getSettings = useCallback((tripId: string): TripCollaborationSettings => snapshot.collaborationSettings.find((item) => item.tripId === tripId) ?? { tripId, ...DEFAULT_COLLABORATION_SETTINGS }, [snapshot.collaborationSettings]);
  const getPermissions = useCallback((tripId: string) => getCollaborationPermissions(trips.find((trip) => trip.id === tripId)?.membershipRole ?? null, getSettings(tripId)), [getSettings, trips]);

  const queue = useCallback((mutation: OfflineMutation) => {
    updatePersistedState((state) => ({ ...state, offlineMutations: coalesceOfflineMutations(state.offlineMutations, mutation) }));
  }, [updatePersistedState]);

  const commit = useCallback(async (input: {
    remote: () => Promise<void>;
    local: () => void;
    offline?: Omit<OfflineMutation, 'id' | 'createdAt' | 'status'>;
  }) => {
    if (!isRemoteMode) {
      input.local();
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine && input.offline) {
      input.local();
      queue({ ...input.offline, id: id(), createdAt: now(), status: 'pending' });
      return;
    }
    try {
      await input.remote();
      await refreshWorkspace();
    } catch (error) {
      if (!input.offline || !isNetworkFailure(error)) throw error;
      input.local();
      queue({ ...input.offline, id: id(), createdAt: now(), status: 'pending' });
    }
  }, [isRemoteMode, queue, refreshWorkspace]);

  const assertTripLinks = useCallback((tripId: string, activityId?: string, placeId?: string) => {
    if (activityId && snapshot.activities.find((item) => item.id === activityId)?.tripId !== tripId) throw new Error('Hoạt động liên kết phải thuộc cùng chuyến đi.');
    if (placeId && snapshot.savedPlaces.find((item) => item.id === placeId)?.tripId !== tripId) throw new Error('Địa điểm liên kết phải thuộc cùng chuyến đi.');
  }, [snapshot.activities, snapshot.savedPlaces]);

  const updateSettings = useCallback(async (tripId: string, input: Omit<TripCollaborationSettings, 'tripId' | 'updatedAt'>) => {
    if (!getPermissions(tripId).canManageSettings) throw new Error('Bạn không có quyền thay đổi cài đặt cộng tác.');
    if (!navigator.onLine && isRemoteMode) throw new Error('Cần kết nối mạng để thay đổi quyền cộng tác.');
    const value = { tripId, ...input, updatedAt: now() };
    await commit({
      remote: async () => { const { error } = await supabase!.from('trip_collaboration_settings').upsert({ trip_id: tripId, viewer_can_vote: input.viewerCanVote, viewer_can_comment: input.viewerCanComment, viewer_can_update_assigned_tasks: input.viewerCanUpdateAssignedTasks }, { onConflict: 'trip_id' }); if (error) throw error; },
      local: () => updatePersistedState((state) => ({ ...state, collaborationSettings: [value, ...state.collaborationSettings.filter((item) => item.tripId !== tripId)] })),
    });
  }, [commit, getPermissions, isRemoteMode, updatePersistedState]);

  const addTask = useCallback(async (input: TaskInput) => {
    if (!viewerId || !getPermissions(input.tripId).canCreateTasks) throw new Error('Bạn không có quyền tạo nhiệm vụ.');
    assertTripLinks(input.tripId, input.activityId, input.placeId);
    if (input.assigneeId && !trips.find((trip) => trip.id === input.tripId)?.members.some((member) => member.id === input.assigneeId)) throw new Error('Người phụ trách phải là thành viên đang hoạt động.');
    const timestamp = now();
    const task: TripTask = { id: id(), tripId: input.tripId, title: input.title.trim(), description: input.description?.trim(), status: 'todo', priority: input.priority ?? 'normal', assigneeId: input.assigneeId, dueDate: input.dueDate, dueTime: input.dueTime, activityId: input.activityId, placeId: input.placeId, createdBy: viewerId, createdAt: timestamp, updatedAt: timestamp };
    if (!task.title) throw new Error('Tên nhiệm vụ không được để trống.');
    const payload = { id: task.id, trip_id: task.tripId, title: task.title, description: task.description, status: task.status, priority: task.priority, assignee_id: task.assigneeId, due_date: task.dueDate, due_time: task.dueTime, activity_id: task.activityId, place_id: task.placeId, created_by: task.createdBy, created_at: timestamp, updated_at: timestamp };
    await commit({ remote: async () => { const { error } = await supabase!.from('trip_tasks').insert(payload); if (error) throw error; }, local: () => updatePersistedState((state) => ({ ...state, tasks: [task, ...state.tasks] })), offline: { entityType: 'task', entityId: task.id, tripId: task.tripId, action: 'create', payload } });
  }, [assertTripLinks, commit, getPermissions, trips, updatePersistedState, viewerId]);

  const updateTask = useCallback(async (taskId: string, input: Partial<TaskInput & { status: TripTaskStatus }>) => {
    const task = snapshot.tasks.find((item) => item.id === taskId);
    if (!task || !viewerId) throw new Error('Không tìm thấy nhiệm vụ.');
    const permissions = getPermissions(task.tripId);
    const assignedViewer = task.assigneeId === viewerId && permissions.canUpdateAssignedTasks;
    if (!permissions.canCreateTasks && !(assignedViewer && Object.keys(input).every((key) => key === 'status'))) throw new Error('Bạn chỉ có thể cập nhật trạng thái nhiệm vụ được giao cho mình.');
    if (input.title !== undefined && !input.title.trim()) throw new Error('Tên nhiệm vụ không được để trống.');
    if (input.assigneeId && !trips.find((trip) => trip.id === task.tripId)?.members.some((member) => member.id === input.assigneeId)) throw new Error('Người phụ trách phải là thành viên đang hoạt động.');
    assertTripLinks(task.tripId, input.activityId ?? task.activityId, input.placeId ?? task.placeId);
    const timestamp = now();
    const next = { ...task, ...input, assigneeId: 'assigneeId' in input ? input.assigneeId || undefined : task.assigneeId, dueDate: 'dueDate' in input ? input.dueDate || undefined : task.dueDate, dueTime: 'dueTime' in input ? input.dueTime || undefined : task.dueTime, activityId: 'activityId' in input ? input.activityId || undefined : task.activityId, placeId: 'placeId' in input ? input.placeId || undefined : task.placeId, completedBy: input.status === 'done' ? viewerId : input.status ? undefined : task.completedBy, completedAt: input.status === 'done' ? timestamp : input.status ? undefined : task.completedAt, updatedAt: timestamp };
    const payload: Record<string, unknown> = { ...(input.title !== undefined && { title: input.title.trim() }), ...(input.description !== undefined && { description: input.description }), ...(input.status !== undefined && { status: input.status, completed_by: next.completedBy ?? null, completed_at: next.completedAt ?? null }), ...(input.priority !== undefined && { priority: input.priority }), ...(input.assigneeId !== undefined && { assignee_id: input.assigneeId || null }), ...(input.dueDate !== undefined && { due_date: input.dueDate || null }), ...(input.dueTime !== undefined && { due_time: input.dueTime || null }), ...(input.activityId !== undefined && { activity_id: input.activityId || null }), ...(input.placeId !== undefined && { place_id: input.placeId || null }) };
    await commit({
      remote: async () => {
        const trip = trips.find((item) => item.id === task.tripId);
        const viewerOnly = trip?.membershipRole === 'viewer';
        const response = viewerOnly ? await supabase!.rpc('update_own_assigned_task_status', { p_task_id: taskId, p_status: input.status }) : await supabase!.from('trip_tasks').update(payload).eq('id', taskId);
        if (response.error) throw response.error;
      },
      local: () => updatePersistedState((state) => ({ ...state, tasks: state.tasks.map((item) => item.id === taskId ? next : item) })),
      offline: { entityType: 'task', entityId: taskId, tripId: task.tripId, action: 'update', payload, restorePayload: { id: next.id, trip_id: next.tripId, title: next.title, description: next.description, status: next.status, priority: next.priority, assignee_id: next.assigneeId, due_date: next.dueDate, due_time: next.dueTime, activity_id: next.activityId, place_id: next.placeId, created_by: next.createdBy, completed_by: next.completedBy, completed_at: next.completedAt, created_at: next.createdAt, updated_at: next.updatedAt }, baseUpdatedAt: task.updatedAt },
    });
    if (input.status === 'done' && task.status !== 'done') recordActivityLog({ tripId: task.tripId, action: 'updated', entityType: 'task', entityId: task.id, summary: `Hoàn thành nhiệm vụ: ${task.title}` });
  }, [assertTripLinks, commit, getPermissions, recordActivityLog, snapshot.tasks, trips, updatePersistedState, viewerId]);

  const deleteTask = useCallback(async (taskId: string) => {
    const task = snapshot.tasks.find((item) => item.id === taskId);
    if (!task || !getPermissions(task.tripId).canCreateTasks) throw new Error('Bạn không có quyền xóa nhiệm vụ.');
    await commit({ remote: async () => { const { error } = await supabase!.from('trip_tasks').delete().eq('id', taskId); if (error) throw error; }, local: () => updatePersistedState((state) => ({ ...state, tasks: state.tasks.filter((item) => item.id !== taskId), comments: state.comments.filter((item) => !(item.targetType === 'task' && item.targetId === taskId)) })), offline: { entityType: 'task', entityId: taskId, tripId: task.tripId, action: 'delete', payload: {}, baseUpdatedAt: task.updatedAt } });
  }, [commit, getPermissions, snapshot.tasks, updatePersistedState]);

  const createPoll = useCallback(async (input: PollInput) => {
    if (!viewerId || !getPermissions(input.tripId).canCreatePolls) throw new Error('Bạn không có quyền tạo bình chọn.');
    if (!input.question.trim()) throw new Error('Câu hỏi bình chọn không được để trống.');
    if (input.options.length < 2) throw new Error('Bình chọn cần ít nhất hai lựa chọn.');
    if (input.options.some((option) => !option.label.trim())) throw new Error('Lựa chọn bình chọn không được để trống.');
    input.options.forEach((option) => assertTripLinks(input.tripId, option.activityId, option.placeId));
    const timestamp = now();
    const poll: TripPoll = { id: id(), tripId: input.tripId, question: input.question.trim(), kind: input.kind, selectionMode: input.selectionMode, status: 'open', deadline: input.deadline, createdBy: viewerId, createdAt: timestamp, updatedAt: timestamp };
    const options: TripPollOption[] = input.options.map((option) => ({ ...option, id: id(), pollId: poll.id, tripId: poll.tripId, label: option.label.trim(), createdAt: timestamp }));
    const pollPayload = { id: poll.id, trip_id: poll.tripId, question: poll.question, kind: poll.kind, selection_mode: poll.selectionMode, status: poll.status, deadline: poll.deadline, created_by: poll.createdBy, created_at: timestamp, updated_at: timestamp };
    const optionPayloads = options.map((option) => ({ id: option.id, poll_id: option.pollId, trip_id: option.tripId, label: option.label, activity_id: option.activityId, place_id: option.placeId, proposed_date: option.proposedDate, proposed_time: option.proposedTime, created_at: timestamp }));
    await commit({ remote: async () => { const created = await supabase!.from('trip_polls').insert(pollPayload); if (created.error) throw created.error; const added = await supabase!.from('trip_poll_options').insert(optionPayloads); if (added.error) throw added.error; }, local: () => updatePersistedState((state) => ({ ...state, polls: [poll, ...state.polls], pollOptions: [...options, ...state.pollOptions] })), offline: { entityType: 'poll', entityId: poll.id, tripId: poll.tripId, action: 'create', payload: { poll: pollPayload, options: optionPayloads } } });
  }, [assertTripLinks, commit, getPermissions, updatePersistedState, viewerId]);

  const setPollVote = useCallback(async (pollId: string, optionId: string) => {
    const poll = snapshot.polls.find((item) => item.id === pollId);
    if (!poll || !viewerId || !getPermissions(poll.tripId).canVote) throw new Error('Bạn không có quyền bỏ phiếu.');
    if (poll.status !== 'open' || poll.deadline && Date.parse(poll.deadline) <= Date.now()) throw new Error('Bình chọn đã đóng hoặc hết hạn.');
    const existing = snapshot.pollVotes.filter((vote) => vote.pollId === pollId && vote.userId === viewerId);
    const selected = existing.some((vote) => vote.optionId === optionId);
    const selectedOptionIds = poll.selectionMode === 'single' ? [optionId] : selected ? existing.filter((vote) => vote.optionId !== optionId).map((vote) => vote.optionId) : [...existing.map((vote) => vote.optionId), optionId];
    const nextVotes = selectedOptionIds.map((selectedId) => existing.find((vote) => vote.optionId === selectedId) ?? { id: id(), pollId, optionId: selectedId, tripId: poll.tripId, userId: viewerId, createdAt: now() });
    const payload = { pollId, tripId: poll.tripId, userId: viewerId, selectedOptionIds, votes: nextVotes.map((vote) => ({ id: vote.id, poll_id: pollId, option_id: vote.optionId, trip_id: poll.tripId, user_id: viewerId, created_at: vote.createdAt })) };
    await commit({ remote: async () => { const removed = await supabase!.from('trip_poll_votes').delete().eq('poll_id', pollId).eq('user_id', viewerId); if (removed.error) throw removed.error; if (payload.votes.length) { const added = await supabase!.from('trip_poll_votes').insert(payload.votes); if (added.error) throw added.error; } }, local: () => updatePersistedState((state) => ({ ...state, pollVotes: [...state.pollVotes.filter((vote) => !(vote.pollId === pollId && vote.userId === viewerId)), ...nextVotes] })), offline: { entityType: 'vote', entityId: `${pollId}:${viewerId}`, tripId: poll.tripId, action: 'update', payload } });
  }, [commit, getPermissions, snapshot.pollVotes, snapshot.polls, updatePersistedState, viewerId]);

  const closePoll = useCallback(async (pollId: string) => {
    const poll = snapshot.polls.find((item) => item.id === pollId);
    const role = trips.find((trip) => trip.id === poll?.tripId)?.membershipRole;
    if (!poll || !viewerId || !(poll.createdBy === viewerId || role === 'owner' || role === 'admin')) throw new Error('Bạn không có quyền đóng bình chọn.');
    const payload = { status: 'closed' };
    await commit({ remote: async () => { const { error } = await supabase!.from('trip_polls').update(payload).eq('id', pollId); if (error) throw error; }, local: () => updatePersistedState((state) => ({ ...state, polls: state.polls.map((item) => item.id === pollId ? { ...item, status: 'closed', updatedAt: now() } : item) })), offline: { entityType: 'poll', entityId: pollId, tripId: poll.tripId, action: 'update', payload, restorePayload: { poll: { id: poll.id, trip_id: poll.tripId, question: poll.question, kind: poll.kind, selection_mode: poll.selectionMode, status: 'closed', deadline: poll.deadline, created_by: poll.createdBy, created_at: poll.createdAt, updated_at: now() }, options: snapshot.pollOptions.filter((option) => option.pollId === poll.id).map((option) => ({ id: option.id, poll_id: option.pollId, trip_id: option.tripId, label: option.label, activity_id: option.activityId, place_id: option.placeId, proposed_date: option.proposedDate, proposed_time: option.proposedTime, created_at: option.createdAt })) }, baseUpdatedAt: poll.updatedAt } });
  }, [commit, snapshot.pollOptions, snapshot.polls, trips, updatePersistedState, viewerId]);

  const reopenPoll = useCallback(async (pollId: string) => {
    const poll = snapshot.polls.find((item) => item.id === pollId);
    const trip = trips.find((item) => item.id === poll?.tripId);
    if (!poll || !trip?.permissions.canManageTrip) throw new Error('Chỉ Owner/Admin mới có thể mở lại bình chọn.');
    const payload = { status: 'open' };
    await commit({ remote: async () => { const { error } = await supabase!.from('trip_polls').update(payload).eq('id', pollId); if (error) throw error; }, local: () => updatePersistedState((state) => ({ ...state, polls: state.polls.map((item) => item.id === pollId ? { ...item, status: 'open', updatedAt: now() } : item) })), offline: { entityType: 'poll', entityId: pollId, tripId: poll.tripId, action: 'update', payload, restorePayload: { poll: { id: poll.id, trip_id: poll.tripId, question: poll.question, kind: poll.kind, selection_mode: poll.selectionMode, status: 'open', deadline: poll.deadline, created_by: poll.createdBy, created_at: poll.createdAt, updated_at: now() }, options: snapshot.pollOptions.filter((option) => option.pollId === poll.id).map((option) => ({ id: option.id, poll_id: option.pollId, trip_id: option.tripId, label: option.label, activity_id: option.activityId, place_id: option.placeId, proposed_date: option.proposedDate, proposed_time: option.proposedTime, created_at: option.createdAt })) }, baseUpdatedAt: poll.updatedAt } });
  }, [commit, snapshot.pollOptions, snapshot.polls, trips, updatePersistedState]);

  const deletePoll = useCallback(async (pollId: string) => {
    const poll = snapshot.polls.find((item) => item.id === pollId);
    const trip = trips.find((item) => item.id === poll?.tripId);
    if (!poll || !(trip?.permissions.canManageTrip || poll.createdBy === viewerId && !snapshot.pollVotes.some((vote) => vote.pollId === pollId))) throw new Error('Bạn không có quyền xóa bình chọn này.');
    await commit({ remote: async () => { const { error } = await supabase!.from('trip_polls').delete().eq('id', pollId); if (error) throw error; }, local: () => updatePersistedState((state) => ({ ...state, polls: state.polls.filter((item) => item.id !== pollId), pollOptions: state.pollOptions.filter((item) => item.pollId !== pollId), pollVotes: state.pollVotes.filter((item) => item.pollId !== pollId), comments: state.comments.filter((item) => !(item.targetType === 'poll' && item.targetId === pollId)) })), offline: { entityType: 'poll', entityId: pollId, tripId: poll.tripId, action: 'delete', payload: {}, baseUpdatedAt: poll.updatedAt } });
  }, [commit, snapshot.pollVotes, snapshot.polls, trips, updatePersistedState, viewerId]);

  const assertCommentTarget = useCallback((input: CommentInput) => {
    const sources = { activity: snapshot.activities, expense: snapshot.expenses, place: snapshot.savedPlaces, photo: snapshot.photos, task: snapshot.tasks, poll: snapshot.polls };
    if (sources[input.targetType].find((item) => item.id === input.targetId)?.tripId !== input.tripId) throw new Error('Nội dung bình luận phải thuộc cùng chuyến đi.');
    if (input.parentId) {
      const parent = snapshot.comments.find((item) => item.id === input.parentId);
      if (!parent || parent.tripId !== input.tripId || parent.targetType !== input.targetType || parent.targetId !== input.targetId || parent.parentId) throw new Error('Bình luận trả lời phải thuộc cùng một luồng và chỉ hỗ trợ một cấp.');
    }
    const memberIds = new Set(trips.find((trip) => trip.id === input.tripId)?.members.map((member) => member.id));
    if ((input.mentionedUserIds ?? []).some((memberId) => !memberIds.has(memberId))) throw new Error('Chỉ có thể nhắc tên thành viên đang hoạt động.');
  }, [snapshot, trips]);

  const addComment = useCallback(async (input: CommentInput) => {
    if (!viewerId || !getPermissions(input.tripId).canComment) throw new Error('Bạn không có quyền bình luận.');
    assertCommentTarget(input);
    const timestamp = now();
    const comment: TripComment = { id: id(), tripId: input.tripId, targetType: input.targetType, targetId: input.targetId, parentId: input.parentId, authorId: viewerId, body: input.body.trim(), mentionedUserIds: input.mentionedUserIds ?? [], createdAt: timestamp, updatedAt: timestamp };
    if (!comment.body) throw new Error('Bình luận không được để trống.');
    const payload = { id: comment.id, trip_id: comment.tripId, target_type: comment.targetType, target_id: comment.targetId, parent_id: comment.parentId, author_id: comment.authorId, body: comment.body, mentioned_user_ids: comment.mentionedUserIds, created_at: timestamp, updated_at: timestamp };
    await commit({ remote: async () => { const { error } = await supabase!.from('trip_comments').insert(payload); if (error) throw error; }, local: () => updatePersistedState((state) => ({ ...state, comments: [...state.comments, comment] })), offline: { entityType: 'comment', entityId: comment.id, tripId: comment.tripId, action: 'create', payload } });
  }, [assertCommentTarget, commit, getPermissions, updatePersistedState, viewerId]);

  const editComment = useCallback(async (commentId: string, body: string, mentionedUserIds: string[] = []) => {
    const comment = snapshot.comments.find((item) => item.id === commentId);
    if (!comment || comment.authorId !== viewerId) throw new Error('Bạn chỉ có thể sửa bình luận của mình.');
    const memberIds = new Set(trips.find((trip) => trip.id === comment.tripId)?.members.map((member) => member.id));
    if (mentionedUserIds.some((memberId) => !memberIds.has(memberId))) throw new Error('Chỉ có thể nhắc tên thành viên đang hoạt động.');
    const payload = { body: body.trim(), mentioned_user_ids: mentionedUserIds };
    if (!payload.body) throw new Error('Bình luận không được để trống.');
    await commit({ remote: async () => { const { error } = await supabase!.from('trip_comments').update(payload).eq('id', commentId); if (error) throw error; }, local: () => updatePersistedState((state) => ({ ...state, comments: state.comments.map((item) => item.id === commentId ? { ...item, body: payload.body, mentionedUserIds, updatedAt: now() } : item) })), offline: { entityType: 'comment', entityId: commentId, tripId: comment.tripId, action: 'update', payload, restorePayload: { id: comment.id, trip_id: comment.tripId, target_type: comment.targetType, target_id: comment.targetId, parent_id: comment.parentId, author_id: comment.authorId, body: payload.body, mentioned_user_ids: mentionedUserIds, created_at: comment.createdAt, updated_at: now() }, baseUpdatedAt: comment.updatedAt } });
  }, [commit, snapshot.comments, trips, updatePersistedState, viewerId]);

  const deleteComment = useCallback(async (commentId: string) => {
    const comment = snapshot.comments.find((item) => item.id === commentId);
    const trip = trips.find((item) => item.id === comment?.tripId);
    if (!comment || !(comment.authorId === viewerId || trip?.permissions.canManageMembers)) throw new Error('Bạn không có quyền xóa bình luận.');
    const deletedAt = now();
    const payload = { body: '[Đã xóa]', mentioned_user_ids: [], deleted_at: deletedAt };
    await commit({ remote: async () => { const { error } = await supabase!.from('trip_comments').update(payload).eq('id', commentId); if (error) throw error; }, local: () => updatePersistedState((state) => ({ ...state, comments: state.comments.map((item) => item.id === commentId ? { ...item, body: '[Đã xóa]', mentionedUserIds: [], deletedAt, updatedAt: deletedAt } : item) })), offline: { entityType: 'comment', entityId: commentId, tripId: comment.tripId, action: 'update', payload, restorePayload: { id: comment.id, trip_id: comment.tripId, target_type: comment.targetType, target_id: comment.targetId, parent_id: comment.parentId, author_id: comment.authorId, body: '[Đã xóa]', mentioned_user_ids: [], created_at: comment.createdAt, updated_at: deletedAt, deleted_at: deletedAt }, baseUpdatedAt: comment.updatedAt } });
  }, [commit, snapshot.comments, trips, updatePersistedState, viewerId]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    const notification = snapshot.notifications.find((item) => item.id === notificationId);
    if (!notification || notification.recipientId !== viewerId) return;
    const readAt = now();
    if (isRemoteMode) { const { error } = await supabase!.from('trip_notifications').update({ read_at: readAt }).eq('id', notificationId); if (error) throw error; }
    updatePersistedState((state) => ({ ...state, notifications: state.notifications.map((item) => item.id === notificationId ? { ...item, readAt } : item) }));
  }, [isRemoteMode, snapshot.notifications, updatePersistedState, viewerId]);

  const replayMutation = useCallback(async (mutation: OfflineMutation) => {
    if (!supabase) return;
    const tableByEntity = { trip: 'trips', activity: 'activities', expense: 'expenses', place: 'saved_places', packing: 'packing_items', photo: 'photos', task: 'trip_tasks', poll: 'trip_polls', comment: 'trip_comments' } as const;
    if ((mutation.action === 'update' || mutation.action === 'delete') && mutation.baseUpdatedAt && mutation.entityType in tableByEntity) {
      const table = tableByEntity[mutation.entityType as keyof typeof tableByEntity];
      const current = await supabase.from(table).select('*').eq('id', mutation.entityId).maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) {
        if (mutation.action === 'delete') {
          updatePersistedState((state) => ({ ...state, offlineMutations: state.offlineMutations.filter((item) => item.id !== mutation.id) }));
          return;
        }
        updatePersistedState((state) => ({ ...state, offlineMutations: state.offlineMutations.map((item) => item.id === mutation.id ? { ...item, status: 'conflict', serverValue: { __deleted: true } } : item) }));
        return;
      }
      const serverUpdatedAt = current.data?.updated_at as string | undefined;
      if (serverUpdatedAt && serverUpdatedAt !== mutation.baseUpdatedAt) {
        updatePersistedState((state) => ({ ...state, offlineMutations: state.offlineMutations.map((item) => item.id === mutation.id ? { ...item, status: 'conflict', serverValue: current.data as Record<string, unknown> } : item) }));
        return;
      }
    }
    let error: unknown;
    if (mutation.entityType === 'trip' && mutation.action === 'create') {
      const value = mutation.payload as { row: Record<string, unknown>; ownerId?: string };
      const created = await supabase.from('trips').insert(value.row); error = created.error;
      if (!error && value.ownerId) error = (await supabase.from('trip_memberships').insert({ trip_id: mutation.entityId, user_id: value.ownerId, role: 'owner' })).error;
    }
    else if (mutation.entityType === 'photo' && mutation.action === 'create') {
      const value = mutation.payload as { row: Record<string, unknown>; offlineBlobKey?: string };
      const row = { ...value.row };
      if (value.offlineBlobKey) {
        const blob = await loadOfflineMedia(value.offlineBlobKey);
        if (!blob) throw new Error('Không còn tệp ảnh ngoại tuyến để đồng bộ.');
        if (isCloudinaryConfigured) {
          const uploaded = await uploadImageToCloudinary(blob, { folder: `bunbietbay/${mutation.tripId}`, tags: ['bunbietbay-trips', `trip-${mutation.tripId}`] });
          row.url = uploaded.url; row.storage = 'remote'; row.provider = 'cloudinary'; row.provider_public_id = uploaded.publicId;
        }
      }
      ({ error } = await supabase.from('photos').insert(row));
      if (!error && value.offlineBlobKey) await deleteOfflineMedia(value.offlineBlobKey);
    }
    else if (mutation.entityType === 'photo' && mutation.action === 'delete') {
      ({ error } = await supabase.from('photos').delete().eq('id', mutation.entityId));
      if (!error && mutation.payload.providerPublicId) await deleteImageFromCloudinary(String(mutation.payload.providerPublicId));
    }
    else if (mutation.entityType in tableByEntity && !['poll', 'comment'].includes(mutation.entityType)) {
      const table = tableByEntity[mutation.entityType as keyof typeof tableByEntity];
      ({ error } = mutation.action === 'create' ? await supabase.from(table).insert(mutation.payload) : mutation.action === 'delete' ? await supabase.from(table).delete().eq('id', mutation.entityId) : await supabase.from(table).update(mutation.payload).eq('id', mutation.entityId));
    }
    else if (mutation.entityType === 'comment') ({ error } = mutation.action === 'create' ? await supabase.from('trip_comments').insert(mutation.payload) : await supabase.from('trip_comments').update(mutation.payload).eq('id', mutation.entityId));
    else if (mutation.entityType === 'poll' && mutation.action === 'create') { const value = mutation.payload as { poll: Record<string, unknown>; options: Record<string, unknown>[] }; const pollResult = await supabase.from('trip_polls').insert(value.poll); error = pollResult.error; if (!error) error = (await supabase.from('trip_poll_options').insert(value.options)).error; }
    else if (mutation.entityType === 'poll') ({ error } = mutation.action === 'delete' ? await supabase.from('trip_polls').delete().eq('id', mutation.entityId) : await supabase.from('trip_polls').update(mutation.payload).eq('id', mutation.entityId));
    else if (mutation.entityType === 'vote') { const value = mutation.payload as { pollId: string; userId: string; votes: Record<string, unknown>[] }; const removed = await supabase.from('trip_poll_votes').delete().eq('poll_id', value.pollId).eq('user_id', value.userId); error = removed.error; if (!error && value.votes.length) error = (await supabase.from('trip_poll_votes').insert(value.votes)).error; }
    else throw new Error(`Chưa hỗ trợ đồng bộ ${mutation.entityType}.`);
    if (error) throw error;
    updatePersistedState((state) => ({ ...state, offlineMutations: state.offlineMutations.filter((item) => item.id !== mutation.id) }));
  }, [updatePersistedState]);

  const syncOfflineMutations = useCallback(async () => {
    if (!isRemoteMode || !navigator.onLine || snapshot.offlineMutations.every((item) => item.status !== 'pending')) return;
    const run = async () => {
      for (const mutation of orderOfflineMutations(snapshot.offlineMutations.filter((item) => item.status === 'pending'))) {
        try { await replayMutation(mutation); }
        catch (error) { updatePersistedState((state) => ({ ...state, offlineMutations: state.offlineMutations.map((item) => item.id === mutation.id ? { ...item, status: 'failed', error: error instanceof Error ? error.message : String(error) } : item) })); }
      }
      await refreshWorkspace();
    };
    if (navigator.locks) await navigator.locks.request('bunbietbay-workspace-sync', run); else await run();
  }, [isRemoteMode, refreshWorkspace, replayMutation, snapshot.offlineMutations, updatePersistedState]);

  useEffect(() => {
    const handleOnline = () => {
      if (snapshot.offlineMutations.some((item) => item.status === 'pending')) void syncOfflineMutations();
      else if (isRemoteMode && workspaceStatus === 'remote-unavailable') void refreshWorkspace();
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) handleOnline();
    return () => window.removeEventListener('online', handleOnline);
  }, [isRemoteMode, refreshWorkspace, snapshot.offlineMutations, syncOfflineMutations, workspaceStatus]);

  const resolveOfflineConflict = useCallback(async (mutationId: string, resolution: 'server' | 'local', mergedPayload?: Record<string, unknown>) => {
    const mutation = snapshot.offlineMutations.find((item) => item.id === mutationId);
    if (!mutation) return;
    if (resolution === 'server') {
      updatePersistedState((state) => ({ ...state, offlineMutations: state.offlineMutations.filter((item) => item.id !== mutationId) }));
      await refreshWorkspace();
      return;
    }
    if (mutation.serverValue?.__deleted && !mutation.restorePayload) throw new Error('Không đủ dữ liệu để khôi phục; hãy giữ trạng thái đã xóa hoặc xuất nội dung trước khi hủy.');
    updatePersistedState((state) => ({ ...state, offlineMutations: state.offlineMutations.map((item) => item.id === mutationId ? { ...item, action: item.serverValue?.__deleted ? 'create' : item.action, payload: item.serverValue?.__deleted ? item.restorePayload! : mergedPayload ?? item.payload, baseUpdatedAt: item.serverValue?.__deleted ? undefined : String(item.serverValue?.updated_at ?? ''), serverValue: undefined, status: 'pending', error: undefined } : item) }));
  }, [refreshWorkspace, snapshot.offlineMutations, updatePersistedState]);

  const refreshPublicShares = useCallback(async (tripId: string) => {
    if (!isRemoteMode || !getPermissions(tripId).canManageShares) { setPublicShares([]); return; }
    const { data, error } = await supabase!.from('trip_public_shares').select('id, trip_id, scopes, expires_at, revoked_at, created_by, created_at, updated_at').eq('trip_id', tripId).order('created_at', { ascending: false });
    if (error) throw error;
    setPublicShares((data ?? []).map((row) => ({ id: row.id, tripId: row.trip_id, scopes: row.scopes as PublicTripShareScope[], expiresAt: row.expires_at, revokedAt: row.revoked_at ?? undefined, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at })));
  }, [getPermissions, isRemoteMode]);

  const createPublicShare = useCallback(async (tripId: string, scopes: PublicTripShareScope[], expiresAt: string) => {
    if (!isRemoteMode || !navigator.onLine || !viewerId || !getPermissions(tripId).canManageShares) throw new Error('Cần kết nối mạng và quyền quản trị để tạo link chia sẻ.');
    if (!scopes.length) throw new Error('Hãy chọn ít nhất một nội dung chia sẻ.');
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const { error } = await supabase!.from('trip_public_shares').insert({ trip_id: tripId, token_hash: await sha256(token), scopes, expires_at: expiresAt, created_by: viewerId });
    if (error) throw error;
    await refreshPublicShares(tripId);
    recordActivityLog({ tripId, action: 'created', entityType: 'share', summary: 'Tạo link chia sẻ chỉ đọc' });
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/share/${token}`;
  }, [getPermissions, isRemoteMode, recordActivityLog, refreshPublicShares, viewerId]);

  const revokePublicShare = useCallback(async (shareId: string) => {
    const share = publicShares.find((item) => item.id === shareId);
    if (!share || !navigator.onLine || !getPermissions(share.tripId).canManageShares) throw new Error('Không thể thu hồi link này.');
    const { error } = await supabase!.from('trip_public_shares').update({ revoked_at: now() }).eq('id', shareId);
    if (error) throw error;
    await refreshPublicShares(share.tripId);
    recordActivityLog({ tripId: share.tripId, action: 'deleted', entityType: 'share', entityId: share.id, summary: 'Thu hồi link chia sẻ chỉ đọc' });
  }, [getPermissions, publicShares, recordActivityLog, refreshPublicShares]);

  const value = useMemo<CollaborationContextValue>(() => ({
    settings: snapshot.collaborationSettings, tasks: snapshot.tasks, polls: snapshot.polls, pollOptions: snapshot.pollOptions,
    pollVotes: snapshot.pollVotes, comments: snapshot.comments, notifications: snapshot.notifications,
    offlineMutations: snapshot.offlineMutations, publicShares, getSettings, getPermissions, updateSettings, addTask, updateTask,
    deleteTask, createPoll, setPollVote, closePoll, reopenPoll, deletePoll, addComment, editComment, deleteComment,
    markNotificationRead, syncOfflineMutations, resolveOfflineConflict, refreshPublicShares, createPublicShare, revokePublicShare,
  }), [snapshot, publicShares, getSettings, getPermissions, updateSettings, addTask, updateTask, deleteTask, createPoll, setPollVote, closePoll, reopenPoll, deletePoll, addComment, editComment, deleteComment, markNotificationRead, syncOfflineMutations, resolveOfflineConflict, refreshPublicShares, createPublicShare, revokePublicShare]);

  return <CollaborationContext.Provider value={value}>{children}</CollaborationContext.Provider>;
}

export function useCollaboration() {
  const value = useContext(CollaborationContext);
  if (!value) throw new Error('useCollaboration must be used within CollaborationProvider');
  return value;
}
