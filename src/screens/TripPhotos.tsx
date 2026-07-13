import { useParams, useSearchParams } from 'react-router-dom';
import type { FormEvent } from 'react';

import { Icons } from '../components/Icons';
import { useAppContext, type Photo } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { SmartEmptyState } from '../components/SmartEmptyState';
import { isCloudinaryConfigured } from '../lib/cloudinary';
import { EMBEDDED_PHOTO_WARNING_BYTES, formatBytes, getPhotoStorageSummary, shouldWarnAboutEmbeddedStorage } from '../utils/photoStorage';
import { getErrorMessage } from '../utils/errorMessage';
import { formatLocalDate } from '../utils/date';
import { motion, AnimatePresence } from 'motion/react';
import { pageStaggerVariants } from '../ui/motion';
import { SortSelect } from '../components/SortSelect';
import { type SortOption } from '../utils/listSort';
import { filterAndSortPhotos, getPhotoAlbums, groupPhotosByTimeline, type PhotoSortKey } from '../features/photos/selectors';
import { deletePhotoWithStorage, preparePhotoUploads } from '../features/photos/operations';

const PHOTO_SORT_OPTIONS: Array<SortOption<PhotoSortKey>> = [
  { value: 'createdDesc', label: 'Mới nhất' },
  { value: 'createdAsc', label: 'Cũ nhất' },
  { value: 'takenDesc', label: 'Ngày chụp mới nhất' },
  { value: 'takenAsc', label: 'Ngày chụp cũ nhất' },
  { value: 'albumAsc', label: 'Album A-Z' },
  { value: 'placeAsc', label: 'Nơi chụp A-Z' },
  { value: 'photosFirst', label: 'Ảnh trước' },
  { value: 'journalsFirst', label: 'Nhật ký trước' },
];

export function TripPhotos() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { trips, photos, activities, savedPlaces, addPhotos, editPhoto, deletePhoto, setCurrentTripId } = useAppContext();
  const { showToast, confirm } = useFeedback();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddJournalOpen, setIsAddJournalOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<string>('Tất cả');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [photoSearch, setPhotoSearch] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [sortBy, setSortBy] = useState<PhotoSortKey>('createdDesc');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [isEditMetadataOpen, setIsEditMetadataOpen] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mergeSelectedImageFiles = (incomingFiles: File[]) => {
    const imageFiles = incomingFiles.filter((file) => file.type.startsWith('image/'));
    setSelectedFiles((currentFiles) => {
      const seenFiles = new Set(currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const nextFiles = [...currentFiles];
      imageFiles.forEach((file) => {
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seenFiles.has(fileKey)) {
          seenFiles.add(fileKey);
          nextFiles.push(file);
        }
      });
      return nextFiles;
    });
  };

  useEffect(() => {
    setVisibleCount(20);
  }, [photoSearch, selectedAlbum, sortBy]);

  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  const trip = trips.find(t => t.id === id);
  const tripPhotos = useMemo(() => photos.filter(p => p.tripId === id), [photos, id]);
  const tripActivities = useMemo(() => activities.filter((item) => item.tripId === id), [activities, id]);
  const tripPlaces = useMemo(() => savedPlaces.filter((item) => item.tripId === id), [savedPlaces, id]);
  const contextActivityId = tripActivities.some((item) => item.id === searchParams.get('activityId')) ? searchParams.get('activityId') ?? '' : '';
  const contextPlaceId = tripPlaces.some((item) => item.id === searchParams.get('placeId')) ? searchParams.get('placeId') ?? '' : '';
  useEffect(() => {
    if (searchParams.get('action') === 'journal') setIsAddJournalOpen(true);
    if (searchParams.get('action') === 'photo') setIsAddOpen(true);
  }, [searchParams]);
  const activityNameById = useMemo(() => new Map(tripActivities.map((item) => [item.id, item.title])), [tripActivities]);
  const placeNameById = useMemo(() => new Map(tripPlaces.map((item) => [item.id, item.name])), [tripPlaces]);
  const photoStorageSummary = useMemo(() => getPhotoStorageSummary(tripPhotos), [tripPhotos]);
  const shouldWarnAboutLocalPhotoStorage = useMemo(() => shouldWarnAboutEmbeddedStorage(tripPhotos), [tripPhotos]);

  const albums = useMemo(() => getPhotoAlbums(tripPhotos), [tripPhotos]);
  const displayedPhotos = useMemo(
    () => filterAndSortPhotos(tripPhotos, selectedAlbum, photoSearch, sortBy),
    [photoSearch, selectedAlbum, tripPhotos, sortBy],
  );

  const visiblePhotos = useMemo(() => displayedPhotos.slice(0, visibleCount), [displayedPhotos, visibleCount]);
  const timelineGroups = useMemo(() => groupPhotosByTimeline(displayedPhotos), [displayedPhotos]);

  const selectedPhoto = useMemo(
    () => tripPhotos.find((photo) => photo.id === selectedPhotoId) ?? null,
    [selectedPhotoId, tripPhotos],
  );
  const selectedPhotoIndex = useMemo(
    () => selectedPhoto ? displayedPhotos.findIndex((photo) => photo.id === selectedPhoto.id) : -1,
    [displayedPhotos, selectedPhoto],
  );

  useEffect(() => {
    if (selectedAlbum === 'Tất cả') return;

    const hasSelectedAlbum = tripPhotos.some(photo => photo.album === selectedAlbum);
    if (!hasSelectedAlbum) {
      setSelectedAlbum('Tất cả');
    }
  }, [selectedAlbum, tripPhotos]);

  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedPhotoIds([]);
    }
  }, [isSelectionMode]);

  const goToAdjacentPhoto = useCallback((direction: -1 | 1) => {
    if (displayedPhotos.length === 0 || selectedPhotoIndex < 0) return;
    const nextIndex = (selectedPhotoIndex + direction + displayedPhotos.length) % displayedPhotos.length;
    setSelectedPhotoId(displayedPhotos[nextIndex].id);
  }, [displayedPhotos, selectedPhotoIndex]);

  useEffect(() => {
    if (!selectedPhoto || isEditMetadataOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if (isTyping || event.defaultPrevented) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToAdjacentPhoto(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToAdjacentPhoto(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToAdjacentPhoto, isEditMetadataOpen, selectedPhoto]);

  if (!trip) return <div>Trip not found</div>;
  const canEdit = trip.permissions.canEditContent;

  const handleEditMetadata = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPhoto || isSavingMetadata) return;

    const formData = new FormData(e.currentTarget);
    const album = ((formData.get('album') as string) || 'Chung').trim() || 'Chung';
    const takenOn = ((formData.get('takenOn') as string) || '').trim();
    const place = ((formData.get('place') as string) || '').trim();
    const people = ((formData.get('people') as string) || '').split(',').map((value) => value.trim()).filter(Boolean);
    const tags = ((formData.get('tags') as string) || '').split(',').map((value) => value.trim()).filter(Boolean);
    const content = ((formData.get('content') as string) || '').trim();

    try {
      setIsSavingMetadata(true);
      setMetadataError(null);
      await editPhoto(selectedPhoto.id, {
        album,
        takenOn,
        place,
        people,
        tags,
        activityId: String(formData.get('activityId') || '') || undefined,
        placeId: String(formData.get('placeId') || '') || undefined,
        ...(selectedPhoto.itemType === 'journal' ? { content } : {}),
      });
      setIsEditMetadataOpen(false);
      showToast({ tone: 'success', title: 'Đã cập nhật thông tin' });
    } catch (error) {
      setMetadataError(getErrorMessage(error, 'Không thể cập nhật thông tin ảnh.'));
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleAddJournal = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isUploading) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const albumName = formData.get('album') as string || 'Chung';
      const takenOn = (formData.get('takenOn') as string) || undefined;
      const place = formData.get('place') as string;
      const tags = ((formData.get('tags') as string) || '').split(',').map((value) => value.trim()).filter(Boolean);
      const people = ((formData.get('people') as string) || '').split(',').map((value) => value.trim()).filter(Boolean);
      const content = formData.get('content') as string;

      await addPhotos([{
        tripId: trip!.id,
        url: '',
        itemType: 'journal',
        content,
        album: albumName,
        storage: 'embedded',
        takenOn,
        place,
        tags,
        people,
        activityId: String(formData.get('activityId') || '') || undefined,
        placeId: String(formData.get('placeId') || '') || undefined,
      } as Photo]);
      setIsAddJournalOpen(false);
    } catch (error) {
      setUploadError(getErrorMessage(error, 'Không thể lưu nhật ký.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddPhotos = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const albumName = formData.get('album') as string || 'Chung';
    const takenOn = (formData.get('takenOn') as string) || undefined;
    const place = formData.get('place') as string;
    const tags = ((formData.get('tags') as string) || '').split(',').map((value) => value.trim()).filter(Boolean);
    const people = ((formData.get('people') as string) || '').split(',').map((value) => value.trim()).filter(Boolean);
    const activityId = String(formData.get('activityId') || '') || undefined;
    const placeId = String(formData.get('placeId') || '') || undefined;
    const files = selectedFiles.length > 0 ? selectedFiles : Array.from(fileInputRef.current?.files ?? []);

    if (!files || files.length === 0) {
      setUploadError('Hãy chọn hoặc kéo thả ít nhất 1 ảnh.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    let didSucceed = false;
    try {
      const nextPhotos = await preparePhotoUploads(files, trip.id, {
        album: albumName,
        takenOn,
        place,
        tags,
        people,
        activityId,
        placeId,
      });
      if (nextPhotos.length > 0) {
        await addPhotos(nextPhotos);
      }
      didSucceed = true;
    } catch (error) {
      console.error("Error compressing/uploading image:", error);
      setUploadError(
        getErrorMessage(
          error,
          isCloudinaryConfigured
            ? 'Có lỗi xảy ra khi tải ảnh lên Cloudinary.'
            : 'Có lỗi xảy ra khi xử lý ảnh trên máy này.',
        ),
      );
    } finally {
      setIsUploading(false);
      if (didSucceed) {
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsAddOpen(false);
      }
    }
  };

  const handleDeletePhoto = async (photoId: string, isRemotePhoto: boolean) => {
    const targetPhoto = tripPhotos.find((photo) => photo.id === photoId);
    const shouldDelete = await confirm({
      title: 'Xóa ảnh khỏi chuyến đi',
      message: isRemotePhoto
        ? 'Ảnh sẽ bị gỡ khỏi chuyến đi. App sẽ thử xóa file gốc trên Cloudinary nếu endpoint xóa đã được cấu hình.'
        : 'Ảnh sẽ bị gỡ khỏi bộ sưu tập của chuyến đi trên máy này.',
      confirmLabel: 'Xóa ảnh',
      cancelLabel: 'Giữ lại',
      tone: 'danger',
    });

    if (!shouldDelete) {
      return;
    }

    void (async () => {
      const cloudDeleteFailed = targetPhoto ? await deletePhotoWithStorage(targetPhoto, deletePhoto) : false;
      if (cloudDeleteFailed) {
        showToast({
          tone: 'error',
          title: 'Ảnh cloud chưa bị xóa',
          message: 'Record ảnh đã được gỡ khỏi chuyến đi nhưng file gốc trên Cloudinary có thể chưa bị xóa.',
        });
      }
    })().catch((error) => {
      showToast({
        tone: 'error',
        title: 'Không thể xóa ảnh',
        message: getErrorMessage(error, 'Không thể xóa ảnh.'),
      });
    });
  };

  const toggleSelectedPhoto = (photoId: string) => {
    setSelectedPhotoIds((currentSelected) => currentSelected.includes(photoId)
      ? currentSelected.filter((id) => id !== photoId)
      : [...currentSelected, photoId]);
  };

  const deleteSelectedPhotos = async () => {
    const shouldDelete = await confirm({
      title: `Xóa ${selectedPhotoIds.length} ảnh đã chọn`,
      message: 'Các ảnh này sẽ bị gỡ khỏi chuyến đi hiện tại.',
      confirmLabel: 'Xóa ảnh',
      cancelLabel: 'Giữ lại',
      tone: 'danger',
    });
    if (!shouldDelete) {
      return;
    }

    const targets = selectedPhotoIds
      .map((photoId) => tripPhotos.find((photo) => photo.id === photoId))
      .filter(Boolean) as Photo[];
    let cloudCleanupFailedCount = 0;
    const deleteResults = await Promise.allSettled(targets.map(async (photo) => {
      if (await deletePhotoWithStorage(photo, deletePhoto)) cloudCleanupFailedCount += 1;
    }));
    const failedCount = deleteResults.filter((result) => result.status === 'rejected').length;
    if (failedCount > 0) {
      showToast({
        tone: 'error',
        title: 'Xóa ảnh chưa hoàn tất',
        message: `Có ${failedCount}/${targets.length} ảnh không xóa được. Vui lòng thử lại.`,
      });
    } else if (cloudCleanupFailedCount > 0) {
      showToast({
        tone: 'error',
        title: 'Đã gỡ ảnh khỏi chuyến đi',
        message: `${cloudCleanupFailedCount} file gốc trên Cloudinary có thể chưa bị xóa.`,
      });
    } else {
      showToast({
        tone: 'success',
        title: 'Đã xóa ảnh',
        message: `Đã xóa ${targets.length} ảnh.`,
      });
    }
    setSelectedPhotoIds([]);
    setIsSelectionMode(false);
  };

  const containerVariants = pageStaggerVariants;
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.18 } }
  } as const;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-10">
      <motion.div variants={itemVariants} className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold text-secondary dark:text-gray-300">Kỷ niệm</p>
          <h1 className="text-balance font-headline text-2xl font-extrabold text-primary dark:text-white md:text-3xl">Thư viện ảnh</h1>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {canEdit && (
            <button
              onClick={() => setIsSelectionMode((currentState) => !currentState)}
              className="rounded-xl bg-surface-container-high px-3 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-highest sm:px-4 sm:py-3 sm:text-base"
            >
              {isSelectionMode ? 'Xong' : 'Chọn nhiều ảnh'}
            </button>
          )}
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={() => setIsAddJournalOpen(true)} className="bg-surface-container-high text-on-surface px-3 py-2 sm:px-6 sm:py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-surface-container-highest transition-colors text-sm sm:text-base">
                <Icons.FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Viết nhật ký</span>
                <span className="sm:hidden">Nhật ký</span>
              </button>
              <button onClick={() => setIsAddOpen(true)} className="bg-primary text-on-primary px-3 py-2 sm:px-6 sm:py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity text-sm sm:text-base">
                <Icons.Image className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Tải ảnh lên</span>
                <span className="sm:hidden">Tải ảnh</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {(photoStorageSummary.totalCount > 0 || shouldWarnAboutLocalPhotoStorage) && (
          <motion.div variants={itemVariants} initial="hidden" animate="show" exit={{ opacity: 0, y: -10 }} className="mb-6 rounded-2xl bg-surface-container-low p-4">
            <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary dark:text-gray-300 mb-2">Nguồn lưu ảnh</p>
            <p className="text-on-surface font-medium">
              {photoStorageSummary.remoteCount} ảnh cloud, {photoStorageSummary.embeddedCount} ảnh lưu local.
            </p>
            <p className="text-sm text-secondary dark:text-gray-300 mt-2">
              Dung lượng ảnh local ước tính: {formatBytes(photoStorageSummary.estimatedEmbeddedBytes)}.
            </p>
            {shouldWarnAboutLocalPhotoStorage && (
              <p className="mt-2 text-sm text-amber-700">
                Ảnh local đã vượt khoảng {formatBytes(EMBEDDED_PHOTO_WARNING_BYTES)}. Nếu bạn dùng nhiều máy hoặc nhiều ảnh, nên cấu hình Cloudinary cho các ảnh mới.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={itemVariants} className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:max-w-2xl md:gap-3">
          <div className="relative flex-1">
          <Icons.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary dark:text-gray-300" />
          <input
            type="search"
            value={photoSearch}
            onChange={(event) => setPhotoSearch(event.target.value)}
            placeholder="Tìm theo album, nơi chụp, tag, người..."
            className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low py-3 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          </div>
          <SortSelect<PhotoSortKey> value={sortBy} options={PHOTO_SORT_OPTIONS} onChange={setSortBy} className="w-full border border-outline-variant/50 bg-surface-container-low py-3 md:w-auto md:min-w-[190px]" />
          <div className="flex rounded-xl bg-surface-container-low p-1 ring-1 ring-outline-variant/40 sm:col-span-2">
            <button type="button" onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${viewMode === 'grid' ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container'}`}>
              Grid
            </button>
            <button type="button" onClick={() => setViewMode('timeline')} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${viewMode === 'timeline' ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container'}`}>
              Timeline
            </button>
          </div>
        </div>
        {isSelectionMode && (
          <button
            onClick={deleteSelectedPhotos}
            disabled={selectedPhotoIds.length === 0}
            className="rounded-xl border-2 border-error px-4 py-3 font-bold text-error disabled:opacity-50"
          >
            Xóa {selectedPhotoIds.length} ảnh đã chọn
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {albums.length > 1 && (
          <motion.div variants={itemVariants} initial="hidden" animate="show" exit={{ opacity: 0 }} className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
            {albums.map(album => (
              <button
                key={album}
                onClick={() => setSelectedAlbum(album)}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors md:px-6 md:text-base ${selectedAlbum === album
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
              >
                {album}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={itemVariants} className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-secondary dark:text-gray-300">
        <span className="font-medium">
          Hiển thị {displayedPhotos.length} mục
          {displayedPhotos.length !== tripPhotos.length && ` phù hợp trong tổng ${tripPhotos.length} mục`}
        </span>
        {(photoSearch.trim() || selectedAlbum !== 'Tất cả') && (
          <button
            type="button"
            onClick={() => {
              setPhotoSearch('');
              setSelectedAlbum('Tất cả');
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10 dark:text-white"
          >
            Xóa bộ lọc
          </button>
        )}
      </motion.div>

      {viewMode === 'timeline' ? (
        <motion.div key="timeline-view" variants={itemVariants} className="space-y-8">
          {timelineGroups.map((group) => (
            <section key={`timeline-${group.date}`} className="relative pl-6">
              <div className="absolute bottom-0 left-2 top-2 w-[2px] bg-surface-container-high" />
              <div className="absolute left-0 top-1 h-4 w-4 rounded-full bg-primary" />
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-headline text-xl font-bold text-on-surface">{formatLocalDate(group.date, { day: '2-digit', month: 'long', year: 'numeric' })}</h2>
                <span className="rounded-full bg-surface-container-high px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-secondary">
                  {group.photos.length} mục
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.photos.map((photo) => (
                  <button key={photo.id} type="button" onClick={() => setSelectedPhotoId(photo.id)} className="flex min-h-28 overflow-hidden rounded-2xl bg-surface-container-low text-left transition hover:bg-surface-container">
                    {photo.itemType === 'journal' ? (
                      <div className="flex w-28 shrink-0 items-center justify-center bg-primary/10 text-primary dark:text-white">
                        <Icons.FileText className="h-8 w-8" />
                      </div>
                    ) : (
                      <img src={photo.url} alt="Trip memory" className="h-28 w-28 shrink-0 object-cover" loading="lazy" decoding="async" />
                    )}
                    <div className="min-w-0 flex-1 p-4">
                      <p className="truncate font-headline text-base font-bold text-on-surface">{photo.itemType === 'journal' ? 'Nhật ký' : photo.album}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-secondary dark:text-gray-300">
                        {photo.itemType === 'journal' ? photo.content : [photo.place, ...(photo.tags ?? [])].filter(Boolean).join(' · ') || photo.album}
                      </p>
                      {(photo.activityId || photo.placeId) && <p className="mt-1 truncate text-xs text-secondary">{photo.activityId ? `Hoạt động: ${activityNameById.get(photo.activityId) ?? 'Đã xóa'}` : `Địa điểm: ${placeNameById.get(photo.placeId!) ?? 'Đã xóa'}`}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {displayedPhotos.length === 0 && (
            <SmartEmptyState
              icon={Icons.ImagePlus}
              title="Không có kỷ niệm phù hợp"
              message="Thử đổi album, xóa từ khóa tìm kiếm hoặc thêm ảnh mới cho chuyến đi này."
              actionLabel={canEdit ? 'Tải ảnh lên' : undefined}
              onAction={canEdit ? () => setIsAddOpen(true) : undefined}
            />
          )}
        </motion.div>
      ) : (
        <>
      <motion.div key="grid-view" className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] md:gap-4">
        {visiblePhotos.map(photo => (
          <motion.div variants={itemVariants} key={photo.id} className="relative group image-sheen aspect-square rounded-2xl overflow-hidden bg-surface-container-high motion-lift">
            <button
              type="button"
              onClick={() => isSelectionMode ? toggleSelectedPhoto(photo.id) : setSelectedPhotoId(photo.id)}
              aria-label={photo.itemType === 'journal' ? `Mở nhật ký ${photo.album}` : `Mở ảnh ${photo.album}`}
              className="block h-full w-full text-left bg-surface-container-low"
            >
              {photo.itemType === 'journal' ? (
                <div className="relative flex h-full flex-col justify-center overflow-hidden bg-surface-container p-4 transition-colors group-hover:bg-surface-container-high md:p-6">
                  <Icons.FileText className="absolute top-4 right-4 w-12 h-12 opacity-5" />
                  <p className="text-sm font-semibold italic text-on-surface line-clamp-4 relative z-10">"{photo.content}"</p>
                </div>
              ) : (
                <img src={photo.url} alt="Trip memory" className="size-full object-cover" loading="lazy" decoding="async" />
              )}
            </button>
            {isSelectionMode && (
              <div className="absolute left-3 top-3 rounded-full bg-black/55 p-1">
                <input
                  type="checkbox"
                  checked={selectedPhotoIds.includes(photo.id)}
                  onChange={() => toggleSelectedPhoto(photo.id)}
                  className="h-4 w-4 rounded border-white/50 bg-transparent text-primary dark:text-white focus:ring-primary"
                />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="text-white font-bold text-sm truncate">{photo.album}</p>
              <span className="mt-1 inline-flex w-fit items-center rounded-full bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                {photo.itemType === 'journal' ? 'Nhật ký' : photo.storage === 'remote' ? 'Cloud' : 'Máy này'}
              </span>
              {(photo.place || (photo.tags && photo.tags.length > 0)) && (
                <p className="mt-2 text-xs text-white/80 line-clamp-2">
                  {[photo.place, ...(photo.tags ?? [])].filter(Boolean).join(' · ')}
                </p>
              )}
              {canEdit && (
                <button
                  onClick={() => handleDeletePhoto(photo.id, photo.storage === 'remote')}
                  aria-label="Xóa ảnh"
                  className="pointer-events-auto absolute top-3 right-3 p-2 bg-error/90 text-white rounded-lg hover:bg-error transition-colors"
                >
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {displayedPhotos.length === 0 && (
          <motion.div variants={itemVariants} className="col-span-full">
            <SmartEmptyState
              icon={Icons.ImagePlus}
              title={photoSearch.trim() || selectedAlbum !== 'Tất cả' ? 'Không tìm thấy ảnh phù hợp' : 'Chưa có ảnh nào'}
              message={photoSearch.trim() || selectedAlbum !== 'Tất cả'
                ? 'Thử đổi album hoặc xóa từ khóa tìm kiếm để xem lại toàn bộ thư viện.'
                : 'Bạn có thể tải ảnh từ máy lên hoặc đồng bộ qua Cloudinary.'}
              actionLabel={canEdit ? 'Tải ảnh lên' : undefined}
              onAction={canEdit ? () => setIsAddOpen(true) : undefined}
            />
          </motion.div>
        )}
      </motion.div>

      {
        displayedPhotos.length > visibleCount && (
          <motion.div variants={itemVariants} className="mt-8 flex justify-center">
            <button onClick={() => setVisibleCount(c => c + 20)} className="px-8 py-3 font-bold bg-surface-container-high text-on-surface hover:bg-surface-container-highest rounded-full transition-colors flex items-center gap-2">
              <Icons.ChevronDown className="w-5 h-5" />
              Xem thêm {Math.min(20, displayedPhotos.length - visibleCount)} ảnh
            </button>
          </motion.div>
        )
      }
        </>
      )}

      <Modal isOpen={isAddOpen} onClose={() => { if (!isUploading) { setUploadError(null); setSelectedFiles([]); setIsAddOpen(false); } }} title="Tải ảnh lên">
        <form onSubmit={handleAddPhotos} className="space-y-4">
          {uploadError && (
            <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm font-medium">
              {uploadError}
            </div>
          )}
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Album</label>
            <input name="album" type="text" placeholder="VD: Ngày 1, Biển, Đồ ăn..." defaultValue={selectedAlbum !== 'Tất cả' ? selectedAlbum : 'Chung'} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Chọn ảnh (Có thể chọn nhiều)</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => mergeSelectedImageFiles(Array.from(event.target.files ?? []))}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary/10 file:text-primary dark:text-white hover:file:bg-primary/20"
            />
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                mergeSelectedImageFiles(Array.from(event.dataTransfer.files as FileList));
              }}
              className={`mt-3 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm transition-colors ${isDragOver ? 'border-primary bg-primary/5 text-primary dark:text-white' : 'border-outline-variant text-secondary dark:text-gray-300'
                }`}
            >
              Kéo và thả ảnh vào đây để upload nhanh.
              {selectedFiles.length > 0 && (
                <div className="mt-3 rounded-lg bg-surface-container-low p-3 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-on-surface">Đã chọn {selectedFiles.length} ảnh.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFiles([]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="rounded-lg px-2 py-1 text-xs font-bold text-error transition hover:bg-error-container"
                    >
                      Xóa danh sách
                    </button>
                  </div>
                  <p className="mt-1 truncate text-xs text-secondary dark:text-gray-300">
                    {selectedFiles.slice(0, 3).map((file) => file.name).join(', ')}
                    {selectedFiles.length > 3 ? ` và ${selectedFiles.length - 3} ảnh khác` : ''}
                  </p>
                </div>
              )}
            </div>
            <p className={`mt-2 text-xs ${isCloudinaryConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isCloudinaryConfigured
                ? 'Ảnh sẽ được nén rồi tải lên Cloudinary. App chỉ lưu link ảnh nên nhẹ hơn khi đồng bộ nhiều máy.'
                : 'Chưa cấu hình Cloudinary. Ảnh sẽ được nén và lưu cùng dữ liệu app trên máy này.'}
            </p>
            {isCloudinaryConfigured && (
              <p className="mt-2 text-xs text-secondary dark:text-gray-300">
                Khi xóa ảnh cloud trong app, hệ thống sẽ thử xóa file gốc nếu bạn đã cấu hình `VITE_CLOUDINARY_DELETE_ENDPOINT`.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ngày chụp</label>
              <input name="takenOn" type="date" className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Nơi chụp</label>
              <input name="place" type="text" placeholder="VD: Hồ Xuân Hương" className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-secondary">Hoạt động liên quan<select name="activityId" defaultValue={contextActivityId} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 text-sm"><option value="">Không gắn hoạt động</option>{tripActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.date} · {activity.title}</option>)}</select></label><label className="text-xs font-bold text-secondary">Địa điểm liên quan<select name="placeId" defaultValue={contextPlaceId} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 text-sm"><option value="">Không gắn địa điểm</option>{tripPlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Người trong ảnh</label>
              <input name="people" type="text" placeholder="Linh, An, Tú" className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary mb-1">Tag</label>
              <input name="tags" type="text" placeholder="hoàng hôn, đồi chè" className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="pt-4">
            <button disabled={isUploading} type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2">
              {isUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Đang xử lý và tải ảnh lên...
                </>
              ) : (
                'Tải ảnh lên'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isAddJournalOpen} onClose={() => { if (!isUploading) { setUploadError(null); setIsAddJournalOpen(false); } }} title="Viết nhật ký">
        <form onSubmit={handleAddJournal} className="space-y-4">
          {uploadError && (
            <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm font-medium">
              {uploadError}
            </div>
          )}
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Nội dung nhật ký</label>
            <textarea
              required
              name="content"
              rows={4}
              placeholder="Hôm nay là một ngày tuyệt vời..."
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
            ></textarea>
          </div>
          <div>
            <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Album / Chủ đề</label>
            <input name="album" type="text" placeholder="VD: Ngày 1, Cảm nhận..." defaultValue={selectedAlbum !== 'Tất cả' ? selectedAlbum : 'Nhật ký'} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Ngày</label>
              <input name="takenOn" type="date" className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Nơi ghi</label>
              <input name="place" type="text" placeholder="VD: Quán cà phê X" className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-secondary">Hoạt động liên quan<select name="activityId" defaultValue={contextActivityId} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 text-sm"><option value="">Không gắn hoạt động</option>{tripActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.date} · {activity.title}</option>)}</select></label><label className="text-xs font-bold text-secondary">Địa điểm liên quan<select name="placeId" defaultValue={contextPlaceId} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 text-sm"><option value="">Không gắn địa điểm</option>{tripPlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div>
          <div className="pt-4">
            <button disabled={isUploading} type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2">
              {isUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Đang xử lý...
                </>
              ) : (
                'Lưu nhật ký'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(selectedPhoto)} onClose={() => setSelectedPhotoId(null)} title={selectedPhoto?.album || 'Chi tiết'} size="wide">
        {selectedPhoto && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToAdjacentPhoto(-1)}
                  disabled={displayedPhotos.length <= 1}
                  className="focus-ring rounded-xl bg-surface-container-high px-3 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                >
                  <Icons.ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium text-secondary dark:text-gray-300">
                  {selectedPhotoIndex >= 0 ? `${selectedPhotoIndex + 1}/${displayedPhotos.length}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => goToAdjacentPhoto(1)}
                  disabled={displayedPhotos.length <= 1}
                  className="focus-ring rounded-xl bg-surface-container-high px-3 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                >
                  <Icons.ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setMetadataError(null);
                    setIsEditMetadataOpen(true);
                  }}
                  className="focus-ring inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
                >
                  <Icons.Edit2 className="h-4 w-4" />
                  Sửa thông tin
                </button>
              )}
            </div>
            {selectedPhoto.itemType === 'journal' ? (
              <div className="p-8 rounded-2xl bg-surface-container-low border-l-4 border-primary">
                <Icons.FileText className="w-8 h-8 text-primary mb-4" />
                <p className="text-lg font-medium text-on-surface whitespace-pre-wrap italic">
                  "{selectedPhoto.content}"
                </p>
              </div>
            ) : (
              <div className="relative rounded-2xl bg-surface-container-low">
                <img src={selectedPhoto.url} alt={selectedPhoto.album} className="max-h-[72vh] w-full rounded-2xl object-contain" />
                {displayedPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => goToAdjacentPhoto(-1)}
                      className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
                      aria-label="Ảnh trước"
                    >
                      <Icons.ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => goToAdjacentPhoto(1)}
                      className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
                      aria-label="Ảnh tiếp theo"
                    >
                      <Icons.ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-surface-container-low p-4">
                <p className="font-label text-xs uppercase tracking-widest text-secondary mb-1">Ngày chụp</p>
                <p className="font-medium text-on-surface">{selectedPhoto.takenOn || 'Chưa gắn'}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-4">
                <p className="font-label text-xs uppercase tracking-widest text-secondary mb-1">Nơi chụp</p>
                <p className="font-medium text-on-surface">{selectedPhoto.place || 'Chưa gắn'}</p>
              </div>
            </div>
            {selectedPhoto.people && selectedPhoto.people.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedPhoto.people.map((person) => (
                  <span key={person} className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
                    {person}
                  </span>
                ))}
              </div>
            )}
            {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedPhoto.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {(!selectedPhoto.people || selectedPhoto.people.length === 0) && (!selectedPhoto.tags || selectedPhoto.tags.length === 0) && (
              <p className="text-sm text-secondary">Ảnh này chưa có metadata bổ sung.</p>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(selectedPhoto) && isEditMetadataOpen} onClose={() => { if (!isSavingMetadata) setIsEditMetadataOpen(false); }} title="Sửa thông tin ảnh">
        {selectedPhoto && (
          <form onSubmit={handleEditMetadata} className="space-y-4">
            {metadataError && (
              <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                {metadataError}
              </div>
            )}
            {selectedPhoto.itemType === 'journal' && (
              <div>
                <label className="mb-1 block font-label text-xs font-bold text-secondary dark:text-gray-300">Nội dung nhật ký</label>
                <textarea
                  name="content"
                  rows={4}
                  defaultValue={selectedPhoto.content ?? ''}
                  className="w-full resize-none rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block font-label text-xs font-bold text-secondary dark:text-gray-300">Album</label>
              <input name="album" type="text" defaultValue={selectedPhoto.album} className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-label text-xs font-bold text-secondary dark:text-gray-300">Ngày</label>
                <input name="takenOn" type="date" defaultValue={selectedPhoto.takenOn ?? ''} className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1 block font-label text-xs font-bold text-secondary dark:text-gray-300">Nơi chụp</label>
                <input name="place" type="text" defaultValue={selectedPhoto.place ?? ''} className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-secondary">Hoạt động liên quan<select name="activityId" defaultValue={selectedPhoto.activityId ?? ''} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 text-sm"><option value="">Không gắn hoạt động</option>{tripActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.date} · {activity.title}</option>)}</select></label><label className="text-xs font-bold text-secondary">Địa điểm liên quan<select name="placeId" defaultValue={selectedPhoto.placeId ?? ''} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 text-sm"><option value="">Không gắn địa điểm</option>{tripPlaces.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-label text-xs font-bold text-secondary dark:text-gray-300">Người trong ảnh</label>
                <input name="people" type="text" defaultValue={(selectedPhoto.people ?? []).join(', ')} className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1 block font-label text-xs font-bold text-secondary dark:text-gray-300">Tag</label>
                <input name="tags" type="text" defaultValue={(selectedPhoto.tags ?? []).join(', ')} className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <button disabled={isSavingMetadata} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50">
              {isSavingMetadata && <Icons.Loader2 className="h-5 w-5 animate-spin" />}
              Lưu thông tin
            </button>
          </form>
        )}
      </Modal>
    </motion.div>
  );
}
