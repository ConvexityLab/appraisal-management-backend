/**
 * Order Management Controller
 *
 * REST endpoints for order CRUD and lifecycle operations.
 * Extracted from inline methods in api-server.ts (Phase 0.2).
 *
 * Routes:
 *   POST   /                  → createOrder       (validated)
 *   GET    /                  → getOrders
 *   GET    /dashboard         → getOrderDashboard
 *   POST   /search            → searchOrders       (validated)
 *   POST   /batch/status      → batchUpdateStatus   (validated)
 *   POST   /batch/assign      → batchAssign          (validated)
 *   POST   /export            → exportOrders          (validated)
 *   GET    /:orderId          → getOrder
 *   PUT    /:orderId/status   → updateOrderStatus
 *   POST   /:orderId/cancel   → cancelOrder         (validated)
 *   POST   /:orderId/deliver  → deliverOrder
 *   POST   /:orderId/assign   → assignVendor
 *   GET    /:orderId/timeline → getOrderTimeline
 */

import { Router, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { OrderEventService } from '../services/order-event.service.js';
import { AuditTrailService } from '../services/audit-trail.service.js';
import { SLATrackingService } from '../services/sla-tracking.service.js';
import { QCReviewQueueService } from '../services/qc-review-queue.service.js';
import { AxiomService } from '../services/axiom.service.js';
import { DocumentService } from '../services/document.service.js';
import { BlobStorageService } from '../services/blob-storage.service.js';
import { OrderNotificationService } from '../services/order-notification.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { AutoAssignmentOrchestratorService } from '../services/auto-assignment-orchestrator.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { OrderStatus, normalizeOrderStatus, isValidStatusTransition } from '../types/order-status.js';
import {
  validateCreateOrder,
  validateCancelOrder,
  validateSearchOrders,
  validateBatchStatusUpdate,
  validateBatchAssign,
  validateExportOrders,
} from '../middleware/order-validation.middleware.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';
import type { AppraisalOrder } from '../types/index.js';
import { DuplicateOrderDetectionService } from '../services/duplicate-order-detection.service.js';
import { WaiverScreeningService } from '../services/waiver-screening.service.js';

const logger = new Logger('OrderController');

/**
 * Normalize the status field on an order read from Cosmos.
 * Handles legacy lowercase values and old enum aliases.
 */
function normalizeOrder<T extends { status?: string }>(order: T): T {
  if (order && typeof order.status === 'string') {
    try {
      (order as any).status = normalizeOrderStatus(order.status);
    } catch {
      // Leave status as-is if unrecognized — don't break reads
      logger.warn(`Unrecognized order status in DB: "${order.status}"`);
    }
  }
  return order;
}

/**
 * Build structured Axiom pipeline fields from an order.
 * Only includes fields with a non-empty / non-zero value.
 */
function buildOrderFields(
  order: AppraisalOrder,
): Array<{ fieldName: string; fieldType: string; value: unknown }> {
  const addr = order.propertyAddress;
  const prop = order.propertyDetails;
  const loan = order.loanInformation;
  const borrower = order.borrowerInformation;
  return [
    { fieldName: 'loanAmount',      fieldType: 'number', value: loan?.loanAmount ?? 0 },
    { fieldName: 'loanType',        fieldType: 'string', value: String(loan?.loanType ?? '') },
    { fieldName: 'propertyAddress', fieldType: 'string', value: addr?.streetAddress ?? '' },
    { fieldName: 'city',            fieldType: 'string', value: addr?.city ?? '' },
    { fieldName: 'state',           fieldType: 'string', value: addr?.state ?? '' },
    { fieldName: 'zipCode',         fieldType: 'string', value: addr?.zipCode ?? '' },
    { fieldName: 'propertyType',    fieldType: 'string', value: String(prop?.propertyType ?? '') },
    { fieldName: 'yearBuilt',       fieldType: 'number', value: prop?.yearBuilt ?? 0 },
    { fieldName: 'gla',             fieldType: 'number', value: prop?.grossLivingArea ?? 0 },
    { fieldName: 'bedrooms',        fieldType: 'number', value: prop?.bedrooms ?? 0 },
    { fieldName: 'bathrooms',       fieldType: 'number', value: prop?.bathrooms ?? 0 },
    { fieldName: 'borrowerName',    fieldType: 'string', value: `${borrower?.firstName ?? ''} ${borrower?.lastName ?? ''}`.trim() },
  ].filter(
    (f) =>
      (typeof f.value === 'string' && f.value !== '') ||
      (typeof f.value === 'number' && f.value !== 0),
  );
}

export class OrderController {
  public router: Router;
  private dbService: CosmosDbService;
  private eventService: OrderEventService;
  private auditService: AuditTrailService;
  private slaService: SLATrackingService;
  private qcQueueService: QCReviewQueueService;
  private axiomService: AxiomService;
  private notificationService: OrderNotificationService;
  private publisher: ServiceBusEventPublisher;
  private orchestrator: AutoAssignmentOrchestratorService;
  private _documentService: DocumentService | null = null;
  private duplicateDetection: DuplicateOrderDetectionService;
  private waiverScreening: WaiverScreeningService;

  /** Lazy-init: DocumentService requires Cosmos DB to be initialized, which
   *  happens after the constructor runs during app startup. */
  private get documentService(): DocumentService {
    if (!this._documentService) {
      this._documentService = new DocumentService(this.dbService, new BlobStorageService());
    }
    return this._documentService;
  }

  constructor(dbService: CosmosDbService, authzMiddleware?: AuthorizationMiddleware) {
    this.router = Router();
    this.dbService = dbService;
    this.eventService = new OrderEventService();
    this.auditService = new AuditTrailService();
    this.slaService = new SLATrackingService();
    this.qcQueueService = new QCReviewQueueService();
    this.axiomService = new AxiomService(dbService);
    this.notificationService = new OrderNotificationService();
    this.publisher = new ServiceBusEventPublisher();
    // Instantiated without start() — used only for triggerVendorAssignment() calls from REST endpoints.
    this.orchestrator = new AutoAssignmentOrchestratorService(dbService);
    this.duplicateDetection = new DuplicateOrderDetectionService(dbService);
    this.waiverScreening = new WaiverScreeningService(dbService);
    this.setupRoutes(authzMiddleware);
  }

  private setupRoutes(authzMiddleware?: AuthorizationMiddleware): void {
    // IMPORTANT: Specific routes MUST come before parameterized routes
    this.router.get('/dashboard', this.getOrderDashboard.bind(this));

    // GET / — with optional authorization (audit mode)
    const readMiddleware = authzMiddleware
      ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorizeQuery('order', 'read')]
      : [];
    this.router.get('/', ...readMiddleware, this.getOrders.bind(this));

    this.router.post('/', ...validateCreateOrder(), this.createOrder.bind(this));
    this.router.post('/search', ...validateSearchOrders(), this.searchOrders.bind(this));
    this.router.post('/batch-status', ...validateBatchStatusUpdate(), this.batchUpdateStatus.bind(this));
    this.router.post('/batch/status', ...validateBatchStatusUpdate(), this.batchUpdateStatus.bind(this));
    this.router.post('/batch/assign', ...validateBatchAssign(), this.batchAssign.bind(this));
    this.router.post('/export', ...validateExportOrders(), this.exportOrders.bind(this));
    this.router.post('/duplicate-check', this.checkDuplicates.bind(this));
    this.router.post('/waiver-screening', this.screenWaiver.bind(this));
    this.router.get('/:orderId', this.getOrder.bind(this));
    this.router.put('/:orderId', this.updateOrder.bind(this));
    this.router.put('/:orderId/status', this.updateOrderStatus.bind(this));
    this.router.post('/:orderId/cancel', ...validateCancelOrder(), this.cancelOrder.bind(this));
    this.router.post('/:orderId/deliver', this.deliverOrder.bind(this));
    this.router.post('/:orderId/assign', this.assignVendor.bind(this));
    this.router.post('/:orderId/unassign', this.unassignVendor.bind(this));
    this.router.post('/:orderId/payment', this.markPayment.bind(this));
    this.router.get('/:orderId/timeline', this.getOrderTimeline.bind(this));
    this.router.get('/:orderId/auto-assignment', this.getAutoAssignmentStatus.bind(this));
    this.router.post('/:orderId/trigger-auto-assignment', this.triggerAutoAssignment.bind(this));
    this.router.post('/:orderId/vendor-bid/:bidId/accept', this.acceptVendorBid.bind(this));
    this.router.post('/:orderId/vendor-bid/:bidId/decline', this.declineVendorBid.bind(this));
  }

  // ─── POST / ──────────────────────────────────────────────────────────────

  public async createOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const orderData = {
        ...req.body,
        tenantId: req.user!.tenantId,
        createdBy: req.user?.id,
        status: OrderStatus.NEW,
        priority: req.body.priority || 'STANDARD',
      };

      const result = await this.dbService.createOrder(orderData);

      if (result.success) {
        // Fire-and-forget: event bus + audit trail
        const created = result.data as AppraisalOrder;
        this.eventService.publishOrderCreated(created).catch((err) =>
          logger.error('Failed to publish ORDER_CREATED event', { orderId: created?.id, error: err }),
        );

        // If this order belongs to an engagement, fire the engagement.order.created event
        // so the AutoAssignmentOrchestratorService can kick off automated vendor selection.
        const engagementId: string | undefined = (created as any).engagementId;
        if (engagementId) {
          const addr = (created as any).propertyAddress;
          const addrString: string =
            typeof addr === 'string'
              ? addr
              : addr?.streetAddress
                  ? `${addr.streetAddress}, ${addr.city ?? ''}, ${addr.state ?? ''} ${addr.zipCode ?? ''}`.trim()
                  : '';
          const orderPriority: string = (created as any).priority ?? 'STANDARD';
          const priority: EventPriority =
            orderPriority === 'EMERGENCY' ? EventPriority.CRITICAL
            : orderPriority === 'RUSH'    ? EventPriority.HIGH
            : EventPriority.NORMAL;

          this.publisher.publish({
            id: uuidv4(),
            type: 'engagement.order.created',
            timestamp: new Date(),
            source: 'order-controller',
            version: '1.0',
            category: EventCategory.ASSIGNMENT,
            data: {
              engagementId,
              orderId: created.id!,
              orderNumber: (created as any).orderNumber ?? '',
              tenantId: req.user!.tenantId,
              productType: (created as any).productType ?? (created as any).orderType ?? '',
              propertyAddress: addrString,
              propertyState: (created as any).propertyAddress?.state ?? '',
              clientId: (created as any).clientId ?? '',
              loanAmount: (created as any).loanInformation?.loanAmount ?? 0,
              priority,
              dueDate: (created as any).dueDate ? new Date((created as any).dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          }).catch((err) =>
            logger.error('Failed to publish engagement.order.created event', {
              orderId: created?.id,
              engagementId,
              error: err,
            }),
          );
        }
        this.auditService.log({
          actor: { userId: req.user!.id, ...(req.user?.email != null && { email: req.user.email }) },
          action: 'order.created',
          resource: { type: 'order', id: created?.id || 'unknown' },
          after: { status: OrderStatus.NEW, priority: orderData.priority },
        }).catch((err) =>
          logger.error('Failed to write audit log for order creation', { error: err }),
        );
        res.status(201).json(result.data);
      } else {
        res.status(500).json({
          error: 'Order creation failed',
          code: 'ORDER_CREATION_ERROR',
          details: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Order creation failed',
        code: 'ORDER_CREATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /duplicate-check ────────────────────────────────────────────────

  /**
   * Standalone duplicate order check — advisory only.
   * Called from the frontend intake wizard before final submission.
   */
  public async checkDuplicates(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { propertyAddress, city, state, zipCode, borrowerFirstName, borrowerLastName, excludeOrderId } = req.body;
      if (!propertyAddress) {
        res.status(400).json({ error: 'propertyAddress is required', code: 'VALIDATION_ERROR' });
        return;
      }
      const result = await this.duplicateDetection.checkForDuplicates({
        propertyAddress,
        city,
        state,
        zipCode,
        borrowerFirstName,
        borrowerLastName,
        tenantId: req.user!.tenantId,
        excludeOrderId,
      });
      res.json(result);
    } catch (error) {
      logger.error('Duplicate check endpoint failed', { error });
      res.status(500).json({
        error: 'Duplicate check failed',
        code: 'DUPLICATE_CHECK_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /waiver-screening ───────────────────────────────────────────────

  /**
   * PIW/ACE/Waiver eligibility screening — advisory only.
   * Called from the frontend intake wizard before final submission.
   */
  public async screenWaiver(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const result = await this.waiverScreening.screenOrder({
        ...req.body,
        tenantId: req.user!.tenantId,
      });
      res.json(result);
    } catch (error) {
      logger.error('Waiver screening endpoint failed', { error });
      res.status(500).json({
        error: 'Waiver screening failed',
        code: 'WAIVER_SCREENING_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── PUT /:orderId ────────────────────────────────────────────────────────

  /**
   * Full order update — only editable fields are accepted.
   * Status transitions must continue to use PUT /:orderId/status.
   */
  public async updateOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        res.status(400).json({ error: 'orderId is required', code: 'VALIDATION_ERROR' });
        return;
      }

      // Whitelist of editable fields — never allow status/id/tenantId drift
      const EDITABLE_FIELDS = [
        'priority', 'dueDate', 'orderType', 'productType',
        'specialInstructions', 'engagementInstructions', 'internalNotes',
        'clientInformation', 'tags', 'rushFee', 'orderFee',
        'propertyAddress', 'propertyDetails',
      ] as const;

      const patch: Record<string, unknown> = { updatedAt: new Date(), updatedBy: req.user?.id ?? 'unknown' };
      for (const field of EDITABLE_FIELDS) {
        if (field in req.body) {
          patch[field] = req.body[field];
        }
      }

      if (Object.keys(patch).length === 2) {
        // Only timestamps — nothing editable was sent
        res.status(400).json({ error: 'No editable fields provided', code: 'VALIDATION_ERROR' });
        return;
      }

      const result = await this.dbService.updateOrder(orderId, patch);

      if (result.success && result.data) {
        this.auditService.log({
          actor: { userId: req.user?.id ?? 'unknown', ...(req.user?.email != null && { email: req.user.email }) },
          action: 'order.updated',
          resource: { type: 'order', id: orderId },
          after: patch,
        }).catch((err) => logger.error('Audit log failed for order.updated', { error: err }));

        res.json(result.data);
      } else if (result.error?.code === 'ORDER_NOT_FOUND') {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'Order update failed', code: 'ORDER_UPDATE_ERROR', details: result.error });
      }
    } catch (error) {
      logger.error('updateOrder failed', { error, orderId: req.params.orderId });
      res.status(500).json({
        error: 'Order update failed',
        code: 'ORDER_UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── GET / ───────────────────────────────────────────────────────────────

  private async getOrders(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { status, priority, limit = 20, offset = 0 } = req.query;

      const filters: any = {};

      // Express may give a string ("PENDING_ASSIGNMENT") or an array
      // depending on whether the query param appears once or multiple times.
      if (status) {
        const raw = Array.isArray(status) ? status : [status];
        filters.status = raw.flatMap((s: any) => String(s).split(','));
      }
      if (priority) {
        const raw = Array.isArray(priority) ? priority : [priority];
        filters.priority = raw.flatMap((p: any) => String(p).split(','));
      }

      const result = await this.dbService.findOrders(
        filters,
        parseInt(offset as string),
        parseInt(limit as string),
      );

      if (result.success) {
        // Normalize status values on each order at the read boundary
        const orders = (result.data || []).map(normalizeOrder);
        res.json({
          orders,
          pagination: result.metadata,
        });
      } else {
        res.status(500).json({
          error: 'Failed to retrieve orders',
          code: 'ORDER_RETRIEVAL_ERROR',
          details: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve orders',
        code: 'ORDER_RETRIEVAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── GET /:orderId ───────────────────────────────────────────────────────

  public async getOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      const result = await this.dbService.findOrderById(orderId);

      if (result.success && result.data) {
        res.json(normalizeOrder(result.data));
      } else if (result.success && !result.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
      } else {
        res.status(500).json({
          error: 'Failed to retrieve order',
          code: 'ORDER_RETRIEVAL_ERROR',
          details: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve order',
        code: 'ORDER_RETRIEVAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── PUT /:orderId/status ────────────────────────────────────────────────

  private async updateOrderStatus(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { status, notes } = req.body;

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }
      if (!status) {
        res.status(400).json({ error: 'Status is required', code: 'MISSING_STATUS' });
        return;
      }

      // Normalize the requested status
      let newStatus: OrderStatus;
      try {
        newStatus = normalizeOrderStatus(status);
      } catch {
        res.status(400).json({
          error: `Invalid status: "${status}"`,
          code: 'INVALID_STATUS',
          validStatuses: Object.values(OrderStatus),
        });
        return;
      }

      // Load current order to validate transition
      const current = await this.dbService.findOrderById(orderId);
      if (!current.success || !current.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
        return;
      }

      const currentStatus = normalizeOrderStatus(current.data.status as string);
      if (!isValidStatusTransition(currentStatus, newStatus)) {
        res.status(422).json({
          error: `Cannot transition from ${currentStatus} to ${newStatus}`,
          code: 'INVALID_STATUS_TRANSITION',
          currentStatus,
          requestedStatus: newStatus,
        });
        return;
      }

      const result = await this.dbService.updateOrder(orderId, {
        status: newStatus as unknown as AppraisalOrder['status'],
        ...(notes && { metadata: { statusNotes: notes } }),
      } as Partial<AppraisalOrder>);

      if (result.success) {
        // Fire-and-forget: event bus + audit trail
        this.eventService.publishOrderStatusChanged(
          orderId, currentStatus, newStatus, req.user!.id,
        ).catch((err) =>
          logger.error('Failed to publish ORDER_STATUS_CHANGED event', { orderId, error: err }),
        );
        this.auditService.log({
          actor: { userId: req.user!.id, ...(req.user?.email != null && { email: req.user.email }) },
          action: 'order.status_changed',
          resource: { type: 'order', id: orderId },
          before: { status: currentStatus },
          after: { status: newStatus },
          metadata: { notes },
        }).catch((err) =>
          logger.error('Failed to write audit log for status change', { orderId, error: err }),
        );

        // Start appraisal SLA tracking when order transitions to ACCEPTED
        if (newStatus === OrderStatus.ACCEPTED) {
          const order = result.data!;
          this.slaService.startSLATracking(
            'APPRAISAL',
            orderId,
            orderId,
            (order as any).orderNumber || orderId,
            (order as any).priority || (order as any).urgency || 'ROUTINE',
            (order as any).clientId,
          ).catch((err) =>
            logger.error('Failed to start SLA tracking for accepted order', { orderId, error: err }),
          );
        }

        // Auto-route to QC queue when order is SUBMITTED
        if (newStatus === OrderStatus.SUBMITTED) {
          const order = result.data!;

          // Auto-submit appraisal-report documents to Axiom AI via pipeline (A-1)
          setImmediate(() => {
            this.dbService.findOrderById(orderId).then((orderResult) => {
              const orderData = orderResult.success ? orderResult.data : null;
              // Derive tenantId from the order record itself — never hardcode.
              // All orders are created with a tenantId; if it is missing the record is corrupt.
              const tenantId = orderData?.tenantId;
              if (!tenantId) {
                logger.error('Cannot auto-submit to Axiom: order has no tenantId', { orderId });
                return;
              }
              const clientId = orderData?.clientId;
              if (!clientId) {
                logger.error('Cannot auto-submit to Axiom: order has no clientId', { orderId });
                return;
              }
              const fields = orderData ? buildOrderFields(orderData) : [];
              return this.documentService.listDocuments(tenantId, { orderId }).then((docResult) => {
                const appraisalDocs = docResult.success && docResult.data
                  ? docResult.data.filter(
                      (d) => d.category === 'appraisal-report' && !(d.metadata as any)?.axiomEvaluationId,
                    )
                  : [];
                // Submit to Axiom even with no documents — fields-only evaluation is valid
                // per AXIOM_TEAM_REQUIREMENTS: "Either array may be empty"
                const documents = appraisalDocs.map((d) => ({
                  documentName: d.name,
                  documentReference: d.blobUrl,
                }));
                return this.axiomService.submitOrderEvaluation(orderId, fields, documents, tenantId, clientId);
              });
            }).then((axiomResult) => {
              if (axiomResult) {
                this.dbService.updateOrder(orderId, {
                  axiomEvaluationId: axiomResult.evaluationId,
                  axiomPipelineJobId: axiomResult.pipelineJobId,
                  axiomStatus: 'submitted',
                }).catch((err) =>
                  logger.error('Failed to stamp Axiom fields on order after SUBMITTED', { orderId, error: err }),
                );
              }
            }).catch((err) =>
              logger.error('Auto-submit to Axiom failed on SUBMITTED status change', { orderId, error: err }),
            );
          });

          this.qcQueueService.addToQueue({
            orderId,
            orderNumber: (order as any).orderNumber || orderId,
            appraisalId: (order as any).appraisalId || orderId,
            propertyAddress: (order as any).propertyAddress || (order as any).property?.address || '',
            appraisedValue: (order as any).appraisedValue || (order as any).orderValue || (order as any).fee || 0,
            orderPriority: (order as any).priority || (order as any).urgency || 'ROUTINE',
            clientId: (order as any).clientId || '',
            clientName: (order as any).clientName || (order as any).client?.name || '',
            vendorId: (order as any).vendorId || '',
            vendorName: (order as any).vendorName || (order as any).vendor?.name || '',
            submittedAt: new Date(),
          }).then((queueItem) => {
            logger.info('Order auto-routed to QC queue', { orderId, queueItemId: queueItem?.id });
            // Start QC SLA tracking
            this.slaService.startSLATracking(
              'QC_REVIEW', queueItem?.id || orderId, orderId,
              (order as any).orderNumber || orderId,
              (order as any).priority || 'ROUTINE',
            ).catch((err) =>
              logger.error('Failed to start QC SLA tracking', { orderId, error: err }),
            );

            // Axiom→QC bridge: fetch AI evaluation to pre-populate QC findings
            if (this.axiomService.isEnabled()) {
              this.axiomService.getEvaluation(orderId).then((evaluation) => {
                if (evaluation && evaluation.status === 'completed') {
                  logger.info('Axiom evaluation attached to QC queue item', {
                    orderId,
                    queueItemId: queueItem?.id,
                    riskScore: evaluation.overallRiskScore,
                    criteriaCount: evaluation.criteria?.length || 0,
                  });
                  // Store the evaluation reference on the queue item for the QC analyst
                  this.qcQueueService.updateQueueItem(queueItem?.id, {
                    axiomEvaluationId: evaluation.evaluationId,
                    axiomRiskScore: evaluation.overallRiskScore,
                    axiomCriteriaSnapshot: (evaluation.criteria || []).map((c) => ({
                      criterionId: c.criterionId,
                      description: c.description,
                      evaluation: c.evaluation,
                      confidence: c.confidence,
                    })),
                  }).catch((err) =>
                    logger.error('Failed to attach Axiom evaluation to queue item', { orderId, error: err }),
                  );
                } else {
                  logger.info('No completed Axiom evaluation for order', { orderId, status: evaluation?.status });
                }
              }).catch((err) =>
                logger.error('Failed to fetch Axiom evaluation for QC bridge', { orderId, error: err }),
              );
            }
          }).catch((err) =>
            logger.error('Failed to auto-route order to QC queue', { orderId, error: err }),
          );
        }

        // Auto-transition to QC_REVIEW status when order enters queue
        if (newStatus === OrderStatus.SUBMITTED) {
          this.dbService.updateOrder(orderId, { status: OrderStatus.QC_REVIEW as unknown as AppraisalOrder['status'] })
            .catch((err) =>
              logger.error('Failed to auto-advance order to QC_REVIEW', { orderId, error: err }),
            );
        }

        res.json(normalizeOrder(result.data!));
      } else {
        res.status(500).json({
          error: 'Failed to update order status',
          code: 'ORDER_UPDATE_ERROR',
          details: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update order status',
        code: 'ORDER_UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /:orderId/deliver ──────────────────────────────────────────────

  private async deliverOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { reportUrl, deliveryNotes } = req.body;

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      // Load current order to validate it can be delivered
      const current = await this.dbService.findOrderById(orderId);
      if (!current.success || !current.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
        return;
      }

      const currentStatus = normalizeOrderStatus(current.data.status as string);
      if (!isValidStatusTransition(currentStatus, OrderStatus.DELIVERED)) {
        res.status(422).json({
          error: `Cannot deliver order in ${currentStatus} status`,
          code: 'INVALID_STATUS_TRANSITION',
          currentStatus,
          requiredStatus: OrderStatus.COMPLETED,
        });
        return;
      }

      const result = await this.dbService.updateOrder(orderId, {
        status: OrderStatus.DELIVERED as unknown as AppraisalOrder['status'],
        metadata: {
          ...(current.data.metadata || {}),
          reportUrl,
          deliveryNotes,
          deliveredAt: new Date().toISOString(),
          deliveredBy: req.user?.id,
        },
      } as Partial<AppraisalOrder>);

      if (result.success) {
        // Fire-and-forget: event bus + audit trail
        this.eventService.publishOrderStatusChanged(
          orderId, currentStatus, OrderStatus.DELIVERED, req.user!.id,
        ).catch((err) =>
          logger.error('Failed to publish ORDER_STATUS_CHANGED event for delivery', { orderId, error: err }),
        );
        this.auditService.log({
          actor: { userId: req.user!.id, ...(req.user?.email != null && { email: req.user.email }) },
          action: 'order.delivered',
          resource: { type: 'order', id: orderId },
          before: { status: currentStatus },
          after: { status: OrderStatus.DELIVERED, reportUrl, deliveryNotes },
        }).catch((err) =>
          logger.error('Failed to write audit log for delivery', { orderId, error: err }),
        );
        this.notificationService.notifyOrderDelivered(result.data!)
          .catch((err) => logger.error('Failed to send order delivery notification', { orderId, error: err }));
        res.json(normalizeOrder(result.data!));
      } else {
        res.status(500).json({
          error: 'Failed to deliver order',
          code: 'ORDER_DELIVERY_ERROR',
          details: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to deliver order',
        code: 'ORDER_DELIVERY_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /:orderId/cancel ─────────────────────────────────────────────

  // ─── POST /:orderId/assign ──────────────────────────────────────────────

  private async assignVendor(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { vendorId, vendorName } = req.body;

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }
      if (!vendorId) {
        res.status(400).json({ error: 'vendorId is required', code: 'MISSING_VENDOR_ID' });
        return;
      }

      // Load current order
      const current = await this.dbService.findOrderById(orderId);
      if (!current.success || !current.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
        return;
      }

      const currentStatus = normalizeOrderStatus(current.data.status as string);
      if (!isValidStatusTransition(currentStatus, OrderStatus.ASSIGNED)) {
        res.status(422).json({
          error: `Cannot assign vendor to order in ${currentStatus} status`,
          code: 'INVALID_STATUS_TRANSITION',
          currentStatus,
          targetStatus: OrderStatus.ASSIGNED,
        });
        return;
      }

      const result = await this.dbService.updateOrder(orderId, {
        status: OrderStatus.ASSIGNED as unknown as AppraisalOrder['status'],
        assignedVendorId: vendorId,
        assignedVendorName: vendorName || null,
        assignedAt: new Date().toISOString(),
        assignedBy: req.user!.id,
      } as Partial<AppraisalOrder>);

      if (result.success) {
        this.eventService.publishOrderStatusChanged(
          orderId, currentStatus, OrderStatus.ASSIGNED, req.user!.id,
        ).catch((err) =>
          logger.error('Failed to publish ORDER_STATUS_CHANGED for assignment', { orderId, error: err }),
        );
        this.auditService.log({
          actor: { userId: req.user!.id, ...(req.user?.email != null && { email: req.user.email }) },
          action: 'order.assigned',
          resource: { type: 'order', id: orderId },
          before: { status: currentStatus },
          after: { status: OrderStatus.ASSIGNED, vendorId, vendorName },
        }).catch((err) =>
          logger.error('Failed to write audit log for assignment', { orderId, error: err }),
        );
        this.notificationService.notifyVendorAssigned(result.data!)
          .catch((err) => logger.error('Failed to send vendor assignment notification', { orderId, error: err }));
        res.json(normalizeOrder(result.data!));
      } else {
        res.status(500).json({
          error: 'Failed to assign vendor',
          code: 'ORDER_ASSIGNMENT_ERROR',
          details: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to assign vendor',
        code: 'ORDER_ASSIGNMENT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /:orderId/unassign ────────────────────────────────────────────

  private async unassignVendor(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      const current = await this.dbService.findOrderById(orderId);
      if (!current.success || !current.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
        return;
      }

      const currentStatus = normalizeOrderStatus(current.data.status as string);
      if (!isValidStatusTransition(currentStatus, OrderStatus.PENDING_ASSIGNMENT)) {
        res.status(422).json({
          error: `Cannot unassign order in ${currentStatus} status`,
          code: 'INVALID_STATUS_TRANSITION',
          currentStatus,
          targetStatus: OrderStatus.PENDING_ASSIGNMENT,
        });
        return;
      }

      const previousVendorId = current.data.assignedVendorId;

      const result = await this.dbService.updateOrder(orderId, {
        status: OrderStatus.PENDING_ASSIGNMENT as unknown as AppraisalOrder['status'],
        assignedVendorId: undefined,
        assignedVendorName: undefined,
        assignedAt: undefined,
        assignedBy: undefined,
      } as unknown as Partial<AppraisalOrder>);

      if (result.success) {
        this.eventService.publishOrderStatusChanged(
          orderId, currentStatus, OrderStatus.PENDING_ASSIGNMENT, req.user!.id,
        ).catch((err) =>
          logger.error('Failed to publish ORDER_STATUS_CHANGED for unassignment', { orderId, error: err }),
        );
        this.auditService.log({
          actor: { userId: req.user!.id, ...(req.user?.email != null && { email: req.user.email }) },
          action: 'order.unassigned',
          resource: { type: 'order', id: orderId },
          before: { status: currentStatus, vendorId: previousVendorId },
          after: { status: OrderStatus.PENDING_ASSIGNMENT },
        }).catch((err) =>
          logger.error('Failed to write audit log for unassignment', { orderId, error: err }),
        );
        res.json(normalizeOrder(result.data!));
      } else {
        res.status(500).json({
          error: 'Failed to unassign vendor',
          code: 'ORDER_UNASSIGNMENT_ERROR',
          details: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to unassign vendor',
        code: 'ORDER_UNASSIGNMENT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /:orderId/payment ────────────────────────────────────────────

  private async markPayment(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { paymentStatus, paymentNotes } = req.body as {
        paymentStatus: 'UNPAID' | 'PAID' | 'PARTIAL';
        paymentNotes?: string;
      };

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }
      if (!paymentStatus || !['UNPAID', 'PAID', 'PARTIAL'].includes(paymentStatus)) {
        res.status(400).json({
          error: `paymentStatus must be one of: UNPAID, PAID, PARTIAL. Received: ${String(paymentStatus)}`,
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const patch: Record<string, unknown> = {
        paymentStatus,
        updatedAt: new Date(),
        updatedBy: req.user?.id ?? 'unknown',
      };
      if (paymentStatus === 'PAID') {
        patch['paidAt'] = new Date().toISOString();
      }
      if (paymentNotes !== undefined) {
        patch['paymentNotes'] = paymentNotes;
      }

      const result = await this.dbService.updateOrder(orderId, patch);

      if (result.success && result.data) {
        this.auditService.log({
          actor: { userId: req.user?.id ?? 'unknown', ...(req.user?.email != null && { email: req.user.email }) },
          action: 'order.payment.updated',
          resource: { type: 'order', id: orderId },
          after: { paymentStatus, paidAt: patch['paidAt'] },
        }).catch((err) => logger.error('Audit log failed for order.payment.updated', { error: err }));

        res.json(result.data);
      } else if (result.error?.code === 'ORDER_NOT_FOUND') {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'Payment update failed', code: 'PAYMENT_UPDATE_ERROR', details: result.error });
      }
    } catch (error) {
      logger.error('markPayment failed', { error, orderId: req.params.orderId });
      res.status(500).json({
        error: 'Payment update failed',
        code: 'PAYMENT_UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /:orderId/cancel ─────────────────────────────────────────────

  private async cancelOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      // Load current order to validate transition
      const current = await this.dbService.findOrderById(orderId);
      if (!current.success || !current.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
        return;
      }

      const currentStatus = normalizeOrderStatus(current.data.status as string);
      if (!isValidStatusTransition(currentStatus, OrderStatus.CANCELLED)) {
        res.status(422).json({
          error: `Cannot cancel order in ${currentStatus} status`,
          code: 'INVALID_STATUS_TRANSITION',
          currentStatus,
          requestedStatus: OrderStatus.CANCELLED,
        });
        return;
      }

      const result = await this.dbService.updateOrder(orderId, {
        status: OrderStatus.CANCELLED as unknown as AppraisalOrder['status'],
        metadata: {
          ...(current.data.metadata || {}),
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
          cancelledBy: req.user?.id || 'unknown',
        },
      } as Partial<AppraisalOrder>);

      if (result.success) {
        this.eventService.publishOrderStatusChanged(
          orderId, currentStatus, OrderStatus.CANCELLED, req.user?.id || 'unknown',
        ).catch((err) =>
          logger.error('Failed to publish ORDER_STATUS_CHANGED event for cancellation', { orderId, error: err }),
        );
        this.auditService.log({
          actor: { userId: req.user?.id || 'unknown', ...(req.user?.email != null && { email: req.user.email }) },
          action: 'order.cancelled',
          resource: { type: 'order', id: orderId },
          before: { status: currentStatus },
          after: { status: OrderStatus.CANCELLED },
          metadata: { reason },
        }).catch((err) =>
          logger.error('Failed to write audit log for cancellation', { orderId, error: err }),
        );
        this.notificationService.notifyOrderCancelled(result.data!)
          .catch((err) => logger.error('Failed to send order cancellation notification', { orderId, error: err }));
        res.json({
          success: true,
          orderId,
          orderNumber: (result.data as any)?.orderNumber || orderId,
          message: 'Order cancelled successfully',
          updatedAt: new Date(),
        });
      } else {
        res.status(500).json({
          error: 'Failed to cancel order',
          code: 'ORDER_CANCEL_ERROR',
          details: result.error,
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to cancel order',
        code: 'ORDER_CANCEL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /search ────────────────────────────────────────────────────────

  private async searchOrders(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const {
        textQuery,
        status,
        priority,
        orderType,
        productType,
        createdDateRange,
        dueDateRange,
        propertyAddress,
        assignedVendorId,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        limit = 50,
        offset = 0,
      } = req.body;

      // Build a dynamic Cosmos SQL query
      const conditions: string[] = ['c.id != null'];
      const parameters: { name: string; value: any }[] = [];

      // Full-text search across key fields
      if (textQuery && typeof textQuery === 'string' && textQuery.trim()) {
        const searchTerm = textQuery.trim().toLowerCase();
        conditions.push(
          `(CONTAINS(LOWER(c.orderNumber ?? ""), @textQuery) ` +
          `OR CONTAINS(LOWER(c.propertyAddress.streetAddress ?? ""), @textQuery) ` +
          `OR CONTAINS(LOWER(c.propertyAddress.street ?? ""), @textQuery) ` +
          `OR CONTAINS(LOWER(c.propertyAddress.city ?? ""), @textQuery) ` +
          `OR CONTAINS(LOWER(c.clientId ?? ""), @textQuery) ` +
          `OR CONTAINS(LOWER(c.specialInstructions ?? ""), @textQuery))`,
        );
        parameters.push({ name: '@textQuery', value: searchTerm });
      }

      // Array filters — status, priority, orderType, productType
      if (Array.isArray(status) && status.length > 0) {
        conditions.push(`ARRAY_CONTAINS(@statusList, c.status)`);
        parameters.push({ name: '@statusList', value: status });
      }
      if (Array.isArray(priority) && priority.length > 0) {
        conditions.push(`ARRAY_CONTAINS(@priorityList, c.priority)`);
        parameters.push({ name: '@priorityList', value: priority });
      }
      if (Array.isArray(orderType) && orderType.length > 0) {
        conditions.push(`ARRAY_CONTAINS(@orderTypeList, c.orderType)`);
        parameters.push({ name: '@orderTypeList', value: orderType });
      }
      if (Array.isArray(productType) && productType.length > 0) {
        conditions.push(`ARRAY_CONTAINS(@productTypeList, c.productType)`);
        parameters.push({ name: '@productTypeList', value: productType });
      }

      // Date ranges
      if (createdDateRange?.start) {
        conditions.push(`c.createdAt >= @createdFrom`);
        parameters.push({ name: '@createdFrom', value: createdDateRange.start });
      }
      if (createdDateRange?.end) {
        conditions.push(`c.createdAt <= @createdTo`);
        parameters.push({ name: '@createdTo', value: createdDateRange.end });
      }
      if (dueDateRange?.start) {
        conditions.push(`c.dueDate >= @dueFrom`);
        parameters.push({ name: '@dueFrom', value: dueDateRange.start });
      }
      if (dueDateRange?.end) {
        conditions.push(`c.dueDate <= @dueTo`);
        parameters.push({ name: '@dueTo', value: dueDateRange.end });
      }

      // Property address filters
      if (propertyAddress?.city) {
        conditions.push(`LOWER(c.propertyAddress.city) = @pCity`);
        parameters.push({ name: '@pCity', value: propertyAddress.city.toLowerCase() });
      }
      if (propertyAddress?.state) {
        conditions.push(`LOWER(c.propertyAddress.state) = @pState`);
        parameters.push({ name: '@pState', value: propertyAddress.state.toLowerCase() });
      }
      if (propertyAddress?.zipCode) {
        conditions.push(`c.propertyAddress.zipCode = @pZip`);
        parameters.push({ name: '@pZip', value: propertyAddress.zipCode });
      }

      // Assigned vendor
      if (assignedVendorId) {
        conditions.push(`c.assignedVendorId = @vendorId`);
        parameters.push({ name: '@vendorId', value: assignedVendorId });
      }

      const whereClause = conditions.join(' AND ');
      const allowedSortFields = ['createdAt', 'updatedAt', 'dueDate', 'orderNumber', 'status', 'priority'];
      const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const safeLimit = Math.min(Math.max(1, Number(limit)), 100);
      const safeOffset = Math.max(0, Number(offset));

      // Count query
      const countSql = `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause}`;
      const countResult = await this.dbService.queryDocuments<number>('orders', countSql, parameters);
      const total = countResult[0] ?? 0;

      // Data query
      const dataSql =
        `SELECT * FROM c WHERE ${whereClause} ` +
        `ORDER BY c.${safeSortBy} ${safeSortOrder} ` +
        `OFFSET ${safeOffset} LIMIT ${safeLimit}`;
      const orders = await this.dbService.queryDocuments<AppraisalOrder>('orders', dataSql, parameters);

      // Compute simple aggregations from the returned page
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      for (const o of orders) {
        const s = (o.status as string) || 'UNKNOWN';
        byStatus[s] = (byStatus[s] || 0) + 1;
        const p = (o.priority as string) || 'UNKNOWN';
        byPriority[p] = (byPriority[p] || 0) + 1;
      }

      res.json({
        orders: orders.map(normalizeOrder),
        total,
        aggregations: {
          byStatus,
          byPriority,
          averageTurnaroundTime: 0,
          onTimeDeliveryRate: 0,
        },
      });
    } catch (error) {
      logger.error('Order search failed', { error });
      res.status(500).json({
        error: 'Order search failed',
        code: 'ORDER_SEARCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /batch-status ──────────────────────────────────────────────────

  private async batchUpdateStatus(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderIds, status, reason } = req.body;

      // Normalize the requested status
      let newStatus: OrderStatus;
      try {
        newStatus = normalizeOrderStatus(status);
      } catch {
        res.status(400).json({
          error: `Invalid status: "${status}"`,
          code: 'INVALID_STATUS',
          validStatuses: Object.values(OrderStatus),
        });
        return;
      }

      const results: { orderId: string; success: boolean; error?: string }[] = [];

      for (const orderId of orderIds as string[]) {
        try {
          const current = await this.dbService.findOrderById(orderId);
          if (!current.success || !current.data) {
            results.push({ orderId, success: false, error: 'Order not found' });
            continue;
          }

          const currentStatus = normalizeOrderStatus(current.data.status as string);
          if (!isValidStatusTransition(currentStatus, newStatus)) {
            results.push({
              orderId,
              success: false,
              error: `Cannot transition from ${currentStatus} to ${newStatus}`,
            });
            continue;
          }

          const updateResult = await this.dbService.updateOrder(orderId, {
            status: newStatus as unknown as AppraisalOrder['status'],
            ...(reason && { metadata: { ...((current.data as any).metadata || {}), statusNotes: reason } }),
          } as Partial<AppraisalOrder>);

          if (updateResult.success) {
            results.push({ orderId, success: true });
            // Fire-and-forget: event + audit
            this.eventService.publishOrderStatusChanged(
              orderId, currentStatus, newStatus, req.user?.id || 'unknown',
            ).catch((err) =>
              logger.error('Batch: failed to publish status change event', { orderId, error: err }),
            );
            this.auditService.log({
              actor: { userId: req.user?.id || 'unknown', ...(req.user?.email != null && { email: req.user.email }) },
              action: 'order.status_changed',
              resource: { type: 'order', id: orderId },
              before: { status: currentStatus },
              after: { status: newStatus },
              metadata: { reason, batchOperation: true },
            }).catch((err) =>
              logger.error('Batch: failed to write audit log', { orderId, error: err }),
            );
          } else {
            results.push({ orderId, success: false, error: String(updateResult.error || 'Update failed') });
          }
        } catch (err) {
          results.push({
            orderId,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      res.json({ successCount, failureCount, results });
    } catch (error) {
      logger.error('Batch status update failed', { error });
      res.status(500).json({
        error: 'Batch status update failed',
        code: 'BATCH_UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── GET /dashboard ──────────────────────────────────────────────────────

  private async getOrderDashboard(_req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const [summaryResult, metricsResult, recentOrdersResult] = await Promise.allSettled([
        this.dbService.getOrderSummary(),
        this.dbService.getOrderMetrics(),
        this.dbService.getRecentOrders(10),
      ]);

      const dashboard = {
        summary:
          summaryResult.status === 'fulfilled' && summaryResult.value.success
            ? summaryResult.value.data
            : { totalOrders: 0, pendingOrders: 0, inProgressOrders: 0, completedOrders: 0 },

        metrics:
          metricsResult.status === 'fulfilled' && metricsResult.value.success
            ? metricsResult.value.data
            : { averageCompletionTime: 0, onTimeDeliveryRate: 0, qcPassRate: 0 },

        recentOrders:
          recentOrdersResult.status === 'fulfilled' && recentOrdersResult.value.success
            ? (recentOrdersResult.value.data || []).map(normalizeOrder)
            : [],
      };

      res.json(dashboard);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve dashboard',
        code: 'DASHBOARD_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── GET /:orderId/timeline ──────────────────────────────────────────────

  /**
   * Returns the chronological timeline for an order, combining:
   *   - Audit trail events (from the audit-trail container)
   *   - SLA tracking records (from the sla-tracking container)
   */
  public async getOrderTimeline(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        res.status(400).json({ error: 'orderId is required' });
        return;
      }

      // Fetch audit events for this order
      let events: any[] = [];
      try {
        const container = this.dbService.getContainer('audit-trail');
        const query = `SELECT * FROM c WHERE c.resource.id = @orderId ORDER BY c.timestamp DESC`;
        const { resources } = await container.items.query({
          query,
          parameters: [{ name: '@orderId', value: orderId }],
        }).fetchAll();
        events = resources;
      } catch (auditErr) {
        logger.error('Failed to query audit-trail for timeline', {
          orderId,
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
        // Continue — return whatever we can
      }

      // Fetch SLA records for this order
      let slaRecords: any[] = [];
      try {
        slaRecords = await this.slaService.getSLAsByOrderId(orderId);
      } catch (slaErr) {
        logger.error('Failed to query SLA records for timeline', {
          orderId,
          error: slaErr instanceof Error ? slaErr.message : String(slaErr),
        });
      }

      // Map audit events to the timeline shape the frontend expects
      const timelineEvents = events.map((e) => ({
        timestamp: e.timestamp,
        eventType: e.action || 'UNKNOWN',
        actor: e.actor?.userId || e.actor?.email || 'system',
        actorRole: e.actor?.role,
        details: {
          ...(e.metadata || {}),
          ...(e.changes ? { changes: e.changes } : {}),
          ...(e.before ? { before: e.before } : {}),
          ...(e.after ? { after: e.after } : {}),
          resourceName: e.resource?.name,
        },
      }));

      res.json({
        orderId,
        events: timelineEvents,
        slaRecords,
        count: timelineEvents.length,
      });
    } catch (error) {
      logger.error('Failed to get order timeline', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: 'Failed to retrieve order timeline',
        code: 'TIMELINE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /batch/assign ──────────────────────────────────────────────────

  private async batchAssign(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderIds, vendorId, assignedBy } = req.body;

      // Verify vendor exists
      const vendor = await this.dbService.getItem('vendors', vendorId, vendorId);
      if (!vendor) {
        res.status(404).json({ error: `Vendor ${vendorId} not found`, code: 'VENDOR_NOT_FOUND' });
        return;
      }
      const vendorName = (vendor as any)?.companyName || (vendor as any)?.name || null;

      const results: { orderId: string; success: boolean; error?: string }[] = [];

      for (const orderId of orderIds as string[]) {
        try {
          const current = await this.dbService.findOrderById(orderId);
          if (!current.success || !current.data) {
            results.push({ orderId, success: false, error: 'Order not found' });
            continue;
          }

          const currentStatus = normalizeOrderStatus(current.data.status as string);
          if (!isValidStatusTransition(currentStatus, OrderStatus.ASSIGNED)) {
            results.push({
              orderId,
              success: false,
              error: `Cannot assign vendor to order in ${currentStatus} status`,
            });
            continue;
          }

          const result = await this.dbService.updateOrder(orderId, {
            status: OrderStatus.ASSIGNED as unknown as AppraisalOrder['status'],
            assignedVendorId: vendorId,
            assignedVendorName: vendorName,
            assignedAt: new Date().toISOString(),
            assignedBy: assignedBy || req.user?.id || 'unknown',
          } as Partial<AppraisalOrder>);

          if (result.success) {
            results.push({ orderId, success: true });
            this.eventService.publishOrderStatusChanged(
              orderId, currentStatus, OrderStatus.ASSIGNED, req.user?.id || 'unknown',
            ).catch((err) =>
              logger.error('Batch assign: failed to publish event', { orderId, error: err }),
            );
            this.auditService.log({
              actor: { userId: req.user?.id || 'unknown', ...(req.user?.email != null && { email: req.user.email }) },
              action: 'order.assigned',
              resource: { type: 'order', id: orderId },
              before: { status: currentStatus },
              after: { status: OrderStatus.ASSIGNED, vendorId, vendorName },
              metadata: { batchOperation: true },
            }).catch((err) =>
              logger.error('Batch assign: failed to write audit log', { orderId, error: err }),
            );
            this.notificationService.notifyVendorAssigned(result.data!)
              .catch((err) => logger.error('Batch assign: failed to send notification', { orderId, error: err }));
          } else {
            results.push({ orderId, success: false, error: String(result.error || 'Update failed') });
          }
        } catch (err) {
          results.push({
            orderId,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      res.json({ successCount, failureCount, results });
    } catch (error) {
      logger.error('Batch assign failed', { error });
      res.status(500).json({
        error: 'Batch assign failed',
        code: 'BATCH_ASSIGN_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── POST /export ────────────────────────────────────────────────────────

  private async exportOrders(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { orderIds, format, includeFields } = req.body;
      const exportFormat = (format as string || 'CSV').toUpperCase();

      // Fetch all requested orders
      const orders: AppraisalOrder[] = [];
      for (const orderId of orderIds as string[]) {
        const result = await this.dbService.findOrderById(orderId);
        if (result.success && result.data) {
          orders.push(result.data as AppraisalOrder);
        }
      }

      if (orders.length === 0) {
        res.status(404).json({ error: 'No matching orders found', code: 'NO_ORDERS_FOUND' });
        return;
      }

      // Determine fields to export
      const defaultFields = [
        'id', 'orderNumber', 'status', 'priority', 'orderType', 'productType',
        'clientId', 'assignedVendorId', 'assignedVendorName', 'fee',
        'dueDate', 'createdAt', 'updatedAt',
        'propertyAddress.street', 'propertyAddress.city', 'propertyAddress.state', 'propertyAddress.zipCode',
      ];
      const fields = (includeFields as string[] | undefined) ?? defaultFields;

      if (exportFormat === 'JSON') {
        const data = orders.map((o) => this.pickFields(o, fields));
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="orders-export-${Date.now()}.json"`);
        res.json({ data, exportedAt: new Date().toISOString(), count: data.length });
        return;
      }

      // CSV / EXCEL (produce CSV — Excel opens CSV natively)
      const header = fields.join(',');
      const rows = orders.map((o) =>
        fields.map((f) => {
          const val = this.getNestedValue(o, f);
          const str = val == null ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(','),
      );
      const csv = [header, ...rows].join('\r\n');

      const ext = exportFormat === 'EXCEL' ? 'csv' : 'csv';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="orders-export-${Date.now()}.${ext}"`);
      res.send(csv);
    } catch (error) {
      logger.error('Export orders failed', { error });
      res.status(500).json({
        error: 'Export failed',
        code: 'EXPORT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ─── GET /:orderId/auto-assignment ──────────────────────────────────────────

  public async getAutoAssignmentStatus(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId as string;
      const tenantId = req.user!.tenantId as string;

      const result = await this.dbService.getItem('orders', orderId, tenantId);
      const order = (result as any)?.data ?? result;
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Load current bid document if one is pending
      let currentBid: any = null;
      const vendorState = order.autoVendorAssignment;
      if (vendorState?.currentBidId) {
        try {
          const bidResult = await this.dbService.getItem('vendor-bids', vendorState.currentBidId, tenantId);
          currentBid = (bidResult as any)?.data ?? bidResult ?? null;
        } catch {
          // bid may have been cleaned up — non-fatal
        }
      }

      res.json({
        orderId,
        vendorAssignment: order.autoVendorAssignment ?? null,
        reviewAssignment: order.autoReviewAssignment ?? null,
        currentBid,
        requiresHumanVendorAssignment: order.requiresHumanVendorAssignment ?? false,
        requiresHumanReviewAssignment: order.requiresHumanReviewAssignment ?? false,
      });
    } catch (error) {
      logger.error('getAutoAssignmentStatus failed', { error });
      res.status(500).json({ error: 'Failed to get auto-assignment status', code: 'AUTO_ASSIGNMENT_STATUS_ERROR' });
    }
  }

  // ─── POST /:orderId/trigger-auto-assignment ───────────────────────────────────

  public async triggerAutoAssignment(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId as string;
      const tenantId = req.user!.tenantId as string;

      const result = await this.dbService.getItem('orders', orderId, tenantId);
      const order = (result as any)?.data ?? result;
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Guard: don't re-trigger if a vendor has already accepted
      if (order.autoVendorAssignment?.status === 'ACCEPTED') {
        res.status(409).json({
          error: 'Vendor assignment is already accepted for this order — use Re-Trigger only after escalation or from an exhausted state',
        });
        return;
      }

      const addr = order.propertyAddress;
      const addrString: string =
        typeof addr === 'string'
          ? addr
          : addr?.streetAddress
            ? `${addr.streetAddress}, ${addr.city ?? ''}, ${addr.state ?? ''} ${addr.zipCode ?? ''}`.trim()
            : '';

      await this.orchestrator.triggerVendorAssignment({
        orderId: order.id,
        orderNumber: order.orderNumber ?? '',
        tenantId,
        engagementId: order.engagementId ?? orderId,
        productType: order.productType ?? order.orderType ?? '',
        propertyAddress: addrString,
        propertyState: addr?.state ?? '',
        clientId: order.clientId ?? '',
        loanAmount: order.loanInformation?.loanAmount ?? 0,
        priority: (order.priority as 'STANDARD' | 'RUSH' | 'EMERGENCY') ?? 'STANDARD',
        dueDate: order.dueDate ? new Date(order.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        // Eligibility gates — carried from the order record into the event envelope
        ...(order.productId ? { productId: order.productId as string } : {}),
        ...(Array.isArray(order.requiredCapabilities) && order.requiredCapabilities.length
          ? { requiredCapabilities: order.requiredCapabilities as string[] }
          : {}),
      });

      res.json({ success: true, message: 'Auto-assignment triggered — vendor ranking and bid dispatch initiated' });
    } catch (error) {
      logger.error('triggerAutoAssignment failed', { error });
      res.status(500).json({ error: 'Failed to trigger auto-assignment', code: 'AUTO_ASSIGNMENT_TRIGGER_ERROR' });
    }
  }

  // ─── POST /:orderId/vendor-bid/:bidId/accept ──────────────────────────────────

  public async acceptVendorBid(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId as string;
      const bidId = req.params.bidId as string;
      const tenantId = req.user!.tenantId as string;

      const bidResult = await this.dbService.getItem('vendor-bids', bidId, tenantId);
      const bid = (bidResult as any)?.data ?? bidResult;
      if (!bid) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }
      if (bid.status !== 'PENDING') {
        res.status(409).json({ error: `Bid cannot be accepted — current status: ${bid.status}` });
        return;
      }

      const orderResult = await this.dbService.getItem('orders', orderId, tenantId);
      const order = (orderResult as any)?.data ?? orderResult;
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Guard: FSM must be in PENDING_BID and this must be the current active bid
      if (order.autoVendorAssignment?.status !== 'PENDING_BID') {
        res.status(409).json({
          error: `Vendor assignment is not in PENDING_BID state (current: ${order.autoVendorAssignment?.status ?? 'none'}) — cannot accept bid`,
        });
        return;
      }
      if (order.autoVendorAssignment.currentBidId !== bidId) {
        res.status(409).json({ error: `Bid ${bidId} is not the current active bid for this order` });
        return;
      }

      // Mark bid ACCEPTED
      await this.dbService.updateItem(
        'vendor-bids',
        bid.id,
        { ...bid, status: 'ACCEPTED', acceptedAt: new Date().toISOString() },
        tenantId,
      );

      // Update order: vendor assignment state → ACCEPTED, assign vendor fields, advance order status
      const updatedVendorState = order.autoVendorAssignment
        ? { ...order.autoVendorAssignment, status: 'ACCEPTED' }
        : null;

      await this.dbService.updateItem(
        'orders',
        order.id,
        {
          ...order,
          autoVendorAssignment: updatedVendorState,
          assignedVendorId: bid.vendorId,
          assignedVendorName: bid.vendorName,
          status: OrderStatus.ASSIGNED,
          updatedAt: new Date().toISOString(),
        },
        tenantId,
      );

      // Publish vendor.bid.accepted — await so the notification service reliably receives it
      await this.publisher.publish({
        id: uuidv4(),
        type: 'vendor.bid.accepted',
        timestamp: new Date(),
        source: 'order-controller',
        version: '1.0',
        category: EventCategory.VENDOR,
        data: {
          orderId,
          orderNumber: order.orderNumber ?? '',
          tenantId,
          vendorId: bid.vendorId,
          vendorName: bid.vendorName,
          bidId,
          acceptedAt: new Date(),
          priority: EventPriority.NORMAL,
        },
      });

      res.json({
        success: true,
        data: { orderId, bidId, vendorId: bid.vendorId, vendorName: bid.vendorName, status: 'ACCEPTED' },
      });
    } catch (error) {
      logger.error('acceptVendorBid failed', { error });
      res.status(500).json({ error: 'Failed to accept vendor bid', code: 'ACCEPT_BID_ERROR' });
    }
  }

  // ─── POST /:orderId/vendor-bid/:bidId/decline ─────────────────────────────────

  public async declineVendorBid(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId as string;
      const bidId = req.params.bidId as string;
      const tenantId = req.user!.tenantId as string;
      const { reason } = req.body as { reason?: string };

      const bidResult = await this.dbService.getItem('vendor-bids', bidId, tenantId);
      const bid = (bidResult as any)?.data ?? bidResult;
      if (!bid) {
        res.status(404).json({ error: 'Bid not found' });
        return;
      }
      if (bid.status !== 'PENDING') {
        res.status(409).json({ error: `Bid cannot be declined — current status: ${bid.status}` });
        return;
      }

      const orderResult = await this.dbService.getItem('orders', orderId, tenantId);
      const order = (orderResult as any)?.data ?? orderResult;
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Guard: FSM must be in PENDING_BID and this must be the current active bid
      if (order.autoVendorAssignment?.status !== 'PENDING_BID') {
        res.status(409).json({
          error: `Vendor assignment is not in PENDING_BID state (current: ${order.autoVendorAssignment?.status ?? 'none'}) — cannot decline bid`,
        });
        return;
      }
      if (order.autoVendorAssignment.currentBidId !== bidId) {
        res.status(409).json({ error: `Bid ${bidId} is not the current active bid for this order` });
        return;
      }

      // Mark bid DECLINED
      await this.dbService.updateItem(
        'vendor-bids',
        bid.id,
        { ...bid, status: 'DECLINED', declinedAt: new Date().toISOString(), declineReason: reason ?? '' },
        tenantId,
      );

      // Publish vendor.bid.declined — orchestrator will advance to the next vendor
      await this.publisher.publish({
        id: uuidv4(),
        type: 'vendor.bid.declined',
        timestamp: new Date(),
        source: 'order-controller',
        version: '1.0',
        category: EventCategory.VENDOR,
        data: {
          orderId,
          orderNumber: order?.orderNumber ?? '',
          tenantId,
          vendorId: bid.vendorId,
          vendorName: (bid as any).vendorName ?? bid.vendorId,
          bidId,
          declineReason: reason ?? 'No reason provided',
          attemptNumber: bid.attemptNumber ?? 1,
          totalAttempts: order?.autoVendorAssignment?.rankedVendors?.length ?? 1,
          priority: EventPriority.NORMAL,
        },
      });

      res.json({ success: true, message: 'Bid declined — auto-assignment advancing to next vendor' });
    } catch (error) {
      logger.error('declineVendorBid failed', { error });
      res.status(500).json({ error: 'Failed to decline vendor bid', code: 'DECLINE_BID_ERROR' });
    }
  }

  /** Resolve a dot-delimited path like "propertyAddress.city" on an object */
  private getNestedValue(obj: Record<string, any>, path: string): unknown {
    return path.split('.').reduce<unknown>((cur, key) => {
      if (cur != null && typeof cur === 'object') return (cur as Record<string, unknown>)[key];
      return undefined;
    }, obj);
  }

  /** Pick only the requested fields from an order */
  private pickFields(obj: Record<string, any>, fields: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const f of fields) {
      result[f] = this.getNestedValue(obj, f);
    }
    return result;
  }
}