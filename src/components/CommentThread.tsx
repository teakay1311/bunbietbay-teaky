import { useMemo, useState, type FormEvent } from 'react';
import { Icons } from './Icons';
import { useAppContext } from '../context/AppContext';
import { useCollaboration } from '../context/CollaborationContext';
import type { TripCommentTargetType } from '../domain/models';
import { formatLocalDateTime } from '../utils/date';
import { useFeedback } from '../context/FeedbackContext';

export function CommentThread({ tripId, targetType, targetId }: { tripId: string; targetType: TripCommentTargetType; targetId: string }) {
  const { trips, currentUserProfile } = useAppContext();
  const { comments, addComment, editComment, deleteComment, getPermissions } = useCollaboration();
  const { showToast, confirm } = useFeedback();
  const [isOpen, setIsOpen] = useState(false);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [visibleCount, setVisibleCount] = useState(50);
  const trip = trips.find((item) => item.id === tripId);
  const items = useMemo(() => comments.filter((item) => item.tripId === tripId && item.targetType === targetType && item.targetId === targetId), [comments, targetId, targetType, tripId]);
  const roots = items.filter((item) => !item.parentId);
  const recentItems = items.slice(-visibleCount);
  const visibleIds = new Set(recentItems.flatMap((item) => item.parentId ? [item.id, item.parentId] : [item.id]));
  const visibleRoots = roots.filter((item) => visibleIds.has(item.id));
  const mentionQuery = /(?:^|\s)@([^\s@]*)$/.exec(body)?.[1]?.toLocaleLowerCase('vi');
  const suggestions = mentionQuery === undefined ? [] : (trip?.members ?? []).filter((member) => member.id !== currentUserProfile?.id && member.displayName.toLocaleLowerCase('vi').includes(mentionQuery)).slice(0, 5);
  const mentionedUserIds = (trip?.members ?? []).filter((member) => body.includes(`@${member.displayName}`)).map((member) => member.id);
  const canComment = getPermissions(tripId).canComment;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (editingId) await editComment(editingId, body, mentionedUserIds);
      else await addComment({ tripId, targetType, targetId, body, parentId: replyTo, mentionedUserIds });
      setBody(''); setReplyTo(undefined); setEditingId(undefined);
    } catch (error) {
      showToast({ tone: 'error', title: 'Không thể lưu bình luận', message: error instanceof Error ? error.message : 'Hãy thử lại.' });
    }
  };

  return <div className="mt-3 border-t border-outline-variant/40 pt-3">
    <button type="button" onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-secondary hover:bg-surface-container-low">
      <Icons.MessageCircle className="size-4" /> {items.length ? `${items.length} bình luận` : 'Bình luận'}
    </button>
    {isOpen && <div className="mt-3 space-y-3">
      {items.length > visibleCount && <button type="button" onClick={() => setVisibleCount((value) => value + 50)} className="min-h-10 w-full rounded-xl border border-outline-variant text-sm font-semibold text-primary">Xem bình luận cũ hơn</button>}
      {visibleRoots.map((comment) => <div key={comment.id} className="rounded-xl bg-surface-container-low p-3">
        <CommentRow comment={comment} memberName={trip?.members.find((member) => member.id === comment.authorId)?.displayName ?? 'Thành viên'} own={comment.authorId === currentUserProfile?.id} canModerate={Boolean(trip?.permissions.canManageMembers)} onReply={() => { setReplyTo(comment.id); setEditingId(undefined); setBody(''); }} onEdit={() => { setEditingId(comment.id); setReplyTo(undefined); setBody(comment.body); }} onDelete={async () => { if (await confirm({ title: 'Xóa bình luận?', message: 'Các phản hồi bên dưới vẫn được giữ lại.', confirmLabel: 'Xóa', tone: 'danger' })) await deleteComment(comment.id); }} />
        {items.filter((item) => item.parentId === comment.id).map((reply) => <div key={reply.id} className="ml-5 mt-2 border-l-2 border-outline-variant pl-3"><CommentRow comment={reply} memberName={trip?.members.find((member) => member.id === reply.authorId)?.displayName ?? 'Thành viên'} own={reply.authorId === currentUserProfile?.id} canModerate={Boolean(trip?.permissions.canManageMembers)} onEdit={() => { setEditingId(reply.id); setReplyTo(undefined); setBody(reply.body); }} onDelete={() => deleteComment(reply.id)} /></div>)}
      </div>)}
      {canComment && <form onSubmit={submit} className="relative">
        {(replyTo || editingId) && <div className="mb-2 flex items-center justify-between text-xs text-secondary"><span>{editingId ? 'Đang sửa bình luận' : 'Đang trả lời'}</span><button type="button" onClick={() => { setReplyTo(undefined); setEditingId(undefined); setBody(''); }} className="font-semibold">Hủy</button></div>}
        <div className="flex gap-2"><input value={body} onChange={(event) => setBody(event.target.value)} required maxLength={5000} placeholder="Viết bình luận, dùng @ để nhắc tên…" aria-label="Nội dung bình luận" className="min-h-11 min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface px-3" /><button type="submit" aria-label="Gửi bình luận" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary"><Icons.Send className="size-4" /></button></div>
        {suggestions.length > 0 && <div className="absolute bottom-12 left-0 z-20 w-64 rounded-xl border border-outline-variant bg-surface p-1 shadow-lg">{suggestions.map((member) => <button key={member.id} type="button" onClick={() => setBody((value) => value.replace(/@[^\s@]*$/, `@${member.displayName} `))} className="block min-h-10 w-full rounded-lg px-3 text-left text-sm hover:bg-surface-container-low">{member.displayName}</button>)}</div>}
      </form>}
    </div>}
  </div>;
}

function CommentRow({ comment, memberName, own, canModerate, onReply, onEdit, onDelete }: { comment: ReturnType<typeof useCollaboration>['comments'][number]; memberName: string; own: boolean; canModerate: boolean; onReply?: () => void; onEdit: () => void; onDelete: () => void | Promise<void> }) {
  return <div><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold">{memberName}</p><p className="text-xs text-secondary">{formatLocalDateTime(comment.createdAt)}</p></div>{!comment.deletedAt && (own || canModerate) && <div className="flex">{own && <button type="button" onClick={onEdit} aria-label="Sửa bình luận" className="p-2 text-secondary"><Icons.Edit2 className="size-3.5" /></button>}<button type="button" onClick={() => void onDelete()} aria-label="Xóa bình luận" className="p-2 text-error"><Icons.Trash2 className="size-3.5" /></button></div>}</div><p className="mt-2 whitespace-pre-wrap text-sm text-on-surface">{comment.deletedAt ? 'Bình luận đã bị xóa.' : comment.body}</p>{onReply && !comment.deletedAt && <button type="button" onClick={onReply} className="mt-2 text-xs font-semibold text-primary">Trả lời</button>}</div>;
}
