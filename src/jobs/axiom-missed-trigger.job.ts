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
import { AxiomService } from '../services/axiom.service.js';
import { BlobStorageService } from '../services/blob-storage.service.js';
import { ANALYSIS_TYPE_TO_AXIOM_PROGRAM } from '../types/bulk-portfolio.types.js';
import type { BulkIngestionJob } from '../types/bulk-ingestion.types.js';

export class AxiomMissedTriggerJob {
  private readonly logger = new Logger('AxiomMissedTriggerJob');
  private readonly tenantConfigService: TenantAutomationConfigService;
  private readonly axiomService: AxiomService;
  private readonly blobStorageService: BlobStorageService;

  public isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private initialDelayId?: NodeJS.Timeout;

  private readonly CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly LOOK_BACK_MS = 48 * 60 * 60 * 1000; // 48 hours
  /** Bulk ingestion extractions stalled longer than this will be re-submitted. */
  private readonly BULK_EXTRACTION_STALL_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly dbService: CosmosDbService,
    private readonly autoTriggerService: AxiomAutoTriggerService,
  ) {
    this.tenantConfigService = new TenantAutomationConfigService();
    this.axiomService = new AxiomService(this.dbService);
    this.blobStorageService = new BlobStorageService();
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
      this.recoverStalledBulkExtractions().catch((err) =>
        this.logger.error('Error in initial stalled-bulk-extraction recovery', {
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
      this.recoverStalledBulkExtractions().catch((err) =>
        this.logger.error('Error in stalled-bulk-extraction recovery', {
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
          WHERE (c.type = 'vendor-order' OR c.type = 'order')
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
        config = await this.tenantConfigService.getConfig(order.clientId);
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

  // ── Bulk-ingestion stalled extraction recovery ─────────────────────────────

  /**
   * Finds bulk-ingestion job items whose Axiom extraction has been stuck in
   * AXIOM_PENDING for longer than BULK_AXIOM_STALL_MINUTES (default 30) and
   * re-submits them.
   *
   * Axiom extraction state lives in `item.canonicalRecord` (a plain object)
   * embedded within the BulkIngestionJob Cosmos document.
   */
  private async recoverStalledBulkExtractions(): Promise<void> {
    const stallMs =
      Number(process.env['BULK_AXIOM_STALL_MINUTES'] ?? 30) * 60_000;
    const stalledCutoff = new Date(Date.now() - stallMs).toISOString();

    // Query jobs that have at least one item with a stalled extraction.
    // Cosmos supports JOIN over arrays embedded in the document.
    const query = `
      SELECT DISTINCT VALUE c FROM c
      JOIN item IN c.items
      WHERE c.type = 'bulk-ingestion-job'
        AND item.canonicalRecord.axiomExtractionStatus = 'AXIOM_PENDING'
        AND item.canonicalRecord.axiomSubmittedAt < @stalledCutoff
    `;

    let stalledJobs: BulkIngestionJob[];
    try {
      const stalledJobsResponse = await this.dbService.queryItems<BulkIngestionJob>(
        'bulk-portfolio-jobs',
        query,
        [{ name: '@stalledCutoff', value: stalledCutoff }],
      );

      if (!stalledJobsResponse.success) {
        throw new Error(
          stalledJobsResponse.error?.message ??
            'Failed to query stalled bulk-ingestion extraction jobs',
        );
      }

      stalledJobs = stalledJobsResponse.data ?? [];
    } catch (err) {
      this.logger.error('recoverStalledBulkExtractions: failed to query stalled jobs', {
        error: (err as Error).message,
      });
      return;
    }

    const containerName = process.env['STORAGE_CONTAINER_DOCUMENTS'];
    if (!containerName) {
      throw new Error(
        'recoverStalledBulkExtractions: STORAGE_CONTAINER_DOCUMENTS env var is not set',
      );
    }

    let totalStalled = 0;
    let recovered = 0;
    let failed = 0;

    for (const job of stalledJobs) {
      const { programId, programVersion } = ANALYSIS_TYPE_TO_AXIOM_PROGRAM[job.analysisType];

      for (const item of job.items) {
        const cr = item.canonicalRecord as Record<string, unknown> | undefined;
        if (
          !cr ||
          cr['axiomExtractionStatus'] !== 'AXIOM_PENDING' ||
          !cr['axiomSubmittedAt'] ||
          (cr['axiomSubmittedAt'] as string) >= stalledCutoff
        ) {
          continue;
        }

        totalStalled++;

        const documentBlobName = cr['documentBlobName'] as string | undefined;
        if (!documentBlobName) {
          this.logger.warn('recoverStalledBulkExtractions: no documentBlobName on item', {
            jobId: job.id,
            itemId: item.id,
          });
          failed++;
          continue;
        }

        try {
          const blobSasUrl = await this.blobStorageService.generateReadSasUrl(
            containerName,
            documentBlobName,
          );

          const correlationId = cr['axiomCorrelationId'] as string | undefined
            ?? `recover-${job.id}-${item.id}`;
          const fileName = documentBlobName.split('/').pop() ?? documentBlobName;

          const submitResult = await this.axiomService.submitDocumentForSchemaExtraction({
            documentId: correlationId,
            blobSasUrl,
            fileName,
            documentType: 'APPRAISAL_REPORT',
            tenantId: job.tenantId,
            clientId: job.clientId,
            subClientId: job.subClientId ?? '',
            programId,
            programVersion,
          });

          if (!submitResult) {
            failed++;
            this.logger.warn('recoverStalledBulkExtractions: re-submission returned null', {
              jobId: job.id,
              itemId: item.id,
            });
            continue;
          }

          // Refresh the submitted-at timestamp so it won't trigger again immediately
          item.canonicalRecord = {
            ...cr,
            axiomSubmittedAt: new Date().toISOString(),
            axiomPipelineJobId: submitResult.pipelineJobId,
          };
          item.updatedAt = new Date().toISOString();

          recovered++;
          this.logger.info('recoverStalledBulkExtractions: re-submitted stalled item', {
            jobId: job.id,
            itemId: item.id,
            correlationId,
          });
        } catch (err) {
          failed++;
          this.logger.error('recoverStalledBulkExtractions: failed to recover item', {
            jobId: job.id,
            itemId: item.id,
            error: (err as Error).message,
          });
        }
      }

      // Persist updated job items back to Cosmos (single upsert per job)
      if (recovered > 0) {
        try {
          await this.dbService.upsertItem('bulk-portfolio-jobs', job);
        } catch (err) {
          this.logger.error('recoverStalledBulkExtractions: failed to persist job after recovery', {
            jobId: job.id,
            error: (err as Error).message,
          });
        }
      }
    }

    if (totalStalled > 0) {
      this.logger.info('recoverStalledBulkExtractions: run complete', {
        stalledJobs: stalledJobs.length,
        totalStalled,
        recovered,
        failed,
      });
    }
  }
}
