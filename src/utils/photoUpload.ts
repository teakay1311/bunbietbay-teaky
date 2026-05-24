import { isCloudinaryConfigured, uploadImageToCloudinary } from '../lib/cloudinary';

export const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Không thể nén ảnh'));
                        return;
                    }

                    resolve(blob);
                }, 'image/webp', 0.7);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

export const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
    });
};

export const uploadFileAndGetUrl = async (file: File, tripId: string | null = null): Promise<{ url: string; storage: 'remote' | 'embedded', providerPublicId?: string }> => {
    if (!file.type.startsWith('image/')) {
        throw new Error('Định dạng file không hỗ trợ. Hãy chọn file ảnh.');
    }

    const compressedImage = await compressImage(file);

    if (isCloudinaryConfigured) {
        const folder = tripId ? `bunbietbay/${tripId}` : 'bunbietbay/covers';
        const tags = ['bunbietbay-trips', tripId ? `trip-${tripId}` : 'trip-cover'];

        const uploadedImage = await uploadImageToCloudinary(compressedImage, {
            folder,
            tags: tags.filter(Boolean),
        });

        return {
            url: uploadedImage.url,
            storage: 'remote',
            providerPublicId: uploadedImage.publicId,
        };
    }

    const compressedDataUrl = await blobToDataUrl(compressedImage);
    return {
        url: compressedDataUrl,
        storage: 'embedded',
    };
};
