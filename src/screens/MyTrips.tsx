import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';

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
import { chainComparators, compareDate, compareNumber, compareText, stableSort, type SortOption } from '../utils/listSort';

type TripSortKey = 'startDateDesc' | 'startDateAsc' | 'createdDesc' | 'createdAsc' | 'budgetDesc' | 'budgetAsc' | 'spentDesc' | 'spentAsc' | 'titleAsc' | 'titleDesc';

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
  const packingCountByTrip = useMemo(() => {
    return packingItems.reduce<Record<string, number>>((counts, item) => {
      counts[item.tripId] = (counts[item.tripId] ?? 0) + 1;
      return counts;
    }, {});
  }, [packingItems]);

  const photoCountByTrip = useMemo(() => {
    return photos.reduce<Record<string, number>>((counts, photo) => {
      counts[photo.tripId] = (counts[photo.tripId] ?? 0) + 1;
      return counts;
    }, {});
  }, [photos]);

  const packedCountByTrip = useMemo(() => {
    return packingItems.reduce<Record<string, number>>((counts, item) => {
      if (item.isPacked) {
        counts[item.tripId] = (counts[item.tripId] ?? 0) + 1;
      }
      return counts;
    }, {});
  }, [packingItems]);

  const spentByTrip = useMemo(() => {
    return expenses.filter(e => !e.isSettlement).reduce<Record<string, number>>((totals, expense) => {
      totals[expense.tripId] = (totals[expense.tripId] ?? 0) + expense.amount;
      return totals;
    }, {});
  }, [expenses]);

  const filteredTrips = useMemo(() => {
    const filteredList = trips.filter((trip) => {
      if (statusFilter !== 'all' && trip.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!trip.title.toLowerCase().includes(query) && !trip.location.toLowerCase().includes(query)) return false;
      }
      if (startDateFilter && trip.startDate < startDateFilter) return false;
      if (endDateFilter && trip.startDate > endDateFilter) return false;
      return true;
    });

    const pinnedFirst = (a: typeof trips[number], b: typeof trips[number]) => Number(b.isPinned) - Number(a.isPinned);
    const fallbackSort = (a: typeof trips[number], b: typeof trips[number]) => compareDate(a.startDate, b.startDate, 'desc');
    const sortComparator = (a: typeof trips[number], b: typeof trips[number]) => {
      switch (sortBy) {
        case 'startDateAsc': return compareDate(a.startDate, b.startDate, 'asc');
        case 'createdDesc': return compareDate(a.createdAt ?? a.startDate, b.createdAt ?? b.startDate, 'desc');
        case 'createdAsc': return compareDate(a.createdAt ?? a.startDate, b.createdAt ?? b.startDate, 'asc');
        case 'budgetDesc': return compareNumber(a.budget, b.budget, 'desc');
        case 'budgetAsc': return compareNumber(a.budget, b.budget, 'asc');
        case 'spentDesc': return compareNumber(spentByTrip[a.id] ?? 0, spentByTrip[b.id] ?? 0, 'desc');
        case 'spentAsc': return compareNumber(spentByTrip[a.id] ?? 0, spentByTrip[b.id] ?? 0, 'asc');
        case 'titleAsc': return compareText(a.title, b.title, 'asc');
        case 'titleDesc': return compareText(a.title, b.title, 'desc');
        case 'startDateDesc':
        default: return compareDate(a.startDate, b.startDate, 'desc');
      }
    };

    return stableSort(filteredList, chainComparators(pinnedFirst, sortComparator, fallbackSort));
  }, [trips, statusFilter, searchQuery, startDateFilter, endDateFilter, sortBy, spentByTrip]);
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.02
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { ease: 'easeOut', duration: 0.2 } }
  };

  return (
    <>
      <section className="mb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="density-hero relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary-container h-[300px] flex items-center p-12 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)] ring-1 ring-white/10"
        >
          <div className="absolute right-0 top-0 w-1/2 h-full opacity-20 pointer-events-none mix-blend-overlay">
            <img alt="Travel abstract" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNwBnWoBo158dem-P8xSIbQ_85ZKdImaXbi_voQtZ9bp37lJlYlqChi6ExeK1ltAGJUUd2xmp266HL6l9zi3-gLznGgpzVZODbSjLzi2BuctK67XYi7GMn7IyNUfZUjJSz8wTMC0r6BNuLzmjajej_QmccAkbZmhqKP1M71Zy1fGDnqrkvSz_VPsP7HbVMNZ0pF4JgSWIx_4yRzPx-szCsEjRXvAEITiwemzOndLNpT1huf4AvIMenEMU2mwSzjpf6PPRfe1iYo9M" />
          </div>
          <div className="relative z-10 max-w-lg">
            <h1 className="text-on-primary text-4xl font-extrabold tracking-tight mb-6 font-headline leading-tight drop-shadow-sm">
              {language === 'vi' ? 'Chuyến hành trình tiếp theo của bạn bắt đầu tại đây.' : 'Your next journey begins here.'}
            </h1>
            <button onClick={() => { setEditingTripId(null); setIsAddOpen(true); }} className="group flex items-center gap-3 bg-white text-primary px-8 py-4 rounded-xl font-bold text-lg shadow-[0_12px_24px_rgba(0,0,0,0.2)] hover:scale-105 transition-transform active:scale-95 ring-1 ring-white/50">
              <Icons.PlusCircle className="w-6 h-6" />
              {language === 'vi' ? 'Tạo chuyến đi mới' : 'Create new trip'}
            </button>
          </div>
        </motion.div>
      </section>

      <section>
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-end justify-between">
            <div>
              <span className="font-label text-xs uppercase tracking-[0.2em] text-secondary dark:text-gray-300 font-extrabold">{language === 'vi' ? 'Bộ sưu tập' : 'Collection'}</span>
              <h2 className="text-3xl font-bold text-primary dark:text-white font-headline mt-1">{language === 'vi' ? 'Chuyến đi của tôi' : 'My Trips'}</h2>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-1">
                <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded-full transition-colors', viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-on-surface hover:bg-surface-container-highest')}>
                  <Icons.Menu className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-full transition-colors', viewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-on-surface hover:bg-surface-container-highest')}>
                  <Icons.LayoutDashboard className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Icons.Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-50" />
              <input
                type="text"
                placeholder="Tìm chuyến đi (tiêu đề, địa điểm)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-high text-on-surface rounded-xl pl-10 pr-4 py-2.5 font-medium outline-none focus:ring-2 focus:ring-primary/50 transition-all font-label"
              />
            </div>
            <div className="flex items-center gap-2 bg-surface-container-high rounded-xl px-4 py-2 hover:bg-surface-container-highest transition-colors">
              <Icons.Calendar className="w-4 h-4 text-secondary opacity-50" />
              <input
                type="date"
                value={startDateFilter}
                onChange={e => setStartDateFilter(e.target.value)}
                className="bg-transparent text-sm font-semibold outline-none cursor-pointer text-on-surface max-w-[120px]"
                title="Từ ngày"
              />
              <span className="text-secondary opacity-50 font-bold">-</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={e => setEndDateFilter(e.target.value)}
                className="bg-transparent text-sm font-semibold outline-none cursor-pointer text-on-surface max-w-[120px]"
                title="Đến ngày"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2">
              <Icons.Filter className="w-5 h-5 text-on-surface" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'upcoming' | 'completed' | 'draft')}
                className="bg-transparent text-sm font-semibold text-on-surface outline-none cursor-pointer truncate max-w-[100px] md:max-w-none"
              >
                <option value="all">Tất cả</option>
                <option value="upcoming">Sắp tới</option>
                <option value="completed">Đã xong</option>
                <option value="draft">Bản nháp</option>
              </select>
            </div>
            <SortSelect value={sortBy} options={TRIP_SORT_OPTIONS} onChange={setSortBy} className="min-w-[190px]" />
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className={cn(
            viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "flex flex-col",
            viewMode === 'list' ? 'gap-3 density-stack' : uiDensity === 'compact' ? 'gap-5 density-stack' : 'gap-8',
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
                <motion.div variants={itemVariants} key={trip.id} onClick={() => { setEditingTripId(trip.id); setIsAddOpen(true); }} className="relative bg-surface-container-low rounded-[1.5rem] p-6 border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-center opacity-70 group hover:opacity-100 transition-opacity cursor-pointer ring-1 ring-transparent hover:ring-outline/20">
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
                      className="absolute top-3 right-3 text-secondary dark:text-gray-300 hover:text-error transition-colors bg-surface hover:bg-error/10 p-2 rounded-full opacity-0 group-hover:opacity-100 shadow-sm"
                      title="Xóa bản nháp"
                    >
                      <Icons.Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <Icons.FileEdit className="w-10 h-10 text-outline mb-4" />
                  <h3 className="text-lg font-bold font-headline mb-2">Bản nháp: {trip.title}</h3>
                  <p className="font-label text-xs text-outline mb-6">Chưa hoàn thiện thông tin điểm đến và ngân sách</p>
                  <button className="font-label text-[10px] font-extrabold uppercase tracking-widest text-primary dark:text-white border-b-2 border-primary pb-1">Tiếp tục chỉnh sửa</button>
                </motion.div>
              );
            }

            if (viewMode === 'list') {
              return (
                <motion.div variants={itemVariants} key={trip.id}>
                  <Link to={`/trips/${trip.id}/schedule`} className={cn("bg-surface-container-lowest rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.05)] ring-1 ring-outline/10 hover:shadow-[0_16px_36px_-14px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 transition-all duration-300 group flex items-center gap-4 density-card active:scale-[0.98]", uiDensity === 'compact' ? 'p-2.5' : 'p-3')}>
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
                    <div className="flex flex-col items-center justify-center shrink-0 ml-2 md:ml-4 border-l border-outline-variant/30 pl-2 md:pl-4">
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
                  </Link>
                </motion.div>
              );
            }

            return (
              <motion.div variants={itemVariants} key={trip.id}>
                <Link to={`/trips/${trip.id}/schedule`} className={cn("bg-surface-container-lowest rounded-[1.5rem] shadow-[0_12px_24px_rgba(0,0,0,0.06)] ring-1 ring-outline/10 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12)] hover:-translate-y-2 transition-all duration-300 group block density-card active:scale-[0.98]", uiDensity === 'compact' ? 'p-4' : 'p-6')}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="h-16 w-16 rounded-lg bg-secondary-container flex items-center justify-center text-primary dark:text-white overflow-hidden">
                      <img alt={trip.title} className="h-full w-full object-cover" src={trip.image} loading="lazy" decoding="async" />
                    </div>
                    <div className="flex items-center gap-1">
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
                        "font-label text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest",
                        statusBadgeClass
                      )}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold font-headline mb-1 text-on-surface group-hover:text-primary dark:text-white transition-colors">{trip.title}</h3>
                  <div className="flex items-center gap-1 text-secondary dark:text-gray-300 mb-6">
                    <Icons.MapPin className="w-4 h-4" />
                    <span className="font-label text-sm font-medium">{trip.location}</span>
                  </div>
                  <div className="mb-5 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-secondary dark:text-gray-300 uppercase tracking-widest mb-1.5">
                        <span className="flex items-center gap-1"><Icons.Package className="w-3 h-3" /> Hành lý</span>
                        <span>{packedCountByTrip[trip.id] ?? 0}/{packingCountByTrip[trip.id] ?? 0}</span>
                      </div>
                      <div className="h-1 w-full bg-surface-variant rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${packingCountByTrip[trip.id] ? ((packedCountByTrip[trip.id] ?? 0) / packingCountByTrip[trip.id]) * 100 : 0}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-secondary dark:text-gray-300 uppercase tracking-widest mb-1.5">
                        <span className="flex items-center gap-1"><Icons.Wallet className="w-3 h-3" /> Đã chi</span>
                        <span className={((spentByTrip[trip.id] ?? 0) >= trip.budget) ? "text-error" : trip.budget > 0 && ((spentByTrip[trip.id] ?? 0) / trip.budget) >= 0.9 ? "text-yellow-600 dark:text-yellow-400" : "text-tertiary"}>
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
                      <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-2xl">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-label text-xs uppercase text-outline font-bold tracking-widest">Ngân sách</span>
                          <span className="font-headline text-lg font-bold text-primary dark:text-white">{formatMoney(trip.budget, CURRENCIES[trip.baseCurrency || 'VND'].symbol)}</span>
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
                </Link>
              </motion.div>
            );
          })}
          {filteredTrips.length === 0 && (
            <motion.div variants={itemVariants} className="col-span-full py-16 text-center border-2 border-dashed border-outline/30 rounded-[2rem] bg-surface-container-lowest/50">
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}>
                <Icons.MapPin className="w-16 h-16 mx-auto text-primary/50 mb-6 drop-shadow-md" />
              </motion.div>
              <p className="text-on-surface font-headline font-bold text-xl">
                {statusFilter === 'all'
                  ? 'Chưa có chuyến đi nào. Hãy tạo chuyến đi đầu tiên!'
                  : `Không tìm thấy chuyến đi ở trạng thái "${statusFilter === 'upcoming' ? 'Sắp tới' : statusFilter === 'completed' ? 'Đã xong' : 'Bản nháp'}".`}
              </p>
            </motion.div>
          )}
        </motion.div>
      </section>

      <button onClick={() => { setEditingTripId(null); setIsAddOpen(true); }} className="md:hidden fixed right-6 bottom-[calc(env(safe-area-inset-bottom)+7rem)] w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform">
        <Icons.Plus className="w-6 h-6" />
      </button>

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
