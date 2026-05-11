/**
 * QC Lifecycle Handler (Q-01 / Q-03 / Q-04)
 *
 * Auto-drives QC lifecycle transitions by subscribing to domain events:
 *
 *   order.status.changed (newStatus=QC_REVIEW)
 *     → ensure the order exists in the QC review queue (Q-01)
 *
 *   qc.completed (result=passed)
 *     → advance the order into delivery workflow (Q-03)
 *
 *   qc.completed (result=failed)
 *     → open a revision request automatically (Q-04)
 *
 * All handlers are idempotent — if the downstream effect is already present
 * (queue entry exists, order already past this stage, revision already open)
 * the handler logs and returns, never double-writes.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { QCReviewQueueService } from './qc-review-queue.service.js';
import {
  OrderContextLoader,
  getPropertyAddress,
} from './order-context-loader.service.js';
import type {
  OrderStatusChangedEvent,
  QCCompletedEvent,
  BaseEvent,
  EventHandler,
} from '../types/events.js';

export class QCLifecycleHandler {
  private readonly logger = new Logger('QCLifecycleHandler');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly queueService: QCReviewQueueService;
  private readonly contextLoader: OrderContextLoader;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.queueService = new QCReviewQueueService();
    this.contextLoader = new OrderContextLoader(this.dbService);
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'qc-lifecycle-handler',
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    await Promise.all([
      this.subscriber.subscribe<OrderStatusChangedEvent>(
        'order.status.changed',
        this.makeHandler('order.status.changed', this.onOrderStatusChanged.bind(this)),
      ),
      this.subscriber.subscribe<QCCompletedEvent>(
        'qc.completed',
        this.makeHandler('qc.completed', this.onQCCompleted.bind(this)),
      ),
    ]);
    this.isStarted = true;
    this.logger.info('QCLifecycleHandler started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await Promise.all([
      this.subscriber.unsubscribe('order.status.changed'),
      this.subscriber.unsubscribe('qc.completed'),
    ]);
    this.isStarted = false;
  }

  /**
   * Q-01: Auto-instantiate QC queue entry when the order transitions into
   * QC_REVIEW. The queue entry is the operational unit that drives analyst
   * assignment + SLA tracking; creating one is idempotent because we first
   * look for an existing entry for the order.
   */
  private async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    const { newStatus, orderId, tenantId } = event.data;
    if (newStatus !== 'QC_REVIEW') return;

    try {
      const existing = (await this.dbService.queryItems(
        'qc-reviews',
        'SELECT TOP 1 c.id FROM c WHERE c.orderId = @orderId',
        [{ name: '@orderId', value: orderId }],
      )) as any;
      const already = (existing?.data ?? existing?.resources ?? [])[0];
      if (already) {
        this.logger.info('QC queue entry already exists — skipping auto-instantiate', { orderId });
        return;
      }

      // Phase 7 of Order-relocation: load joined OrderContext so the QC
      // queue entry's propertyAddress comes from the parent ClientOrder
      // when the VendorOrder doesn't carry it.
      let ctx;
      try {
        ctx = await this.contextLoader.loadByVendorOrderId(orderId, { includeProperty: true });
      } catch {
        this.logger.warn('Q-01: order not found — cannot add to QC queue', { orderId });
        return;
      }
      const order = ctx.vendorOrder as any;
      const addr = getPropertyAddress(ctx);

      await this.queueService.addToQueue({
        orderId,
        orderNumber: order.orderNumber ?? orderId,
        appraisalId: order.appraisalId ?? orderId,
        appraisedValue: order.appraisedValue ?? 0,
        orderPriority: order.priority ?? 'STANDARD',
        clientId: order.clientId ?? 'unknown',
        clientName: order.clientName ?? order.clientId ?? 'unknown',
        vendorId: order.assignedVendorId ?? order.vendorId ?? 'unknown',
        vendorName: order.assignedVendorName ?? order.vendorName ?? 'unknown',
        submittedAt: order.submittedAt ? new Date(order.submittedAt) : new Date(),
      });
      this.logger.info('Q-01: added order to QC queue on status transition', { orderId });
    } catch (err) {
      this.logger.error('Q-01 failed — non-fatal, operator can add manually', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Q-03 / Q-04: QC completion drives the next lifecycle step.
   *   result=passed → transition order to FINAL_UNDER_REVIEW (starts delivery)
   *   result=failed → create a revision request
   * Idempotency: we only act when the order is still in QC_REVIEW.
   */
  private async onQCCompleted(event: QCCompletedEvent): Promise<void> {
    const { orderId, tenantId, result, reviewerId } = event.data as any;
    try {
      const orderResp = (await this.dbService.getItem('orders', orderId, tenantId)) as any;
      // `getItem` may return either `{data: T|null}` (ApiResponse shape) or the
      // raw item — and in error/not-found cases it returns `{data: null}`. Check
      // both without treating a nullish data as "found".
      const order = orderResp && 'data' in orderResp ? orderResp.data : orderResp;
      if (!order) {
        this.logger.warn('qc.completed: order not found', { orderId });
        return;
      }
      if (order.status && order.status !== 'QC_REVIEW') {
        this.logger.info('qc.completed: order already moved past QC_REVIEW — skipping', {
          orderId,
          currentStatus: order.status,
        });
        return;
      }

      if (result === 'passed' || result === 'PASSED') {
        // Q-03: advance into delivery
        const updated = {
          ...order,
          status: 'FINAL_UNDER_REVIEW',
          qcPassedAt: new Date().toISOString(),
          qcPassedBy: reviewerId ?? 'unknown',
          updatedAt: new Date().toISOString(),
        };
        await this.dbService.updateItem('orders', orderId, updated, tenantId);
        this.logger.info('Q-03: QC passed — advanced order to FINAL_UNDER_REVIEW', { orderId });

        // Q-09: auto-close any open qc-issues for this order. Rationale —
        // if the analyst passed overall QC, the AI-flagged issues are
        // effectively handled (either addressed in-line or accepted).
        await this.autoCloseOpenIssues(orderId, reviewerId ?? 'qc-auto');
      } else if (result === 'failed' || result === 'FAILED') {
        // Q-04: delegate to DeliveryWorkflowService to open the revision
        // request (reuses its revision schema + event publishing).
        const { DeliveryWorkflowService } = await import('./delivery-workflow.service.js');
        const delivery = new DeliveryWorkflowService(this.dbService);

        // Find the most-recent submitted document to anchor the revision on.
        const docsResp = (await this.dbService.queryItems(
          'documents',
          'SELECT TOP 1 c.id, c.orderId FROM c WHERE c.orderId = @orderId ORDER BY c.createdAt DESC',
          [{ name: '@orderId', value: orderId }],
        )) as any;
        const doc = (docsResp?.data ?? docsResp?.resources ?? [])[0];
        if (!doc) {
          this.logger.warn('Q-04: no document to anchor revision — skipping', { orderId });
          return;
        }

        await (delivery as any).createRevisionRequest(
          { id: doc.id, orderId } as any,
          reviewerId ?? 'qc-auto',
          'QC review failed — revision required',
          tenantId,
          { requestedByRole: 'AMC', requestType: 'QUALITY', severity: 'MAJOR' },
        );
        this.logger.info('Q-04: QC failed — revision request created', { orderId });
      }
    } catch (err) {
      this.logger.error('qc.completed handler failed — non-fatal', {
        orderId,
        result,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Q-09: Close all OPEN qc-issues for an order. Idempotent: records that are
   * already RESOLVED or DISMISSED are skipped. Best-effort — failures are
   * logged but do not throw.
   */
  private async autoCloseOpenIssues(orderId: string, closedBy: string): Promise<void> {
    try {
      const resp = (await this.dbService.queryItems(
        'aiInsights',
        `SELECT * FROM c WHERE c.orderId = @orderId AND c.type = 'qc-issue' AND c.status = 'OPEN'`,
        [{ name: '@orderId', value: orderId }],
      )) as any;
      const openIssues: any[] = resp?.data ?? resp?.resources ?? [];
      if (openIssues.length === 0) return;

      const now = new Date().toISOString();
      for (const issue of openIssues) {
        const updated = {
          ...issue,
          status: 'RESOLVED',
          resolvedBy: closedBy,
          resolvedAt: now,
          resolutionNote: 'Auto-resolved on overall QC pass',
          updatedAt: now,
        };
        try {
          await this.dbService.updateItem('aiInsights', issue.id, updated, orderId);
        } catch (err) {
          this.logger.warn('Q-09: failed to close an individual issue', {
            issueId: issue.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      this.logger.info('Q-09: auto-closed qc-issues on QC pass', {
        orderId,
        closedCount: openIssues.length,
      });
    } catch (err) {
      this.logger.warn('Q-09: auto-close sweep failed — non-fatal', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
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
