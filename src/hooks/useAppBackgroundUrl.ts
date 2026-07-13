import { useEffect, useMemo, useState } from 'react';
import type { AppBackgroundPreference, Photo } from '../domain/models';
import { loadOfflineMedia } from '../utils/persistence';

export function useAppBackgroundUrl(background: AppBackgroundPreference, photos: Photo[]) {
  const [localUrl, setLocalUrl] = useState<string>();
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);

  useEffect(() => {
    if (background.source !== 'upload' || !background.localMediaKey) {
      setLocalUrl(undefined);
      setIsLoadingLocal(false);
      return;
    }

    let objectUrl: string | undefined;
    let cancelled = false;
    setLocalUrl(undefined);
    setIsLoadingLocal(true);
    void loadOfflineMedia(background.localMediaKey)
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLocalUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setLocalUrl(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLocal(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [background]);

  return useMemo(() => {
    if (background.source === 'none') return { url: undefined, isMissing: false, isLoading: false };
    if (background.source === 'library') {
      return { url: photos.find((photo) => photo.id === background.photoId && photo.itemType !== 'journal')?.url, isMissing: !photos.some((photo) => photo.id === background.photoId && photo.itemType !== 'journal'), isLoading: false };
    }
    const url = background.imageUrl || localUrl;
    return { url: url || undefined, isMissing: !url && !isLoadingLocal, isLoading: isLoadingLocal };
  }, [background, isLoadingLocal, localUrl, photos]);
}
