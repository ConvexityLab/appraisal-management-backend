import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  isServerError,
} from '../../src/utils/circuit-breaker.js';

describe('CircuitBreaker (A-05)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays CLOSED under failureThreshold', () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3, openMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('trips to OPEN after consecutive failures reach threshold', () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3, openMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
  });

  it('resets failure count on success', () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3, openMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('transitions OPEN → HALF_OPEN after openMs elapses', () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2, openMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
    vi.advanceTimersByTime(1001);
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('HALF_OPEN → CLOSED on successful probe', () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2, openMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    vi.advanceTimersByTime(1001);
    expect(cb.getState()).toBe('HALF_OPEN');
    cb.recordSuccess();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('HALF_OPEN → OPEN on failed probe (without waiting for threshold)', () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 5, openMs: 1000 });
    // Force it open with fewer events via direct trip path
    for (let i = 0; i < 5; i++) cb.recordFailure();
    vi.advanceTimersByTime(1001);
    expect(cb.getState()).toBe('HALF_OPEN');
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
  });

  describe('execute()', () => {
    it('throws CircuitBreakerOpenError when open', async () => {
      const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, openMs: 1000 });
      cb.recordFailure();
      await expect(cb.execute(() => Promise.resolve(42))).rejects.toBeInstanceOf(
        CircuitBreakerOpenError,
      );
    });

    it('records success and returns the value on happy path', async () => {
      const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2, openMs: 1000 });
      cb.recordFailure();
      const result = await cb.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('only records failures matching isFailure predicate', async () => {
      const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2, openMs: 1000 });
      const predicate = (err: unknown) => (err as any).status >= 500;

      await expect(
        cb.execute(
          () => Promise.reject({ status: 404 }),
          predicate,
        ),
      ).rejects.toBeTruthy();
      await expect(
        cb.execute(
          () => Promise.reject({ status: 404 }),
          predicate,
        ),
      ).rejects.toBeTruthy();
      // Two 404s should not trip the breaker
      expect(cb.getState()).toBe('CLOSED');

      await expect(
        cb.execute(
          () => Promise.reject({ status: 500 }),
          predicate,
        ),
      ).rejects.toBeTruthy();
      await expect(
        cb.execute(
          () => Promise.reject({ status: 500 }),
          predicate,
        ),
      ).rejects.toBeTruthy();
      expect(cb.getState()).toBe('OPEN');
    });
  });

  describe('isServerError', () => {
    it('true for 500-599', () => {
      expect(isServerError({ status: 500 })).toBe(true);
      expect(isServerError({ statusCode: 503 })).toBe(true);
      expect(isServerError({ response: { status: 599 } })).toBe(true);
    });
    it('false for 4xx and non-errors', () => {
      expect(isServerError({ status: 404 })).toBe(false);
      expect(isServerError({ status: 400 })).toBe(false);
      expect(isServerError(null)).toBe(false);
      expect(isServerError(undefined)).toBe(false);
      expect(isServerError(new Error('boom'))).toBe(false);
    });
  });
});
