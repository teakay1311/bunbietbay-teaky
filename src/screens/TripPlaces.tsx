import { useParams } from 'react-router-dom';
import type { FormEvent } from 'react';

import { Icons } from '../components/Icons';
import { useAppContext, SavedPlace } from '../context/AppContext';
import { useNotebook, type NotebookPlace } from '../context/NotebookContext';
import { useFeedback } from '../context/FeedbackContext';
import { useEffect, useState, useMemo } from 'react';
import { Modal } from '../components/Modal';
import { getErrorMessage } from '../utils/errorMessage';
import { motion } from 'motion/react';
import { pageStaggerVariants } from '../ui/motion';
import { ExternalLink } from 'lucide-react';
import { LinkifyText } from '../components/LinkifyText';
import { StarRatingInput } from '../components/StarRatingInput';
import { SortSelect } from '../components/SortSelect';
import { CategorySelectWithCreate } from '../components/CategorySelectWithCreate';
import { chainComparators, compareDate, compareNumber, compareText, stableSort, type SortOption } from '../utils/listSort';
import { getCategoryLabel, mergeCategoryOptions, PLACE_TYPE_OPTIONS } from '../utils/tripCategories';

type PlaceSortKey = 'ratingDesc' | 'ratingAsc' | 'nameAsc' | 'nameDesc' | 'typeAsc' | 'createdDesc' | 'createdAsc';

const PLACE_SORT_OPTIONS: Array<SortOption<PlaceSortKey>> = [
  { value: 'ratingDesc', label: 'Đánh giá cao nhất' },
  { value: 'ratingAsc', label: 'Đánh giá thấp nhất' },
  { value: 'nameAsc', label: 'Tên A-Z' },
  { value: 'nameDesc', label: 'Tên Z-A' },
  { value: 'typeAsc', label: 'Loại địa điểm' },
  { value: 'createdDesc', label: 'Mới nhất' },
  { value: 'createdAsc', label: 'Cũ nhất' },
];

export function TripPlaces() {
  const { id } = useParams();
  const { trips, savedPlaces, addSavedPlace, editSavedPlace, deleteSavedPlace, addActivity, setCurrentTripId, undoLastAction } = useAppContext();
  const { notebookPlaces } = useNotebook();
  const { showToast, confirm } = useFeedback();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<PlaceSortKey>('ratingDesc');
  const [viewingPlace, setViewingPlace] = useState<SavedPlace | null>(null);
  const [isNotebookImportOpen, setIsNotebookImportOpen] = useState(false);

  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  const trip = trips.find(t => t.id === id);
  const places = useMemo(() => savedPlaces.filter(p => p.tripId === id), [savedPlaces, id]);
  const placeTypeOptions = useMemo(() => mergeCategoryOptions(PLACE_TYPE_OPTIONS, places.map((place) => place.type)), [places]);
  const notebookImportCandidates = useMemo(() => {
    const existingNames = new Set(places.map((place) => place.name.trim().toLowerCase()));
    return notebookPlaces
      .filter((place) => !existingNames.has(place.name.trim().toLowerCase()))
      .slice(0, 6);
  }, [notebookPlaces, places]);

  const filteredPlaces = useMemo(() => {
    let list = places;
    if (activeTab !== 'all') {
      list = places.filter(p => p.type === activeTab);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.address?.toLowerCase().includes(q)) ||
        (p.note?.toLowerCase().includes(q))
      );
    }
    const fallbackSort = (a: SavedPlace, b: SavedPlace) => compareText(a.name, b.name, 'asc');
    const sortComparator = (a: SavedPlace, b: SavedPlace) => {
      switch (sortBy) {
        case 'ratingAsc': return compareNumber(a.rating ?? 0, b.rating ?? 0, 'asc');
        case 'nameAsc': return compareText(a.name, b.name, 'asc');
        case 'nameDesc': return compareText(a.name, b.name, 'desc');
        case 'typeAsc': return compareText(a.type, b.type, 'asc');
        case 'createdDesc': return compareDate(a.createdAt, b.createdAt, 'desc');
        case 'createdAsc': return compareDate(a.createdAt, b.createdAt, 'asc');
        case 'ratingDesc':
        default: return compareNumber(a.rating ?? 0, b.rating ?? 0, 'desc');
      }
    };
    return stableSort(list, chainComparators(sortComparator, fallbackSort));
  }, [places, activeTab, searchQuery, sortBy]);

  if (!trip) return <div>Trip not found</div>;
  const canEdit = trip.permissions.canEditContent;

  const handleAddPlace = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const nextPlace = {
        tripId: trip.id,
        name: formData.get('name') as string,
        type: formData.get('type') as SavedPlace['type'],
        phone: formData.get('phone') as string,
        address: formData.get('address') as string,
        rating: Math.max(1, Math.min(5, Number(formData.get('rating')) || 5)),
        note: formData.get('note') as string,
      };

      if (editingPlace) {
        await editSavedPlace(editingPlace.id, nextPlace);
      } else {
        await addSavedPlace(nextPlace);
      }
      setIsAddOpen(false);
      setEditingPlace(null);
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Không thể lưu địa điểm.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const mapNotebookPlaceType = (type: NotebookPlace['type']): SavedPlace['type'] => {
    if (type === 'hotel') return 'hotel';
    if (type === 'restaurant' || type === 'cafe') return 'restaurant';
    return 'other';
  };

  const getPlaceTypeIcon = (type: string, className = 'w-4 h-4') => {
    if (type === 'hotel') return <Icons.Hotel className={className} />;
    if (type === 'restaurant') return <Icons.Utensils className={className} />;
    return <Icons.MapPin className={className} />;
  };

  const importNotebookPlace = async (place: NotebookPlace, createActivity = false) => {
    try {
      const placeType = mapNotebookPlaceType(place.type);
      await addSavedPlace({
        tripId: trip.id,
        name: place.name,
        type: placeType,
        phone: place.phone,
        address: place.address,
        rating: place.rating,
        note: place.note,
      });

      if (createActivity) {
        await addActivity({
          tripId: trip.id,
          date: trip.startDate,
          time: '09:00',
          title: place.name,
          location: place.address || place.name,
          note: place.note || '',
          type: placeType === 'hotel' ? 'hotel' : placeType === 'restaurant' ? 'restaurant' : 'activity',
        });
      }

      showToast({
        tone: 'success',
        title: createActivity ? 'Đã thêm địa điểm và lịch trình' : 'Đã thêm địa điểm',
        message: `"${place.name}" đã được đưa vào chuyến đi.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Không thể nhập địa điểm',
        message: getErrorMessage(error, 'Không thể nhập địa điểm từ sổ tay.'),
      });
    }
  };

  const containerVariants = pageStaggerVariants;

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 15 },
    show: { opacity: 1, scale: 1, y: 0, transition: { ease: 'easeOut', duration: 0.2 } }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-10">
      <motion.div variants={itemVariants} className="mb-6 flex flex-col items-stretch justify-between gap-4 md:mb-8 md:flex-row md:items-end">
        <div>
          <p className="mb-2 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-secondary dark:text-gray-300 md:text-xs md:tracking-[0.2em]">Lưu trữ thông tin</p>
          <h1 className="font-headline text-2xl font-extrabold text-primary dark:text-white md:text-4xl md:tracking-tighter">Địa điểm & Liên hệ</h1>
        </div>
        {canEdit && (
          <button onClick={() => { setEditingPlace(null); setIsAddOpen(true); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary transition-opacity hover:opacity-90 md:w-auto md:px-6">
            <Icons.Plus className="w-5 h-5" />
            Thêm địa điểm
          </button>
        )}
      </motion.div>

      <div className="mb-6 flex flex-col justify-between gap-3 md:mb-8 md:flex-row md:items-center md:gap-4">
        <motion.div variants={itemVariants} className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth rounded-xl bg-surface-container-low p-1.5">
          {[{ value: 'all', label: 'Tất cả' }, ...placeTypeOptions].map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors md:gap-2 md:px-5 md:text-sm ${activeTab === tab.value
                ? 'bg-primary text-white shadow-sm'
                : 'text-secondary dark:text-gray-300 hover:text-primary hover:bg-surface-container'
                }`}
            >
              {tab.value === 'all' ? <Icons.List className="w-4 h-4" /> : getPlaceTypeIcon(tab.value)}
              {tab.value === 'other' ? 'Đi chơi' : tab.label}
            </button>
          ))}
        </motion.div>

        <motion.div variants={itemVariants} className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:max-w-xl md:flex md:gap-3">
          <div className="relative flex-1">
            <Icons.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-50" />
            <input
              type="text"
              placeholder="Tìm địa điểm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-high text-sm text-on-surface rounded-full pl-9 pr-4 py-2 focus:ring-1 focus:ring-primary/50 transition-all font-medium outline-none"
            />
          </div>
          <SortSelect value={sortBy} options={PLACE_SORT_OPTIONS} onChange={setSortBy} className="w-full md:w-auto md:min-w-[180px]" />
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-secondary dark:text-gray-300 md:mb-6">
        <span className="font-medium">
          Hiển thị {filteredPlaces.length} địa điểm
          {filteredPlaces.length !== places.length && ` phù hợp trong tổng ${places.length} địa điểm`}
        </span>
        {(searchQuery.trim() || activeTab !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveTab('all');
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10 dark:text-white"
          >
            Xóa bộ lọc
          </button>
        )}
      </motion.div>

      {canEdit && notebookImportCandidates.length > 0 && (
        <motion.section variants={itemVariants} className="mb-8 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-4 editorial-shadow">
          <button
            type="button"
            onClick={() => setIsNotebookImportOpen((currentValue) => !currentValue)}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <div>
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Từ cẩm nang địa điểm</p>
              <h2 className="mt-1 font-headline text-xl font-bold text-on-surface">Đưa nhanh địa điểm đã lưu vào chuyến đi</h2>
              <p className="mt-1 text-xs font-medium text-secondary dark:text-gray-300">{notebookImportCandidates.length} địa điểm có thể thêm nhanh</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-secondary transition hover:bg-surface-container-highest">
              <Icons.ChevronDown className={`h-5 w-5 transition-transform ${isNotebookImportOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {isNotebookImportOpen && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {notebookImportCandidates.map((place) => (
                <div key={place.id} className="rounded-2xl bg-surface-container-low p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-headline text-base font-bold text-on-surface">{place.name}</p>
                      <p className="mt-1 truncate text-xs text-secondary dark:text-gray-300">{place.address || place.type}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary dark:text-white">
                      {place.rating}/5
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void importNotebookPlace(place)} className="flex-1 rounded-xl bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-highest">
                      Thêm vào địa điểm
                    </button>
                    <button type="button" onClick={() => void importNotebookPlace(place, true)} className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary transition hover:opacity-90">
                      Tạo lịch trình
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {filteredPlaces.map(place => (
          <motion.div
            variants={itemVariants}
            key={place.id}
            className="group relative cursor-pointer rounded-2xl bg-surface-container-lowest p-4 editorial-shadow transition-all hover:shadow-lg md:p-6"
            onClick={() => setViewingPlace(place)}
          >
            {canEdit && (
              <div className="absolute top-4 right-4 flex gap-2 md:opacity-0 transition-opacity md:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setEditingPlace(place); setSubmitError(null); setIsAddOpen(true); }} className="p-2 text-secondary dark:text-gray-300 hover:text-primary dark:text-white hover:bg-surface-container rounded-lg transition-colors">
                  <Icons.Edit2 className="w-4 h-4" />
                </button>
                <button onClick={async () => {
                  const shouldDelete = await confirm({
                    title: `Xóa địa điểm "${place.name}"`,
                    message: 'Địa điểm này sẽ bị gỡ khỏi danh sách lưu trữ của chuyến đi.',
                    confirmLabel: 'Xóa địa điểm',
                    cancelLabel: 'Giữ lại',
                    tone: 'danger',
                  });
                  if (!shouldDelete) {
                    return;
                  }

                  try {
                    await deleteSavedPlace(place.id);
                    showToast({
                      tone: 'info',
                      title: 'Đã xóa địa điểm',
                      action: { label: 'Hoàn tác', onClick: undoLastAction }
                    });
                  } catch (error) {
                    showToast({
                      tone: 'error',
                      title: 'Không thể xóa địa điểm',
                      message: getErrorMessage(error, 'Không thể xóa địa điểm.'),
                    });
                  }
                }} className="p-2 text-secondary dark:text-gray-300 hover:text-error hover:bg-error-container rounded-lg transition-colors">
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary-container text-primary dark:text-white flex items-center justify-center">
                {getPlaceTypeIcon(place.type, 'w-6 h-6')}
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl text-on-surface">{place.name}</h3>
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icons.Star key={i} className={`w-3 h-3 ${i < (place.rating || 0) ? 'fill-current' : 'text-outline-variant'}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {place.phone && (
                <div className="flex items-center gap-3 text-secondary dark:text-gray-300">
                  <Icons.Phone className="w-4 h-4" />
                  <span className="font-body text-sm">{place.phone}</span>
                </div>
              )}
              {place.address && (() => {
                const isUrl = /^https?:\/\//i.test(place.address);
                const href = isUrl ? place.address : `https://maps.google.com/?q=${encodeURIComponent(place.address)}`;
                return (
                  <div className="flex items-start gap-3 text-secondary dark:text-gray-300">
                    <Icons.MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <a href={href} target="_blank" rel="noopener noreferrer" className="font-body text-sm text-primary hover:underline transition-colors inline-flex items-center gap-1">
                      <span className="line-clamp-2">{place.address}</span>
                      <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />
                    </a>
                  </div>
                );
              })()}
              {place.note && (
                <div className="mt-4 pt-4 border-t border-outline-variant/30">
                  <p className="text-sm italic text-on-surface-variant">"<LinkifyText text={place.note} />"</p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {places.length === 0 && (
          <motion.div variants={itemVariants} className="col-span-full py-12 text-center border-2 border-dashed border-outline-variant rounded-2xl">
            <Icons.Bookmark className="w-12 h-12 mx-auto text-secondary dark:text-gray-300 mb-4 opacity-50" />
            <p className="text-secondary dark:text-gray-300 font-medium">Chưa có địa điểm nào được lưu.</p>
          </motion.div>
        )}
        {places.length > 0 && filteredPlaces.length === 0 && (
          <motion.div variants={itemVariants} className="col-span-full py-12 text-center border-2 border-dashed border-outline-variant rounded-2xl">
            <Icons.Search className="w-12 h-12 mx-auto text-secondary dark:text-gray-300 mb-4 opacity-50" />
            <p className="text-secondary dark:text-gray-300 font-medium">Không tìm thấy địa điểm phù hợp với bộ lọc hiện tại.</p>
          </motion.div>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => { if (!isSubmitting) { setIsAddOpen(false); setEditingPlace(null); setSubmitError(null); } }} title={editingPlace ? "Sửa địa điểm lưu trữ" : "Thêm địa điểm lưu trữ"}>
        <form onSubmit={handleAddPlace} className="space-y-4">
          {submitError && (
            <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
              {submitError}
            </div>
          )}
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Tên địa điểm</label>
            <input required name="name" type="text" defaultValue={editingPlace?.name || ''} placeholder="VD: Khách sạn ABC..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <CategorySelectWithCreate
                name="type"
                label="Loại"
                options={placeTypeOptions}
                defaultValue={editingPlace?.type || 'hotel'}
                fallbackValue="hotel"
                className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                createLabel="Thêm loại địa điểm mới"
                resetKey={editingPlace?.id ?? 'new-place'}
              />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Đánh giá sao</label>
              <div className="pt-1">
                <StarRatingInput name="rating" defaultValue={editingPlace?.rating ?? 5} />
              </div>
            </div>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Số điện thoại</label>
            <input name="phone" type="tel" defaultValue={editingPlace?.phone || ''} placeholder="VD: 0901234567" className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Địa chỉ / Link Google Maps</label>
            <input name="address" type="text" defaultValue={editingPlace?.address || ''} placeholder="Nhập địa chỉ hoặc dán link Maps..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ghi chú</label>
            <textarea name="note" rows={3} defaultValue={editingPlace?.note || ''} placeholder="Ghi chú thêm (VD: pass wifi, giờ check-in)..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"></textarea>
          </div>
          <div className="pt-4">
            <button type="submit" disabled={isSubmitting} className="density-button w-full bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Đang lưu...' : editingPlace ? 'Lưu thay đổi' : 'Lưu địa điểm'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal isOpen={!!viewingPlace} onClose={() => setViewingPlace(null)} title={viewingPlace?.name ?? ''}>
        {viewingPlace && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-container text-primary flex items-center justify-center shrink-0">
                {getPlaceTypeIcon(viewingPlace.type, 'w-6 h-6')}
              </div>
              <div>
                <p className="font-label text-[11px] uppercase tracking-widest text-secondary font-bold">
                  {getCategoryLabel(placeTypeOptions, viewingPlace.type)}
                </p>
                <div className="flex items-center gap-1 text-amber-500 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icons.Star key={i} className={`w-3.5 h-3.5 ${i < (viewingPlace.rating || 0) ? 'fill-current' : 'text-outline-variant'}`} />
                  ))}
                </div>
              </div>
            </div>

            {viewingPlace.phone && (
              <a href={`tel:${viewingPlace.phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors">
                <Icons.Phone className="w-4 h-4 text-primary shrink-0" />
                <span className="font-body text-sm font-medium text-on-surface">{viewingPlace.phone}</span>
              </a>
            )}

            {viewingPlace.address && (() => {
              const isUrl = /^https?:\/\//i.test(viewingPlace.address);
              const href = isUrl ? viewingPlace.address : `https://maps.google.com/?q=${encodeURIComponent(viewingPlace.address)}`;
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors">
                  <Icons.MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="font-body text-sm font-medium text-on-surface">{viewingPlace.address}</span>
                </a>
              );
            })()}

            {viewingPlace.note && (
              <div className="p-4 rounded-xl bg-surface-container-low border-l-4 border-primary/30">
                <p className="text-sm italic text-on-surface-variant">"<LinkifyText text={viewingPlace.note} />"</p>
              </div>
            )}

            {canEdit && (
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setViewingPlace(null); setEditingPlace(viewingPlace); setSubmitError(null); setIsAddOpen(true); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-sm transition-colors"
                >
                  <Icons.Edit2 className="w-4 h-4" /> Sửa
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const shouldDelete = await confirm({
                      title: `Xóa địa điểm "${viewingPlace.name}"`,
                      message: 'Địa điểm này sẽ bị gỡ khỏi danh sách lưu trữ của chuyến đi.',
                      confirmLabel: 'Xóa địa điểm',
                      cancelLabel: 'Giữ lại',
                      tone: 'danger',
                    });
                    if (!shouldDelete) return;
                    try {
                      await deleteSavedPlace(viewingPlace.id);
                      setViewingPlace(null);
                      showToast({
                        tone: 'info',
                        title: 'Đã xóa địa điểm',
                        action: { label: 'Hoàn tác', onClick: undoLastAction },
                      });
                    } catch (error) {
                      showToast({ tone: 'error', title: 'Không thể xóa địa điểm', message: getErrorMessage(error, 'Không thể xóa địa điểm.') });
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-error/10 hover:bg-error/20 text-error font-bold text-sm transition-colors"
                >
                  <Icons.Trash2 className="w-4 h-4" /> Xóa
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
