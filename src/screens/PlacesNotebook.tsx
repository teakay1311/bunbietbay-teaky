import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Icons } from '../components/Icons';
import { useNotebook, NotebookPlace } from '../context/NotebookContext';
import { useFeedback } from '../context/FeedbackContext';
import { Modal } from '../components/Modal';
import { StarRatingInput } from '../components/StarRatingInput';
import { SortSelect } from '../components/SortSelect';
import { type SortOption } from '../utils/listSort';
import { useAppContext } from '../context/AppContext';
import { buildLibraryUsage, filterAndSortLibraryPlaces, type NotebookPlaceSortKey } from '../features/library/selectors';

const NOTEBOOK_PLACE_SORT_OPTIONS: Array<SortOption<NotebookPlaceSortKey>> = [
    { value: 'createdDesc', label: 'Mới nhất' },
    { value: 'createdAsc', label: 'Cũ nhất' },
    { value: 'ratingDesc', label: 'Đánh giá cao nhất' },
    { value: 'ratingAsc', label: 'Đánh giá thấp nhất' },
    { value: 'nameAsc', label: 'Tên A-Z' },
    { value: 'nameDesc', label: 'Tên Z-A' },
    { value: 'typeAsc', label: 'Loại địa điểm' },
];
const NOTEBOOK_ROLE_LABELS = { owner: 'Chủ sở hữu', admin: 'Quản trị', editor: 'Chỉnh sửa', viewer: 'Chỉ xem' } as const;
export function PlacesNotebook() {
    const { notebooks, notebookMembers, addNotebook, editNotebook, deleteNotebook, notebookPlaces, addNotebookPlace, editNotebookPlace, deleteNotebookPlace, bulkDeleteNotebookPlaces, inviteToNotebook, updateNotebookMemberRole, transferNotebookOwnership, removeNotebookMember, libraryStatus, libraryError, retryLibrarySync } = useNotebook();
    const { trips, savedPlaces, addLibraryPlaceToTrip, editSavedPlace, isRemoteMode } = useAppContext();
    const { showToast, confirm } = useFeedback();

    const [activeTab, setActiveTab] = useState<'all' | 'hotel' | 'restaurant' | 'cafe' | 'entertainment' | 'other'>('all');
    const [activeNotebookId, setActiveNotebookId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingPlace, setEditingPlace] = useState<NotebookPlace | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<NotebookPlaceSortKey>('createdDesc');

    const [isCreateNbOpen, setIsCreateNbOpen] = useState(false);
    const [isRenameNbOpen, setIsRenameNbOpen] = useState(false);
    const [createNbName, setCreateNbName] = useState('');
    const [createNbInvite, setCreateNbInvite] = useState('');

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Custom fields & photo logic
    const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([]);
    const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
    const [isUploading, setIsUploading] = useState(false);

    // Invite modal state
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
    const [isInviting, setIsInviting] = useState(false);
    const [placeToTrip, setPlaceToTrip] = useState<NotebookPlace | null>(null);
    const activeNotebook = activeNotebookId === 'all' ? null : notebooks.find((item) => item.id === activeNotebookId) ?? null;
    const canWriteLibrary = libraryStatus === 'ready-local' || libraryStatus === 'ready-remote';
    const editableTrips = useMemo(() => trips.filter((trip) => trip.permissions.canEditContent), [trips]);
    const usageByPlace = useMemo(() => buildLibraryUsage(savedPlaces), [savedPlaces]);
    const filteredPlaces = useMemo(() => filterAndSortLibraryPlaces({
        places: notebookPlaces, notebookId: activeNotebookId, type: activeTab, query: searchQuery, sortBy,
    }), [notebookPlaces, activeTab, searchQuery, activeNotebookId, sortBy]);

    const handleOpenForm = (place?: NotebookPlace) => {
        if (place) {
            setEditingPlace(place);
            setCustomFields(place.customFields || []);
            setCoverImage(place.coverImage);
        } else {
            setEditingPlace(null);
            setCustomFields([]);
            setCoverImage(undefined);
        }
        setIsAddOpen(true);
    };

    const handleShare = () => {
        if (activeNotebookId === 'all') {
            showToast({ tone: 'info', title: 'Hướng dẫn', message: 'Vui lòng chọn một bộ sưu tập cụ thể để thêm thành viên.' });
            return;
        }
        const activeNB = notebooks.find(n => n.id === activeNotebookId);
        if (activeNB?.type === 'personal') {
            showToast({ tone: 'info', title: 'Bộ sưu tập cá nhân', message: 'Bộ sưu tập mặc định không thể mời thêm người. Hãy chọn một bộ sưu tập nhóm.' });
            return;
        }
        setInviteEmail('');
        setIsInviteOpen(true);
    };

    const handleInviteMember = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        setIsInviting(true);
        try {
            const result = await inviteToNotebook(activeNotebookId, inviteEmail.trim(), inviteRole);
            if (result.success) {
                showToast({ tone: 'success', title: 'Gửi lời mời thành công', message: `Đã gửi lời mời đến ${inviteEmail}.` });
                setInviteEmail('');
                setIsInviteOpen(false);
            } else {
                showToast({ tone: 'error', title: 'Không thể mời', message: result.error || 'Lỗi không xác định.' });
            }
        } catch (err: any) {
            showToast({ tone: 'error', title: 'Lỗi', message: err.message || 'Không thể gửi lời mời.' });
        } finally {
            setIsInviting(false);
        }
    };

    const handleDeleteNotebook = async () => {
        const activeNB = notebooks.find(n => n.id === activeNotebookId);
        if (!activeNB || activeNotebookId === 'all' || activeNB.type === 'personal') return;

        const placesCount = notebookPlaces.filter(p => p.notebookId === activeNotebookId).length;
        const shouldDelete = await confirm({
            title: `Xóa bộ sưu tập "${activeNB.name}"?`,
            message: `Tất cả ${placesCount} địa điểm trong bộ sưu tập này sẽ bị xóa vĩnh viễn. Thành viên và lời mời cũng sẽ bị hủy.`,
            confirmLabel: 'Xóa vĩnh viễn',
            cancelLabel: 'Giữ lại',
            tone: 'danger',
        });
        if (!shouldDelete) return;

        const deletedPlaceIds = notebookPlaces.filter((place) => place.notebookId === activeNotebookId).map((place) => place.id);
        const result = await deleteNotebook(activeNotebookId);
        if (result.success) {
            if (!isRemoteMode) {
                await Promise.all(savedPlaces
                    .filter((place) => place.sourceNotebookPlaceId && deletedPlaceIds.includes(place.sourceNotebookPlaceId))
                    .map((place) => editSavedPlace(place.id, { sourceNotebookPlaceId: undefined })));
            }
            setActiveNotebookId('all');
            showToast({ tone: 'success', title: 'Đã xóa', message: `Bộ sưu tập "${activeNB.name}" đã được xóa.` });
        } else {
            showToast({ tone: 'error', title: 'Không thể xóa', message: result.error || 'Lỗi không xác định.' });
        }
    };

    const handleCreateNotebook = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (createNbName.trim()) {
            const result = await addNotebook(createNbName, 'shared');
            if (result.success && result.id) {
                // Auto-select the newly created notebook
                setActiveNotebookId(result.id);

                if (createNbInvite.trim()) {
                    const inviteResult = await inviteToNotebook(result.id, createNbInvite.trim());
                    showToast({
                        tone: 'success',
                        title: 'Đã tạo bộ sưu tập',
                        message: `Sổ "${createNbName}" đã sẵn sàng. ${inviteResult.success ? 'Đã gửi lời mời.' : inviteResult.error || ''}`
                    });
                } else {
                    showToast({ tone: 'success', title: 'Đã tạo bộ sưu tập', message: `Bộ sưu tập "${createNbName}" đã sẵn sàng.` });
                }
            } else {
                showToast({ tone: 'error', title: 'Không thể tạo', message: result.error || 'Lỗi không xác định.' });
            }
            setIsCreateNbOpen(false);
            setCreateNbName('');
            setCreateNbInvite('');
        }
    };

    const handleSavePlace = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const placeData = {
            name: formData.get('name') as string,
            type: formData.get('type') as NotebookPlace['type'],
            address: formData.get('address') as string,
            phone: formData.get('phone') as string,
            note: formData.get('note') as string,
            rating: Number(formData.get('rating')) || 5,
            customFields: customFields.filter(f => f.label.trim() !== '' && f.value.trim() !== ''),
            coverImage: coverImage
        };

        const targetNotebookId = activeNotebookId === 'all' 
            ? (notebooks.find(n => n.type === 'personal')?.id || 'default-personal') 
            : activeNotebookId;

        try {
            let result;
            if (editingPlace) {
                result = await editNotebookPlace(editingPlace.id, placeData);
            } else {
                result = await addNotebookPlace(targetNotebookId, placeData);
            }

            if (result.success) {
                showToast({ tone: 'success', title: 'Hoàn tất', message: 'Đã lưu địa điểm thành công.' });
                setIsAddOpen(false);
            } else {
                showToast({ tone: 'error', title: 'Không thể lưu', message: result.error || 'Lỗi không xác định.' });
            }
        } catch (err: any) {
            showToast({ tone: 'error', title: 'Không thể lưu', message: err.message || 'Lỗi không xác định.' });
        }
    };

    const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            // Dynamic import to avoid syntax error if photoUpload not used globally earlier
            const { uploadFileAndGetUrl } = await import('../utils/photoUpload');
            const result = await uploadFileAndGetUrl(file, null);
            setCoverImage(result.url);
            showToast({ tone: 'success', title: 'Thành công', message: 'Đã tải ảnh lên.' });
        } catch (err: any) {
            showToast({ tone: 'error', title: 'Lỗi tải ảnh', message: err.message || 'Thử lại sau.' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        const ok = await confirm({
            title: 'Xóa ' + name,
            message: 'Địa điểm này sẽ bị xóa khỏi Thư viện.',
            confirmLabel: 'Xóa',
            cancelLabel: 'Giữ lại',
            tone: 'danger'
        });
        if (!ok) return;
        try {
            await deleteNotebookPlace(id);
            if (!isRemoteMode) {
                await Promise.all(savedPlaces
                    .filter((place) => place.sourceNotebookPlaceId === id)
                    .map((place) => editSavedPlace(place.id, { sourceNotebookPlaceId: undefined })));
            }
        } catch (error) {
            showToast({ tone: 'error', title: 'Không thể xóa địa điểm', message: error instanceof Error ? error.message : 'Hãy thử lại.' });
        }
    };

    const toggleSelectPlace = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } } as const;
    const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.18 } } } as const;

    if (libraryStatus === 'loading' && notebooks.length === 0) {
        return <LibraryState icon={<Icons.Loader2 className="size-8 animate-spin" />} title="Đang tải Thư viện địa điểm" message="Đang đồng bộ bộ sưu tập, địa điểm và quyền truy cập." />;
    }

    if ((libraryStatus === 'schema-incompatible' || libraryStatus === 'remote-unavailable') && notebooks.length === 0) {
        return <LibraryState icon={<Icons.AlertTriangle className="size-8" />} title={libraryStatus === 'schema-incompatible' ? 'Cơ sở dữ liệu chưa tương thích' : 'Thư viện đang mất kết nối'} message={libraryError ?? 'Không thể tải Thư viện địa điểm.'} action={() => void retryLibrarySync()} />;
    }

    return (
        <React.Fragment>
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="mx-auto mb-24 grid max-w-7xl gap-6 py-2 lg:py-8 xl:grid-cols-[230px_minmax(0,1fr)]">
                <aside className="hidden self-start rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-3 xl:block">
                    <div className="flex items-center justify-between px-2 py-2">
                        <h2 className="font-headline text-lg font-bold">Bộ sưu tập</h2>
                        {canWriteLibrary && <button type="button" onClick={() => setIsCreateNbOpen(true)} aria-label="Tạo bộ sưu tập" title="Tạo bộ sưu tập" className="flex size-9 items-center justify-center rounded-lg text-primary hover:bg-surface-container-low"><Icons.Plus className="size-5" /></button>}
                    </div>
                    <nav aria-label="Bộ sưu tập địa điểm" className="mt-2 space-y-1">
                        <button type="button" onClick={() => setActiveNotebookId('all')} className={`min-h-11 w-full rounded-xl px-3 text-left text-sm font-semibold ${activeNotebookId === 'all' ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-low'}`}>Tất cả địa điểm</button>
                        {notebooks.map((notebook) => <button key={notebook.id} type="button" onClick={() => setActiveNotebookId(notebook.id)} className={`min-h-11 w-full rounded-xl px-3 text-left ${activeNotebookId === notebook.id ? 'bg-primary text-on-primary' : 'hover:bg-surface-container-low'}`}><span className="block truncate text-sm font-semibold">{notebook.name}</span><span className="block text-xs opacity-75">{notebook.memberCount} thành viên · {NOTEBOOK_ROLE_LABELS[notebook.membershipRole]}</span></button>)}
                    </nav>
                </aside>
                <div className="min-w-0">
                    {(libraryStatus === 'schema-incompatible' || libraryStatus === 'remote-unavailable') && (
                        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-medium">{libraryError}</p>
                            <button type="button" onClick={() => void retryLibrarySync()} className="min-h-11 rounded-xl border border-amber-400 px-4 text-sm font-bold">Thử lại</button>
                        </div>
                    )}
                    {activeNotebook && !activeNotebook.permissions.canEditPlaces && <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-secondary">Bạn đang xem bộ sưu tập này ở chế độ chỉ đọc.</div>}

                <motion.div variants={itemVariants} className="relative mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between md:gap-4">
                    <div>
                        <p className="mb-1.5 text-xs font-bold text-secondary">Địa điểm dùng lại giữa các chuyến đi</p>
                        <h1 className="text-balance font-headline text-2xl font-extrabold text-on-surface md:text-5xl">Thư viện địa điểm</h1>
                        <p className="text-sm mt-3 max-w-md text-on-surface-variant leading-relaxed hidden md:block">
                            Nơi bạn lưu trữ mọi nhà hàng, khách sạn, quán cafe tuyệt vời hoặc điểm vui chơi để chuẩn bị cho bất kỳ chuyến đi nào trong tương lai.
                        </p>
                    </div>

                    <div className="flex flex-col items-stretch gap-2 md:items-end md:gap-3">
                        <div className="flex gap-2 xl:hidden">
                        <select
                            value={activeNotebookId}
                            onChange={e => setActiveNotebookId(e.target.value)}
                            aria-label="Chọn bộ sưu tập"
                            className="min-h-11 min-w-0 flex-1 rounded-xl border border-outline/10 bg-surface-container-low px-3 text-sm font-bold text-on-surface outline-none"
                        >
                            <option value="all">Tất cả địa điểm</option>
                            {notebooks.map(nb => (
                                <option key={nb.id} value={nb.id}>
                                    {nb.type === 'personal' ? '👤' : '👥'} {nb.name}
                                </option>
                            ))}
                        </select>
                        {canWriteLibrary && <button type="button" onClick={() => setIsCreateNbOpen(true)} aria-label="Tạo bộ sưu tập" title="Tạo bộ sưu tập" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-primary"><Icons.FolderPlus className="size-5" /></button>}
                        {canWriteLibrary && activeNotebook?.permissions.canManageMembers && <button type="button" onClick={() => setIsRenameNbOpen(true)} aria-label={`Đổi tên ${activeNotebook.name}`} title="Đổi tên bộ sưu tập" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-primary"><Icons.Edit2 className="size-5" /></button>}
                        </div>

                        <div className="hidden flex-wrap gap-0.5 rounded-xl border border-outline/10 bg-surface-container-low p-1 md:flex md:rounded-2xl">
                            {canWriteLibrary && activeNotebook?.permissions.canEditPlaces && <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds([]); }} className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors md:h-10 ${isSelectMode ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-primary/10 hover:text-primary'}`} title="Chọn nhiều">
                                <Icons.CheckSquare className="w-4 h-4" />
                                <span className="hidden md:inline">{isSelectMode ? 'Hủy chọn' : 'Chọn'}</span>
                            </button>}
                            {canWriteLibrary && activeNotebook?.permissions.canInvite && <button aria-label="Mời thành viên vào Thư viện" title="Mời thành viên" onClick={handleShare} className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold text-secondary transition-colors hover:bg-primary/10 hover:text-primary md:h-10">
                                <Icons.UserPlus className="w-4 h-4" />
                                <span className="hidden sm:inline">Mời</span>
                            </button>}
                            {canWriteLibrary && activeNotebook?.permissions.canManageMembers && <button aria-label={`Đổi tên ${activeNotebook.name}`} title="Đổi tên bộ sưu tập" onClick={() => setIsRenameNbOpen(true)} className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold text-secondary hover:bg-primary/10 hover:text-primary md:h-10"><Icons.Edit2 className="size-4" /></button>}
                            {canWriteLibrary && activeNotebook?.type === 'shared' && activeNotebook.permissions.canDeleteNotebook && (
                                <button aria-label={`Xóa bộ sưu tập ${activeNotebook.name}`} onClick={handleDeleteNotebook} className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold text-secondary transition-all hover:bg-error/10 hover:text-error active:scale-95 md:h-10 md:rounded-xl md:px-4" title="Xóa bộ sưu tập này">
                                    <Icons.Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            {canWriteLibrary && (activeNotebookId === 'all' || activeNotebook?.permissions.canEditPlaces) && <button aria-label="Thêm địa điểm vào Thư viện" title="Thêm địa điểm" onClick={() => handleOpenForm()} className="ml-1 flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary md:h-10">
                                <Icons.Plus className="w-4 h-4 mt-0.5" />
                            </button>}
                        </div>
                        {canWriteLibrary && (activeNotebookId === 'all' || activeNotebook?.permissions.canEditPlaces) && <button type="button" onClick={() => handleOpenForm()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary md:hidden"><Icons.Plus className="size-4" />Thêm địa điểm</button>}
                    </div>
                </motion.div>

                <div className="sticky top-20 z-20 mb-6 flex flex-col items-start justify-between gap-2 rounded-2xl border border-outline-variant/30 bg-surface p-2 md:static md:mb-10 2xl:flex-row 2xl:items-center">
                    <label className="w-full md:hidden"><span className="sr-only">Lọc loại địa điểm</span><select value={activeTab} onChange={(event) => setActiveTab(event.target.value as typeof activeTab)} className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 font-semibold"><option value="all">Tất cả loại địa điểm</option><option value="hotel">Khách sạn</option><option value="restaurant">Nhà hàng</option><option value="cafe">Quán Cafe</option><option value="entertainment">Vui chơi</option><option value="other">Khác</option></select></label>
                    <motion.div variants={itemVariants} className="hidden max-w-full gap-2 md:flex">
                        {(['all', 'hotel', 'restaurant', 'cafe', 'entertainment', 'other'] as const).map(tab => {
                            let label = 'Tất cả';
                            let icon = <Icons.Globe className="w-4 h-4" />;
                            if (tab === 'hotel') { label = 'Khách sạn'; icon = <Icons.Hotel className="w-4 h-4" />; }
                            else if (tab === 'restaurant') { label = 'Nhà hàng'; icon = <Icons.Utensils className="w-4 h-4" />; }
                            else if (tab === 'cafe') { label = 'Quán Cafe'; icon = <Icons.MapPin className="w-4 h-4" />; }
                            else if (tab === 'entertainment') { label = 'Vui chơi'; icon = <Icons.Star className="w-4 h-4" />; }
                            else if (tab === 'other') { label = 'Khác'; icon = <Icons.Bookmark className="w-4 h-4" />; }

                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors md:gap-2 md:px-5 md:py-2 md:text-sm ${activeTab === tab
                                        ? 'bg-on-surface text-surface shadow-sm'
                                        : 'text-secondary hover:text-primary'
                                        }`}
                                >
                                    {icon} {label}
                                </button>
                            );
                        })}
                    </motion.div>

                    <motion.div variants={itemVariants} className="flex w-full flex-col gap-2 md:flex-row 2xl:w-auto">
                        <div className="relative w-full bg-surface-container-lowest rounded-full shadow-inner ring-1 ring-outline/10 md:w-72">
                            <Icons.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-secondary opacity-60" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên, ghi chú, địa chỉ..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent text-sm text-on-surface rounded-full pl-11 pr-4 py-2.5 focus:ring-2 focus:ring-primary/50 transition-all font-medium outline-none"
                            />
                        </div>
                        <SortSelect<NotebookPlaceSortKey> value={sortBy} options={NOTEBOOK_PLACE_SORT_OPTIONS} onChange={setSortBy} className="w-full bg-surface-container-lowest shadow-inner ring-1 ring-outline/10 md:w-auto" />
                    </motion.div>
                </div>

                <div className="mb-5 flex justify-start md:mb-6">
                    <div className="flex bg-surface rounded-xl overflow-hidden editorial-shadow border border-outline/10 text-xs font-bold">
                        <button onClick={() => setViewMode('grid')} className={`flex items-center gap-2 px-3 py-2.5 transition-colors md:px-4 md:py-3 ${viewMode === 'grid' ? 'bg-primary text-on-primary' : 'hover:bg-surface-variant text-secondary'}`}>
                            <Icons.LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Lưới</span>
                        </button>
                        <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-3 py-2.5 transition-colors md:px-4 md:py-3 ${viewMode === 'list' ? 'bg-primary text-on-primary' : 'hover:bg-surface-variant text-secondary'}`}>
                            <Icons.List className="w-4 h-4" /> <span className="hidden sm:inline">Danh sách</span>
                        </button>
                    </div>
                </div>

                <div className={`mt-2 ${viewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3' : 'flex flex-col gap-3 md:gap-4'}`}>
                    {filteredPlaces.length === 0 ? (
                        <div className="col-span-full py-16 text-center bg-surface-container-lowest rounded-[2rem] border border-dashed border-outline-variant/60">
                            <Icons.MapPin className="w-12 h-12 text-outline-variant mx-auto mb-4" />
                            <p className="text-secondary font-medium">Chưa có địa điểm nào trong Thư viện.</p>
                            <p className="text-xs text-on-surface-variant mt-2 max-w-sm mx-auto">Lưu nhà hàng, khách sạn và điểm tham quan để tái sử dụng cho các chuyến đi sau.</p>
                        </div>
                    ) : (
                        filteredPlaces.map(place => {
                            const isSelected = selectedIds.includes(place.id);
                            const placeNotebook = notebooks.find(n => n.id === place.notebookId);
                            const notebookName = placeNotebook?.name || 'Cá nhân';
                            const canEditPlace = canWriteLibrary && (placeNotebook?.permissions.canEditPlaces ?? false);
                            const usedTripCount = usageByPlace.get(place.id)?.size ?? 0;
                            const linkedTripNames = trips.filter((trip) => usageByPlace.get(place.id)?.has(trip.id)).map((trip) => trip.title);
                            const typeIcon = place.type === 'hotel' ? <Icons.Hotel className="w-5 h-5" />
                                : place.type === 'restaurant' ? <Icons.Utensils className="w-5 h-5" />
                                    : place.type === 'cafe' ? <Icons.MapPin className="w-5 h-5" />
                                        : place.type === 'entertainment' ? <Icons.Star className="w-5 h-5" />
                                            : <Icons.Bookmark className="w-5 h-5" />;

                            if (viewMode === 'list') {
                                return (
                                    <motion.div
                                        variants={itemVariants}
                                        key={place.id}
                                        onClick={() => isSelectMode ? toggleSelectPlace(place.id) : null}
                                        className={`group flex flex-col gap-3 rounded-2xl border bg-surface-container-lowest px-4 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-lg md:flex-row md:items-center ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/20'}`}
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            {place.coverImage ? (
                                                <img src={place.coverImage} className="h-14 w-14 shrink-0 rounded-xl object-cover" alt={place.name} loading="lazy" decoding="async" />
                                            ) : (
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    {typeIcon}
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                    <h3 className="truncate font-headline text-base font-bold text-on-surface md:text-lg">{place.name}</h3>
                                                    {activeNotebookId === 'all' && (
                                                        <span className="shrink-0 rounded-md bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                                                            {notebookName}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-secondary">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant/50 px-2 py-1 text-primary">
                                                        {Array.from({ length: 5 }).map((_, i) => (
                                                            <Icons.Star key={i} className={`h-3 w-3 ${i < place.rating ? 'fill-current' : 'fill-none text-outline-variant'}`} />
                                                        ))}
                                                        {place.rating}.0
                                                    </span>
                                                    {place.address && (
                                                        <span className="inline-flex min-w-0 items-center gap-1">
                                                            <Icons.MapPin className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="truncate md:max-w-[36rem]">{place.address}</span>
                                                        </span>
                                                    )}
                                                    {place.phone && (
                                                        <span className="inline-flex items-center gap-1">
                                                            <Icons.Phone className="h-3.5 w-3.5" />
                                                            {place.phone}
                                                        </span>
                                                    )}
                                                </div>
                                                {place.note && (
                                                    <p className="mt-1 line-clamp-1 text-xs italic text-on-surface-variant">"{place.note}"</p>
                                                )}
                                                <p className="mt-1 text-xs text-secondary">Đã dùng trong {usedTripCount} chuyến đi</p>
                                                {linkedTripNames.length > 0 && <p className="mt-1 truncate text-xs text-secondary" title={linkedTripNames.join(', ')}>{linkedTripNames.join(' · ')}</p>}
                                            </div>
                                        </div>

                                        {(place.customFields && place.customFields.length > 0) && (
                                            <div className="hidden max-w-xs shrink-0 gap-2 lg:flex">
                                                {place.customFields.slice(0, 2).map((field, idx) => (
                                                    <div key={idx} className="rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                                                        <p className="font-bold uppercase tracking-wide text-secondary">{field.label}</p>
                                                        <p className="line-clamp-1 font-medium text-on-surface">{field.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className={`flex shrink-0 items-center gap-1 ${isSelectMode ? 'opacity-100' : 'md:opacity-0 md:group-hover:opacity-100'} transition-opacity`}>
                                            {isSelectMode ? (
                                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${isSelected ? 'bg-primary text-on-primary' : 'border border-outline/30 bg-surface-container text-transparent'}`}>
                                                    <Icons.Check className="h-5 w-5" />
                                                </div>
                                            ) : (
                                                <>
                                                    {editableTrips.length > 0 && <button aria-label={`Thêm ${place.name} vào chuyến đi`} onClick={(e) => { e.stopPropagation(); setPlaceToTrip(place); }} className="flex size-9 items-center justify-center rounded-lg bg-surface-container text-secondary hover:text-primary" title="Thêm vào chuyến đi"><Icons.PlusCircle className="size-4" /></button>}
                                                    {canEditPlace && <button aria-label={`Sửa địa điểm ${place.name}`} onClick={(e) => { e.stopPropagation(); handleOpenForm(place); }} className="flex size-9 items-center justify-center rounded-lg bg-surface-container text-secondary transition-colors hover:bg-surface-variant hover:text-primary" title="Sửa">
                                                        <Icons.Edit2 className="h-4 w-4" />
                                                    </button>}
                                                    {canEditPlace && <button aria-label={`Xóa địa điểm ${place.name}`} onClick={(e) => { e.stopPropagation(); handleDelete(place.id, place.name); }} className="flex size-9 items-center justify-center rounded-lg bg-error-container/20 text-error transition-colors hover:bg-error hover:text-white" title="Xóa">
                                                        <Icons.Trash2 className="h-4 w-4" />
                                                    </button>}
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            }

                            return (
                                <motion.div variants={itemVariants} key={place.id}
                                    onClick={() => isSelectMode ? toggleSelectPlace(place.id) : null}
                                    className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.25rem] border bg-surface-container-lowest transition-all hover:-translate-y-1 hover:shadow-xl md:rounded-[1.5rem] ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/20'}`}>

                                    <div className="flex flex-1 flex-col p-4 md:p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex bg-primary/10 text-primary p-3 rounded-xl mt-1 shrink-0 group-hover:scale-110 transition-transform">
                                                {typeIcon}
                                            </div>
                                            <div className={`flex gap-1.5 transition-opacity ${isSelectMode ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                                                {isSelectMode ? (
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline/30 text-transparent'}`}>
                                                        <Icons.Check className="w-5 h-5" />
                                                    </div>
                                                ) : (
                                                    <>
                                                        {editableTrips.length > 0 && <button aria-label={`Thêm ${place.name} vào chuyến đi`} title="Thêm vào chuyến đi" onClick={(e) => { e.stopPropagation(); setPlaceToTrip(place); }} className="flex size-8 items-center justify-center rounded-lg bg-surface-container text-secondary hover:text-primary"><Icons.PlusCircle className="size-4" /></button>}
                                                        {canEditPlace && <button aria-label={`Sửa địa điểm ${place.name}`} title="Sửa địa điểm" onClick={(e) => { e.stopPropagation(); handleOpenForm(place); }} className="w-8 h-8 flex items-center justify-center bg-surface-container hover:bg-surface-variant hover:text-primary text-secondary rounded-lg transition-colors">
                                                            <Icons.Edit2 className="w-4 h-4" />
                                                        </button>}
                                                        {canEditPlace && <button aria-label={`Xóa địa điểm ${place.name}`} title="Xóa địa điểm" onClick={(e) => { e.stopPropagation(); handleDelete(place.id, place.name); }} className="w-8 h-8 flex items-center justify-center bg-error-container/20 hover:bg-error text-error hover:text-white rounded-lg transition-colors">
                                                            <Icons.Trash2 className="w-4 h-4" />
                                                        </button>}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h3 className="font-headline text-lg font-bold text-on-surface md:text-xl">{place.name}</h3>
                                                {activeNotebookId === 'all' && (
                                                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-surface-container-high text-secondary px-2 py-1 rounded-md">
                                                        {notebookName}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mb-3 text-xs text-secondary">Đã dùng trong {usedTripCount} chuyến đi</p>
                                            {linkedTripNames.length > 0 && <p className="-mt-2 mb-3 truncate text-xs text-secondary" title={linkedTripNames.join(', ')}>{linkedTripNames.join(' · ')}</p>}

                                            <div className={`flex ${viewMode === 'grid' ? 'flex-col' : 'flex-row gap-6'} w-full`}>
                                                {place.coverImage && (
                                                    <div className={`${viewMode === 'grid' ? 'h-32 mb-4 w-full -mt-2' : 'h-24 w-24 shrink-0 rounded-xl'} rounded-xl overflow-hidden bg-surface-variant/30 flex items-center justify-center`}>
                                                        <img src={place.coverImage} className="w-full h-full object-cover" alt={place.name} loading="lazy" decoding="async" />
                                                    </div>
                                                )}
                                                <div className="flex-1 flex flex-col items-start min-w-0">
                                                    <div className="flex items-center gap-2 bg-surface-variant/50 px-3 py-1.5 rounded-lg mb-4 text-xs font-bold text-secondary flex-wrap">
                                                        {Array.from({ length: 5 }).map((_, i) => (
                                                            <Icons.Star key={i} className={`w-3.5 h-3.5 ${i < place.rating ? 'fill-current' : 'text-outline-variant'} ${i < place.rating ? '' : 'fill-none'}`} />
                                                        ))}
                                                        <span className="text-[10px] ml-1 font-bold">{place.rating}.0</span>
                                                    </div>

                                                    {place.address && (
                                                        <p className="text-sm text-secondary flex items-start gap-2 mb-2 line-clamp-2">
                                                            <Icons.MapPin className="w-4 h-4 shrink-0 translate-y-0.5" />
                                                            {place.address}
                                                        </p>
                                                    )}

                                                    {place.phone && (
                                                        <p className="text-sm text-secondary flex items-center gap-2 mb-2">
                                                            <Icons.Phone className="w-4 h-4 shrink-0" />
                                                            {place.phone}
                                                        </p>
                                                    )}
                                                </div>

                                                {(place.note || (place.customFields && place.customFields.length > 0)) && (
                                                    <div className="mt-4 pt-4 border-t border-dashed border-outline-variant/40 space-y-3">
                                                        {place.note && (
                                                            <p className="text-xs text-on-surface-variant italic leading-relaxed line-clamp-3">"{place.note}"</p>
                                                        )}
                                                        {place.customFields && place.customFields.map((field, idx) => (
                                                            <div key={idx} className="flex justify-between items-start flex-col text-xs bg-surface-variant/30 p-2 rounded-lg">
                                                                <span className="font-semibold text-secondary uppercase tracking-tight mb-1">{field.label}</span>
                                                                <span className="font-medium text-on-surface whitespace-pre-wrap">{field.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
                </div>
            </motion.div>

            {
                isSelectMode && selectedIds.length > 0 && (
                    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] left-1/2 z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-outline/10 bg-surface-container-highest px-4 py-3 shadow-2xl md:bottom-6 md:w-auto md:justify-start md:gap-6 md:rounded-full md:px-6 md:py-4">
                        <span className="font-bold text-on-surface shrink-0">{selectedIds.length} mục đã chọn</span>

                        <div className="flex min-w-0 items-center gap-2">
                            <button onClick={() => {
                                if (selectedIds.length === filteredPlaces.length) { setSelectedIds([]); }
                                else { setSelectedIds(filteredPlaces.map(p => p.id)); }
                            }} className="rounded-full px-3 py-2 text-sm font-bold text-secondary transition-colors hover:bg-surface hover:text-on-surface md:px-4">
                                {selectedIds.length === filteredPlaces.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                            </button>
                            <button onClick={async () => {
                                const ok = await confirm({ title: 'Xóa hàng loạt', message: `Xóa ${selectedIds.length} địa điểm khỏi Thư viện?`, confirmLabel: 'Xóa', tone: 'danger' });
                                if (ok) {
                                    try {
                                        await bulkDeleteNotebookPlaces(selectedIds);
                                        if (!isRemoteMode) {
                                            await Promise.all(savedPlaces
                                                .filter((place) => place.sourceNotebookPlaceId && selectedIds.includes(place.sourceNotebookPlaceId))
                                                .map((place) => editSavedPlace(place.id, { sourceNotebookPlaceId: undefined })));
                                        }
                                        setIsSelectMode(false);
                                        setSelectedIds([]);
                                    } catch (error) {
                                        showToast({ tone: 'error', title: 'Không thể xóa địa điểm', message: error instanceof Error ? error.message : 'Hãy thử lại.' });
                                    }
                                }
                            }} className="flex items-center gap-2 rounded-full bg-error px-3 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 md:px-4">
                                <Icons.Trash2 className="w-4 h-4" />
                                Xóa {selectedIds.length}
                            </button>
                        </div>
                    </div>
                )
            }

            <Modal isOpen={Boolean(placeToTrip)} onClose={() => setPlaceToTrip(null)} title="Thêm địa điểm vào chuyến đi">
                {placeToTrip && <form className="space-y-4" onSubmit={async (event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const tripId = String(data.get('tripId') || '');
                    const createActivity = data.get('createActivity') === 'on';
                    try {
                        await addLibraryPlaceToTrip({
                            tripId,
                            notebookPlaceId: placeToTrip.id,
                            place: { name: placeToTrip.name, type: placeToTrip.type, phone: placeToTrip.phone, address: placeToTrip.address, rating: placeToTrip.rating, note: placeToTrip.note },
                            createActivity,
                            date: createActivity ? String(data.get('date') || '') : undefined,
                            time: String(data.get('time') || '09:00'),
                        });
                        showToast({ tone: 'success', title: 'Đã thêm vào chuyến đi', message: 'Bản sao trong chuyến đi giữ liên kết về Thư viện.' });
                        setPlaceToTrip(null);
                    } catch (error) {
                        showToast({ tone: 'error', title: 'Không thể thêm địa điểm', message: error instanceof Error ? error.message : 'Hãy thử lại.' });
                    }
                }}>
                    <label className="block text-sm font-semibold">Chuyến đi<select name="tripId" required className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3">{editableTrips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
                    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" name="createActivity" />Đồng thời tạo hoạt động lúc 09:00</label>
                    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Ngày<input name="date" type="date" className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3" /></label><label className="text-sm font-semibold">Giờ<input name="time" type="time" defaultValue="09:00" className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3" /></label></div>
                    <button type="submit" className="min-h-11 w-full rounded-xl bg-primary px-4 font-semibold text-on-primary">Thêm vào chuyến đi</button>
                </form>}
            </Modal>

            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={editingPlace ? "Sửa thông tin địa điểm" : "Lưu địa điểm mới"}>
                <form onSubmit={handleSavePlace} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Tên địa điểm / Quán</label>
                        <input required name="name" defaultValue={editingPlace?.name} className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-secondary mb-1">Danh mục</label>
                            <select name="type" defaultValue={editingPlace?.type || 'restaurant'} className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none appearance-none font-medium">
                                <option value="hotel">Khách sạn / Chỗ ở</option>
                                <option value="restaurant">Nhà hàng / Quán ăn</option>
                                <option value="cafe">Quán Cafe</option>
                                <option value="entertainment">Vui chơi / Trải nghiệm</option>
                                <option value="other">Khác</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-secondary mb-1">Đánh giá sao</label>
                            <div className="pt-1">
                                <StarRatingInput name="rating" defaultValue={editingPlace?.rating || 5} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Địa chỉ (Tùy chọn)</label>
                        <input name="address" defaultValue={editingPlace?.address} placeholder="Phố, quận, phường..." className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Số điện thoại (Tùy chọn)</label>
                        <input name="phone" defaultValue={editingPlace?.phone} className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none" />
                    </div>

                    <div className="bg-surface-container-lowest p-4 rounded-2xl border border-dashed border-outline/30 flex flex-col gap-4">
                        <label className="block text-xs font-bold uppercase text-secondary">Trường thông tin tùy biến (Sáng tạo thuộc tính)</label>
                        {customFields.map((field, idx) => (
                            <div key={idx} className="relative bg-surface-container p-4 rounded-xl border border-outline/10 group">
                                <input
                                    placeholder="TÊN TRƯỜNG (Ví dụ: GIÁ VÉ HOẶC MÓN ĂN GỢI Ý)"
                                    value={field.label}
                                    onChange={(e) => {
                                        const next = [...customFields];
                                        next[idx].label = e.target.value;
                                        setCustomFields(next);
                                    }}
                                    className="w-full bg-transparent text-[11px] font-black uppercase text-secondary tracking-widest outline-none mb-2 placeholder:text-outline-variant"
                                />
                                <div className="flex items-center bg-surface-container-low rounded-lg p-3 ring-1 ring-outline/10 focus-within:ring-primary">
                                    <textarea
                                        rows={2}
                                        placeholder="Nhập thông tin nội dung..."
                                        value={field.value}
                                        onChange={(e) => {
                                            const next = [...customFields];
                                            next[idx].value = e.target.value;
                                            setCustomFields(next);
                                        }}
                                        className="w-full bg-transparent text-sm text-on-surface outline-none resize-none"
                                    />
                                </div>
                                <button type="button" onClick={() => setCustomFields(customFields.filter((_, i) => i !== idx))} className="absolute top-3 right-3 text-secondary/50 hover:text-error bg-surface rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity editorial-shadow">
                                    <Icons.Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => setCustomFields([...customFields, { label: '', value: '' }])} className="w-full py-3 bg-surface-container hover:bg-surface-variant transition-colors rounded-xl text-xs font-bold text-primary flex items-center justify-center gap-2 border border-outline/10">
                            <Icons.Plus className="w-3.5 h-3.5" /> Thêm trường tùy biến mới
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Ghi chú & Trải nghiệm thực tế (Tùy chọn)</label>
                        <textarea name="note" rows={3} defaultValue={editingPlace?.note} placeholder="Nhớ nhắc nhân viên không bỏ hành..." className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none"></textarea>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Ảnh bìa địa điểm</label>
                        <div className="relative border-2 border-dashed border-outline/30 rounded-xl bg-surface-container-low overflow-hidden hover:bg-surface-variant/50 transition-colors group">
                            {coverImage ? (
                                <div className="relative h-32 w-full">
                                    <img src={coverImage} className="w-full h-full object-cover" alt="Cover preview" />
                                    <button type="button" onClick={(e) => { e.preventDefault(); setCoverImage(undefined); }} className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-error transition-colors">
                                        <Icons.X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center p-6 w-full cursor-pointer h-32">
                                    {isUploading ? (
                                        <Icons.Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    ) : (
                                        <>
                                            <Icons.Upload className="w-6 h-6 text-on-surface-variant group-hover:text-primary transition-colors mb-2" />
                                            <span className="text-sm font-medium text-secondary">Chọn hoặc Upload ảnh</span>
                                        </>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadCover} disabled={isUploading} />
                                </label>
                            )}
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-primary text-on-primary py-4 rounded-xl font-headline font-bold text-base hover:-translate-y-0.5 transition-transform active:scale-95 shadow-md">
                        Lưu vào Thư viện
                    </button>
                </form>
            </Modal>

            <Modal isOpen={isCreateNbOpen} onClose={() => setIsCreateNbOpen(false)} title="Tạo bộ sưu tập chung mới">
                <form onSubmit={handleCreateNotebook} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Tên bộ sưu tập</label>
                        <input required value={createNbName} onChange={e => setCreateNbName(e.target.value)} placeholder="Ví dụ: Hội yêu trà sữa..." className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Mời thành viên (Email) - Tùy chọn</label>
                        <input type="email" value={createNbInvite} onChange={e => setCreateNbInvite(e.target.value)} placeholder="email@example.com" className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-md">
                        Tạo bộ sưu tập
                    </button>
                </form>
            </Modal>

            <Modal isOpen={isRenameNbOpen} onClose={() => setIsRenameNbOpen(false)} title="Đổi tên bộ sưu tập">
                {activeNotebook && <form className="space-y-4" onSubmit={async (event) => {
                    event.preventDefault();
                    const name = String(new FormData(event.currentTarget).get('name') || '');
                    const result = await editNotebook(activeNotebook.id, name);
                    if (!result.success) {
                        showToast({ tone: 'error', title: 'Không thể đổi tên', message: result.error });
                        return;
                    }
                    setIsRenameNbOpen(false);
                    showToast({ tone: 'success', title: 'Đã đổi tên bộ sưu tập' });
                }}>
                    <label className="block text-sm font-semibold">Tên bộ sưu tập<input name="name" required defaultValue={activeNotebook.name} className="mt-2 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3" /></label>
                    <button type="submit" className="min-h-11 w-full rounded-xl bg-primary px-4 font-bold text-on-primary">Lưu tên mới</button>
                </form>}
            </Modal>

            <Modal isOpen={isInviteOpen} onClose={() => { if (!isInviting) setIsInviteOpen(false); }} title={`Mời thành viên vào "${notebooks.find(n => n.id === activeNotebookId)?.name || 'Bộ sưu tập'}"`}>
                <form onSubmit={handleInviteMember} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Email thành viên</label>
                        <input
                            required
                            type="email"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            placeholder="email@example.com"
                            className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none"
                            disabled={isInviting}
                        />
                    </div>
                    <div><label className="mb-1 block text-xs font-bold text-secondary">Vai trò</label><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)} className="min-h-11 w-full rounded-xl border border-outline/20 bg-surface-container-low px-4"><option value="admin">Admin · quản lý thành viên</option><option value="editor">Editor · sửa địa điểm</option><option value="viewer">Viewer · chỉ xem</option></select></div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                        Quyền của thành viên được áp dụng cho toàn bộ địa điểm trong bộ sưu tập này.
                    </p>
                    <button
                        type="submit"
                        disabled={isInviting}
                        className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isInviting ? (
                            <><Icons.Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...</>
                        ) : (
                            <><Icons.UserPlus className="w-4 h-4" /> Gửi lời mời</>
                        )}
                    </button>
                </form>
                {activeNotebook?.permissions.canManageMembers && <div className="mt-6 border-t border-outline-variant pt-5">
                    <h3 className="font-headline text-lg font-bold">Thành viên hiện tại</h3>
                    <div className="mt-3 space-y-2">
                        {notebookMembers.filter((member) => member.notebookId === activeNotebookId).map((member) => (
                            <div key={member.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low p-3">
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.displayName || member.email || member.userId}</span>
                                {member.role === 'owner' ? <span className="text-sm font-semibold">Chủ sở hữu</span> : <>
                                    <select aria-label={`Vai trò của ${member.displayName || member.userId}`} value={member.role} onChange={async (event) => {
                                        try { await updateNotebookMemberRole(member.id, event.target.value as 'admin' | 'editor' | 'viewer'); }
                                        catch (error) { showToast({ tone: 'error', title: 'Không thể đổi vai trò', message: error instanceof Error ? error.message : 'Hãy thử lại.' }); }
                                    }} className="min-h-10 rounded-lg border border-outline-variant bg-surface px-2 text-sm">
                                        <option value="admin">Quản trị</option><option value="editor">Chỉnh sửa</option><option value="viewer">Chỉ xem</option>
                                    </select>
                                    {activeNotebook.membershipRole === 'owner' && <button type="button" title="Chuyển quyền sở hữu" aria-label={`Chuyển quyền sở hữu cho ${member.displayName || member.userId}`} onClick={async () => {
                                        const approved = await confirm({ title: 'Chuyển quyền sở hữu?', message: 'Bạn sẽ trở thành quản trị viên và thành viên này sẽ có toàn quyền với Thư viện.', confirmLabel: 'Chuyển quyền' });
                                        if (!approved) return;
                                        try { await transferNotebookOwnership(member.id); showToast({ tone: 'success', title: 'Đã chuyển quyền sở hữu' }); }
                                        catch (error) { showToast({ tone: 'error', title: 'Không thể chuyển quyền', message: error instanceof Error ? error.message : 'Hãy thử lại.' }); }
                                    }} className="flex size-10 items-center justify-center rounded-lg text-primary hover:bg-primary/10"><Icons.UserCheck className="size-4" /></button>}
                                    <button type="button" aria-label={`Xóa ${member.displayName || member.userId} khỏi Thư viện`} onClick={async () => {
                                        try { await removeNotebookMember(member.id); }
                                        catch (error) { showToast({ tone: 'error', title: 'Không thể xóa thành viên', message: error instanceof Error ? error.message : 'Hãy thử lại.' }); }
                                    }} className="flex size-10 items-center justify-center rounded-lg text-error hover:bg-error-container"><Icons.Trash2 className="size-4" /></button>
                                </>}
                            </div>
                        ))}
                    </div>
                </div>}
            </Modal>
        </React.Fragment>
    );
}

function LibraryState({ icon, title, message, action }: { icon: React.ReactNode; title: string; message: string; action?: () => void }) {
    return (
        <section className="mx-auto mt-12 max-w-xl rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-8 text-center" role="status">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</span>
            <h1 className="mt-4 font-headline text-2xl font-bold">{title}</h1>
            <p className="mt-2 text-pretty text-sm text-secondary">{message}</p>
            {action && <button type="button" onClick={action} className="mt-5 min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary">Thử lại</button>}
        </section>
    );
}
