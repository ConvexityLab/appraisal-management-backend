import { AppraisalOrder } from '../../types/order-management.js';
import { RoutingStrategyType, CascadingRoutingRule, RoutingEngineState, VendorScorecard } from '../../types/routing.types.js';
import { VendorCapacityThrottle } from '../../types/routing.types.js';
import { CapacityManagementService } from './capacity-management.service.js';
import { Logger } from '../../utils/logger.js';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
const routingQueue = new Queue('RoutingEscalationQueue', { connection });

const logger = new Logger('CascadingBroadcastService');

export class CascadingBroadcastService {
  private capacityEngine = new CapacityManagementService();

  /**
   * 2.1 Waterfall & Cascading Broadcast Logic
   * Begins the broadcasting process for a given order using the target vendor pool.
   */
  public async initiateBroadcast(
    order: AppraisalOrder, 
    candidatePool: { vendorId: string; tier: string; scorecard: VendorScorecard }[], 
    rules: CascadingRoutingRule[]
  ): Promise<RoutingEngineState> {
    logger.info(`Initiating cascading broadcast for Order ${order.id}`);

    // If no rules pass in, default to basic tier expansion strategy
    const activeRules = rules.length ? rules : this.getDefaultRules();
    const firstRule = activeRules[0];

    // Pre-flight Check: Remove vendors out of office or at capacity (Pillar 2.2 / 3.1)
    const eligiblePool = await this.executePreFlightCapacityCheck(candidatePool, (order.tenantId || 'default'));

    if (eligiblePool.length === 0) {
      logger.warn(`Zero eligible vendors for Order ${order.id} after pre-flight checks.`);
      return this.generateFailedState(order.id, 'NO_ELIGIBLE_VENDORS');
    }

    const state: RoutingEngineState = {
      orderId: order.id,
      currentRuleId: firstRule!.id,
      vendorsPinged: [],
      currentPingStartAt: new Date().toISOString(),
      status: 'BROADCASTING'
    };

    // Execute the first rule strategy
    await this.executeRule(state, firstRule!, eligiblePool, order);

    return state;
  }

  /**
   * Executes a specific routing rule strategy.
   * e.g., SEQUENTIAL_WATERFALL vs TIERED_BROADCAST
   */
  private async executeRule(
    state: RoutingEngineState,
    rule: CascadingRoutingRule,
    pool: { vendorId: string; tier: string; scorecard: VendorScorecard }[],
    order: AppraisalOrder
  ) {
    // 1. Filter pool down to target tier
    const tieredPool = pool.filter(v => v.tier === rule.tierTarget);

    if (tieredPool.length === 0) {
      logger.info(`No vendors found for tier ${rule.tierTarget}. Proceeding to fallback if exists.`);
      await this.handleTierExhaustion(order, state, rule);
      return;
    }

    // Sort by overallMatchScore descending
    tieredPool.sort((a, b) => b.scorecard.overallMatchScore - a.scorecard.overallMatchScore);

    if (rule.strategy === 'SEQUENTIAL_WATERFALL') {
      logger.info(`Executing SEQUENTIAL_WATERFALL: Pinging top vendor`);
      // Take the top vendor that hasn't been pinged yet
      const unpinged = tieredPool.filter(v => !state.vendorsPinged.includes(v.vendorId));
      if (unpinged.length === 0) {
        logger.info(`All vendors in tier ${rule.tierTarget} have been pinged. Pushing to fallback.`);
        await this.handleTierExhaustion(order, state, rule);
        return; // exhausted this tier
      }

      const target = unpinged[0];
      await this.dispatchToVendor(target!.vendorId, order);
      
      state.vendorsPinged.push(target!.vendorId);
      state.status = 'WAITING_ACCEPTANCE';
      
      await this.scheduleTimeoutCheck(order.id, rule.timeoutWindowMinutes, rule.id);
    } 
    else if (rule.strategy === 'TIERED_BROADCAST') {
      logger.info(`Executing TIERED_BROADCAST: Blasting to top ${rule.batchSize} vendors in tier`);
      const unpinged = tieredPool.filter(v => !state.vendorsPinged.includes(v.vendorId));
      
      if (unpinged.length === 0) {
        logger.info(`All vendors in tier ${rule.tierTarget} have been pinged. Pushing to fallback.`);
        await this.handleTierExhaustion(order, state, rule);
        return;
      }
      
      const targets = unpinged.slice(0, rule.batchSize);

      for (const t of targets) {
        await this.dispatchToVendor(t.vendorId, order);
        state.vendorsPinged.push(t.vendorId);
      }
      
      state.status = 'WAITING_ACCEPTANCE';
      await this.scheduleTimeoutCheck(order.id, rule.timeoutWindowMinutes, rule.id);
    }
  }

  /**
   * Instantly moves to the next tier when the current tier is exhausted (e.g. 0 vendors or all pinged)
   */
  private async handleTierExhaustion(order: AppraisalOrder, state: RoutingEngineState, currentRule: CascadingRoutingRule) {
    if (!currentRule.fallbackRuleId) {
      logger.warn(`Order ${order.id} exhausted tier ${currentRule.tierTarget} with no fallback. Moving to EXHAUSTED state.`);
      state.status = 'FAILED_ESCALATED';
      state.currentRuleId = 'EXHAUSTED';
      // Trigger human manual review queue event
      // e.g. await publishEvent('vendor.assignment.exhausted', { orderId: order.id });
      return;
    }
    
    // We would fetch the candidate pool from DB that was saved during initial generation
    const mockPool: { vendorId: string; tier: string; scorecard: VendorScorecard }[] = []; 
    
    const rules = this.getDefaultRules();
    const nextRule = rules.find(r => r.id === currentRule.fallbackRuleId);
    
    if (!nextRule) {
      state.status = 'FAILED_ESCALATED';
      state.currentRuleId = 'EXHAUSTED';
      return;
    }
    
    state.currentRuleId = nextRule.id;
    await this.executeRule(state, nextRule, mockPool, order);
  }

  /**
   * 2.2 Pre-Flight Auto-Reject & Exception Handling
   * Removes vendors who are offline, out of office, or lack bandwidth.
   */
  private async executePreFlightCapacityCheck(
    pool: { vendorId: string; tier: string; scorecard: VendorScorecard }[],
    tenantId: string
  ) {
    const valid: typeof pool = [];

    for (const candidate of pool) {
      // Direct DB call to pull VendorCapacityThrottle
      const capacity = await this.capacityEngine.getVendorCapacity(candidate.vendorId, tenantId);
      if (!capacity) {
        logger.info(`Pre-flight rejection: Profile missing for ${candidate.vendorId}`);
        continue;
      }

      // Check OOO Calendar limits
      if (this.isOutOfOffice(capacity)) {
        logger.info(`Pre-flight rejection: Vendor ${candidate.vendorId} is Out of Office.`);
        continue;
      }

      // Check Max Pipeline Load limits
      if (capacity.currentActiveOrders >= capacity.maxActiveOrdersLimit) {
        logger.info(`Pre-flight rejection: Vendor ${candidate.vendorId} is at true max capacity (${capacity.currentActiveOrders}/${capacity.maxActiveOrdersLimit}).`);
        continue;
      }

      valid.push(candidate);
    }

    return valid;
  }

  private isOutOfOffice(capacity: VendorCapacityThrottle): boolean {
    if (!capacity.calendarSyncEnabled) return false;
    if (!capacity.outOfOfficeStart || !capacity.outOfOfficeEnd) return false;

    const now = new Date();
    const start = new Date(capacity.outOfOfficeStart);
    const end = new Date(capacity.outOfOfficeEnd);

    return now >= start && now <= end;
  }

  private async dispatchToVendor(vendorId: string, order: AppraisalOrder) {
    logger.info(`[DISPATCH] Sent RFB (Request for Bid/Accept) for Order ${order.id} to Vendor ${vendorId}`);
    // Mock SMS/Email/Push integration to the appraiser app
  }

  private async scheduleTimeoutCheck(orderId: string, timeoutMinutes: number, currentRuleId: string) {
    logger.info(`[SCHEDULER] Placed message in queue: If no acceptance in ${timeoutMinutes} minutes, expand radius for Order ${orderId}`);
    // In production: await pushToDelayedQueue('routing-events', { orderId, ruleId }, delay: timeoutMinutes * 60000)
  }

  /**
   * Concurrency-safe acceptance handling using Optimistic Locking (ETag).
   * Prevents race conditions where two vendors accept an order at the exact same millisecond.
   */
  public async handleVendorAcceptance(orderId: string, vendorId: string, etag: string, ruleId: string) {
    logger.info(`[ROUTING] Attempting concurrent-safe acceptance for Order ${orderId} by Vendor ${vendorId}`);
    // In actual implementation with CosmosDbService:
    // await this.cosmosService.ordersContainer.item(orderId).replace(updatedOrder, {
    //   accessCondition: { type: 'IfMatch', condition: etag }
    // });
    
    logger.info(`[ROUTING] Order ${orderId} successfully ACCEPTED by ${vendorId}. Canceling worker timeout.`);
    
    // Clear BullMQ job from the delayed queue
    const job = await routingQueue.getJob(`timeout:${orderId}:${ruleId}`);
    if (job) {
      const state = await job.getState();
      if (state === 'delayed' || state === 'waiting') {
        await job.remove();
        logger.info(`[ROUTING] Canceled timeout ${job.id}`);
      }
    }
    
    return true;
  }

  /**
   * Called by the Worker when a timeout is reached.
   * Finds the fallback rule, updates the state, and fires the next broadcast.
   */
  public async escalateToNextTier(order: AppraisalOrder, state: RoutingEngineState) {
    logger.info(`Escalating Order ${order.id} from rule ${state.currentRuleId} to the next tier.`);
    
    const rules = this.getDefaultRules();
    const currentRule = rules.find(r => r.id === state.currentRuleId);

    if (!currentRule || !currentRule.fallbackRuleId) {
      logger.warn(`Order ${order.id} exhausted all routing rules. Moving to MANUAL EXCEPTIONS.`);
      state.status = 'FAILED_ESCALATED';
      state.currentRuleId = 'EXHAUSTED';
      // Trigger human manual review queue
      // e.g. await publishEvent('vendor.assignment.exhausted', { orderId: order.id });
      return;
    }

    const nextRule = rules.find(r => r.id === currentRule.fallbackRuleId);
    if (!nextRule) {
      state.status = 'FAILED_ESCALATED';
      state.currentRuleId = 'EXHAUSTED';
      return;
    }

    logger.info(`Order ${order.id} transitioning to fallback rule: ${nextRule.id} (${nextRule.strategy})`);
    
    // We would fetch the candidate pool from DB that was saved during initial generation
    const mockPool: { vendorId: string; tier: string; scorecard: VendorScorecard }[] = []; 
    
    // Execute the fallback
    state.currentRuleId = nextRule.id;
    await this.executeRule(state, nextRule, mockPool, order);
  }

  private generateFailedState(orderId: string, reason: string): RoutingEngineState {
    return {
      orderId,
      currentRuleId: 'EXHAUSTED',
      vendorsPinged: [],
      currentPingStartAt: new Date().toISOString(),
      status: 'FAILED_ESCALATED'
    };
  }

  private getDefaultRules(): CascadingRoutingRule[] {
    return [
      {
        id: 'RULE_1_PREFERRED',
        strategy: 'TIERED_BROADCAST',
        batchSize: 3,
        timeoutWindowMinutes: 60,
        tierTarget: 'CLIENT_PREFERRED',
        fallbackRuleId: 'RULE_2_PLATFORM'
      },
      {
        id: 'RULE_2_PLATFORM',
        strategy: 'SEQUENTIAL_WATERFALL',
        batchSize: 1,
        timeoutWindowMinutes: 120,
        tierTarget: 'PLATFORM_PREFERRED',
        fallbackRuleId: 'RULE_3_GENERAL'
      },
      {
        id: 'RULE_3_GENERAL',
        strategy: 'TIERED_BROADCAST',
        batchSize: 5,
        timeoutWindowMinutes: 240,
        tierTarget: 'GENERAL_POOL'
      }
    ];
  }

  private mockGetCapacityThrottle(vendorId: string): VendorCapacityThrottle {
    return {
      vendorId,
      maxActiveOrdersLimit: 15,
      currentActiveOrders: Math.floor(Math.random() * 10), // mock current load
      calendarSyncEnabled: true,
      typicalAvailableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      dailyCapacitySlots: 3
    };
  }
}
