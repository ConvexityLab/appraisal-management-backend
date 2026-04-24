import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import type {
  BaseEvent,
  BulkIngestionCriteriaCompletedEvent,
  BulkIngestionExtractionCompletedEvent,
  EventHandler,
} from '../types/events.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type {
  BulkIngestionCriteriaConfig,
  BulkIngestionCriteriaRule,
  BulkIngestionJob,
} from '../types/bulk-ingestion.types.js';

// ---------------------------------------------------------------------------
// Criteria evaluation helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a dot-separated field path from an object.
 * e.g. "sourceData.loanAmount" on a canonicalRecord object.
 */
function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = obj;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

/**
 * Evaluate a single rule against the given item fields.
 * Returns true if the rule PASSES (constraint satisfied), false if it FAILS.
 */
function evaluateRule(fields: Record<string, unknown>, rule: BulkIngestionCriteriaRule): boolean {
  const actual = getFieldValue(fields, rule.field);

  switch (rule.operator) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'eq':
      return actual === rule.value;
    case 'neq':
      return actual !== rule.value;
    case 'gt':
      return typeof actual === 'number' && typeof rule.value === 'number' && actual > rule.value;
    case 'gte':
      return typeof actual === 'number' && typeof rule.value === 'number' && actual >= rule.value;
    case 'lt':
      return typeof actual === 'number' && typeof rule.value === 'number' && actual < rule.value;
    case 'lte':
      return typeof actual === 'number' && typeof rule.value === 'number' && actual <= rule.value;
    case 'in':
      return Array.isArray(rule.values) && rule.values.includes(actual);
    default:
      return true;
  }
}

export class BulkIngestionCriteriaWorkerService {
  private readonly logger = new Logger('BulkIngestionCriteriaWorkerService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly publisher: ServiceBusEventPublisher;
  private readonly dbService: CosmosDbService;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.publisher = new ServiceBusEventPublisher();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'bulk-ingestion-criteria-worker-service',
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('BulkIngestionCriteriaWorkerService already started');
      return;
    }

    await this.subscriber.subscribe<BulkIngestionExtractionCompletedEvent>(
      'bulk.ingestion.extraction.completed',
      this.makeHandler(
        'bulk.ingestion.extraction.completed',
        this.onBulkIngestionExtractionCompleted.bind(this),
      ),
    );

    this.isStarted = true;
    this.isRunning = true;
    this.logger.info('BulkIngestionCriteriaWorkerService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.subscriber.unsubscribe('bulk.ingestion.extraction.completed').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('BulkIngestionCriteriaWorkerService stopped');
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

  // ---------------------------------------------------------------------------
  // Criteria config loading
  // ---------------------------------------------------------------------------

  /**
   * Load the criteria config for a tenant (optionally client-scoped).
   * Client-scoped config takes precedence over tenant-wide config.
   * Returns null when no config exists — items will auto-PASS.
   */
  private async loadCriteriaConfig(
    tenantId: string,
    clientId: string,
  ): Promise<BulkIngestionCriteriaConfig | null> {
    const result = await this.dbService.queryItems<BulkIngestionCriteriaConfig>(
      'bulk-portfolio-jobs',
      `SELECT * FROM c
       WHERE c.type = @type AND c.tenantId = @tenantId
       ORDER BY c.clientId DESC`,  // client-scoped rows sort before tenant-wide (DESC puts non-null first)
      [
        { name: '@type', value: 'bulk-ingestion-criteria-config' },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    // Prefer exact client match, fall back to tenant-wide (no clientId)
    const clientScoped = result.data.find((cfg) => cfg.clientId === clientId);
    const tenantWide = result.data.find((cfg) => !cfg.clientId);
    return clientScoped ?? tenantWide ?? null;
  }

  // ---------------------------------------------------------------------------
  // Event handler
  // ---------------------------------------------------------------------------

  private async onBulkIngestionExtractionCompleted(
    event: BulkIngestionExtractionCompletedEvent,
  ): Promise<void> {
    const { jobId, tenantId, clientId, itemId, rowIndex, status, completedAt, error } = event.data;

    // If extraction itself failed, skip criteria and propagate the failure.
    if (status === 'failed') {
      await this.publisher.publish(this.buildCriteriaEvent(event, {
        status: 'failed',
        criteriaStatus: 'failed',
        criteriaDecision: undefined,
        reason: error ?? 'Criteria stage not run because extraction failed',
        completedAt,
        priority: EventPriority.HIGH,
      }));
      return;
    }

    const criteriaEnabled = process.env.BULK_INGESTION_ENABLE_CRITERIA_STAGE === 'true';

    if (!criteriaEnabled) {
      await this.publisher.publish(this.buildCriteriaEvent(event, {
        status: 'completed',
        criteriaStatus: 'skipped',
        criteriaDecision: undefined,
        reason: 'Criteria stage skipped (BULK_INGESTION_ENABLE_CRITERIA_STAGE=false)',
        completedAt,
        priority: EventPriority.NORMAL,
      }));
      return;
    }

    // Load the criteria config for this tenant/client.
    const criteriaConfig = await this.loadCriteriaConfig(tenantId, clientId);

    let criteriaDecision: 'PASSED' | 'FAILED' | 'REVIEW';
    let reason: string;

    if (!criteriaConfig || criteriaConfig.rules.length === 0) {
      // No rules configured — auto-pass.
      criteriaDecision = 'PASSED';
      reason = 'No criteria rules configured for tenant; item auto-passed';
      this.logger.debug('No criteria config found; auto-passing item', { jobId, itemId });
    } else {
      // Load the job to get the item's canonical record.
      const jobResult = await this.dbService.queryItems<BulkIngestionJob>(
        'bulk-portfolio-jobs',
        'SELECT * FROM c WHERE c.type = @type AND c.id = @id AND c.tenantId = @tenantId',
        [
          { name: '@type', value: 'bulk-ingestion-job' },
          { name: '@id', value: jobId },
          { name: '@tenantId', value: tenantId },
        ],
      );

      if (!jobResult.success || !jobResult.data || jobResult.data.length === 0) {
        throw new Error(`Criteria evaluation: job '${jobId}' not found for tenant '${tenantId}'`);
      }

      const job = jobResult.data[0];
      if (!job) {
        throw new Error(`Criteria evaluation: job '${jobId}' not found for tenant '${tenantId}'`);
      }

      const item = job.items.find((i) => i.id === itemId);
      if (!item) {
        throw new Error(`Criteria evaluation: item '${itemId}' not found in job '${jobId}'`);
      }

      // The canonical record is the merged fields available for evaluation.
      const fields = (item.canonicalRecord ?? {}) as Record<string, unknown>;

      // Evaluate rules — first failing rule determines the decision.
      const failedRule = criteriaConfig.rules.find((rule) => !evaluateRule(fields, rule));

      if (failedRule) {
        criteriaDecision = failedRule.failDecision ?? 'FAILED';
        reason = failedRule.description
          ? `Rule failed: ${failedRule.description} (field=${failedRule.field})`
          : `Criteria rule failed: field='${failedRule.field}' operator='${failedRule.operator}'`;
      } else {
        criteriaDecision = criteriaConfig.defaultDecision;
        reason = `All ${criteriaConfig.rules.length} criteria rule(s) passed`;
      }

      // Persist the decision back to the item in Cosmos.
      const now = new Date().toISOString();
      const updatedJob: BulkIngestionJob = {
        ...job,
        items: job.items.map((i) =>
          i.id === itemId ? { ...i, criteriaStatus: criteriaDecision, criteriaDecision, updatedAt: now } : i,
        ),
      };

      const saveResult = await this.dbService.upsertItem<BulkIngestionJob>('bulk-portfolio-jobs', updatedJob);
      if (!saveResult.success) {
        throw new Error(`Failed to persist criteria decision for item '${itemId}' in job '${jobId}'`);
      }

      this.logger.info('Criteria evaluation complete', { jobId, itemId, criteriaDecision });
    }

    await this.publisher.publish(this.buildCriteriaEvent(event, {
      status: 'completed',
      criteriaStatus: 'completed',
      criteriaDecision,
      reason,
      completedAt,
      priority: EventPriority.NORMAL,
    }));
  }

  // ---------------------------------------------------------------------------
  // Event builder
  // ---------------------------------------------------------------------------

  private buildCriteriaEvent(
    sourceEvent: BulkIngestionExtractionCompletedEvent,
    params: {
      status: 'completed' | 'failed';
      criteriaStatus: 'completed' | 'skipped' | 'failed';
      criteriaDecision: 'PASSED' | 'FAILED' | 'REVIEW' | undefined;
      reason: string;
      completedAt: string;
      priority: EventPriority;
    },
  ): BulkIngestionCriteriaCompletedEvent {
    const { jobId, tenantId, clientId, itemId, rowIndex } = sourceEvent.data;
    return {
      id: uuidv4(),
      type: 'bulk.ingestion.criteria.completed',
      timestamp: new Date(),
      source: 'bulk-ingestion-criteria-worker-service',
      version: '1.0',
      ...(sourceEvent.correlationId ? { correlationId: sourceEvent.correlationId } : {}),
      category: EventCategory.DOCUMENT,
      data: {
        jobId,
        tenantId,
        clientId,
        itemId,
        rowIndex,
        status: params.status,
        criteriaStatus: params.criteriaStatus,
        ...(params.criteriaDecision !== undefined ? { criteriaDecision: params.criteriaDecision } : {}),
        completedAt: params.completedAt,
        reason: params.reason,
        priority: params.priority,
      },
    };
  }
}
