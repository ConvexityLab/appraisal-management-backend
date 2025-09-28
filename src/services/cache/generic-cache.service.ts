import { Logger } from '../../utils/logger';

/**
 * Generic Cache Service
 * 
 * Manages caching of any data type with TTL support
 */
export class GenericCacheService {
  private logger: Logger;
  private cache: Map<string, { data: any; expires: Date }>;
  private defaultTtl: number;

  constructor() {
    this.logger = new Logger();
    this.cache = new Map();
    this.defaultTtl = 60 * 60 * 1000; // 1 hour in milliseconds
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    if (cached.expires < new Date()) {
      this.cache.delete(key);
      return null;
    }

    this.logger.debug('Cache hit', { key });
    return cached.data as T;
  }

  /**
   * Store data in cache
   */
  async set<T>(key: string, data: T, ttlSeconds?: number): Promise<void> {
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;
    const expires = new Date(Date.now() + ttlMs);
    
    this.cache.set(key, { data, expires });
    this.logger.debug('Data cached', { key, expires });
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.debug('Cache deleted', { key });
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Clean expired entries
   */
  async cleanExpired(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (value.expires < now) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug('Cleaned expired cache entries', { count: cleanedCount });
    }
    
    return cleanedCount;
  }
}