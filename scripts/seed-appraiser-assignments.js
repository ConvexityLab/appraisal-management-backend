/**
 * Seed Test Appraiser Assignments
 * Creates pending assignments for testing the appraiser acceptance queue
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
const ordersContainer = database.container('orders');

// Test appraiser from seed-appraisers.js
const TEST_APPRAISER_ID = 'appraiser-fl-res-11111';
const TEST_TENANT_ID = 'tenant-axiom-appraisal';

const testAssignments = [
  {
    id: `assignment-${Date.now()}-1`,
    type: 'appraiser_assignment',
    tenantId: TEST_TENANT_ID,
    orderId: 'ord_2024_test_001',
    orderNumber: 'ORD-2024-001',
    appraiserId: TEST_APPRAISER_ID,
    assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    assignedBy: 'vendor-elite-appraisals',
    status: 'pending',
    propertyAddress: '123 Main Street, Miami, FL 33101',
    loanAmount: 450000,
    propertyType: 'Single Family',
    inspectionType: 'Interior',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    fee: 550,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: `assignment-${Date.now()}-2`,
    type: 'appraiser_assignment',
    tenantId: TEST_TENANT_ID,
    orderId: 'ord_2024_test_002',
    orderNumber: 'ORD-2024-002',
    appraiserId: TEST_APPRAISER_ID,
    assignedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
    assignedBy: 'vendor-precision-valuations',
    status: 'pending',
    propertyAddress: '456 Ocean Drive, Fort Lauderdale, FL 33316',
    loanAmount: 625000,
    propertyType: 'Condominium',
    inspectionType: 'Interior',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    fee: 650,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: `assignment-${Date.now()}-3`,
    type: 'appraiser_assignment',
    tenantId: TEST_TENANT_ID,
    orderId: 'ord_2024_test_003',
    orderNumber: 'ORD-2024-003',
    appraiserId: TEST_APPRAISER_ID,
    assignedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    assignedBy: 'vendor-elite-appraisals',
    status: 'pending',
    propertyAddress: '789 Palm Court, Tampa, FL 33602',
    loanAmount: 380000,
    propertyType: 'Townhouse',
    inspectionType: 'Exterior Only',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    fee: 450,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  }
];

async function seedAssignments() {
  console.log('🌱 Seeding test appraiser assignments...\n');

  for (const assignment of testAssignments) {
    try {
      await ordersContainer.items.create(assignment);
      console.log(`✅ Created assignment ${assignment.orderNumber} (${assignment.propertyAddress})`);
      console.log(`   Assigned: ${assignment.assignedAt}`);
      console.log(`   Due: ${assignment.dueDate}`);
      console.log(`   Fee: $${assignment.fee}\n`);
    } catch (error) {
      if (error.code === 409) {
        console.log(`⚠️  Assignment ${assignment.orderNumber} already exists, skipping\n`);
      } else {
        console.error(`❌ Error creating assignment ${assignment.orderNumber}:`, error.message);
      }
    }
  }

  console.log('\n✨ Seeding complete!');
  console.log(`\n📋 Test with: http://localhost:3000/appraiser-portal/acceptance`);
  console.log(`   Appraiser ID: ${TEST_APPRAISER_ID}`);
  console.log(`   Tenant ID: ${TEST_TENANT_ID}`);
}

seedAssignments().catch(console.error);
