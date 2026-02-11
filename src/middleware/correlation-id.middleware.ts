/**
 * Correlation ID Middleware
 * Adds unique correlation ID to each request for distributed tracing
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/logger.js';
import { AsyncLocalStorage } from 'async_hooks';

const logger = new Logger();

// Define global type augmentation
declare global {
  var asyncLocalStorage: AsyncLocalStorage<Map<string, string>> | undefined;
}

export interface CorrelationRequest extends Request {
  correlationId?: string;
}

/**
 * Middleware to add correlation ID to requests
 * Checks for existing X-Correlation-ID header, or generates new one
 */
export function correlationIdMiddleware(
  req: CorrelationRequest,
  res: Response,
  next: NextFunction
): void {
  // Check if correlation ID already exists in headers
  const existingId = req.headers['x-correlation-id'] as string;
  const correlationId = existingId || randomUUID();
  
  // Attach to request object
  req.correlationId = correlationId;
  
  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Store in async local storage if available (for access in services)
  if (global.asyncLocalStorage) {
    global.asyncLocalStorage.run(new Map([['correlationId', correlationId]]), () => {
      next();
    });
  } else {
    next();
  }
}

/**
 * Enhanced request logging middleware with correlation ID
 */
export function requestLoggingMiddleware(
  req: CorrelationRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;
  const correlationId = req.correlationId || 'unknown';
  
  // Log request
  logger.info('Incoming request', {
    correlationId,
    method,
    url: originalUrl,
    ip: ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  
  // Capture response
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Override json method to log response
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      correlationId,
      method,
      url: originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
    return originalJson.call(this, body);
  };
  
  // Override send method to log response
  res.send = function (body: any) {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      correlationId,
      method,
      url: originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
    return originalSend.call(this, body);
  };
  
  // Log errors
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', {
        correlationId,
        method,
        url: originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    }
  });
  
  next();
}

/**
 * Get correlation ID from current request context
 */
export function getCorrelationId(): string | undefined {
  if (global.asyncLocalStorage) {
    const store = global.asyncLocalStorage.getStore() as Map<string, string> | undefined;
    return store?.get('correlationId');
  }
  return undefined;
}
