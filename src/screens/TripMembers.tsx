import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { CURRENCIES, useAppContext, type CalculatedMember, type TripAccessRole, type TripInvitation } from '../context/AppContext';
import { useFormatMoney } from '../context/SettingsContext';
import { useFeedback } from '../context/FeedbackContext';
import { formatLocalDateTime } from '../utils/date';
import { getErrorMessage } from '../utils/errorMessage';
import { motion } from 'motion/react';
import { fadeUpVariants, pageStaggerVariants } from '../ui/motion';
import { SortSelect } from '../components/SortSelect';
import { chainComparators, compareDate, compareNumber, compareText, stableSort, type SortOption } from '../utils/listSort';

const ROLE_OPTIONS: Array<{ value: Exclude<TripAccessRole, 'owner'>; label: string; description: string }> = [
  { value: 'admin', label: 'Quản trị viên', description: 'Quản lý thành viên, nội dung và thiết lập chuyến đi' },
  { value: 'editor', label: 'Người chỉnh sửa', description: 'Chỉnh sửa lịch trình, chi tiêu, địa điểm, ảnh và hành lý' },
  { value: 'viewer', label: 'Chỉ xem', description: 'Xem nhưng không chỉnh sửa nội dung chuyến đi' },
];

type MemberSortKey = 'roleAsc' | 'nameAsc' | 'spentDesc' | 'spentAsc' | 'balanceDesc' | 'balanceAsc' | 'joinedDesc' | 'joinedAsc';
type InvitationSortKey = 'createdDesc' | 'createdAsc' | 'statusAsc' | 'roleAsc' | 'emailAsc';

const MEMBER_SORT_OPTIONS: Array<SortOption<MemberSortKey>> = [
  { value: 'roleAsc', label: 'Vai trò' },
  { value: 'nameAsc', label: 'Tên A-Z' },
  { value: 'spentDesc', label: 'Chi nhiều nhất' },
  { value: 'spentAsc', label: 'Chi ít nhất' },
  { value: 'balanceDesc', label: 'Số dư cao nhất' },
  { value: 'balanceAsc', label: 'Số dư thấp nhất' },
  { value: 'joinedDesc', label: 'Mới tham gia' },
  { value: 'joinedAsc', label: 'Cũ nhất' },
];

const INVITATION_SORT_OPTIONS: Array<SortOption<InvitationSortKey>> = [
  { value: 'createdDesc', label: 'Mới nhất' },
  { value: 'createdAsc', label: 'Cũ nhất' },
  { value: 'statusAsc', label: 'Trạng thái' },
  { value: 'roleAsc', label: 'Vai trò' },
  { value: 'emailAsc', label: 'Email A-Z' },
];

const ROLE_RANK: Record<TripAccessRole, number> = {
  owner: 0,
  admin: 1,
  editor: 2,
  viewer: 3,
};

export function TripMembers() {
  const { id } = useParams();
  const location = useLocation();
  const {
    trips,
    invitations,
    setCurrentTripId,
    inviteTripMember,
    revokeTripInvitation,
    updateTripMemberRole,
    removeTripMember,
    currentUserProfile,
  } = useAppContext();
  const { showToast, confirm } = useFeedback();
  const formatMoney = useFormatMoney();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CalculatedMember | null>(null);
  const [inviteRole, setInviteRole] = useState<Exclude<TripAccessRole, 'owner'>>('editor');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [busyMembershipId, setBusyMembershipId] = useState<string | null>(null);
  const [memberSortBy, setMemberSortBy] = useState<MemberSortKey>('roleAsc');
  const [invitationSortBy, setInvitationSortBy] = useState<InvitationSortKey>('createdDesc');

  useEffect(() => {
    if (id) {
      setCurrentTripId(id);
    }
  }, [id, setCurrentTripId]);

  useEffect(() => {
    const state = location.state as { openInviteMemberModal?: boolean } | null;
    if (state?.openInviteMemberModal) {
      setIsInviteOpen(true);
    }
  }, [location.state]);

  const trip = trips.find((item) => item.id === id);
  const tripInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.tripId === id),
    [id, invitations],
  );

  if (!trip) {
    return <div>Trip not found</div>;
  }

  const canManageMembers = trip.permissions.canManageMembers;
  const baseCurrencySymbol = CURRENCIES[trip.baseCurrency || 'VND'].symbol;
  const currentMembership = trip.members.find((member) => member.id === currentUserProfile?.id) ?? null;
  const sortedMembers = stableSort<CalculatedMember>(trip.members, chainComparators<CalculatedMember>((a, b) => {
    switch (memberSortBy) {
      case 'nameAsc': return compareText(a.displayName, b.displayName, 'asc');
      case 'spentDesc': return compareNumber(a.spent, b.spent, 'desc');
      case 'spentAsc': return compareNumber(a.spent, b.spent, 'asc');
      case 'balanceDesc': return compareNumber(a.balance, b.balance, 'desc');
      case 'balanceAsc': return compareNumber(a.balance, b.balance, 'asc');
      case 'joinedDesc': return compareDate(a.createdAt, b.createdAt, 'desc');
      case 'joinedAsc': return compareDate(a.createdAt, b.createdAt, 'asc');
      case 'roleAsc':
      default: return compareNumber(ROLE_RANK[a.role], ROLE_RANK[b.role], 'asc');
    }
  }, (a, b) => compareText(a.displayName, b.displayName, 'asc')));
  const sortedInvitations = stableSort<TripInvitation>(tripInvitations, chainComparators<TripInvitation>((a, b) => {
    switch (invitationSortBy) {
      case 'createdAsc': return compareDate(a.createdAt, b.createdAt, 'asc');
      case 'statusAsc': return compareText(a.status, b.status, 'asc');
      case 'roleAsc': return compareNumber(ROLE_RANK[a.role], ROLE_RANK[b.role], 'asc');
      case 'emailAsc': return compareText(a.email, b.email, 'asc');
      case 'createdDesc':
      default: return compareDate(a.createdAt, b.createdAt, 'desc');
    }
  }, (a, b) => compareText(a.email, b.email, 'asc')));

  const containerVariants = pageStaggerVariants;
  const itemVariants = fadeUpVariants;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-10">
      <motion.section variants={itemVariants} className="mb-8 flex flex-col gap-4 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-label text-[11px] font-bold uppercase tracking-[0.16em] text-secondary dark:text-gray-300 md:text-xs md:tracking-[0.26em]">Quản lý truy cập chuyến đi</p>
          <h1 className="mt-2 font-headline text-2xl font-black text-on-surface md:mt-3 md:text-5xl md:tracking-[-0.05em]">{trip.title}</h1>
          <p className="mt-3 hidden max-w-2xl text-lg leading-8 text-secondary dark:text-gray-300 md:block">
            Phân quyền theo email và theo vai trò. Chỉ owner hoặc admin mới có thể thêm người, đổi quyền, hoặc thu hồi quyền truy cập.
          </p>
        </div>

        {canManageMembers && (
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-headline text-base font-bold text-white transition hover:opacity-95 dark:bg-white dark:text-slate-950 md:w-auto md:rounded-2xl md:px-6 md:py-4 md:text-lg"
          >
            <Icons.UserPlus className="h-5 w-5" />
            Mời theo email
          </button>
        )}
      </motion.section>

      <motion.div variants={itemVariants} className="mb-8 grid gap-6 xl:grid-cols-[1fr_0.94fr]">
        <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-[0_12px_28px_rgba(0,0,0,0.05)] md:rounded-[2rem] md:p-6 md:shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
          <div className="mb-6 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-label text-[11px] font-bold uppercase tracking-[0.16em] text-secondary dark:text-gray-300 md:text-xs md:tracking-[0.24em]">Thành viên hiện tại</p>
              <h2 className="mt-2 font-headline text-2xl font-black text-on-surface md:text-3xl md:tracking-[-0.04em]">{trip.members.length} người đang có quyền</h2>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              <SortSelect<MemberSortKey> value={memberSortBy} options={MEMBER_SORT_OPTIONS} onChange={setMemberSortBy} className="w-full md:w-auto" />
              {currentMembership && (
                <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white">
                  Bạn là {currentMembership.role}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {sortedMembers.map((member) => (
              <motion.div variants={itemVariants} key={member.membershipId} className="rounded-[1.25rem] bg-surface-container-low p-4 md:rounded-[1.5rem]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <img src={member.avatar} alt={member.displayName} className="h-12 w-12 shrink-0 rounded-full border-4 border-surface-container-lowest object-cover md:h-16 md:w-16" />
                    <div className="min-w-0 flex flex-col justify-center gap-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-headline text-lg font-black text-on-surface md:text-xl md:tracking-[-0.03em]">{member.displayName}</p>
                        <span className="shrink-0 rounded-full bg-surface-container-lowest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface md:tracking-widest">
                          {member.role}
                        </span>
                      </div>
                      <p className="truncate text-sm text-secondary dark:text-gray-300">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedMember(member)}
                      className="rounded-xl border border-outline-variant/60 px-3 py-2 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary dark:text-white"
                    >
                      Xem chi tiết
                    </button>
                    {canManageMembers && member.role !== 'owner' && member.id !== currentUserProfile?.id && (
                      <>
                        <select
                          aria-label={`Vai trò của ${member.displayName}`}
                          value={member.role}
                          disabled={busyMembershipId === member.membershipId}
                          onChange={async (event) => {
                            try {
                              setBusyMembershipId(member.membershipId);
                              await updateTripMemberRole(member.membershipId, event.target.value as TripAccessRole);
                            } catch (error) {
                              showToast({
                                tone: 'error',
                                title: 'Không thể cập nhật quyền',
                                message: getErrorMessage(error, 'Không thể cập nhật quyền thành viên.'),
                              });
                            } finally {
                              setBusyMembershipId(null);
                            }
                          }}
                          className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-on-surface outline-none transition focus:border-primary"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busyMembershipId === member.membershipId}
                          onClick={async () => {
                            const shouldRemove = await confirm({
                              title: `Thu hồi quyền của ${member.displayName}`,
                              message: 'Người này sẽ không còn truy cập được chuyến đi cho tới khi được mời lại.',
                              confirmLabel: 'Thu hồi quyền',
                              cancelLabel: 'Giữ lại',
                              tone: 'danger',
                            });
                            if (!shouldRemove) {
                              return;
                            }

                            try {
                              setBusyMembershipId(member.membershipId);
                              await removeTripMember(member.membershipId);
                            } catch (error) {
                              showToast({
                                tone: 'error',
                                title: 'Không thể thu hồi quyền',
                                message: getErrorMessage(error, 'Không thể thu hồi quyền.'),
                              });
                            } finally {
                              setBusyMembershipId(null);
                            }
                          }}
                          className="rounded-xl border border-error px-3 py-2 text-sm font-semibold text-error transition hover:bg-error-container"
                        >
                          Thu hồi
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl bg-slate-950 p-4 text-white shadow-[0_12px_28px_rgba(0,0,0,0.05)] md:rounded-[2rem] md:p-6 md:shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
            <p className="font-label text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200 md:text-xs md:tracking-[0.24em]">Role matrix</p>
            <div className="mt-4 space-y-3 md:mt-5 md:space-y-4">
              <div>
                <p className="font-headline text-xl font-bold">Owner</p>
                <p className="text-sm leading-7 text-slate-300">Toàn quyền, bao gồm quản trị thành viên, chuyển vai trò, chỉnh sửa toàn bộ nội dung và quản trị thiết lập chuyến đi.</p>
              </div>
              {ROLE_OPTIONS.map((option) => (
                <div key={option.value}>
                  <p className="font-headline text-xl font-bold">{option.label}</p>
                  <p className="text-sm leading-7 text-slate-300">{option.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-surface-container-lowest p-4 shadow-[0_12px_28px_rgba(0,0,0,0.05)] md:rounded-[2rem] md:p-6 md:shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-label text-[11px] font-bold uppercase tracking-[0.16em] text-secondary dark:text-gray-300 md:text-xs md:tracking-[0.24em]">Pending invitations</p>
                <h2 className="mt-2 font-headline text-xl font-black text-on-surface md:text-2xl md:tracking-[-0.04em]">Lời mời đang chờ</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <SortSelect<InvitationSortKey> value={invitationSortBy} options={INVITATION_SORT_OPTIONS} onChange={setInvitationSortBy} className="w-full py-2 md:w-auto" />
                <div className="rounded-full bg-surface-container-low px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-secondary dark:text-gray-300">
                  {tripInvitations.filter((invitation) => invitation.status === 'pending').length} pending
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {tripInvitations.length === 0 && (
                <div className="rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-secondary dark:text-gray-300">
                  Chưa có lời mời nào cho chuyến đi này.
                </div>
              )}
              {sortedInvitations.map((invitation) => (
                <div key={invitation.id} className="rounded-2xl bg-surface-container-low px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <p className="font-semibold text-on-surface">{invitation.email}</p>
                      <p className="text-sm text-secondary dark:text-gray-300">Vai trò: {invitation.role} · Trạng thái: {invitation.status}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-secondary dark:text-gray-300">
                        {formatLocalDateTime(invitation.createdAt)}
                      </p>
                    </div>
                    {canManageMembers && invitation.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await inviteTripMember(trip.id, {
                                email: invitation.email,
                                role: invitation.role,
                              });
                              showToast({
                                tone: 'success',
                                title: 'Đã gửi lại lời mời',
                                message: `Lời mời đã được gửi lại cho ${invitation.email}.`,
                              });
                            } catch (error) {
                              showToast({
                                tone: 'error',
                                title: 'Không thể gửi lại lời mời',
                                message: getErrorMessage(error, 'Không thể gửi lại lời mời.'),
                              });
                            }
                          }}
                          className="rounded-xl border border-outline-variant/60 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-on-surface"
                        >
                          Gửi lại
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await revokeTripInvitation(invitation.id);
                            } catch (error) {
                              showToast({
                                tone: 'error',
                                title: 'Không thể thu hồi lời mời',
                                message: getErrorMessage(error, 'Không thể thu hồi lời mời.'),
                              });
                            }
                          }}
                          className="rounded-xl border border-error px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-error"
                        >
                          Thu hồi
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </motion.div>

      <Modal isOpen={isInviteOpen} onClose={() => { if (!isInviting) { setIsInviteOpen(false); setInviteError(null); } }} title="Mời người tham gia bằng email">
        <form
          className="space-y-4"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            try {
              setIsInviting(true);
              setInviteError(null);
              await inviteTripMember(trip.id, { email: inviteEmail, role: inviteRole });
              setInviteEmail('');
              setInviteRole('editor');
              setIsInviteOpen(false);
            } catch (error) {
              setInviteError(getErrorMessage(error, 'Không thể gửi lời mời.'));
            } finally {
              setIsInviting(false);
            }
          }}
        >
          {inviteError && (
            <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
              {inviteError}
            </div>
          )}
          <div>
            <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Email</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="member@example.com"
              className="density-control w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-2 block font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Vai trò</label>
            <div className="space-y-3">
              {ROLE_OPTIONS.map((option) => (
                <label key={option.value} className={`block cursor-pointer rounded-2xl border px-4 py-4 transition ${inviteRole === option.value ? 'border-primary bg-primary/5' : 'border-outline-variant/60 bg-surface-container-low'}`}>
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={inviteRole === option.value}
                    onChange={() => setInviteRole(option.value)}
                    className="sr-only"
                  />
                  <p className="font-headline text-lg font-bold text-on-surface">{option.label}</p>
                  <p className="mt-1 text-sm text-secondary dark:text-gray-300">{option.description}</p>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={isInviting} className="density-button w-full rounded-2xl bg-slate-950 font-headline text-lg font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60">
            {isInviting ? 'Đang gửi lời mời...' : 'Gửi lời mời'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={Boolean(selectedMember)} onClose={() => setSelectedMember(null)} title="Thông tin thành viên">
        {selectedMember && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <img src={selectedMember.avatar} alt={selectedMember.displayName} className="h-24 w-24 rounded-full border-4 border-surface-container-lowest object-cover" />
              <div>
                <p className="font-headline text-3xl font-black tracking-[-0.04em] text-on-surface">{selectedMember.displayName}</p>
                <p className="mt-2 text-sm text-secondary dark:text-gray-300">{selectedMember.email}</p>
                <p className="mt-2 inline-flex rounded-full bg-slate-950 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  {selectedMember.role}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-surface-container-low px-4 py-4">
                <p className="font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Số điện thoại</p>
                <p className="mt-2 font-medium text-on-surface">{selectedMember.phone || 'Chưa cập nhật'}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low px-4 py-4">
                <p className="font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Ngày sinh</p>
                <p className="mt-2 font-medium text-on-surface">{selectedMember.birthdate || 'Chưa cập nhật'}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low px-4 py-4">
                <p className="font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Đã thanh toán</p>
                <p className="mt-2 font-medium text-on-surface">{formatMoney(selectedMember.spent, baseCurrencySymbol)}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low px-4 py-4">
                <p className="font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary dark:text-gray-300">Số dư</p>
                <p className="mt-2 font-medium text-on-surface">
                  {selectedMember.balance >= 0 ? '+' : '-'} {formatMoney(Math.abs(selectedMember.balance), baseCurrencySymbol)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
