/**
 * Supervisory Review Service
 *
 * Manages the supervisory co-sign workflow for appraisal orders.
 *
 * Flow:
 *   1. An order is flagged as requiring supervisory review
 *      (by the orchestrator based on tenant config, or by manual request).
 *   2. A supervisor (staffRole: 'supervisor') is assigned — either from
 *      the tenant's defaultSupervisorId or explicitly specified.
 *   3. The supervisor reviews and co-signs the order.
 *   4. On co-sign, a `supervision.cosigned` event is published and
 *      the order's supervision state is updated.
 *
 * Idempotent: calling requestSupervision on an already-supervised order
 * is a no-op if the same supervisor is being assigned.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type { SupervisionRequiredEvent, SupervisionCosignedEvent } from '../types/events.js';

export interface RequestSupervisionParams {
  orderId: string;
  tenantId: string;
  supervisorId: string;
  supervisorName?: string;
  reason: 'high_value' | 'policy_requirement' | 'ai_flag' | 'manual_request';
  requestedBy: string;
  priority?: 'STANDARD' | 'RUSH' | 'EMERGENCY';
}

export interface CosignOrderParams {
  orderId: string;
  tenantId: string;
  supervisorId: string;
  supervisorName: string;
  notes?: string;
}

export interface SupervisionStatus {
  orderId: string;
  requiresSupervisoryReview: boolean;
  supervisorId?: string;
  supervisorName?: string;
  supervisoryReviewReason?: string;
  supervisoryCosignedAt?: string;
  supervisoryCosignedBy?: string;
  isCosigned: boolean;
}

export class SupervisoryReviewService {
  private readonly logger = new Logger('SupervisoryReviewService');
  private readonly dbService: CosmosDbService;
  private readonly publisher: ServiceBusEventPublisher;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
  }

  /**
   * Request supervisory review for an order.
   * Marks the order and publishes `supervision.required`.
   *
   * Idempotent: if the order is already pending supervision with the
   * same supervisor, the call succeeds without re-publishing the event.
   */
  async requestSupervision(params: RequestSupervisionParams): Promise<SupervisionStatus> {
    const { orderId, tenantId, supervisorId, supervisorName, reason, requestedBy, priority } = params;

    this.logger.info('Requesting supervisory review', { orderId, supervisorId, reason });

    const order = await this.loadOrder(orderId, tenantId);

    // Idempotency guard: already co-signed
    if (order.supervisoryCosignedAt) {
      this.logger.info('Order already co-signed — supervision request is a no-op', { orderId });
      return this.toStatus(order);
    }

    // Idempotency guard: same supervisor already assigned
    if (
      order.requiresSupervisoryReview &&
      order.supervisorId === supervisorId
    ) {
      this.logger.info('Supervisory review already requested with same supervisor', { orderId });
      return this.toStatus(order);
    }

    const updatedOrder = {
      ...order,
      requiresSupervisoryReview: true,
      supervisorId,
      supervisorName: supervisorName ?? order.supervisorName,
      supervisoryReviewReason: reason,
      updatedAt: new Date().toISOString(),
    };

    await this.dbService.updateItem('orders', orderId, updatedOrder, tenantId);

    const event: SupervisionRequiredEvent = {
      id: uuidv4(),
      type: 'supervision.required',
      timestamp: new Date(),
      source: 'supervisory-review-service',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId,
        orderNumber: order.orderNumber,
        tenantId,
        clientId: order.clientId,
        supervisorId,
        reason,
        requestedBy,
        requestedAt: new Date(),
        priority: this.mapPriority(priority ?? 'STANDARD'),
      },
    };

    await this.publisher.publish(event);
    this.logger.info('supervision.required event published', { orderId, supervisorId });

    return this.toStatus(updatedOrder);
  }

  /**
   * Supervisor co-signs an order.
   * The supervisor must match the assigned supervisorId.
   * Publishes `supervision.cosigned`.
   */
  async cosignOrder(params: CosignOrderParams): Promise<SupervisionStatus> {
    const { orderId, tenantId, supervisorId, supervisorName, notes } = params;

    this.logger.info('Processing supervisor co-sign', { orderId, supervisorId });

    const order = await this.loadOrder(orderId, tenantId);

    if (!order.requiresSupervisoryReview) {
      throw new Error(
        `Order ${orderId} does not require supervisory review. ` +
        `Call requestSupervision first or check order state.`,
      );
    }

    if (order.supervisorId && order.supervisorId !== supervisorId) {
      throw new Error(
        `Supervisor mismatch: order ${orderId} is assigned to supervisor "${order.supervisorId}" ` +
        `but co-sign was submitted by "${supervisorId}".`,
      );
    }

    if (order.supervisoryCosignedAt) {
      this.logger.info('Order already co-signed — returning current status', { orderId });
      return this.toStatus(order);
    }

    const cosignedAt = new Date().toISOString();
    const updatedOrder = {
      ...order,
      supervisorId,
      supervisorName,
      supervisoryCosignedAt: cosignedAt,
      supervisoryCosignedBy: supervisorId,
      updatedAt: cosignedAt,
    };

    await this.dbService.updateItem('orders', orderId, updatedOrder, tenantId);

    const event: SupervisionCosignedEvent = {
      id: uuidv4(),
      type: 'supervision.cosigned',
      timestamp: new Date(),
      source: 'supervisory-review-service',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId,
        orderNumber: order.orderNumber,
        tenantId,
        clientId: order.clientId,
        supervisorId,
        supervisorName,
        cosignedAt: new Date(cosignedAt),
        ...(notes !== undefined ? { notes } : {}),
        priority: EventPriority.NORMAL,
      },
    };

    await this.publisher.publish(event);
    this.logger.info('supervision.cosigned event published', { orderId, supervisorId });

    return this.toStatus(updatedOrder);
  }

  /**
   * Get the current supervision status for an order.
   */
  async getStatus(orderId: string, tenantId: string): Promise<SupervisionStatus> {
    const order = await this.loadOrder(orderId, tenantId);
    return this.toStatus(order);
  }

  /**
   * List all orders pending supervisory review for a given supervisor.
   * Returns orders where requiresSupervisoryReview=true AND supervisoryCosignedAt is absent.
   */
  async getPendingCosigns(tenantId: string, supervisorId?: string): Promise<SupervisionStatus[]> {
    try {
      let queryString: string;
      let parameters: Array<{ name: string; value: unknown }>;

      if (supervisorId) {
        queryString =
          'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.requiresSupervisoryReview = true ' +
          'AND (NOT IS_DEFINED(c.supervisoryCosignedAt) OR c.supervisoryCosignedAt = null) ' +
          'AND c.supervisorId = @supervisorId';
        parameters = [
          { name: '@tenantId', value: tenantId },
          { name: '@supervisorId', value: supervisorId },
        ];
      } else {
        queryString =
          'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.requiresSupervisoryReview = true ' +
          'AND (NOT IS_DEFINED(c.supervisoryCosignedAt) OR c.supervisoryCosignedAt = null)';
        parameters = [{ name: '@tenantId', value: tenantId }];
      }

      const result = await this.dbService.queryItems('orders', queryString, parameters);
      const orders = (result as any)?.data ?? result ?? [];
      return (Array.isArray(orders) ? orders : []).map((o: any) => this.toStatus(o));
    } catch (err) {
      this.logger.error('Failed to query pending co-signs', { tenantId, supervisorId, error: err });
      return [];
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async loadOrder(orderId: string, tenantId: string): Promise<any> {
    const result = await this.dbService.getItem('orders', orderId, tenantId);
    const order = (result as any)?.data ?? result;
    if (!order) {
      throw new Error(`Order not found: id="${orderId}" tenantId="${tenantId}"`);
    }
    return order;
  }

  private toStatus(order: any): SupervisionStatus {
    return {
      orderId: order.id,
      requiresSupervisoryReview: order.requiresSupervisoryReview ?? false,
      supervisorId: order.supervisorId,
      supervisorName: order.supervisorName,
      supervisoryReviewReason: order.supervisoryReviewReason,
      supervisoryCosignedAt: order.supervisoryCosignedAt,
      supervisoryCosignedBy: order.supervisoryCosignedBy,
      isCosigned: !!order.supervisoryCosignedAt,
    };
  }

  private mapPriority(p: string): EventPriority {
    switch (p?.toUpperCase()) {
      case 'EMERGENCY': return EventPriority.CRITICAL;
      case 'RUSH': return EventPriority.HIGH;
      default: return EventPriority.NORMAL;
    }
  }
}
