interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

class SimpleCache {
  private store: Record<string, CacheEntry<any>> = {};
  private ttl: number = 5 * 60 * 1000; // 5 minutes standard TTL

  set<T>(key: string, data: T): void {
    this.store[key] = {
      timestamp: Date.now(),
      data
    };
  }

  get<T>(key: string): T | null {
    const entry = this.store[key];
    if (!entry) return null;
    // Check TTL expiration
    if (Date.now() - entry.timestamp > this.ttl) {
      delete this.store[key];
      return null;
    }
    return entry.data;
  }

  clear(prefix?: string): void {
    if (!prefix) {
      this.store = {};
    } else {
      Object.keys(this.store).forEach(key => {
        if (key.startsWith(prefix)) {
          delete this.store[key];
        }
      });
    }
  }
}

export const appCache = new SimpleCache();
