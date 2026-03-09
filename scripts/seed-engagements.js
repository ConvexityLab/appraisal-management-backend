/**
 * Seed Engagements Data
 *
 * Populates Cosmos DB with 6 LenderEngagement documents:
 *   - 5 SINGLE-loan engagements covering all lifecycle statuses
 *   - 1 PORTFOLIO engagement with 3 loans at different loan statuses
 *
 * All documents use stable IDs starting with "eng-seed-" so the script is
 * idempotent (upsert) — safe to run repeatedly without creating duplicates.
 *
 * Prerequisites:
 *   - az login (DefaultAzureCredential)
 *   - COSMOS_ENDPOINT env var (or relies on default staging URL)
 *
 * Usage:
 *   node scripts/seed-engagements.js
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT =
  process.env.COSMOS_ENDPOINT ||
  process.env.AZURE_COSMOS_ENDPOINT ||
  'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID   = process.env.AZURE_COSMOS_DATABASE_NAME || 'appraisal-management';
const CONTAINER_ID  = 'engagements';
const TENANT_ID     = 'test-tenant-001';

if (!COSMOS_ENDPOINT) {
  throw new Error(
    'COSMOS_ENDPOINT is required. Set it in .env or as an environment variable.',
  );
}

const credential = new DefaultAzureCredential();
const client     = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const container  = client.database(DATABASE_ID).container(CONTAINER_ID);

// ---------------------------------------------------------------------------
// Engagement Documents
// ---------------------------------------------------------------------------

/** ISO "now" relative offsets for realistic timestamps */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  // Return date-only (ISO date, not datetime)
  return d.toISOString().split('T')[0];
}

const engagements = [
  // ── 1. RECEIVED (SINGLE) ─────────────────────────────────────────────────
  {
    id: 'eng-seed-001',
    engagementNumber: 'ENG-2026-SEED01',
    tenantId: TENANT_ID,
    status: 'RECEIVED',
    engagementType: 'SINGLE',
    loansStoredExternally: false,
    priority: 'ROUTINE',
    receivedAt: daysAgo(2),
    clientDueDate: daysFromNow(12),
    internalDueDate: daysFromNow(10),
    client: {
      clientId:   'client-001',
      clientName: 'First National Mortgage',
    },
    loans: [
      {
        id:            'loan-seed-001a',
        loanNumber:    'LN-2026-88001',
        borrowerName:  'Alice Harper',
        borrowerEmail: 'alice.harper@email.com',
        loanOfficer:   'Robert Chen',
        loanType:      'CONVENTIONAL',
        property: {
          address:       '4821 Sunset Blvd',
          city:          'Denver',
          state:         'CO',
          zipCode:       '80203',
          county:        'Denver',
          propertyType:  'Single Family',
          yearBuilt:     1998,
          squareFootage: 2100,
          bedrooms:      4,
          bathrooms:     2.5,
        },
        status: 'PENDING',
        products: [
          {
            id:             'prod-seed-001a',
            productType:    'FULL_APPRAISAL',
            status:         'PENDING',
            fee:            650,
            dueDate:        daysFromNow(10),
            vendorOrderIds: [],
          },
        ],
      },
    ],
    totalEngagementFee: 650,
    createdAt: daysAgo(2),
    createdBy: 'seed-script',
    updatedAt: daysAgo(2),
  },

  // ── 2. ACCEPTED (SINGLE, FHA) ────────────────────────────────────────────
  {
    id: 'eng-seed-002',
    engagementNumber: 'ENG-2026-SEED02',
    tenantId: TENANT_ID,
    status: 'ACCEPTED',
    engagementType: 'SINGLE',
    loansStoredExternally: false,
    priority: 'EXPEDITED',
    receivedAt: daysAgo(5),
    clientDueDate: daysFromNow(8),
    internalDueDate: daysFromNow(6),
    client: {
      clientId:   'client-002',
      clientName: 'Centennial Bank',
    },
    loans: [
      {
        id:            'loan-seed-002a',
        loanNumber:    'LN-2026-88002',
        borrowerName:  'Marcus Webb',
        borrowerEmail: 'marcus.webb@email.com',
        loanOfficer:   'Sandra Kim',
        loanType:      'FHA',
        fhaCase:       'FHA-2026-004421',
        property: {
          address:       '1190 Maple St',
          city:          'Aurora',
          state:         'CO',
          zipCode:       '80010',
          county:        'Arapahoe',
          propertyType:  'Condominium',
          yearBuilt:     2005,
          squareFootage: 1350,
          bedrooms:      2,
          bathrooms:     2,
        },
        status: 'PENDING',
        products: [
          {
            id:             'prod-seed-002a',
            productType:    'FULL_APPRAISAL',
            status:         'PENDING',
            fee:            575,
            dueDate:        daysFromNow(6),
            vendorOrderIds: [],
          },
          {
            id:             'prod-seed-002b',
            productType:    'AVM',
            status:         'PENDING',
            fee:            75,
            dueDate:        daysFromNow(4),
            vendorOrderIds: [],
          },
        ],
      },
    ],
    totalEngagementFee: 650,
    createdAt: daysAgo(5),
    createdBy: 'seed-script',
    updatedAt: daysAgo(4),
  },

  // ── 3. IN_PROGRESS (SINGLE, RUSH) ────────────────────────────────────────
  {
    id: 'eng-seed-003',
    engagementNumber: 'ENG-2026-SEED03',
    tenantId: TENANT_ID,
    status: 'IN_PROGRESS',
    engagementType: 'SINGLE',
    loansStoredExternally: false,
    priority: 'RUSH',
    receivedAt: daysAgo(10),
    clientDueDate: daysFromNow(3),
    internalDueDate: daysFromNow(2),
    specialInstructions: 'Borrower available for access Mon–Fri after 5pm only.',
    client: {
      clientId:   'client-001',
      clientName: 'First National Mortgage',
    },
    loans: [
      {
        id:            'loan-seed-003a',
        loanNumber:    'LN-2026-88003',
        borrowerName:  'Patricia Nguyen',
        borrowerEmail: 'pnguyen@gmail.com',
        loanOfficer:   'David Park',
        loanType:      'CONVENTIONAL',
        property: {
          address:       '3302 Elmwood Dr',
          city:          'Lakewood',
          state:         'CO',
          zipCode:       '80215',
          county:        'Jefferson',
          propertyType:  'Single Family',
          yearBuilt:     1975,
          squareFootage: 1850,
          bedrooms:      3,
          bathrooms:     1.5,
        },
        status: 'IN_PROGRESS',
        products: [
          {
            id:             'prod-seed-003a',
            productType:    'DRIVE_BY',
            status:         'IN_PROGRESS',
            fee:            350,
            dueDate:        daysFromNow(2),
            vendorOrderIds: ['ord-seed-001'],
          },
        ],
      },
    ],
    totalEngagementFee: 350,
    createdAt: daysAgo(10),
    createdBy: 'seed-script',
    updatedAt: daysAgo(7),
  },

  // ── 4. QC (SINGLE, VA) ──────────────────────────────────────────────────
  {
    id: 'eng-seed-004',
    engagementNumber: 'ENG-2026-SEED04',
    tenantId: TENANT_ID,
    status: 'QC',
    engagementType: 'SINGLE',
    loansStoredExternally: false,
    priority: 'ROUTINE',
    receivedAt: daysAgo(18),
    clientDueDate: daysFromNow(5),
    internalDueDate: daysFromNow(2),
    engagementInstructions: 'VA IRRRL refinance — confirm no major deferred maintenance.',
    client: {
      clientId:   'client-003',
      clientName: 'Summit Lending Co',
    },
    loans: [
      {
        id:            'loan-seed-004a',
        loanNumber:    'LN-2026-88004',
        borrowerName:  'James Thornton',
        borrowerEmail: 'j.thornton@work.com',
        loanOfficer:   'Karen Reyes',
        loanType:      'VA',
        property: {
          address:       '8820 Pineview Ct',
          city:          'Englewood',
          state:         'CO',
          zipCode:       '80113',
          county:        'Arapahoe',
          propertyType:  'Single Family',
          yearBuilt:     2011,
          squareFootage: 2600,
          bedrooms:      4,
          bathrooms:     3,
        },
        status: 'QC',
        products: [
          {
            id:             'prod-seed-004a',
            productType:    'FULL_APPRAISAL',
            status:         'DELIVERED',
            fee:            700,
            dueDate:        daysFromNow(2),
            vendorOrderIds: ['ord-seed-002'],
          },
        ],
      },
    ],
    totalEngagementFee: 700,
    createdAt: daysAgo(18),
    createdBy: 'seed-script',
    updatedAt: daysAgo(2),
  },

  // ── 5. DELIVERED (SINGLE, JUMBO) ──────────────────────────────────────────
  {
    id: 'eng-seed-005',
    engagementNumber: 'ENG-2026-SEED05',
    tenantId: TENANT_ID,
    status: 'DELIVERED',
    engagementType: 'SINGLE',
    loansStoredExternally: false,
    priority: 'ROUTINE',
    receivedAt: daysAgo(30),
    closedAt: daysAgo(3),
    clientDueDate: daysAgo(4),
    internalDueDate: daysAgo(5),
    client: {
      clientId:   'client-002',
      clientName: 'Centennial Bank',
    },
    loans: [
      {
        id:            'loan-seed-005a',
        loanNumber:    'LN-2026-88005',
        borrowerName:  'Rachel Monroe',
        borrowerEmail: 'rachel.monroe@email.com',
        loanOfficer:   'Sandra Kim',
        loanType:      'JUMBO',
        property: {
          address:       '450 Crescent Ridge Rd',
          city:          'Cherry Hills Village',
          state:         'CO',
          zipCode:       '80113',
          county:        'Arapahoe',
          propertyType:  'Single Family',
          yearBuilt:     2003,
          squareFootage: 4800,
          bedrooms:      5,
          bathrooms:     4.5,
        },
        status: 'DELIVERED',
        products: [
          {
            id:             'prod-seed-005a',
            productType:    'FULL_APPRAISAL',
            status:         'COMPLETED',
            fee:            1200,
            dueDate:        daysAgo(4),
            vendorOrderIds: ['ord-seed-003'],
          },
          {
            id:             'prod-seed-005b',
            productType:    'FIELD_REVIEW',
            status:         'COMPLETED',
            fee:            400,
            dueDate:        daysAgo(4),
            vendorOrderIds: ['ord-seed-004'],
          },
        ],
      },
    ],
    totalEngagementFee: 1600,
    createdAt: daysAgo(30),
    createdBy: 'seed-script',
    updatedAt: daysAgo(3),
  },

  // ── 6. PORTFOLIO (3 loans at different stages) ────────────────────────────
  {
    id: 'eng-seed-006',
    engagementNumber: 'ENG-2026-SEED06',
    tenantId: TENANT_ID,
    status: 'IN_PROGRESS',
    engagementType: 'PORTFOLIO',
    loansStoredExternally: false,
    priority: 'ROUTINE',
    receivedAt: daysAgo(14),
    clientDueDate: daysFromNow(20),
    internalDueDate: daysFromNow(18),
    specialInstructions: 'Portfolio tape upload — three properties, phased delivery.',
    client: {
      clientId:   'client-004',
      clientName: 'Meridian Lending Partners',
    },
    loans: [
      {
        id:            'loan-seed-006a',
        loanNumber:    'LN-2026-89001',
        borrowerName:  'Thomas Alvarez',
        borrowerEmail: 'talvarez@meridian.com',
        loanOfficer:   'Priya Nair',
        loanType:      'CONVENTIONAL',
        property: {
          address:       '7710 Briarhurst Dr',
          city:          'Fort Collins',
          state:         'CO',
          zipCode:       '80525',
          county:        'Larimer',
          propertyType:  'Single Family',
          yearBuilt:     2008,
          squareFootage: 2380,
          bedrooms:      4,
          bathrooms:     3,
        },
        status: 'IN_PROGRESS',
        products: [
          {
            id:             'prod-seed-006a',
            productType:    'FULL_APPRAISAL',
            status:         'IN_PROGRESS',
            fee:            675,
            dueDate:        daysFromNow(10),
            vendorOrderIds: ['ord-seed-005'],
          },
        ],
      },
      {
        id:            'loan-seed-006b',
        loanNumber:    'LN-2026-89002',
        borrowerName:  'Linda Osei',
        borrowerEmail: 'linda.osei@email.com',
        loanOfficer:   'Priya Nair',
        loanType:      'CONVENTIONAL',
        property: {
          address:       '221 Cottonwood Ave',
          city:          'Greeley',
          state:         'CO',
          zipCode:       '80631',
          county:        'Weld',
          propertyType:  'Single Family',
          yearBuilt:     1995,
          squareFootage: 1700,
          bedrooms:      3,
          bathrooms:     2,
        },
        status: 'PENDING',
        products: [
          {
            id:             'prod-seed-006b',
            productType:    'DRIVE_BY',
            status:         'PENDING',
            fee:            325,
            dueDate:        daysFromNow(15),
            vendorOrderIds: [],
          },
        ],
      },
      {
        id:            'loan-seed-006c',
        loanNumber:    'LN-2026-89003',
        borrowerName:  'Frank Dallaire',
        borrowerEmail: 'f.dallaire@email.com',
        loanOfficer:   'Priya Nair',
        loanType:      'FHA',
        fhaCase:       'FHA-2026-007712',
        property: {
          address:       '5404 Spruce Hill Ln',
          city:          'Pueblo',
          state:         'CO',
          zipCode:       '81005',
          county:        'Pueblo',
          propertyType:  'Single Family',
          yearBuilt:     1962,
          squareFootage: 1420,
          bedrooms:      3,
          bathrooms:     1,
        },
        status: 'DELIVERED',
        products: [
          {
            id:             'prod-seed-006c',
            productType:    'FULL_APPRAISAL',
            status:         'COMPLETED',
            fee:            600,
            dueDate:        daysAgo(1),
            vendorOrderIds: ['ord-seed-006'],
          },
        ],
      },
    ],
    totalEngagementFee: 1600,
    createdAt: daysAgo(14),
    createdBy: 'seed-script',
    updatedAt: daysAgo(1),
  },
];

// ---------------------------------------------------------------------------
// Upsert loop
// ---------------------------------------------------------------------------

async function seed() {
  console.log(`Seeding ${engagements.length} engagement documents into '${CONTAINER_ID}'...`);
  console.log(`  Endpoint : ${COSMOS_ENDPOINT}`);
  console.log(`  Database : ${DATABASE_ID}`);
  console.log(`  TenantId : ${TENANT_ID}`);
  console.log(`  Docs     : 5 SINGLE + 1 PORTFOLIO (3 loans)`);
  console.log('');

  for (const engagement of engagements) {
    try {
      const { resource, statusCode } = await container.items.upsert(engagement);
      const verb = statusCode === 200 ? 'Updated' : 'Created';
      console.log(`  ${verb}: ${resource.engagementNumber} (${resource.status}) — ${resource.id}`);
    } catch (err) {
      console.error(`  FAILED: ${engagement.id}`, err.message);
      process.exitCode = 1;
    }
  }

  console.log('');
  console.log('Done.');
}

seed();
