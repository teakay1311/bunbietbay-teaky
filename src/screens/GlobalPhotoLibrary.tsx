import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { SmartEmptyState } from '../components/SmartEmptyState';
import { SortSelect } from '../components/SortSelect';
import { useAppContext } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import type { Photo } from '../domain/models';
import { deletePhotoWithStorage, preparePhotoUploads } from '../features/photos/operations';
import {
  buildPhotoTripFolders,
  filterAndSortGlobalPhotos,
  type GlobalPhotoFilters,
  type GlobalPhotoSortKey,
} from '../features/photos/selectors';
import { isCloudinaryConfigured } from '../lib/cloudinary';
import { formatLocalDate } from '../utils/date';
import { getErrorMessage } from '../utils/errorMessage';
import type { SortOption } from '../utils/listSort';

const SORT_OPTIONS: Array<SortOption<GlobalPhotoSortKey>> = [
  { value: 'takenDesc', label: 'Ngày chụp mới nhất' },
  { value: 'takenAsc', label: 'Ngày chụp cũ nhất' },
  { value: 'createdDesc', label: 'Mới tải lên' },
  { value: 'createdAsc', label: 'Cũ nhất' },
  { value: 'tripAsc', label: 'Chuyến đi A-Z' },
  { value: 'albumAsc', label: 'Album A-Z' },
];

const EMPTY_FILTERS: GlobalPhotoFilters = {
  query: '', tripId: '', album: '', dateFrom: '', dateTo: '', place: '', tag: '', person: '', sortBy: 'takenDesc',
};

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => !!value?.trim()))].sort((left, right) => left.localeCompare(right, 'vi'));
}

function splitValues(value: FormDataEntryValue | null) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function GlobalPhotoLibrary() {
  const { trips, photos, activities, savedPlaces, addPhotos, editPhoto, deletePhoto } = useAppContext();
  const { confirm, showToast } = useFeedback();
  const [viewMode, setViewMode] = useState<'folders' | 'photos'>('folders');
  const [filters, setFilters] = useState<GlobalPhotoFilters>(EMPTY_FILTERS);
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTripId, setUploadTripId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photoOnly = useMemo(() => photos.filter((photo) => photo.itemType !== 'journal'), [photos]);
  const folders = useMemo(() => buildPhotoTripFolders(trips, photoOnly), [photoOnly, trips]);
  const tripById = useMemo(() => new Map(trips.map((trip) => [trip.id, trip])), [trips]);
  const editableTrips = useMemo(() => trips.filter((trip) => trip.permissions.canEditContent), [trips]);
  const filteredPhotos = useMemo(() => filterAndSortGlobalPhotos({ photos: photoOnly, trips, filters }), [filters, photoOnly, trips]);
  const visiblePhotos = useMemo(() => filteredPhotos.slice(0, visibleCount), [filteredPhotos, visibleCount]);
  const selectedPhoto = useMemo(() => photoOnly.find((photo) => photo.id === selectedPhotoId) ?? null, [photoOnly, selectedPhotoId]);
  const selectedPhotoIndex = selectedPhoto ? filteredPhotos.findIndex((photo) => photo.id === selectedPhoto.id) : -1;
  const selectedTrip = filters.tripId ? tripById.get(filters.tripId) : null;
  const uploadActivities = useMemo(() => activities.filter((item) => item.tripId === uploadTripId), [activities, uploadTripId]);
  const uploadPlaces = useMemo(() => savedPlaces.filter((item) => item.tripId === uploadTripId), [savedPlaces, uploadTripId]);
  const editActivities = useMemo(() => activities.filter((item) => item.tripId === selectedPhoto?.tripId), [activities, selectedPhoto?.tripId]);
  const editPlaces = useMemo(() => savedPlaces.filter((item) => item.tripId === selectedPhoto?.tripId), [savedPlaces, selectedPhoto?.tripId]);

  const albums = useMemo(() => uniqueValues(photoOnly.map((photo) => photo.album)), [photoOnly]);
  const places = useMemo(() => uniqueValues(photoOnly.map((photo) => photo.place)), [photoOnly]);
  const tags = useMemo(() => uniqueValues(photoOnly.flatMap((photo) => photo.tags ?? [])), [photoOnly]);
  const people = useMemo(() => uniqueValues(photoOnly.flatMap((photo) => photo.people ?? [])), [photoOnly]);
  const activeFilterCount = [filters.tripId, filters.album, filters.dateFrom, filters.dateTo, filters.place, filters.tag, filters.person].filter(Boolean).length;
  const filterChips = [
    filters.tripId && { key: 'tripId' as const, label: tripById.get(filters.tripId)?.title ?? filters.tripId },
    filters.album && { key: 'album' as const, label: `Album: ${filters.album}` },
    filters.place && { key: 'place' as const, label: `Nơi chụp: ${filters.place}` },
    filters.tag && { key: 'tag' as const, label: `Tag: ${filters.tag}` },
    filters.person && { key: 'person' as const, label: `Người: ${filters.person}` },
    filters.dateFrom && { key: 'dateFrom' as const, label: `Từ ${filters.dateFrom}` },
    filters.dateTo && { key: 'dateTo' as const, label: `Đến ${filters.dateTo}` },
  ].filter(Boolean) as Array<{ key: keyof GlobalPhotoFilters; label: string }>;

  useEffect(() => setVisibleCount(20), [filters]);
  useEffect(() => {
    if (!isSelectionMode) setSelectedPhotoIds([]);
  }, [isSelectionMode]);

  const updateFilter = <Key extends keyof GlobalPhotoFilters>(key: Key, value: GlobalPhotoFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openUpload = (tripId = '') => {
    const nextTripId = editableTrips.some((trip) => trip.id === tripId) ? tripId : editableTrips[0]?.id ?? '';
    setUploadTripId(nextTripId);
    setUploadError(null);
    setSelectedFiles([]);
    setIsUploadOpen(true);
  };

  const mergeFiles = (incomingFiles: File[]) => {
    setSelectedFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...incomingFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!file.type.startsWith('image/') || seen.has(key)) return false;
        seen.add(key);
        return true;
      })];
    });
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uploadTripId || isUploading) return;
    const files = selectedFiles.length ? selectedFiles : Array.from(fileInputRef.current?.files ?? []);
    if (!files.length) {
      setUploadError('Hãy chọn ít nhất một ảnh.');
      return;
    }
    const form = new FormData(event.currentTarget);
    setIsUploading(true);
    setUploadError(null);
    try {
      const nextPhotos = await preparePhotoUploads(files, uploadTripId, {
        album: String(form.get('album') || 'Chung').trim() || 'Chung',
        takenOn: String(form.get('takenOn') || '') || undefined,
        place: String(form.get('place') || ''),
        tags: splitValues(form.get('tags')),
        people: splitValues(form.get('people')),
        activityId: String(form.get('activityId') || '') || undefined,
        placeId: String(form.get('placeId') || '') || undefined,
      });
      await addPhotos(nextPhotos);
      setIsUploadOpen(false);
      setSelectedFiles([]);
      showToast({ tone: 'success', title: 'Đã tải ảnh', message: `${nextPhotos.length} ảnh đã được thêm vào chuyến đi.` });
    } catch (error) {
      setUploadError(getErrorMessage(error, isCloudinaryConfigured ? 'Không thể tải ảnh lên Cloudinary.' : 'Không thể xử lý ảnh trên máy này.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveMetadata = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPhoto || isSaving) return;
    const form = new FormData(event.currentTarget);
    setIsSaving(true);
    setEditError(null);
    try {
      await editPhoto(selectedPhoto.id, {
        album: String(form.get('album') || 'Chung').trim() || 'Chung',
        takenOn: String(form.get('takenOn') || ''),
        place: String(form.get('place') || ''),
        tags: splitValues(form.get('tags')),
        people: splitValues(form.get('people')),
        activityId: String(form.get('activityId') || '') || undefined,
        placeId: String(form.get('placeId') || '') || undefined,
      });
      setIsEditOpen(false);
      showToast({ tone: 'success', title: 'Đã cập nhật thông tin ảnh' });
    } catch (error) {
      setEditError(getErrorMessage(error, 'Không thể cập nhật thông tin ảnh.'));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTargets = async (targets: Photo[]) => {
    const results = await Promise.allSettled(targets.map((photo) => deletePhotoWithStorage(photo, deletePhoto)));
    const failedCount = results.filter((result) => result.status === 'rejected').length;
    const cloudFailedCount = results.filter((result) => result.status === 'fulfilled' && result.value).length;
    if (failedCount) showToast({ tone: 'error', title: 'Xóa ảnh chưa hoàn tất', message: `${failedCount}/${targets.length} ảnh không xóa được.` });
    else if (cloudFailedCount) showToast({ tone: 'error', title: 'Đã gỡ ảnh khỏi chuyến đi', message: `${cloudFailedCount} file gốc trên Cloudinary có thể chưa bị xóa.` });
    else showToast({ tone: 'success', title: 'Đã xóa ảnh', message: `Đã xóa ${targets.length} ảnh.` });
  };

  const handleDeleteSelectedPhoto = async () => {
    if (!selectedPhoto || !tripById.get(selectedPhoto.tripId)?.permissions.canEditContent) return;
    const accepted = await confirm({
      title: 'Xóa ảnh khỏi chuyến đi',
      message: 'Ảnh sẽ bị gỡ khỏi chuyến đi và file cloud sẽ được dọn nếu endpoint xóa đã được cấu hình.',
      confirmLabel: 'Xóa ảnh', cancelLabel: 'Giữ lại', tone: 'danger',
    });
    if (!accepted) return;
    await deleteTargets([selectedPhoto]);
    setSelectedPhotoId(null);
  };

  const handleDeleteMany = async () => {
    const targets = selectedPhotoIds.map((id) => photoOnly.find((photo) => photo.id === id)).filter((photo): photo is Photo => !!photo);
    if (!targets.length) return;
    const accepted = await confirm({
      title: `Xóa ${targets.length} ảnh đã chọn`,
      message: 'Các ảnh sẽ bị gỡ khỏi những chuyến đi tương ứng. Hành động này không thể hoàn tác với ảnh cloud.',
      confirmLabel: 'Xóa ảnh', cancelLabel: 'Giữ lại', tone: 'danger',
    });
    if (!accepted) return;
    await deleteTargets(targets);
    setSelectedPhotoIds([]);
    setIsSelectionMode(false);
  };

  const goToAdjacentPhoto = useCallback((direction: -1 | 1) => {
    if (selectedPhotoIndex < 0 || !filteredPhotos.length) return;
    setSelectedPhotoId(filteredPhotos[(selectedPhotoIndex + direction + filteredPhotos.length) % filteredPhotos.length].id);
  }, [filteredPhotos, selectedPhotoIndex]);

  useEffect(() => {
    if (!selectedPhoto || isEditOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === 'ArrowLeft') goToAdjacentPhoto(-1);
      if (event.key === 'ArrowRight') goToAdjacentPhoto(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToAdjacentPhoto, isEditOpen, selectedPhoto]);

  const openFolder = (tripId: string) => {
    setFilters({ ...EMPTY_FILTERS, tripId });
    setViewMode('photos');
  };

  return (
    <div className="pb-8">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold text-secondary">Ảnh từ mọi chuyến đi</p>
          <h1 className="text-balance font-headline text-2xl font-extrabold text-on-surface md:text-3xl">Thư viện ảnh</h1>
          <p className="mt-1 text-pretty text-sm text-secondary">{folders.length} thư mục · {photoOnly.length} ảnh</p>
        </div>
        {editableTrips.length > 0 && (
          <button type="button" onClick={() => openUpload(filters.tripId)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:opacity-90">
            <Icons.ImagePlus className="size-5" /> Tải ảnh lên
          </button>
        )}
      </header>

      <div className="mb-4 flex w-full max-w-sm rounded-xl bg-surface-container-low p-1 text-sm font-bold">
        <button type="button" onClick={() => { setViewMode('folders'); setFilters(EMPTY_FILTERS); }} className={`min-h-10 flex-1 rounded-lg px-3 ${viewMode === 'folders' ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container'}`}>Thư mục</button>
        <button type="button" onClick={() => setViewMode('photos')} className={`min-h-10 flex-1 rounded-lg px-3 ${viewMode === 'photos' ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container'}`}>Tất cả ảnh</button>
      </div>

      {viewMode === 'folders' ? (
        folders.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {folders.map((folder) => (
              <button key={folder.trip.id} type="button" onClick={() => openFolder(folder.trip.id)} className="group overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest text-left shadow-sm hover:border-primary/40">
                <div className="relative aspect-[16/9] overflow-hidden bg-surface-container-high">
                  {folder.coverUrl ? <img src={folder.coverUrl} alt="" className="size-full object-cover" loading="lazy" decoding="async" /> : <Icons.Image className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-secondary" />}
                  <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2.5 py-1 text-xs font-bold tabular-nums text-white">{folder.photoCount} ảnh</span>
                </div>
                <div className="p-4">
                  <h2 className="truncate font-headline text-base font-bold text-on-surface">{folder.trip.title}</h2>
                  <p className="mt-1 truncate text-sm text-secondary">{folder.trip.location}</p>
                  <p className="mt-2 text-xs tabular-nums text-secondary">{formatLocalDate(folder.trip.startDate, { day: '2-digit', month: '2-digit', year: 'numeric' })} – {formatLocalDate(folder.trip.endDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <SmartEmptyState icon={Icons.ImagePlus} title="Chưa có chuyến đi nào" message="Tạo chuyến đi đầu tiên để thư viện tự tạo một thư mục ảnh tương ứng." />
        )
      ) : (
        <>
          {selectedTrip && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
              <div className="min-w-0"><p className="text-xs text-secondary">Thư mục đang mở</p><p className="truncate font-bold">{selectedTrip.title} · {selectedTrip.location}</p></div>
              <Link to={`/trips/${selectedTrip.id}/memories`} className="rounded-lg px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10">Mở chuyến đi</Link>
            </div>
          )}

          <section aria-label="Tìm kiếm và lọc ảnh" className="mb-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-3 shadow-sm">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="relative block">
                <span className="sr-only">Tìm ảnh</span><Icons.Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" />
                <input type="search" value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} placeholder="Tìm chuyến đi, album, nơi chụp, tag, người..." className="min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low py-2 pl-10 pr-3 text-sm outline-none focus:border-primary" />
              </label>
              <SortSelect value={filters.sortBy} options={SORT_OPTIONS} onChange={(value) => updateFilter('sortBy', value)} className="min-h-11 w-full border border-outline-variant/50 bg-surface-container-low md:w-52" />
              <button type="button" onClick={() => setIsSelectionMode((current) => !current)} className="min-h-11 rounded-xl bg-surface-container-high px-4 text-sm font-bold text-on-surface hover:bg-surface-container-highest">{isSelectionMode ? 'Xong' : 'Chọn nhiều'}</button>
            </div>
            <details className="mt-2 rounded-xl bg-surface-container-low px-3 py-2">
              <summary className="cursor-pointer text-sm font-bold text-on-surface">Bộ lọc nâng cao{activeFilterCount ? ` (${activeFilterCount})` : ''}</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <select aria-label="Lọc theo chuyến đi" value={filters.tripId} onChange={(event) => updateFilter('tripId', event.target.value)} className="min-h-11 rounded-xl border border-outline-variant/50 bg-surface px-3 text-sm"><option value="">Tất cả chuyến đi</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select>
                <select aria-label="Lọc theo album" value={filters.album} onChange={(event) => updateFilter('album', event.target.value)} className="min-h-11 rounded-xl border border-outline-variant/50 bg-surface px-3 text-sm"><option value="">Tất cả album</option>{albums.map((album) => <option key={album}>{album}</option>)}</select>
                <select aria-label="Lọc theo nơi chụp" value={filters.place} onChange={(event) => updateFilter('place', event.target.value)} className="min-h-11 rounded-xl border border-outline-variant/50 bg-surface px-3 text-sm"><option value="">Tất cả nơi chụp</option>{places.map((place) => <option key={place}>{place}</option>)}</select>
                <select aria-label="Lọc theo tag" value={filters.tag} onChange={(event) => updateFilter('tag', event.target.value)} className="min-h-11 rounded-xl border border-outline-variant/50 bg-surface px-3 text-sm"><option value="">Tất cả tag</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select>
                <select aria-label="Lọc theo người" value={filters.person} onChange={(event) => updateFilter('person', event.target.value)} className="min-h-11 rounded-xl border border-outline-variant/50 bg-surface px-3 text-sm"><option value="">Tất cả người</option>{people.map((person) => <option key={person}>{person}</option>)}</select>
                <label className="text-xs font-semibold text-secondary">Từ ngày<input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface px-3 text-sm text-on-surface" /></label>
                <label className="text-xs font-semibold text-secondary">Đến ngày<input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface px-3 text-sm text-on-surface" /></label>
                <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="min-h-11 self-end rounded-xl px-3 text-sm font-bold text-primary hover:bg-primary/10">Xóa tất cả bộ lọc</button>
              </div>
            </details>
            {!!filterChips.length && <div className="mt-2 flex flex-wrap gap-2">{filterChips.map((chip) => <button key={chip.key} type="button" aria-label={`Xóa bộ lọc ${chip.label}`} onClick={() => updateFilter(chip.key, '')} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary/10 px-3 text-xs font-bold text-primary"><span>{chip.label}</span><Icons.X className="size-3.5" /></button>)}</div>}
          </section>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-secondary">
            <span className="tabular-nums">{filteredPhotos.length} ảnh phù hợp</span>
            {isSelectionMode && <button type="button" onClick={handleDeleteMany} disabled={!selectedPhotoIds.length} className="rounded-lg bg-error px-3 py-2 font-bold text-on-error disabled:opacity-50">Xóa {selectedPhotoIds.length} ảnh</button>}
          </div>

          {filteredPhotos.length ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {visiblePhotos.map((photo) => {
                  const trip = tripById.get(photo.tripId);
                  const canEdit = !!trip?.permissions.canEditContent;
                  const selected = selectedPhotoIds.includes(photo.id);
                  return (
                    <button key={photo.id} type="button" onClick={() => isSelectionMode && canEdit ? setSelectedPhotoIds((current) => selected ? current.filter((id) => id !== photo.id) : [...current, photo.id]) : setSelectedPhotoId(photo.id)} className={`group relative aspect-square overflow-hidden rounded-xl border bg-surface-container-high text-left ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-outline-variant/30'}`}>
                      <img src={photo.url} alt={photo.album || `Ảnh từ ${trip?.title ?? 'chuyến đi'}`} className="size-full object-cover" loading="lazy" decoding="async" />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-slate-950/70 px-2 py-1.5 text-xs font-semibold text-white">{trip?.title} · {photo.album}</span>
                      {isSelectionMode && canEdit && <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-surface text-primary shadow-sm">{selected ? <Icons.Check className="size-4" /> : null}</span>}
                    </button>
                  );
                })}
              </div>
              {filteredPhotos.length > visibleCount && <div className="mt-5 text-center"><button type="button" onClick={() => setVisibleCount((count) => count + 20)} className="min-h-11 rounded-xl bg-surface-container-high px-5 text-sm font-bold hover:bg-surface-container-highest">Xem thêm {Math.min(20, filteredPhotos.length - visibleCount)} ảnh</button></div>}
            </>
          ) : (
            <SmartEmptyState
              icon={Icons.ImagePlus}
              title={photoOnly.length ? 'Không tìm thấy ảnh phù hợp' : selectedTrip ? 'Thư mục chưa có ảnh' : 'Chưa có ảnh nào'}
              message={photoOnly.length ? 'Thử xóa bớt bộ lọc hoặc dùng từ khóa khác.' : 'Ảnh tải lên trong từng chuyến đi sẽ tự xuất hiện tại đây.'}
              actionLabel={selectedTrip?.permissions.canEditContent || (!selectedTrip && editableTrips.length) ? 'Tải ảnh lên' : undefined}
              onAction={selectedTrip?.permissions.canEditContent || (!selectedTrip && editableTrips.length) ? () => openUpload(selectedTrip?.id) : undefined}
            />
          )}
        </>
      )}

      <Modal isOpen={!!selectedPhoto && !isEditOpen} onClose={() => setSelectedPhotoId(null)} title={selectedPhoto ? `${tripById.get(selectedPhoto.tripId)?.title ?? 'Chuyến đi'} · ${selectedPhoto.album}` : 'Ảnh'} size="wide">
        {selectedPhoto && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-xl bg-slate-950">
              <img src={selectedPhoto.url} alt={selectedPhoto.album} className="max-h-[70dvh] max-w-full object-contain" />
              {filteredPhotos.length > 1 && <><button type="button" aria-label="Ảnh trước" onClick={() => goToAdjacentPhoto(-1)} className="absolute left-2 flex size-11 items-center justify-center rounded-full bg-black/60 text-white"><Icons.ChevronLeft className="size-5" /></button><button type="button" aria-label="Ảnh tiếp theo" onClick={() => goToAdjacentPhoto(1)} className="absolute right-2 flex size-11 items-center justify-center rounded-full bg-black/60 text-white"><Icons.ChevronRight className="size-5" /></button></>}
            </div>
            <aside className="space-y-3 text-sm">
              <div><p className="text-xs text-secondary">Chuyến đi</p><p className="font-bold">{tripById.get(selectedPhoto.tripId)?.title}</p></div>
              <div><p className="text-xs text-secondary">Album</p><p>{selectedPhoto.album}</p></div>
              <div><p className="text-xs text-secondary">Ngày chụp</p><p className="tabular-nums">{selectedPhoto.takenOn ? formatLocalDate(selectedPhoto.takenOn, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa cập nhật'}</p></div>
              <div><p className="text-xs text-secondary">Nơi chụp</p><p>{selectedPhoto.place || 'Chưa cập nhật'}</p></div>
              {!!selectedPhoto.people?.length && <div><p className="text-xs text-secondary">Người</p><p>{selectedPhoto.people.join(', ')}</p></div>}
              {!!selectedPhoto.tags?.length && <div><p className="text-xs text-secondary">Tag</p><p>{selectedPhoto.tags.join(', ')}</p></div>}
              <div className="grid gap-2 pt-2">
                <Link to={`/trips/${selectedPhoto.tripId}/memories`} className="min-h-11 rounded-xl bg-surface-container-high px-4 py-3 text-center font-bold">Mở chuyến đi</Link>
                {tripById.get(selectedPhoto.tripId)?.permissions.canEditContent && <><button type="button" onClick={() => { setEditError(null); setIsEditOpen(true); }} className="min-h-11 rounded-xl bg-primary px-4 font-bold text-on-primary">Sửa thông tin</button><button type="button" onClick={handleDeleteSelectedPhoto} className="min-h-11 rounded-xl border border-error px-4 font-bold text-error">Xóa ảnh</button></>}
              </div>
            </aside>
          </div>
        )}
      </Modal>

      <Modal isOpen={isUploadOpen} onClose={() => { if (!isUploading) setIsUploadOpen(false); }} title="Tải ảnh lên">
        <form onSubmit={handleUpload} className="space-y-4">
          {uploadError && <div role="alert" className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">{uploadError}</div>}
          <label className="block text-sm font-bold">Chuyến đi<select required aria-label="Chuyến đi" value={uploadTripId} onChange={(event) => setUploadTripId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3"><option value="">Chọn chuyến đi</option>{editableTrips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
          <label className="block text-sm font-bold">Album<input name="album" defaultValue="Chung" className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label>
          <label className="block text-sm font-bold">Chọn ảnh<input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(event) => mergeFiles(Array.from(event.target.files ?? []))} className="mt-1 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low p-3 text-sm" /></label>
          {!!selectedFiles.length && <p className="text-sm text-secondary">Đã chọn {selectedFiles.length} ảnh.</p>}
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Ngày chụp<input name="takenOn" type="date" className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label><label className="text-sm font-bold">Nơi chụp<input name="place" className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Tag<input name="tags" placeholder="biển, đồ ăn" className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label><label className="text-sm font-bold">Người<input name="people" placeholder="An, Bình" className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Hoạt động<select name="activityId" aria-label="Hoạt động" className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3"><option value="">Không liên kết</option>{uploadActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label><label className="text-sm font-bold">Địa điểm chuyến đi<select name="placeId" aria-label="Địa điểm chuyến đi" className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3"><option value="">Không liên kết</option>{uploadPlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div>
          <button type="submit" disabled={isUploading || !uploadTripId} className="min-h-11 w-full rounded-xl bg-primary px-4 font-bold text-on-primary disabled:opacity-50">{isUploading ? 'Đang tải ảnh...' : 'Tải ảnh lên'}</button>
        </form>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => { if (!isSaving) setIsEditOpen(false); }} title="Sửa thông tin ảnh">
        {selectedPhoto && <form onSubmit={handleSaveMetadata} className="space-y-4">
          {editError && <div role="alert" className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">{editError}</div>}
          <label className="block text-sm font-bold">Album<input name="album" defaultValue={selectedPhoto.album} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Ngày chụp<input name="takenOn" type="date" defaultValue={selectedPhoto.takenOn} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label><label className="text-sm font-bold">Nơi chụp<input name="place" defaultValue={selectedPhoto.place} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Tag<input name="tags" defaultValue={selectedPhoto.tags?.join(', ')} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label><label className="text-sm font-bold">Người<input name="people" defaultValue={selectedPhoto.people?.join(', ')} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3" /></label></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Hoạt động<select name="activityId" aria-label="Hoạt động" defaultValue={selectedPhoto.activityId} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3"><option value="">Không liên kết</option>{editActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label><label className="text-sm font-bold">Địa điểm chuyến đi<select name="placeId" aria-label="Địa điểm chuyến đi" defaultValue={selectedPhoto.placeId} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3"><option value="">Không liên kết</option>{editPlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div>
          <button type="submit" disabled={isSaving} className="min-h-11 w-full rounded-xl bg-primary px-4 font-bold text-on-primary disabled:opacity-50">{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </form>}
      </Modal>
    </div>
  );
}
