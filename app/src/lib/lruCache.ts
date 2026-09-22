export class LRUCache<K, V> {
  private capacity: number;
  private ttlMs: number;
  private cache: Map<K, { value: V; expiry: number }>;

  constructor(capacity: number, ttlMs: number) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  get(key: K): V | null {
    if (!this.cache.has(key)) return null;

    const entry = this.cache.get(key)!;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
