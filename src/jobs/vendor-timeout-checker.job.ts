/**
 * Vendor Acceptance Timeout Checker Job
 * 
 * Monitors vendor assignments and auto-reassigns orders when:
 * - Vendor hasn't accepted within 4 hours of assignment
 * - Vendor explicitly declined the order
 * 
 * Runs every 5 minutes
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AzureCommunicationService } from '../services/azure-communication.service.js';

export class VendorTimeoutCheckerJob {
  private logger: Logger;
  private cosmosService: CosmosDbService;
  private acsService: AzureCommunicationService;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  
  private readonly TIMEOUT_HOURS = 4;
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(dbService?: CosmosDbService) {
    this.logger = new Logger();
    this.cosmosService = dbService || new CosmosDbService();
    this.acsService = new AzureCommunicationService();
  }

  /**
   * Start the timeout checker job
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Vendor timeout checker already running');
      return;
    }

    this.logger.info('Starting vendor timeout checker job', {
      intervalMinutes: this.CHECK_INTERVAL_MS / 60000,
      timeoutHours: this.TIMEOUT_HOURS
    });

    this.isRunning = true;
    
    // Run immediately on start
    this.checkTimeouts().catch(err => 
      this.logger.error('Error in initial timeout check', { error: err })
    );

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkTimeouts().catch(err =>
        this.logger.error('Error in timeout check', { error: err })
      );
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the timeout checker job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null as any;
    }
    this.isRunning = false;
    this.logger.info('Vendor timeout checker stopped');
  }

  /**
   * Check for timed-out vendor assignments
   */
  private async checkTimeouts(): Promise<void> {
    try {
      this.logger.info('Checking for vendor assignment timeouts...');

      // Query for orders in 'vendor_assigned' or 'pending_vendor_acceptance' state
      const container = this.cosmosService.getContainer('orders');
      const query = {
        query: `
          SELECT * FROM c 
          WHERE c.type = 'order' 
          AND (c.status = 'vendor_assigned' OR c.status = 'pending_vendor_acceptance')
          AND c.vendorAssignment != null
          AND c.vendorAssignment.status = 'pending'
        `
      };

      const { resources: orders } = await container.items.query(query).fetchAll();
      
      if (orders.length === 0) {
        this.logger.info('No pending vendor assignments found');
        return;
      }

      this.logger.info(`Found ${orders.length} pending vendor assignment(s)`);

      const now = new Date();
      const timeoutThreshold = new Date(now.getTime() - (this.TIMEOUT_HOURS * 60 * 60 * 1000));

      for (const order of orders) {
        await this.checkOrderTimeout(order, timeoutThreshold);
      }

    } catch (error) {
      this.logger.error('Error checking vendor timeouts', { error });
      throw error;
    }
  }

  /**
   * Check if a specific order has timed out
   */
  private async checkOrderTimeout(order: any, timeoutThreshold: Date): Promise<void> {
    try {
      const assignedAt = new Date(order.vendorAssignment.assignedAt);
      
      if (assignedAt < timeoutThreshold) {
        this.logger.warn('Vendor assignment timeout detected', {
          orderId: order.id,
          vendorId: order.vendorAssignment.vendorId,
          assignedAt,
          hoursElapsed: Math.floor((Date.now() - assignedAt.getTime()) / (1000 * 60 * 60))
        });

        await this.handleTimeout(order);
      }
    } catch (error) {
      this.logger.error('Error checking order timeout', {
        orderId: order.id,
        error
      });
    }
  }

  /**
   * Handle a timed-out vendor assignment
   */
  private async handleTimeout(order: any): Promise<void> {
    const container = this.cosmosService.getContainer('orders');
    
    try {
      // Update order: mark vendor as timed out, increment attempt count
      const attemptNumber = (order.vendorAssignment.attemptNumber || 0) + 1;
      
      // Store the failed attempt in history
      const failedAttempt = {
        vendorId: order.vendorAssignment.vendorId,
        assignedAt: order.vendorAssignment.assignedAt,
        timeoutAt: new Date().toISOString(),
        reason: 'timeout',
        attemptNumber: order.vendorAssignment.attemptNumber || 1
      };

      order.vendorAssignmentHistory = order.vendorAssignmentHistory || [];
      order.vendorAssignmentHistory.push(failedAttempt);

      // Clear current assignment
      order.vendorAssignment = null;
      order.status = 'unassigned';
      order.updatedAt = new Date().toISOString();
      order.reassignmentRequired = true;
      order.reassignmentReason = `Vendor did not respond within ${this.TIMEOUT_HOURS} hours (Attempt ${attemptNumber})`;

      // Update in database
      await container.item(order.id, order.tenantId).replace(order);

      this.logger.info('Order marked for reassignment due to timeout', {
        orderId: order.id,
        previousVendor: failedAttempt.vendorId,
        attemptNumber
      });

      // Send notification to vendor about timeout
      await this.notifyVendorTimeout(order, failedAttempt.vendorId);

      // Send notification to management about reassignment need
      await this.notifyManagementReassignment(order, attemptNumber);

    } catch (error) {
      this.logger.error('Error handling vendor timeout', {
        orderId: order.id,
        error
      });
      throw error;
    }
  }

  /**
   * Notify vendor that they missed the acceptance window
   */
  private async notifyVendorTimeout(order: any, vendorId: string): Promise<void> {
    try {
      // Get vendor contact info
      const vendorContainer = this.cosmosService.getContainer('vendors');
      const { resource: vendor } = await vendorContainer.item(vendorId, order.tenantId).read();

      if (!vendor || !vendor.contactEmail) {
        this.logger.warn('Cannot notify vendor - no contact info', { vendorId });
        return;
      }

      // Send SMS if available
      if (vendor.contactPhone) {
        const smsClient = this.acsService.getSmsClient();
        await smsClient.send({
          from: process.env.AZURE_COMMUNICATION_SMS_NUMBER!,
          to: [vendor.contactPhone],
          message: `Order ${order.orderNumber} was reassigned - you did not respond within ${this.TIMEOUT_HOURS} hours. Reply ACCEPT to be considered for future assignments.`
        });
      }

      this.logger.info('Vendor timeout notification sent', {
        orderId: order.id,
        vendorId,
        notificationMethod: vendor.contactPhone ? 'SMS' : 'none'
      });

    } catch (error) {
      this.logger.error('Error notifying vendor of timeout', {
        orderId: order.id,
        vendorId,
        error
      });
    }
  }

  /**
   * Notify management that order needs reassignment
   */
  private async notifyManagementReassignment(order: any, attemptNumber: number): Promise<void> {
    try {
      // Store notification in communications container
      const commsContainer = this.cosmosService.getContainer('communications');
      
      const notification = {
        id: `comm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'communication',
        tenantId: order.tenantId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        channel: 'system',
        direction: 'outbound',
        status: 'delivered',
        subject: `Order Reassignment Required - Attempt ${attemptNumber}`,
        body: `Order ${order.orderNumber} requires reassignment. Previous vendor did not respond within ${this.TIMEOUT_HOURS} hours.`,
        metadata: {
          reason: 'vendor_timeout',
          attemptNumber,
          priority: attemptNumber > 2 ? 'high' : 'normal'
        },
        createdAt: new Date().toISOString()
      };

      await commsContainer.items.create(notification);

      this.logger.info('Management notified of reassignment need', {
        orderId: order.id,
        attemptNumber
      });

    } catch (error) {
      this.logger.error('Error notifying management', {
        orderId: order.id,
        error
      });
    }
  }

  /**
   * Get job status
   */
  getStatus(): { running: boolean; intervalMs: number; timeoutHours: number } {
    return {
      running: this.isRunning,
      intervalMs: this.CHECK_INTERVAL_MS,
      timeoutHours: this.TIMEOUT_HOURS
    };
  }
}
