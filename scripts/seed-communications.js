/**
 * Seed Communication Test Data
 * Creates realistic communications linked to existing orders, vendors, and appraisers
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
const databaseName = process.env.AZURE_COSMOS_DATABASE_NAME;

if (!endpoint || !databaseName) {
  console.error('❌ Missing Cosmos DB configuration in .env');
  process.exit(1);
}

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const database = client.database(databaseName);
const communicationsContainer = database.container('communications');

const TEST_TENANT_ID = 'tenant-axiom-appraisal';

// Test IDs from existing seed data
const TEST_ORDER_1 = 'ord_2024_test_001';
const TEST_ORDER_2 = 'ord_2024_test_002';
const TEST_ORDER_3 = 'ord_2024_test_003';
const TEST_APPRAISER_ID = 'appraiser-fl-res-11111';
const TEST_VENDOR_1 = 'vendor-elite-appraisals';
const TEST_VENDOR_2 = 'vendor-precision-valuations';

// Generate thread IDs
const thread1 = `thread-order-${TEST_ORDER_1}-assignment`;
const thread2 = `thread-order-${TEST_ORDER_2}-negotiation`;
const thread3 = `thread-vendor-${TEST_VENDOR_1}-employment`;
const thread4 = `thread-order-${TEST_ORDER_3}-deadline`;

/**
 * Generate realistic communications
 */
const testCommunications = [
  // ORDER 1: Assignment conversation (3 messages)
  {
    id: `comm-${Date.now()}-001`,
    tenantId: TEST_TENANT_ID,
    channel: 'email',
    direction: 'outbound',
    status: 'delivered',
    from: {
      id: TEST_VENDOR_1,
      type: 'vendor',
      name: 'Elite Appraisals',
      email: 'orders@eliteappraisals.com',
      role: 'vendor'
    },
    to: [
      {
        id: TEST_APPRAISER_ID,
        type: 'appraiser',
        name: 'John Smith',
        email: 'john.smith@appraiser.com',
        role: 'appraiser'
      }
    ],
    subject: 'New Order Assignment: ORD-2024-001',
    body: `Hello John,

We have a new order assignment for you:

Property: 123 Main Street, Miami, FL 33101
Order #: ORD-2024-001
Property Type: Single Family Residence
Inspection Type: Full Interior
Loan Amount: $450,000
Fee: $550
Due Date: ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}

Please review and accept this assignment through your dashboard within 2 hours.

Best regards,
Elite Appraisals Team`,
    bodyFormat: 'text',
    primaryEntity: {
      type: 'order',
      id: TEST_ORDER_1,
      name: 'ORD-2024-001 - 123 Main Street, Miami, FL 33101'
    },
    relatedEntities: [
      { type: 'vendor', id: TEST_VENDOR_1, name: 'Elite Appraisals' },
      { type: 'appraiser', id: TEST_APPRAISER_ID, name: 'John Smith' }
    ],
    category: 'order_assignment',
    conversationContext: 'order_assignment',
    threadId: thread1,
    priority: 'normal',
    businessImpact: {
      requiresAction: true,
      actionDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      affectsDeadline: true,
      impactDescription: 'Appraiser must accept within 2 hours to maintain order schedule'
    },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: `comm-${Date.now()}-002`,
    tenantId: TEST_TENANT_ID,
    channel: 'sms',
    direction: 'inbound',
    status: 'delivered',
    from: {
      id: TEST_APPRAISER_ID,
      type: 'appraiser',
      name: 'John Smith',
      phone: '+1-305-555-1234',
      role: 'appraiser'
    },
    to: [
      {
        id: TEST_VENDOR_1,
        type: 'vendor',
        name: 'Elite Appraisals',
        phone: '+1-305-555-9000',
        role: 'vendor'
      }
    ],
    body: 'Got the order. Can I schedule the inspection for Thursday at 2pm?',
    bodyFormat: 'text',
    primaryEntity: {
      type: 'order',
      id: TEST_ORDER_1,
      name: 'ORD-2024-001 - 123 Main Street, Miami, FL 33101'
    },
    relatedEntities: [
      { type: 'appraiser', id: TEST_APPRAISER_ID, name: 'John Smith' },
      { type: 'vendor', id: TEST_VENDOR_1, name: 'Elite Appraisals' }
    ],
    category: 'order_discussion',
    conversationContext: 'scheduling',
    threadId: thread1,
    priority: 'normal',
    businessImpact: {
      requiresAction: true,
      actionDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      affectsDeadline: false,
      impactDescription: 'Scheduling confirmation needed'
    },
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString()
  },
  {
    id: `comm-${Date.now()}-003`,
    tenantId: TEST_TENANT_ID,
    channel: 'email',
    direction: 'outbound',
    status: 'read',
    from: {
      id: TEST_VENDOR_1,
      type: 'vendor',
      name: 'Elite Appraisals',
      email: 'orders@eliteappraisals.com',
      role: 'vendor'
    },
    to: [
      {
        id: TEST_APPRAISER_ID,
        type: 'appraiser',
        name: 'John Smith',
        email: 'john.smith@appraiser.com',
        role: 'appraiser'
      }
    ],
    subject: 'RE: Inspection Scheduling - ORD-2024-001',
    body: `John,

Thursday at 2pm works perfectly. I've coordinated with the homeowner and they'll be available. Lockbox code: 1234.

Please confirm once inspection is complete.

Thanks!
Sarah - Elite Appraisals`,
    bodyFormat: 'text',
    primaryEntity: {
      type: 'order',
      id: TEST_ORDER_1,
      name: 'ORD-2024-001 - 123 Main Street, Miami, FL 33101'
    },
    relatedEntities: [
      { type: 'vendor', id: TEST_VENDOR_1, name: 'Elite Appraisals' },
      { type: 'appraiser', id: TEST_APPRAISER_ID, name: 'John Smith' }
    ],
    category: 'order_discussion',
    conversationContext: 'scheduling_confirmed',
    threadId: thread1,
    priority: 'normal',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString()
  },

  // ORDER 2: Fee negotiation (2 messages)
  {
    id: `comm-${Date.now()}-004`,
    tenantId: TEST_TENANT_ID,
    channel: 'email',
    direction: 'inbound',
    status: 'delivered',
    from: {
      id: TEST_APPRAISER_ID,
      type: 'appraiser',
      name: 'John Smith',
      email: 'john.smith@appraiser.com',
      role: 'appraiser'
    },
    to: [
      {
        id: TEST_VENDOR_2,
        type: 'vendor',
        name: 'Precision Valuations',
        email: 'ops@precisionval.com',
        role: 'vendor'
      }
    ],
    subject: 'Fee Adjustment Request - ORD-2024-002',
    body: `Hi,

Regarding order ORD-2024-002 (456 Ocean Drive, Fort Lauderdale):

The property is a high-rise condo on the 25th floor with limited parking. Standard fee of $650 doesn't account for the additional time needed.

Can we adjust to $750 to cover:
- Extended travel time due to parking challenges
- Additional elevator wait times
- Complex building access procedures

Please let me know if this works.

Thanks,
John Smith
Licensed Appraiser #FL-11111`,
    bodyFormat: 'text',
    primaryEntity: {
      type: 'order',
      id: TEST_ORDER_2,
      name: 'ORD-2024-002 - 456 Ocean Drive, Fort Lauderdale, FL 33316'
    },
    relatedEntities: [
      { type: 'appraiser', id: TEST_APPRAISER_ID, name: 'John Smith' },
      { type: 'vendor', id: TEST_VENDOR_2, name: 'Precision Valuations' }
    ],
    category: 'negotiation',
    conversationContext: 'fee_adjustment',
    threadId: thread2,
    priority: 'high',
    businessImpact: {
      requiresAction: true,
      actionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      affectsDeadline: true,
      impactDescription: 'Fee negotiation must be resolved before appraiser can accept order'
    },
    aiAnalysis: {
      summary: 'Appraiser requesting fee increase from $650 to $750 due to property complexity',
      sentiment: 'professional',
      actionItems: [
        {
          description: 'Review fee adjustment request',
          priority: 'high',
          suggestedAssignee: 'vendor_operations',
          deadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        }
      ],
      detectedIssues: [
        {
          type: 'fee_dispute',
          severity: 'medium',
          description: 'Fee negotiation in progress - may delay order acceptance'
        }
      ]
    },
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  },
  {
    id: `comm-${Date.now()}-005`,
    tenantId: TEST_TENANT_ID,
    channel: 'teams',
    direction: 'outbound',
    status: 'delivered',
    from: {
      id: TEST_VENDOR_2,
      type: 'vendor',
      name: 'Precision Valuations',
      email: 'ops@precisionval.com',
      role: 'vendor'
    },
    to: [
      {
        id: TEST_APPRAISER_ID,
        type: 'appraiser',
        name: 'John Smith',
        email: 'john.smith@appraiser.com',
        role: 'appraiser'
      }
    ],
    subject: 'RE: Fee Adjustment Approved - ORD-2024-002',
    body: `John - Fee adjustment approved at $750. Your concerns are valid for this property. Order updated in the system. Please proceed with acceptance. -Mike`,
    bodyFormat: 'text',
    primaryEntity: {
      type: 'order',
      id: TEST_ORDER_2,
      name: 'ORD-2024-002 - 456 Ocean Drive, Fort Lauderdale, FL 33316'
    },
    relatedEntities: [
      { type: 'vendor', id: TEST_VENDOR_2, name: 'Precision Valuations' },
      { type: 'appraiser', id: TEST_APPRAISER_ID, name: 'John Smith' }
    ],
    category: 'negotiation',
    conversationContext: 'fee_approved',
    threadId: thread2,
    priority: 'normal',
    businessImpact: {
      requiresAction: false,
      affectsDeadline: false,
      impactDescription: 'Fee negotiation resolved, order can proceed'
    },
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },

  // ORDER 3: Deadline reminder
  {
    id: `comm-${Date.now()}-006`,
    tenantId: TEST_TENANT_ID,
    channel: 'sms',
    direction: 'outbound',
    status: 'delivered',
    from: {
      id: TEST_VENDOR_1,
      type: 'vendor',
      name: 'Elite Appraisals',
      phone: '+1-305-555-9000',
      role: 'vendor'
    },
    to: [
      {
        id: TEST_APPRAISER_ID,
        type: 'appraiser',
        name: 'John Smith',
        phone: '+1-305-555-1234',
        role: 'appraiser'
      }
    ],
    body: `REMINDER: Order ORD-2024-003 (789 Palm Court, Tampa) report due in 48 hours. Status update?`,
    bodyFormat: 'text',
    primaryEntity: {
      type: 'order',
      id: TEST_ORDER_3,
      name: 'ORD-2024-003 - 789 Palm Court, Tampa, FL 33602'
    },
    relatedEntities: [
      { type: 'vendor', id: TEST_VENDOR_1, name: 'Elite Appraisals' },
      { type: 'appraiser', id: TEST_APPRAISER_ID, name: 'John Smith' }
    ],
    category: 'deadline_reminder',
    conversationContext: 'deadline_approaching',
    threadId: thread4,
    priority: 'high',
    businessImpact: {
      requiresAction: true,
      actionDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      affectsDeadline: true,
      impactDescription: 'Report delivery deadline approaching'
    },
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },

  // VENDOR RELATIONSHIP: Employment discussion (not order-specific)
  {
    id: `comm-${Date.now()}-007`,
    tenantId: TEST_TENANT_ID,
    channel: 'email',
    direction: 'outbound',
    status: 'delivered',
    from: {
      id: TEST_VENDOR_1,
      type: 'vendor',
      name: 'Elite Appraisals',
      email: 'hr@eliteappraisals.com',
      role: 'vendor'
    },
    to: [
      {
        id: TEST_APPRAISER_ID,
        type: 'appraiser',
        name: 'John Smith',
        email: 'john.smith@appraiser.com',
        role: 'appraiser'
      }
    ],
    subject: 'Coverage Area Expansion Opportunity',
    body: `Hi John,

We're expanding our coverage into Broward County and would like to add you to our preferred appraiser panel for that region.

This would give you access to:
- 15-20 additional orders per month
- Priority assignment in Broward County
- Competitive fee schedule ($550-$850 per order)
- Dedicated support team

Are you interested in discussing this further? We can schedule a call this week.

Best regards,
Jennifer Martinez
Operations Manager
Elite Appraisals`,
    bodyFormat: 'text',
    primaryEntity: {
      type: 'vendor',
      id: TEST_VENDOR_1,
      name: 'Elite Appraisals'
    },
    relatedEntities: [
      { type: 'appraiser', id: TEST_APPRAISER_ID, name: 'John Smith' }
    ],
    category: 'employment',
    conversationContext: 'coverage_expansion',
    threadId: thread3,
    priority: 'normal',
    businessImpact: {
      requiresAction: false,
      affectsDeadline: false,
      impactDescription: 'Business development opportunity - vendor relationship expansion'
    },
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },

  // APPRAISER TO VENDOR: General availability update
  {
    id: `comm-${Date.now()}-008`,
    tenantId: TEST_TENANT_ID,
    channel: 'email',
    direction: 'inbound',
    status: 'delivered',
    from: {
      id: TEST_APPRAISER_ID,
      type: 'appraiser',
      name: 'John Smith',
      email: 'john.smith@appraiser.com',
      role: 'appraiser'
    },
    to: [
      {
        id: TEST_VENDOR_1,
        type: 'vendor',
        name: 'Elite Appraisals',
        email: 'orders@eliteappraisals.com',
        role: 'vendor'
      }
    ],
    subject: 'Availability Update - March 2026',
    body: `Hi Elite Team,

Quick heads up on my availability for March:

Available:
- March 1-15: Full availability
- March 25-31: Full availability

Limited Availability:
- March 16-24: Family vacation - emergency orders only

Please adjust my assignment volume accordingly for that period.

Thanks,
John Smith`,
    bodyFormat: 'text',
    primaryEntity: {
      type: 'appraiser',
      id: TEST_APPRAISER_ID,
      name: 'John Smith'
    },
    relatedEntities: [
      { type: 'vendor', id: TEST_VENDOR_1, name: 'Elite Appraisals' }
    ],
    category: 'availability',
    conversationContext: 'schedule_update',
    priority: 'normal',
    businessImpact: {
      requiresAction: true,
      actionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      affectsDeadline: false,
      impactDescription: 'Update appraiser capacity in assignment system for March vacation period'
    },
    aiAnalysis: {
      summary: 'Appraiser providing advance notice of reduced availability March 16-24 due to vacation',
      sentiment: 'professional',
      actionItems: [
        {
          description: 'Update appraiser calendar in assignment system',
          priority: 'medium',
          suggestedAssignee: 'vendor_operations',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          description: 'Block non-emergency assignments for March 16-24',
          priority: 'medium',
          suggestedAssignee: 'assignment_coordinator',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

async function seedCommunications() {
  console.log('🌱 Seeding test communications...\n');
  console.log(`📊 Total communications to seed: ${testCommunications.length}\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const comm of testCommunications) {
    try {
      await communicationsContainer.items.create(comm);
      console.log(`✅ Created: ${comm.channel.toUpperCase()} - ${comm.subject || comm.body.substring(0, 50)}...`);
      console.log(`   Category: ${comm.category}`);
      console.log(`   Thread: ${comm.threadId}`);
      console.log(`   Primary Entity: ${comm.primaryEntity.type} - ${comm.primaryEntity.name}`);
      console.log(`   Created: ${new Date(comm.createdAt).toLocaleString()}\n`);
      successCount++;
    } catch (error) {
      if (error.code === 409) {
        console.log(`⏭️  Skipped (already exists): ${comm.id}\n`);
        skipCount++;
      } else {
        console.error(`❌ Error creating communication ${comm.id}:`, error.message, '\n');
        errorCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SEEDING SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully created: ${successCount}`);
  console.log(`⏭️  Skipped (duplicates): ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📊 Total processed: ${successCount + skipCount + errorCount}`);
  console.log('='.repeat(60));
  console.log('\n📝 TEST DATA REFERENCE:');
  console.log(`   Order 1: ${TEST_ORDER_1} (3 messages in thread: ${thread1})`);
  console.log(`   Order 2: ${TEST_ORDER_2} (2 messages in thread: ${thread2})`);
  console.log(`   Order 3: ${TEST_ORDER_3} (1 message in thread: ${thread4})`);
  console.log(`   Vendor-Appraiser: 2 relationship messages (thread: ${thread3})`);
  console.log(`   Appraiser: ${TEST_APPRAISER_ID}`);
  console.log(`   Vendors: ${TEST_VENDOR_1}, ${TEST_VENDOR_2}`);
  console.log('\n🔍 TO TEST:');
  console.log(`   1. GET /api/communications/order/${TEST_ORDER_1} - Should return 3 messages`);
  console.log(`   2. GET /api/communications/vendor/${TEST_VENDOR_1} - Should return 5 messages`);
  console.log(`   3. GET /api/communications/appraiser/${TEST_APPRAISER_ID} - Should return all 8 messages`);
  console.log(`   4. GET /api/communications/thread/${thread1} - Should return 3 messages (order assignment)`);
  console.log(`   5. Open Order detail page and click Communications tab`);
  console.log(`   6. Open Vendor profile and view communications history`);
  console.log('\n');
}

// Run the seeding
seedCommunications()
  .then(() => {
    console.log('✅ Communication seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error seeding communications:', error);
    process.exit(1);
  });
