const STORAGE_KEY = 'bunbietbay-app-state';
const DB_NAME = 'bunbietbay-trips-db';
const STORE_NAME = 'app-state';
const MEDIA_STORE_NAME = 'offline-media';

function supportsIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

let cachedDb: IDBDatabase | null = null;

function openPersistenceDatabase() {
  if (cachedDb) return Promise.resolve(cachedDb);

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 2);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
      if (!database.objectStoreNames.contains(MEDIA_STORE_NAME)) database.createObjectStore(MEDIA_STORE_NAME);
    };

    request.onsuccess = () => {
      cachedDb = request.result;
      cachedDb.onclose = () => { cachedDb = null; };
      resolve(cachedDb);
    };
    request.onerror = () => reject(request.error);
  });
}

async function readIndexedDbState<T>(key = STORAGE_KEY) {
  const database = await openPersistenceDatabase();

  return await new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

async function writeIndexedDbState<T>(state: T, key = STORAGE_KEY) {
  const database = await openPersistenceDatabase();

  return await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(state, key);

    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

async function clearIndexedDbState() {
  const database = await openPersistenceDatabase();

  return await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(STORAGE_KEY);

    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}



export async function loadPersistedState<T>(prepare: (state: unknown) => T = (state) => state as T) {
  if (typeof window === 'undefined') {
    return null as T | null;
  }

  if (window.desktopApi?.loadState) {
    const state = await window.desktopApi.loadState();
    return state === null ? null : prepare(state);
  }

  if (supportsIndexedDb()) {
    try {
      const state = await readIndexedDbState<unknown>();
      if (state !== null) {
        return prepare(state);
      }
    } catch (error) {
      console.error('Failed to load persisted state from IndexedDB, falling back to localStorage', error);
    }
  }

  const rawState = window.localStorage.getItem(STORAGE_KEY);
  if (!rawState) {
    return null as T | null;
  }

  const preparedState = prepare(JSON.parse(rawState));
  if (supportsIndexedDb()) {
    try {
      await writeIndexedDbState(preparedState);
    } catch (error) {
      console.error('Failed to migrate localStorage state to IndexedDB; keeping localStorage as the source', error);
    }
  }
  return preparedState;
}

export async function savePersistedState<T>(state: T) {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.desktopApi?.saveState) {
    await window.desktopApi.saveState(state);
    return;
  }

  if (supportsIndexedDb()) {
    try {
      await writeIndexedDbState(state);
      return;
    } catch (error) {
      console.error('Failed to save persisted state to IndexedDB, falling back to localStorage', error);
    }
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearPersistedState() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.desktopApi?.clearState) {
    await window.desktopApi.clearState();
  }

  if (supportsIndexedDb()) {
    try {
      await clearIndexedDbState();
    } catch (error) {
      console.error('Failed to clear persisted state in IndexedDB', error);
    }
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export async function loadRemoteCachedState<T>(userId: string, prepare: (state: unknown) => T) {
  if (typeof window === 'undefined') return null;
  const key = `${STORAGE_KEY}:remote:${userId}`;
  if (supportsIndexedDb()) {
    try {
      const value = await readIndexedDbState<unknown>(key);
      return value === null ? null : prepare(value);
    } catch (error) {
      console.warn('Failed to read remote workspace cache', error);
    }
  }
  const raw = window.localStorage.getItem(key);
  return raw ? prepare(JSON.parse(raw)) : null;
}

export async function saveRemoteCachedState<T>(userId: string, state: T) {
  if (typeof window === 'undefined') return;
  const key = `${STORAGE_KEY}:remote:${userId}`;
  if (supportsIndexedDb()) {
    try {
      await writeIndexedDbState(state, key);
      return;
    } catch (error) {
      console.warn('Failed to write remote workspace cache', error);
    }
  }
  window.localStorage.setItem(key, JSON.stringify(state));
}

export async function saveOfflineMedia(key: string, blob: Blob) {
  if (!supportsIndexedDb()) throw new Error('Thiết bị không hỗ trợ lưu ảnh ngoại tuyến.');
  const estimate = await navigator.storage?.estimate?.();
  if (estimate?.quota && estimate.usage && estimate.quota - estimate.usage < blob.size * 1.2) throw new Error('Không đủ dung lượng để lưu ảnh ngoại tuyến.');
  const database = await openPersistenceDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE_NAME, 'readwrite');
    transaction.objectStore(MEDIA_STORE_NAME).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadOfflineMedia(key: string) {
  if (!supportsIndexedDb()) return null;
  const database = await openPersistenceDatabase();
  return await new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE_NAME, 'readonly');
    const request = transaction.objectStore(MEDIA_STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineMedia(key: string) {
  if (!supportsIndexedDb()) return;
  const database = await openPersistenceDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE_NAME, 'readwrite');
    transaction.objectStore(MEDIA_STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
