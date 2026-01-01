import { Logger } from '../../utils/logger';
import { PropertyRiskAssessment } from '../../types/geospatial';

/**
 * Geospatial Cache Service
 * 
 * Manages caching of geospatial risk assessments to:
 * - Reduce API calls to external services
 * - Improve response times
 * - Handle rate limiting gracefully
 */
export class GeospatialCacheService {
  private logger: Logger;
  private cache: Map<string, { data: PropertyRiskAssessment; expires: Date }>;
  private defaultTtl: number;

  constructor() {
    this.logger = new Logger();
    this.cache = new Map();
    this.defaultTtl = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  }

  /**
   * Get cached risk assessment
   */
  async get(key: string): Promise<PropertyRiskAssessment | null> {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    if (cached.expires < new Date()) {
      this.cache.delete(key);
      return null;
    }

    this.logger.debug('Cache hit for risk assessment', { key });
    return cached.data;
  }

  /**
   * Store risk assessment in cache
   */
  async set(key: string, data: PropertyRiskAssessment, ttl?: number): Promise<void> {
    const expires = new Date(Date.now() + (ttl || this.defaultTtl));
    
    this.cache.set(key, { data, expires });
    this.logger.debug('Cached risk assessment', { key, expires });

    // Cleanup expired entries periodically
    this.cleanupExpired();
  }

  /**
   * Remove expired cache entries
   */
  private cleanupExpired(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (cached.expires < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Cleaned up expired cache entries', { cleaned });
    }
  }
}