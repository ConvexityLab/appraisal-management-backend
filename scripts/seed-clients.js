/**
 * Seed Client Test Data
 * Creates sample Lender / AMC / Broker / Credit Union clients for the
 * appraisal management platform staging environment.
 *
 * Usage:
 *   node scripts/seed-clients.js
 *   (or via package.json: pnpm seed:clients)
 *
 * Requires:
 *   - AZURE_COSMOS_ENDPOINT (set in .env or environment)
 *   - Az CLI / Managed Identity login  (DefaultAzureCredential)
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT =
  process.env.COSMOS_ENDPOINT ||
  process.env.AZURE_COSMOS_ENDPOINT;

if (!COSMOS_ENDPOINT) {
  throw new Error('AZURE_COSMOS_ENDPOINT is required. Set it in your .env file.');
}

const DATABASE_NAME = 'appraisal-management';
const CONTAINER_NAME = 'clients';

// Real tenant ID from Azure AD
const TENANT_ID = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const SEEDED_BY = 'seed-script';
const NOW = new Date().toISOString();

/** @type {Array<import('../src/types/index.js').Client>} */
const testClients = [
  // ─── Lenders ───────────────────────────────────────────────────────────────
  {
    id: 'client-lender-firsthorizon-001',
    tenantId: TENANT_ID,
    clientName: 'First Horizon Bank',
    clientType: 'LENDER',
    contactName: 'Amanda Parsons',
    contactEmail: 'aparsons@firsthorizon.com',
    contactPhone: '+1-800-555-1101',
    loanOfficerName: 'James Whitfield',
    lenderName: 'First Horizon Bank',
    address: {
      street: '165 Madison Ave',
      city: 'Memphis',
      state: 'TN',
      zipCode: '38103',
    },
    notes: 'Primary correspondent lender; focus on SE residential.',
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
  {
    id: 'client-lender-pacificcoast-002',
    tenantId: TENANT_ID,
    clientName: 'Pacific Coast Mortgage',
    clientType: 'LENDER',
    contactName: 'Derek Tanaka',
    contactEmail: 'derek.tanaka@pcmortgage.com',
    contactPhone: '+1-800-555-1202',
    loanOfficerName: 'Derek Tanaka',
    lenderName: 'Pacific Coast Mortgage',
    address: {
      street: '2800 Lakeshore Ave',
      city: 'Oakland',
      state: 'CA',
      zipCode: '94610',
    },
    notes: 'West Coast jumbo and VA loan focus.',
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ─── AMC ───────────────────────────────────────────────────────────────────
  {
    id: 'client-amc-nationalamc-003',
    tenantId: TENANT_ID,
    clientName: 'National AMC Services',
    clientType: 'AMC',
    contactName: 'Rachel Monroe',
    contactEmail: 'rmonroe@nationalamc.com',
    contactPhone: '+1-888-555-2001',
    address: {
      street: '1010 Corporate Way',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201',
    },
    notes: 'High-volume AMC; 48-hour order acknowledgement SLA.',
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
  {
    id: 'client-amc-clearpath-004',
    tenantId: TENANT_ID,
    clientName: 'ClearPath Valuation Group',
    clientType: 'AMC',
    contactName: 'Steven Burke',
    contactEmail: 's.burke@clearpathval.com',
    contactPhone: '+1-855-555-2202',
    address: {
      street: '400 N Michigan Ave',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60611',
    },
    notes: 'Midwest and Great Lakes coverage specialist.',
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ─── Broker ────────────────────────────────────────────────────────────────
  {
    id: 'client-broker-suncoast-005',
    tenantId: TENANT_ID,
    clientName: 'Suncoast Mortgage Brokers',
    clientType: 'BROKER',
    contactName: 'Lisa Hernandez',
    contactEmail: 'lisa.h@suncoastbrokers.com',
    contactPhone: '+1-727-555-3001',
    loanOfficerName: 'Lisa Hernandez',
    address: {
      street: '5800 Gulf Blvd',
      city: 'St. Pete Beach',
      state: 'FL',
      zipCode: '33706',
    },
    notes: 'Florida coastal residential and condo specialist.',
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ─── Credit Union ──────────────────────────────────────────────────────────
  {
    id: 'client-cu-firsttechfcu-006',
    tenantId: TENANT_ID,
    clientName: 'First Tech Federal Credit Union',
    clientType: 'CREDIT_UNION',
    contactName: 'Brian Yao',
    contactEmail: 'byao@firsttech.com',
    contactPhone: '+1-800-555-4001',
    lenderName: 'First Tech Federal Credit Union',
    address: {
      street: '3408 Hillview Ave',
      city: 'Palo Alto',
      state: 'CA',
      zipCode: '94304',
    },
    notes: 'Tech-industry membership; high share of jumbo purchase loans.',
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
];

async function seedClients() {
  console.log('🌱 Starting client seed process...');
  console.log(`   Cosmos Endpoint : ${COSMOS_ENDPOINT}`);
  console.log(`   Database        : ${DATABASE_NAME}`);
  console.log(`   Container       : ${CONTAINER_NAME}`);

  const credential = new DefaultAzureCredential();
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });

  const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

  console.log(`\n📦 Upserting ${testClients.length} clients…\n`);

  let succeeded = 0;
  let failed = 0;

  for (const record of testClients) {
    try {
      await container.items.upsert(record);
      console.log(`  ✅  ${record.clientName} (${record.clientType}) — ${record.id}`);
      succeeded++;
    } catch (err) {
      console.error(`  ❌  ${record.id}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Succeeded : ${succeeded}`);
  console.log(`   Failed    : ${failed}`);
  console.log(`   By type   : ${[...new Set(testClients.map((c) => c.clientType))].join(', ')}`);

  if (failed > 0) {
    throw new Error(`${failed} client(s) failed to seed — see errors above.`);
  }
}

seedClients()
  .then(() => {
    console.log('\n✨ Client seeding complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
