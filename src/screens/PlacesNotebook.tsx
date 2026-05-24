import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Icons } from '../components/Icons';
import { useNotebook, NotebookPlace } from '../context/NotebookContext';
import { useFeedback } from '../context/FeedbackContext';
import { Modal } from '../components/Modal';
import { useSettings } from '../context/SettingsContext';
import { StarRatingInput } from '../components/StarRatingInput';
import { SortSelect } from '../components/SortSelect';
import { chainComparators, compareDate, compareNumber, compareText, stableSort, type SortOption } from '../utils/listSort';

type NotebookPlaceSortKey = 'createdDesc' | 'createdAsc' | 'ratingDesc' | 'ratingAsc' | 'nameAsc' | 'nameDesc' | 'typeAsc';

const NOTEBOOK_PLACE_SORT_OPTIONS: Array<SortOption<NotebookPlaceSortKey>> = [
    { value: 'createdDesc', label: 'Mới nhất' },
    { value: 'createdAsc', label: 'Cũ nhất' },
    { value: 'ratingDesc', label: 'Đánh giá cao nhất' },
    { value: 'ratingAsc', label: 'Đánh giá thấp nhất' },
    { value: 'nameAsc', label: 'Tên A-Z' },
    { value: 'nameDesc', label: 'Tên Z-A' },
    { value: 'typeAsc', label: 'Loại địa điểm' },
];
export function PlacesNotebook() {
    const { notebooks, addNotebook, deleteNotebook, notebookPlaces, addNotebookPlace, editNotebookPlace, deleteNotebookPlace, bulkDeleteNotebookPlaces, inviteToNotebook } = useNotebook();
    const { showToast, confirm } = useFeedback();
    const { uiDensity } = useSettings();

    const [activeTab, setActiveTab] = useState<'all' | 'hotel' | 'restaurant' | 'cafe' | 'entertainment' | 'other'>('all');
    const [activeNotebookId, setActiveNotebookId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingPlace, setEditingPlace] = useState<NotebookPlace | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<NotebookPlaceSortKey>('createdDesc');

    const [isCreateNbOpen, setIsCreateNbOpen] = useState(false);
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
    const [isInviting, setIsInviting] = useState(false);

    const filteredPlaces = useMemo(() => {
        let list = notebookPlaces;
        if (activeNotebookId !== 'all') {
            list = list.filter(p => p.notebookId === activeNotebookId);
        }
        if (activeTab !== 'all') {
            list = list.filter(p => p.type === activeTab);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.address?.toLowerCase().includes(q)) ||
                (p.note?.toLowerCase().includes(q)) ||
                (p.customFields?.some(c => c.value.toLowerCase().includes(q)))
            );
        }
        const fallbackSort = (a: NotebookPlace, b: NotebookPlace) => compareText(a.name, b.name, 'asc');
        const sortComparator = (a: NotebookPlace, b: NotebookPlace) => {
            switch (sortBy) {
                case 'createdAsc': return compareDate(a.createdAt, b.createdAt, 'asc');
                case 'ratingDesc': return compareNumber(a.rating, b.rating, 'desc');
                case 'ratingAsc': return compareNumber(a.rating, b.rating, 'asc');
                case 'nameAsc': return compareText(a.name, b.name, 'asc');
                case 'nameDesc': return compareText(a.name, b.name, 'desc');
                case 'typeAsc': return compareText(a.type, b.type, 'asc');
                case 'createdDesc':
                default: return compareDate(a.createdAt, b.createdAt, 'desc');
            }
        };
        return stableSort(list, chainComparators(sortComparator, fallbackSort));
    }, [notebookPlaces, activeTab, searchQuery, activeNotebookId, sortBy]);

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
            showToast({ tone: 'info', title: 'Hướng dẫn', message: 'Vui lòng chọn 1 sổ tay cụ thể ở menu trên cùng để thêm thành viên.' });
            return;
        }
        const activeNB = notebooks.find(n => n.id === activeNotebookId);
        if (activeNB?.type === 'personal') {
            showToast({ tone: 'info', title: 'Sổ tay cá nhân', message: 'Đây là sổ tay mặc định, không thể mời thêm người. Hãy chọn một sổ tay nhóm.' });
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
            const result = await inviteToNotebook(activeNotebookId, inviteEmail.trim());
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
            title: `Xóa sổ tay "${activeNB.name}"?`,
            message: `Tất cả ${placesCount} địa điểm trong sổ tay này sẽ bị xóa vĩnh viễn. Thành viên và lời mời cũng sẽ bị hủy.`,
            confirmLabel: 'Xóa vĩnh viễn',
            cancelLabel: 'Giữ lại',
            tone: 'danger',
        });
        if (!shouldDelete) return;

        const result = await deleteNotebook(activeNotebookId);
        if (result.success) {
            setActiveNotebookId('all');
            showToast({ tone: 'success', title: 'Đã xóa', message: `Sổ tay "${activeNB.name}" đã được xóa.` });
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
                        title: 'Đã tạo sổ tay',
                        message: `Sổ "${createNbName}" đã sẵn sàng. ${inviteResult.success ? 'Đã gửi lời mời.' : inviteResult.error || ''}`
                    });
                } else {
                    showToast({ tone: 'success', title: 'Đã tạo sổ tay', message: `Sổ "${createNbName}" đã sẵn sàng.` });
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
            showToast({ tone: 'danger', title: 'Lỗi tải ảnh', message: err.message || 'Thử lại sau.' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        const ok = await confirm({
            title: 'Xóa ' + name,
            message: 'Địa điểm này sẽ bị xóa khỏi cẩm nang chung.',
            confirmLabel: 'Xóa',
            cancelLabel: 'Giữ lại',
            tone: 'danger'
        });
        if (ok) {
            deleteNotebookPlace(id);
        }
    };

    const toggleSelectPlace = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
    const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.25 } } };

    return (
        <React.Fragment>
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="px-4 py-4 md:px-8 md:py-8 max-w-7xl mx-auto mb-24">

                <motion.div variants={itemVariants} className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end mb-8 relative">
                    <div className="absolute -top-10 left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl -z-10 mt-10"></div>
                    <div>
                        <p className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-2">My Global Places</p>
                        <h1 className="font-headline text-3xl md:text-5xl font-extrabold tracking-tighter text-on-surface">Cẩm Nang Địa Điểm</h1>
                        <p className="text-sm mt-3 max-w-md text-on-surface-variant leading-relaxed hidden md:block">
                            Nơi bạn lưu trữ mọi nhà hàng, khách sạn, quán cafe tuyệt vời hoặc điểm vui chơi để chuẩn bị cho bất kỳ chuyến đi nào trong tương lai.
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <select
                            value={activeNotebookId}
                            onChange={e => setActiveNotebookId(e.target.value)}
                            className="bg-surface-container-low hover:bg-surface border border-outline/10 editorial-shadow text-on-surface font-bold text-sm px-4 py-3 rounded-2xl outline-none transition-colors"
                        >
                            <option value="all">📚 Tất cả sổ tay</option>
                            {notebooks.map(nb => (
                                <option key={nb.id} value={nb.id}>
                                    {nb.type === 'personal' ? '👤' : '👥'} {nb.name}
                                </option>
                            ))}
                        </select>

                        <div className="flex flex-wrap bg-surface-container-low p-1 rounded-2xl editorial-shadow border border-outline/10 gap-0.5">
                            <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds([]); }} className={`px-4 h-10 rounded-xl font-bold flex items-center gap-2 transition-all ${isSelectMode ? 'bg-primary text-on-primary' : 'hover:bg-primary/10 text-secondary hover:text-primary active:scale-95'}`} title="Chọn nhiều">
                                <Icons.CheckSquare className="w-4 h-4" />
                                <span className="hidden md:inline">{isSelectMode ? 'Hủy chọn' : 'Chọn'}</span>
                            </button>
                            <div className="w-[1px] bg-outline/20 my-2 mx-1"></div>
                            <button onClick={handleShare} className="hover:bg-primary/10 text-secondary hover:text-primary active:scale-95 px-4 h-10 rounded-xl font-bold flex items-center gap-2 transition-all">
                                <Icons.UserPlus className="w-4 h-4" />
                                <span className="hidden sm:inline">Mời</span>
                            </button>
                            <div className="w-[1px] bg-outline/20 my-2 mx-1"></div>
                            <button onClick={() => setIsCreateNbOpen(true)} className="hover:bg-primary/10 text-secondary hover:text-primary active:scale-95 px-4 h-10 rounded-xl font-bold flex items-center gap-2 transition-all" title="Tạo sổ tay mới">
                                <Icons.FolderPlus className="w-4 h-4" />
                            </button>
                            {activeNotebookId !== 'all' && notebooks.find(n => n.id === activeNotebookId)?.type === 'shared' && (
                                <>
                                    <div className="w-[1px] bg-outline/20 my-2 mx-1"></div>
                                    <button onClick={handleDeleteNotebook} className="hover:bg-error/10 text-secondary hover:text-error active:scale-95 px-4 h-10 rounded-xl font-bold flex items-center gap-2 transition-all" title="Xóa sổ tay này">
                                        <Icons.Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                            <button onClick={() => handleOpenForm()} className="bg-primary text-on-primary hover:scale-105 active:scale-95 px-5 h-10 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md ml-1">
                                <Icons.Plus className="w-4 h-4 mt-0.5" />
                            </button>
                        </div>
                    </div>
                </motion.div>

                <div className="flex flex-col md:flex-row gap-4 mb-10 justify-between items-start md:items-center bg-surface-container-low p-2 rounded-2xl md:rounded-full border border-outline-variant/30">
                    <motion.div variants={itemVariants} className="flex gap-2 overflow-x-auto no-scrollbar max-w-full">
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
                                    className={`px-5 py-2 font-bold text-sm rounded-full whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === tab
                                        ? 'bg-on-surface text-surface shadow-sm'
                                        : 'text-secondary hover:text-primary'
                                        }`}
                                >
                                    {icon} {label}
                                </button>
                            );
                        })}
                    </motion.div>

                    <motion.div variants={itemVariants} className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
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
                        <SortSelect value={sortBy} options={NOTEBOOK_PLACE_SORT_OPTIONS} onChange={setSortBy} className="bg-surface-container-lowest shadow-inner ring-1 ring-outline/10" />
                    </motion.div>
                </div>

                <div className="flex justify-start mb-6">
                    <div className="flex bg-surface rounded-xl overflow-hidden editorial-shadow border border-outline/10 text-xs font-bold">
                        <button onClick={() => setViewMode('grid')} className={`px-4 py-3 flex items-center gap-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-on-primary' : 'hover:bg-surface-variant text-secondary'}`}>
                            <Icons.LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Lưới</span>
                        </button>
                        <button onClick={() => setViewMode('list')} className={`px-4 py-3 flex items-center gap-2 transition-colors ${viewMode === 'list' ? 'bg-primary text-on-primary' : 'hover:bg-surface-variant text-secondary'}`}>
                            <Icons.List className="w-4 h-4" /> <span className="hidden sm:inline">Danh sách</span>
                        </button>
                    </div>
                </div>

                <div className={`mt-2 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'flex flex-col gap-4'}`}>
                    {filteredPlaces.length === 0 ? (
                        <div className="col-span-full py-16 text-center bg-surface-container-lowest rounded-[2rem] border border-dashed border-outline-variant/60">
                            <Icons.MapPin className="w-12 h-12 text-outline-variant mx-auto mb-4" />
                            <p className="text-secondary font-medium">Chưa có địa điểm nào trong Cẩm nang.</p>
                            <p className="text-xs text-on-surface-variant mt-2 max-w-sm mx-auto">Hãy sử dụng Cẩm nang để lưu lại những nhà hàng, khách sạn hay để dùng cho các chuyến du lịch sau này nhé.</p>
                        </div>
                    ) : (
                        filteredPlaces.map(place => {
                            const isSelected = selectedIds.includes(place.id);
                            const notebookName = notebooks.find(n => n.id === place.notebookId)?.name || 'Cá nhân';
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
                                                <img src={place.coverImage} className="h-14 w-14 shrink-0 rounded-xl object-cover" alt={place.name} />
                                            ) : (
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    {typeIcon}
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                    <h3 className="truncate font-headline text-lg font-bold text-on-surface">{place.name}</h3>
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
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenForm(place); }} className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container text-secondary transition-colors hover:bg-surface-variant hover:text-primary" title="Sửa">
                                                        <Icons.Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(place.id, place.name); }} className="flex h-9 w-9 items-center justify-center rounded-lg bg-error-container/20 text-error transition-colors hover:bg-error hover:text-white" title="Xóa">
                                                        <Icons.Trash2 className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            }

                            return (
                                <motion.div variants={itemVariants} key={place.id}
                                    onClick={() => isSelectMode ? toggleSelectPlace(place.id) : null}
                                    className={`bg-surface-container-lowest rounded-[1.5rem] editorial-shadow group border relative flex flex-col hover:-translate-y-1 hover:shadow-xl transition-all h-full overflow-hidden cursor-pointer ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/20'}`}>

                                    <div className="p-6 flex-1 flex flex-col">
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
                                                        <button onClick={(e) => { e.stopPropagation(); handleOpenForm(place); }} className="w-8 h-8 flex items-center justify-center bg-surface-container hover:bg-surface-variant hover:text-primary text-secondary rounded-lg transition-colors">
                                                            <Icons.Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(place.id, place.name); }} className="w-8 h-8 flex items-center justify-center bg-error-container/20 hover:bg-error text-error hover:text-white rounded-lg transition-colors">
                                                            <Icons.Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h3 className="font-headline font-bold text-xl text-on-surface">{place.name}</h3>
                                                {activeNotebookId === 'all' && (
                                                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-surface-container-high text-secondary px-2 py-1 rounded-md">
                                                        {notebookName}
                                                    </span>
                                                )}
                                            </div>

                                            <div className={`flex ${viewMode === 'grid' ? 'flex-col' : 'flex-row gap-6'} w-full`}>
                                                {place.coverImage && (
                                                    <div className={`${viewMode === 'grid' ? 'h-32 mb-4 w-full -mt-2' : 'h-24 w-24 shrink-0 rounded-xl'} rounded-xl overflow-hidden bg-surface-variant/30 flex items-center justify-center`}>
                                                        <img src={place.coverImage} className="w-full h-full object-cover" alt={place.name} />
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
            </motion.div>

            {
                isSelectMode && selectedIds.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-container-highest shadow-2xl px-6 py-4 rounded-full flex items-center gap-6 z-50 border border-outline/10">
                        <span className="font-bold text-on-surface shrink-0">{selectedIds.length} mục đã chọn</span>

                        <div className="flex items-center gap-2">
                            <button onClick={() => {
                                if (selectedIds.length === filteredPlaces.length) { setSelectedIds([]); }
                                else { setSelectedIds(filteredPlaces.map(p => p.id)); }
                            }} className="px-4 py-2 hover:bg-surface text-secondary hover:text-on-surface rounded-full text-sm font-bold transition-colors">
                                {selectedIds.length === filteredPlaces.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                            </button>
                            <button onClick={async () => {
                                const ok = await confirm({ title: 'Xóa hàng loạt', message: `Xóa ${selectedIds.length} địa điểm khỏi cẩm nang?`, confirmLabel: 'Xóa', tone: 'danger' });
                                if (ok) {
                                    if (bulkDeleteNotebookPlaces) { bulkDeleteNotebookPlaces(selectedIds); }
                                    setIsSelectMode(false);
                                    setSelectedIds([]);
                                }
                            }} className="px-4 py-2 bg-error text-white rounded-full text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                                <Icons.Trash2 className="w-4 h-4" />
                                Xóa {selectedIds.length}
                            </button>
                        </div>
                    </div>
                )
            }

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
                        Lưu vào Cẩm nang
                    </button>
                </form>
            </Modal>

            <Modal isOpen={isCreateNbOpen} onClose={() => setIsCreateNbOpen(false)} title="Tạo sổ tay chung mới">
                <form onSubmit={handleCreateNotebook} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Tên sổ tay</label>
                        <input required value={createNbName} onChange={e => setCreateNbName(e.target.value)} placeholder="Ví dụ: Hội yêu trà sữa..." className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-secondary mb-1">Mời thành viên (Email) - Tùy chọn</label>
                        <input type="email" value={createNbInvite} onChange={e => setCreateNbInvite(e.target.value)} placeholder="email@example.com" className="w-full rounded-xl bg-surface-container-low border border-outline/20 px-4 py-2 focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-md">
                        Tạo Sổ Tay
                    </button>
                </form>
            </Modal>

            <Modal isOpen={isInviteOpen} onClose={() => { if (!isInviting) setIsInviteOpen(false); }} title={`Mời thành viên vào "${notebooks.find(n => n.id === activeNotebookId)?.name || 'Sổ tay'}"`}>
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
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                        Thành viên được mời sẽ có quyền xem và chỉnh sửa các địa điểm trong sổ tay này.
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
            </Modal>
        </React.Fragment>
    );
}
