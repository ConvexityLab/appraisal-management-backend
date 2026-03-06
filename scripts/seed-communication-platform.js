/**
 * Seed Communication Platform Data
 *
 * Populates the 5 ACS-related containers that have no seed data:
 *   - communicationContexts  (chat thread IDs + call records per order)
 *   - acsUserMappings        (Azure AD user ID → ACS user ID cache)
 *   - teamsMeetings          (Teams meeting records linked to orders)
 *   - emailTemplates         (Email template bodies by category)
 *   - smsTemplates           (SMS template bodies by urgency)
 *
 * All IDs match the existing seed data written by:
 *   seed-communications.js  → tenantId 'tenant-axiom-appraisal', orders 001/002/005
 *   seed-appraisers.js      → appraiser-fl-res-11111, appraiser-tx-res-33333, etc.
 *   seed-test-data.js       → vendor-001…005, order-001…005, users
 *
 * Usage:
 *   node scripts/seed-communication-platform.js
 *
 * Prerequisites:
 *   - AZURE_COSMOS_ENDPOINT and AZURE_COSMOS_DATABASE_NAME in .env
 *   - DefaultAzureCredential (az login) or AZURE_CLIENT_* env vars
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
const databaseName = process.env.AZURE_COSMOS_DATABASE_NAME || 'appraisal-management';

if (!endpoint) {
  console.error('❌ AZURE_COSMOS_ENDPOINT is required in .env');
  process.exit(1);
}

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const db = client.database(databaseName);

// ─────────────────────────────────────────────────────────────────────────────
// REFERENCE IDs (must match existing seed data)
// ─────────────────────────────────────────────────────────────────────────────

const TENANT = 'tenant-axiom-appraisal';

// Orders (from seed-communications.js + seed-test-data.js)
const ORDER_1 = 'order-001'; // APR-2026-001 — vendor assigned, Dallas TX
const ORDER_2 = 'order-002'; // APR-2026-002 — inspection scheduled, Plano TX
const ORDER_3 = 'order-003'; // APR-2026-003 — in progress, Richardson TX
const ORDER_5 = 'order-005'; // deadline pressure (from seed-communications.js)

// Vendors (from seed-test-data.js)
const VENDOR_1 = 'vendor-001'; // Premier Appraisal Group — john@premierappraisal.com
const VENDOR_2 = 'vendor-002'; // Lone Star Valuations — maria@lonestarvalue.com

// Appraisers (from seed-appraisers.js)
const APPRAISER_1 = 'appraiser-fl-res-11111'; // Michael Thompson
const APPRAISER_2 = 'appraiser-tx-res-33333'; // James Rodriguez
const APPRAISER_3 = 'appraiser-ca-com-22222'; // Sarah Chen

// AMC staff user (platform admin / AMC coordinator)
const AMC_USER = 'user-amc-coordinator-01';

// Fake but stable ACS user IDs (format: 8:acs:<resource-guid>:<seq>)
// These are plausible placeholders; real values are created on first token exchange.
const ACS_RESOURCE_GUID = 'a21a2a2b-73c7-4779-a986-09c9ea9056ea'; // matches staging ACS
const ACS_ID = (seq) => `8:acs:${ACS_RESOURCE_GUID}:${seq}`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function hoursAgo(n) { return new Date(Date.now() - n * 3_600_000).toISOString(); }
function daysAgo(n)  { return new Date(Date.now() - n * 86_400_000).toISOString(); }
function daysFrom(n) { return new Date(Date.now() + n * 86_400_000).toISOString(); }

async function upsertAll(containerName, docs) {
  const container = db.container(containerName);
  let created = 0, skipped = 0, errors = 0;

  for (const doc of docs) {
    try {
      await container.items.create(doc);
      console.log(`  ✅ Created ${doc.id}`);
      created++;
    } catch (err) {
      if (err.code === 409) {
        console.log(`  ⏭️  Skipped (exists): ${doc.id}`);
        skipped++;
      } else {
        console.error(`  ❌ Error on ${doc.id}:`, err.message);
        errors++;
      }
    }
  }

  return { created, skipped, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ACS USER MAPPINGS
//    Partition key: /tenantId
//    id format:     ${azureAdUserId}-${tenantId}
//    Purpose:       Cache of Azure AD user → ACS user identity.
//                   Real entries are written on first token exchange; these
//                   seed entries let development work without a token round-trip.
// ─────────────────────────────────────────────────────────────────────────────

const acsUserMappings = [
  {
    id: `${AMC_USER}-${TENANT}`,
    tenantId: TENANT,
    azureAdUserId: AMC_USER,
    acsUserId: ACS_ID('0001'),
    displayName: 'AMC Coordinator',
    email: 'coordinator@appraisal.platform',
    createdAt: daysAgo(30),
    lastTokenGeneratedAt: hoursAgo(1),
  },
  {
    id: `${VENDOR_1}-${TENANT}`,
    tenantId: TENANT,
    azureAdUserId: VENDOR_1,
    acsUserId: ACS_ID('0002'),
    displayName: 'John Smith (Premier Appraisal)',
    email: 'john@premierappraisal.com',
    createdAt: daysAgo(20),
    lastTokenGeneratedAt: hoursAgo(2),
  },
  {
    id: `${VENDOR_2}-${TENANT}`,
    tenantId: TENANT,
    azureAdUserId: VENDOR_2,
    acsUserId: ACS_ID('0003'),
    displayName: 'Maria Garcia (Lone Star)',
    email: 'maria@lonestarvalue.com',
    createdAt: daysAgo(18),
    lastTokenGeneratedAt: hoursAgo(3),
  },
  {
    id: `${APPRAISER_1}-${TENANT}`,
    tenantId: TENANT,
    azureAdUserId: APPRAISER_1,
    acsUserId: ACS_ID('0004'),
    displayName: 'Michael Thompson',
    email: 'michael.thompson@appraisal.com',
    createdAt: daysAgo(25),
    lastTokenGeneratedAt: hoursAgo(4),
  },
  {
    id: `${APPRAISER_2}-${TENANT}`,
    tenantId: TENANT,
    azureAdUserId: APPRAISER_2,
    acsUserId: ACS_ID('0005'),
    displayName: 'James Rodriguez',
    email: 'james.rodriguez@appraisal.com',
    createdAt: daysAgo(15),
    lastTokenGeneratedAt: hoursAgo(6),
  },
  {
    id: `${APPRAISER_3}-${TENANT}`,
    tenantId: TENANT,
    azureAdUserId: APPRAISER_3,
    acsUserId: ACS_ID('0006'),
    displayName: 'Sarah Chen',
    email: 'sarah.chen@appraisal.com',
    createdAt: daysAgo(10),
    lastTokenGeneratedAt: daysAgo(1),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. COMMUNICATION CONTEXTS
//    Partition key: /tenantId
//    One context document per order. The chatThreadId is a fake ACS thread ID;
//    real threads are created on first POST /contexts/:id/chat.
// ─────────────────────────────────────────────────────────────────────────────

function participant(userId, acsSeq, displayName, email, role, isAmc = false) {
  return {
    userId,
    acsUserId: ACS_ID(acsSeq),
    displayName,
    email,
    role,
    joinedAt: daysAgo(7),
    permissions: {
      canStartCall: isAmc || role === 'vendor',
      canScheduleMeeting: isAmc,
      canInviteOthers: isAmc,
      canViewTranscripts: true,
    },
  };
}

const communicationContexts = [
  // Order 001 — vendor assigned, waiting for acceptance
  {
    id: `ctx-order-${ORDER_1}`,
    type: 'order',
    entityId: ORDER_1,
    tenantId: TENANT,
    chatThreadId: `19:thread-order-001-${TENANT}@thread.v2`, // fake ACS thread ID
    chatCreatedAt: daysAgo(6),
    calls: [],
    participants: [
      participant(AMC_USER,    '0001', 'AMC Coordinator',            'coordinator@appraisal.platform', 'amc',       true),
      participant(VENDOR_1,    '0002', 'John Smith (Premier)',        'john@premierappraisal.com',      'vendor'),
      participant(APPRAISER_1, '0004', 'Michael Thompson',           'michael.thompson@appraisal.com', 'appraiser'),
    ],
    aiInsights: {
      riskFlags: [],
      actionItems: [
        {
          id: 'ai-action-001-1',
          description: 'Vendor has not accepted assignment — follow up if no response by EOD',
          assignee: AMC_USER,
          dueDate: daysFrom(0),
          status: 'open',
          extractedAt: hoursAgo(2),
          source: 'chat',
        },
      ],
      keyTopics: ['assignment', 'acceptance', 'scheduling'],
      escalationSuggested: false,
    },
    createdBy: AMC_USER,
    createdAt: daysAgo(7),
    updatedAt: hoursAgo(2),
    isActive: true,
  },

  // Order 002 — inspection scheduled, active coordination
  {
    id: `ctx-order-${ORDER_2}`,
    type: 'order',
    entityId: ORDER_2,
    tenantId: TENANT,
    chatThreadId: `19:thread-order-002-${TENANT}@thread.v2`,
    chatCreatedAt: daysAgo(5),
    calls: [
      {
        id: 'call-002-kickoff',
        type: 'adhoc_call',
        startedAt: daysAgo(4),
        endedAt: new Date(new Date(daysAgo(4)).getTime() + 18 * 60 * 1000).toISOString(),
        participants: [AMC_USER, VENDOR_2, APPRAISER_2],
        duration: 18,
      },
    ],
    participants: [
      participant(AMC_USER,    '0001', 'AMC Coordinator',   'coordinator@appraisal.platform', 'amc',       true),
      participant(VENDOR_2,    '0003', 'Maria Garcia',       'maria@lonestarvalue.com',         'vendor'),
      participant(APPRAISER_2, '0005', 'James Rodriguez',   'james.rodriguez@appraisal.com',   'appraiser'),
    ],
    aiInsights: {
      overallSentiment: 'positive',
      sentimentScore: 0.78,
      riskFlags: [],
      actionItems: [],
      keyTopics: ['inspection', 'scheduling', 'access'],
      escalationSuggested: false,
    },
    createdBy: AMC_USER,
    createdAt: daysAgo(5),
    updatedAt: hoursAgo(5),
    isActive: true,
  },

  // Order 003 — in-progress, appraiser escalated a data issue via chat
  {
    id: `ctx-order-${ORDER_3}`,
    type: 'order',
    entityId: ORDER_3,
    tenantId: TENANT,
    chatThreadId: `19:thread-order-003-${TENANT}@thread.v2`,
    chatCreatedAt: daysAgo(10),
    calls: [
      {
        id: 'call-003-review',
        type: 'scheduled_meeting',
        meetingLink: 'https://teams.microsoft.com/l/meetup-join/placeholder-003',
        startedAt: daysAgo(2),
        endedAt: new Date(new Date(daysAgo(2)).getTime() + 35 * 60 * 1000).toISOString(),
        participants: [AMC_USER, APPRAISER_3],
        duration: 35,
      },
    ],
    participants: [
      participant(AMC_USER,    '0001', 'AMC Coordinator', 'coordinator@appraisal.platform', 'amc',       true),
      participant(APPRAISER_3, '0006', 'Sarah Chen',      'sarah.chen@appraisal.com',        'appraiser'),
    ],
    aiInsights: {
      overallSentiment: 'neutral',
      sentimentScore: 0.42,
      riskFlags: [
        {
          type: 'data_discrepancy',
          severity: 'medium',
          description: 'Appraiser flagged mismatch in property square footage vs county records',
          detectedAt: daysAgo(2),
        },
      ],
      actionItems: [
        {
          id: 'ai-action-003-1',
          description: 'Verify property square footage with county assessor records',
          assignee: AMC_USER,
          dueDate: daysFrom(1),
          status: 'open',
          extractedAt: daysAgo(2),
          source: 'meeting',
        },
      ],
      keyTopics: ['square footage', 'county records', 'data discrepancy'],
      escalationSuggested: true,
      escalationReason: 'Data discrepancy may delay appraisal completion and affect loan timeline',
    },
    createdBy: AMC_USER,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
    isActive: true,
  },

  // Order 005 — deadline pressure scenario (referenced in seed-communications.js)
  {
    id: `ctx-order-${ORDER_5}`,
    type: 'order',
    entityId: ORDER_5,
    tenantId: TENANT,
    chatThreadId: `19:thread-order-005-${TENANT}@thread.v2`,
    chatCreatedAt: daysAgo(14),
    calls: [],
    participants: [
      participant(AMC_USER,    '0001', 'AMC Coordinator',   'coordinator@appraisal.platform', 'amc',       true),
      participant(VENDOR_1,    '0002', 'John Smith',         'john@premierappraisal.com',      'vendor'),
      participant(APPRAISER_1, '0004', 'Michael Thompson',  'michael.thompson@appraisal.com', 'appraiser'),
    ],
    aiInsights: {
      overallSentiment: 'negative',
      sentimentScore: 0.21,
      riskFlags: [
        {
          type: 'deadline_risk',
          severity: 'high',
          description: 'Order approaching due date with inspection not yet completed',
          detectedAt: daysAgo(1),
        },
      ],
      actionItems: [
        {
          id: 'ai-action-005-1',
          description: 'Escalate to management if inspection not confirmed within 24 hours',
          assignee: AMC_USER,
          dueDate: daysFrom(0),
          status: 'open',
          extractedAt: daysAgo(1),
          source: 'chat',
        },
      ],
      keyTopics: ['deadline', 'inspection', 'escalation'],
      escalationSuggested: true,
      escalationReason: 'Order at risk of missing client SLA',
    },
    createdBy: AMC_USER,
    createdAt: daysAgo(14),
    updatedAt: hoursAgo(8),
    isActive: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. TEAMS MEETINGS
//    Partition key: /tenantId
//    meetingId = Graph API online meeting ID (placeholder format)
// ─────────────────────────────────────────────────────────────────────────────

const teamsMeetings = [
  {
    id: 'teams-mtg-order-002-inspection',
    meetingId: 'MSo1N2Y5ZGFjYy03Nm1mLTQ3ZjUtYTIwNi0zMzIyNTA3MTAwYTM=',
    orderId: ORDER_2,
    subject: 'APR-2026-002 — Inspection Coordination Call',
    startDateTime: daysAgo(4),
    endDateTime: new Date(new Date(daysAgo(4)).getTime() + 30 * 60 * 1000).toISOString(),
    joinUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_order002%40thread.v2/0?context=%7b%7d',
    joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_order002%40thread.v2/0',
    organizerId: AMC_USER,
    participants: [
      { userId: AMC_USER,    acsUserId: ACS_ID('0001'), displayName: 'AMC Coordinator', email: 'coordinator@appraisal.platform', role: 'organizer',  isExternal: false },
      { userId: VENDOR_2,    acsUserId: ACS_ID('0003'), displayName: 'Maria Garcia',    email: 'maria@lonestarvalue.com',         role: 'presenter',  isExternal: false },
      { userId: APPRAISER_2, acsUserId: ACS_ID('0005'), displayName: 'James Rodriguez', email: 'james.rodriguez@appraisal.com',   role: 'attendee',   isExternal: false },
    ],
    chatThreadId: `19:thread-order-002-${TENANT}@thread.v2`,
    recordingEnabled: false,
    transcriptionEnabled: false,
    allowExternalParticipants: true,
    tenantId: TENANT,
    createdAt: daysAgo(5),
  },
  {
    id: 'teams-mtg-order-003-review',
    meetingId: 'MSo2Y2E5ZGFjYy03NmUmLTQ3ZjUtYTIwNy0zMzIyNTA3MjEwYTS=',
    orderId: ORDER_3,
    subject: 'APR-2026-003 — Appraisal Data Review',
    startDateTime: daysAgo(2),
    endDateTime: new Date(new Date(daysAgo(2)).getTime() + 35 * 60 * 1000).toISOString(),
    joinUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_order003%40thread.v2/0?context=%7b%7d',
    joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_order003%40thread.v2/0',
    organizerId: AMC_USER,
    participants: [
      { userId: AMC_USER,    acsUserId: ACS_ID('0001'), displayName: 'AMC Coordinator', email: 'coordinator@appraisal.platform', role: 'organizer',  isExternal: false },
      { userId: APPRAISER_3, acsUserId: ACS_ID('0006'), displayName: 'Sarah Chen',      email: 'sarah.chen@appraisal.com',       role: 'presenter',  isExternal: false },
    ],
    chatThreadId: `19:thread-order-003-${TENANT}@thread.v2`,
    recordingEnabled: true,
    transcriptionEnabled: true,
    allowExternalParticipants: false,
    tenantId: TENANT,
    createdAt: daysAgo(3),
  },
  {
    id: 'teams-mtg-order-005-escalation',
    meetingId: 'MSo3ZGE5ZGFjYy03NmUmLTQ3ZjUtYTIwOC0zMzIyNTA3MzIwYTU=',
    orderId: ORDER_5,
    subject: 'APR-2026-005 — Deadline Escalation Review',
    startDateTime: daysFrom(0),   // today
    endDateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    joinUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_order005%40thread.v2/0?context=%7b%7d',
    joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_order005%40thread.v2/0',
    organizerId: AMC_USER,
    participants: [
      { userId: AMC_USER,    acsUserId: ACS_ID('0001'), displayName: 'AMC Coordinator',   email: 'coordinator@appraisal.platform', role: 'organizer',  isExternal: false },
      { userId: VENDOR_1,    acsUserId: ACS_ID('0002'), displayName: 'John Smith',         email: 'john@premierappraisal.com',      role: 'attendee',   isExternal: false },
      { userId: APPRAISER_1, acsUserId: ACS_ID('0004'), displayName: 'Michael Thompson',  email: 'michael.thompson@appraisal.com', role: 'attendee',   isExternal: false },
    ],
    chatThreadId: `19:thread-order-005-${TENANT}@thread.v2`,
    recordingEnabled: false,
    transcriptionEnabled: false,
    allowExternalParticipants: false,
    tenantId: TENANT,
    createdAt: hoursAgo(12),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. EMAIL TEMPLATES
//    Partition key: /tenantId
//    variables: array of {{variableName}} placeholders used in subject/htmlBody/textBody
// ─────────────────────────────────────────────────────────────────────────────

const emailTemplates = [
  {
    id: 'email-tmpl-order-assignment',
    tenantId: TENANT,
    name: 'Order Assignment Notification',
    category: 'order_assignment',
    description: 'Sent to a vendor when a new appraisal order is assigned to them.',
    subject: 'New Appraisal Assignment — Order {{orderId}}',
    htmlBody: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1a56db">New Appraisal Order Assignment</h2>
  <p>Hello {{vendorName}},</p>
  <p>You have been assigned a new appraisal order. Please review the details below and accept or decline within <strong>4 hours</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Order ID</td><td style="padding:8px">{{orderId}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Property</td><td style="padding:8px">{{propertyAddress}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Type</td><td style="padding:8px">{{orderType}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Fee</td><td style="padding:8px">{{fee}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Due Date</td><td style="padding:8px">{{dueDate}}</td></tr>
  </table>
  <p><a href="{{portalUrl}}/orders/{{orderId}}" style="background:#1a56db;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">View &amp; Accept Assignment</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#6b7280;font-size:12px">{{platformName}} · <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
</div>`,
    textBody: `New Appraisal Assignment — Order {{orderId}}\n\nHello {{vendorName}},\n\nYou have been assigned a new appraisal order:\n\nOrder: {{orderId}}\nProperty: {{propertyAddress}}\nType: {{orderType}}\nFee: {{fee}}\nDue Date: {{dueDate}}\n\nPlease log in to accept or decline within 4 hours:\n{{portalUrl}}/orders/{{orderId}}\n\n{{platformName}}`,
    variables: ['orderId', 'vendorName', 'propertyAddress', 'orderType', 'fee', 'dueDate', 'portalUrl', 'platformName', 'supportEmail'],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'email-tmpl-order-acceptance',
    tenantId: TENANT,
    name: 'Order Acceptance Confirmation',
    category: 'order_acceptance',
    description: 'Sent to the AMC and client when a vendor accepts an order.',
    subject: 'Order {{orderId}} Accepted — {{vendorName}}',
    htmlBody: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#057a55">✅ Order Accepted</h2>
  <p>Hello {{clientName}},</p>
  <p><strong>{{vendorName}}</strong> has accepted the appraisal assignment for order <strong>{{orderId}}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Order</td><td style="padding:8px">{{orderId}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Property</td><td style="padding:8px">{{propertyAddress}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Appraiser</td><td style="padding:8px">{{vendorName}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Expected Completion</td><td style="padding:8px">{{dueDate}}</td></tr>
  </table>
  <p><a href="{{portalUrl}}/orders/{{orderId}}" style="background:#1a56db;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">Track Order Progress</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#6b7280;font-size:12px">{{platformName}} · <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
</div>`,
    textBody: `Order {{orderId}} Accepted\n\n{{vendorName}} has accepted order {{orderId}} for {{propertyAddress}}.\n\nExpected completion: {{dueDate}}\n\nTrack progress: {{portalUrl}}/orders/{{orderId}}\n\n{{platformName}}`,
    variables: ['orderId', 'vendorName', 'clientName', 'propertyAddress', 'dueDate', 'portalUrl', 'platformName', 'supportEmail'],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'email-tmpl-negotiation',
    tenantId: TENANT,
    name: 'Fee Negotiation Counter-Offer',
    category: 'negotiation',
    description: 'Sent when a vendor submits a counter-offer fee during negotiation.',
    subject: 'Counter-Offer Received — Order {{orderId}}',
    htmlBody: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#c27803">💬 Fee Counter-Offer Received</h2>
  <p>Hello {{clientName}},</p>
  <p><strong>{{vendorName}}</strong> has submitted a counter-offer for order <strong>{{orderId}}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Order</td><td style="padding:8px">{{orderId}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Original Fee</td><td style="padding:8px">{{fee}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Counter-Offer</td><td style="padding:8px;color:#c27803;font-weight:bold">{{counterOfferFee}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Reason</td><td style="padding:8px">{{negotiationReason}}</td></tr>
  </table>
  <p>Please review and respond within 24 hours.</p>
  <p><a href="{{portalUrl}}/orders/{{orderId}}/negotiation" style="background:#1a56db;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">Review Counter-Offer</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#6b7280;font-size:12px">{{platformName}} · <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
</div>`,
    textBody: `Counter-Offer on Order {{orderId}}\n\n{{vendorName}} has submitted a counter-offer:\n\nOriginal: {{fee}}\nCounter-offer: {{counterOfferFee}}\nReason: {{negotiationReason}}\n\nRespond at: {{portalUrl}}/orders/{{orderId}}/negotiation\n\n{{platformName}}`,
    variables: ['orderId', 'vendorName', 'clientName', 'fee', 'counterOfferFee', 'negotiationReason', 'portalUrl', 'platformName', 'supportEmail'],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'email-tmpl-milestone',
    tenantId: TENANT,
    name: 'Order Milestone Completed',
    category: 'milestone',
    description: 'Sent when a key milestone (inspection, draft, delivery) is reached.',
    subject: '{{milestoneName}} Complete — Order {{orderId}}',
    htmlBody: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#057a55">🏁 Milestone Reached</h2>
  <p>Hello {{clientName}},</p>
  <p>Order <strong>{{orderId}}</strong> has reached a new milestone: <strong>{{milestoneName}}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Order</td><td style="padding:8px">{{orderId}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Milestone</td><td style="padding:8px">{{milestoneName}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Completed</td><td style="padding:8px">{{completionDate}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Status</td><td style="padding:8px">{{milestoneStatus}}</td></tr>
  </table>
  <p><a href="{{portalUrl}}/orders/{{orderId}}" style="background:#1a56db;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">View Order</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#6b7280;font-size:12px">{{platformName}} · <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
</div>`,
    textBody: `Milestone Completed — Order {{orderId}}\n\n{{milestoneName}} completed on {{completionDate}}.\n\nView at: {{portalUrl}}/orders/{{orderId}}\n\n{{platformName}}`,
    variables: ['orderId', 'clientName', 'milestoneName', 'milestoneStatus', 'completionDate', 'portalUrl', 'platformName', 'supportEmail'],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'email-tmpl-revision-request',
    tenantId: TENANT,
    name: 'Revision Request',
    category: 'revision',
    description: 'Sent to the appraiser when a revision is requested on a submitted report.',
    subject: 'Revision Required — Order {{orderId}}',
    htmlBody: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#e02424">⚠️ Revision Requested</h2>
  <p>Hello {{vendorName}},</p>
  <p>A revision has been requested on order <strong>{{orderId}}</strong>. Please review the comments and resubmit by the deadline.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#fff5f5;font-weight:bold;width:35%">Order</td><td style="padding:8px">{{orderId}}</td></tr>
    <tr><td style="padding:8px;background:#fff5f5;font-weight:bold">Severity</td><td style="padding:8px;color:#e02424">{{revisionSeverity}}</td></tr>
    <tr><td style="padding:8px;background:#fff5f5;font-weight:bold">Reason</td><td style="padding:8px">{{revisionReason}}</td></tr>
    <tr><td style="padding:8px;background:#fff5f5;font-weight:bold">Due By</td><td style="padding:8px;font-weight:bold">{{revisionDueDate}}</td></tr>
  </table>
  <p><a href="{{portalUrl}}/orders/{{orderId}}/revisions" style="background:#e02424;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">View Revision Details</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#6b7280;font-size:12px">{{platformName}} · <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
</div>`,
    textBody: `Revision Required — Order {{orderId}}\n\nSeverity: {{revisionSeverity}}\nReason: {{revisionReason}}\nDue: {{revisionDueDate}}\n\nDetails: {{portalUrl}}/orders/{{orderId}}/revisions\n\n{{platformName}}`,
    variables: ['orderId', 'vendorName', 'revisionSeverity', 'revisionReason', 'revisionDueDate', 'portalUrl', 'platformName', 'supportEmail'],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'email-tmpl-delivery',
    tenantId: TENANT,
    name: 'Appraisal Report Delivered',
    category: 'delivery',
    description: 'Sent to the client when the final appraisal report package is ready.',
    subject: 'Appraisal Report Ready — Order {{orderId}}',
    htmlBody: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#057a55">📦 Appraisal Report Delivered</h2>
  <p>Hello {{clientName}},</p>
  <p>The appraisal report for order <strong>{{orderId}}</strong> has been completed and is ready for download.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Order</td><td style="padding:8px">{{orderId}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Property</td><td style="padding:8px">{{propertyAddress}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Completed</td><td style="padding:8px">{{completionDate}}</td></tr>
  </table>
  <p><a href="{{portalUrl}}/orders/{{orderId}}/delivery" style="background:#057a55;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">Download Report</a></p>
  <p style="color:#6b7280;font-size:12px">This report is confidential and intended solely for the addressed recipient.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#6b7280;font-size:12px">{{platformName}} · <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
</div>`,
    textBody: `Appraisal Report Ready — Order {{orderId}}\n\nProperty: {{propertyAddress}}\nCompleted: {{completionDate}}\n\nDownload: {{portalUrl}}/orders/{{orderId}}/delivery\n\n{{platformName}}`,
    variables: ['orderId', 'clientName', 'propertyAddress', 'completionDate', 'portalUrl', 'platformName', 'supportEmail'],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'email-tmpl-teams-meeting-invite',
    tenantId: TENANT,
    name: 'Teams Meeting Invitation',
    category: 'system',
    description: 'Sent when a Teams meeting is scheduled for an order.',
    subject: '{{meetingSubject}} — Teams Meeting Invite',
    htmlBody: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#1a56db">📅 Teams Meeting Scheduled</h2>
  <p>Hello {{userName}},</p>
  <p>A Teams meeting has been scheduled for order <strong>{{orderId}}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;width:35%">Subject</td><td style="padding:8px">{{meetingSubject}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Time</td><td style="padding:8px">{{meetingStartTime}}</td></tr>
    <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold">Order</td><td style="padding:8px">{{orderId}}</td></tr>
  </table>
  <p><a href="{{meetingJoinUrl}}" style="background:#1a56db;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">Join Teams Meeting</a></p>
  <p style="color:#6b7280;font-size:12px">You can also join via web browser using the link above.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#6b7280;font-size:12px">{{platformName}} · <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
</div>`,
    textBody: `Teams Meeting: {{meetingSubject}}\n\nTime: {{meetingStartTime}}\nOrder: {{orderId}}\n\nJoin: {{meetingJoinUrl}}\n\n{{platformName}}`,
    variables: ['orderId', 'userName', 'meetingSubject', 'meetingStartTime', 'meetingJoinUrl', 'platformName', 'supportEmail'],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'email-tmpl-deadline-reminder',
    tenantId: TENANT,
    name: 'Deadline Reminder',
    category: 'system',
    description: 'Sent 24 hours before an order due date when the report is not yet submitted.',
    subject: '⏰ Deadline Tomorrow — Order {{orderId}}',
    htmlBody: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#c27803">⏰ Deadline Reminder</h2>
  <p>Hello {{vendorName}},</p>
  <p>Order <strong>{{orderId}}</strong> is due <strong>tomorrow</strong>. Please ensure the report is submitted on time.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;background:#fffbeb;font-weight:bold;width:35%">Order</td><td style="padding:8px">{{orderId}}</td></tr>
    <tr><td style="padding:8px;background:#fffbeb;font-weight:bold">Property</td><td style="padding:8px">{{propertyAddress}}</td></tr>
    <tr><td style="padding:8px;background:#fffbeb;font-weight:bold">Due Date</td><td style="padding:8px;color:#c27803;font-weight:bold">{{dueDate}}</td></tr>
  </table>
  <p><a href="{{portalUrl}}/orders/{{orderId}}" style="background:#c27803;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">Submit Report</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#6b7280;font-size:12px">{{platformName}} · <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
</div>`,
    textBody: `Deadline Tomorrow — Order {{orderId}}\n\nProperty: {{propertyAddress}}\nDue: {{dueDate}}\n\nSubmit at: {{portalUrl}}/orders/{{orderId}}\n\n{{platformName}}`,
    variables: ['orderId', 'vendorName', 'propertyAddress', 'dueDate', 'portalUrl', 'platformName', 'supportEmail'],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. SMS TEMPLATES
//    Partition key: /tenantId
//    maxLength: 160 = single segment; 320 = 2 segments (carriers charge per-segment)
// ─────────────────────────────────────────────────────────────────────────────

const smsTemplates = [
  {
    id: 'sms-tmpl-order-assignment',
    tenantId: TENANT,
    name: 'New Order Assignment',
    body: 'New appraisal order {{orderId}} assigned to you at {{propertyAddress}}. Fee: {{fee}}. Due: {{dueDate}}. Accept/decline: {{portalUrl}}',
    variables: ['orderId', 'propertyAddress', 'fee', 'dueDate', 'portalUrl'],
    urgency: 'high',
    maxLength: 160,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'sms-tmpl-deadline-reminder',
    tenantId: TENANT,
    name: 'Deadline Reminder',
    body: '⏰ REMINDER: Order {{orderId}} due {{dueDate}}. Please submit your report on time. Questions? Call {{supportPhone}}',
    variables: ['orderId', 'dueDate', 'supportPhone'],
    urgency: 'high',
    maxLength: 160,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'sms-tmpl-milestone-complete',
    tenantId: TENANT,
    name: 'Milestone Complete',
    body: '✅ Order {{orderId}}: {{milestoneName}} completed. View progress: {{portalUrl}}',
    variables: ['orderId', 'milestoneName', 'portalUrl'],
    urgency: 'low',
    maxLength: 160,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'sms-tmpl-action-required',
    tenantId: TENANT,
    name: 'Action Required',
    body: '🔔 Action required on Order {{orderId}}: {{actionDescription}}. Login: {{portalUrl}}',
    variables: ['orderId', 'actionDescription', 'portalUrl'],
    urgency: 'medium',
    maxLength: 160,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'sms-tmpl-revision-request',
    tenantId: TENANT,
    name: 'Revision Requested',
    body: '⚠️ Revision needed on Order {{orderId}}. Due: {{revisionDueDate}}. See details: {{portalUrl}}',
    variables: ['orderId', 'revisionDueDate', 'portalUrl'],
    urgency: 'high',
    maxLength: 160,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'sms-tmpl-meeting-invite',
    tenantId: TENANT,
    name: 'Teams Meeting Invite',
    body: '📅 Teams meeting for Order {{orderId}} at {{meetingStartTime}}. Join: {{meetingJoinUrl}}',
    variables: ['orderId', 'meetingStartTime', 'meetingJoinUrl'],
    urgency: 'medium',
    maxLength: 160,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
  {
    id: 'sms-tmpl-escalation-alert',
    tenantId: TENANT,
    name: 'Escalation Alert',
    body: '🚨 ESCALATION: Order {{orderId}} requires immediate attention. Contact: {{supportPhone}}',
    variables: ['orderId', 'supportPhone'],
    urgency: 'critical',
    maxLength: 160,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(60),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('='.repeat(60));
  console.log('🌱 SEED: Communication Platform Data');
  console.log(`   Cosmos: ${endpoint}`);
  console.log(`   DB:     ${databaseName}`);
  console.log(`   Tenant: ${TENANT}`);
  console.log('='.repeat(60));

  const sections = [
    { container: 'acsUserMappings',        label: 'ACS User Mappings',        docs: acsUserMappings },
    { container: 'communicationContexts',  label: 'Communication Contexts',   docs: communicationContexts },
    { container: 'teamsMeetings',          label: 'Teams Meetings',            docs: teamsMeetings },
    { container: 'emailTemplates',         label: 'Email Templates',           docs: emailTemplates },
    { container: 'smsTemplates',           label: 'SMS Templates',             docs: smsTemplates },
  ];

  let totalCreated = 0, totalSkipped = 0, totalErrors = 0;

  for (const { container, label, docs } of sections) {
    console.log(`\n📦 ${label} (${docs.length} docs)`);
    const { created, skipped, errors } = await upsertAll(container, docs);
    totalCreated += created;
    totalSkipped += skipped;
    totalErrors  += errors;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Created:  ${totalCreated}`);
  console.log(`⏭️  Skipped:  ${totalSkipped}`);
  console.log(`❌ Errors:   ${totalErrors}`);
  console.log('='.repeat(60));

  console.log('\n📝 WHAT WAS SEEDED:');
  console.log(`   acsUserMappings:       ${acsUserMappings.length} users (${AMC_USER}, ${VENDOR_1}, ${VENDOR_2}, ${APPRAISER_1}, ${APPRAISER_2}, ${APPRAISER_3})`);
  console.log(`   communicationContexts: ${communicationContexts.length} contexts (orders 001, 002, 003, 005)`);
  console.log(`   teamsMeetings:         ${teamsMeetings.length} meetings (orders 002, 003, 005)`);
  console.log(`   emailTemplates:        ${emailTemplates.length} templates (assignment, acceptance, negotiation, milestone, revision, delivery, meeting, deadline)`);
  console.log(`   smsTemplates:          ${smsTemplates.length} templates (assignment, deadline, milestone, action, revision, meeting, escalation)`);

  if (totalErrors > 0) {
    console.log('\n⚠️  Some documents failed — check errors above.');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
