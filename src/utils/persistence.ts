const STORAGE_KEY = 'bunbietbay-app-state';
const DB_NAME = 'bunbietbay-trips-db';
const STORE_NAME = 'app-state';

function supportsIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

let cachedDb: IDBDatabase | null = null;

function openPersistenceDatabase() {
  if (cachedDb) return Promise.resolve(cachedDb);

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      cachedDb = request.result;
      cachedDb.onclose = () => { cachedDb = null; };
      resolve(cachedDb);
    };
    request.onerror = () => reject(request.error);
  });
}

async function readIndexedDbState<T>() {
  const database = await openPersistenceDatabase();

  return await new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(STORAGE_KEY);

    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

async function writeIndexedDbState<T>(state: T) {
  const database = await openPersistenceDatabase();

  return await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(state, STORAGE_KEY);

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



export async function loadPersistedState<T>() {
  if (typeof window === 'undefined') {
    return null as T | null;
  }

  if (window.desktopApi?.loadState) {
    return (await window.desktopApi.loadState()) as T | null;
  }

  if (supportsIndexedDb()) {
    try {
      return await readIndexedDbState<T>();
    } catch (error) {
      console.error('Failed to load persisted state from IndexedDB, falling back to localStorage', error);
    }
  }

  const rawState = window.localStorage.getItem(STORAGE_KEY);
  if (!rawState) {
    return null as T | null;
  }

  return JSON.parse(rawState) as T;
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
