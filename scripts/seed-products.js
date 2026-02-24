/**
 * Seed Product / Fee Configuration Test Data
 * Creates the standard appraisal product catalogue for the staging environment.
 *
 * Products map to the frontend ProductType enum; keep values aligned with:
 *   src/types/backend/product.types.ts  (frontend)
 *   src/types/index.ts Product interface (backend)
 *
 * Usage:
 *   node scripts/seed-products.js
 *   (or via package.json: pnpm seed:products)
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
const CONTAINER_NAME = 'products';

// Real tenant ID from Azure AD
const TENANT_ID = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const SEEDED_BY = 'seed-script';
const NOW = new Date().toISOString();

/**
 * Fee split: appraiser receives (100 - feeSplitPercent)% of defaultFee.
 * techFee: flat AMC technology / platform fee added to invoice.
 *
 * @type {Array<import('../src/types/index.js').Product>}
 */
const testProducts = [
  // ─── Residential ───────────────────────────────────────────────────────────
  {
    id: 'product-1004-full-001',
    tenantId: TENANT_ID,
    name: 'Full Appraisal (Form 1004)',
    productType: 'FULL_APPRAISAL',
    description:
      'FNMA/FHLMC-compliant single-family interior and exterior inspection appraisal. ' +
      'Includes comparable grid, market condition addendum, and digital signature.',
    defaultFee: 450,
    rushFeeMultiplier: 1.5,
    techFee: 25,
    feeSplitPercent: 20,       // 80% to appraiser, 20% AMC margin
    turnTimeDays: 5,
    rushTurnTimeDays: 2,
    isActive: true,
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
  {
    id: 'product-2055-driveby-002',
    tenantId: TENANT_ID,
    name: 'Exterior-Only (Form 2055)',
    productType: 'DRIVE_BY',
    description:
      'Exterior drive-by inspection only. Suitable for low-LTV refinances ' +
      'and portfolio review orders where interior access is unavailable.',
    defaultFee: 275,
    rushFeeMultiplier: 1.5,
    techFee: 25,
    feeSplitPercent: 18,
    turnTimeDays: 3,
    rushTurnTimeDays: 1,
    isActive: true,
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
  {
    id: 'product-desktop-review-003',
    tenantId: TENANT_ID,
    name: 'Desktop Review (Form 1004D / 2075)',
    productType: 'DESKTOP',
    description:
      'Desk review using MLS data, public records, and prior appraisal report. ' +
      'No physical inspection. Suitable for low-risk recertifications.',
    defaultFee: 150,
    rushFeeMultiplier: 1.4,
    techFee: 15,
    feeSplitPercent: 15,
    turnTimeDays: 2,
    rushTurnTimeDays: 1,
    isActive: true,
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
  {
    id: 'product-1073-condo-004',
    tenantId: TENANT_ID,
    name: 'Condominium Appraisal (Form 1073)',
    productType: 'CONDO',
    description:
      'Full interior/exterior appraisal for condominium units. ' +
      'Includes project analysis and PUD addendum where applicable.',
    defaultFee: 500,
    rushFeeMultiplier: 1.5,
    techFee: 25,
    feeSplitPercent: 20,
    turnTimeDays: 6,
    rushTurnTimeDays: 3,
    isActive: true,
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
  {
    id: 'product-1025-multifam-005',
    tenantId: TENANT_ID,
    name: 'Multi-Family (Form 1025 / 2-4 Units)',
    productType: 'MULTI_FAMILY',
    description:
      'Small income-producing property appraisal for 2–4 unit residential ' +
      'buildings. Includes rental analysis addendum.',
    defaultFee: 650,
    rushFeeMultiplier: 1.5,
    techFee: 30,
    feeSplitPercent: 22,
    turnTimeDays: 7,
    rushTurnTimeDays: 4,
    isActive: true,
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ─── Review / Recertification ───────────────────────────────────────────────
  {
    id: 'product-field-review-006',
    tenantId: TENANT_ID,
    name: 'Field Review (Form 2000)',
    productType: 'FIELD_REVIEW',
    description:
      'Second-opinion field review of an existing appraisal. ' +
      'Exterior inspection only with comparable analysis.',
    defaultFee: 325,
    rushFeeMultiplier: 1.4,
    techFee: 20,
    feeSplitPercent: 18,
    turnTimeDays: 4,
    rushTurnTimeDays: 2,
    isActive: true,
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
  {
    id: 'product-1004d-recert-007',
    tenantId: TENANT_ID,
    name: 'Recertification of Value (Form 1004D)',
    productType: 'RECERTIFICATION',
    description:
      'Confirms whether the property condition and value remain consistent ' +
      'with the original appraisal. Required for expired commitments.',
    defaultFee: 125,
    rushFeeMultiplier: 1.3,
    techFee: 10,
    feeSplitPercent: 12,
    turnTimeDays: 2,
    rushTurnTimeDays: 1,
    isActive: true,
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ─── ROV / Dispute ─────────────────────────────────────────────────────────
  {
    id: 'product-rov-standard-008',
    tenantId: TENANT_ID,
    name: 'Reconsideration of Value (ROV)',
    productType: 'ROV',
    description:
      'Formal reconsideration of value submission per FHFA ROV guidance ' +
      '(Jan 2024). Requires lender-submitted comparable evidence.',
    defaultFee: 95,
    rushFeeMultiplier: 1.0,   // ROV SLA is fixed per regulation — no rush multiplier
    techFee: 10,
    feeSplitPercent: 10,
    turnTimeDays: 3,
    rushTurnTimeDays: 3,      // same as standard per FHFA guidelines
    isActive: true,
    status: 'ACTIVE',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
];

async function seedProducts() {
  console.log('🌱 Starting product seed process...');
  console.log(`   Cosmos Endpoint : ${COSMOS_ENDPOINT}`);
  console.log(`   Database        : ${DATABASE_NAME}`);
  console.log(`   Container       : ${CONTAINER_NAME}`);

  const credential = new DefaultAzureCredential();
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });

  const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

  console.log(`\n📦 Upserting ${testProducts.length} products…\n`);

  let succeeded = 0;
  let failed = 0;

  for (const product of testProducts) {
    try {
      await container.items.upsert(product);
      console.log(
        `  ✅  ${product.name.padEnd(42)} $${product.defaultFee} / ${product.turnTimeDays}d — ${product.id}`
      );
      succeeded++;
    } catch (err) {
      console.error(`  ❌  ${product.id}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Succeeded   : ${succeeded}`);
  console.log(`   Failed      : ${failed}`);
  console.log(
    `   Fee range   : $${Math.min(...testProducts.map((p) => p.defaultFee))} – $${Math.max(...testProducts.map((p) => p.defaultFee))}`
  );

  if (failed > 0) {
    throw new Error(`${failed} product(s) failed to seed — see errors above.`);
  }
}

seedProducts()
  .then(() => {
    console.log('\n✨ Product seeding complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
