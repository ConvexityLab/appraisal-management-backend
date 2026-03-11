/**
 * Order Notification Service
 *
 * Sends email, SMS, and Teams channel notifications on order lifecycle events:
 *   - Vendor assigned
 *   - Order cancelled
 *   - Order delivered
 *
 * DESIGN CONTRACT:
 *   - Every send is individually wrapped in try/catch — notification failures NEVER
 *     propagate to the caller. Errors are logged; the order operation always succeeds.
 *   - No infrastructure is created here. All services must already exist.
 *   - Teams channel notification is optional: skipped silently if
 *     AZURE_TEAMS_TEAM_ID or AZURE_TEAMS_CHANNEL_ID are not set.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { EmailNotificationService } from './email-notification.service.js';
import { SmsNotificationService } from './sms-notification.service.js';
import { TeamsService } from './teams.service.js';
import type { AppraisalOrder, Vendor } from '../types/index.js';

export class OrderNotificationService {
  private readonly logger: Logger;
  private readonly db: CosmosDbService;
  private readonly email: EmailNotificationService;
  private readonly sms: SmsNotificationService;
  private readonly teams: TeamsService;

  constructor() {
    this.logger = new Logger('OrderNotificationService');
    this.db = new CosmosDbService();
    this.email = new EmailNotificationService();
    this.sms = new SmsNotificationService();
    this.teams = new TeamsService();
  }

  // ─── Public lifecycle notification entry-points ───────────────────────────

  /**
   * Notify vendor they have been assigned to an order.
   * Sends: email to vendor, SMS to vendor, Teams ops channel post.
   */
  async notifyVendorAssigned(order: AppraisalOrder): Promise<void> {
    const { orderId, orderNumber, address } = this.extractOrderInfo(order);

    if (!order.assignedVendorId) {
      this.logger.warn('notifyVendorAssigned called but order has no assignedVendorId', { orderId });
      return;
    }

    const vendor = await this.lookupVendor(order.assignedVendorId, orderId);

    const emailSubject = `New Appraisal Assignment — Order ${orderNumber}`;
    const emailHtml = this.buildVendorAssignmentEmail(order, vendor, orderNumber, address);
    const smsText = `L1 Appraisal: You have been assigned order ${orderNumber} at ${address}. Log in to review details.`;
    const teamsMessage = this.buildTeamsMessage(
      '🏠 Vendor Assigned',
      `Order <strong>${orderNumber}</strong> assigned to <strong>${vendor?.name ?? order.assignedVendorId}</strong>.<br/>Property: ${address}<br/>Due: ${order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'TBD'}`
    );

    // Email to vendor
    if (vendor?.email) {
      await this.trySendEmail(vendor.email, emailSubject, emailHtml, order.tenantId, orderId);
    } else {
      this.logger.warn('Vendor has no email — skipping assignment email', { orderId, vendorId: order.assignedVendorId });
    }

    // SMS to vendor
    if (vendor?.phone) {
      await this.trySendSms(vendor.phone, smsText, order.tenantId, orderId);
    } else {
      this.logger.warn('Vendor has no phone — skipping assignment SMS', { orderId, vendorId: order.assignedVendorId });
    }

    // Teams ops channel
    await this.tryPostToTeams(emailSubject, teamsMessage, orderId);
  }

  /**
   * Notify relevant parties that an order has been cancelled.
   * Sends: email to vendor (if assigned), Teams ops channel post.
   */
  async notifyOrderCancelled(order: AppraisalOrder): Promise<void> {
    const { orderId, orderNumber, address } = this.extractOrderInfo(order);

    const emailSubject = `Order Cancelled — #${orderNumber}`;
    const teamsMessage = this.buildTeamsMessage(
      '❌ Order Cancelled',
      `Order <strong>${orderNumber}</strong> has been cancelled.<br/>Property: ${address}<br/>Vendor: ${order.assignedVendorId ?? 'Unassigned'}`
    );

    // Email vendor if one was assigned
    if (order.assignedVendorId) {
      const vendor = await this.lookupVendor(order.assignedVendorId, orderId);
      if (vendor?.email) {
        const emailHtml = this.buildCancellationEmail(order, vendor, orderNumber, address);
        await this.trySendEmail(vendor.email, emailSubject, emailHtml, order.tenantId, orderId);
      }
    }

    // Teams ops channel
    await this.tryPostToTeams(emailSubject, teamsMessage, orderId);
  }

  /**
   * Notify the lender contact that an order has been delivered.
   * Sends: email to order contact, Teams ops channel post.
   */
  async notifyOrderDelivered(order: AppraisalOrder): Promise<void> {
    const { orderId, orderNumber, address } = this.extractOrderInfo(order);

    const emailSubject = `Appraisal Delivered — Order #${orderNumber}`;
    const teamsMessage = this.buildTeamsMessage(
      '✅ Report Delivered',
      `Order <strong>${orderNumber}</strong> has been delivered.<br/>Property: ${address}`
    );

    // Email to lender/processor contact on the order
    const contactEmail = order.contactInformation?.email;
    if (contactEmail) {
      const emailHtml = this.buildDeliveryEmail(order, orderNumber, address);
      await this.trySendEmail(contactEmail, emailSubject, emailHtml, order.tenantId, orderId);
    } else {
      this.logger.warn('Order has no contactInformation.email — skipping delivery email to lender', { orderId });
    }

    // Teams ops channel
    await this.tryPostToTeams(emailSubject, teamsMessage, orderId);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private extractOrderInfo(order: AppraisalOrder): {
    orderId: string;
    orderNumber: string;
    address: string;
  } {
    const addr = order.propertyAddress;
    const address = addr
      ? `${addr.streetAddress}, ${addr.city}, ${addr.state} ${addr.zipCode}`
      : 'Unknown address';
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      address,
    };
  }

  private async lookupVendor(vendorId: string, orderId: string): Promise<Vendor | null> {
    try {
      const result = await this.db.findVendorById(vendorId);
      if (!result.success || !result.data) {
        this.logger.warn('Vendor not found for notification lookup', { vendorId, orderId });
        return null;
      }
      return result.data;
    } catch (err) {
      this.logger.error('Failed to look up vendor for notification', { vendorId, orderId, error: err });
      return null;
    }
  }

  private async trySendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    tenantId: string,
    orderId: string
  ): Promise<void> {
    try {
      await this.email.sendEmail({ to, subject, htmlBody }, tenantId);
      this.logger.info('Notification email sent', { to, subject, orderId });
    } catch (err) {
      this.logger.error('Failed to send notification email — order operation unaffected', {
        to,
        subject,
        orderId,
        error: err,
      });
    }
  }

  private async trySendSms(to: string, message: string, tenantId: string, orderId: string): Promise<void> {
    try {
      await this.sms.sendSms(to, message, tenantId);
      this.logger.info('Notification SMS sent', { to, orderId });
    } catch (err) {
      this.logger.error('Failed to send notification SMS — order operation unaffected', {
        to,
        orderId,
        error: err,
      });
    }
  }

  private async tryPostToTeams(subject: string, message: string, orderId: string): Promise<void> {
    const teamId = process.env.AZURE_TEAMS_TEAM_ID;
    const channelId = process.env.AZURE_TEAMS_CHANNEL_ID;

    if (!teamId || !channelId) {
      // Teams ops channel not configured — not an error, just skip
      this.logger.debug('Teams ops channel not configured (AZURE_TEAMS_TEAM_ID / AZURE_TEAMS_CHANNEL_ID missing) — skipping', { orderId });
      return;
    }

    if (!await this.teams.isServiceConfigured()) {
      this.logger.warn('TeamsService not initialized — skipping ops channel post', { orderId });
      return;
    }

    try {
      await this.teams.sendChannelMessage(teamId, channelId, message, subject);
      this.logger.info('Teams ops channel notification sent', { orderId, subject });
    } catch (err) {
      this.logger.error('Failed to post to Teams ops channel — order operation unaffected', {
        orderId,
        subject,
        error: err,
      });
    }
  }

  /** Minimal Teams card wrapper — injects content into a predictable layout */
  private buildTeamsMessage(title: string, body: string): string {
    return `<h3>${title}</h3><p>${body}</p>`;
  }

  // ─── Email HTML builders ───────────────────────────────────────────────────

  private buildVendorAssignmentEmail(
    order: AppraisalOrder,
    vendor: Vendor | null,
    orderNumber: string,
    address: string
  ): string {
    const vendorName = vendor?.name ?? 'Appraiser';
    const dueDate = order.dueDate ? new Date(order.dueDate).toLocaleDateString('en-US', { dateStyle: 'long' }) : 'TBD';
    const productType = order.productType ?? 'Appraisal';

    return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:auto">
  <h2 style="color:#1e40af">New Appraisal Assignment</h2>
  <p>Hello ${vendorName},</p>
  <p>You have been assigned a new appraisal order. Please log in to the platform to review the full details and accept the assignment.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Order Number</td><td style="padding:8px;background:#f8fafc">${orderNumber}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Property</td><td style="padding:8px;background:#f8fafc">${address}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Product Type</td><td style="padding:8px;background:#f8fafc">${productType}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Due Date</td><td style="padding:8px;background:#f8fafc">${dueDate}</td></tr>
  </table>
  <p><a href="https://appraisal.l1-analytics.com/orders/${order.id}" style="background:#1e40af;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;display:inline-block">View Assignment</a></p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0"/>
  <p style="color:#64748b;font-size:12px">This is an automated message from the L1 Appraisal Management Platform. Do not reply to this email.</p>
</body>
</html>`;
  }

  private buildCancellationEmail(
    order: AppraisalOrder,
    vendor: Vendor,
    orderNumber: string,
    address: string
  ): string {
    return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:auto">
  <h2 style="color:#dc2626">Order Cancelled</h2>
  <p>Hello ${vendor.name},</p>
  <p>The following appraisal order has been <strong>cancelled</strong>. No further action is required on your part.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Order Number</td><td style="padding:8px;background:#f8fafc">${orderNumber}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Property</td><td style="padding:8px;background:#f8fafc">${address}</td></tr>
  </table>
  <p>If you have questions about this cancellation, please contact your account manager.</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0"/>
  <p style="color:#64748b;font-size:12px">This is an automated message from the L1 Appraisal Management Platform. Do not reply to this email.</p>
</body>
</html>`;
  }

  private buildDeliveryEmail(
    order: AppraisalOrder,
    orderNumber: string,
    address: string
  ): string {
    const contactName = order.contactInformation?.name ?? 'Valued Client';

    return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:auto">
  <h2 style="color:#16a34a">Appraisal Report Delivered</h2>
  <p>Hello ${contactName},</p>
  <p>The appraisal report for the following order is now available in the platform.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Order Number</td><td style="padding:8px;background:#f8fafc">${orderNumber}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;background:#f1f5f9">Property</td><td style="padding:8px;background:#f8fafc">${address}</td></tr>
  </table>
  <p><a href="https://appraisal.l1-analytics.com/orders/${order.id}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;display:inline-block">View Report</a></p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0"/>
  <p style="color:#64748b;font-size:12px">This is an automated message from the L1 Appraisal Management Platform. Do not reply to this email.</p>
</body>
</html>`;
  }
}
