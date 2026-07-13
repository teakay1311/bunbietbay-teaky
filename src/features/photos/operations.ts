import type { Photo } from '../../domain/models';
import { deleteImageFromCloudinary, isCloudinaryConfigured, uploadImageToCloudinary } from '../../lib/cloudinary';
import { blobToDataUrl, compressImage } from '../../utils/photoUpload';

type PhotoMetadata = Pick<Photo, 'album' | 'takenOn' | 'place' | 'tags' | 'people' | 'activityId' | 'placeId'>;

export async function preparePhotoUploads(files: File[], tripId: string, metadata: PhotoMetadata): Promise<Array<Omit<Photo, 'id' | 'createdAt'>>> {
  const nextPhotos: Array<Omit<Photo, 'id' | 'createdAt'>> = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const compressedImage = await compressImage(file);
    if (isCloudinaryConfigured) {
      const uploadedImage = await uploadImageToCloudinary(compressedImage, {
        folder: `bunbietbay/${tripId}`,
        tags: ['bunbietbay-trips', `trip-${tripId}`],
      });
      nextPhotos.push({
        ...metadata,
        tripId,
        url: uploadedImage.url,
        storage: 'remote',
        provider: 'cloudinary',
        providerPublicId: uploadedImage.publicId,
      });
      continue;
    }
    nextPhotos.push({
      ...metadata,
      tripId,
      url: await blobToDataUrl(compressedImage),
      storage: 'embedded',
    });
  }
  return nextPhotos;
}

export async function deletePhotoWithStorage(photo: Photo, deletePhoto: (id: string) => Promise<void>) {
  await deletePhoto(photo.id);
  if (photo.provider !== 'cloudinary' || !photo.providerPublicId) return false;
  try {
    return !(await deleteImageFromCloudinary(photo.providerPublicId));
  } catch {
    return true;
  }
}
