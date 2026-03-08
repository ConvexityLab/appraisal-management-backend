/**
 * Seed Module: Communications
 *
 * Seeds SMS and email communication records linked to orders.
 * Container: communications (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, hoursAgo } from '../seed-types.js';
import { COMM_IDS, ORDER_IDS, ORDER_NUMBERS, VENDOR_IDS, APPRAISER_IDS } from '../seed-ids.js';

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
