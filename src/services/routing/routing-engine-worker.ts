import { Logger } from '../../utils/logger.js';
import { CascadingBroadcastService } from './cascading-broadcast.service.js';
import { RoutingEngineState } from '../../types/routing.types.js';
import { AppraisalOrder } from '../../types/order-management.js';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const logger = new Logger('RoutingEngineWorker');

interface RoutingJobPayload {
  orderId: string;
  ruleId: string;
  attemptedAt: string;
  timeoutMinutes: number;
}

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
// We maintain a single connection for the queue, and rely on BullMQ to connect.
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

/**
 * Pillar 2: Intelligent Routing & Cascading Broadcasts
 * 
 * Handles the asynchronous aspects of the Routing Engine via BullMQ for durability.
 */
export class RoutingEngineWorker {
  private broadcastService = new CascadingBroadcastService();
  private routingQueue: Queue<RoutingJobPayload>;
  private routingWorker: Worker<RoutingJobPayload>;

  constructor() {
    this.routingQueue = new Queue<RoutingJobPayload>('RoutingEscalationQueue', { connection });
    
    this.routingWorker = new Worker<RoutingJobPayload>(
      'RoutingEscalationQueue',
      async (job: Job<RoutingJobPayload>) => {
        logger.info(`[Routing Worker] Processing timeout job for Order ${job.data.orderId}`);
        await this.processTimeout(job.data.orderId, job.data.ruleId);
      },
      { connection }
    );

    this.routingWorker.on('failed', (job: Job<RoutingJobPayload> | undefined, err: Error) => {
      if (job) {
        logger.error(`[Routing Worker] Job ${job.id} failed for Order ${job.data.orderId}`, err);
      } else {
        logger.error(`[Routing Worker] A job failed with error`, err);
      }
    });
  }

  /**
   * Schedule a future check to ensure the vendor accepted the order before the SLA/Timeout expired.
   */
  public async scheduleTimeoutCheck(orderId: string, ruleId: string, timeoutMinutes: number) {
    logger.info(`[Routing Worker] Scheduling acceptance timeout check for Order ${orderId} in ${timeoutMinutes}m using BullMQ`);
    
    // Convert timeout to ms
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    // Add job to BullMQ with a delay. Give it a predictable jobId so we can cancel it later.
    const jobId = `timeout:${orderId}:${ruleId}`;
    
    await this.routingQueue.add('escalate', {
      orderId,
      ruleId,
      attemptedAt: new Date().toISOString(),
      timeoutMinutes
    }, {
      delay: timeoutMs,
      jobId, // Unique ID to prevent dups and allow easy cancellation
      removeOnComplete: true,
      removeOnFail: 50 // retain recent failures for debugging
    });
  }

  /**
   * Called when a vendor successfully accepts an order.
   * Cancels the scheduled pull-back in BullMQ.
   */
  public async handleOrderAccepted(orderId: string, vendorId: string, ruleId: string) {
    logger.info(`[Routing Worker] Vendor ${vendorId} accepted Order ${orderId}. Cancelling fallback cascade.`);
    
    const jobId = `timeout:${orderId}:${ruleId}`;
    const job = await this.routingQueue.getJob(jobId);
    
    if (job) {
      const state = await job.getState();
      if (state === 'delayed' || state === 'waiting') {
        await job.remove();
        logger.info(`[Routing Worker] Successfully cancelled queued timeout job ${jobId}`);
      }
    }
  }

  /**
   * Worker Processor: Executes when the delay window closes and no acceptance was recorded.
   */
  private async processTimeout(orderId: string, ruleId: string) {
    logger.warn(`[Routing Worker] Timeout reached for Order ${orderId} on Rule ${ruleId}. Escalating...`);
    
    try {
      // 1. Fetch current order & routing state from DB (Mocked here)
      const order = await this.mockFetchOrder(orderId);
      const state = await this.mockFetchRoutingState(orderId);

      // In Pillar 2 we implement optimistic locking here if needed, 
      // but for now check if state changed while we were queueing.
      if (state.status === 'ASSIGNED') {
        logger.info(`[Routing Worker] Order ${orderId} was already ASSIGNED. Ignoring timeout job.`);
        return;
      }

      // 2. Trigger the Broadcast Service to read the fallbackRuleId and execute
      await this.broadcastService.escalateToNextTier(order, state);

    } catch (error) {
      logger.error(`[Routing Worker] Failed to process timeout for Order ${orderId}`, error as Error);
    }
  }


  // --- Mocks ---
  private async mockFetchOrder(orderId: string): Promise<AppraisalOrder> {
    return { id: orderId } as AppraisalOrder; 
  }

  private async mockFetchRoutingState(orderId: string): Promise<RoutingEngineState> {
    return {
      orderId,
      currentRuleId: 'RULE_1_PREFERRED',
      vendorsPinged: ['VENDOR_101'],
      currentPingStartAt: new Date().toISOString(),
      status: 'WAITING_ACCEPTANCE'
    };
  }
}
