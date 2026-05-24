import { lazy, type ComponentType } from 'react';

/**
 * Wrapper around React.lazy() that automatically reloads the page once
 * when a chunk fails to load (e.g. after a new deployment on Vercel).
 *
 * Uses sessionStorage to prevent infinite reload loops: if a reload
 * has already been attempted in this session, the error is re-thrown
 * so that ErrorBoundary can catch it.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>
) {
    return lazy(async () => {
        const STORAGE_KEY = 'chunk_failed_reload';
        try {
            const module = await factory();
            // Load succeeded — clear any previous retry flag
            sessionStorage.removeItem(STORAGE_KEY);
            return module;
        } catch (error) {
            // If we haven't retried yet in this session, reload the page once
            if (!sessionStorage.getItem(STORAGE_KEY)) {
                sessionStorage.setItem(STORAGE_KEY, '1');
                window.location.reload();
            }
            // Already retried — let ErrorBoundary handle it
            throw error;
        }
    });
}
