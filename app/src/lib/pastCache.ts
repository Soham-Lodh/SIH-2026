import { LRUCache } from './lruCache';
import { apiUrl } from './api';

// Cache for past archive data: capacity of 5 queries, TTL of 5 minutes (300,000 ms)
export const pastArchiveCache = new LRUCache<string, any>(5, 5 * 60 * 1000);

let prefetchPromise: Promise<any> | null = null;

/**
 * Triggers a background prefetch of the past archive list if not already cached.
 */
export function prefetchPastArchive(): void {
  if (pastArchiveCache.get('archive_data')) return;
  if (prefetchPromise) return;

  prefetchPromise = fetch(apiUrl('/api/past/archive'))
    .then((res) => {
      if (!res.ok) throw new Error('Past archive prefetch request failed');
      return res.json();
    })
    .then((data) => {
      pastArchiveCache.put('archive_data', data);
      prefetchPromise = null;
      return data;
    })
    .catch((err) => {
      console.warn('Past archive prefetch warning:', err);
      prefetchPromise = null;
    });
}

/**
 * Retrieves the past archive data, utilizing the prefetch promise or cache if available.
 */
export async function getPastArchive(): Promise<any> {
  const cached = pastArchiveCache.get('archive_data');
  if (cached) {
    return cached;
  }

  if (prefetchPromise) {
    try {
      const data = await prefetchPromise;
      if (data) return data;
    } catch (e) {
      // Fall through to direct fetch on error
    }
  }

  const res = await fetch(apiUrl('/api/past/archive'));
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.details || data?.error || 'Failed to load recent archive');
  }

  pastArchiveCache.put('archive_data', data);
  return data;
}
