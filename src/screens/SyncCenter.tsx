import { useState } from 'react';
import { useCollaboration } from '../context/CollaborationContext';
import { Icons } from '../components/Icons';
import { useFeedback } from '../context/FeedbackContext';
import { formatLocalDateTime } from '../utils/date';
import type { OfflineMutation } from '../domain/models';

export function SyncCenter() {
  const { offlineMutations, syncOfflineMutations, resolveOfflineConflict } = useCollaboration();
  const { showToast } = useFeedback();
  const pending = offlineMutations.filter((item) => item.status === 'pending').length;
  const failed = offlineMutations.filter((item) => item.status === 'failed').length;
  const conflicts = offlineMutations.filter((item) => item.status === 'conflict').length;
  return <div className="mx-auto max-w-4xl pb-16"><header className="mb-6"><p className="text-sm font-semibold text-secondary">Tài khoản</p><h1 className="font-headline text-3xl font-extrabold">Trung tâm đồng bộ</h1><p className="mt-2 text-sm text-secondary">Theo dõi thay đổi ngoại tuyến và tự quyết định khi dữ liệu trên máy khác với cloud.</p></header>
    <div className="grid gap-3 sm:grid-cols-3"><Stat label="Đang chờ" value={pending} /><Stat label="Thất bại" value={failed} tone="error" /><Stat label="Xung đột" value={conflicts} tone="warning" /></div>
    <button type="button" disabled={!navigator.onLine || pending === 0} onClick={async () => { await syncOfflineMutations(); showToast({ tone: 'success', title: 'Đã chạy đồng bộ' }); }} className="mt-4 min-h-11 rounded-xl bg-primary px-4 font-bold text-on-primary disabled:opacity-50"><Icons.Wifi className="mr-2 inline size-4" />Đồng bộ ngay</button>
    <section className="mt-6 space-y-3">{offlineMutations.map((mutation) => <article key={mutation.id} className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold">{labelAction(mutation.action)} {labelEntity(mutation.entityType)}</p><p className="mt-1 text-xs text-secondary">{formatLocalDateTime(mutation.createdAt)} · {mutation.entityId}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${mutation.status === 'conflict' ? 'bg-amber-100 text-amber-900' : mutation.status === 'failed' ? 'bg-error-container text-on-error-container' : 'bg-primary/10 text-primary'}`}>{mutation.status === 'pending' ? 'Đang chờ' : mutation.status === 'failed' ? 'Thất bại' : 'Cần giải quyết'}</span></div>{mutation.error && <p role="alert" className="mt-3 text-sm text-error">{mutation.error}</p>}{mutation.status === 'conflict' && <ConflictResolver mutation={mutation} resolve={resolveOfflineConflict} notifyError={(message) => showToast({ tone: 'error', title: 'Dữ liệu gộp chưa hợp lệ', message })} />}</article>)}{offlineMutations.length === 0 && <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center"><Icons.CheckCircle2 className="mx-auto size-9 text-primary" /><h2 className="mt-3 font-headline text-lg font-bold">Dữ liệu đã đồng bộ</h2><p className="mt-1 text-sm text-secondary">Không có thay đổi nào đang chờ xử lý.</p></div>}</section>
  </div>;
}
function Stat({ label, value, tone = 'primary' }: { label: string; value: number; tone?: 'primary'|'error'|'warning' }) { return <div className="rounded-2xl bg-surface-container-low p-4"><p className="text-sm text-secondary">{label}</p><p className={`mt-1 font-headline text-2xl font-extrabold ${tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-amber-700' : 'text-primary'}`}>{value}</p></div>; }
function Data({ label, value }: { label: string; value: Record<string, unknown> }) { return <div><p className="mb-1 text-xs font-bold text-secondary">{label}</p><pre className="max-h-48 overflow-auto rounded-xl bg-surface-container-low p-3 text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre></div>; }
function ConflictResolver({ mutation, resolve, notifyError }: { mutation: OfflineMutation; resolve: (id: string, resolution: 'server' | 'local', mergedPayload?: Record<string, unknown>) => Promise<void>; notifyError: (message: string) => void }) {
  const [showMerge, setShowMerge] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(mutation.payload, null, 2));
  const applyMerge = async () => {
    try {
      const parsed = JSON.parse(draft) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Nội dung phải là một object JSON.');
      await resolve(mutation.id, 'local', parsed as Record<string, unknown>);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Không thể đọc nội dung JSON.');
    }
  };
  const serverDeleted = mutation.serverValue?.__deleted === true;
  const keepLocal = async () => { try { await resolve(mutation.id, 'local'); } catch (error) { notifyError(error instanceof Error ? error.message : 'Không thể giữ bản trên máy.'); } };
  return <div className="mt-4"><div className="grid gap-3 md:grid-cols-2"><Data label="Bản trên máy" value={mutation.payload} /><Data label="Bản trên cloud" value={mutation.serverValue ?? {}} /></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void resolve(mutation.id, 'server')} className="min-h-10 rounded-xl border border-outline-variant px-3 text-sm font-bold">{serverDeleted ? 'Giữ trạng thái đã xóa' : mutation.action === 'delete' ? 'Khôi phục bản cloud' : 'Giữ bản cloud'}</button><button type="button" onClick={() => void keepLocal()} className="min-h-10 rounded-xl bg-primary px-3 text-sm font-bold text-on-primary">{serverDeleted ? 'Khôi phục bản trên máy' : mutation.action === 'delete' ? 'Xóa' : 'Giữ bản trên máy'}</button>{mutation.action === 'update' && !serverDeleted && <button type="button" onClick={() => setShowMerge((value) => !value)} className="min-h-10 rounded-xl border border-primary px-3 text-sm font-bold text-primary">Gộp thủ công</button>}</div>{showMerge && <div className="mt-3"><label className="text-sm font-bold" htmlFor={`merge-${mutation.id}`}>Dữ liệu sau khi gộp</label><textarea id={`merge-${mutation.id}`} value={draft} onChange={(event) => setDraft(event.target.value)} rows={10} spellCheck={false} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface p-3 font-mono text-xs" /><button type="button" onClick={() => void applyMerge()} className="mt-2 min-h-10 rounded-xl bg-primary px-3 text-sm font-bold text-on-primary">Lưu bản gộp để đồng bộ</button></div>}</div>;
}
function labelAction(action: string) { return action === 'create' ? 'Tạo' : action === 'update' ? 'Cập nhật' : 'Xóa'; }
function labelEntity(entity: string) { return ({ trip:'chuyến đi', activity:'lịch trình', expense:'chi tiêu', place:'địa điểm', packing:'hành lý', photo:'ảnh', task:'nhiệm vụ', poll:'bình chọn', vote:'phiếu bầu', comment:'bình luận' } as Record<string,string>)[entity] ?? entity; }
