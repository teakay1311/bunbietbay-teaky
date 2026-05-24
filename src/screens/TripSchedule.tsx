import { useParams } from 'react-router-dom';
import type { FormEvent } from 'react';

import { Icons } from '../components/Icons';
import { useAppContext } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Modal } from '../components/Modal';
import { CategorySelectWithCreate } from '../components/CategorySelectWithCreate';
import { Activity } from '../context/AppContext';
import { formatLocalDate, getLocalDateRange, normalizeTimeForInput } from '../utils/date';
import { getErrorMessage } from '../utils/errorMessage';
import { motion } from 'framer-motion';
import { LinkifyText } from '../components/LinkifyText';
import { SortSelect } from '../components/SortSelect';
import { chainComparators, compareDate, compareNumber, compareText, stableSort, type SortOption } from '../utils/listSort';
import { ACTIVITY_TYPE_OPTIONS, mergeCategoryOptions } from '../utils/tripCategories';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableActivityItem } from '../components/SortableActivityItem';

type ActivitySortKey = 'timeAsc' | 'timeDesc' | 'createdDesc' | 'createdAsc' | 'incompleteFirst' | 'typeAsc' | 'titleAsc';
type ScheduleViewMode = 'timeline' | 'compact';

const ACTIVITY_SORT_OPTIONS: Array<SortOption<ActivitySortKey>> = [
  { value: 'timeAsc', label: 'Giờ sớm nhất' },
  { value: 'timeDesc', label: 'Giờ muộn nhất' },
  { value: 'createdDesc', label: 'Mới tạo nhất' },
  { value: 'createdAsc', label: 'Cũ nhất' },
  { value: 'incompleteFirst', label: 'Chưa xong trước' },
  { value: 'typeAsc', label: 'Loại hoạt động' },
  { value: 'titleAsc', label: 'Tên A-Z' },
];

export function TripSchedule() {
  const { id } = useParams();
  const { trips, activities, savedPlaces, setCurrentTripId, deleteActivity, addActivity, editActivity, undoLastAction, batchRemote } = useAppContext();
  const { showToast, confirm } = useFeedback();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [reschedulingActivity, setReschedulingActivity] = useState<Activity | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [routePreview, setRoutePreview] = useState<{ url: string; locations: string[] } | null>(null);

  const handleAddActivity = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    const formData = new FormData(e.currentTarget);

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      if (editingActivity) {
        await editActivity(editingActivity.id, {
          date: formData.get('date') as string,
          time: formData.get('time') as string,
          title: formData.get('title') as string,
          location: formData.get('location') as string,
          type: formData.get('type') as any,
          note: formData.get('note') as string,
          mapUrl: formData.get('mapUrl') as string,
          bookingCode: (formData.get('bookingCode') as string) || undefined,
        });
        setEditingActivity(null);
      } else {
        await addActivity({
          tripId: id!,
          date: formData.get('date') as string,
          time: formData.get('time') as string,
          title: formData.get('title') as string,
          location: formData.get('location') as string,
          type: formData.get('type') as any,
          note: formData.get('note') as string,
          mapUrl: formData.get('mapUrl') as string,
          bookingCode: (formData.get('bookingCode') as string) || undefined,
        });
      }
      setIsAddOpen(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Không thể lưu hoạt động.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchAddActivity = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(e.currentTarget);
    const rawTitles = (formData.get('titles') as string) ?? '';
    const titles = rawTitles.split('\n').map(t => t.trim()).filter(Boolean);

    if (titles.length === 0) {
      setSubmitError('Nhập ít nhất 1 hoạt động.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const date = formData.get('date') as string;
      const type = formData.get('type') as any;
      const baseTime = formData.get('time') as string || '08:00';
      const [baseHH, baseMM] = baseTime.split(':').map(Number);
      const location = formData.get('location') as string || '';

      await batchRemote(async () => {
        for (let i = 0; i < titles.length; i++) {
          // Auto increment time by 1 hour for each subsequent item
          const hh = (baseHH + i) % 24;
          const timeStr = `${hh.toString().padStart(2, '0')}:${baseMM.toString().padStart(2, '0')}`;

          await addActivity({
            tripId: id!,
            date: date,
            time: timeStr,
            title: titles[i],
            location: location,
            type: type,
            note: '',
          });
        }
      });
      setIsAddOpen(false);
      setIsBatchMode(false);
      showToast({
        tone: 'success',
        title: `Đã thêm ${titles.length} hoạt động`,
        message: 'Hoạt động đã được thêm vào lịch trình thành công.',
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Không thể thêm chuỗi hoạt động.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  const trip = trips.find(t => t.id === id);

  const tripActivities = useMemo(() => activities.filter(a => a.tripId === id), [activities, id]);
  const activityTypeOptions = useMemo(() => mergeCategoryOptions(ACTIVITY_TYPE_OPTIONS, tripActivities.map((activity) => activity.type)), [tripActivities]);
  const uniqueDates = useMemo(() => {
    const tripDates = trip ? getLocalDateRange(trip.startDate, trip.endDate) : [];
    const activityDates = [...new Set<string>(tripActivities.map(a => a.date))].sort();
    return [...new Set([...tripDates, ...activityDates])];
  }, [trip, tripActivities]);

  const hotelPlaces = useMemo(() => {
    return savedPlaces.filter(p => p.tripId === id && p.type === 'hotel');
  }, [savedPlaces, id]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ActivitySortKey>('timeAsc');
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('timeline');

  useEffect(() => {
    if (uniqueDates.length > 0 && (!selectedDate || !uniqueDates.includes(selectedDate))) {
      setSelectedDate(uniqueDates[0]);
      return;
    }

    if (uniqueDates.length === 0 && selectedDate !== null) {
      setSelectedDate(null);
    }
  }, [uniqueDates, selectedDate]);

  const compareActivitiesForView = useCallback((a: Activity, b: Activity) => {
    const fallbackSort = (a: Activity, b: Activity) => compareText(normalizeTimeForInput(a.time), normalizeTimeForInput(b.time), 'asc');
    switch (sortBy) {
      case 'timeDesc': return compareText(normalizeTimeForInput(a.time), normalizeTimeForInput(b.time), 'desc');
      case 'createdDesc': return compareDate(a.createdAt ?? `${a.date}T${normalizeTimeForInput(a.time)}`, b.createdAt ?? `${b.date}T${normalizeTimeForInput(b.time)}`, 'desc');
      case 'createdAsc': return compareDate(a.createdAt ?? `${a.date}T${normalizeTimeForInput(a.time)}`, b.createdAt ?? `${b.date}T${normalizeTimeForInput(b.time)}`, 'asc');
      case 'incompleteFirst': return compareNumber(a.isCompleted ? 1 : 0, b.isCompleted ? 1 : 0, 'asc');
      case 'typeAsc': return compareText(a.type, b.type, 'asc');
      case 'titleAsc': return compareText(a.title, b.title, 'asc');
      case 'timeAsc':
      default: return fallbackSort(a, b);
    }
  }, [sortBy]);

  const sortActivitiesForView = useCallback((list: Activity[]) => {
    const fallbackSort = (a: Activity, b: Activity) => compareText(normalizeTimeForInput(a.time), normalizeTimeForInput(b.time), 'asc');
    return stableSort(list, chainComparators(compareActivitiesForView, fallbackSort));
  }, [compareActivitiesForView]);

  const filterActivitiesBySearch = useCallback((list: Activity[]) => {
    if (!searchQuery) {
      return list;
    }
      const q = searchQuery.toLowerCase();
      return list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.location?.toLowerCase().includes(q)) ||
        (a.note?.toLowerCase().includes(q))
      );
  }, [searchQuery]);

  const filteredActivities = useMemo(() => {
    return sortActivitiesForView(filterActivitiesBySearch(tripActivities.filter(a => a.date === selectedDate)));
  }, [selectedDate, tripActivities, sortActivitiesForView, filterActivitiesBySearch]);

  const compactActivities = useMemo(() => {
    return stableSort(filterActivitiesBySearch(tripActivities), chainComparators(
      (a: Activity, b: Activity) => compareDate(a.date, b.date, 'asc'),
      compareActivitiesForView,
      (a: Activity, b: Activity) => compareText(normalizeTimeForInput(a.time), normalizeTimeForInput(b.time), 'asc'),
    ));
  }, [tripActivities, filterActivitiesBySearch, compareActivitiesForView]);

  const compactActivitiesByDate = useMemo(() => {
    return compactActivities.reduce<Record<string, Activity[]>>((groups, activity) => {
      groups[activity.date] = groups[activity.date] ?? [];
      groups[activity.date].push(activity);
      return groups;
    }, {});
  }, [compactActivities]);

  const visibleActivities = viewMode === 'compact' ? compactActivities : filteredActivities;
  const scheduleInsights = useMemo(() => {
    if (!selectedDate || filteredActivities.length < 2) {
      return [];
    }
    const toMinutes = (time: string) => {
      const [hours, minutes] = normalizeTimeForInput(time).split(':').map(Number);
      return hours * 60 + minutes;
    };
    const orderedActivities = stableSort<Activity>(filteredActivities, (a, b) => compareNumber(toMinutes(a.time), toMinutes(b.time), 'asc'));
    const insights: Array<{ type: 'warning' | 'info'; title: string; message: string }> = [];

    for (let index = 0; index < orderedActivities.length - 1; index += 1) {
      const current = orderedActivities[index];
      const next = orderedActivities[index + 1];
      const gap = toMinutes(next.time) - toMinutes(current.time);
      if (gap < 30) {
        insights.push({
          type: 'warning',
          title: 'Lịch có thể bị sát giờ',
          message: `${current.time} ${current.title} và ${next.time} ${next.title} chỉ cách nhau ${Math.max(gap, 0)} phút.`,
        });
      } else if (gap >= 180) {
        insights.push({
          type: 'info',
          title: 'Khoảng trống dài',
          message: `Có khoảng ${Math.round(gap / 60)} giờ giữa ${current.title} và ${next.title}.`,
        });
      }
      if (insights.length >= 3) break;
    }

    return insights;
  }, [filteredActivities, selectedDate]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!trip) return <div>Trip not found</div>;
  const canEdit = trip.permissions.canEditContent;

  const formatDateLabel = (dateString: string) => {
    return formatLocalDate(dateString, { day: '2-digit', month: '2-digit' });
  };

  const formatFullDate = (dateString: string) => {
    return `Ngày ${uniqueDates.indexOf(dateString) + 1}: ${formatLocalDate(dateString, { day: '2-digit', month: 'long' })}`;
  };

  const handleOpenMap = () => {
    if (!visibleActivities || visibleActivities.length === 0) return;

    const locations = visibleActivities
      .filter((a) => a.location && a.type !== 'flight')
      .map((a) => a.location);

    if (locations.length === 0) {
      showToast({ tone: 'error', title: 'Thất bại', message: 'Không có địa điểm trong ngày này để tạo bản đồ.' });
      return;
    }

    if (locations.length === 1) {
      setRoutePreview({ url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations[0])}`, locations });
      return;
    }

    const origin = encodeURIComponent(locations[0]);
    const destination = encodeURIComponent(locations[locations.length - 1]);
    const waypoints = locations.slice(1, -1).map((location) => encodeURIComponent(location)).join('|');

    let mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) mapUrl += `&waypoints=${waypoints}`;

    setRoutePreview({ url: mapUrl, locations });
  };

  function calculateMidTime(time1: string, time2: string) {
    const parse = (t: string) => {
      const [h, m] = normalizeTimeForInput(t).split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
      return h * 60 + m;
    };
    const format = (mins: number) => {
      mins = Math.max(0, mins);
      const h = Math.floor(mins / 60);
      const m = Math.floor(mins % 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    return format(Math.floor((parse(time1) + parse(time2)) / 2));
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !canEdit || sortBy !== 'timeAsc' || viewMode !== 'timeline') return;

    const oldIndex = filteredActivities.findIndex(a => a.id === active.id);
    const newIndex = filteredActivities.findIndex(a => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredActivities, oldIndex, newIndex) as typeof filteredActivities;
    let newTime = "";

    if (newIndex === 0) {
      newTime = calculateMidTime(reordered[1].time, "00:00");
    } else if (newIndex === reordered.length - 1) {
      newTime = calculateMidTime(reordered[reordered.length - 2].time, "23:59");
    } else {
      newTime = calculateMidTime(reordered[newIndex - 1].time, reordered[newIndex + 1].time);
    }

    if (newTime) {
      await editActivity(active.id as string, { time: newTime });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.02 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.2 } }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-10">
      <motion.section variants={itemVariants} className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="font-label text-sm uppercase tracking-widest text-secondary dark:text-gray-300 font-bold mb-2 block">Hành trình sắp tới</span>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">{trip.title}</h1>
            <p className="text-on-surface-variant mt-2 flex items-center gap-2">
              <Icons.CalendarDays className="w-4 h-4" />
              {formatLocalDate(trip.startDate, { day: '2-digit', month: 'short' })} - {formatLocalDate(trip.endDate, { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {canEdit && (
            <button onClick={() => { setEditingActivity(null); setIsAddOpen(true); }} className="editorial-gradient text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 shadow-lg hover:opacity-90 transition-all active:scale-95">
              <Icons.Plus className="w-5 h-5" />
              Thêm hoạt động
            </button>
          )}
        </div>
      </motion.section>

      {hotelPlaces.length > 0 && (
        <motion.div variants={itemVariants} className="mb-10 bg-surface-container-low border border-primary/20 rounded-2xl p-5 editorial-shadow relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/80 transition-all group-hover:w-2"></div>
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 text-primary p-3 rounded-xl mt-1 shrink-0 group-hover:scale-110 transition-transform">
              <Icons.Hotel className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-label text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-1 flex items-center gap-2">
                <Icons.Pin className="w-3 h-3" /> Chỗ ở đã ghim
              </h3>
              <div className="space-y-4 mt-3">
                {hotelPlaces.map(hotel => (
                  <div key={hotel.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/30 pb-4 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-headline font-bold text-on-surface text-lg truncate">{hotel.name}</p>
                      {hotel.address && (
                        <p className="text-sm text-secondary dark:text-gray-300 flex items-start gap-1.5 mt-1 no-wrap">
                          <Icons.MapPin className="w-4 h-4 shrink-0 translate-y-[2px]" />
                          <span className="truncate" title={hotel.address}>{hotel.address}</span>
                        </p>
                      )}
                      {hotel.note && (
                        <p className="text-xs text-secondary/80 mt-1.5 italic leading-relaxed max-w-[500px]">"<LinkifyText text={hotel.note} />"</p>
                      )}
                    </div>
                    {hotel.phone && (
                      <a href={`tel:${hotel.phone}`} className="flex items-center gap-2 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 px-3.5 py-2 rounded-xl transition-colors w-fit shrink-0">
                        <Icons.Phone className="w-4 h-4" /> {hotel.phone}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {uniqueDates.length > 0 ? (
        <>
          <motion.div variants={itemVariants} className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {viewMode === 'timeline' ? (
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 md:pb-0">
                {uniqueDates.map((date, index) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 px-6 py-2 rounded-full font-bold transition-colors ${selectedDate === date
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                      }`}
                  >
                    Ngày {index + 1} ({formatDateLabel(date)})
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">
                Hiển thị {compactActivities.length}/{tripActivities.length} hoạt động trong toàn bộ chuyến đi.
              </div>
            )}
            <div className="flex w-full shrink-0 rounded-2xl bg-surface-container-low p-1 text-sm font-bold md:w-auto">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`flex-1 rounded-xl px-4 py-2 transition-colors md:flex-none ${viewMode === 'timeline' ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container'}`}
              >
                Chi tiết
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={`flex-1 rounded-xl px-4 py-2 transition-colors md:flex-none ${viewMode === 'compact' ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:bg-surface-container'}`}
              >
                Rút gọn
              </button>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-12 relative">
            <div className="sticky top-24 z-10 py-2 bg-surface/80 backdrop-blur-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="font-headline text-2xl font-bold text-secondary dark:text-gray-300 flex items-center gap-3">
                <span className="w-8 h-[2px] bg-outline-variant"></span>
                {viewMode === 'compact' ? 'Toàn bộ lịch trình' : selectedDate && formatFullDate(selectedDate)}
              </h2>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Icons.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-50" />
                  <input
                    type="text"
                    placeholder="Tìm hoạt động..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-container-high text-sm text-on-surface rounded-full pl-9 pr-4 py-1.5 font-medium outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                  />
                </div>
                <SortSelect value={sortBy} options={ACTIVITY_SORT_OPTIONS} onChange={setSortBy} className="flex-1 md:flex-none py-1.5" />
                <button type="button" onClick={handleOpenMap} className="text-primary shrink-0 text-sm font-bold flex items-center gap-2 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors group">
                  <Icons.Map className="w-4 h-4 group-hover:scale-110 transition-transform" /> Bản đồ
                </button>
              </div>
            </div>

            {viewMode === 'timeline' && (
              <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-secondary dark:text-gray-300">
                    <Icons.Clock3 className="h-4 w-4 text-primary dark:text-white" />
                    {filteredActivities.length} hoạt động trong ngày đang xem
                  </div>
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="w-fit rounded-lg px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10 dark:text-white"
                    >
                      Xóa tìm kiếm
                    </button>
                  )}
                </div>
                {scheduleInsights.length > 0 && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {scheduleInsights.map((insight) => (
                      <div key={`${insight.title}-${insight.message}`} className={`rounded-xl px-3 py-2 text-sm ${insight.type === 'warning' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'}`}>
                        <p className="font-bold">{insight.title}</p>
                        <p className="mt-1 leading-5">{insight.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {viewMode === 'timeline' && <div className="absolute left-[15px] md:left-[39px] top-20 bottom-0 w-[2px] bg-surface-container-highest -z-10"></div>}

            <div className={viewMode === 'compact' ? 'space-y-4' : 'space-y-8 pl-8 md:ml-4 md:pl-12'}>
              {viewMode === 'compact' ? (
                compactActivities.length > 0 ? (
                  <div className="space-y-5">
                    {uniqueDates.filter(date => compactActivitiesByDate[date]?.length).map((date) => (
                      <section key={date} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                        <div className="mb-2 flex items-center justify-between gap-3 border-b border-outline-variant/25 pb-2">
                          <h3 className="font-headline text-base font-bold text-on-surface">{formatFullDate(date)}</h3>
                          <span className="rounded-full bg-surface-container-high px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-secondary">
                            {compactActivitiesByDate[date].length} hoạt động
                          </span>
                        </div>
                        <div className="divide-y divide-outline-variant/20">
                          {compactActivitiesByDate[date].map((activity) => (
                            <div key={activity.id} className={`flex flex-col gap-2 py-2.5 md:flex-row md:items-center md:gap-4 ${activity.isCompleted ? 'opacity-60' : ''}`}>
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className="shrink-0 rounded-full bg-primary-container/20 px-3 py-1 font-label text-xs font-bold uppercase tracking-widest text-primary dark:text-white">
                                  {activity.time}
                                </span>
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-secondary">
                                  {activity.type === 'flight' && <Icons.PlaneLanding className="h-4 w-4" />}
                                  {activity.type === 'hotel' && <Icons.Hotel className="h-4 w-4" />}
                                  {activity.type === 'restaurant' && <Icons.Utensils className="h-4 w-4" />}
                                  {(activity.type === 'activity' || !ACTIVITY_TYPE_OPTIONS.some((option) => option.value === activity.type)) && <Icons.MapPin className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`truncate font-headline text-base font-bold ${activity.isCompleted ? 'text-outline line-through' : 'text-on-surface'}`}>{activity.title}</p>
                                  <p className="truncate text-sm text-secondary dark:text-gray-300">
                                    {activity.location}
                                    {activity.bookingCode ? ` · ${activity.bookingCode}` : ''}
                                    {activity.note ? ` · ${activity.note}` : ''}
                                  </p>
                                </div>
                              </div>
                              {canEdit && (
                                <div className="flex shrink-0 items-center gap-1 self-end md:self-auto">
                                  <label className="mr-1 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-secondary" onClick={(event) => event.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={!!activity.isCompleted}
                                      onChange={async () => {
                                        try {
                                          await editActivity(activity.id, { isCompleted: !activity.isCompleted });
                                        } catch (error) {
                                          showToast({ tone: 'error', title: 'Lỗi', message: getErrorMessage(error, 'Không thể cập nhật trạng thái.') });
                                        }
                                      }}
                                      className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                                    />
                                    Xong
                                  </label>
                                  <button type="button" onClick={() => setReschedulingActivity(activity)} className="rounded-lg p-2 text-secondary transition-colors hover:bg-surface-container-high hover:text-primary" title="Đổi ngày">
                                    <Icons.CalendarDays className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={() => { setEditingActivity(activity); setIsAddOpen(true); }} className="rounded-lg p-2 text-secondary transition-colors hover:bg-surface-container-high hover:text-primary" title="Sửa">
                                    <Icons.Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const shouldDelete = await confirm({
                                        title: 'Xóa hoạt động này',
                                        message: 'Hoạt động sẽ bị xóa khỏi lịch trình của chuyến đi.',
                                        confirmLabel: 'Xóa hoạt động',
                                        cancelLabel: 'Giữ lại',
                                        tone: 'danger',
                                      });
                                      if (!shouldDelete) return;
                                      try {
                                        await deleteActivity(activity.id);
                                        showToast({
                                          tone: 'info',
                                          title: 'Đã xóa hoạt động',
                                          action: { label: 'Hoàn tác', onClick: undoLastAction }
                                        });
                                      } catch (error) {
                                        showToast({
                                          tone: 'error',
                                          title: 'Không thể xóa hoạt động',
                                          message: getErrorMessage(error, 'Không thể xóa hoạt động.'),
                                        });
                                      }
                                    }}
                                    className="rounded-lg p-2 text-secondary transition-colors hover:bg-error-container hover:text-error"
                                    title="Xóa"
                                  >
                                    <Icons.Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-secondary dark:text-gray-300 italic">
                    Không tìm thấy hoạt động nào phù hợp.
                  </div>
                )
              ) : filteredActivities.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={filteredActivities.map(a => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredActivities.map((activity) => (
                      <SortableActivityItem
                        key={activity.id}
                        activity={activity}
                        canEdit={canEdit}
                        onEdit={(act) => { setEditingActivity(act); setIsAddOpen(true); }}
                        onChangeDate={(act) => setReschedulingActivity(act)}
                        onToggleCompletion={async (act) => {
                          try {
                            await editActivity(act.id, { isCompleted: !act.isCompleted });
                          } catch (error) {
                            showToast({ tone: 'error', title: 'Lỗi', message: getErrorMessage(error, 'Không thể cập nhật trạng thái.') });
                          }
                        }}
                        onDelete={async (act) => {
                          const shouldDelete = await confirm({
                            title: 'Xóa hoạt động này',
                            message: 'Hoạt động sẽ bị xóa khỏi lịch trình của chuyến đi.',
                            confirmLabel: 'Xóa hoạt động',
                            cancelLabel: 'Giữ lại',
                            tone: 'danger',
                          });
                          if (!shouldDelete) return;
                          try {
                            await deleteActivity(act.id);
                            showToast({
                              tone: 'info',
                              title: 'Đã xóa hoạt động',
                              action: { label: 'Hoàn tác', onClick: undoLastAction }
                            });
                          } catch (error) {
                            showToast({
                              tone: 'error',
                              title: 'Không thể xóa hoạt động',
                              message: getErrorMessage(error, 'Không thể xóa hoạt động.'),
                            });
                          }
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="py-8 text-center text-secondary dark:text-gray-300 italic">
                  Chưa có hoạt động nào trong ngày này.
                </div>
              )}
            </div>
          </motion.div>
        </>
      ) : (
        <motion.div variants={itemVariants} className="py-20 text-center bg-surface-container-lowest rounded-3xl border-2 border-dashed border-outline-variant">
          <Icons.Calendar className="w-16 h-16 text-outline mx-auto mb-4" />
          <h3 className="font-headline text-xl font-bold text-on-surface mb-2">Chưa có lịch trình</h3>
          <p className="text-secondary dark:text-gray-300 mb-6">Hãy bắt đầu thêm các hoạt động cho chuyến đi của bạn.</p>
        </motion.div>
      )}

      <Modal isOpen={!!routePreview} onClose={() => setRoutePreview(null)} title="Xem tuyến đường">
        {routePreview && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="mb-3 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Thứ tự điểm đến</p>
              <ol className="space-y-2">
                {routePreview.locations.map((location, index) => (
                  <li key={`${location}-${index}`} className="flex gap-3 rounded-xl bg-surface-container-lowest px-3 py-2 text-sm">
                    <span className="font-bold text-primary dark:text-white">{index + 1}</span>
                    <span className="text-on-surface">{location}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => window.open(routePreview.url, '_blank')} className="density-button rounded-xl bg-primary font-bold text-on-primary transition hover:opacity-90">
                Mở Google Maps
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(routePreview.url);
                  showToast({ tone: 'success', title: 'Đã copy link bản đồ' });
                }}
                className="density-button rounded-xl bg-surface-container-high font-bold text-on-surface transition hover:bg-surface-container-highest"
              >
                Copy link
              </button>
            </div>
          </div>
        )}
      </Modal>

      {canEdit && (
        <motion.div variants={itemVariants} className={uniqueDates.length > 0 ? "mt-12 pl-8 md:ml-4 md:pl-12" : "mt-8"}>
          <button onClick={() => { setEditingActivity(null); setIsAddOpen(true); }} className="w-full py-8 border-2 border-dashed border-outline-variant rounded-2xl flex flex-col items-center justify-center gap-2 text-secondary dark:text-gray-300 hover:border-primary hover:text-primary dark:text-white transition-all group">
            <Icons.PlusCircle className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span className="font-bold">{viewMode === 'compact' ? 'Thêm hoạt động mới cho lịch trình' : 'Thêm hoạt động mới cho ngày này'}</span>
          </button>
        </motion.div>
      )}

      <Modal isOpen={isAddOpen} onClose={() => { if (!isSubmitting) { setIsAddOpen(false); setEditingActivity(null); setIsBatchMode(false); setSubmitError(null); } }} title={editingActivity ? "Sửa hoạt động" : "Thêm hoạt động"}>
        {!editingActivity && (
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => { setIsBatchMode(false); setSubmitError(null); }} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${!isBatchMode ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-secondary dark:text-gray-300 hover:text-on-surface'}`}>
              Thêm 1 điểm
            </button>
            <button type="button" onClick={() => { setIsBatchMode(true); setSubmitError(null); }} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${isBatchMode ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-secondary dark:text-gray-300 hover:text-on-surface'}`}>
              Thêm nhanh nhiều điểm
            </button>
          </div>
        )}

        {isBatchMode && !editingActivity ? (
          <form onSubmit={handleBatchAddActivity} className="space-y-4">
            {submitError && (
              <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                {submitError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ngày chung</label>
                <input required name="date" type="date" defaultValue={selectedDate || ''} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
              <div>
                <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Giờ bắt đầu</label>
                <input required name="time" type="time" defaultValue="08:00" className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Tên hoạt động <span className="font-normal text-outline">(mỗi dòng 1 hoạt động)</span></label>
              <textarea required name="titles" rows={6} placeholder={"Sân bay\nCheck-in Khách sạn\nĂn trưa đặc sản"} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none font-mono text-sm" />
            </div>
            <div>
              <CategorySelectWithCreate
                name="type"
                label="Loại hoạt động chung"
                options={activityTypeOptions}
                defaultValue="activity"
                fallbackValue="activity"
                className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                createLabel="Thêm loại hoạt động mới"
                resetKey="batch-activity"
              />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Địa điểm chung (Tuỳ chọn)</label>
              <input name="location" type="text" placeholder="VD: Đà Lạt..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div className="pt-4">
              <button type="submit" disabled={isSubmitting} className="density-button w-full bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? 'Đang thêm...' : 'Thêm tất cả (Mỗi mốc cách nhau 1 giờ)'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAddActivity} className="space-y-4">
            {submitError && (
              <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                {submitError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ngày</label>
                <input required name="date" type="date" defaultValue={editingActivity?.date || selectedDate || ''} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
              <div>
                <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Giờ</label>
                <input required name="time" type="time" defaultValue={normalizeTimeForInput(editingActivity?.time || '')} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
              </div>
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Tên hoạt động</label>
              <input required name="title" type="text" defaultValue={editingActivity?.title || ''} placeholder="VD: Ăn trưa tại nhà hàng..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Địa điểm</label>
              <input required name="location" type="text" defaultValue={editingActivity?.location || ''} placeholder="VD: 123 Đường ABC..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Link Google Maps (Tuỳ chọn)</label>
              <input name="mapUrl" type="url" defaultValue={editingActivity?.mapUrl || ''} placeholder="https://maps.google.com/..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Mã Đặt Chỗ / PNR (Tuỳ chọn)</label>
              <input name="bookingCode" type="text" defaultValue={editingActivity?.bookingCode || ''} placeholder="VD: VJ123456, AGO-85..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all uppercase" />
            </div>
            <div>
              <CategorySelectWithCreate
                name="type"
                label="Loại hoạt động"
                options={activityTypeOptions}
                defaultValue={editingActivity?.type || 'activity'}
                fallbackValue="activity"
                className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                createLabel="Thêm loại hoạt động mới"
                resetKey={editingActivity?.id ?? 'new-activity'}
              />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ghi chú</label>
              <textarea name="note" rows={3} defaultValue={editingActivity?.note || ''} placeholder="Ghi chú thêm..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"></textarea>
            </div>
            <div className="pt-4">
              <button type="submit" disabled={isSubmitting} className="density-button w-full bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? 'Đang lưu...' : editingActivity ? "Lưu thay đổi" : "Thêm hoạt động"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!reschedulingActivity} onClose={() => setReschedulingActivity(null)} title="Đổi ngày hoạt động">
        {reschedulingActivity && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const newDate = fd.get('newDate') as string;
            if (newDate === reschedulingActivity.date) {
              setReschedulingActivity(null);
              return;
            }
            try {
              setIsSubmitting(true);
              await editActivity(reschedulingActivity.id, { date: newDate });
              showToast({ tone: 'success', title: 'Thành công', message: 'Đã đổi ngày hoạt động.' });
              setReschedulingActivity(null);
            } catch (error) {
              showToast({ tone: 'error', title: 'Lỗi', message: getErrorMessage(error, 'Không thể đổi ngày.') });
            } finally {
              setIsSubmitting(false);
            }
          }} className="space-y-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Cài đặt lại ngày</label>
              <select name="newDate" defaultValue={reschedulingActivity.date} className="w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary p-3">
                {uniqueDates.map((d, i) => (
                  <option key={d} value={d}>Ngày {i + 1} ({formatDateLabel(d)})</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-secondary">Hoạt động sẽ được di chuyển sang ngày này, giờ gốc được giữ nguyên.</p>
            </div>
            <div className="pt-4">
              <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-on-primary rounded-xl font-bold p-3 hover:opacity-90 disabled:opacity-60 transition-opacity">
                {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </motion.div>
  );
}
