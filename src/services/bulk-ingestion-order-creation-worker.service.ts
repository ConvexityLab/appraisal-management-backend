import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import {
  BulkIngestionAdapterConfigService,
  type BulkIngestionResolvedEngagementFields,
} from './bulk-ingestion-adapter-config.service.js';
import { PropertyRecordService } from './property-record.service.js';
import { PropertyEnrichmentService } from './property-enrichment.service.js';
import { EngagementService } from './engagement.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { OrderStatus } from '../types/order-status.js';
import { OrderType, Priority } from '../types/index.js';
import { ANALYSIS_TYPE_TO_PRODUCT_TYPE } from '../types/bulk-portfolio.types.js';
import { buildBulkItemSourceIdentity, extendIntakeSourceIdentity } from '../types/intake-source.types.js';
import type {
  BaseEvent,
  BulkIngestionOrdersCreatedEvent,
  BulkIngestionOrderingRequestedEvent,
  EventHandler,
} from '../types/events.js';
import type {
  BulkIngestionAdapterConfig,
  BulkIngestionCanonicalRecord,
  BulkIngestionItem,
  BulkIngestionJob,
} from '../types/bulk-ingestion.types.js';

type EngagementContext = {
  engagement: Awaited<ReturnType<EngagementService['createEngagement']>>;
  loan: Awaited<ReturnType<EngagementService['createEngagement']>>['properties'][number] | undefined;
  productId?: string;
};

export class BulkIngestionOrderCreationWorkerService {
  private readonly logger = new Logger('BulkIngestionOrderCreationWorkerService');
  private readonly dbService: CosmosDbService;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly publisher: ServiceBusEventPublisher;
  private readonly adapterConfigService: BulkIngestionAdapterConfigService;
  private readonly propertyRecordService: PropertyRecordService;
  private readonly enrichmentService: PropertyEnrichmentService;
  private readonly engagementService: EngagementService;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    this.adapterConfigService = new BulkIngestionAdapterConfigService(this.dbService);
    this.propertyRecordService = new PropertyRecordService(this.dbService);
    // Shared enrichment service: used both by EngagementService (loan-level records)
    // and directly here (order-level records keyed by orderId).
    this.enrichmentService = new PropertyEnrichmentService(this.dbService, this.propertyRecordService);
    this.engagementService = new EngagementService(this.dbService, this.propertyRecordService, this.enrichmentService);
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
    const engagementGranularity = job.engagementGranularity ?? 'PER_BATCH';
    const adapterConfig = await this.adapterConfigService.getConfig(job.tenantId, job.adapterKey);

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

    const engagementContextsByItemId =
      engagementGranularity === 'PER_BATCH'
        ? await this.createBatchEngagementContexts(job, sortedItems, adapterConfig)
        : new Map<string, EngagementContext>();

    const canonicalRecordsByRecordId = new Map(canonicalRecords.map((record) => [record.id, record]));
    const itemsById = new Map(job.items.map((item) => [item.id, item]));
    let createdOrderCount = 0;
    let failedOrderCount = 0;

    for (const item of sortedItems) {
      const canonicalRecord = recordsByItemId.get(item.id);
      if (!canonicalRecord) {
        continue;
      }

      const correlationId = `bulk-ingestion::${job.id}::${item.id}`;

      try {
        const resolvedEngagementFields = this.resolveEngagementFields(job, item, adapterConfig);
        const engagementContext = engagementGranularity === 'PER_LOAN'
          ? await this.createPerLoanEngagementContext(job, item, adapterConfig)
          : engagementContextsByItemId.get(item.id);
        const engagement = engagementContext?.engagement;
        const engagementLoan = engagementContext?.loan;
        const engagementProductId = engagementContext?.productId;

        if (!engagement) {
          throw new Error(
            `No engagement context resolved for job='${job.id}', item='${item.id}', engagementGranularity='${engagementGranularity}'`,
          );
        }

        const parsed = this.resolveAddress(item.source);
        const orderNumber = this.generateOrderNumber(job.id, item.rowIndex);
        const dueDateDays = parseInt(process.env['BULK_INGESTION_DEFAULT_DUE_DATE_DAYS'] ?? '5', 10);
        const dueDate = new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000).toISOString();
        const sourceIdentity = item.sourceIdentity
          ?? canonicalRecord.sourceIdentity
          ?? buildBulkItemSourceIdentity({
            bulkJobId: job.id,
            bulkItemId: item.id,
            engagementId: engagement.id,
          });

        const createResult = await this.dbService.createOrder({
          orderNumber,
          tenantId: job.tenantId,
          clientId: job.clientId,
          subClientId: job.subClientId ?? '',
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
            county: item.source.county ?? '',
          },
          borrowerInfo: {
            name: resolvedEngagementFields.borrowerName,
            email: resolvedEngagementFields.email ?? '',
            phone: resolvedEngagementFields.phone ?? '',
          },
          loanInformation: {
            loanNumber: item.source.loanNumber ?? `bulk-${job.id}-${item.rowIndex}`,
            loanAmount: resolvedEngagementFields.loanAmount ?? 0,
            loanType: item.source.loanType ?? 'conventional',
            occupancyType: item.source.occupancyType ?? 'owner_occupied',
            purpose: item.source.loanPurpose ?? 'purchase',
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
            sourceIdentity,
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

        const resolvedSourceIdentity = extendIntakeSourceIdentity(sourceIdentity, {
          orderId: createResult.data.id,
          engagementId: engagement.id,
          sourceArtifactRefs: [
            {
              artifactType: 'order',
              artifactId: createResult.data.id,
            },
          ],
        }) ?? sourceIdentity;

        // Publish order.created so downstream services (auto-assignment, notifications) can react
        await this.publisher.publish({
          id: uuidv4(),
          type: 'order.created',
          timestamp: new Date(),
          source: 'bulk-ingestion-order-creation-worker',
          version: '1.0',
          category: EventCategory.ORDER,
          data: {
            orderId: createResult.data.id,
            clientId: job.clientId,
            propertyAddress: item.source.propertyAddress ?? '',
            appraisalType: ANALYSIS_TYPE_TO_PRODUCT_TYPE[job.analysisType],
            priority: EventPriority.NORMAL,
            dueDate: new Date(dueDate),
          },
        });

        // Publish engagement.order.created so auto-assignment orchestrator can rank vendors and send bids
        this.publisher.publish({
          id: uuidv4(),
          type: 'engagement.order.created',
          timestamp: new Date(),
          source: 'bulk-ingestion-order-creation-worker',
          version: '1.0',
          category: EventCategory.ORDER,
          data: {
            engagementId: engagement.id,
            orderId: createResult.data.id,
            orderNumber,
            tenantId: job.tenantId,
            clientId: job.clientId,
            propertyAddress: `${parsed.address} ${parsed.city} ${parsed.state} ${parsed.zipCode}`,
            propertyState: parsed.state,
            productType: ANALYSIS_TYPE_TO_PRODUCT_TYPE[job.analysisType],
            priority: EventPriority.NORMAL,
          },
        } as any).catch(err => {
          this.logger.warn('Bulk order creation: failed to publish engagement.order.created (auto-assignment may not trigger)', {
            jobId: job.id, orderId: createResult.data!.id, error: (err as Error).message,
          });
        });

        // Fire-and-forget order-level enrichment so getLatestEnrichment(orderId)
        // works for bulk-ingested orders — PropertyRecord is already populated
        // by loan-level enrichment, so this is usually a cache hit (status=cached).
        this.enrichmentService.enrichOrder(
          createResult.data.id,
          job.tenantId,
          { street: parsed.address, city: parsed.city, state: parsed.state, zipCode: parsed.zipCode },
          {
            engagementId: engagement.id,
            ...(engagementLoan?.propertyId ? { propertyId: engagementLoan.propertyId } : {}),
          },
        ).catch(err => {
          this.logger.warn('Bulk order creation: per-order enrichment failed (non-fatal)', {
            jobId: job.id,
            orderId: createResult.data!.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });

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
        canonicalRecord.sourceIdentity = resolvedSourceIdentity;

        item.canonicalRecord = {
          ...(item.canonicalRecord ?? {}),
          orderId: createResult.data.id,
          orderNumber: createResult.data.orderNumber,
          engagementId: engagement.id,
          engagementLoanId: engagementLoan?.id,
          engagementProductId,
          orderCreatedAt: new Date().toISOString(),
          orderCreationStatus: 'CREATED',
          sourceIdentity: resolvedSourceIdentity,
        };
        item.sourceIdentity = resolvedSourceIdentity;
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
    const batchEngagementId = engagementGranularity === 'PER_BATCH'
      ? engagementContextsByItemId.values().next().value?.engagement.id
      : undefined;

    await this.publishOrdersCreatedEvent({
      job: updatedJob,
      adapterKey,
      ...(batchEngagementId ? { engagementId: batchEngagementId } : {}),
      totalCandidateItems: sortedItems.length,
      createdOrderCount,
      failedOrderCount,
      completedAt: new Date().toISOString(),
      status,
    });

    this.logger.info('Bulk ingestion order creation complete', {
      jobId: job.id,
      tenantId: job.tenantId,
      engagementGranularity,
      totalCandidateItems: sortedItems.length,
      createdOrderCount,
      failedOrderCount,
      engagementId: batchEngagementId,
      status,
    });
  }

  private async createBatchEngagementContexts(
    job: BulkIngestionJob,
    items: BulkIngestionItem[],
    adapterConfig: BulkIngestionAdapterConfig | null,
  ): Promise<Map<string, EngagementContext>> {
    const engagement = await this.engagementService.createEngagement({
      tenantId: job.tenantId,
      createdBy: job.submittedBy,
      client: {
        clientId: job.clientId,
        clientName: job.clientId,
      },
      properties: items.map((item) => this.buildEngagementLoanInput(job, item, adapterConfig)),
    } as any);

    const engagementLoans = [...engagement.properties].sort((left, right) => {
      const leftLoan = left.loanNumber ?? '';
      const rightLoan = right.loanNumber ?? '';
      return leftLoan.localeCompare(rightLoan);
    });

    const sortedItemsByLoanNumber = [...items].sort((left, right) => {
      const leftLoan = left.source.loanNumber ?? `bulk-${job.id}-${left.rowIndex}`;
      const rightLoan = right.source.loanNumber ?? `bulk-${job.id}-${right.rowIndex}`;
      return leftLoan.localeCompare(rightLoan);
    });

    const contexts = new Map<string, EngagementContext>();
    for (let index = 0; index < sortedItemsByLoanNumber.length; index++) {
      const item = sortedItemsByLoanNumber[index];
      if (!item) {
        continue;
      }

      const loan = engagementLoans[index];
      contexts.set(item.id, {
        engagement,
        loan,
        ...(loan?.clientOrders?.[0]?.id ? { productId: loan.clientOrders[0].id } : {}),
      });
    }

    return contexts;
  }

  private async createPerLoanEngagementContext(
    job: BulkIngestionJob,
    item: BulkIngestionItem,
    adapterConfig: BulkIngestionAdapterConfig | null,
  ): Promise<EngagementContext> {
    const engagement = await this.engagementService.createEngagement({
      tenantId: job.tenantId,
      createdBy: job.submittedBy,
      client: {
        clientId: job.clientId,
        clientName: job.clientId,
      },
      properties: [this.buildEngagementLoanInput(job, item, adapterConfig)],
    } as any);

    const loan = engagement.properties[0];
    return {
      engagement,
      loan,
      ...(loan?.clientOrders?.[0]?.id ? { productId: loan.clientOrders[0].id } : {}),
    };
  }

  private buildEngagementLoanInput(
    job: BulkIngestionJob,
    item: BulkIngestionItem,
    adapterConfig: BulkIngestionAdapterConfig | null,
  ): {
    loanNumber: string;
    borrowerName: string;
    borrowerEmail?: string;
    loanType?: string;
    property: {
      address: string;
      city: string;
      state: string;
      zipCode: string;
    };
    products: Array<{ productType: string }>;
  } {
    const parsed = this.resolveAddress(item.source);
    const resolvedEngagementFields = this.resolveEngagementFields(job, item, adapterConfig);
    return {
      loanNumber: item.source.loanNumber ?? `bulk-${job.id}-${item.rowIndex}`,
      borrowerName: resolvedEngagementFields.borrowerName,
      ...(resolvedEngagementFields.email ? { borrowerEmail: resolvedEngagementFields.email } : {}),
      ...(item.source.loanType ? { loanType: item.source.loanType } : {}),
      property: {
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        zipCode: parsed.zipCode,
      },
      products: [{ productType: ANALYSIS_TYPE_TO_PRODUCT_TYPE[job.analysisType] }],
    };
  }

  private resolveEngagementFields(
    job: BulkIngestionJob,
    item: BulkIngestionItem,
    adapterConfig: BulkIngestionAdapterConfig | null,
  ): BulkIngestionResolvedEngagementFields & { borrowerName: string } {
    const resolved = this.adapterConfigService.resolveEngagementFields(item.source, adapterConfig, {
      jobId: job.id,
      itemId: item.id,
      rowIndex: item.rowIndex,
    });

    return {
      ...resolved,
      borrowerName:
        resolved.borrowerName ??
        item.source.borrowerName ??
        `Borrower-${item.source.loanNumber ?? item.rowIndex}`,
    };
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

  /**
   * Resolves a structured address from a BulkIngestionItemInput source.
   * Priority: explicit city/state/zipCode fields > comma-split of propertyAddress.
   * This avoids the brittle comma-split when structured fields are available.
   */
  private resolveAddress(source: {
    propertyAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }): { address: string; city: string; state: string; zipCode: string } {
    // If all structured fields are present, use them directly
    if (source.city && source.state && source.zipCode) {
      return {
        address: source.propertyAddress ?? 'Unknown Address',
        city: source.city,
        state: source.state.toUpperCase(),
        zipCode: source.zipCode,
      };
    }

    // Fall back to comma-split of propertyAddress (legacy behaviour)
    const raw = (source.propertyAddress ?? '').trim();
    if (!raw) {
      return {
        address: 'Unknown Address',
        city: source.city ?? 'Unknown City',
        state: source.state?.toUpperCase() ?? 'NA',
        zipCode: source.zipCode ?? '00000',
      };
    }

    const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
    const street = parts[0] ?? raw;
    const city = source.city ?? parts[1] ?? 'Unknown City';
    const stateZip = parts[2] ?? '';
    const stateZipMatch = stateZip.match(/^([A-Za-z]{2})\s*(\d{5})?/);

    return {
      address: street,
      city,
      state: source.state?.toUpperCase() ?? stateZipMatch?.[1]?.toUpperCase() ?? 'NA',
      zipCode: source.zipCode ?? stateZipMatch?.[2] ?? '00000',
    };
  }
}
