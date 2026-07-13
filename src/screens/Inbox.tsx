import { Icons } from '../components/Icons';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useNotebook } from '../context/NotebookContext';
import { formatLocalDateTime } from '../utils/date';

export function Inbox() {
  const { pendingInvitations, acceptInvitation, declineInvitation } = useAuth();
  const { pendingNotebookInvitations, acceptNotebookInvitation, declineNotebookInvitation } = useNotebook();
  const { showToast } = useFeedback();
  const total = pendingInvitations.length + pendingNotebookInvitations.length;

  const run = async (action: () => Promise<void>, success: string) => {
    try {
      await action();
      showToast({ tone: 'success', title: success });
    } catch (error) {
      showToast({ tone: 'error', title: 'Không thể cập nhật lời mời', message: error instanceof Error ? error.message : 'Hãy thử lại.' });
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold text-secondary">Hộp thư cộng tác</p>
        <h1 className="text-balance font-headline text-3xl font-extrabold text-on-surface md:text-5xl">Lời mời cần phản hồi</h1>
        <p className="mt-3 text-pretty text-secondary">Tất cả lời mời chuyến đi và Thư viện được xử lý tại một nơi.</p>
      </header>

      {total === 0 ? (
        <section className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-8 text-center">
          <Icons.Mail className="mx-auto size-10 text-primary" />
          <h2 className="mt-4 font-headline text-xl font-bold">Hộp thư đã được xử lý</h2>
          <p className="mt-2 text-pretty text-sm text-secondary">Lời mời mới sẽ xuất hiện ở đây.</p>
        </section>
      ) : (
        <div className="space-y-8">
          <InvitationSection title="Chuyến đi" empty="Không có lời mời chuyến đi.">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id}>
                <InvitationCard
                title={invitation.tripTitle}
                description={`Vai trò ${invitation.role}${invitation.invitedByName ? ` · Mời bởi ${invitation.invitedByName}` : ''}`}
                createdAt={invitation.createdAt}
                onAccept={() => run(() => acceptInvitation(invitation.id), 'Đã tham gia chuyến đi')}
                onDecline={() => run(() => declineInvitation(invitation.id), 'Đã từ chối lời mời')}
                />
              </div>
            ))}
          </InvitationSection>

          <InvitationSection title="Thư viện" empty="Không có lời mời Thư viện.">
            {pendingNotebookInvitations.map((invitation) => (
              <div key={invitation.id}>
                <InvitationCard
                title={invitation.notebookName}
                description={`Vai trò ${invitation.role}${invitation.invitedByName ? ` · Mời bởi ${invitation.invitedByName}` : ''}`}
                createdAt={invitation.createdAt}
                onAccept={() => run(() => acceptNotebookInvitation(invitation.id), 'Đã tham gia Thư viện')}
                onDecline={() => run(() => declineNotebookInvitation(invitation.id), 'Đã từ chối lời mời')}
                />
              </div>
            ))}
          </InvitationSection>
        </div>
      )}
    </div>
  );
}

function InvitationSection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <section>
      <h2 className="mb-3 font-headline text-xl font-bold">{title}</h2>
      <div className="space-y-3">{items.length ? children : <p className="text-sm text-secondary">{empty}</p>}</div>
    </section>
  );
}

function InvitationCard({ title, description, createdAt, onAccept, onDecline }: {
  title: string;
  description: string;
  createdAt: string;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-headline text-lg font-bold">{title}</h3>
        <p className="mt-1 text-pretty text-sm text-secondary">{description}</p>
        <p className="mt-2 text-xs text-secondary">{formatLocalDateTime(createdAt)}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void onDecline()} className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm font-semibold">Từ chối</button>
        <button type="button" onClick={() => void onAccept()} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">Chấp nhận</button>
      </div>
    </article>
  );
}
