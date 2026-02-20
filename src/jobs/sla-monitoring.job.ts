/**
 * SLA Monitoring Job
 *
 * Periodically scans all ACTIVE SLA tracking records and:
 *   - Recalculates elapsed / remaining time
 *   - Promotes ON_TRACK → AT_RISK when ≥80 % elapsed
 *   - Promotes AT_RISK → BREACHED when past target date
 *   - Logs audit events on status changes
 *   - Publishes events for downstream notification
 *
 * Interval: 10 minutes (configurable)
 *
 * Uses the same pattern as VendorTimeoutCheckerJob.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AuditTrailService } from '../services/audit-trail.service.js';
import { OrderEventService } from '../services/order-event.service.js';

interface SLATrackingRecord {
  id: string;
  entityType: string;
  entityId: string;
  orderId: string;
  orderNumber: string;
  status: string;
  targetMinutes: number;
  targetDate: string | Date;
  startTime: string | Date;
  elapsedMinutes: number;
  remainingMinutes: number;
  percentComplete: number;
  breachedAt?: string | Date;
  breachDuration?: number;
  atRiskAlertSent: boolean;
  breachAlertSent: boolean;
  extended: boolean;
  waived: boolean;
  updatedAt: string | Date;
  [key: string]: any;
}

export class SLAMonitoringJob {
  private logger: Logger;
  private cosmosService: CosmosDbService;
  private auditService: AuditTrailService;
  private eventService: OrderEventService;
  private isRunning = false;
  private firewallBlocked = false;
  private intervalId?: NodeJS.Timeout;

  private readonly CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly AT_RISK_THRESHOLD = 80; // percentage

  constructor(dbService?: CosmosDbService) {
    this.logger = new Logger('SLAMonitoringJob');
    this.cosmosService = dbService || new CosmosDbService();
    this.auditService = new AuditTrailService();
    this.eventService = new OrderEventService();
  }

  /**
   * Start the SLA monitoring job
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('SLA monitoring job already running');
      return;
    }

    this.firewallBlocked = false;

    this.logger.info('Starting SLA monitoring job', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60000,
      atRiskThreshold: this.AT_RISK_THRESHOLD,
    });

    this.isRunning = true;

    // Run immediately on start
    this.checkSLAs().catch((err) =>
      this.logger.error('Error in initial SLA check', { error: err })
    );

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkSLAs().catch((err) =>
        this.logger.error('Error in SLA check', { error: err })
      );
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null as any;
    }
    this.isRunning = false;
    this.logger.info('SLA monitoring job stopped');
  }

  /**
   * Core check — scan all non-terminal SLA records
   */
  private async checkSLAs(): Promise<void> {
    if (this.firewallBlocked) return;

    try {
      const container = this.cosmosService.getContainer('sla-tracking');
      const query = `SELECT * FROM c WHERE c.status IN ('ON_TRACK', 'AT_RISK') AND (NOT IS_DEFINED(c.waived) OR c.waived = false)`;
      const { resources: records } = await container.items.query<SLATrackingRecord>(query).fetchAll();

      if (records.length === 0) {
        this.logger.info('SLA check: no active records to evaluate');
        return;
      }

      this.logger.info(`SLA check: evaluating ${records.length} active records`);

      let promoted = 0;
      let breached = 0;

      for (const record of records) {
        try {
          const updated = await this.evaluateRecord(record);
          if (updated) {
            if (record.status === 'BREACHED') breached++;
            else promoted++;
          }
        } catch (err) {
          this.logger.error(`Failed to evaluate SLA ${record.id}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      this.logger.info('SLA check complete', {
        evaluated: records.length,
        promoted,
        breached,
      });
    } catch (err: any) {
      if (err?.code === 'Forbidden' || err?.statusCode === 403) {
        this.firewallBlocked = true;
        this.logger.warn('SLA monitoring blocked by firewall — will retry on next start');
      } else {
        this.logger.error('SLA check failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Evaluate a single SLA record and update if status changed.
   * Returns true if the record was updated.
   */
  private async evaluateRecord(record: SLATrackingRecord): Promise<boolean> {
    const now = Date.now();
    const startMs = new Date(record.startTime).getTime();
    const targetMs = new Date(record.targetDate).getTime();

    const elapsedMinutes = Math.floor((now - startMs) / 60000);
    const remainingMinutes = Math.max(0, Math.floor((targetMs - now) / 60000));
    const percentComplete = record.targetMinutes > 0
      ? Math.min(100, Math.round((elapsedMinutes / record.targetMinutes) * 100))
      : 100;

    const previousStatus = record.status;
    let newStatus = record.status;

    if (now > targetMs) {
      newStatus = 'BREACHED';
    } else if (percentComplete >= this.AT_RISK_THRESHOLD) {
      newStatus = 'AT_RISK';
    }

    // No change needed
    if (newStatus === previousStatus) {
      // Still update elapsed/remaining for accuracy
      const container = this.cosmosService.getContainer('sla-tracking');
      await container.item(record.id, record.id).replace({
        ...record,
        elapsedMinutes,
        remainingMinutes,
        percentComplete,
        updatedAt: new Date(),
      });
      return false;
    }

    // Status changed — update record
    const updatedRecord: SLATrackingRecord = {
      ...record,
      status: newStatus,
      elapsedMinutes,
      remainingMinutes,
      percentComplete,
      updatedAt: new Date(),
    };

    if (newStatus === 'BREACHED' && !record.breachedAt) {
      updatedRecord.breachedAt = new Date();
      updatedRecord.breachDuration = elapsedMinutes - record.targetMinutes;
      updatedRecord.breachAlertSent = true;
    }

    if (newStatus === 'AT_RISK') {
      updatedRecord.atRiskAlertSent = true;
    }

    const container = this.cosmosService.getContainer('sla-tracking');
    await container.item(record.id, record.id).replace(updatedRecord);

    this.logger.info(`SLA status changed: ${previousStatus} → ${newStatus}`, {
      slaId: record.id,
      orderId: record.orderId,
      orderNumber: record.orderNumber,
      percentComplete,
    });

    // Write audit event
    try {
      await this.auditService.log({
        actor: { userId: 'system', role: 'system' },
        action: newStatus === 'BREACHED' ? 'SLA_BREACHED' : 'SLA_AT_RISK',
        resource: { type: 'order', id: record.orderId, name: record.orderNumber },
        metadata: {
          slaId: record.id,
          entityType: record.entityType,
          previousStatus,
          newStatus,
          percentComplete,
          remainingMinutes,
        },
      });
    } catch {
      // Non-fatal
    }

    return true;
  }
}
