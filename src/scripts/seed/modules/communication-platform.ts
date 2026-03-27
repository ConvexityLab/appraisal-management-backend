/**
 * Seed Module: Communication Platform
 *
 * Seeds ACS (Azure Communication Services) related data across 5 containers:
 *   - acsUserMappings        (Azure AD → ACS identity cache)
 *   - communicationContexts  (per-order chat/call/AI context)
 *   - teamsMeetings          (Teams meeting records)
 *   - emailTemplates         (email template library)
 *   - smsTemplates           (SMS template library)
 *
 * Cross-references order IDs, vendor IDs, and appraiser IDs from seed-ids.ts.
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, daysFromNow, hoursAgo } from '../seed-types.js';
import { COMM_PLATFORM_IDS, ORDER_IDS, VENDOR_IDS, APPRAISER_IDS } from '../seed-ids.js';

// Fake but stable ACS user IDs — format: 8:acs:<resource-guid>:<seq>
const ACS_RESOURCE_GUID = 'a21a2a2b-73c7-4779-a986-09c9ea9056ea';
const acsId = (seq: string) => `8:acs:${ACS_RESOURCE_GUID}:${seq}`;

const AMC_USER = 'seed-amc-coordinator-01';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function participant(
  userId: string, acsSeq: string, displayName: string,
  email: string, role: string, isAmc = false,
): Record<string, unknown> {
  return {
    userId, acsUserId: acsId(acsSeq), displayName, email, role,
    joinedAt: daysAgo(7),
    permissions: {
      canStartCall: isAmc || role === 'vendor',
      canScheduleMeeting: isAmc,
      canInviteOthers: isAmc,
      canViewTranscripts: true,
    },
  };
}

// ─── 1. ACS User Mappings ────────────────────────────────────────────────────

function buildAcsUserMappings(tenantId: string): Record<string, unknown>[] {
  const m = (azureAdUserId: string, seq: string, displayName: string, email: string, createdDaysAgo: number, lastTokenHoursAgo: number) => ({
    id: `${azureAdUserId}-${tenantId}`, tenantId,
    azureAdUserId, acsUserId: acsId(seq), displayName, email,
    createdAt: daysAgo(createdDaysAgo), lastTokenGeneratedAt: hoursAgo(lastTokenHoursAgo),
  });
  return [
    m(AMC_USER, '0001', 'AMC Coordinator', 'coordinator@appraisal.platform', 30, 1),
    m(VENDOR_IDS.PREMIER, '0002', 'John Smith (Premier Appraisal)', 'john@premierappraisal.com', 20, 2),
    m(VENDOR_IDS.ROCKY_MOUNTAIN, '0003', 'Maria Garcia (Rocky Mountain)', 'maria@rmvaluations.com', 18, 3),
    m(APPRAISER_IDS.MICHAEL_THOMPSON, '0004', 'Michael Thompson', 'michael.thompson@appraisal.com', 25, 4),
    m(APPRAISER_IDS.PATRICIA_NGUYEN, '0005', 'James Rodriguez', 'james.rodriguez@appraisal.com', 15, 6),
    m(APPRAISER_IDS.KEVIN_OKAFOR, '0006', 'Sarah Chen', 'sarah.chen@appraisal.com', 10, 24),
  ];
}

// ─── 2. Communication Contexts ───────────────────────────────────────────────

function buildCommunicationContexts(tenantId: string): Record<string, unknown>[] {
  return [
    // Order 001 — vendor assigned, waiting for acceptance
    {
      id: COMM_PLATFORM_IDS.CTX_ORDER_001, type: 'order', entityId: ORDER_IDS.COMPLETED_001, tenantId,
      chatThreadId: `19:thread-order-001-${tenantId}@thread.v2`, chatCreatedAt: daysAgo(6),
      calls: [],
      participants: [
        participant(AMC_USER, '0001', 'AMC Coordinator', 'coordinator@appraisal.platform', 'amc', true),
        participant(VENDOR_IDS.PREMIER, '0002', 'John Smith (Premier)', 'john@premierappraisal.com', 'vendor'),
        participant(APPRAISER_IDS.MICHAEL_THOMPSON, '0004', 'Michael Thompson', 'michael.thompson@appraisal.com', 'appraiser'),
      ],
      aiInsights: {
        riskFlags: [],
        actionItems: [
          { id: 'ai-action-001-1', description: 'Vendor has not accepted assignment — follow up if no response by EOD', assignee: AMC_USER, dueDate: daysFromNow(0), status: 'open', extractedAt: hoursAgo(2), source: 'chat' },
        ],
        keyTopics: ['assignment', 'acceptance', 'scheduling'],
        escalationSuggested: false,
      },
      createdBy: AMC_USER, createdAt: daysAgo(7), updatedAt: hoursAgo(2), isActive: true,
    },
    // Order 002 — inspection scheduled, active coordination
    {
      id: COMM_PLATFORM_IDS.CTX_ORDER_002, type: 'order', entityId: ORDER_IDS.QC_REVIEW_002, tenantId,
      chatThreadId: `19:thread-order-002-${tenantId}@thread.v2`, chatCreatedAt: daysAgo(5),
      calls: [
        { id: 'call-002-kickoff', type: 'adhoc_call', startedAt: daysAgo(4), endedAt: new Date(new Date(daysAgo(4)).getTime() + 18 * 60_000).toISOString(), participants: [AMC_USER, VENDOR_IDS.ROCKY_MOUNTAIN, APPRAISER_IDS.PATRICIA_NGUYEN], duration: 18 },
      ],
      participants: [
        participant(AMC_USER, '0001', 'AMC Coordinator', 'coordinator@appraisal.platform', 'amc', true),
        participant(VENDOR_IDS.ROCKY_MOUNTAIN, '0003', 'Maria Garcia', 'maria@rmvaluations.com', 'vendor'),
        participant(APPRAISER_IDS.PATRICIA_NGUYEN, '0005', 'James Rodriguez', 'james.rodriguez@appraisal.com', 'appraiser'),
      ],
      aiInsights: {
        overallSentiment: 'positive', sentimentScore: 0.78,
        riskFlags: [], actionItems: [],
        keyTopics: ['inspection', 'scheduling', 'access'],
        escalationSuggested: false,
      },
      createdBy: AMC_USER, createdAt: daysAgo(5), updatedAt: hoursAgo(5), isActive: true,
    },
    // Order 003 — in-progress, appraiser escalated a data issue via chat
    {
      id: COMM_PLATFORM_IDS.CTX_ORDER_003, type: 'order', entityId: ORDER_IDS.IN_PROGRESS_003, tenantId,
      chatThreadId: `19:thread-order-003-${tenantId}@thread.v2`, chatCreatedAt: daysAgo(10),
      calls: [
        { id: 'call-003-review', type: 'scheduled_meeting', meetingLink: 'https://teams.microsoft.com/l/meetup-join/placeholder-003', startedAt: daysAgo(2), endedAt: new Date(new Date(daysAgo(2)).getTime() + 35 * 60_000).toISOString(), participants: [AMC_USER, APPRAISER_IDS.KEVIN_OKAFOR], duration: 35 },
      ],
      participants: [
        participant(AMC_USER, '0001', 'AMC Coordinator', 'coordinator@appraisal.platform', 'amc', true),
        participant(APPRAISER_IDS.KEVIN_OKAFOR, '0006', 'Sarah Chen', 'sarah.chen@appraisal.com', 'appraiser'),
      ],
      aiInsights: {
        overallSentiment: 'neutral', sentimentScore: 0.42,
        riskFlags: [
          { type: 'data_discrepancy', severity: 'medium', description: 'Appraiser flagged mismatch in property square footage vs county records', detectedAt: daysAgo(2) },
        ],
        actionItems: [
          { id: 'ai-action-003-1', description: 'Verify property square footage with county assessor records', assignee: AMC_USER, dueDate: daysFromNow(1), status: 'open', extractedAt: daysAgo(2), source: 'meeting' },
        ],
        keyTopics: ['square footage', 'county records', 'data discrepancy'],
        escalationSuggested: true,
        escalationReason: 'Data discrepancy may delay appraisal completion and affect loan timeline',
      },
      createdBy: AMC_USER, createdAt: daysAgo(10), updatedAt: daysAgo(1), isActive: true,
    },
    // Order 005 — deadline pressure scenario
    {
      id: COMM_PLATFORM_IDS.CTX_ORDER_005, type: 'order', entityId: ORDER_IDS.NEW_005, tenantId,
      chatThreadId: `19:thread-order-005-${tenantId}@thread.v2`, chatCreatedAt: daysAgo(14),
      calls: [],
      participants: [
        participant(AMC_USER, '0001', 'AMC Coordinator', 'coordinator@appraisal.platform', 'amc', true),
        participant(VENDOR_IDS.PREMIER, '0002', 'John Smith', 'john@premierappraisal.com', 'vendor'),
        participant(APPRAISER_IDS.MICHAEL_THOMPSON, '0004', 'Michael Thompson', 'michael.thompson@appraisal.com', 'appraiser'),
      ],
      aiInsights: {
        overallSentiment: 'negative', sentimentScore: 0.21,
        riskFlags: [
          { type: 'deadline_risk', severity: 'high', description: 'Order approaching due date with inspection not yet completed', detectedAt: daysAgo(1) },
        ],
        actionItems: [
          { id: 'ai-action-005-1', description: 'Escalate to management if inspection not confirmed within 24 hours', assignee: AMC_USER, dueDate: daysFromNow(0), status: 'open', extractedAt: daysAgo(1), source: 'chat' },
        ],
        keyTopics: ['deadline', 'inspection', 'escalation'],
        escalationSuggested: true,
        escalationReason: 'Order at risk of missing client SLA',
      },
      createdBy: AMC_USER, createdAt: daysAgo(14), updatedAt: hoursAgo(8), isActive: true,
    },
  ];
}

// ─── 3. Teams Meetings ───────────────────────────────────────────────────────

function buildTeamsMeetings(tenantId: string): Record<string, unknown>[] {
  const mtgParticipant = (userId: string, acsSeq: string, displayName: string, email: string, role: string) => ({
    userId, acsUserId: acsId(acsSeq), displayName, email, role, isExternal: false,
  });
  return [
    {
      id: COMM_PLATFORM_IDS.MTG_ORDER_002,
      meetingId: 'MSo1N2Y5ZGFjYy03Nm1mLTQ3ZjUtYTIwNi0zMzIyNTA3MTAwYTM=',
      orderId: ORDER_IDS.QC_REVIEW_002,
      subject: 'APR-2026-002 — Inspection Coordination Call',
      startDateTime: daysAgo(4),
      endDateTime: new Date(new Date(daysAgo(4)).getTime() + 30 * 60_000).toISOString(),
      joinUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_order002%40thread.v2/0?context=%7b%7d',
      organizerId: AMC_USER,
      participants: [
        mtgParticipant(AMC_USER, '0001', 'AMC Coordinator', 'coordinator@appraisal.platform', 'organizer'),
        mtgParticipant(VENDOR_IDS.ROCKY_MOUNTAIN, '0003', 'Maria Garcia', 'maria@rmvaluations.com', 'presenter'),
        mtgParticipant(APPRAISER_IDS.PATRICIA_NGUYEN, '0005', 'James Rodriguez', 'james.rodriguez@appraisal.com', 'attendee'),
      ],
      chatThreadId: `19:thread-order-002-${tenantId}@thread.v2`,
      recordingEnabled: false, transcriptionEnabled: false, allowExternalParticipants: true,
      tenantId, createdAt: daysAgo(5),
    },
    {
      id: COMM_PLATFORM_IDS.MTG_ORDER_003,
      meetingId: 'MSo2Y2E5ZGFjYy03NmUmLTQ3ZjUtYTIwNy0zMzIyNTA3MjEwYTS=',
      orderId: ORDER_IDS.IN_PROGRESS_003,
      subject: 'APR-2026-003 — Appraisal Data Review',
      startDateTime: daysAgo(2),
      endDateTime: new Date(new Date(daysAgo(2)).getTime() + 35 * 60_000).toISOString(),
      joinUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_order003%40thread.v2/0?context=%7b%7d',
      organizerId: AMC_USER,
      participants: [
        mtgParticipant(AMC_USER, '0001', 'AMC Coordinator', 'coordinator@appraisal.platform', 'organizer'),
        mtgParticipant(APPRAISER_IDS.KEVIN_OKAFOR, '0006', 'Sarah Chen', 'sarah.chen@appraisal.com', 'presenter'),
      ],
      chatThreadId: `19:thread-order-003-${tenantId}@thread.v2`,
      recordingEnabled: true, transcriptionEnabled: true, allowExternalParticipants: false,
      tenantId, createdAt: daysAgo(3),
    },
    {
      id: COMM_PLATFORM_IDS.MTG_ORDER_005,
      meetingId: 'MSo3ZGE5ZGFjYy03NmUmLTQ3ZjUtYTIwOC0zMzIyNTA3MzIwYTU=',
      orderId: ORDER_IDS.NEW_005,
      subject: 'APR-2026-005 — Deadline Escalation Review',
      startDateTime: daysFromNow(0),
      endDateTime: new Date(Date.now() + 30 * 60_000).toISOString(),
      joinUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_order005%40thread.v2/0?context=%7b%7d',
      organizerId: AMC_USER,
      participants: [
        mtgParticipant(AMC_USER, '0001', 'AMC Coordinator', 'coordinator@appraisal.platform', 'organizer'),
        mtgParticipant(VENDOR_IDS.PREMIER, '0002', 'John Smith', 'john@premierappraisal.com', 'attendee'),
        mtgParticipant(APPRAISER_IDS.MICHAEL_THOMPSON, '0004', 'Michael Thompson', 'michael.thompson@appraisal.com', 'attendee'),
      ],
      chatThreadId: `19:thread-order-005-${tenantId}@thread.v2`,
      recordingEnabled: false, transcriptionEnabled: false, allowExternalParticipants: false,
      tenantId, createdAt: hoursAgo(12),
    },
  ];
}

// ─── 4. Email Templates ──────────────────────────────────────────────────────

function buildEmailTemplates(tenantId: string): Record<string, unknown>[] {
  const t = (id: string, name: string, category: string, desc: string, subject: string, htmlBody: string, textBody: string, variables: string[]) => ({
    id, tenantId, name, category, description: desc, subject, htmlBody, textBody, variables,
    createdAt: daysAgo(60), updatedAt: daysAgo(60),
  });

  const btnStyle = (bg: string) => `background:${bg};color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none`;
  const wrap = (content: string) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">${content}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/><p style="color:#6b7280;font-size:12px">{{platformName}} · <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p></div>`;

  return [
    t('seed-email-tmpl-order-assignment', 'Order Assignment Notification', 'order_assignment',
      'Sent to a vendor when a new appraisal order is assigned to them.',
      'New Appraisal Assignment — Order {{orderId}}',
      wrap(`<h2 style="color:#1a56db">New Appraisal Order Assignment</h2><p>Hello {{vendorName}},</p><p>You have been assigned a new appraisal order. Please review and accept or decline within <strong>4 hours</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Order ID</td><td style="padding:8px">{{orderId}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Property</td><td style="padding:8px">{{propertyAddress}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Type</td><td style="padding:8px">{{orderType}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Fee</td><td style="padding:8px">{{fee}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Due Date</td><td style="padding:8px">{{dueDate}}</td></tr></table><p><a href="{{portalUrl}}/orders/{{orderId}}" style="${btnStyle('#1a56db')}">View &amp; Accept Assignment</a></p>`),
      'New Appraisal Assignment — Order {{orderId}}\n\nHello {{vendorName}},\n\nYou have been assigned: {{orderId}} at {{propertyAddress}}.\nType: {{orderType}}, Fee: {{fee}}, Due: {{dueDate}}.\n\nAccept/decline: {{portalUrl}}/orders/{{orderId}}\n\n{{platformName}}',
      ['orderId', 'vendorName', 'propertyAddress', 'orderType', 'fee', 'dueDate', 'portalUrl', 'platformName', 'supportEmail']),

    t('seed-email-tmpl-order-acceptance', 'Order Acceptance Confirmation', 'order_acceptance',
      'Sent to the AMC and client when a vendor accepts an order.',
      'Order {{orderId}} Accepted — {{vendorName}}',
      wrap(`<h2 style="color:#057a55">Order Accepted</h2><p>Hello {{clientName}},</p><p><strong>{{vendorName}}</strong> has accepted order <strong>{{orderId}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Order</td><td style="padding:8px">{{orderId}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Property</td><td style="padding:8px">{{propertyAddress}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Expected Completion</td><td style="padding:8px">{{dueDate}}</td></tr></table><p><a href="{{portalUrl}}/orders/{{orderId}}" style="${btnStyle('#1a56db')}">Track Order Progress</a></p>`),
      'Order {{orderId}} Accepted by {{vendorName}}. Property: {{propertyAddress}}. Due: {{dueDate}}. Track: {{portalUrl}}/orders/{{orderId}}',
      ['orderId', 'vendorName', 'clientName', 'propertyAddress', 'dueDate', 'portalUrl', 'platformName', 'supportEmail']),

    t('seed-email-tmpl-negotiation', 'Fee Negotiation Counter-Offer', 'negotiation',
      'Sent when a vendor submits a counter-offer fee during negotiation.',
      'Counter-Offer Received — Order {{orderId}}',
      wrap(`<h2 style="color:#c27803">Fee Counter-Offer Received</h2><p>Hello {{clientName}},</p><p><strong>{{vendorName}}</strong> has submitted a counter-offer for order <strong>{{orderId}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Original Fee</td><td style="padding:8px">{{fee}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Counter-Offer</td><td style="padding:8px;color:#c27803;font-weight:bold">{{counterOfferFee}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Reason</td><td style="padding:8px">{{negotiationReason}}</td></tr></table><p><a href="{{portalUrl}}/orders/{{orderId}}/negotiation" style="${btnStyle('#1a56db')}">Review Counter-Offer</a></p>`),
      'Counter-Offer on Order {{orderId}}: {{counterOfferFee}} (was {{fee}}). Reason: {{negotiationReason}}. Review: {{portalUrl}}/orders/{{orderId}}/negotiation',
      ['orderId', 'vendorName', 'clientName', 'fee', 'counterOfferFee', 'negotiationReason', 'portalUrl', 'platformName', 'supportEmail']),

    t('seed-email-tmpl-milestone', 'Order Milestone Completed', 'milestone',
      'Sent when a key milestone (inspection, draft, delivery) is reached.',
      '{{milestoneName}} Complete — Order {{orderId}}',
      wrap(`<h2 style="color:#057a55">Milestone Reached</h2><p>Hello {{clientName}},</p><p>Order <strong>{{orderId}}</strong> reached: <strong>{{milestoneName}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Milestone</td><td style="padding:8px">{{milestoneName}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Completed</td><td style="padding:8px">{{completionDate}}</td></tr></table><p><a href="{{portalUrl}}/orders/{{orderId}}" style="${btnStyle('#1a56db')}">View Order</a></p>`),
      'Milestone: {{milestoneName}} completed for Order {{orderId}} on {{completionDate}}. View: {{portalUrl}}/orders/{{orderId}}',
      ['orderId', 'clientName', 'milestoneName', 'milestoneStatus', 'completionDate', 'portalUrl', 'platformName', 'supportEmail']),

    t('seed-email-tmpl-revision-request', 'Revision Request', 'revision',
      'Sent to the appraiser when a revision is requested on a submitted report.',
      'Revision Required — Order {{orderId}}',
      wrap(`<h2 style="color:#e02424">Revision Requested</h2><p>Hello {{vendorName}},</p><p>A revision has been requested on order <strong>{{orderId}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#fff5f5;font-weight:bold;width:35%">Severity</td><td style="padding:8px;color:#e02424">{{revisionSeverity}}</td></tr><tr><td style="padding:8px;background:#fff5f5;font-weight:bold">Reason</td><td style="padding:8px">{{revisionReason}}</td></tr><tr><td style="padding:8px;background:#fff5f5;font-weight:bold">Due By</td><td style="padding:8px;font-weight:bold">{{revisionDueDate}}</td></tr></table><p><a href="{{portalUrl}}/orders/{{orderId}}/revisions" style="${btnStyle('#e02424')}">View Revision Details</a></p>`),
      'Revision Required — Order {{orderId}}. Severity: {{revisionSeverity}}. Reason: {{revisionReason}}. Due: {{revisionDueDate}}. Details: {{portalUrl}}/orders/{{orderId}}/revisions',
      ['orderId', 'vendorName', 'revisionSeverity', 'revisionReason', 'revisionDueDate', 'portalUrl', 'platformName', 'supportEmail']),

    t('seed-email-tmpl-delivery', 'Appraisal Report Delivered', 'delivery',
      'Sent to the client when the final appraisal report package is ready.',
      'Appraisal Report Ready — Order {{orderId}}',
      wrap(`<h2 style="color:#057a55">Appraisal Report Delivered</h2><p>Hello {{clientName}},</p><p>The appraisal report for order <strong>{{orderId}}</strong> is ready for download.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Property</td><td style="padding:8px">{{propertyAddress}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Completed</td><td style="padding:8px">{{completionDate}}</td></tr></table><p><a href="{{portalUrl}}/orders/{{orderId}}/delivery" style="${btnStyle('#057a55')}">Download Report</a></p>`),
      'Appraisal Report Ready — Order {{orderId}}. Property: {{propertyAddress}}. Download: {{portalUrl}}/orders/{{orderId}}/delivery',
      ['orderId', 'clientName', 'propertyAddress', 'completionDate', 'portalUrl', 'platformName', 'supportEmail']),

    t('seed-email-tmpl-teams-meeting-invite', 'Teams Meeting Invitation', 'system',
      'Sent when a Teams meeting is scheduled for an order.',
      '{{meetingSubject}} — Teams Meeting Invite',
      wrap(`<h2 style="color:#1a56db">Teams Meeting Scheduled</h2><p>Hello {{userName}},</p><p>A Teams meeting has been scheduled for order <strong>{{orderId}}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Subject</td><td style="padding:8px">{{meetingSubject}}</td></tr><tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Time</td><td style="padding:8px">{{meetingStartTime}}</td></tr></table><p><a href="{{meetingJoinUrl}}" style="${btnStyle('#1a56db')}">Join Teams Meeting</a></p>`),
      'Teams Meeting: {{meetingSubject}} at {{meetingStartTime}} for Order {{orderId}}. Join: {{meetingJoinUrl}}',
      ['orderId', 'userName', 'meetingSubject', 'meetingStartTime', 'meetingJoinUrl', 'platformName', 'supportEmail']),

    t('seed-email-tmpl-deadline-reminder', 'Deadline Reminder', 'system',
      'Sent 24 hours before an order due date when the report is not yet submitted.',
      'Deadline Tomorrow — Order {{orderId}}',
      wrap(`<h2 style="color:#c27803">Deadline Reminder</h2><p>Hello {{vendorName}},</p><p>Order <strong>{{orderId}}</strong> is due <strong>tomorrow</strong>. Please ensure the report is submitted on time.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;background:#fffbeb;font-weight:bold;width:35%">Property</td><td style="padding:8px">{{propertyAddress}}</td></tr><tr><td style="padding:8px;background:#fffbeb;font-weight:bold">Due Date</td><td style="padding:8px;color:#c27803;font-weight:bold">{{dueDate}}</td></tr></table><p><a href="{{portalUrl}}/orders/{{orderId}}" style="${btnStyle('#c27803')}">Submit Report</a></p>`),
      'Deadline Tomorrow — Order {{orderId}}. Property: {{propertyAddress}}. Due: {{dueDate}}. Submit: {{portalUrl}}/orders/{{orderId}}',
      ['orderId', 'vendorName', 'propertyAddress', 'dueDate', 'portalUrl', 'platformName', 'supportEmail']),
  ];
}

// ─── 5. SMS Templates ────────────────────────────────────────────────────────

function buildSmsTemplates(tenantId: string): Record<string, unknown>[] {
  const s = (id: string, name: string, body: string, variables: string[], urgency: string) => ({
    id, tenantId, name, body, variables, urgency, maxLength: 160,
    createdAt: daysAgo(60), updatedAt: daysAgo(60),
  });
  return [
    s('seed-sms-tmpl-order-assignment', 'New Order Assignment', 'New appraisal order {{orderId}} assigned at {{propertyAddress}}. Fee: {{fee}}. Due: {{dueDate}}. Accept/decline: {{portalUrl}}', ['orderId', 'propertyAddress', 'fee', 'dueDate', 'portalUrl'], 'high'),
    s('seed-sms-tmpl-deadline-reminder', 'Deadline Reminder', 'REMINDER: Order {{orderId}} due {{dueDate}}. Please submit your report on time. Questions? Call {{supportPhone}}', ['orderId', 'dueDate', 'supportPhone'], 'high'),
    s('seed-sms-tmpl-milestone-complete', 'Milestone Complete', 'Order {{orderId}}: {{milestoneName}} completed. View progress: {{portalUrl}}', ['orderId', 'milestoneName', 'portalUrl'], 'low'),
    s('seed-sms-tmpl-action-required', 'Action Required', 'Action required on Order {{orderId}}: {{actionDescription}}. Login: {{portalUrl}}', ['orderId', 'actionDescription', 'portalUrl'], 'medium'),
    s('seed-sms-tmpl-revision-request', 'Revision Requested', 'Revision needed on Order {{orderId}}. Due: {{revisionDueDate}}. See details: {{portalUrl}}', ['orderId', 'revisionDueDate', 'portalUrl'], 'high'),
    s('seed-sms-tmpl-meeting-invite', 'Teams Meeting Invite', 'Teams meeting for Order {{orderId}} at {{meetingStartTime}}. Join: {{meetingJoinUrl}}', ['orderId', 'meetingStartTime', 'meetingJoinUrl'], 'medium'),
    s('seed-sms-tmpl-escalation-alert', 'Escalation Alert', 'ESCALATION: Order {{orderId}} requires immediate attention. Contact: {{supportPhone}}', ['orderId', 'supportPhone'], 'critical'),
  ];
}

// ─── Module export ───────────────────────────────────────────────────────────

export const module: SeedModule = {
  name: 'communication-platform',
  containers: ['acsUserMappings', 'communicationContexts', 'teamsMeetings', 'emailTemplates', 'smsTemplates'],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned += await cleanContainer(ctx, 'acsUserMappings', '/azureAdUserId');
      result.cleaned += await cleanContainer(ctx, 'communicationContexts');
      result.cleaned += await cleanContainer(ctx, 'teamsMeetings');
      result.cleaned += await cleanContainer(ctx, 'emailTemplates');
      result.cleaned += await cleanContainer(ctx, 'smsTemplates');
    }

    for (const m of buildAcsUserMappings(ctx.tenantId)) await upsert(ctx, 'acsUserMappings', m, result);
    for (const c of buildCommunicationContexts(ctx.tenantId)) await upsert(ctx, 'communicationContexts', c, result);
    for (const t of buildTeamsMeetings(ctx.tenantId)) await upsert(ctx, 'teamsMeetings', t, result);
    for (const e of buildEmailTemplates(ctx.tenantId)) await upsert(ctx, 'emailTemplates', e, result);
    for (const s of buildSmsTemplates(ctx.tenantId)) await upsert(ctx, 'smsTemplates', s, result);

    return result;
  },
};
