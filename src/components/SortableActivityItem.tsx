import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icons } from './Icons';
import { Activity } from '../context/AppContext';
import { useFeedback } from '../context/FeedbackContext';
import { LinkifyText } from './LinkifyText';

interface SortableActivityItemProps {
    activity: Activity;
    canEdit: boolean;
    onEdit: (activity: Activity) => void;
    onDelete: (activity: Activity) => void;
    onChangeDate: (activity: Activity) => void;
    onToggleCompletion?: (activity: Activity) => void;
}

export const SortableActivityItem: React.FC<SortableActivityItemProps> = ({ activity, canEdit, onEdit, onDelete, onChangeDate, onToggleCompletion }) => {
    const { showToast } = useFeedback();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: activity.id, disabled: !canEdit });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <article ref={setNodeRef} style={style} className={`bg-surface-container-lowest rounded-2xl p-6 shadow-[0_12px_24px_rgba(0,0,0,0.04)] relative group transition-all ${isDragging ? 'border-l-4 border-primary shadow-2xl scale-[1.02]' : 'border-l-4 border-primary/20 hover:border-primary'} ${activity.isCompleted ? 'opacity-60 saturate-50' : ''}`}>
            <div className={`absolute -left-[9px] md:-left-[33px] top-6 w-4 h-4 rounded-full border-4 border-surface ring-4 ring-surface ${activity.isCompleted ? 'bg-outline' : 'bg-primary'}`}></div>

            {canEdit && (
                <div {...attributes} {...listeners} className="absolute left-[-24px] top-4 w-6 h-10 items-center justify-center cursor-grab active:cursor-grabbing text-outline hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icons.GripVertical className="w-4 h-4" />
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`font-label text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${activity.isCompleted ? 'bg-outline-variant/30 text-outline' : 'bg-primary-container/20 text-primary dark:text-white'}`}>{activity.time}</span>
                        {activity.type === 'flight' && <Icons.PlaneLanding className="w-5 h-5 text-secondary dark:text-gray-300" />}
                        {activity.type === 'hotel' && <Icons.Hotel className="w-5 h-5 text-secondary dark:text-gray-300" />}
                        {activity.type === 'restaurant' && <Icons.Utensils className="w-5 h-5 text-secondary dark:text-gray-300" />}
                        {activity.type !== 'flight' && activity.type !== 'hotel' && activity.type !== 'restaurant' && <Icons.MapPin className="w-5 h-5 text-secondary dark:text-gray-300" />}
                        {canEdit && onToggleCompletion && (
                            <label className="flex items-center gap-2 cursor-pointer ml-auto mr-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    checked={!!activity.isCompleted}
                                    onChange={() => onToggleCompletion(activity)}
                                    className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
                                />
                                <span className="text-xs font-bold text-secondary">Hoàn thành</span>
                            </label>
                        )}
                    </div>
                    <h3 className={`font-headline text-xl font-bold mb-1 ${activity.isCompleted ? 'text-outline line-through' : 'text-on-surface'}`}>{activity.title}</h3>
                    <p className="text-secondary dark:text-gray-300 flex items-center gap-1 mb-4">
                        <Icons.MapPin className="w-4 h-4" />
                        {activity.location}
                        {activity.mapUrl && (
                            <a href={activity.mapUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary dark:text-white hover:underline text-xs font-bold flex items-center gap-1 z-20 relative">
                                <Icons.Map className="w-3 h-3" /> Bản đồ
                            </a>
                        )}
                    </p>

                    {activity.bookingCode && (
                        <div className="mb-4 inline-flex items-center gap-3 bg-surface-container-high px-4 py-2 rounded-xl border border-outline-variant/30 group/code z-20 relative">
                            <Icons.Ticket className="w-4 h-4 text-primary dark:text-white" />
                            <span className="font-mono font-bold text-on-surface tracking-wider uppercase max-w-[150px] truncate">{activity.bookingCode}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(activity.bookingCode!);
                                    showToast({ tone: 'success', title: 'Đã sao chép', message: 'Mã đặt chỗ đã được sao chép vào bộ nhớ tạm.' });
                                }}
                                className="p-1.5 text-secondary hover:text-primary dark:hover:text-white hover:bg-surface-container rounded-lg transition-colors"
                                title="Sao chép"
                            >
                                <Icons.Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {activity.image ? (
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <img alt={activity.title} className="w-full h-32 object-cover rounded-xl" src={activity.image} />
                            {activity.note && (
                                <div className="bg-surface-container-low p-4 rounded-xl flex items-center">
                                    <p className="text-on-surface-variant text-sm italic">"<LinkifyText text={activity.note} />"</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        activity.note && (
                            <div className="bg-surface-container-low p-4 rounded-xl mt-2 z-20 relative">
                                <p className="text-on-surface-variant text-sm italic">"<LinkifyText text={activity.note} />"</p>
                            </div>
                        )
                    )}
                </div>
                {canEdit && (
                    <div className="flex md:flex-col gap-2 z-20 relative">
                        <button onClick={() => onChangeDate(activity)} className="p-2 hover:bg-surface-container-high rounded-lg text-secondary dark:text-gray-300 hover:text-primary transition-colors" title="Đổi ngày">
                            <Icons.CalendarDays className="w-5 h-5" />
                        </button>
                        <button onClick={() => onEdit(activity)} className="p-2 hover:bg-surface-container-high rounded-lg text-secondary dark:text-gray-300 hover:text-primary transition-colors" title="Sửa hoạt động">
                            <Icons.Edit2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onDelete(activity)}
                            className="p-2 hover:bg-error-container hover:text-error rounded-lg text-secondary dark:text-gray-300 transition-colors"
                            title="Xóa hoạt động"
                        >
                            <Icons.Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </article>
    );
}
