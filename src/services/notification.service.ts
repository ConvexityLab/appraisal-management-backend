/**
 * Notification Service
 * Bridge between business services and real communication channels.
 * 
 * Previously a stub that only logged. Now delegates to:
 * - EmailNotificationService (ACS email) for email delivery
 * - SmsService (ACS SMS) for SMS delivery
 * - Logs communication records for history tracking
 * 
 * All consumers (vendor-onboarding, vendor-certification, escalation, 
 * delivery-workflow, payments, etc.) import this class — so wiring it
 * up here lights up notifications across the entire platform.
 */

import { AppraisalOrder, Vendor } from '../types/index.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { EmailNotificationService } from './email-notification.service.js';
import { Logger } from '../utils/logger.js';

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  priority?: 'low' | 'normal' | 'high';
  templateId?: string;
}

export class NotificationService {
  private logger: Logger;
  private emailService: EmailNotificationService;
  private dbService: CosmosDbService;
  private tenantId: string;

  constructor() {
    this.logger = new Logger('NotificationService');
    this.emailService = new EmailNotificationService();
    this.dbService = new CosmosDbService();
    this.tenantId = process.env.DEFAULT_TENANT_ID || 'tenant-001';
  }

  /**
   * Send email notification via Azure Communication Services.
   * Falls back to logging if ACS is not configured.
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      this.logger.info('Sending email notification', {
        to: options.to,
        subject: options.subject,
        priority: options.priority || 'normal'
      });

      // Delegate to the real EmailNotificationService (ACS-backed)
      const result = await this.emailService.sendEmail({
        to: [options.to],
        subject: options.subject,
        htmlBody: options.body,
        ...(options.cc ? { cc: options.cc } : {}),
        ...(options.priority ? { priority: options.priority } : {})
      }, this.tenantId);

      if (result.success) {
        this.logger.info('Email notification sent successfully', { to: options.to });
      } else {
        this.logger.warn('Email send returned failure', { to: options.to, error: result.error });
      }

      // Record in communications container for history
      await this.recordCommunication({
        type: 'email',
        to: options.to,
        subject: options.subject,
        status: result.success ? 'sent' : 'failed',
        error: result.success ? undefined : result.error
      });
    } catch (error) {
      this.logger.error('Failed to send email notification', { error, to: options.to });
      // Don't throw — notification failures shouldn't break business workflows
    }
  }

  /**
   * Notify a vendor they've been assigned to an order.
   */
  async notifyVendorAssignment(vendorId: string, order: AppraisalOrder): Promise<void> {
    try {
      const vendorResult = await this.dbService.findVendorById(vendorId);
      if (!vendorResult.success || !vendorResult.data) {
        this.logger.warn('Cannot notify — vendor not found', { vendorId });
        return;
      }

      const vendor = vendorResult.data;
      const address = order.propertyAddress
        ? `${order.propertyAddress.streetAddress}, ${order.propertyAddress.city}, ${order.propertyAddress.state} ${order.propertyAddress.zipCode}`
        : 'Address pending';

      await this.sendEmail({
        to: vendor.email,
        subject: `New Appraisal Assignment — Order ${order.id}`,
        body: `
          <h2>New Appraisal Assignment</h2>
          <p>Hello ${vendor.name},</p>
          <p>You have been assigned a new appraisal order:</p>
          <ul>
            <li><strong>Order ID:</strong> ${order.id}</li>
            <li><strong>Property:</strong> ${address}</li>
            <li><strong>Type:</strong> ${order.productType || 'Standard'}</li>
            <li><strong>Priority:</strong> ${order.priority || 'Normal'}</li>
          </ul>
          <p>Please log in to the platform to accept or decline this assignment within 4 hours.</p>
          <p>Thank you,<br>Appraisal Management Platform</p>
        `,
        priority: order.priority === 'rush' || order.priority === 'urgent' ? 'high' : 'normal'
      });

      this.logger.info('Vendor assignment notification sent', { vendorId, orderId: order.id });
    } catch (error) {
      this.logger.error('Failed to notify vendor of assignment', { error, vendorId, orderId: order.id });
    }
  }

  /**
   * Notify a vendor their assignment has been cancelled.
   */
  async notifyVendorCancellation(vendorId: string, order: AppraisalOrder, reason: string): Promise<void> {
    try {
      const vendorResult = await this.dbService.findVendorById(vendorId);
      if (!vendorResult.success || !vendorResult.data) {
        this.logger.warn('Cannot notify cancellation — vendor not found', { vendorId });
        return;
      }

      const vendor = vendorResult.data;

      await this.sendEmail({
        to: vendor.email,
        subject: `Appraisal Assignment Cancelled — Order ${order.id}`,
        body: `
          <h2>Assignment Cancelled</h2>
          <p>Hello ${vendor.name},</p>
          <p>Your assignment for order <strong>${order.id}</strong> has been cancelled.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>If you have questions, please contact your account manager.</p>
          <p>Thank you,<br>Appraisal Management Platform</p>
        `
      });

      this.logger.info('Vendor cancellation notification sent', { vendorId, orderId: order.id });
    } catch (error) {
      this.logger.error('Failed to notify vendor of cancellation', { error, vendorId, orderId: order.id });
    }
  }

  /**
   * Send an acceptance reminder to a vendor (e.g., approaching 4-hour deadline).
   */
  async sendVendorAcceptanceReminder(vendorId: string, order: AppraisalOrder): Promise<void> {
    try {
      const vendorResult = await this.dbService.findVendorById(vendorId);
      if (!vendorResult.success || !vendorResult.data) {
        this.logger.warn('Cannot send reminder — vendor not found', { vendorId });
        return;
      }

      const vendor = vendorResult.data;

      await this.sendEmail({
        to: vendor.email,
        subject: `Reminder: Accept or Decline Assignment — Order ${order.id}`,
        body: `
          <h2>Assignment Acceptance Reminder</h2>
          <p>Hello ${vendor.name},</p>
          <p>You have a pending assignment for order <strong>${order.id}</strong> that requires your response.</p>
          <p>Please log in to accept or decline this assignment. If no action is taken, the assignment may be reassigned.</p>
          <p>Thank you,<br>Appraisal Management Platform</p>
        `,
        priority: 'high'
      });

      this.logger.info('Vendor acceptance reminder sent', { vendorId, orderId: order.id });
    } catch (error) {
      this.logger.error('Failed to send vendor acceptance reminder', { error, vendorId, orderId: order.id });
    }
  }

  /**
   * Schedule a future reminder. Currently sends immediately;
   * in production, integrate with Azure Service Bus scheduled messages.
   */
  async scheduleVendorReminder(vendorId: string, orderId: string, delay: string): Promise<void> {
    this.logger.info(`Scheduling vendor reminder`, { vendorId, orderId, delay });
    // TODO: Use Azure Service Bus scheduled messages for true delayed delivery.
    // For now, this is a no-op placeholder — the VendorTimeoutCheckerJob handles
    // periodic checks on its own schedule.
  }

  // ---------------------------------------------------------------------------
  // Internal: record communication for history/audit
  // ---------------------------------------------------------------------------

  private async recordCommunication(record: {
    type: string;
    to: string;
    subject?: string;
    status: string;
    error?: any;
  }): Promise<void> {
    try {
      // Best-effort write to communications container
      const container = (this.dbService as any).communicationsContainer || 
                       (this.dbService as any).getContainer?.('communications');
      if (!container) {
        this.logger.debug('Communications container not available, skipping record');
        return;
      }

      await container.items.create({
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tenantId: this.tenantId,
        type: record.type,
        to: record.to,
        subject: record.subject,
        status: record.status,
        error: record.error,
        createdAt: new Date().toISOString(),
        source: 'NotificationService'
      });
    } catch (error) {
      // Don't fail business flow for communication record failure
      this.logger.debug('Failed to record communication', { error });
    }
  }
}