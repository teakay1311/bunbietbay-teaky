import { Link, useParams } from 'react-router-dom';
import type { FormEvent } from 'react';

import { Icons } from '../components/Icons';
import { useAppContext, CURRENCIES, CalculatedMember } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { formatLocalDate, getLocalDateString, getLocalDateStringWithOffset } from '../utils/date';
import { sortActivitiesByTime } from '../utils/activitySort';
import { useSettings, useFormatMoney } from '../context/SettingsContext';
import { getErrorMessage } from '../utils/errorMessage';
import { motion } from 'framer-motion';
import { processTripExport } from '../utils/exportTrip';
import { StarRatingInput } from '../components/StarRatingInput';

export function TripOverview() {
  const { id } = useParams();
  const { trips, setCurrentTripId, addExpense, activities, expenses, updateTripReview, packingItems, photos, savedPlaces, activityLogs } = useAppContext();
  const { showToast } = useFeedback();
  const { uiDensity } = useSettings();
  const formatMoney = useFormatMoney();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CalculatedMember | null>(null);
  const [isMemberInfoOpen, setIsMemberInfoOpen] = useState(false);
  const [isSettlementSummaryOpen, setIsSettlementSummaryOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  const trip = trips.find(t => t.id === id);
  const tripId = trip?.id;
  const tripMembers = trip?.members ?? [];

  // Calculate debts
  const transactions = useMemo(() => {
    const debtors = tripMembers.filter(m => m.balance < -1).map(m => ({ ...m, amount: Math.abs(m.balance) })).sort((a, b) => b.amount - a.amount);
    const creditors = tripMembers.filter(m => m.balance > 1).map(m => ({ ...m, amount: m.balance })).sort((a, b) => b.amount - a.amount);
    const nextTransactions: Array<{ debtor: CalculatedMember & { amount: number }; creditor: CalculatedMember & { amount: number }; amount: number; id: string }> = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amount = Math.min(debtor.amount, creditor.amount);

      nextTransactions.push({ debtor, creditor, amount, id: `${debtor.id}-${creditor.id}-${amount}` });
      debtors[debtorIndex].amount -= amount;
      creditors[creditorIndex].amount -= amount;

      if (debtors[debtorIndex].amount < 1) debtorIndex++;
      if (creditors[creditorIndex].amount < 1) creditorIndex++;
    }

    return nextTransactions;
  }, [tripMembers]);

  // Upcoming activities (today or tomorrow)
  const today = getLocalDateString();
  const tomorrow = getLocalDateStringWithOffset(1);
  const upcomingActivities = useMemo(
    () => sortActivitiesByTime(activities.filter(a => a.tripId === tripId && (a.date === today || a.date === tomorrow))),
    [activities, today, tomorrow, tripId]
  );
  const tripPackingItems = useMemo(() => packingItems.filter(item => item.tripId === tripId), [packingItems, tripId]);
  const packedItemsCount = useMemo(() => tripPackingItems.filter(item => item.isPacked).length, [tripPackingItems]);
  const tripPhotos = useMemo(() => photos.filter(photo => photo.tripId === tripId), [photos, tripId]);
  const recentActivityLogs = useMemo(
    () => activityLogs.filter((entry) => entry.tripId === tripId).slice(0, 8),
    [activityLogs, tripId],
  );
  const expenseInsights = useMemo(() => {
    const tripExpenses = expenses.filter((expense) => expense.tripId === tripId && !expense.isSettlement);
    if (tripExpenses.length === 0) {
      return {
        topCategory: null as null | string,
        topPct: 0,
        highestDebtor: null as null | CalculatedMember,
      };
    }
    const total = tripExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const categoryTotals = tripExpenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {});
    const sortedCategories = (Object.entries(categoryTotals) as [string, number][]).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCategories[0]?.[0] ?? null;
    const topAmount = sortedCategories[0]?.[1] ?? 0;
    const highestDebtor = [...tripMembers]
      .filter((member) => member.balance < 0)
      .sort((a, b) => a.balance - b.balance)[0] ?? null;
    return {
      topCategory,
      topPct: total > 0 ? (topAmount / total) * 100 : 0,
      highestDebtor,
    };
  }, [expenses, tripId, tripMembers]);
  const attentionCards = useMemo(() => {
    const cards: Array<{ title: string; detail: string; to: string; icon: typeof Icons.AlertTriangle; tone: 'warning' | 'primary' | 'neutral' }> = [];
    const missingPackingItems = tripPackingItems.length - packedItemsCount;
    if (missingPackingItems > 0) {
      cards.push({
        title: 'Hành lý còn thiếu',
        detail: `${missingPackingItems} món chưa được đánh dấu đã chuẩn bị.`,
        to: `/trips/${tripId}/packing`,
        icon: Icons.Package,
        tone: 'warning',
      });
    }
    if (upcomingActivities.length > 0) {
      cards.push({
        title: 'Lịch sắp diễn ra',
        detail: `${upcomingActivities.length} hoạt động trong hôm nay hoặc ngày mai.`,
        to: `/trips/${tripId}/schedule`,
        icon: Icons.CalendarDays,
        tone: 'primary',
      });
    }
    if (transactions.length > 0) {
      cards.push({
        title: 'Cần quyết toán',
        detail: `${transactions.length} giao dịch đề xuất để cân bằng công nợ.`,
        to: `/trips/${tripId}/expenses`,
        icon: Icons.ArrowRightLeft,
        tone: 'warning',
      });
    }
    if (tripPhotos.length === 0) {
      cards.push({
        title: 'Chưa có ảnh',
        detail: 'Thêm ảnh hoặc nhật ký để lưu lại kỷ niệm chuyến đi.',
        to: `/trips/${tripId}/photos`,
        icon: Icons.ImagePlus,
        tone: 'neutral',
      });
    }
    return cards.slice(0, 4);
  }, [packedItemsCount, tripPackingItems.length, upcomingActivities.length, transactions.length, tripPhotos.length, tripId]);

  if (!trip) return <div>Trip not found</div>;

  const canEdit = trip.permissions.canEditContent;
  const canManageMembers = trip.permissions.canManageMembers;
  const remaining = trip.budget - trip.spent;
  const spentPercentage = trip.budget > 0 ? Math.min((trip.spent / trip.budget) * 100, 100) : 0;
  const baseCurrencySymbol = CURRENCIES[trip.baseCurrency || 'VND'].symbol;

  const handleSettleDebt = async (debtorId: string, creditorId: string, amount: number, creditorName: string) => {
    try {
      await addExpense({
        tripId: trip.id,
        date: getLocalDateString(),
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        title: `Thanh toán nợ cho ${creditorName}`,
        category: 'Khác',
        amount: amount,
        originalAmount: amount,
        currency: trip.baseCurrency || 'VND',
        exchangeRate: 1,
        paidBy: debtorId,
        participants: [creditorId],
        note: 'Chuyển khoản thanh toán',
        isSettlement: true,
      });
      showToast({
        tone: 'success',
        title: 'Đã ghi nhận thanh toán',
        message: `Khoản thanh toán cho ${creditorName} đã được ghi lại.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không thể ghi nhận thanh toán',
        message: getErrorMessage(error, 'Không thể ghi nhận thanh toán công nợ.'),
      });
    }
  };

  const budgetWarning = spentPercentage >= 100 ? 'Vượt ngân sách!' : spentPercentage >= 90 ? 'Sắp hết ngân sách!' : null;

  const handleReviewSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSavingReview) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    try {
      setIsSavingReview(true);
      setReviewError(null);
      await updateTripReview(trip.id, {
        transport: Math.min(5, Math.max(1, Number(formData.get('transport')) || 1)),
        accommodation: Math.min(5, Math.max(1, Number(formData.get('accommodation')) || 1)),
        food: Math.min(5, Math.max(1, Number(formData.get('food')) || 1)),
        entertainment: Math.min(5, Math.max(1, Number(formData.get('entertainment')) || 1)),
        memory: formData.get('memory') as string,
      });
      setIsReviewOpen(false);
    } catch (error) {
      setReviewError(getErrorMessage(error, 'Không thể lưu đánh giá chuyến đi.'));
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleExport = async () => {
    if (!trip) return;
    try {
      setIsExporting(true);
      const tripActivities = activities.filter(a => a.tripId === trip.id);
      const tripExpenses = expenses.filter(e => e.tripId === trip.id);
      const tripPlaces = savedPlaces.filter(p => p.tripId === trip.id);
      const tripPacking = packingItems.filter(p => p.tripId === trip.id);
      const tripPhotos = photos.filter(p => p.tripId === trip.id);

      await processTripExport({
        trip,
        activities: tripActivities,
        expenses: tripExpenses,
        places: tripPlaces,
        packing: tripPacking,
        photos: tripPhotos,
      });
      showToast({ tone: 'success', title: 'Thành công', message: 'Tải xuống tệp lưu trữ thành công.' });
    } catch (e) {
      showToast({ tone: 'error', title: 'Lỗi', message: getErrorMessage(e, 'Tải xuống thất bại.') });
    } finally {
      setIsExporting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.02 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { ease: 'easeOut', duration: 0.2 } }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-10">
      <div className="flex flex-col gap-2 mb-6">
        {budgetWarning && (
          <div className="bg-error text-on-error px-4 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 animate-in slide-in-from-top-4 shadow-lg">
            <Icons.AlertTriangle className="w-5 h-5" />
            {budgetWarning} Bạn đã chi tiêu {spentPercentage.toFixed(1)}% ngân sách.
          </div>
        )}
        {upcomingActivities.length > 0 && (
          <div className="bg-primary text-on-primary px-4 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 animate-in slide-in-from-top-4 shadow-lg">
            <Icons.Calendar className="w-5 h-5" />
            Bạn có {upcomingActivities.length} hoạt động sắp diễn ra trong hôm nay/ngày mai!
          </div>
        )}
      </div>
      <div className="relative mb-8 flex flex-col items-stretch gap-4 md:mb-12 md:flex-row md:items-end md:gap-6">
        <div className="w-full md:w-2/3">
          <p className="mb-2 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-secondary dark:text-gray-300 md:text-xs md:tracking-[0.2em]">Chi tiết chuyến đi</p>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface md:text-5xl md:tracking-tighter">{trip.title}</h1>
          <p className="mt-3 flex max-w-md items-center gap-2 leading-relaxed text-on-surface-variant md:mt-4">
            <Icons.MapPin className="w-4 h-4" />
            {trip.location}
          </p>
        </div>
        <div className="group relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-center editorial-shadow md:min-w-[200px] md:rounded-[2rem] md:p-6">
          <h2 className="mb-2 font-label text-xs font-bold uppercase tracking-wide text-primary md:mb-3 md:text-sm md:tracking-widest">Ngân sách tổng</h2>
          <p className="break-words font-headline text-2xl font-bold text-on-surface md:text-3xl">{formatMoney(trip.budget, baseCurrencySymbol)}</p>
          {trip.budget > 0 && (
            <div className="mt-4 w-full h-1 bg-surface-variant rounded-full overflow-hidden">
              <div className="h-full bg-tertiary rounded-full shadow-inner" style={{ width: `${spentPercentage}%` }}></div>
            </div>
          )}
          <p className="font-label text-[10px] mt-2 text-on-surface-variant">Còn lại: {formatMoney(remaining, baseCurrencySymbol)}</p>
        </div>
      </div>

      {attentionCards.length > 0 && (
        <motion.section variants={itemVariants} className="mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 editorial-shadow md:rounded-3xl md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Ưu tiên nhanh</p>
              <h2 className="mt-1 font-headline text-xl font-bold text-on-surface">Việc đáng chú ý</h2>
            </div>
            <Icons.Sparkles className="h-5 w-5 text-primary dark:text-white" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {attentionCards.map((card) => (
              <Link
                key={card.title}
                to={card.to}
                className={`motion-lift rounded-2xl border p-4 transition-colors ${card.tone === 'warning'
                  ? 'border-error/20 bg-error-container/35'
                  : card.tone === 'primary'
                    ? 'border-primary/20 bg-primary/10'
                    : 'border-outline-variant/40 bg-surface-container-low'
                  }`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-primary dark:text-white">
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="font-headline font-bold text-on-surface">{card.title}</p>
                <p className="mt-1 text-sm leading-5 text-secondary dark:text-gray-300">{card.detail}</p>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      <section className={uiDensity === 'compact' ? 'mb-8' : 'mb-12'}>
        <div className={uiDensity === 'compact' ? 'grid grid-cols-1 lg:grid-cols-3 gap-4 density-stack' : 'grid grid-cols-1 lg:grid-cols-3 gap-6'}>
          <motion.div variants={itemVariants} className="rounded-[1.25rem] bg-surface-container-lowest p-4 shadow-[0_12px_24px_rgba(0,0,0,0.06)] density-card ring-1 ring-outline/10 transition-transform hover:-translate-y-1 md:rounded-[1.5rem] md:p-6">
            <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-wide text-secondary dark:text-gray-300 md:tracking-[0.2em]">Trạng thái ngân sách</p>
            <h2 className="font-headline text-2xl font-bold text-on-surface">{spentPercentage.toFixed(1)}%</h2>
            <div className="flex-1">
              <p className="font-bold font-headline">Trạng thái quỹ</p>
              <p className="text-sm mt-0.5 opacity-90">{remaining >= 0
                ? `Bạn còn ${formatMoney(remaining, baseCurrencySymbol)} trước khi chạm trần ngân sách.`
                : `Bạn đã vượt ${formatMoney(Math.abs(remaining), baseCurrencySymbol)} so với ngân sách dự kiến.`}</p>
            </div>
          </motion.div>
          <motion.div variants={itemVariants} className="rounded-[1.25rem] bg-surface-container-lowest p-4 shadow-[0_12px_24px_rgba(0,0,0,0.06)] density-card ring-1 ring-outline/10 transition-transform hover:-translate-y-1 md:rounded-[1.5rem] md:p-6">
            <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-wide text-secondary dark:text-gray-300 md:tracking-[0.2em]">Checklist nhanh</p>
            <h2 className="font-headline text-2xl font-bold text-on-surface">{packedItemsCount}/{tripPackingItems.length}</h2>
            <p className="mt-2 text-sm text-on-surface-variant">Đã chuẩn bị xong {packedItemsCount} món hành lý. Mở ngay danh sách nếu muốn hoàn tất phần còn thiếu.</p>
          </motion.div>
          <motion.div variants={itemVariants} className="rounded-[1.25rem] bg-surface-container-lowest p-4 shadow-[0_12px_24px_rgba(0,0,0,0.06)] density-card ring-1 ring-outline/10 transition-transform hover:-translate-y-1 md:rounded-[1.5rem] md:p-6">
            <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-wide text-secondary dark:text-gray-300 md:tracking-[0.2em]">Timeline sắp tới</p>
            {upcomingActivities.length > 0 ? (
              <div className="space-y-3">
                {upcomingActivities.slice(0, 3).map((activity) => (
                  <div key={activity.id} className="rounded-2xl bg-surface-container-low px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary dark:text-white">{activity.time} · {activity.date === today ? 'Hôm nay' : 'Ngày mai'}</p>
                    <p className="mt-1 font-semibold text-on-surface">{activity.title}</p>
                    <p className="text-sm text-secondary dark:text-gray-300">{activity.location}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">Chưa có hoạt động nào trong 24 giờ tới.</p>
            )}
          </motion.div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <section className="lg:col-span-7 space-y-6">
          {trip.review && (
            <div className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl editorial-shadow relative overflow-hidden mb-8">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="font-headline text-2xl font-bold text-primary dark:text-white flex items-center gap-2">
                    <Icons.Star className="w-6 h-6 fill-current" />
                    Đánh giá chuyến đi
                  </h2>
                  <p className="text-secondary dark:text-gray-300 text-sm mt-1">Cảm nhận và kỷ niệm của bạn về hành trình này.</p>
                </div>
                {canEdit && (
                  <button onClick={() => setIsReviewOpen(true)} className="p-2 text-secondary dark:text-gray-300 hover:text-primary dark:text-white hover:bg-primary-container rounded-lg transition-colors">
                    <Icons.Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Di chuyển', score: trip.review.transport, icon: Icons.Plane },
                  { label: 'Nơi ở', score: trip.review.accommodation, icon: Icons.Hotel },
                  { label: 'Ăn uống', score: trip.review.food, icon: Icons.Utensils },
                  { label: 'Vui chơi', score: trip.review.entertainment, icon: Icons.Ticket },
                ].map(item => (
                  <div key={item.label} className="bg-surface-container-low p-4 rounded-xl text-center">
                    <item.icon className="w-6 h-6 mx-auto text-secondary dark:text-gray-300 mb-2" />
                    <p className="font-label text-[10px] uppercase font-bold text-secondary dark:text-gray-300 mb-1">{item.label}</p>
                    <div className="flex justify-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Icons.Star key={i} className={`w-3 h-3 ${i < item.score ? 'fill-current' : 'text-outline-variant'}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {trip.review.memory && (
                <div className="bg-primary-container/30 p-6 rounded-xl border-l-4 border-primary">
                  <p className="italic text-on-surface-variant leading-relaxed">"{trip.review.memory}"</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <h2 className="font-headline text-xl font-bold text-on-surface">Thành viên ({trip.members.length})</h2>
            <Link to={`/trips/${trip.id}/members`} className="flex items-center gap-2 text-primary dark:text-white font-label text-xs font-bold uppercase tracking-wider hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors">
              <Icons.UserPlus className="w-4 h-4" /> {canManageMembers ? 'Quản lý quyền' : 'Xem quyền'}
            </Link>
          </div>

          <div className="space-y-4">
            {trip.members.map((member) => (
              <motion.div variants={itemVariants} key={member.id}>
                <div
                  onClick={() => { setSelectedMember(member); setIsMemberInfoOpen(true); }}
                  className={`group flex cursor-pointer items-center justify-between gap-3 rounded-[1.25rem] bg-surface-container-lowest p-4 shadow-sm ring-1 ring-outline/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:rounded-[1.5rem] md:p-6 ${member.balance < 0 ? 'border-l-4 border-l-error' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <img alt={member.displayName} className="w-12 h-12 rounded-full object-cover" src={member.avatar} />
                    <div>
                      <h3 className="font-headline font-bold text-on-surface group-hover:text-primary dark:text-white transition-colors">{member.displayName}</h3>
                      <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-tighter font-bold">{member.role}</p>
                    </div>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="font-label text-[10px] text-secondary dark:text-gray-300 uppercase font-bold mb-1">Đã chi</p>
                    <p className="break-words font-headline font-bold text-on-surface">{formatMoney(member.spent, baseCurrencySymbol)}</p>
                    <span className={`text-[11px] font-medium ${member.balance >= 0 ? 'text-tertiary' : 'text-error'}`}>
                      {member.balance >= 0 ? '+' : '-'} {formatMoney(Math.abs(member.balance), baseCurrencySymbol)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.25rem] bg-surface-container-lowest p-4 editorial-shadow ring-1 ring-outline/10 md:rounded-[1.5rem] md:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Activity feed</p>
                <h2 className="mt-1 font-headline text-xl font-bold text-on-surface">Thay đổi gần đây</h2>
              </div>
              <Icons.History className="h-5 w-5 text-secondary dark:text-gray-300" />
            </div>
            {recentActivityLogs.length > 0 ? (
              <div className="space-y-3">
                {recentActivityLogs.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-surface-container-low px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface">{entry.summary}</p>
                        <p className="mt-1 text-xs text-secondary dark:text-gray-300">
                          {entry.actorName || 'Workspace'} · {formatLocalDate(entry.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary dark:text-white">
                        {entry.action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-secondary dark:text-gray-300">
                Chưa có thay đổi nào được ghi nhận cho chuyến đi này.
              </p>
            )}
          </div>
        </section>

        <aside className="lg:col-span-5 space-y-6">
          <motion.div variants={itemVariants} className="sticky top-24">
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-[0_12px_24px_rgba(0,0,0,0.06)] md:rounded-3xl md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary dark:text-gray-300 font-bold mb-2">Hành lý của chuyến đi</p>
                    <h2 className="font-headline text-2xl font-bold text-on-surface">{packedItemsCount}/{tripPackingItems.length}</h2>
                    <p className="mt-2 text-sm text-on-surface-variant">Theo dõi ngay đồ đã chuẩn bị và danh sách còn thiếu cho riêng chuyến đi này.</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-white">
                    <Icons.Package className="h-6 w-6" />
                  </div>
                </div>
                <Link to={`/trips/${trip.id}/packing`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition-opacity hover:opacity-90">
                  Mở hành lý
                  <Icons.ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-[0_12px_24px_rgba(0,0,0,0.06)] md:rounded-3xl md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary dark:text-gray-300 font-bold mb-2">Ảnh & kỷ niệm</p>
                    <h2 className="font-headline text-2xl font-bold text-on-surface">{tripPhotos.length} ảnh</h2>
                    <p className="mt-2 text-sm text-on-surface-variant">Thư viện đã gắn trực tiếp với chuyến đi này, mở ra là đúng album của chuyến hiện tại.</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-container text-on-secondary-container">
                    <Icons.Image className="h-6 w-6" />
                  </div>
                </div>
                <Link to={`/trips/${trip.id}/photos`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-variant">
                  Mở thư viện ảnh
                  <Icons.ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-on-primary shadow-2xl md:rounded-3xl md:p-8">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-container opacity-20 rounded-full blur-2xl"></div>
              <h2 className="font-headline text-2xl font-bold mb-6">Ai trả ai?</h2>

              <div className="space-y-6">
                {transactions.length > 0 ? transactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-4 bg-surface-container-low/40 p-4 rounded-2xl backdrop-blur-md">
                    <div className="flex -space-x-3">
                      <img alt={t.debtor.displayName} className="w-8 h-8 rounded-full border-2 border-primary bg-surface-container-lowest" src={t.debtor.avatar} />
                      <Icons.ArrowRight className="w-5 h-5 text-on-primary/60 pt-1" />
                      <img alt={t.creditor.displayName} className="w-8 h-8 rounded-full border-2 border-primary bg-surface-container-lowest" src={t.creditor.avatar} />
                    </div>
                    <div className="flex-1 min-w-[120px] text-center shrink-0 flex flex-col justify-center items-center">
                      <p className="font-label text-[10px] text-secondary dark:text-gray-300 uppercase font-bold mb-1 tracking-widest"><span className="hidden md:inline">Cần </span>Chuyển</p>
                      <p className="font-label text-lg font-bold">{formatMoney(t.amount, baseCurrencySymbol)}</p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => { void handleSettleDebt(t.debtor.id, t.creditor.id, t.amount, t.creditor.displayName); }}
                        className="bg-surface-container-lowest text-primary dark:text-white px-3 py-1.5 rounded-lg font-label text-[10px] font-extrabold uppercase hover:bg-surface-container transition-colors active:scale-95"
                      >
                        Trả ngay
                      </button>
                    )}
                  </div>
                )) : (
                  <div className="text-center py-8 text-on-primary/80 italic">
                    Tuyệt vời! Không ai nợ ai cả.
                  </div>
                )}
              </div>

              <div className="mt-10">
                {canEdit && (
                  <button
                    onClick={() => setIsReviewOpen(true)}
                    className="w-full bg-secondary-container text-on-secondary-container py-4 rounded-xl font-headline font-bold text-sm tracking-wide mb-3"
                  >
                    {trip.review ? 'Sửa đánh giá chuyến đi' : 'Đánh giá chuyến đi'}
                  </button>
                )}
                <button onClick={() => setIsSettlementSummaryOpen(true)} className="w-full bg-primary text-on-primary py-4 rounded-xl font-headline font-bold text-sm tracking-wide mb-3">
                  Chốt quyết toán chuyến đi
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full bg-surface-container-high text-on-surface py-3 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                >
                  <Icons.Download className="w-4 h-4" />
                  {isExporting ? 'Đang chuẩn bị Tệp...' : 'Tải xuống Lưu trữ Chuyến đi'}
                </button>
              </div>
            </div>

            <div className="mt-6 p-6 bg-surface-container-low rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <Icons.LineChart className="w-5 h-5 text-primary dark:text-white" />
                <span className="font-label text-[10px] uppercase font-bold text-secondary dark:text-gray-300">Phân tích chi tiêu</span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface-variant italic">
                {expenseInsights.topCategory
                  ? `Danh mục chi lớn nhất hiện tại là ${expenseInsights.topCategory} (${expenseInsights.topPct.toFixed(1)}%). ${expenseInsights.highestDebtor ? `${expenseInsights.highestDebtor.displayName} đang âm quỹ nhiều nhất và nên ưu tiên quyết toán.` : 'Hiện chưa có thành viên âm quỹ.'}`
                  : 'Chưa đủ dữ liệu chi tiêu để phân tích. Hãy thêm các khoản chi thực tế để hệ thống tạo insight.'}
              </p>
            </div>
          </motion.div>
        </aside>
      </div>

      <Modal isOpen={isMemberInfoOpen} onClose={() => setIsMemberInfoOpen(false)} title="Thông tin thành viên">
        {selectedMember && (
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <img src={selectedMember.avatar} alt={selectedMember.displayName} className="w-24 h-24 rounded-full object-cover border-4 border-surface-container-high" />
              <div>
                <h3 className="font-headline text-2xl font-bold text-primary dark:text-white">{selectedMember.displayName}</h3>
                <p className="font-label text-xs uppercase tracking-widest text-secondary dark:text-gray-300 font-bold">{selectedMember.role}</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <Icons.Phone className="w-5 h-5 text-secondary dark:text-gray-300" />
                <span className="font-body text-on-surface">{selectedMember.phone || 'Chưa cập nhật'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Icons.Mail className="w-5 h-5 text-secondary dark:text-gray-300" />
                <span className="font-body text-on-surface">{selectedMember.email || 'Chưa cập nhật'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Icons.Calendar className="w-5 h-5 text-secondary dark:text-gray-300" />
                <span className="font-body text-on-surface">{selectedMember.birthdate ? formatLocalDate(selectedMember.birthdate, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa cập nhật'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 mt-4 pt-4 border-t border-outline-variant/30 gap-4">
              <div className="text-center group/stat">
                <p className="text-[10px] uppercase font-bold text-secondary dark:text-gray-300 tracking-wider mb-1 group-hover/stat:text-primary transition-colors">Đã chi</p>
                <p className="font-headline font-bold text-on-surface">{formatMoney(selectedMember.spent, baseCurrencySymbol)}</p>
              </div>
              <div className="text-center group/stat">
                <p className="text-[10px] uppercase font-bold text-secondary dark:text-gray-300 tracking-wider mb-1 group-hover/stat:text-primary transition-colors">Công nợ</p>
                <p className={`font-headline font-bold ${selectedMember.balance > 0 ? 'text-primary dark:text-white' : selectedMember.balance < 0 ? 'text-error dark:text-error-container' : 'text-on-surface'}`}>
                  {selectedMember.balance >= 0 ? '+' : '-'} {formatMoney(Math.abs(selectedMember.balance), baseCurrencySymbol)}
                </p>
              </div>
            </div>
            <button onClick={() => setIsMemberInfoOpen(false)} className="w-full bg-surface-container-high text-on-surface py-3 rounded-xl font-bold hover:bg-surface-variant transition-colors">
              Đóng
            </button>
          </div>
        )}
      </Modal>
      <Modal isOpen={isReviewOpen} onClose={() => { if (!isSavingReview) { setIsReviewOpen(false); setReviewError(null); } }} title="Đánh giá chuyến đi">
        <form onSubmit={handleReviewSubmit} className="space-y-6">
          {reviewError && (
            <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
              {reviewError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { name: 'transport', label: 'Di chuyển' },
              { name: 'accommodation', label: 'Nơi ở' },
              { name: 'food', label: 'Ăn uống' },
              { name: 'entertainment', label: 'Vui chơi' },
            ].map(item => (
              <div key={item.name}>
                <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">{item.label}</label>
                <div className="pt-1">
                  <StarRatingInput name={item.name} defaultValue={(trip.review as any)?.[item.name] || 5} />
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Chia sẻ cảm nhận / Kỷ niệm</label>
            <textarea name="memory" rows={4} defaultValue={trip.review?.memory || ''} placeholder="Kỷ niệm đáng nhớ nhất của bạn là gì?" className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"></textarea>
          </div>
          <div className="pt-4">
            <button type="submit" disabled={isSavingReview} className="density-button w-full bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
              {isSavingReview ? 'Đang lưu...' : 'Lưu đánh giá'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isSettlementSummaryOpen} onClose={() => setIsSettlementSummaryOpen(false)} title="Tóm tắt quyết toán">
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-container-low p-4">
            <div className="p-4 bg-surface-container-high border-b border-outline-variant/30 flex justify-between items-center">
              <p className="text-on-surface font-medium">Tổng chi: {formatMoney(trip.spent, baseCurrencySymbol)}</p>
            </div>
            <p className="text-sm text-secondary dark:text-gray-300 mt-2">Danh sách bên dưới là các giao dịch tối thiểu để mọi người cân bằng lại chi tiêu.</p>
          </div>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-2xl bg-surface-container-low px-4 py-3">
                  <p className="font-semibold text-on-surface">{transaction.debtor.displayName} trả {transaction.creditor.displayName}</p>
                  <div className="flex-1 mx-4 shrink-0 flex flex-col items-center justify-center opacity-80 border-t border-dashed border-outline-variant/50 relative top-2">
                    <Icons.ArrowRight className="w-4 h-4 text-primary dark:text-white absolute -top-2 bg-surface-container-low" />
                    <p className="text-primary dark:text-white font-bold">{formatMoney(transaction.amount, baseCurrencySymbol)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-secondary dark:text-gray-300">
              Không có giao dịch quyết toán nào cần thực hiện.
            </div>
          )}
        </div>
      </Modal>

    </motion.div>
  );
}
