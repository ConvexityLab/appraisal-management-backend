/**
 * Rate Limiting Middleware for Property Intelligence API
 * 
 * Implements intelligent rate limiting to protect expensive geospatial operations
 * Uses memory-based storage with sliding window algorithm
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates a rate limiter middleware with specified limits
 * @param maxRequests Maximum requests allowed per window
 * @param windowMs Window duration in milliseconds (default: 1 minute)
 * @param keyGenerator Function to generate unique keys for rate limiting
 */
export function rateLimiter(
  maxRequests: number,
  windowMs: number = 60 * 1000, // 1 minute default
  keyGenerator?: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Generate unique key for rate limiting
      const key = keyGenerator ? keyGenerator(req) : `${req.ip}:${req.path}`;
      const now = Date.now();
      
      // Get or create rate limit entry
      let entry = rateLimitStore.get(key);
      
      if (!entry || now > entry.resetTime) {
        // Create new entry or reset expired entry
        entry = {
          count: 1,
          resetTime: now + windowMs,
          firstRequest: now
        };
        rateLimitStore.set(key, entry);
      } else {
        // Increment counter for existing entry
        entry.count++;
      }

      // Check if limit exceeded
      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        
        logger.warn('Rate limit exceeded', {
          key,
          count: entry.count,
          maxRequests,
          retryAfter,
          path: req.path
        });

        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter,
          metadata: {
            processingTime: 0,
            dataSourcesUsed: [],
            lastUpdated: new Date(),
            cacheHit: false
          }
        });
        return;
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString(),
        'X-RateLimit-Window': Math.ceil(windowMs / 1000).toString()
      });

      // Log rate limit status for monitoring
      if (entry.count > maxRequests * 0.8) {
        logger.info('Rate limit warning', {
          key,
          count: entry.count,
          maxRequests,
          percentage: Math.round((entry.count / maxRequests) * 100),
          path: req.path
        });
      }

      next();

    } catch (error) {
      logger.error('Rate limiter error', { error, path: req.path });
      // Don't block requests on rate limiter errors
      next();
    }
  };
}

/**
 * Advanced rate limiter with burst allowance and different limits for different operations
 */
export function adaptiveRateLimiter(config: {
  standardRequests: number;
  burstRequests: number;
  burstWindowMs: number;
  standardWindowMs: number;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();

    // Check burst limits (short window)
    const burstKey = `${key}:burst`;
    let burstEntry = rateLimitStore.get(burstKey);
    
    if (!burstEntry || now > burstEntry.resetTime) {
      burstEntry = {
        count: 1,
        resetTime: now + config.burstWindowMs,
        firstRequest: now
      };
      rateLimitStore.set(burstKey, burstEntry);
    } else {
      burstEntry.count++;
    }

    if (burstEntry.count > config.burstRequests) {
      const retryAfter = Math.ceil((burstEntry.resetTime - now) / 1000);
      
      res.status(429).json({
        success: false,
        error: 'Burst rate limit exceeded',
        retryAfter,
        metadata: {
          processingTime: 0,
          dataSourcesUsed: [],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });
      return;
    }

    // Check standard limits (longer window)
    const standardKey = `${key}:standard`;
    let standardEntry = rateLimitStore.get(standardKey);
    
    if (!standardEntry || now > standardEntry.resetTime) {
      standardEntry = {
        count: 1,
        resetTime: now + config.standardWindowMs,
        firstRequest: now
      };
      rateLimitStore.set(standardKey, standardEntry);
    } else {
      standardEntry.count++;
    }

    if (standardEntry.count > config.standardRequests) {
      const retryAfter = Math.ceil((standardEntry.resetTime - now) / 1000);
      
      res.status(429).json({
        success: false,
        error: 'Standard rate limit exceeded',
        retryAfter,
        metadata: {
          processingTime: 0,
          dataSourcesUsed: [],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });
      return;
    }

    // Set headers for both limits
    res.set({
      'X-RateLimit-Burst-Limit': config.burstRequests.toString(),
      'X-RateLimit-Burst-Remaining': Math.max(0, config.burstRequests - burstEntry.count).toString(),
      'X-RateLimit-Standard-Limit': config.standardRequests.toString(),
      'X-RateLimit-Standard-Remaining': Math.max(0, config.standardRequests - standardEntry.count).toString()
    });

    next();
  };
}

/**
 * Rate limiter with different limits based on API key tier
 */
export function tieredRateLimiter(defaultLimit: number, premiumLimit: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user has premium tier (implement your logic)
    const apiKey = req.get('X-API-Key');
    const isPremium = checkPremiumTier(apiKey);
    
    const maxRequests = isPremium ? premiumLimit : defaultLimit;
    
    // Use standard rate limiter with dynamic limit
    rateLimiter(maxRequests)(req, res, next);
  };
}

/**
 * Check if API key has premium tier access
 * In production, this would query a database or cache
 */
function checkPremiumTier(apiKey?: string): boolean {
  if (!apiKey) return false;
  
  // Validate API key against configured premium keys or database
  if (process.env.NODE_ENV === 'production') {
    // In production, validate against environment variable or database
    const premiumApiKeys = process.env.PREMIUM_API_KEYS?.split(',') || [];
    const isValidPremiumKey = premiumApiKeys.includes(apiKey);
    
    if (!isValidPremiumKey) {
      logger.warn('Invalid premium API key', { apiKey: apiKey.substring(0, 8) + '...' });
    }
    
    return isValidPremiumKey;
  }
  
  // Development mode: allow specific test keys
  const devTestKeys = new Set([
    'dev-premium-key-1',
    'dev-premium-key-2'
  ]);
  
  return devTestKeys.has(apiKey);
}

/**
 * Export commonly used rate limiters
 */
export const standardRateLimit = rateLimiter(100); // 100 requests per minute
export const restrictiveRateLimit = rateLimiter(20); // 20 requests per minute
export const permissiveRateLimit = rateLimiter(500); // 500 requests per minute

/**
 * Get rate limit statistics for monitoring
 */
export function getRateLimitStats(): {
  totalKeys: number;
  activeEntries: number;
  topConsumers: Array<{ key: string; count: number; resetTime: number }>;
} {
  const now = Date.now();
  const activeEntries = Array.from(rateLimitStore.entries())
    .filter(([, entry]) => now <= entry.resetTime)
    .map(([key, entry]) => ({ key, count: entry.count, resetTime: entry.resetTime }))
    .sort((a, b) => b.count - a.count);

  return {
    totalKeys: rateLimitStore.size,
    activeEntries: activeEntries.length,
    topConsumers: activeEntries.slice(0, 10)
  };
}