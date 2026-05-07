/**
 * UCDP / EAD Auto-Submit Service
 *
 * Listens to `order.delivered` and, when the loan type requires GSE submission
 * (conventional → UCDP, FHA → EAD), automatically:
 *   1. Triggers MISMO 3.4 XML generation via FinalReportService
 *   2. Downloads the XML blob content
 *   3. Submits to the appropriate portal via UCDPEADSubmissionService
 *
 * GSE submission is SKIPPED for:
 *   - Cash / portfolio loans (no loanType or loanType === 'cash' | 'jumbo' | 'portfolio')
 *   - Orders that already have a completed submission record (idempotency)
 *   - Orders missing a generated final report (submission will be attempted later via manual trigger)
 *
 * Transport: uses the `ucdp-ead-auto-submit-service` Service Bus subscription on
 * the `appraisal-events` topic, so it receives its own copy of every event.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { BlobStorageService } from './blob-storage.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { FinalReportService } from './final-report.service.js';
import { UCDPEADSubmissionService } from './ucdp-ead-submission.service.js';
import {
  OrderContextLoader,
  getLoanInformation,
} from './order-context-loader.service.js';
import type { SubmissionPortal } from './ucdp-ead-submission.service.js';
import type { BaseEvent, EventHandler, OrderDeliveredEvent } from '../types/events.js';

// Loan types that require GSE portal submission
const GSE_LOAN_TYPES: Record<string, SubmissionPortal> = {
  conventional: 'UCDP',
  conforming:   'UCDP',
  fannie_mae:   'UCDP',
  freddie_mac:  'UCDP',
  fha:          'EAD',
  'fha-203k':   'EAD',
};

export class UcdpEadAutoSubmitService {
  private readonly logger = new Logger('UcdpEadAutoSubmitService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly finalReportService: FinalReportService;
  private readonly submissionService: UCDPEADSubmissionService;
  private readonly blobService: BlobStorageService;
  private readonly dbService: CosmosDbService;
  private readonly contextLoader: OrderContextLoader;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.blobService = new BlobStorageService();
    this.finalReportService = new FinalReportService(this.dbService);
    this.submissionService = new UCDPEADSubmissionService(this.dbService);
    this.contextLoader = new OrderContextLoader(this.dbService);
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'ucdp-ead-auto-submit-service',
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('UcdpEadAutoSubmitService already started');
      return;
    }

    await this.subscriber.subscribe<OrderDeliveredEvent>(
      'order.delivered',
      this.makeHandler('order.delivered', this.onOrderDelivered.bind(this)),
    );

    this.isStarted = true;
    this.logger.info('UcdpEadAutoSubmitService started — listening for order.delivered');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('order.delivered');
    this.isStarted = false;
    this.logger.info('UcdpEadAutoSubmitService stopped');
  }

  // ── Handler ────────────────────────────────────────────────────────────────

  private async onOrderDelivered(event: OrderDeliveredEvent): Promise<void> {
    const { orderId, tenantId } = event.data;
    this.logger.info('order.delivered received — evaluating GSE submission requirement', {
      orderId,
      tenantId,
    });

    // Load order context (joined VendorOrder + parent ClientOrder) so loan
    // info resolves from its proper home post Phase 4. Phase 7 of the
    // Order-relocation refactor.
    let ctx;
    try {
      ctx = await this.contextLoader.loadByVendorOrderId(orderId);
    } catch {
      this.logger.warn('UcdpEadAutoSubmit: order not found — skipping', { orderId });
      return;
    }
    const orderResult = ctx.vendorOrder as any;
    const loanInfo = getLoanInformation(ctx);
    const loanType = (loanInfo?.loanType ?? '').toLowerCase();
    const portal = GSE_LOAN_TYPES[loanType];

    if (!portal) {
      this.logger.info('UcdpEadAutoSubmit: loan type does not require GSE submission — skipping', {
        orderId,
        loanType: loanType || '(none)',
      });
      return;
    }

    this.logger.info('GSE submission required — generating MISMO XML and submitting', {
      orderId,
      loanType,
      portal,
    });

    let xmlContent: string;
    try {
      xmlContent = await this.generateAndLoadXml(orderId);
    } catch (err) {
      // Missing final report or generation failure — log and skip; coordinator can
      // trigger manually via POST /api/final-reports/orders/:orderId/mismo-xml.
      this.logger.warn('UcdpEadAutoSubmit: MISMO XML generation failed — skipping auto-submit', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const loanNumber  = (loanInfo as { loanNumber?: string } | undefined)?.loanNumber ?? orderId;
    const lenderId    = orderResult.clientId ?? '';

    try {
      const result = await this.submissionService.submit({
        orderId,
        tenantId,
        portal,
        xmlContent,
        loanNumber,
        lenderId,
      });

      if (result.isAccepted) {
        this.logger.info('UcdpEadAutoSubmit: submission accepted', {
          orderId,
          portal,
          portalDocumentId: result.submission.portalDocumentId,
          warnings: result.warningCount,
        });
      } else {
        this.logger.warn('UcdpEadAutoSubmit: submission rejected or has hard stops', {
          orderId,
          portal,
          hardStops: result.hardStopCount,
          warnings: result.warningCount,
        });
      }
    } catch (err) {
      // Submission failure is non-fatal — the record is persisted by UCDPEADSubmissionService
      // and can be retried via the status-check job.
      this.logger.error('UcdpEadAutoSubmit: submission call failed', {
        orderId,
        portal,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Generate MISMO XML (idempotent) and return the raw XML string by reading from blob.
   */
  private async generateAndLoadXml(orderId: string): Promise<string> {
    const { blobPath } = await this.finalReportService.generateMismoXmlForReport(
      orderId,
      'ucdp-ead-auto-submit',
    );

    const { readableStream } = await this.blobService.downloadBlob('orders', blobPath);
    return this.streamToString(readableStream);
  }

  private streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
  }

  /**
   * @deprecated Replaced by OrderContextLoader.loadByVendorOrderId in Phase 7
   *   of the Order-relocation refactor. Kept as a private method so the type
   *   shape is documented for future maintenance, but no longer called.
   */
  private async loadOrderData(orderId: string, _tenantId: string): Promise<{
    id: string;
    tenantId: string;
    clientId?: string;
    loanInformation?: { loanType?: string; loanNumber?: string };
  } | null> {
    try {
      const rows = await this.dbService.queryDocuments<{
        id: string;
        tenantId: string;
        clientId?: string;
        loanInformation?: { loanType?: string; loanNumber?: string };
      }>(
        'orders',
        'SELECT c.id, c.tenantId, c.clientId, c.loanInformation FROM c WHERE c.id = @orderId',
        [{ name: '@orderId', value: orderId }],
      );
      return rows[0] ?? null;
    } catch (err) {
      this.logger.error('Failed to load order for UCDP/EAD check', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private makeHandler<T extends BaseEvent>(
    eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    return {
      handle: async (event: T) => {
        this.logger.debug(`Handling ${eventType}`, { eventId: event.id });
        await fn(event);
      },
    };
  }
}
