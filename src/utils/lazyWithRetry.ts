import { lazy, ComponentType } from 'react';

/**
 * Enhanced lazy loader that automatically retries failed dynamic module imports
 * (e.g. caused by network fluctuations, HMR resets, or server restarts).
 * If all retries fail, it falls back to a clean reload or throws a clean error to the ErrorBoundary.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  interval = 800
) {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remainingRetries: number) => {
        factory()
          .then(resolve)
          .catch((error: unknown) => {
            if (remainingRetries > 0) {
              console.warn(
                `[lazyWithRetry] Dynamic import failed, retrying in ${interval}ms (${remainingRetries} attempts left)...`,
                error
              );
              setTimeout(() => {
                attempt(remainingRetries - 1);
              }, interval);
            } else {
              console.error('[lazyWithRetry] Dynamic import failed after all retries:', error);
              const isFetchError =
                error instanceof TypeError &&
                (error.message.includes('dynamically imported module') ||
                  error.message.includes('Failed to fetch'));

              if (isFetchError && typeof window !== 'undefined') {
                const storageKey = 'lazy_import_retry_timestamp';
                const lastRetry = sessionStorage.getItem(storageKey);
                const now = Date.now();
                if (!lastRetry || now - Number(lastRetry) > 10000) {
                  sessionStorage.setItem(storageKey, String(now));
                  console.info('[lazyWithRetry] Triggering clean reload for stale module cache...');
                  window.location.reload();
                  return;
                }
              }
              reject(error);
            }
          });
      };
      attempt(retries);
    })
  );
}
