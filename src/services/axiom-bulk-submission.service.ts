/**
 * Axiom Bulk Submission Service
 *
 * Subscribes to `axiom.bulk-evaluation.requested` and submits the referenced
 * TAPE_EVALUATION job to Axiom via BulkPortfolioService.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { BulkPortfolioService } from './bulk-portfolio.service.js';
import type {
  AxiomBulkEvaluationRequestedEvent,
  BaseEvent,
  EventHandler,
} from '../types/events.js';

export class AxiomBulkSubmissionService {
  private readonly logger = new Logger('AxiomBulkSubmissionService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly bulkPortfolioService: BulkPortfolioService;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService) {
    const resolvedDbService = dbService ?? new CosmosDbService();
    this.bulkPortfolioService = new BulkPortfolioService(resolvedDbService);
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'axiom-bulk-submission-service',
    );
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('AxiomBulkSubmissionService already started');
      return;
    }

    try {
      await this.subscriber.subscribe<AxiomBulkEvaluationRequestedEvent>(
        'axiom.bulk-evaluation.requested',
        this.makeHandler('axiom.bulk-evaluation.requested', this.onBulkEvaluationRequested.bind(this)),
      );
      this.isStarted = true;
      this.isRunning = true;
      this.logger.info('AxiomBulkSubmissionService started');
    } catch (err) {
      this.isRunning = false;
      this.logger.error('AxiomBulkSubmissionService failed to start', {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('axiom.bulk-evaluation.requested').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('AxiomBulkSubmissionService stopped');
  }

  private makeHandler<T extends BaseEvent>(
    eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    return {
      handle: async (event: T) => {
        try {
          await fn(event);
        } catch (err) {
          this.logger.error(`AxiomBulkSubmission handler failed for ${eventType}`, {
            error: (err as Error).message,
            eventId: event.id,
          });
          throw err;
        }
      },
    };
  }

  private async onBulkEvaluationRequested(event: AxiomBulkEvaluationRequestedEvent): Promise<void> {
    const { jobId, tenantId, clientId, reviewProgramId } = event.data;

    if (!jobId || !tenantId || !clientId) {
      throw new Error(
        `AxiomBulkSubmissionService received invalid event payload: ` +
        `jobId='${jobId}', tenantId='${tenantId}', clientId='${clientId}'`,
      );
    }

    await this.bulkPortfolioService.submitTapeEvaluationJobToAxiom(
      jobId,
      tenantId,
      clientId,
      reviewProgramId,
    );
  }
}
