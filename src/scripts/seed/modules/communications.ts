/**
 * Seed Module: Communications
 *
 * Seeds SMS and email communication records linked to orders.
 * Container: communications (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, hoursAgo } from '../seed-types.js';
import { COMM_IDS, ORDER_IDS, ORDER_NUMBERS, VENDOR_IDS, APPRAISER_IDS, ENGAGEMENT_IDS } from '../seed-ids.js';

const CONTAINER = 'communications';

function buildCommunications(tenantId: string): Record<string, unknown>[] {
  return [
    // SMS — assignment notification for order 003
    {
      id: COMM_IDS.SMS_ASSIGN_003, tenantId, type: 'communication',
      orderId: ORDER_IDS.IN_PROGRESS_003,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      channel: 'SMS',
      direction: 'OUTBOUND',
      recipientId: APPRAISER_IDS.KEVIN_OKAFOR,
      recipientName: 'Kevin Okafor',
      recipientPhone: '+1-469-555-9003',
      senderName: 'System',
      subject: null,
      body: 'You have been assigned a RUSH appraisal order SEED-2026-00103 at 789 S Lamar St, Dallas, TX 75215. Please respond within 2 hours.',
      status: 'DELIVERED',
      sentAt: daysAgo(6),
      deliveredAt: daysAgo(6),
      createdAt: daysAgo(6), updatedAt: daysAgo(6),
    },
    // SMS — acceptance confirmation for order 003
    {
      id: COMM_IDS.SMS_CONFIRM_003, tenantId, type: 'communication',
      orderId: ORDER_IDS.IN_PROGRESS_003,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      channel: 'SMS',
      direction: 'INBOUND',
      senderId: APPRAISER_IDS.KEVIN_OKAFOR,
      senderName: 'Kevin Okafor',
      senderPhone: '+1-469-555-9003',
      subject: null,
      body: 'Accepted. Will schedule inspection for tomorrow morning.',
      status: 'RECEIVED',
      sentAt: daysAgo(6),
      receivedAt: daysAgo(6),
      createdAt: daysAgo(6), updatedAt: daysAgo(6),
    },
    // Email — delivery notification for order 001
    {
      id: COMM_IDS.EMAIL_DELIVERED_001, tenantId, type: 'communication',
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      recipientEmail: 'loans@firsthorizonbank.example.com',
      recipientName: 'First Horizon Bank — Loan Dept',
      senderName: 'Appraisal Management Platform',
      subject: `Appraisal Report Delivered — ${ORDER_NUMBERS[ORDER_IDS.COMPLETED_001]}`,
      body: 'The final appraisal report for order SEED-2026-00101 (5432 Mockingbird Ln, Dallas, TX 75206) has been completed and is available for download.',
      status: 'DELIVERED',
      sentAt: daysAgo(10),
      deliveredAt: daysAgo(10),
      attachments: [{ documentId: 'seed-doc-report-001', fileName: 'SEED-2026-00101_Full_1004_Report.pdf' }],
      createdAt: daysAgo(10), updatedAt: daysAgo(10),
    },
    // Email — QC pass notification for order 001
    {
      id: COMM_IDS.EMAIL_QC_PASS_001, tenantId, type: 'communication',
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      recipientEmail: 'mthompson@premierappraisal.com',
      recipientName: 'Michael Thompson',
      senderName: 'QC Department',
      subject: `QC Review Passed — ${ORDER_NUMBERS[ORDER_IDS.COMPLETED_001]}`,
      body: 'Your appraisal report for order SEED-2026-00101 has passed QC review with a score of 94/100. Minor note: lot dimensions have a 2ft variance from county records.',
      status: 'DELIVERED',
      sentAt: daysAgo(10),
      deliveredAt: daysAgo(10),
      createdAt: daysAgo(10), updatedAt: daysAgo(10),
    },
    // ── Engagement-level communications (primaryEntity.type = 'engagement') ──
    // Kickoff email for engagement 004 (SEED-ENG-2026-00204 — Sarah Johnson / First Horizon)
    {
      id: COMM_IDS.EMAIL_ENG_KICKOFF_004, tenantId, type: 'communication',
      primaryEntity: { type: 'engagement', id: ENGAGEMENT_IDS.SINGLE_DELIVERED_004, name: 'SEED-ENG-2026-00204' },
      relatedEntities: [],
      channel: 'email',
      direction: 'outbound',
      from: { name: 'Appraisal Management Platform', email: 'noreply@amp.example.com' },
      to: [{ name: 'Sarah Johnson — First Horizon Bank', email: 'loans@firsthorizonbank.example.com' }],
      subject: 'Engagement Opened — SEED-ENG-2026-00204 | 5432 Mockingbird Ln, Dallas TX',
      body: 'Your appraisal engagement SEED-ENG-2026-00204 has been accepted and assigned. A licensed appraiser will be in contact within 24 hours to schedule the inspection.',
      bodyFormat: 'text',
      status: 'delivered',
      category: 'order_assignment',
      priority: 'normal',
      sentAt: daysAgo(12),
      deliveredAt: daysAgo(12),
      createdBy: 'system',
      createdAt: daysAgo(12), updatedAt: daysAgo(12),
    },
    // Status update email for engagement 004
    {
      id: COMM_IDS.EMAIL_ENG_STATUS_004, tenantId, type: 'communication',
      primaryEntity: { type: 'engagement', id: ENGAGEMENT_IDS.SINGLE_DELIVERED_004, name: 'SEED-ENG-2026-00204' },
      relatedEntities: [],
      channel: 'email',
      direction: 'outbound',
      from: { name: 'Appraisal Management Platform', email: 'noreply@amp.example.com' },
      to: [{ name: 'Sarah Johnson — First Horizon Bank', email: 'loans@firsthorizonbank.example.com' }],
      subject: 'Appraisal Delivered — SEED-ENG-2026-00204',
      body: 'The appraisal report for engagement SEED-ENG-2026-00204 (5432 Mockingbird Ln, Dallas TX 75206) has been completed and delivered. Please log in to download the report.',
      bodyFormat: 'text',
      status: 'delivered',
      category: 'order_discussion',
      priority: 'normal',
      sentAt: daysAgo(10),
      deliveredAt: daysAgo(10),
      createdBy: 'system',
      createdAt: daysAgo(10), updatedAt: daysAgo(10),
    },
    // SMS reminder for engagement 004
    {
      id: COMM_IDS.SMS_ENG_REMINDER_004, tenantId, type: 'communication',
      primaryEntity: { type: 'engagement', id: ENGAGEMENT_IDS.SINGLE_DELIVERED_004, name: 'SEED-ENG-2026-00204' },
      relatedEntities: [],
      channel: 'sms',
      direction: 'outbound',
      from: { name: 'AMP Notifications' },
      to: [{ name: 'Sarah Johnson', phone: '+1-214-555-0101' }],
      subject: null,
      body: 'Reminder: Your appraisal engagement SEED-ENG-2026-00204 inspection is scheduled for tomorrow 9–11am. Reply HELP for assistance.',
      bodyFormat: 'text',
      status: 'delivered',
      category: 'deadline_reminder',
      priority: 'normal',
      sentAt: daysAgo(11),
      deliveredAt: daysAgo(11),
      createdBy: 'system',
      createdAt: daysAgo(11), updatedAt: daysAgo(11),
    },
  ];
}

export const module: SeedModule = {
  name: 'communications',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const comm of buildCommunications(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, comm, result);
    }

    return result;
  },
};
