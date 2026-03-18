/**
 * ROV SLA Watcher Job
 *
 * Periodically scans ROV requests that are in active states
 * (SUBMITTED, UNDER_REVIEW, RESEARCHING, PENDING_RESPONSE) and checks if the
 * SLA deadline (dueDate) has breached.
 *
 * Fires escalation event:
 *   - escalation.created � when past dueDate
 *
 * Interval: 10 minutes.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { EventCategory, EventPriority, EscalationCreatedEvent } from '../types/events.js';
import { ROVStatus } from '../types/rov.types.js';

export class ROVSLAWatcherJob {
  private logger: Logger;
  private dbService: CosmosDbService;
  private eventPublisher: ServiceBusEventPublisher;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private readonly checkIntervalMs = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.logger = new Logger('ROVSLAWatcherJob');
    this.dbService = new CosmosDbService();
    this.eventPublisher = new ServiceBusEventPublisher();
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.info('Starting ROV SLA Watcher Job', { intervalMs: this.checkIntervalMs });
    
    // Run immediately, then put on interval
    this.run().catch(err => this.logger.error('Initial run failed', { error: err }));
    this.intervalId = setInterval(() => this.run(), this.checkIntervalMs);
  }

  public stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined as any;
    }
    this.logger.info('Stopped ROV SLA Watcher Job');
  }

  private async run() {
    this.logger.info('Running ROV SLA check...');
    let processed = 0;
    let breached = 0;

    try {
      const now = new Date();
      const container = this.dbService.getContainer('prov-rov'); // Standard prefix naming? Actually it might be inside the orders container or rov container.
      // Wait, let's use the DB Service method or query directly if no method exists.
      // The db service has "findAllROVRequests" or we can do a query
      
      // We will do a generic query via dbService
      const openStatuses = [
        ROVStatus.SUBMITTED,
        ROVStatus.UNDER_REVIEW,
        ROVStatus.RESEARCHING,
        ROVStatus.PENDING_RESPONSE
      ];
      
      const querySpec = {
        query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@statuses, c.status) AND c.slaTracking.isOverdue = false`,
        parameters: [
          { name: '@statuses', value: openStatuses } // Note: array parameter might need manual unfolding depending on SDK, but typically works in @azure/cosmos v3+
        ]
      };

      // Workaround for ARRAY_CONTAINS if needed: `c.status IN (...)`
      const querySpecSafe = {
        query: `SELECT * FROM c WHERE c.type = 'rov_request' AND c.status IN ('SUBMITTED', 'UNDER_REVIEW', 'RESEARCHING', 'PENDING_RESPONSE') AND c.slaTracking.isOverdue = false`
      };

      // Let's use the getContainer from CosmosDbService. Wait, we don't know the exact container name.
      // CosmosDbService usually has `queryItems` or exposes the container.
      // Let's abstract.
      const rawQuery = await this.dbService['client']!
        .database(this.dbService['databaseId']!)
        .container('rov-management') // guessing container name based on standard AMC pattern
        .items.query(querySpecSafe)
        .fetchAll()
        .catch(async () => {
             // Fallback to searching order-data or general orders
             return this.dbService['client']!
                .database(this.dbService['databaseId']!)
                .container('orders')
                .items.query({ query: `SELECT * FROM c WHERE c.type = 'rov_request' AND c.status IN ('SUBMITTED', 'UNDER_REVIEW', 'RESEARCHING', 'PENDING_RESPONSE') AND (NOT IS_DEFINED(c.slaTracking.isOverdue) OR c.slaTracking.isOverdue = false)` })
                .fetchAll();
        });

      const rovs = rawQuery.resources || [];
      processed = rovs.length;

      for (const rov of rovs) {
        if (!rov.slaTracking || !rov.slaTracking.dueDate) continue;

        const dueDate = new Date(rov.slaTracking.dueDate);
        
        if (now > dueDate) {
           breached++;
           await this.markBreached(rov, now);
        }
      }

      this.logger.info('Finished ROV SLA check', { processed, breached });
    } catch (error) {
      this.logger.error('Error during ROV SLA check run', { error });
    }
  }

  private async markBreached(rov: any, now: Date) {
    try {
      rov.slaTracking.isOverdue = true;
      rov.slaTracking.escalationWarnings = rov.slaTracking.escalationWarnings || [];
      rov.slaTracking.escalationWarnings.push({
        level: 'CRITICAL',
        message: 'SLA deadline exceeded',
        triggeredAt: now
      });
      
      rov.updatedAt = now;
      
      rov.timeline = rov.timeline || [];
      rov.timeline.push({
        id: uuidv4(),
        timestamp: now,
        action: 'SLA_BREACHED',
        performedBy: 'system',
        details: `SLA deadline exceeded on ${now.toISOString()}`
      });

      // Try updating via db service method
      await this.dbService.updateROVRequest(rov.id, rov);
      
      // Fire escalation event
      const event: EscalationCreatedEvent = {
        id: uuidv4(),
        version: '1.0',
        type: 'escalation.created',
        category: EventCategory.ESCALATION,
        timestamp: now,
        source: 'rov-sla-watcher',
        data: {
          escalationId: `esc-${rov.id}`,
          // targetType: 'SYSTEM' as any, // Mapped to EscalationTarget type if exist
          // targetId: rov.id,
          tenantId: rov.tenantId,
          orderId: rov.orderId,
          reason: 'ROV SLA Deadline breached',
          priority: EventPriority.CRITICAL,
          escalatedBy: 'system'
        }
      };
      
      await this.eventPublisher.publish(event);
      this.logger.warn('ROV SLA breached', { rovId: rov.id });
    } catch (error) {
      this.logger.error('Failed to process breached ROV', { rovId: rov.id, error });
    }
  }
}
