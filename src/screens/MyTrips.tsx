import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { motion } from 'motion/react';
import { pageStaggerVariants } from '../ui/motion';

import { Icons } from '../components/Icons';
import { useAppContext, CURRENCIES, Currency } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { useSettings, useFormatMoney } from '../context/SettingsContext';
import { cn } from '../components/Layout';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { formatLocalDate, getLocalDateString } from '../utils/date';
import { getTripDateValidationError } from '../utils/tripValidation';
import { getErrorMessage } from '../utils/errorMessage';
import { CoverPhotoSelector } from '../components/CoverPhotoSelector';
import { SortSelect } from '../components/SortSelect';
import { type SortOption } from '../utils/listSort';
import { countPackingByTrip, countPhotosByTrip, filterAndSortTrips, sumExpensesByTrip, type TripSortKey } from '../features/trips/selectors';

const TRIP_SORT_OPTIONS: Array<SortOption<TripSortKey>> = [
  { value: 'startDateDesc', label: 'Ngày đi mới nhất' },
  { value: 'startDateAsc', label: 'Ngày đi cũ nhất' },
  { value: 'createdDesc', label: 'Mới tạo nhất' },
  { value: 'createdAsc', label: 'Cũ nhất' },
  { value: 'budgetDesc', label: 'Ngân sách cao nhất' },
  { value: 'budgetAsc', label: 'Ngân sách thấp nhất' },
  { value: 'spentDesc', label: 'Đã chi cao nhất' },
  { value: 'spentAsc', label: 'Đã chi thấp nhất' },
  { value: 'titleAsc', label: 'Tên A-Z' },
  { value: 'titleDesc', label: 'Tên Z-A' },
];

const MY_TRIPS_VIEW_PREF_KEY = 'bunbietbay-my-trips-view';

function loadMyTripsViewPrefs() {
  try {
    return JSON.parse(localStorage.getItem(MY_TRIPS_VIEW_PREF_KEY) || '{}') as Partial<{
      statusFilter: 'all' | 'upcoming' | 'completed' | 'draft';
      viewMode: 'grid' | 'list';
      sortBy: TripSortKey;
    }>;
  } catch {
    return {};
  }
}

const MiniCircularProgress = ({ value, size = 32, strokeWidth = 4, colorClass = "text-primary" }: { value: number, size?: number, strokeWidth?: number, colorClass?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        <circle
          className="text-surface-variant stroke-current"
          strokeWidth={strokeWidth}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
        />
        <circle
          className={`${colorClass} stroke-current transition-all duration-1000 ease-out`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
        />
      </svg>
      <span className="absolute text-[8px] font-bold tracking-tighter" style={{ color: value > 100 ? '#ef4444' : 'inherit' }}>
        {Math.round(value)}%
      </span>
    </div>
  );
};

export function MyTrips() {
  const { trips, addTrip, editTrip, duplicateTrip, deleteTrip, packingItems, photos, toggleTripPin, expenses } = useAppContext();
  const { showToast, confirm } = useFeedback();
  const { language, uiDensity } = useSettings();
  const formatMoney = useFormatMoney();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [duplicateTripId, setDuplicateTripId] = useState<string | null>(null);
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false);
  const [tripFormError, setTripFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed' | 'draft'>(() => loadMyTripsViewPrefs().statusFilter ?? 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => loadMyTripsViewPrefs().viewMode ?? 'grid');
  const [sortBy, setSortBy] = useState<TripSortKey>(() => loadMyTripsViewPrefs().sortBy ?? 'startDateDesc');

  useEffect(() => {
    localStorage.setItem(MY_TRIPS_VIEW_PREF_KEY, JSON.stringify({ statusFilter, viewMode, sortBy }));
  }, [sortBy, statusFilter, viewMode]);

  useEffect(() => {
    const handleOpenAddTripModal = () => {
      setEditingTripId(null);
      setIsAddOpen(true);
    };

    window.addEventListener('openAddTripModal', handleOpenAddTripModal);
    return () => window.removeEventListener('openAddTripModal', handleOpenAddTripModal);
  }, []);

  useEffect(() => {
    const state = location.state as { openAddTripModal?: boolean } | null;
    if (!state?.openAddTripModal) return;

    setEditingTripId(null);
    setIsAddOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const handleAddTrip = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const status = (formData.get('status') as 'upcoming' | 'completed' | 'draft') || 'upcoming';

    const dateValidationError = getTripDateValidationError(startDate, endDate);
    if (dateValidationError) {
      setTripFormError(dateValidationError);
      return;
    }

    const budget = Number(formData.get('budget'));
    if (!Number.isFinite(budget) || budget <= 0) {
      setTripFormError('Ngân sách phải lớn hơn 0.');
      return;
    }

    setTripFormError(null);

    try {
      setIsSubmitting(true);
      if (editingTripId) {
        await editTrip(editingTripId, {
          title: formData.get('title') as string,
          location: formData.get('location') as string,
          startDate,
          endDate,
          budget,
          baseCurrency: formData.get('baseCurrency') as Currency,
          image: formData.get('image') as string || editingTrip?.image,
          themeColor: (formData.get('themeColor') as string) || undefined,
          status,
        });
        setEditingTripId(null);
      } else {
        await addTrip({
          title: formData.get('title') as string,
          location: formData.get('location') as string,
          startDate,
          endDate,
          budget,
          baseCurrency: formData.get('baseCurrency') as Currency,
          image: formData.get('image') as string || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBNwBnWoBo158dem-P8xSIbQ_85ZKdImaXbi_voQtZ9bp37lJlYlqChi6ExeK1ltAGJUUd2xmp266HL6l9zi3-gLznGgpzVZODbSjLzi2BuctK67XYi7GMn7IyNUfZUjJSz8wTMC0r6BNuLzmjajej_QmccAkbZmhqKP1M71Zy1fGDnqrkvSz_VPsP7HbVMNZ0pF4JgSWIx_4yRzPx-szCsEjRXvAEITiwemzOndLNpT1huf4AvIMenEMU2mwSzjpf6PPRfe1iYo9M',
          themeColor: (formData.get('themeColor') as string) || undefined,
          status,
        });
      }
      setIsAddOpen(false);
    } catch (error) {
      setTripFormError(getErrorMessage(error, 'Không thể lưu chuyến đi. Hãy thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const editingTrip = trips.find(t => t.id === editingTripId);
  const packingCountByTrip = useMemo(() => countPackingByTrip(packingItems), [packingItems]);
  const photoCountByTrip = useMemo(() => countPhotosByTrip(photos), [photos]);
  const packedCountByTrip = useMemo(() => countPackingByTrip(packingItems, true), [packingItems]);
  const spentByTrip = useMemo(() => sumExpensesByTrip(expenses), [expenses]);
  const filteredTrips = useMemo(() => filterAndSortTrips({
    trips, status: statusFilter, query: searchQuery, startDate: startDateFilter, endDate: endDateFilter, sortBy, spentByTrip,
  }), [trips, statusFilter, searchQuery, startDateFilter, endDateFilter, sortBy, spentByTrip]);
  const today = getLocalDateString();

  const handleDuplicateTrip = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (duplicateSubmitting || !duplicateTripId) return;

    try {
      setDuplicateSubmitting(true);
      const formData = new FormData(e.currentTarget);
      const title = formData.get('title') as string;
      const newStartDate = formData.get('startDate') as string;

      const trip = trips.find(t => t.id === duplicateTripId);
      if (!trip) return;

      const date1 = new Date(trip.startDate);
      const date2 = new Date(newStartDate);
      const offsetDays = Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));

      await duplicateTrip(duplicateTripId, title, offsetDays);
      setDuplicateTripId(null);
      showToast({ tone: 'success', title: 'Thành công', message: 'Đã nhân bản chuyến đi' });
    } catch (err: any) {
      showToast({ tone: 'error', title: 'Lỗi', message: getErrorMessage(err, 'Không thể nhân bản') });
    } finally {
      setDuplicateSubmitting(false);
    }
  };

  const containerVariants = pageStaggerVariants;

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { ease: 'easeOut', duration: 0.2 } }
  } as const;

  return (
    <>
      <section className="mb-8 md:mb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="density-hero relative flex h-[180px] items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary-container p-5 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.18)] ring-1 ring-white/10 md:h-[300px] md:p-12 md:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)]"
        >
          <div className="absolute right-0 top-0 w-1/2 h-full opacity-20 pointer-events-none mix-blend-overlay">
            <img alt="Travel abstract" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNwBnWoBo158dem-P8xSIbQ_85ZKdImaXbi_voQtZ9bp37lJlYlqChi6ExeK1ltAGJUUd2xmp266HL6l9zi3-gLznGgpzVZODbSjLzi2BuctK67XYi7GMn7IyNUfZUjJSz8wTMC0r6BNuLzmjajej_QmccAkbZmhqKP1M71Zy1fGDnqrkvSz_VPsP7HbVMNZ0pF4JgSWIx_4yRzPx-szCsEjRXvAEITiwemzOndLNpT1huf4AvIMenEMU2mwSzjpf6PPRfe1iYo9M" />
          </div>
          <div className="relative z-10 max-w-lg">
            <h1 className="mb-4 font-headline text-2xl font-extrabold leading-tight text-on-primary drop-shadow-sm sm:text-3xl md:mb-6 md:text-4xl">
              {language === 'vi' ? 'Chuyến hành trình tiếp theo của bạn bắt đầu tại đây.' : 'Your next journey begins here.'}
            </h1>
            <button onClick={() => { setEditingTripId(null); setIsAddOpen(true); }} className="group flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-[0_12px_24px_rgba(0,0,0,0.18)] ring-1 ring-white/50 transition-transform hover:scale-105 active:scale-95 md:gap-3 md:px-8 md:py-4 md:text-lg">
              <Icons.PlusCircle className="h-5 w-5 md:h-6 md:w-6" />
              {language === 'vi' ? 'Tạo chuyến đi mới' : 'Create new trip'}
            </button>
          </div>
        </motion.div>
      </section>

      <section>
          <div className="mb-6 flex flex-col gap-3 md:mb-8 md:gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="font-label text-[11px] font-extrabold uppercase tracking-[0.16em] text-secondary dark:text-gray-300 md:text-xs md:tracking-[0.2em]">{language === 'vi' ? 'Bộ sưu tập' : 'Collection'}</span>
              <h2 className="mt-1 font-headline text-2xl font-bold text-primary dark:text-white md:text-3xl">{language === 'vi' ? 'Chuyến đi của tôi' : 'My Trips'}</h2>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-1">
                <button aria-label="Hiển thị dạng danh sách" title="Danh sách" onClick={() => setViewMode('list')} className={cn('p-1.5 rounded-full transition-colors', viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-on-surface hover:bg-surface-container-highest')}>
                  <Icons.Menu className="w-4 h-4" />
                </button>
                <button aria-label="Hiển thị dạng lưới" title="Dạng lưới" onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-full transition-colors', viewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-on-surface hover:bg-surface-container-highest')}>
                  <Icons.LayoutDashboard className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:gap-3">
            <div className="flex-1 relative">
              <Icons.Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-50" />
              <input
                type="text"
                placeholder="Tìm chuyến đi (tiêu đề, địa điểm)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-surface-container-high py-2.5 pl-10 pr-4 font-label font-medium text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/50 sm:col-span-2"
              />
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-surface-container-high px-3 py-2 transition-colors hover:bg-surface-container-highest">
              <Icons.Calendar className="w-4 h-4 text-secondary opacity-50" />
              <input
                type="date"
                value={startDateFilter}
                onChange={e => setStartDateFilter(e.target.value)}
                className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm font-semibold text-on-surface outline-none"
                title="Từ ngày"
              />
              <span className="text-secondary opacity-50 font-bold">-</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={e => setEndDateFilter(e.target.value)}
                className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm font-semibold text-on-surface outline-none"
                title="Đến ngày"
              />
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-surface-container-high px-3 py-2">
              <Icons.Filter className="w-5 h-5 text-on-surface" />
              <select
                aria-label="Lọc chuyến đi theo trạng thái"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'upcoming' | 'completed' | 'draft')}
                className="min-w-0 flex-1 cursor-pointer truncate bg-transparent text-sm font-semibold text-on-surface outline-none"
              >
                <option value="all">Tất cả</option>
                <option value="upcoming">Sắp tới</option>
                <option value="completed">Đã xong</option>
                <option value="draft">Bản nháp</option>
              </select>
            </div>
            <SortSelect<TripSortKey> value={sortBy} options={TRIP_SORT_OPTIONS} onChange={setSortBy} className="w-full sm:col-span-2 lg:w-auto lg:min-w-[190px]" />
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className={cn(
            viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "flex flex-col",
            viewMode === 'list' ? 'gap-3 density-stack' : uiDensity === 'compact' ? 'gap-4 density-stack md:gap-5' : 'gap-5 md:gap-8',
          )}
        >
          {filteredTrips.map((trip) => {
            const isUpcoming = today < trip.startDate;
            const isOngoing = today >= trip.startDate && today <= trip.endDate;
            const daysLeft = isUpcoming ? Math.max(1, Math.ceil((new Date(trip.startDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))) : 0;
            const currentDay = isOngoing ? Math.max(1, Math.ceil((new Date(today).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1) : 0;
            const statusLabel = trip.status === 'draft' ? 'Bản nháp' : (isUpcoming ? `Còn ${daysLeft} ngày` : isOngoing ? `Đang diễn ra (Ngày ${currentDay})` : 'Đã xong');
            const statusBadgeClass = trip.status === 'draft' ? "bg-surface-container-high text-outline" : (isUpcoming ? "bg-primary-container text-on-primary-container" : isOngoing ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-surface-container-high text-outline");

            if (trip.status === 'draft') {
              return (
                <motion.div variants={itemVariants} key={trip.id} className="group relative flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-outline-variant bg-surface-container-low p-6 text-center opacity-70 ring-1 ring-transparent transition-opacity hover:opacity-100 hover:ring-outline/20">
                  <button
                    type="button"
                    aria-label={`Tiếp tục chỉnh sửa bản nháp ${trip.title}`}
                    onClick={() => { setEditingTripId(trip.id); setIsAddOpen(true); }}
                    className="absolute inset-0 rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <div className="pointer-events-none flex flex-col items-center justify-center">
                  {trip.permissions?.canDeleteTrip && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirm({ title: 'Xóa bản nháp', message: 'Bạn có chắc chắn muốn xóa bản nháp này?', tone: 'danger', confirmLabel: 'Xóa', cancelLabel: 'Hủy' });
                        if (ok) {
                          try { await deleteTrip(trip.id); showToast({ tone: 'success', title: 'Đã xóa bản nháp' }); }
                          catch (error: any) { showToast({ tone: 'error', title: 'Lỗi', message: error.message }); }
                        }
                      }}
                      className="pointer-events-auto absolute right-3 top-3 z-10 rounded-full bg-surface p-2 text-secondary opacity-0 shadow-sm transition-colors hover:bg-error/10 hover:text-error focus:opacity-100 group-hover:opacity-100 dark:text-gray-300"
                      title="Xóa bản nháp"
                    >
                      <Icons.Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <Icons.FileEdit className="w-10 h-10 text-outline mb-4" />
                  <h3 className="text-lg font-bold font-headline mb-2">Bản nháp: {trip.title}</h3>
                  <p className="font-label text-xs text-outline mb-6">Chưa hoàn thiện thông tin điểm đến và ngân sách</p>
                  <span className="border-b-2 border-primary pb-1 font-label text-[10px] font-extrabold uppercase tracking-widest text-primary dark:text-white">Tiếp tục chỉnh sửa</span>
                  </div>
                </motion.div>
              );
            }

            if (viewMode === 'list') {
              return (
                <motion.div variants={itemVariants} key={trip.id}>
                  <div className={cn("group relative rounded-2xl bg-surface-container-lowest shadow-[0_8px_20px_rgba(0,0,0,0.05)] ring-1 ring-outline/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-14px_rgba(0,0,0,0.16)] active:scale-[0.98]", uiDensity === 'compact' ? 'p-2.5' : 'p-3')}>
                    <Link to={`/trips/${trip.id}`} aria-label={`Mở chuyến đi ${trip.title}`} className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                    <div className="pointer-events-none relative flex items-center gap-4">
                    <div className="h-14 w-14 shrink-0 rounded-lg bg-secondary-container flex items-center justify-center text-primary dark:text-white overflow-hidden">
                      <img alt={trip.title} className="h-full w-full object-cover" src={trip.image} loading="lazy" decoding="async" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-bold font-headline text-on-surface group-hover:text-primary dark:text-white transition-colors truncate">{trip.title}</h3>
                        <span className={cn(
                          "font-label text-[10px] shrink-0 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest",
                          statusBadgeClass
                        )}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-secondary dark:text-gray-300 text-xs">
                        <Icons.MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium truncate max-w-[150px]">{trip.location}</span>
                        <span className="mx-2 opacity-50">•</span>
                        <span className="shrink-0">{formatLocalDate(trip.startDate, { day: '2-digit', month: '2-digit' })} - {formatLocalDate(trip.endDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        <span className="mx-2 opacity-50">•</span>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Icons.Package className="h-3 w-3" /> {packedCountByTrip[trip.id] ?? 0}/{packingCountByTrip[trip.id] ?? 0}
                        </span>
                        <span className="mx-1 opacity-50">/</span>
                        <span className="inline-flex items-center gap-1">
                          <Icons.Image className="h-3 w-3" /> {photoCountByTrip[trip.id] ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col shrink-0 gap-1 items-end justify-center hidden md:flex">
                      <div className="flex items-center gap-3">
                        <MiniCircularProgress
                          size={28}
                          strokeWidth={3}
                          value={trip.budget > 0 ? ((spentByTrip[trip.id] ?? 0) / trip.budget) * 100 : 0}
                          colorClass={(spentByTrip[trip.id] ?? 0) >= trip.budget ? "text-error" : trip.budget > 0 && ((spentByTrip[trip.id] ?? 0) / trip.budget) >= 0.9 ? "text-yellow-500" : "text-tertiary"}
                        />
                        <span className="font-headline font-bold text-sm text-primary dark:text-white">{formatMoney(trip.budget, CURRENCIES[trip.baseCurrency || 'VND'].symbol)}</span>
                      </div>
                      <div className="flex -space-x-2">
                        {trip.members.slice(0, 3).map(member => (
                          <div key={member.id} className="w-7 h-7 rounded-full border-2 border-surface-container-lowest bg-surface-container overflow-hidden">
                            <img src={member.avatar} alt={member.displayName} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {trip.members.length > 3 && (
                          <div className="w-7 h-7 rounded-full border-2 border-surface-container-lowest bg-primary-container text-white flex items-center justify-center text-[10px] font-bold">
                            +{trip.members.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="pointer-events-auto relative z-10 ml-2 flex shrink-0 flex-col items-center justify-center border-l border-outline-variant/30 pl-2 md:ml-4 md:pl-4">
                      <div className="flex items-center gap-1 md:gap-2">
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await toggleTripPin(trip.id);
                          }}
                          className={cn("hover:opacity-80 transition-opacity p-2 rounded-full", trip.isPinned ? "text-primary bg-primary/10" : "text-secondary dark:text-gray-300 bg-surface-container-high")}
                          title={trip.isPinned ? "Bỏ ghim" : "Ghim chuyến đi"}
                        >
                          <Icons.Pin className={cn("w-4 h-4", trip.isPinned && "fill-current")} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDuplicateTripId(trip.id);
                          }}
                          className="text-secondary dark:text-gray-300 hover:text-primary transition-colors bg-surface-container-high hover:bg-primary/10 p-2 rounded-full"
                          title="Nhân bản chuyến đi"
                        >
                          <Icons.Copy className="w-4 h-4" />
                        </button>
                        {trip.permissions?.canDeleteTrip && (
                          <button
                            aria-label={`Xóa chuyến đi ${trip.title}`}
                            title="Xóa chuyến đi"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const ok = await confirm({ title: 'Xóa chuyến đi', message: 'Bạn có chắc chắn muốn xóa chuyến đi này và mọi dữ liệu liên quan? Hành động này không thể hoàn tác.', tone: 'danger', confirmLabel: 'Xóa', cancelLabel: 'Hủy' });
                              if (ok) {
                                try { await deleteTrip(trip.id); showToast({ tone: 'success', title: 'Đã xóa' }); }
                                catch (error: any) { showToast({ tone: 'error', title: 'Lỗi', message: error.message }); }
                              }
                            }}
                            className="text-secondary dark:text-gray-300 hover:text-error transition-colors bg-surface-container-high hover:bg-error/10 p-2 rounded-full"
                          >
                            <Icons.Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div variants={itemVariants} key={trip.id}>
                  <div className={cn("group relative rounded-[1.25rem] bg-surface-container-lowest shadow-[0_12px_24px_rgba(0,0,0,0.06)] ring-1 ring-outline/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)] active:scale-[0.98] md:rounded-[1.5rem]", uiDensity === 'compact' ? 'p-4' : 'p-4 md:p-6')}>
                  <Link to={`/trips/${trip.id}`} aria-label={`Mở chuyến đi ${trip.title}`} className="absolute inset-0 rounded-[1.25rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:rounded-[1.5rem]" />
                  <div className="pointer-events-none relative">
                  <div className="mb-5 flex items-start justify-between gap-3 md:mb-6">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary-container text-primary dark:text-white md:h-16 md:w-16">
                      <img alt={trip.title} className="h-full w-full object-cover" src={trip.image} loading="lazy" decoding="async" />
                    </div>
                    <div className="pointer-events-auto relative z-10 flex min-w-0 flex-wrap items-center justify-end gap-1">
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          await toggleTripPin(trip.id);
                        }}
                        className={cn("hover:opacity-80 transition-opacity p-1.5 rounded-full", trip.isPinned ? "text-primary bg-primary/10" : "text-secondary dark:text-gray-300 bg-surface-container-high")}
                        title={trip.isPinned ? "Bỏ ghim" : "Ghim chuyến đi"}
                      >
                        <Icons.Pin className={cn("w-4 h-4", trip.isPinned && "fill-current")} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDuplicateTripId(trip.id);
                        }}
                        className="text-secondary dark:text-gray-300 hover:text-primary transition-colors bg-surface-container-high hover:bg-primary/10 p-1.5 rounded-full"
                        title="Nhân bản chuyến đi"
                      >
                        <Icons.Copy className="w-4 h-4" />
                      </button>
                      {trip.permissions?.canDeleteTrip && (
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const ok = await confirm({ title: 'Xóa chuyến đi', message: 'Bạn có chắc chắn muốn xóa chuyến đi này và mọi dữ liệu liên quan? Hành động này không thể hoàn tác.', tone: 'danger', confirmLabel: 'Xóa', cancelLabel: 'Hủy' });
                            if (ok) {
                              try { await deleteTrip(trip.id); showToast({ tone: 'success', title: 'Đã xóa' }); }
                              catch (error: any) { showToast({ tone: 'error', title: 'Lỗi', message: error.message }); }
                            }
                          }}
                          className="text-secondary dark:text-gray-300 hover:text-error transition-colors bg-surface-container-high hover:bg-error/10 p-1.5 rounded-full mr-1"
                          title="Xóa chuyến đi"
                        >
                          <Icons.Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <span className={cn(
                        "max-w-full rounded-full px-2.5 py-1 font-label text-[9px] font-extrabold uppercase tracking-wide md:px-3 md:text-[10px] md:tracking-widest",
                        statusBadgeClass
                      )}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <h3 className="mb-1 font-headline text-lg font-bold text-on-surface transition-colors group-hover:text-primary dark:text-white md:text-xl">{trip.title}</h3>
                  <div className="mb-5 flex min-w-0 items-center gap-1 text-secondary dark:text-gray-300 md:mb-6">
                    <Icons.MapPin className="w-4 h-4" />
                    <span className="truncate font-label text-sm font-medium">{trip.location}</span>
                  </div>
                  <div className="mb-5 space-y-3">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wide text-secondary dark:text-gray-300 md:tracking-widest">
                        <span className="flex items-center gap-1"><Icons.Package className="w-3 h-3" /> Hành lý</span>
                        <span>{packedCountByTrip[trip.id] ?? 0}/{packingCountByTrip[trip.id] ?? 0}</span>
                      </div>
                      <div className="h-1 w-full bg-surface-variant rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${packingCountByTrip[trip.id] ? ((packedCountByTrip[trip.id] ?? 0) / packingCountByTrip[trip.id]) * 100 : 0}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wide text-secondary dark:text-gray-300 md:tracking-widest">
                        <span className="flex items-center gap-1"><Icons.Wallet className="w-3 h-3" /> Đã chi</span>
                        <span className={cn("break-words text-right", ((spentByTrip[trip.id] ?? 0) >= trip.budget) ? "text-error" : trip.budget > 0 && ((spentByTrip[trip.id] ?? 0) / trip.budget) >= 0.9 ? "text-yellow-600 dark:text-yellow-400" : "text-tertiary")}>
                          {formatMoney(spentByTrip[trip.id] ?? 0)} / {formatMoney(trip.budget)}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-surface-variant rounded-full overflow-hidden">
                        <div className={cn("h-full transition-colors", ((spentByTrip[trip.id] ?? 0) >= trip.budget) ? "bg-error" : trip.budget > 0 && ((spentByTrip[trip.id] ?? 0) / trip.budget) >= 0.9 ? "bg-yellow-500" : "bg-tertiary")} style={{ width: `${trip.budget ? Math.min(((spentByTrip[trip.id] ?? 0) / trip.budget) * 100, 100) : 0}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-surface-container">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="font-label text-[10px] uppercase text-outline font-bold tracking-widest">Thời gian</span>
                        <span className="font-headline font-semibold text-sm">
                          {formatLocalDate(trip.startDate, { day: '2-digit', month: '2-digit' })} - {formatLocalDate(trip.endDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex -space-x-2">
                        {trip.members.slice(0, 2).map(member => (
                          <div key={member.id} className="w-7 h-7 rounded-full border-2 border-surface-container-lowest bg-surface-container overflow-hidden">
                            <img src={member.avatar} alt={member.displayName} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {trip.members.length > 2 && (
                          <div className="w-7 h-7 rounded-full border-2 border-surface-container-lowest bg-primary-container text-white flex items-center justify-center text-[10px] font-bold">
                            +{trip.members.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-label text-xs font-bold uppercase tracking-wide text-outline md:tracking-widest">Ngân sách</span>
                          <span className="break-words font-headline text-base font-bold text-primary dark:text-white md:text-lg">{formatMoney(trip.budget, CURRENCIES[trip.baseCurrency || 'VND'].symbol)}</span>
                          <div className={cn("text-[10px] font-label font-bold", (spentByTrip[trip.id] ?? 0) > trip.budget ? "text-error" : "text-outline")}>
                            Đã chi: {formatMoney(spentByTrip[trip.id] ?? 0, CURRENCIES[trip.baseCurrency || 'VND'].symbol)}
                          </div>
                        </div>
                        <div className="flex flex-col justify-center items-center gap-1">
                          <MiniCircularProgress
                            size={44}
                            strokeWidth={5}
                            value={trip.budget > 0 ? ((spentByTrip[trip.id] ?? 0) / trip.budget) * 100 : 0}
                            colorClass={(spentByTrip[trip.id] ?? 0) >= trip.budget ? "text-error" : trip.budget > 0 && ((spentByTrip[trip.id] ?? 0) / trip.budget) >= 0.9 ? "text-yellow-500" : "text-tertiary"}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filteredTrips.length === 0 && (
            <motion.div variants={itemVariants} className="col-span-full py-16 text-center border-2 border-dashed border-outline/30 rounded-[2rem] bg-surface-container-lowest/50">
              <div>
                <Icons.MapPin className="w-16 h-16 mx-auto text-primary/50 mb-6 drop-shadow-md" />
              </div>
              <p className="text-on-surface font-headline font-bold text-xl">
                {statusFilter === 'all'
                  ? 'Chưa có chuyến đi nào. Hãy tạo chuyến đi đầu tiên!'
                  : `Không tìm thấy chuyến đi ở trạng thái "${statusFilter === 'upcoming' ? 'Sắp tới' : statusFilter === 'completed' ? 'Đã xong' : 'Bản nháp'}".`}
              </p>
            </motion.div>
          )}
        </motion.div>
      </section>

      <Modal isOpen={isAddOpen} onClose={() => { if (!isSubmitting) { setIsAddOpen(false); setEditingTripId(null); setTripFormError(null); } }} title={editingTripId ? "Chỉnh sửa chuyến đi" : "Tạo chuyến đi mới"}>
        <form onSubmit={handleAddTrip} className="space-y-4">
          {tripFormError && (
            <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm font-medium">
              {tripFormError}
            </div>
          )}
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Tên chuyến đi</label>
            <input required name="title" type="text" defaultValue={editingTrip?.title} placeholder="VD: Mùa thu Hà Nội" className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Địa điểm</label>
            <input required name="location" type="text" defaultValue={editingTrip?.location} placeholder="VD: Hà Nội, Việt Nam" className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ngày đi</label>
              <input required name="startDate" type="date" defaultValue={editingTrip?.startDate} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ngày về</label>
              <input required name="endDate" type="date" defaultValue={editingTrip?.endDate} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Trạng thái</label>
            <select name="status" defaultValue={editingTrip?.status || 'upcoming'} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
              <option value="upcoming">Sắp tới</option>
              <option value="completed">Đã xong</option>
              <option value="draft">Bản nháp</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Ngân sách dự kiến</label>
              <FormattedNumberInput required name="budget" defaultValue={editingTrip?.budget} placeholder="VD: 5.000.000" className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Tiền tệ chính</label>
              <select name="baseCurrency" defaultValue={editingTrip?.baseCurrency || "VND"} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                {Object.entries(CURRENCIES).map(([code, { name }]) => (
                  <option key={code} value={code}>{code} - {name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-2">
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-2">Màu sắc chủ đề</label>
            <div className="flex flex-wrap gap-3">
              {[
                { name: 'Gốc', hex: '' },
                { name: 'Xanh Lá', hex: '#16a34a' },
                { name: 'Xanh Biển', hex: '#0284c7' },
                { name: 'Cam Đất', hex: '#ea580c' },
                { name: 'Tím', hex: '#9333ea' },
                { name: 'Đỏ Mận', hex: '#be123c' },
                { name: 'Hồng', hex: '#db2777' }
              ].map(color => (
                <label key={color.hex || 'default'} className="flex flex-col items-center gap-1 cursor-pointer group" title={color.name}>
                  <input type="radio" name="themeColor" value={color.hex} defaultChecked={(editingTrip?.themeColor || '') === color.hex} className="sr-only peer" />
                  <div style={color.hex ? { backgroundColor: color.hex } : {}} className={`w-8 h-8 rounded-full border-2 border-transparent peer-checked:border-on-surface ring-2 ring-transparent peer-checked:ring-offset-2 peer-checked:ring-offset-surface peer-checked:ring-on-surface transition-all group-hover:scale-110 ${!color.hex ? 'bg-primary' : ''}`}></div>
                </label>
              ))}
            </div>
          </div>
          <div className="pt-2">
            <CoverPhotoSelector
              tripId={editingTripId}
              defaultValue={editingTrip?.image || ''}
            />
          </div>
          <div className="pt-4">
            <button type="submit" disabled={isSubmitting} className="density-button w-full bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Đang lưu...' : editingTripId ? "Lưu thay đổi" : "Tạo chuyến đi"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!duplicateTripId} onClose={() => { if (!duplicateSubmitting) setDuplicateTripId(null); }} title="Nhân bản chuyến đi">
        {duplicateTripId && (() => {
          const original = trips.find(t => t.id === duplicateTripId);
          return (
            <form onSubmit={handleDuplicateTrip} className="space-y-4">
              <div>
                <label className="block font-label text-xs font-bold text-secondary mb-1">Tên chuyến đi mới</label>
                <input required name="title" type="text" defaultValue={`${original?.title} (Bản sao)`} className="w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary p-3" />
              </div>
              <div>
                <label className="block font-label text-xs font-bold text-secondary mb-1">Ngày khởi hành mới (lịch trình sẽ dời theo ngày này)</label>
                <input required name="startDate" type="date" defaultValue={original?.startDate} className="w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary p-3" />
              </div>
              <div className="pt-4">
                <button type="submit" disabled={duplicateSubmitting} className="w-full bg-primary text-on-primary rounded-xl font-bold p-3 hover:opacity-90 disabled:opacity-60">
                  {duplicateSubmitting ? 'Đang nhân bản...' : 'Nhân bản'}
                </button>
              </div>
            </form>
          )
        })()}
      </Modal>
    </>
  );
}
