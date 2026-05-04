/**
 * Request Timeout Middleware (B-05)
 *
 * Aborts long-running HTTP requests so a hung downstream dependency cannot
 * pin a connection open indefinitely. Works by:
 *
 *   1. Setting an AbortController signal on the request (`req.abortSignal`)
 *      so route handlers can await-abort long downstream calls.
 *   2. Listening for client disconnect (`req.on('close')`) and firing abort
 *      so dependencies that respect the signal release their work.
 *   3. Returning 504 Gateway Timeout if the response has not been sent
 *      within REQUEST_TIMEOUT_MS.
 *
 * Defaults to 30s. Upload routes (`/api/documents`) and long-polling routes
 * can be excluded by path prefix via REQUEST_TIMEOUT_EXCLUDE_PREFIXES
 * (comma-separated).
 */

import type { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';

const logger = new Logger('RequestTimeoutMiddleware');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS ?? '30000', 10);
const EXCLUDE_PREFIXES = (process.env.REQUEST_TIMEOUT_EXCLUDE_PREFIXES ?? '/api/documents,/api/bulk-ingestion')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

declare module 'express-serve-static-core' {
  interface Request {
    abortSignal?: AbortSignal;
  }
}

export function requestTimeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (EXCLUDE_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    next();
    return;
  }

  const controller = new AbortController();
  req.abortSignal = controller.signal;

  const onClientDisconnect = () => {
    if (!res.headersSent) {
      controller.abort();
    }
  };
  req.on('close', onClientDisconnect);

  const timer = setTimeout(() => {
    if (res.headersSent) return;
    controller.abort();
    logger.warn('Request timed out', {
      method: req.method,
      path: req.path,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      correlationId: (req.headers['x-correlation-id'] as string) ?? undefined,
    });
    res.status(504).json({
      success: false,
      error: {
        code: 'REQUEST_TIMEOUT',
        message: `Request exceeded ${DEFAULT_TIMEOUT_MS}ms timeout`,
      },
    });
  }, DEFAULT_TIMEOUT_MS);

  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));

  next();
}
