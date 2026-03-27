/**
 * AxiomMissedTriggerJob — Unit Tests
 *
 * Coverage:
 *   recoverMissedTriggers
 *     ✓ Skips execution when autoTriggerService.isRunning is false
 *     ✓ Recovers candidates and calls triggerForOrder for each
 *     ✓ Skips candidates that have no tenantId
 *     ✓ Skips candidates whose tenant has axiomAutoTrigger=false
 *     ✓ Skips candidates when getConfig throws
 *     ✓ Continues processing remaining candidates after one triggerForOrder failure
 *     ✓ Does nothing when no candidates are returned by the query
 *     ✓ Does not throw when the Cosmos query itself fails
 *
 *   Lifecycle
 *     ✓ start() sets isRunning=true
 *     ✓ stop() clears the interval and sets isRunning=false
 *     ✓ start() is idempotent (second call is a no-op)
 *
 * All external dependencies are mocked/stubbed.
 * Run: pnpm test:unit
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── TenantAutomationConfigService mock ───────────────────────────────────────

const mockGetConfig = vi.fn();

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: mockGetConfig,
  })),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { AxiomMissedTriggerJob } from '../../src/jobs/axiom-missed-trigger.job.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(id: string, tenantId = 'tenant-1') {
  return { id, tenantId, orderNumber: `ORD-${id}`, axiomStatus: null };
}

/** Creates an order without a tenantId field, as Cosmos would return when missing. */
function makeOrderNoTenant(id: string) {
  return { id, orderNumber: `ORD-${id}`, axiomStatus: null };
}

function createDb(candidates: any[]) {
  const mockFetchAll = vi.fn().mockResolvedValue({ resources: candidates });
  const mockQuery = vi.fn().mockReturnValue({ fetchAll: mockFetchAll });
  const getContainer = vi.fn().mockReturnValue({
    items: { query: mockQuery },
  });
  return { getContainer, _mockFetchAll: mockFetchAll, _mockQuery: mockQuery };
}

function createAutoTrigger(isRunning = true) {
  return {
    isRunning,
    triggerForOrder: vi.fn().mockResolvedValue(undefined),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('AxiomMissedTriggerJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Default: tenant has axiomAutoTrigger enabled
    mockGetConfig.mockResolvedValue({ axiomAutoTrigger: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('start() sets isRunning to true', () => {
      const db = createDb([]);
      const trigger = createAutoTrigger(false);
      const job = new AxiomMissedTriggerJob(db as any, trigger as any);
      job.start();
      expect((job as any).isRunning).toBe(true);
      job.stop();
    });

    it('stop() sets isRunning to false and clears the interval', () => {
      const db = createDb([]);
      const trigger = createAutoTrigger(false);
      const job = new AxiomMissedTriggerJob(db as any, trigger as any);
      job.start();
      job.stop();
      expect((job as any).isRunning).toBe(false);
      expect((job as any).intervalId).toBeUndefined();
      expect((job as any).initialDelayId).toBeUndefined();
    });

    it('start() is idempotent — second call is a no-op', () => {
      const db = createDb([]);
      const trigger = createAutoTrigger(false);
      const job = new AxiomMissedTriggerJob(db as any, trigger as any);
      job.start();
      const firstIntervalId = (job as any).intervalId;
      job.start(); // second call
      expect((job as any).intervalId).toBe(firstIntervalId);
      job.stop();
    });
  });

  // ── recoverMissedTriggers ─────────────────────────────────────────────────

  describe('recoverMissedTriggers()', () => {
    /** Helper: marks the job as running without triggering the real timers. */
    function startedJob(job: AxiomMissedTriggerJob): AxiomMissedTriggerJob {
      (job as any).isRunning = true;
      return job;
    }

    it('is a no-op when the job itself has been stopped (guards post-stop timer fires)', async () => {
      const db = createDb([makeOrder('ord-1')]);
      const trigger = createAutoTrigger(true);
      const job = new AxiomMissedTriggerJob(db as any, trigger as any);
      // isRunning is false (job never started) — simulates a stopped-job timer callback
      await (job as any).recoverMissedTriggers();
      expect(trigger.triggerForOrder).not.toHaveBeenCalled();
    });

    it('skips execution when autoTriggerService.isRunning is false', async () => {
      const db = createDb([makeOrder('ord-1')]);
      const trigger = createAutoTrigger(false); // auto-trigger subscription not live
      const job = startedJob(new AxiomMissedTriggerJob(db as any, trigger as any));
      await (job as any).recoverMissedTriggers();
      expect(trigger.triggerForOrder).not.toHaveBeenCalled();
    });

    it('does nothing when no candidates are returned', async () => {
      const db = createDb([]); // empty result
      const trigger = createAutoTrigger(true);
      const job = startedJob(new AxiomMissedTriggerJob(db as any, trigger as any));
      await (job as any).recoverMissedTriggers();
      expect(trigger.triggerForOrder).not.toHaveBeenCalled();
    });

    it('calls triggerForOrder for each qualifying candidate', async () => {
      const db = createDb([makeOrder('ord-1'), makeOrder('ord-2')]);
      const trigger = createAutoTrigger(true);
      const job = startedJob(new AxiomMissedTriggerJob(db as any, trigger as any));
      await (job as any).recoverMissedTriggers();
      expect(trigger.triggerForOrder).toHaveBeenCalledTimes(2);
      expect(trigger.triggerForOrder).toHaveBeenCalledWith('ord-1');
      expect(trigger.triggerForOrder).toHaveBeenCalledWith('ord-2');
    });

    it('skips candidates that have no tenantId', async () => {
      const db = createDb([
        makeOrderNoTenant('ord-1'), // no tenantId field
        makeOrder('ord-2', 'tenant-2'),
      ]);
      const trigger = createAutoTrigger(true);
      const job = startedJob(new AxiomMissedTriggerJob(db as any, trigger as any));
      await (job as any).recoverMissedTriggers();
      expect(trigger.triggerForOrder).toHaveBeenCalledTimes(1);
      expect(trigger.triggerForOrder).toHaveBeenCalledWith('ord-2');
    });

    it('skips candidates when tenant has axiomAutoTrigger=false', async () => {
      const db = createDb([makeOrder('ord-1', 'opt-out-tenant')]);
      const trigger = createAutoTrigger(true);
      mockGetConfig.mockResolvedValue({ axiomAutoTrigger: false });
      const job = startedJob(new AxiomMissedTriggerJob(db as any, trigger as any));
      await (job as any).recoverMissedTriggers();
      expect(trigger.triggerForOrder).not.toHaveBeenCalled();
    });

    it('skips candidates when getConfig throws (avoids crashing the whole run)', async () => {
      const db = createDb([makeOrder('ord-1'), makeOrder('ord-2')]);
      const trigger = createAutoTrigger(true);
      // First tenant config throws; second succeeds
      mockGetConfig
        .mockRejectedValueOnce(new Error('config service down'))
        .mockResolvedValueOnce({ axiomAutoTrigger: true });
      const job = startedJob(new AxiomMissedTriggerJob(db as any, trigger as any));
      await (job as any).recoverMissedTriggers();
      // Only the second candidate (ord-2) should be triggered
      expect(trigger.triggerForOrder).toHaveBeenCalledTimes(1);
      expect(trigger.triggerForOrder).toHaveBeenCalledWith('ord-2');
    });

    it('continues processing remaining candidates after one triggerForOrder failure', async () => {
      const db = createDb([makeOrder('ord-1'), makeOrder('ord-2'), makeOrder('ord-3')]);
      const trigger = createAutoTrigger(true);
      // ord-1 fails; ord-2 and ord-3 succeed
      trigger.triggerForOrder
        .mockRejectedValueOnce(new Error('submit failed'))
        .mockResolvedValue(undefined);
      const job = startedJob(new AxiomMissedTriggerJob(db as any, trigger as any));
      await (job as any).recoverMissedTriggers();
      expect(trigger.triggerForOrder).toHaveBeenCalledTimes(3);
    });

    it('does not throw when the Cosmos query itself fails', async () => {
      const db = createDb([]);
      // Make the query throw
      db.getContainer.mockReturnValue({
        items: {
          query: vi.fn().mockReturnValue({
            fetchAll: vi.fn().mockRejectedValue(new Error('Cosmos unavailable')),
          }),
        },
      });
      const trigger = createAutoTrigger(true);
      const job = startedJob(new AxiomMissedTriggerJob(db as any, trigger as any));
      // Should complete without throwing
      await expect((job as any).recoverMissedTriggers()).resolves.toBeUndefined();
      expect(trigger.triggerForOrder).not.toHaveBeenCalled();
    });
  });
});
