import { useParams } from 'react-router-dom';
import type { FormEvent } from 'react';

import { Icons } from '../components/Icons';
import { useAppContext, PackingItem } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { useAuth } from '../context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { CategorySelectWithCreate } from '../components/CategorySelectWithCreate';
import { getErrorMessage } from '../utils/errorMessage';
import { motion } from 'motion/react';
import { fadeUpVariants, pageStaggerVariants } from '../ui/motion';
import { Check } from 'lucide-react';
import { SortSelect } from '../components/SortSelect';
import { chainComparators, compareDate, compareNumber, compareText, stableSort, type SortOption } from '../utils/listSort';
import { mergeCategoryOptions, PACKING_CATEGORY_OPTIONS } from '../utils/tripCategories';

const PACKING_PRESETS = [
  {
    id: 'beach',
    name: 'Biển đảo',
    icon: '🏝️',
    items: [
      { name: 'Đồ bơi', category: 'clothes' },
      { name: 'Kính râm / Kính bơi', category: 'clothes' },
      { name: 'Kem chống nắng', category: 'toiletries' },
      { name: 'Dép xỏ ngón', category: 'clothes' },
      { name: 'Mũ rộng vành', category: 'clothes' },
      { name: 'Khăn tắm', category: 'other' },
      { name: 'Túi chống nước điện thoại', category: 'electronics' },
    ]
  },
  {
    id: 'mountain',
    name: 'Leo núi / Trekking',
    icon: '⛰️',
    items: [
      { name: 'Giày leo núi / Trekking', category: 'clothes' },
      { name: 'Áo khoác gió / Áo mưa', category: 'clothes' },
      { name: 'Balo nhỏ', category: 'other' },
      { name: 'Bình nước cá nhân', category: 'other' },
      { name: 'Thuốc chống muỗi / Côn trùng', category: 'toiletries' },
      { name: 'Sạc dự phòng', category: 'electronics' },
      { name: 'Đèn pin', category: 'electronics' },
    ]
  },
  {
    id: 'business',
    name: 'Công tác',
    icon: '💼',
    items: [
      { name: 'Laptop & Sạc', category: 'electronics' },
      { name: 'Quần y phục / Sơ mi', category: 'clothes' },
      { name: 'Danh thiếp', category: 'documents' },
      { name: 'Sổ tay & Bút', category: 'other' },
      { name: 'Hồ sơ tài liệu', category: 'documents' },
      { name: 'Bộ dụng cụ cá nhân', category: 'toiletries' },
    ]
  },
  {
    id: 'basic',
    name: 'Cơ bản (Ai cũng cần)',
    icon: '🎒',
    items: [
      { name: 'Quần áo mặc hàng ngày', category: 'clothes' },
      { name: 'Đồ lót / Tất', category: 'clothes' },
      { name: 'Bàn chải & Kem đánh răng', category: 'toiletries' },
      { name: 'Cáp sạc điện thoại', category: 'electronics' },
      { name: 'CCCD / Hộ chiếu', category: 'documents' },
      { name: 'Tiền mặt & Thẻ', category: 'documents' },
    ]
  }
];

type PackingSortKey = 'unpackedFirst' | 'packedFirst' | 'nameAsc' | 'nameDesc' | 'assigneeAsc' | 'createdDesc' | 'createdAsc';

const PACKING_SORT_OPTIONS: Array<SortOption<PackingSortKey>> = [
  { value: 'unpackedFirst', label: 'Chưa xong trước' },
  { value: 'packedFirst', label: 'Đã xong trước' },
  { value: 'nameAsc', label: 'Tên A-Z' },
  { value: 'nameDesc', label: 'Tên Z-A' },
  { value: 'assigneeAsc', label: 'Người phụ trách' },
  { value: 'createdDesc', label: 'Mới nhất' },
  { value: 'createdAsc', label: 'Cũ nhất' },
];

export function TripPacking() {
  const { id } = useParams();
  const { trips, packingItems, addPackingItem, editPackingItem, togglePackingItem, deletePackingItem, setCurrentTripId, batchRemote } = useAppContext();
  const { showToast, confirm } = useFeedback();
  const { session } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState<'all' | 'me'>('all');
  const [editingItem, setEditingItem] = useState<PackingItem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isPresetMode, setIsPresetMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<PackingSortKey>('unpackedFirst');

  useEffect(() => {
    if (id) setCurrentTripId(id);
  }, [id, setCurrentTripId]);

  const trip = trips.find(t => t.id === id);
  const tripMembers = trip?.members ?? [];
  const displayMembers = useMemo(() => [...tripMembers, ...(trip?.historicalMembers ?? [])], [trip?.historicalMembers, tripMembers]);
  const tripPackingItems = useMemo(() => packingItems.filter((item) => item.tripId === id), [packingItems, id]);

  const memberMap = useMemo(() => {
    return displayMembers.reduce<Record<string, { name: string; avatar: string }>>((map, member) => {
      map[member.id] = { name: member.displayName, avatar: member.avatar };
      return map;
    }, {});
  }, [displayMembers]);

  const items = useMemo(() => {
    let filteredList = tripPackingItems;
    if (filterAssignee === 'me' && session?.user) {
      filteredList = filteredList.filter(p => p.assigneeId === session.user.id);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredList = filteredList.filter(p => p.name.toLowerCase().includes(q));
    }
    const fallbackSort = (a: PackingItem, b: PackingItem) => compareText(a.name, b.name, 'asc');
    const sortComparator = (a: PackingItem, b: PackingItem) => {
      switch (sortBy) {
        case 'packedFirst': return compareNumber(a.isPacked ? 0 : 1, b.isPacked ? 0 : 1, 'asc');
        case 'nameAsc': return compareText(a.name, b.name, 'asc');
        case 'nameDesc': return compareText(a.name, b.name, 'desc');
        case 'assigneeAsc': return compareText(memberMap[a.assigneeId ?? '']?.name ?? '', memberMap[b.assigneeId ?? '']?.name ?? '', 'asc');
        case 'createdDesc': return compareDate(a.createdAt, b.createdAt, 'desc');
        case 'createdAsc': return compareDate(a.createdAt, b.createdAt, 'asc');
        case 'unpackedFirst':
        default: return compareNumber(a.isPacked ? 1 : 0, b.isPacked ? 1 : 0, 'asc');
      }
    };
    return stableSort(filteredList, chainComparators(sortComparator, fallbackSort));
  }, [tripPackingItems, filterAssignee, session, searchQuery, sortBy, memberMap]);
  const itemsByCategory = useMemo(() => {
    return items.reduce<Record<string, PackingItem[]>>((groups, item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
      return groups;
    }, {});
  }, [items]);

  const assigneeStats = useMemo(() => {
    return tripMembers.map((member) => {
      const assignedItems = tripPackingItems.filter((item) => item.assigneeId === member.id);
      const packedItems = assignedItems.filter((item) => item.isPacked).length;
      return {
        member,
        total: assignedItems.length,
        packed: packedItems,
        progress: assignedItems.length > 0 ? (packedItems / assignedItems.length) * 100 : 0,
      };
    }).filter((stat) => stat.total > 0);
  }, [tripPackingItems, tripMembers]);

  if (!trip) return <div>Trip not found</div>;
  const canEdit = trip.permissions.canEditContent;

  const handleAddItem = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const nextItem = {
        tripId: trip.id,
        name: formData.get('name') as string,
        category: formData.get('category') as PackingItem['category'],
        assigneeId: formData.get('assigneeId') as string || undefined,
        isPacked: editingItem?.isPacked ?? false,
      };

      if (editingItem) {
        await editPackingItem(editingItem.id, nextItem);
      } else {
        await addPackingItem(nextItem);
      }
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Không thể lưu hành lý.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    const rawNames = (formData.get('names') as string) ?? '';
    const names = rawNames.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) {
      setSubmitError('Nhập ít nhất 1 món đồ.');
      return;
    }

    const category = formData.get('category') as PackingItem['category'];
    const assigneeId = (formData.get('assigneeId') as string) || undefined;

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await batchRemote(async () => {
        for (const name of names) {
          await addPackingItem({
            tripId: trip.id,
            name,
            category,
            assigneeId,
            isPacked: false,
          });
        }
      });
      setIsAddOpen(false);
      setIsBatchMode(false);
      showToast({
        tone: 'success',
        title: `Đã thêm ${names.length} món đồ`,
        message: `${names.length} món đồ đã được thêm vào danh sách hành lý.`,
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Không thể thêm hành lý.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetAdd = async (presetId: string) => {
    if (isSubmitting) return;
    const preset = PACKING_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await batchRemote(async () => {
        for (const item of preset.items) {
          await addPackingItem({
            tripId: trip.id,
            name: item.name,
            category: item.category as PackingItem['category'],
            isPacked: false,
          });
        }
      });
      setIsAddOpen(false);
      setIsPresetMode(false);
      showToast({
        tone: 'success',
        title: `Đã thêm mẫu ${preset.name}`,
        message: `${preset.items.length} món đồ cơ bản đã được đẩy vào danh sách.`,
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Không thể áp dụng mẫu.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const packingCategoryOptions = useMemo(
    () => mergeCategoryOptions(PACKING_CATEGORY_OPTIONS, tripPackingItems.map((item) => item.category)),
    [tripPackingItems],
  );

  const categories = useMemo(() => {
    const iconByCategory: Record<string, typeof Icons.Shirt> = {
      clothes: Icons.Shirt,
      toiletries: Icons.Droplets,
      electronics: Icons.Laptop,
      documents: Icons.FileText,
      other: Icons.Package,
    };
    return packingCategoryOptions.map((category) => ({
      id: category.value,
      label: category.label,
      icon: iconByCategory[category.value] ?? Icons.Package,
    }));
  }, [packingCategoryOptions]);

  const containerVariants = pageStaggerVariants;
  const itemVariants = fadeUpVariants;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="pb-10">
      <motion.div variants={itemVariants} className="mb-6 flex flex-col items-stretch justify-between gap-4 md:mb-8 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="mb-2 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-secondary dark:text-gray-300 md:text-xs md:tracking-[0.2em]">Chuẩn bị</p>
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-4">
            <h1 className="font-headline text-2xl font-extrabold text-on-surface md:text-4xl md:tracking-tighter">Hành lý & Đồ đạc</h1>
            {session?.user && (
              <div className="mb-1 flex w-full self-end rounded-full bg-surface-container-low p-1 ring-1 ring-outline-variant/30 sm:w-auto">
                <button onClick={() => setFilterAssignee('all')} className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors sm:flex-none md:px-4 ${filterAssignee === 'all' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:text-on-surface'}`}>Tất cả</button>
                <button onClick={() => setFilterAssignee('me')} className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition-colors sm:flex-none md:px-4 ${filterAssignee === 'me' ? 'bg-primary text-white shadow-sm' : 'text-secondary hover:text-on-surface'}`}>Phân công cho tôi</button>
              </div>
            )}
            <div className="relative mb-1 min-w-0 flex-1 self-end md:min-w-[200px]">
              <Icons.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary opacity-50" />
              <input
                type="text"
                placeholder="Tìm món đồ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-high text-sm text-on-surface rounded-full pl-9 pr-4 py-1.5 focus:ring-1 focus:ring-primary/50 transition-all font-medium outline-none"
              />
            </div>
            <SortSelect value={sortBy} options={PACKING_SORT_OPTIONS} onChange={setSortBy} className="mb-1 w-full self-end py-1.5 md:w-auto" />
          </div>
        </div>
        {canEdit && (
          <button onClick={() => { setEditingItem(null); setIsBatchMode(false); setIsPresetMode(false); setIsAddOpen(true); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary transition-opacity hover:opacity-90 md:w-auto md:px-6">
            <Icons.Plus className="w-5 h-5" />
            Thêm đồ
          </button>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-secondary dark:text-gray-300 md:mb-6">
        <span className="font-medium">
          Hiển thị {items.length} món
          {items.length !== tripPackingItems.length && ` phù hợp trong tổng ${tripPackingItems.length} món`}
        </span>
        {(searchQuery.trim() || filterAssignee !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterAssignee('all');
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10 dark:text-white"
          >
            Xóa bộ lọc
          </button>
        )}
      </motion.div>

      {assigneeStats.length > 0 && (
        <motion.section variants={itemVariants} className="mb-8 rounded-2xl bg-surface-container-lowest p-4 editorial-shadow ring-1 ring-outline/10 md:rounded-3xl md:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-secondary dark:text-gray-300">Theo thành viên</p>
              <h2 className="mt-1 font-headline text-xl font-bold text-on-surface">Tiến độ hành lý được phân công</h2>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {assigneeStats.map(({ member, total, packed, progress }) => (
              <div key={member.id} className="rounded-2xl bg-surface-container-low p-4">
                <div className="mb-3 flex items-center gap-3">
                  <img src={member.avatar} alt={member.displayName} className="h-10 w-10 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-headline text-sm font-bold text-on-surface">{member.displayName}</p>
                    <p className="text-xs text-secondary dark:text-gray-300">{packed}/{total} món đã xong</p>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-variant">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {categories.map(cat => {
          const catItems = itemsByCategory[cat.id] ?? [];
          if (catItems.length === 0) return null;

          const packedCount = catItems.filter(i => i.isPacked).length;
          const progress = (packedCount / catItems.length) * 100;

          return (
            <motion.div variants={itemVariants} key={cat.id} className="rounded-2xl bg-surface-container-lowest p-4 editorial-shadow md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-primary dark:text-white flex items-center justify-center">
                  <cat.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-headline font-bold text-lg text-on-surface">{cat.label}</h3>
                  <p className="text-xs text-secondary dark:text-gray-300 font-medium">{packedCount}/{catItems.length} đã chuẩn bị</p>
                </div>
              </div>

              <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden mb-4">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>

              <div className="space-y-2">
                {catItems.map(item => (
                  <div key={item.id} className="relative group rounded-xl overflow-hidden mb-1 ring-1 ring-surface-variant/30">
                    <div className="absolute inset-0 flex justify-between items-center pointer-events-none opacity-80">
                      <div className="flex flex-1 h-full items-center justify-start pl-4 select-none bg-primary/20 text-primary dark:bg-primary/40 dark:text-white">
                        <Check className="w-5 h-5 flex-shrink-0" />
                        <span className="ml-2 font-bold text-xs">Đã xong</span>
                      </div>
                      <div className="flex flex-1 h-full items-center justify-end pr-4 select-none bg-error/20 text-error dark:bg-error/40 dark:text-error-container">
                        <span className="mr-2 font-bold text-xs">Xóa</span>
                        <Icons.Trash2 className="w-5 h-5 flex-shrink-0" />
                      </div>
                    </div>
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.4}
                      onDragEnd={async (_event, info) => {
                        if (!canEdit) return;
                        if (info.offset.x > 60) {
                          try {
                            await togglePackingItem(item.id);
                          } catch (error) {
                            showToast({ tone: 'error', title: 'Lỗi', message: getErrorMessage(error, 'Không thể cập nhật.') });
                          }
                        } else if (info.offset.x < -60) {
                          const shouldDelete = await confirm({
                            title: `Xóa "${item.name}" khỏi hành lý`,
                            message: 'Món đồ này sẽ bị gỡ khỏi checklist của chuyến đi.',
                            confirmLabel: 'Xóa món đồ',
                            cancelLabel: 'Giữ lại',
                            tone: 'danger',
                          });
                          if (shouldDelete) {
                            try {
                              await deletePackingItem(item.id);
                            } catch (error) {
                              showToast({ tone: 'error', title: 'Lỗi', message: getErrorMessage(error, 'Không thể xóa.') });
                            }
                          }
                        }
                      }}
                      className="relative z-10 flex flex-1 items-center justify-between bg-surface-container-lowest px-3 py-2 cursor-grab active:cursor-grabbing border-y border-transparent -my-[1px]"
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={item.isPacked}
                          onChange={async () => {
                            if (!canEdit) return;
                            try {
                              await togglePackingItem(item.id);
                            } catch (error) {
                              showToast({ tone: 'error', title: 'Lỗi', message: getErrorMessage(error, 'Không thể cập nhật trạng thái hành lý.') });
                            }
                          }}
                          disabled={!canEdit}
                          className="w-5 h-5 rounded border-outline-variant text-primary dark:text-white focus:ring-primary transition-all cursor-pointer"
                        />
                        <span className={`font-body text-sm transition-all select-none ${item.isPacked ? 'line-through text-outline' : 'text-on-surface'}`}>
                          {item.name}
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        {item.assigneeId && (
                          <img
                            src={memberMap[item.assigneeId]?.avatar}
                            alt="Assignee"
                            className="w-6 h-6 rounded-full border border-surface"
                            title={memberMap[item.assigneeId]?.name}
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        {canEdit && (
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => { setEditingItem(item); setSubmitError(null); setIsAddOpen(true); }} className="p-1.5 text-secondary dark:text-gray-300 hover:text-primary dark:text-white hover:bg-surface-container rounded-lg transition-colors">
                              <Icons.Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={async () => {
                              const shouldDelete = await confirm({
                                title: `Xóa "${item.name}" khỏi hành lý`,
                                message: 'Món đồ này sẽ bị gỡ khỏi checklist của chuyến đi.',
                                confirmLabel: 'Xóa món đồ',
                                cancelLabel: 'Giữ lại',
                                tone: 'danger',
                              });
                              if (!shouldDelete) {
                                return;
                              }

                              try {
                                await deletePackingItem(item.id);
                              } catch (error) {
                                showToast({
                                  tone: 'error',
                                  title: 'Không thể xóa hành lý',
                                  message: getErrorMessage(error, 'Không thể xóa hành lý.'),
                                });
                              }
                            }} className="p-1.5 text-secondary dark:text-gray-300 hover:text-error hover:bg-error-container rounded-lg transition-colors">
                              <Icons.Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
        {items.length === 0 && (
          <motion.div variants={itemVariants} className="col-span-full py-12 text-center border-2 border-dashed border-outline-variant rounded-2xl">
            <Icons.Package className="w-12 h-12 mx-auto text-secondary dark:text-gray-300 mb-4 opacity-50" />
            <p className="text-secondary dark:text-gray-300 font-medium">Chưa có đồ đạc nào cần chuẩn bị.</p>
          </motion.div>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => { if (!isSubmitting) { setIsAddOpen(false); setEditingItem(null); setIsBatchMode(false); setIsPresetMode(false); setSubmitError(null); } }} title={editingItem ? "Sửa đồ cần chuẩn bị" : "Thêm đồ cần chuẩn bị"}>
        {!editingItem && (
          <div className="flex bg-surface-container-low p-1 rounded-2xl mb-5">
            <button type="button" onClick={() => { setIsBatchMode(false); setIsPresetMode(false); setSubmitError(null); }} className={`flex-1 py-1.5 rounded-xl text-sm font-bold transition-all ${!isBatchMode && !isPresetMode ? 'bg-white shadow dark:bg-surface-container-high text-on-surface' : 'text-secondary dark:text-gray-300 hover:text-on-surface'}`}>
              Thêm 1 món
            </button>
            <button type="button" onClick={() => { setIsBatchMode(true); setIsPresetMode(false); setSubmitError(null); }} className={`flex-1 py-1.5 px-2 rounded-xl text-sm font-bold transition-all ${isBatchMode ? 'bg-white shadow dark:bg-surface-container-high text-on-surface' : 'text-secondary dark:text-gray-300 hover:text-on-surface'}`}>
              Nhiều món
            </button>
            <button type="button" onClick={() => { setIsBatchMode(false); setIsPresetMode(true); setSubmitError(null); }} className={`flex-1 py-1.5 px-2 rounded-xl text-sm font-bold transition-all ${isPresetMode ? 'bg-white shadow dark:bg-surface-container-high text-on-surface' : 'text-secondary dark:text-gray-300 hover:text-on-surface'}`}>
              Sử dụng mẫu
            </button>
          </div>
        )}

        {isPresetMode && !editingItem ? (
          <div className="space-y-4">
            {submitError && (
              <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                {submitError}
              </div>
            )}
            <p className="text-sm text-secondary dark:text-gray-300">Chọn một mẫu có sẵn để tải danh sách các món đồ chuẩn bị nhanh chóng.</p>
            <div className="grid grid-cols-2 gap-3 pb-2">
              {PACKING_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetAdd(preset.id)}
                  disabled={isSubmitting}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 hover:border-primary hover:bg-primary/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">{preset.icon}</span>
                  <span className="font-headline font-bold text-sm text-on-surface text-center line-clamp-1">{preset.name}</span>
                  <span className="text-xs font-medium text-secondary dark:text-gray-300 mt-1">{preset.items.length} món</span>
                </button>
              ))}
            </div>
          </div>
        ) : isBatchMode && !editingItem ? (
          <form onSubmit={handleBatchAdd} className="space-y-4">
            {submitError && (
              <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                {submitError}
              </div>
            )}
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Danh sách đồ đạc <span className="font-normal text-outline">(mỗi dòng 1 món)</span></label>
              <textarea required name="names" rows={6} placeholder={"Áo khoác\nHộ chiếu\nSạc điện thoại\nKem chống nắng\nBàn chải đánh răng"} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none font-mono text-sm" />
            </div>
            <div>
              <CategorySelectWithCreate
                name="category"
                label="Danh mục chung"
                options={packingCategoryOptions}
                defaultValue="clothes"
                fallbackValue="clothes"
                className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                createLabel="Thêm danh mục hành lý mới"
                resetKey="batch-packing"
              />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Người phụ trách chung (Tuỳ chọn)</label>
              <select name="assigneeId" defaultValue="" className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                <option value="">Không phân công</option>
                {trip.members.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
            </div>
            <div className="pt-4">
              <button type="submit" disabled={isSubmitting} className="density-button w-full bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? 'Đang thêm...' : 'Thêm tất cả'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAddItem} className="space-y-4">
            {submitError && (
              <div className="rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
                {submitError}
              </div>
            )}
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Tên đồ đạc</label>
              <input required name="name" type="text" defaultValue={editingItem?.name || ''} placeholder="VD: Áo khoác, Hộ chiếu..." className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
            </div>
            <div>
              <CategorySelectWithCreate
                name="category"
                label="Danh mục"
                options={packingCategoryOptions}
                defaultValue={editingItem?.category || 'clothes'}
                fallbackValue="clothes"
                className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                createLabel="Thêm danh mục hành lý mới"
                resetKey={editingItem?.id ?? 'new-packing'}
              />
            </div>
            <div>
              <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">Người phụ trách (Tuỳ chọn)</label>
              <select name="assigneeId" defaultValue={editingItem?.assigneeId || ''} className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                <option value="">Không phân công</option>
                {trip.members.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
            </div>
            <div className="pt-4">
              <button type="submit" disabled={isSubmitting} className="density-button w-full bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? 'Đang lưu...' : editingItem ? 'Lưu thay đổi' : 'Thêm đồ'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </motion.div>
  );
}
