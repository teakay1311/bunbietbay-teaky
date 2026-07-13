import { useEffect, useState } from 'react';

export function readStoredOption<T extends string>(
  key: string,
  options: readonly T[],
  fallback: T,
  storage: Pick<Storage, 'getItem'> = localStorage,
) {
  try {
    const storedValue = storage.getItem(key) as T | null;
    return storedValue && options.includes(storedValue) ? storedValue : fallback;
  } catch {
    return fallback;
  }
}

export function useStoredOption<T extends string>(key: string, options: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => readStoredOption(key, options, fallback));

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable in private or locked-down browser contexts.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
