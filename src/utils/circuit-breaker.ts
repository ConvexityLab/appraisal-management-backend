/**
 * Circuit Breaker (A-05)
 *
 * Opens after `failureThreshold` consecutive failures within `windowMs`,
 * blocks calls for `openMs`, then transitions to half-open: the next call
 * probes the dependency and either closes (on success) or re-opens.
 *
 * A failure is whatever the caller decides — pass errors into `record()`
 * or wrap the dependency call with `execute()`. 5xx detection lives in the
 * axiom-specific wrapper below.
 */

import { Logger } from './logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  /** Consecutive failures before opening. */
  failureThreshold?: number;
  /** How long the breaker stays open before allowing one probe (ms). */
  openMs?: number;
  /** Optional logger override (defaults to `CircuitBreaker`). */
  logger?: Logger;
}

export class CircuitBreakerOpenError extends Error {
  constructor(name: string, retryAfterMs: number) {
    super(`Circuit breaker [${name}] is OPEN; retry after ${retryAfterMs}ms`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private readonly logger: Logger;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly openMs: number;
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.openMs = opts.openMs ?? 60_000;
    this.logger = opts.logger ?? new Logger(`CircuitBreaker:${this.name}`);
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && this.openedAt != null) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.openMs) {
        this.state = 'HALF_OPEN';
        this.logger.info('Transitioning to HALF_OPEN — next call probes the dependency');
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    if (this.state !== 'CLOSED') {
      this.logger.info('Probe succeeded — closing circuit');
    }
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  recordFailure(reason?: string): void {
    this.consecutiveFailures += 1;
    if (this.state === 'HALF_OPEN') {
      this.trip(reason ?? 'probe failed from HALF_OPEN');
      return;
    }
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.trip(reason ?? `${this.consecutiveFailures} consecutive failures`);
    }
  }

  private trip(reason: string): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    this.logger.warn('Circuit OPENED — blocking calls', { reason, openMs: this.openMs });
  }

  /** Wrap a call with the breaker. Throws `CircuitBreakerOpenError` when open. */
  async execute<T>(fn: () => Promise<T>, isFailure?: (err: unknown) => boolean): Promise<T> {
    const state = this.getState();
    if (state === 'OPEN') {
      const retryAfter = this.openMs - (Date.now() - (this.openedAt ?? 0));
      throw new CircuitBreakerOpenError(this.name, Math.max(0, retryAfter));
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      if (!isFailure || isFailure(err)) {
        this.recordFailure(err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
}

/** A 5xx error (HTTP or axios-like) — what we care about for the Axiom breaker. */
export function isServerError(err: unknown): boolean {
  const e = err as any;
  const status = e?.status ?? e?.statusCode ?? e?.response?.status;
  return typeof status === 'number' && status >= 500 && status < 600;
}
