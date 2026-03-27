/**
 * Axiom Missed-Trigger Recovery Job
 *
 * Finds orders that were SUBMITTED but never had an Axiom evaluation kicked
 * off — i.e. `status = 'SUBMITTED'`, `axiomStatus` is absent, null, or
 * 'skipped-no-documents', and `axiomSubmittedAt` is absent.
 *
 * For each candidate order:
 *   1. Verifies the tenant has `axiomAutoTrigger = true`.
 *   2. Calls `AxiomAutoTriggerService.triggerForOrder(orderId)` to submit.
 *      That method guards idempotency internally.
 *
 * This job compensates for:
 *   - Service Bus messages that were dead-lettered before the auto-trigger
 *     service had a chance to process them (e.g. during a deployment window).
 *   - Restarts where the auto-trigger subscription was not yet active.
 *
 * Interval: 15 minutes.
 * Look-back window: 48 hours.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AxiomAutoTriggerService } from '../services/axiom-auto-trigger.service.js';
import { TenantAutomationConfigService } from '../services/tenant-automation-config.service.js';

export class AxiomMissedTriggerJob {
  private readonly logger = new Logger('AxiomMissedTriggerJob');
  private readonly tenantConfigService: TenantAutomationConfigService;

  public isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private initialDelayId?: NodeJS.Timeout;

  private readonly CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly LOOK_BACK_MS = 48 * 60 * 60 * 1000; // 48 hours

  constructor(
    private readonly dbService: CosmosDbService,
    private readonly autoTriggerService: AxiomAutoTriggerService,
  ) {
    this.tenantConfigService = new TenantAutomationConfigService();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) {
      this.logger.warn('AxiomMissedTriggerJob already running');
      return;
    }
    this.isRunning = true;
    this.logger.info('AxiomMissedTriggerJob started', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60_000,
      lookBackHours: this.LOOK_BACK_MS / 3_600_000,
    });

    // Initial check after a short delay (let auto-trigger service come up first)
    this.initialDelayId = setTimeout(() => {
      delete this.initialDelayId;
      this.recoverMissedTriggers().catch((err) =>
        this.logger.error('Error in initial missed-trigger recovery', {
          error: (err as Error).message,
        }),
      );
    }, 60_000); // 1 minute startup delay
    this.initialDelayId.unref?.();

    this.intervalId = setInterval(() => {
      this.recoverMissedTriggers().catch((err) =>
        this.logger.error('Error in missed-trigger recovery', {
          error: (err as Error).message,
        }),
      );
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.initialDelayId) {
      clearTimeout(this.initialDelayId);
      delete this.initialDelayId;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      delete this.intervalId;
    }
    this.isRunning = false;
    this.logger.info('AxiomMissedTriggerJob stopped');
  }

  // ── Core scan ──────────────────────────────────────────────────────────────

  private async recoverMissedTriggers(): Promise<void> {
    // Guard against post-stop execution (e.g. if initial delay fires after stop()).
    if (!this.isRunning) return;

    // Only run recovery when the auto-trigger subscription itself is active.
    if (!this.autoTriggerService.isRunning) {
      this.logger.debug('AxiomMissedTriggerJob: auto-trigger service not running — skipping recovery');
      return;
    }

    const cutoff = new Date(Date.now() - this.LOOK_BACK_MS).toISOString();

    let candidates: any[];
    try {
      const container = this.dbService.getContainer('orders');
      const { resources } = await container.items.query({
        query: `
          SELECT c.id, c.tenantId, c.orderNumber, c.submittedAt, c.axiomStatus
          FROM c
          WHERE c.type = 'order'
            AND c.status = 'SUBMITTED'
            AND (NOT IS_DEFINED(c.axiomSubmittedAt) OR IS_NULL(c.axiomSubmittedAt))
            AND (
              NOT IS_DEFINED(c.axiomStatus)
              OR IS_NULL(c.axiomStatus)
              OR c.axiomStatus = 'skipped-no-documents'
              OR c.axiomStatus = 'submit-failed'
            )
            AND c.submittedAt > @cutoff
        `,
        parameters: [{ name: '@cutoff', value: cutoff }],
      }).fetchAll();
      candidates = resources;
    } catch (err) {
      this.logger.error('AxiomMissedTriggerJob: failed to query candidates', {
        error: (err as Error).message,
      });
      return;
    }

    if (candidates.length === 0) {
      this.logger.debug('AxiomMissedTriggerJob: no missed triggers found');
      return;
    }

    this.logger.info(`AxiomMissedTriggerJob: found ${candidates.length} candidate(s) to recover`);

    let recovered = 0;
    let skipped = 0;
    let failed = 0;

    for (const order of candidates) {
      if (!order.tenantId) {
        this.logger.warn('AxiomMissedTriggerJob: order has no tenantId — skipping', {
          orderId: order.id,
        });
        skipped++;
        continue;
      }

      // Honour per-tenant feature flag — don't push orders for tenants that
      // haven't opted in to auto-trigger.
      let config: { axiomAutoTrigger: boolean };
      try {
        config = await this.tenantConfigService.getConfig(order.tenantId);
      } catch (err) {
        this.logger.warn('AxiomMissedTriggerJob: failed to fetch tenant config — skipping', {
          orderId: order.id,
          tenantId: order.tenantId,
          error: (err as Error).message,
        });
        skipped++;
        continue;
      }

      if (!config.axiomAutoTrigger) {
        skipped++;
        continue;
      }

      try {
        await this.autoTriggerService.triggerForOrder(order.id);
        recovered++;
        this.logger.info('AxiomMissedTriggerJob: recovered missed trigger', {
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      } catch (err) {
        failed++;
        this.logger.error('AxiomMissedTriggerJob: recovery attempt failed', {
          orderId: order.id,
          error: (err as Error).message,
        });
        // Continue processing remaining candidates.
      }
    }

    this.logger.info('AxiomMissedTriggerJob: recovery run complete', {
      candidates: candidates.length,
      recovered,
      skipped,
      failed,
    });
  }
}
