/**
 * MISMO XML Auto-Generate Service
 *
 * Subscribes to `order.status.changed` and, when an order transitions to
 * SUBMITTED, automatically generates the MISMO 3.4 XML via FinalReportService.
 *
 * This ensures underwriting XML is ready for QC review, UCDP/EAD submission,
 * and client delivery without requiring a manual trigger.
 *
 * Idempotency: FinalReportService.generateMismoXmlForReport is idempotent —
 * if the XML already exists on the report record, it returns the existing
 * blob path without re-generating.
 *
 * Service Bus subscription: 'mismo-auto-generate-service'
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { FinalReportService } from './final-report.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import type { BaseEvent, EventHandler, OrderStatusChangedEvent } from '../types/events.js';

export class MismoAutoGenerateService {
  private readonly logger = new Logger('MismoAutoGenerateService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly finalReportService: FinalReportService;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    const db = dbService ?? new CosmosDbService();
    this.finalReportService = new FinalReportService(db);
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'mismo-auto-generate-service',
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('MismoAutoGenerateService already started');
      return;
    }

    await this.subscriber.subscribe<OrderStatusChangedEvent>(
      'order.status.changed',
      this.makeHandler('order.status.changed', this.onOrderStatusChanged.bind(this)),
    );

    this.isStarted = true;
    this.logger.info('MismoAutoGenerateService started — listening for order.status.changed(SUBMITTED)');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('order.status.changed').catch(() => {});
    this.isStarted = false;
    this.logger.info('MismoAutoGenerateService stopped');
  }

  // ── Handler ────────────────────────────────────────────────────────────────

  private async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.data.newStatus !== 'SUBMITTED') return;

    const { orderId } = event.data;

    this.logger.info('Order SUBMITTED — triggering MISMO XML generation', { orderId });

    try {
      const { blobPath, alreadyExisted } = await this.finalReportService.generateMismoXmlForReport(
        orderId,
        'mismo-auto-generate-service',
      );

      if (alreadyExisted) {
        this.logger.info('MISMO XML already existed — skipped re-generation', { orderId, blobPath });
      } else {
        this.logger.info('MISMO XML generated successfully', { orderId, blobPath });
      }
    } catch (error) {
      // Non-fatal: MISMO XML failure should not block QC or any other workflow.
      // Log the error and let the rest of the pipeline continue.
      // Staff can trigger manual generation via the final-report API.
      this.logger.error('MISMO XML auto-generation failed — manual trigger required', {
        orderId,
        error: (error as Error).message,
      });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private makeHandler<T extends BaseEvent>(
    eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    const logger = this.logger;
    return {
      async handle(event: T): Promise<void> {
        try {
          await fn(event);
        } catch (error) {
          logger.error(`Unhandled error in ${eventType} handler`, {
            error: (error as Error).message,
            eventId: event.id,
          });
          // Re-throw so the Service Bus subscriber can dead-letter the message.
          throw error;
        }
      },
    };
  }
}
