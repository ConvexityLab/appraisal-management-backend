import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { PropertyRecordService } from './property-record.service.js';
import { EngagementService } from './engagement.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { OrderStatus } from '../types/order-status.js';
import { OrderType, Priority } from '../types/index.js';
import { ANALYSIS_TYPE_TO_PRODUCT_TYPE } from '../types/bulk-portfolio.types.js';
import type {
  BaseEvent,
  BulkIngestionOrdersCreatedEvent,
  BulkIngestionOrderingRequestedEvent,
  EventHandler,
} from '../types/events.js';
import type {
  BulkIngestionCanonicalRecord,
  BulkIngestionJob,
} from '../types/bulk-ingestion.types.js';

export class BulkIngestionOrderCreationWorkerService {
  private readonly logger = new Logger('BulkIngestionOrderCreationWorkerService');
  private readonly dbService: CosmosDbService;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly publisher: ServiceBusEventPublisher;
  private readonly propertyRecordService: PropertyRecordService;
  private readonly engagementService: EngagementService;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.propertyRecordService = new PropertyRecordService(this.dbService);
    this.engagementService = new EngagementService(this.dbService, this.propertyRecordService);
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'bulk-ingestion-order-creation-worker-service',
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('BulkIngestionOrderCreationWorkerService already started');
      return;
    }

    await this.subscriber.subscribe<BulkIngestionOrderingRequestedEvent>(
      'bulk.ingestion.ordering.requested',
      this.makeHandler('bulk.ingestion.ordering.requested', this.onOrderingRequested.bind(this)),
    );

    this.isStarted = true;
    this.isRunning = true;
    this.logger.info('BulkIngestionOrderCreationWorkerService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.subscriber.unsubscribe('bulk.ingestion.ordering.requested').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('BulkIngestionOrderCreationWorkerService stopped');
  }

  private makeHandler<T extends BaseEvent>(eventType: string, fn: (event: T) => Promise<void>): EventHandler<T> {
    const logger = this.logger;
    return {
      async handle(event: T): Promise<void> {
        try {
          await fn(event);
        } catch (error) {
          logger.error(`Unhandled error in ${eventType} handler`, {
            error: error instanceof Error ? error.message : String(error),
            eventId: event.id,
          });
          throw error;
        }
      },
    };
  }

  private async onOrderingRequested(event: BulkIngestionOrderingRequestedEvent): Promise<void> {
    const { jobId, tenantId, clientId, adapterKey } = event.data;
    if (!jobId || !tenantId || !clientId || !adapterKey) {
      throw new Error(
        `Invalid bulk.ingestion.ordering.requested payload: jobId='${jobId}', tenantId='${tenantId}', clientId='${clientId}', adapterKey='${adapterKey}'`,
      );
    }

    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Bulk ingestion job '${jobId}' not found for tenant '${tenantId}'`);
    }

    const canonicalRecords = await this.getCanonicalRecords(jobId);
    if (canonicalRecords.length === 0) {
      await this.publishOrdersCreatedEvent({
        job,
        adapterKey,
        createdOrderCount: 0,
        failedOrderCount: 0,
        totalCandidateItems: 0,
        completedAt: new Date().toISOString(),
        status: 'COMPLETED',
      });
      return;
    }

    const recordsByItemId = new Map(canonicalRecords.map((record) => [record.itemId, record]));
    const sortedItems = [...job.items]
      .filter((item) => recordsByItemId.has(item.id))
      .sort((left, right) => left.rowIndex - right.rowIndex);

    if (sortedItems.length === 0) {
      await this.publishOrdersCreatedEvent({
        job,
        adapterKey,
        createdOrderCount: 0,
        failedOrderCount: 0,
        totalCandidateItems: 0,
        completedAt: new Date().toISOString(),
        status: 'COMPLETED',
      });
      return;
    }

    const engagement = await this.engagementService.createEngagement({
      tenantId: job.tenantId,
      createdBy: job.submittedBy,
      client: {
        clientId: job.clientId,
        clientName: job.clientId,
      },
      loans: sortedItems.map((item) => {
        const parsed = this.parseAddress(item.source.propertyAddress);
        return {
          loanNumber: item.source.loanNumber ?? `bulk-${job.id}-${item.rowIndex}`,
          borrowerName: 'Unknown Borrower',
          property: {
            address: parsed.address,
            city: parsed.city,
            state: parsed.state,
            zipCode: parsed.zipCode,
          },
          products: [{ productType: ANALYSIS_TYPE_TO_PRODUCT_TYPE[job.analysisType] }],
        };
      }),
    } as any);

    const engagementLoans = [...engagement.loans].sort((left, right) => {
      const leftLoan = left.loanNumber ?? '';
      const rightLoan = right.loanNumber ?? '';
      return leftLoan.localeCompare(rightLoan);
    });

    const sortedItemsByLoanNumber = [...sortedItems].sort((left, right) => {
      const leftLoan = left.source.loanNumber ?? `bulk-${job.id}-${left.rowIndex}`;
      const rightLoan = right.source.loanNumber ?? `bulk-${job.id}-${right.rowIndex}`;
      return leftLoan.localeCompare(rightLoan);
    });

    const canonicalRecordsByRecordId = new Map(canonicalRecords.map((record) => [record.id, record]));
    const itemsById = new Map(job.items.map((item) => [item.id, item]));
    let createdOrderCount = 0;
    let failedOrderCount = 0;

    for (let index = 0; index < sortedItemsByLoanNumber.length; index++) {
      const item = sortedItemsByLoanNumber[index]!;
      const canonicalRecord = recordsByItemId.get(item.id);
      if (!canonicalRecord) {
        continue;
      }

      const engagementLoan = engagementLoans[index];
      const engagementProductId = engagementLoan?.products?.[0]?.id;
      const correlationId = `bulk-ingestion::${job.id}::${item.id}`;

      try {
        const parsed = this.parseAddress(item.source.propertyAddress);
        const orderNumber = this.generateOrderNumber(job.id, item.rowIndex);
        const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

        const createResult = await this.dbService.createOrder({
          orderNumber,
          tenantId: job.tenantId,
          clientId: job.clientId,
          engagementId: engagement.id,
          engagementLoanId: engagementLoan?.id,
          engagementProductId,
          orderType: OrderType.PURCHASE,
          orderStatus: OrderStatus.SUBMITTED,
          priority: Priority.NORMAL,
          propertyAddress: {
            street: parsed.address,
            city: parsed.city,
            state: parsed.state,
            zipCode: parsed.zipCode,
            county: '',
          },
          borrowerInfo: {
            name: 'Unknown Borrower',
            email: '',
            phone: '',
          },
          loanInformation: {
            loanNumber: item.source.loanNumber ?? `bulk-${job.id}-${item.rowIndex}`,
            loanAmount: 0,
            loanType: 'conventional',
            occupancyType: 'owner_occupied',
            purpose: 'purchase',
          },
          productType: ANALYSIS_TYPE_TO_PRODUCT_TYPE[job.analysisType],
          serviceLevel: 'standard',
          dueDate,
          fee: 0,
          assignedStaff: {
            coordinatorId: 'unassigned',
            coordinatorName: 'Unassigned Coordinator',
          },
          notes: `Bulk ingestion job ${job.id}, row ${item.rowIndex}`,
          tags: ['bulk-ingestion', `bulk-job:${job.id}`],
          metadata: {
            source: 'bulk-ingestion-order-creation-worker',
            adapterKey,
            rowIndex: item.rowIndex,
            correlationId,
          },
          createdBy: job.submittedBy,
          createdAt: new Date(),
          updatedAt: new Date(),
          type: 'order',
        } as any);

        if (!createResult.success || !createResult.data) {
          throw new Error(createResult.error?.message ?? 'createOrder returned no data');
        }

        createdOrderCount++;

        canonicalRecord.canonicalData = {
          ...(canonicalRecord.canonicalData ?? {}),
          orderId: createResult.data.id,
          orderNumber: createResult.data.orderNumber,
          engagementId: engagement.id,
          engagementLoanId: engagementLoan?.id,
          engagementProductId,
          orderCreatedAt: new Date().toISOString(),
          orderCreationStatus: 'CREATED',
        };

        item.canonicalRecord = {
          ...(item.canonicalRecord ?? {}),
          orderId: createResult.data.id,
          orderNumber: createResult.data.orderNumber,
          engagementId: engagement.id,
          engagementLoanId: engagementLoan?.id,
          engagementProductId,
          orderCreatedAt: new Date().toISOString(),
          orderCreationStatus: 'CREATED',
        };
        item.updatedAt = new Date().toISOString();
      } catch (error) {
        failedOrderCount++;
        const message = error instanceof Error ? error.message : String(error);

        canonicalRecord.canonicalData = {
          ...(canonicalRecord.canonicalData ?? {}),
          orderCreationStatus: 'FAILED',
          orderCreationError: message,
          orderCreationFailedAt: new Date().toISOString(),
        };

        item.canonicalRecord = {
          ...(item.canonicalRecord ?? {}),
          orderCreationStatus: 'FAILED',
          orderCreationError: message,
          orderCreationFailedAt: new Date().toISOString(),
        };
        item.status = 'FAILED';
        item.failures = [
          ...item.failures,
          {
            code: 'ORDER_CREATION_FAILED',
            stage: 'order-creation',
            message,
            retryable: false,
            occurredAt: new Date().toISOString(),
          },
        ];
        item.updatedAt = new Date().toISOString();
      }

      canonicalRecordsByRecordId.set(canonicalRecord.id, canonicalRecord);
      itemsById.set(item.id, item);
    }

    for (const record of canonicalRecordsByRecordId.values()) {
      await this.dbService.upsertItem<BulkIngestionCanonicalRecord>('bulk-portfolio-jobs', record);
    }

    const updatedJob: BulkIngestionJob = {
      ...job,
      items: Array.from(itemsById.values()),
    };

    const saveJobResult = await this.dbService.upsertItem<BulkIngestionJob>('bulk-portfolio-jobs', updatedJob);
    if (!saveJobResult.success || !saveJobResult.data) {
      throw new Error(`Failed to persist order creation updates for job '${job.id}'`);
    }

    const status: 'COMPLETED' | 'PARTIAL' | 'FAILED' =
      failedOrderCount === 0
        ? 'COMPLETED'
        : createdOrderCount > 0
          ? 'PARTIAL'
          : 'FAILED';

    await this.publishOrdersCreatedEvent({
      job: updatedJob,
      adapterKey,
      engagementId: engagement.id,
      totalCandidateItems: sortedItems.length,
      createdOrderCount,
      failedOrderCount,
      completedAt: new Date().toISOString(),
      status,
    });

    this.logger.info('Bulk ingestion order creation complete', {
      jobId: job.id,
      tenantId: job.tenantId,
      totalCandidateItems: sortedItems.length,
      createdOrderCount,
      failedOrderCount,
      engagementId: engagement.id,
      status,
    });
  }

  private async publishOrdersCreatedEvent(params: {
    job: BulkIngestionJob;
    adapterKey: string;
    engagementId?: string;
    totalCandidateItems: number;
    createdOrderCount: number;
    failedOrderCount: number;
    completedAt: string;
    status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  }): Promise<void> {
    const event: BulkIngestionOrdersCreatedEvent = {
      id: uuidv4(),
      type: 'bulk.ingestion.orders.created',
      timestamp: new Date(),
      source: 'bulk-ingestion-order-creation-worker-service',
      version: '1.0',
      correlationId: `bulk-ingestion-ordering::${params.job.id}`,
      category: EventCategory.DOCUMENT,
      data: {
        jobId: params.job.id,
        tenantId: params.job.tenantId,
        clientId: params.job.clientId,
        adapterKey: params.adapterKey,
        ...(params.engagementId ? { engagementId: params.engagementId } : {}),
        totalCandidateItems: params.totalCandidateItems,
        createdOrderCount: params.createdOrderCount,
        failedOrderCount: params.failedOrderCount,
        completedAt: params.completedAt,
        status: params.status,
        priority: params.status === 'FAILED' ? EventPriority.HIGH : EventPriority.NORMAL,
      },
    };

    await this.publisher.publish(event);
  }

  private async getJob(jobId: string, tenantId: string): Promise<BulkIngestionJob | null> {
    const query =
      'SELECT * FROM c WHERE c.id = @id AND c.type = @type AND c.tenantId = @tenantId';
    const result = await this.dbService.queryItems<BulkIngestionJob>('bulk-portfolio-jobs', query, [
      { name: '@id', value: jobId },
      { name: '@type', value: 'bulk-ingestion-job' },
      { name: '@tenantId', value: tenantId },
    ]);

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  private async getCanonicalRecords(jobId: string): Promise<BulkIngestionCanonicalRecord[]> {
    const query =
      'SELECT * FROM c WHERE c.type = @type AND c.jobId = @jobId';
    const result = await this.dbService.queryItems<BulkIngestionCanonicalRecord>('bulk-portfolio-jobs', query, [
      { name: '@type', value: 'bulk-ingestion-canonical-record' },
      { name: '@jobId', value: jobId },
    ]);

    const records = result.success && result.data ? result.data : [];
    return records.sort((left, right) => left.rowIndex - right.rowIndex);
  }

  private generateOrderNumber(jobId: string, rowIndex: number): string {
    const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `BI-${jobId.slice(-6).toUpperCase()}-${rowIndex}-${randomSuffix}`;
  }

  private parseAddress(address?: string): {
    address: string;
    city: string;
    state: string;
    zipCode: string;
  } {
    const raw = (address ?? '').trim();
    if (!raw) {
      return {
        address: 'Unknown Address',
        city: 'Unknown City',
        state: 'NA',
        zipCode: '00000',
      };
    }

    const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
    const street = parts[0] ?? raw;
    const city = parts[1] ?? 'Unknown City';
    const stateZip = parts[2] ?? '';
    const stateZipMatch = stateZip.match(/^([A-Za-z]{2})\s*(\d{5})?/);

    return {
      address: street,
      city,
      state: stateZipMatch?.[1]?.toUpperCase() ?? 'NA',
      zipCode: stateZipMatch?.[2] ?? '00000',
    };
  }
}
