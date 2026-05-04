import { extname } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { BlobStorageService } from './blob-storage.service.js';
import { DocumentService } from './document.service.js';
import { RevisionSeverity, RevisionStatus, type RevisionRequest } from '../types/qc-workflow.js';
import type { InspectionAppointment } from '../types/inspection.types.js';
import type {
  BaseEvent,
  EventHandler,
  EventPublisher,
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  VendorIntegrationEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { OrderStatus } from '../types/order-status.js';
import type {
  VendorInspectionRequestedBy,
  VendorEventType,
  VendorFile,
  VendorMessageReceivedPayload,
  VendorOrderAcceptedPayload,
  VendorOrderCompletedPayload,
  VendorOrderDueDateChangedPayload,
  VendorOrderFeeChangedPayload,
  VendorOrderHeldPayload,
  VendorOrderInspectedPayload,
  VendorOrderPaidPayload,
  VendorOrderReceivedPayload,
  VendorOrderResumedPayload,
  VendorOrderScheduledPayload,
  VendorRevisionRequestedPayload,
  VendorFhaCaseNumberUpdatedPayload,
  VendorLoanNumberUpdatedPayload,
} from '../types/vendor-integration.types.js';

type OrderSnapshot = Record<string, any>;

type VendorFilePersistor = (params: {
  eventId: string;
  orderId: string;
  tenantId: string;
  vendorType: string;
  vendorOrderId: string;
  files: VendorFile[];
}) => Promise<void>;

const SUBSCRIBED_VENDOR_EVENTS: VendorEventType[] = [
  'vendor.order.received',
  'vendor.order.assigned',
  'vendor.order.accepted',
  'vendor.order.scheduled',
  'vendor.order.inspected',
  'vendor.order.held',
  'vendor.order.resumed',
  'vendor.order.cancelled',
  'vendor.order.due_date_changed',
  'vendor.order.fee_changed',
  'vendor.order.paid',
  'vendor.order.completed',
  'vendor.file.received',
  'vendor.file.received_no_completion',
  'vendor.message.received',
  'vendor.revision.requested',
  'vendor.loan_number.updated',
  'vendor.fha_case_number.updated',
];

function formatPropertyAddress(order: OrderSnapshot): string {
  const propertyAddress = order.propertyAddress;
  if (typeof propertyAddress === 'string') {
    return propertyAddress;
  }

  return [
    propertyAddress?.streetAddress,
    propertyAddress?.city,
    propertyAddress?.state,
  ].filter(Boolean).join(', ');
}

function currentOrderStatus(order: OrderSnapshot): string | undefined {
  const status = order.status ?? order.orderStatus;
  return typeof status === 'string' && status.trim() ? status : undefined;
}

function inferMimeType(filename: string): string {
  switch (extname(filename).toLowerCase()) {
    case '.pdf':
      return 'application/pdf';
    case '.xml':
      return 'application/xml';
    case '.zip':
      return 'application/zip';
    case '.json':
      return 'application/json';
    case '.txt':
      return 'text/plain';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

export class VendorIntegrationEventConsumerService {
  private readonly logger = new Logger('VendorIntegrationEventConsumerService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly publisher: EventPublisher;
  private readonly filePersistor: VendorFilePersistor;
  private documentService: DocumentService | null = null;
  private isStarted = false;

  constructor(
    private readonly dbService: Pick<CosmosDbService, 'getItem' | 'updateItem' | 'queryItems' | 'upsertItem'> = new CosmosDbService(),
    publisher?: EventPublisher,
    filePersistor?: VendorFilePersistor,
  ) {
    this.publisher = publisher ?? new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'vendor-integration-event-consumer-service',
    );
    this.filePersistor = filePersistor ?? this.persistVendorFiles.bind(this);
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('VendorIntegrationEventConsumerService already started');
      return;
    }

    await Promise.all(
      SUBSCRIBED_VENDOR_EVENTS.map((eventType) =>
        this.subscriber.subscribe<VendorIntegrationEvent>(
          eventType,
          this.makeHandler(eventType, this.onVendorEvent.bind(this)),
        ),
      ),
    );

    this.isStarted = true;
    this.logger.info('VendorIntegrationEventConsumerService started', {
      eventTypes: SUBSCRIBED_VENDOR_EVENTS,
    });
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await Promise.all(
      SUBSCRIBED_VENDOR_EVENTS.map((eventType) => this.subscriber.unsubscribe(eventType).catch(() => {})),
    );
    this.isStarted = false;
    this.logger.info('VendorIntegrationEventConsumerService stopped');
  }

  private async onVendorEvent(event: VendorIntegrationEvent): Promise<void> {
    const { ourOrderId, tenantId } = event.data;

    if (!ourOrderId) {
      this.logger.warn('Vendor event has no mapped internal order id; skipping downstream consumer work', {
        eventId: event.id,
        eventType: event.type,
        vendorOrderId: event.data.vendorOrderId,
      });
      return;
    }

    switch (event.type) {
      case 'vendor.order.received':
        await this.publishOrderCreated(event, ourOrderId, tenantId, event.data.payload as VendorOrderReceivedPayload);
        return;
      case 'vendor.order.assigned':
        await this.updateOrderStatus(event, OrderStatus.ASSIGNED, {
          assignedAt: new Date(event.data.occurredAt).toISOString(),
        });
        return;
      case 'vendor.order.accepted':
        await this.updateOrderStatus(event, OrderStatus.ACCEPTED, {
          acceptedAt: new Date(event.data.occurredAt).toISOString(),
          metadata: {
            vendorIntegration: {
              lastAcceptedPayload: event.data.payload as VendorOrderAcceptedPayload,
            },
          },
        });
        return;
      case 'vendor.order.scheduled':
        await this.createInspectionArtifact(event, event.data.payload as VendorOrderScheduledPayload);
        await this.updateOrderStatus(event, OrderStatus.INSPECTION_SCHEDULED, {
          inspectionScheduledAt: (event.data.payload as VendorOrderScheduledPayload).scheduledSlot.date,
        });
        return;
      case 'vendor.order.inspected':
        await this.updateOrderStatus(event, OrderStatus.INSPECTION_COMPLETED, {
          inspectionCompletedAt: (event.data.payload as VendorOrderInspectedPayload).inspectionDate,
        });
        return;
      case 'vendor.order.held':
        await this.updateOrderStatus(event, OrderStatus.ON_HOLD, {
          holdReason: (event.data.payload as VendorOrderHeldPayload).message,
        });
        return;
      case 'vendor.order.resumed':
        await this.updateOrderStatus(event, OrderStatus.IN_PROGRESS, {
          resumedAt: new Date(event.data.occurredAt).toISOString(),
          resumeReason: (event.data.payload as VendorOrderResumedPayload).message,
        });
        return;
      case 'vendor.order.cancelled':
        await this.updateOrderStatus(event, OrderStatus.CANCELLED, {
          cancellationReason: (event.data.payload as { message?: string }).message,
          cancelledAt: new Date(event.data.occurredAt).toISOString(),
        });
        return;
      case 'vendor.order.due_date_changed':
        await this.updateOrderFields(event, (order) => ({
          dueDate: new Date((event.data.payload as VendorOrderDueDateChangedPayload).dueDate),
          metadata: {
            ...order.metadata,
            vendorIntegration: {
              ...(order.metadata?.vendorIntegration ?? {}),
              lastDueDateChangeAt: event.data.occurredAt,
            },
          },
        }));
        return;
      case 'vendor.order.fee_changed':
        await this.updateOrderFields(event, (order) => ({
          vendorFee: (event.data.payload as VendorOrderFeeChangedPayload).fee,
          metadata: {
            ...order.metadata,
            vendorIntegration: {
              ...(order.metadata?.vendorIntegration ?? {}),
              lastFeeChangeAt: event.data.occurredAt,
            },
          },
        }));
        return;
      case 'vendor.order.paid':
        await this.updateOrderFields(event, () => ({
          paymentStatus: 'PAID',
          paidAt: new Date(event.data.occurredAt).toISOString(),
          paymentNotes: `Vendor reported payment received: ${(event.data.payload as VendorOrderPaidPayload).paidAmount}`,
        }));
        return;
      case 'vendor.file.received':
      case 'vendor.file.received_no_completion': {
        const payload = event.data.payload as VendorOrderCompletedPayload;
        await this.filePersistor({
          eventId: event.id,
          orderId: ourOrderId,
          tenantId,
          vendorType: event.data.vendorType,
          vendorOrderId: event.data.vendorOrderId,
          files: payload.files,
        });
        return;
      }
      case 'vendor.order.completed': {
        const payload = event.data.payload as VendorOrderCompletedPayload;
        await this.filePersistor({
          eventId: event.id,
          orderId: ourOrderId,
          tenantId,
          vendorType: event.data.vendorType,
          vendorOrderId: event.data.vendorOrderId,
          files: payload.files,
        });
        await this.updateOrderStatus(event, OrderStatus.SUBMITTED, {
          submittedAt: new Date(event.data.occurredAt).toISOString(),
        });
        return;
      }
      case 'vendor.message.received':
        await this.recordCommunication(event, {
          category: 'order_discussion',
          subject: (event.data.payload as VendorMessageReceivedPayload).subject,
          body: (event.data.payload as VendorMessageReceivedPayload).content,
        });
        return;
      case 'vendor.revision.requested':
        await this.recordCommunication(event, {
          category: 'revision_request',
          subject: (event.data.payload as VendorRevisionRequestedPayload).subject,
          body: (event.data.payload as VendorRevisionRequestedPayload).content,
        });
        await this.createRevisionArtifact(event, event.data.payload as VendorRevisionRequestedPayload);
        await this.updateOrderStatus(event, OrderStatus.REVISION_REQUESTED);
        return;
      case 'vendor.loan_number.updated':
        await this.updateOrderFields(event, (order) => ({
          loanInformation: {
            ...(order.loanInformation ?? {}),
            loanNumber: (event.data.payload as VendorLoanNumberUpdatedPayload).loanNumber,
          },
        }));
        return;
      case 'vendor.fha_case_number.updated':
        await this.updateOrderFields(event, (order) => ({
          loanInformation: {
            ...(order.loanInformation ?? {}),
            fhaCaseNumber: (event.data.payload as VendorFhaCaseNumberUpdatedPayload).caseNumber,
          },
        }));
        return;
      default:
        this.logger.debug('No downstream consumer action configured for vendor event type', {
          eventType: event.type,
          eventId: event.id,
        });
    }
  }

  private async publishOrderCreated(
    event: VendorIntegrationEvent,
    orderId: string,
    tenantId: string,
    payload: VendorOrderReceivedPayload,
  ): Promise<void> {
    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.warn('vendor.order.received: order not found for order.created publish', { orderId, tenantId });
      return;
    }

    const orderCreatedEvent: OrderCreatedEvent = {
      id: uuidv4(),
      type: 'order.created',
      timestamp: new Date(event.data.occurredAt),
      source: 'vendor-integration-event-consumer-service',
      version: '1.0',
      correlationId: event.id,
      category: EventCategory.ORDER,
      data: {
        orderId,
        clientId: order.clientId ?? event.data.lenderId,
        propertyAddress: formatPropertyAddress(order),
        appraisalType: String(order.productType ?? payload.orderType ?? 'vendor_order'),
        priority: payload.rush ? EventPriority.HIGH : EventPriority.NORMAL,
        dueDate: new Date(order.dueDate ?? payload.dueDate ?? event.data.occurredAt),
        ...(payload.anticipatedValue !== undefined ? { estimatedValue: payload.anticipatedValue } : {}),
      },
    };

    await this.publisher.publish(orderCreatedEvent);
  }

  private async updateOrderStatus(
    event: VendorIntegrationEvent,
    newStatus: OrderStatus,
    extraUpdates?: Record<string, unknown>,
  ): Promise<void> {
    await this.updateOrderFields(event, (order) => ({
      ...(extraUpdates ?? {}),
      status: newStatus,
      orderStatus: newStatus,
      updatedAt: new Date(),
      lastUpdated: new Date(),
      metadata: {
        ...order.metadata,
        vendorIntegration: {
          ...(order.metadata?.vendorIntegration ?? {}),
          lastVendorEventType: event.type,
          lastVendorEventAt: event.data.occurredAt,
        },
      },
    }), true);
  }

  private async updateOrderFields(
    event: VendorIntegrationEvent,
    buildUpdates: (order: OrderSnapshot) => Record<string, unknown>,
    publishStatusChange: boolean = false,
  ): Promise<void> {
    const orderId = event.data.ourOrderId;
    if (!orderId) return;

    const order = await this.loadOrder(orderId, event.data.tenantId);
    if (!order) {
      this.logger.warn('Vendor downstream consumer could not find order', {
        orderId,
        tenantId: event.data.tenantId,
        eventType: event.type,
      });
      return;
    }

    const previousStatus = currentOrderStatus(order);
    const updates = buildUpdates(order);
    const updateResult = await this.dbService.updateItem<OrderSnapshot>('orders', orderId, updates as Partial<OrderSnapshot>, event.data.tenantId);
    if (!updateResult.success || !updateResult.data) {
      throw new Error(updateResult.error?.message ?? `Failed to update order ${orderId} from vendor event ${event.type}`);
    }

    const nextStatus = currentOrderStatus(updateResult.data);
    if (publishStatusChange && previousStatus && nextStatus && previousStatus !== nextStatus) {
      const statusChangedEvent: OrderStatusChangedEvent = {
        id: uuidv4(),
        type: 'order.status.changed',
        timestamp: new Date(event.data.occurredAt),
        source: 'vendor-integration-event-consumer-service',
        version: '1.0',
        correlationId: event.id,
        category: EventCategory.ORDER,
        data: {
          orderId,
          tenantId: event.data.tenantId,
          clientId: updateResult.data.clientId ?? event.data.lenderId,
          previousStatus,
          newStatus: nextStatus,
          changedBy: `vendor:${event.data.vendorType}`,
          priority: EventPriority.NORMAL,
        },
      };

      await this.publisher.publish(statusChangedEvent);
    }
  }

  private async recordCommunication(
    event: VendorIntegrationEvent,
    message: { category: 'order_discussion' | 'revision_request'; subject?: string; body: string },
  ): Promise<void> {
    const orderId = event.data.ourOrderId;
    if (!orderId) return;

    const record = {
      id: `vendor-communication:${event.id}`,
      tenantId: event.data.tenantId,
      type: 'communication' as const,
      primaryEntity: {
        type: 'order' as const,
        id: orderId,
      },
      relatedEntities: [
        {
          type: 'vendor' as const,
          id: event.data.vendorOrderId,
          name: event.data.vendorType,
          role: 'integration-partner',
        },
      ],
      threadId: `vendor-thread:${event.data.connectionId}:${event.data.vendorOrderId}`,
      channel: 'in_app' as const,
      direction: 'inbound' as const,
      from: {
        id: event.data.connectionId,
        name: event.data.vendorType,
        role: 'vendor',
      },
      to: [
        {
          id: event.data.lenderId,
          name: event.data.lenderId,
          role: 'lender',
        },
      ],
      subject: message.subject,
      body: message.body,
      bodyFormat: 'text' as const,
      status: 'delivered' as const,
      deliveredAt: new Date(event.data.occurredAt),
      category: message.category,
      priority: 'normal' as const,
      tags: ['vendor-integration', `vendor:${event.data.vendorType}`, `event:${event.type}`],
      createdAt: new Date(event.data.occurredAt),
      metadata: {
        vendorIntegration: {
          vendorType: event.data.vendorType,
          vendorOrderId: event.data.vendorOrderId,
          vendorEventId: event.id,
        },
      },
    };

    const result = await this.dbService.upsertItem('communications', record);
    if (!result.success) {
      throw new Error(result.error?.message ?? `Failed to persist communication for vendor event ${event.id}`);
    }
  }

  private async createRevisionArtifact(
    event: VendorIntegrationEvent,
    payload: VendorRevisionRequestedPayload,
  ): Promise<void> {
    const orderId = event.data.ourOrderId;
    if (!orderId) {
      return;
    }

    const existing = await this.dbService.queryItems<{ id: string }>(
      'revisions',
      [
        'SELECT TOP 1 c.id FROM c',
        'WHERE c.orderId = @orderId',
        'AND c.metadata.vendorIntegration.vendorEventId = @vendorEventId',
      ].join(' '),
      [
        { name: '@orderId', value: orderId },
        { name: '@vendorEventId', value: event.id },
      ],
    );

    if (existing.success && (existing.data?.length ?? 0) > 0) {
      return;
    }

    const order = await this.loadOrder(orderId, event.data.tenantId);
    if (!order) {
      this.logger.warn('Vendor revision artifact skipped because order was not found', {
        orderId,
        tenantId: event.data.tenantId,
        eventId: event.id,
      });
      return;
    }

    const history = await this.dbService.queryItems<Pick<RevisionRequest, 'version'>>(
      'revisions',
      'SELECT c.version FROM c WHERE c.orderId = @orderId',
      [{ name: '@orderId', value: orderId }],
    );

    const nextVersion = Math.max(
      1,
      ...(history.success ? (history.data ?? []).map((revision) => Number(revision.version ?? 0)) : [0]),
    );

    const severity = inferRevisionSeverity(payload);
    const dueDate = inferRevisionDueDate(event.data.occurredAt, severity);
    const assignedTo = String(order.appraiserId ?? order.vendorId ?? order.assignedVendorId ?? '');
    const assignedToName = String(order.appraiserName ?? order.vendorName ?? order.assignedVendorName ?? '');
    const requestNotes = [
      payload.subject?.trim() ? `Subject: ${payload.subject.trim()}` : null,
      payload.content.trim(),
      'Created from inbound vendor integration event.',
      `Severity derived from vendor payload as ${severity}; due date set to ${dueDate.toISOString()}.`,
    ].filter(Boolean).join('\n\n');

    const revision: RevisionRequest & { metadata: Record<string, unknown> } = {
      id: `vendor-revision:${event.id}`,
      orderId,
      orderNumber: String(order.orderNumber ?? orderId),
      appraisalId: String(order.appraisalId ?? orderId),
      qcReportId: '',
      version: nextVersion,
      revisionNumber: `REV-${nextVersion}`,
      severity,
      status: RevisionStatus.PENDING,
      issues: [
        {
          id: `vendor-revision-issue:${event.id}`,
          category: 'vendor_integration',
          issueType: 'vendor_revision_request',
          severity,
          description: payload.content.trim(),
          resolved: false,
          ...(payload.subject?.trim() ? { currentValue: payload.subject.trim() } : {}),
        },
      ],
      requestedBy: event.data.connectionId,
      requestedByName: `${event.data.vendorType} integration`,
      assignedTo,
      assignedToName,
      requestedAt: new Date(event.data.occurredAt),
      dueDate,
      requestNotes,
      notificationsSent: [],
      remindersSent: 0,
      createdAt: new Date(event.data.occurredAt),
      updatedAt: new Date(event.data.occurredAt),
      metadata: {
        vendorIntegration: {
          vendorEventId: event.id,
          vendorType: event.data.vendorType,
          vendorOrderId: event.data.vendorOrderId,
          connectionId: event.data.connectionId,
        },
      },
    };

    const result = await this.dbService.upsertItem('revisions', revision);
    if (!result.success) {
      throw new Error(result.error?.message ?? `Failed to persist revision artifact for vendor event ${event.id}`);
    }
  }

  private async createInspectionArtifact(
    event: VendorIntegrationEvent,
    payload: VendorOrderScheduledPayload,
  ): Promise<void> {
    const orderId = event.data.ourOrderId;
    if (!orderId) {
      return;
    }

    const existing = await this.dbService.queryItems<{ id: string }>(
      'orders',
      [
        'SELECT TOP 1 c.id FROM c',
        'WHERE c.type = @type',
        'AND (c.id = @id OR c.metadata.vendorIntegration.vendorEventId = @vendorEventId)',
      ].join(' '),
      [
        { name: '@type', value: 'inspection' },
        { name: '@id', value: `vendor-inspection:${event.id}` },
        { name: '@vendorEventId', value: event.id },
      ],
    );

    if (existing.success && (existing.data?.length ?? 0) > 0) {
      return;
    }

    const order = await this.loadOrder(orderId, event.data.tenantId);
    if (!order) {
      this.logger.warn('Vendor inspection artifact skipped because order was not found', {
        orderId,
        tenantId: event.data.tenantId,
        eventId: event.id,
      });
      return;
    }

    const appraiser = await this.loadAppraiser(payload.appraiserId, event.data.tenantId);
    if (!appraiser) {
      throw new Error(
        `Vendor scheduled event ${event.id} requires an appraiser record for appraiserId=${payload.appraiserId}`,
      );
    }

    const nowIso = new Date(event.data.occurredAt).toISOString();
    const inspection: InspectionAppointment & { metadata: Record<string, unknown> } = {
      id: `vendor-inspection:${event.id}`,
      type: 'inspection',
      appointmentType: payload.appointmentType ?? 'property_inspection',
      tenantId: event.data.tenantId,
      orderId,
      orderNumber: String(order.orderNumber ?? orderId),
      appraiserId: payload.appraiserId,
      appraiserName: `${appraiser.firstName} ${appraiser.lastName}`.trim(),
      appraiserPhone: String(appraiser.phone ?? ''),
      propertyAddress: formatPropertyAddress(order),
      propertyType: String(order.propertyType ?? order.productType ?? 'unknown'),
      propertyAccess: payload.propertyAccess,
      status: 'scheduled',
      scheduledSlot: payload.scheduledSlot,
      requestedBy: payload.requestedBy as VendorInspectionRequestedBy,
      requestedAt: nowIso,
      inspectionNotes: payload.inspectionNotes ?? '',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: `vendor:${event.data.vendorType}`,
      metadata: {
        vendorIntegration: {
          vendorEventId: event.id,
          vendorType: event.data.vendorType,
          vendorOrderId: event.data.vendorOrderId,
          connectionId: event.data.connectionId,
        },
      },
    };

    const result = await this.dbService.upsertItem('orders', inspection);
    if (!result.success) {
      throw new Error(result.error?.message ?? `Failed to persist inspection artifact for vendor event ${event.id}`);
    }
  }

  private async persistVendorFiles(params: {
    eventId: string;
    orderId: string;
    tenantId: string;
    vendorType: string;
    vendorOrderId: string;
    files: VendorFile[];
  }): Promise<void> {
    if (params.files.length === 0) {
      return;
    }

    const documentService = this.getDocumentService();
    for (const file of params.files) {
      const existing = await this.dbService.queryItems<{ id: string }>(
        'documents',
        [
          'SELECT TOP 1 c.id FROM c',
          'WHERE c.orderId = @orderId',
          'AND c.metadata.vendorIntegration.vendorEventId = @vendorEventId',
          'AND c.metadata.vendorIntegration.fileId = @fileId',
        ].join(' '),
        [
          { name: '@orderId', value: params.orderId },
          { name: '@vendorEventId', value: params.eventId },
          { name: '@fileId', value: file.fileId },
        ],
      );

      if (existing.success && (existing.data?.length ?? 0) > 0) {
        continue;
      }

      const buffer = Buffer.from(file.content, 'base64');
      const uploadResult = await documentService.uploadDocument(
        params.orderId,
        params.tenantId,
        {
          buffer,
          originalname: file.filename,
          mimetype: inferMimeType(file.filename),
          size: buffer.length,
        },
        `vendor:${params.vendorType}`,
        file.category,
        ['vendor-integration', `vendor:${params.vendorType}`],
        {
          vendorIntegration: {
            vendorEventId: params.eventId,
            vendorOrderId: params.vendorOrderId,
            vendorType: params.vendorType,
            fileId: file.fileId,
            categoryLabel: file.categoryLabel,
            description: file.description,
          },
        },
        'order',
        params.orderId,
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error?.message ?? `Failed to persist vendor file ${file.fileId}`);
      }
    }
  }

  private getDocumentService(): DocumentService {
    if (!this.documentService) {
      this.documentService = new DocumentService(this.dbService as CosmosDbService, new BlobStorageService());
    }

    return this.documentService;
  }

  private async loadOrder(orderId: string, tenantId: string): Promise<OrderSnapshot | null> {
    const result = await this.dbService.getItem<OrderSnapshot>('orders', orderId, tenantId);
    if (result.success && result.data) {
      return result.data;
    }

    return null;
  }

  private async loadAppraiser(
    appraiserId: string,
    tenantId: string,
  ): Promise<{ id: string; firstName: string; lastName: string; phone: string } | null> {
    const result = await this.dbService.queryItems<{ id: string; firstName: string; lastName: string; phone: string }>(
      'appraisers',
      [
        'SELECT TOP 1 c.id, c.firstName, c.lastName, c.phone FROM c',
        'WHERE c.type = @type',
        'AND c.tenantId = @tenantId',
        'AND c.id = @id',
      ].join(' '),
      [
        { name: '@type', value: 'appraiser' },
        { name: '@tenantId', value: tenantId },
        { name: '@id', value: appraiserId },
      ],
    );

    if (!result.success) {
      throw new Error(result.error?.message ?? `Failed to load appraiser ${appraiserId}`);
    }

    return result.data?.[0] ?? null;
  }

  private makeHandler<T extends BaseEvent>(
    eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    return {
      handle: async (event: T) => {
        this.logger.debug('Handling normalized vendor event', {
          eventType,
          eventId: event.id,
        });
        await fn(event);
      },
    };
  }
}

function inferRevisionSeverity(payload: VendorRevisionRequestedPayload): RevisionSeverity {
  const text = `${payload.subject ?? ''} ${payload.content}`.toLowerCase();

  if (/(critical|urgent|fraud|compliance|immediately)/.test(text)) {
    return RevisionSeverity.CRITICAL;
  }

  if (/(major|material|value|comp|reconsider)/.test(text)) {
    return RevisionSeverity.MAJOR;
  }

  if (/(minor|format|typo)/.test(text)) {
    return RevisionSeverity.MINOR;
  }

  return RevisionSeverity.MODERATE;
}

function inferRevisionDueDate(occurredAt: string, severity: RevisionSeverity): Date {
  const base = new Date(occurredAt);
  const dueDate = new Date(base);

  switch (severity) {
    case RevisionSeverity.CRITICAL:
      dueDate.setUTCDate(dueDate.getUTCDate() + 1);
      break;
    case RevisionSeverity.MAJOR:
      dueDate.setUTCDate(dueDate.getUTCDate() + 2);
      break;
    case RevisionSeverity.MINOR:
      dueDate.setUTCDate(dueDate.getUTCDate() + 5);
      break;
    case RevisionSeverity.MODERATE:
    default:
      dueDate.setUTCDate(dueDate.getUTCDate() + 3);
      break;
  }

  return dueDate;
}