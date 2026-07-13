const CACHE_NAME = 'bunbietbay-offline-photos';

export async function cachePhotosForOffline(urls: string[]) {
  if (!('caches' in window)) throw new Error('Trình duyệt không hỗ trợ bộ nhớ ảnh ngoại tuyến.');
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(urls.filter((url) => !url.startsWith('data:')).map(async (url) => {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await cache.put(url, response);
  }));
  return { saved: results.filter((result) => result.status === 'fulfilled').length, failed: results.filter((result) => result.status === 'rejected').length };
}

