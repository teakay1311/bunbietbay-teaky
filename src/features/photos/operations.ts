import type { Photo } from '../../domain/models';
import { deleteImageFromCloudinary, isCloudinaryConfigured, uploadImageToCloudinary } from '../../lib/cloudinary';
import { blobToDataUrl, compressImage } from '../../utils/photoUpload';
import { PHOTO_HASH_VERSION, createPerceptualHash, sha256Hex } from './duplicateDetection';
import { saveOfflineMedia } from '../../utils/persistence';

type PhotoMetadata = Pick<Photo, 'album' | 'takenOn' | 'place' | 'tags' | 'people' | 'activityId' | 'placeId'>;

export async function preparePhotoUploads(files: File[], tripId: string, metadata: PhotoMetadata, precomputedHashes?: Map<File, { contentHash: string; perceptualHash?: string; hashVersion: number }>): Promise<Array<Omit<Photo, 'id' | 'createdAt'>>> {
  const nextPhotos: Array<Omit<Photo, 'id' | 'createdAt'>> = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const precomputed = precomputedHashes?.get(file);
    const contentHash = precomputed?.contentHash ?? await sha256Hex(file);
    let perceptualHash: string | undefined = precomputed?.perceptualHash;
    if (!perceptualHash) try { perceptualHash = await createPerceptualHash(file); } catch { /* exact hash still works */ }
    const compressedImage = await compressImage(file);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineBlobKey = `photo:${crypto.randomUUID()}`;
      await saveOfflineMedia(offlineBlobKey, compressedImage);
      nextPhotos.push({ ...metadata, tripId, url: await blobToDataUrl(compressedImage), storage: 'embedded', contentHash, perceptualHash, hashVersion: PHOTO_HASH_VERSION, offlineBlobKey });
      continue;
    }
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
        contentHash,
        perceptualHash,
        hashVersion: PHOTO_HASH_VERSION,
      });
      continue;
    }
    nextPhotos.push({
      ...metadata,
      tripId,
      url: await blobToDataUrl(compressedImage),
      storage: 'embedded',
      contentHash,
      perceptualHash,
      hashVersion: PHOTO_HASH_VERSION,
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
