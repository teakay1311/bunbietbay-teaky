import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Icons } from './Icons';
import { useAppContext } from '../context/AppContext';
import { uploadFileAndGetUrl } from '../utils/photoUpload';
import { getErrorMessage } from '../utils/errorMessage';
import { useFeedback } from '../context/FeedbackContext';

interface CoverPhotoSelectorProps {
    tripId?: string | null;
    defaultValue?: string;
}

export function CoverPhotoSelector({ tripId, defaultValue }: CoverPhotoSelectorProps) {
    const { photos } = useAppContext();
    const { showToast } = useFeedback();
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'url' | 'upload' | 'gallery'>('upload');
    const [value, setValue] = useState(defaultValue || '');

    useEffect(() => {
        setValue(defaultValue || '');
    }, [defaultValue]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const tripPhotos = useMemo(() => {
        if (!tripId) return [];
        return photos.filter(p => p.tripId === tripId);
    }, [photos, tripId]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const result = await uploadFileAndGetUrl(file, tripId);
            setValue(result.url);
            setIsOpen(false);
        } catch (error) {
            showToast({
                tone: 'error',
                title: 'Lỗi tải ảnh',
                message: getErrorMessage(error, 'Không thể upload ảnh.'),
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSelectGalleryPhoto = (url: string) => {
        setValue(url);
        setIsOpen(false);
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="block font-label text-xs font-bold text-secondary mb-1">Ảnh bìa chuyến đi</label>

            {!isOpen ? (
                <div className="relative group rounded-xl overflow-hidden bg-surface-container-low border border-outline-variant/50 h-32 flex items-center justify-center cursor-pointer" onClick={() => setIsOpen(true)}>
                    {value ? (
                        <>
                            <img src={value} alt="Cover" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-primary text-white font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                                    <Icons.Edit2 className="w-3 h-3" />
                                    Đổi ảnh bìa
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="text-secondary flex flex-col items-center gap-2 group-hover:text-primary transition-colors">
                            <Icons.Image className="w-6 h-6" />
                            <span className="font-label text-xs font-bold uppercase tracking-widest">Thêm ảnh bìa</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="border border-outline border-dashed p-4 rounded-2xl bg-surface-container-lowest animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-headline font-bold text-sm">Chọn ảnh mới</h3>
                        <button type="button" onClick={() => setIsOpen(false)} className="text-secondary hover:text-on-surface">
                            <Icons.Plus className="w-5 h-5 rotate-45" />
                        </button>
                    </div>

                    <div className="flex bg-surface-container-high rounded-lg p-1 mb-4 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setActiveTab('upload')}
                            className={`flex-1 text-xs font-bold py-2 rounded-md transition-colors ${activeTab === 'upload' ? 'bg-surface text-on-surface shadow' : 'text-secondary hover:text-on-surface'}`}
                        >
                            Upload
                        </button>
                        {tripId && tripPhotos.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setActiveTab('gallery')}
                                className={`flex-1 text-xs font-bold py-2 rounded-md transition-colors ${activeTab === 'gallery' ? 'bg-surface text-on-surface shadow' : 'text-secondary hover:text-on-surface'}`}
                            >
                                Album
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setActiveTab('url')}
                            className={`flex-1 text-xs font-bold py-2 rounded-md transition-colors ${activeTab === 'url' ? 'bg-surface text-on-surface shadow' : 'text-secondary hover:text-on-surface'}`}
                        >
                            URL
                        </button>
                    </div>

                    <div className="min-h-[120px]">
                        {activeTab === 'upload' && (
                            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-outline-variant/50 rounded-xl bg-surface-container-low text-center">
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="cover-upload"
                                />
                                {!isUploading ? (
                                    <label htmlFor="cover-upload" className="cursor-pointer flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                            <Icons.Upload className="w-5 h-5" />
                                        </div>
                                        <span className="font-label text-xs font-bold text-on-surface">Tải lên một bức ảnh từ máy tính</span>
                                    </label>
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                        <span className="font-label text-xs font-bold text-on-surface">Đang tải và tối ưu ảnh...</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'gallery' && (
                            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                                {tripPhotos.map(photo => (
                                    <button
                                        type="button"
                                        key={photo.id}
                                        onClick={() => handleSelectGalleryPhoto(photo.url)}
                                        className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus:border-primary transition-colors focus:outline-none"
                                    >
                                        <img src={photo.url} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeTab === 'url' && (
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="block font-label text-[10px] text-secondary mb-1">Dán link (URL) ảnh</label>
                                    <input
                                        type="url"
                                        value={value}
                                        onChange={(e) => {
                                            setValue(e.target.value);
                                        }}
                                        placeholder="https://..."
                                        className="density-control w-full rounded-xl bg-surface-container-low border border-outline-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <input type="hidden" name="image" value={value} />
            <p className="text-[10px] text-secondary">Bạn có thể thay ảnh bìa riêng cho từng chuyến đi. Bạn cũng có thể chọn ảnh từ chuyến đi.</p>
        </div>
    );
}
