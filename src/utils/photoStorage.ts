import type { Photo } from '../context/AppContext';

export const EMBEDDED_PHOTO_WARNING_BYTES = 40 * 1024 * 1024;

function estimateDataUrlBytes(dataUrl: string) {
  const [, payload = ''] = dataUrl.split(',', 2);
  const normalizedPayloadLength = payload.replace(/=+$/, '').length;
  return Math.floor((normalizedPayloadLength * 3) / 4);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let currentValue = bytes / 1024;
  let unitIndex = 0;

  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  return `${currentValue.toFixed(currentValue >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function getPhotoStorageSummary(photos: Photo[]) {
  return photos.reduce((summary, photo) => {
    const isEmbedded = photo.storage === 'embedded' || (!photo.storage && photo.url.startsWith('data:'));

    if (isEmbedded) {
      summary.embeddedCount += 1;
      summary.estimatedEmbeddedBytes += estimateDataUrlBytes(photo.url);
    } else {
      summary.remoteCount += 1;
    }

    return summary;
  }, {
    totalCount: photos.length,
    embeddedCount: 0,
    remoteCount: 0,
    estimatedEmbeddedBytes: 0,
  });
}

export function shouldWarnAboutEmbeddedStorage(photos: Photo[]) {
  const summary = getPhotoStorageSummary(photos);
  return summary.estimatedEmbeddedBytes >= EMBEDDED_PHOTO_WARNING_BYTES;
}
