/**
 * Seed Matching Criteria Sets Test Data
 *
 * Creates named, reusable provider-eligibility rule sets for the staging
 * environment.  These sets power the matching engine when creating RFBs.
 *
 * Criteria field paths resolve against the Vendor / VendorProfile shape
 * stored in Cosmos:
 *
 *   licenseExpiry                   – ISO date string (not_expired)
 *   status                          – 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
 *   serviceAreas.state              – 2-char abbreviation (eq / in)
 *   performance.qualityScore        – 1–5 scale
 *   performance.onTimeDeliveryRate  – percentage 0–100
 *   performance.revisionRate        – percentage 0–100 (lower is better)
 *
 * Usage:
 *   node scripts/seed-matching-criteria-sets.js
 *   (or via package.json: pnpm seed:criteria-sets)
 *
 * Requires:
 *   - COSMOS_ENDPOINT  (or AZURE_COSMOS_ENDPOINT)
 *   - Az CLI / Managed Identity login  (DefaultAzureCredential)
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const COSMOS_ENDPOINT =
  process.env.COSMOS_ENDPOINT ||
  process.env.AZURE_COSMOS_ENDPOINT ||
  'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';

const DATABASE_NAME = 'appraisal-management';
const CONTAINER_NAME = 'matching-criteria-sets';

// Real tenant ID from Azure AD
const TENANT_ID = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const SEEDED_BY = 'seed-script';
const NOW = new Date().toISOString();

// ─── Criteria Sets ─────────────────────────────────────────────────────────────

/** @type {Array<import('../src/types/matching.types.js').MatchingCriteriaSet>} */
const criteriaSets = [
  // ── 1. Active License — Any Provider Type ─────────────────────────────────
  {
    id: 'mcs-active-license-001',
    tenantId: TENANT_ID,
    name: 'Active License Required',
    description:
      'Baseline gate: provider must have an unexpired license/certification ' +
      'and an ACTIVE account status.  Apply to every RFB as a minimum bar.',
    combinator: 'AND',
    providerTypes: [],   // empty = applies to all types
    criteria: [
      {
        field: 'licenseExpiry',
        operator: 'not_expired',
        value: null,
        label: 'License not expired',
      },
      {
        field: 'status',
        operator: 'eq',
        value: 'ACTIVE',
        label: 'Account status is ACTIVE',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ── 2. Florida State Coverage — Appraiser & AMC ───────────────────────────
  {
    id: 'mcs-florida-coverage-002',
    tenantId: TENANT_ID,
    name: 'Florida Coverage',
    description:
      'Provider must list Florida (FL) as a covered service area. ' +
      'Use when the subject property is in Florida.',
    combinator: 'AND',
    providerTypes: ['APPRAISER', 'AMC'],
    criteria: [
      {
        field: 'serviceAreas.state',
        operator: 'eq',
        value: 'FL',
        label: 'Covers Florida',
      },
      {
        field: 'status',
        operator: 'eq',
        value: 'ACTIVE',
        label: 'Account status is ACTIVE',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ── 3. Southeast Multi-State Coverage ─────────────────────────────────────
  {
    id: 'mcs-southeast-coverage-003',
    tenantId: TENANT_ID,
    name: 'Southeast Multi-State Coverage',
    description:
      'Provider must cover at least one of the eight core Southeast states ' +
      '(FL, GA, SC, NC, AL, MS, TN, VA).  Useful for portfolio orders ' +
      'spanning multiple states in the region.',
    combinator: 'AND',
    providerTypes: ['APPRAISER', 'AMC'],
    criteria: [
      {
        field: 'serviceAreas.state',
        operator: 'in',
        value: ['FL', 'GA', 'SC', 'NC', 'AL', 'MS', 'TN', 'VA'],
        label: 'Covers a Southeast state',
      },
      {
        field: 'status',
        operator: 'eq',
        value: 'ACTIVE',
        label: 'Account status is ACTIVE',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ── 4. High-Performance Appraiser ─────────────────────────────────────────
  {
    id: 'mcs-high-performance-appraiser-004',
    tenantId: TENANT_ID,
    name: 'High-Performance Appraiser',
    description:
      'Premium appraiser tier: quality score ≥ 4.0 (out of 5), on-time ' +
      'delivery ≥ 85 %, revision rate ≤ 10 %, and active license. ' +
      'Use for complex orders, portfolio reviews, or high-value properties.',
    combinator: 'AND',
    providerTypes: ['APPRAISER'],
    criteria: [
      {
        field: 'performance.qualityScore',
        operator: 'gte',
        value: 4.0,
        label: 'Quality score ≥ 4.0',
      },
      {
        field: 'performance.onTimeDeliveryRate',
        operator: 'gte',
        value: 85,
        label: 'On-time delivery ≥ 85%',
      },
      {
        field: 'performance.revisionRate',
        operator: 'lte',
        value: 10,
        label: 'Revision rate ≤ 10%',
      },
      {
        field: 'licenseExpiry',
        operator: 'not_expired',
        value: null,
        label: 'License not expired',
      },
      {
        field: 'status',
        operator: 'eq',
        value: 'ACTIVE',
        label: 'Account status is ACTIVE',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ── 5. AMC Standard Eligibility ───────────────────────────────────────────
  {
    id: 'mcs-amc-standard-005',
    tenantId: TENANT_ID,
    name: 'AMC Standard Eligibility',
    description:
      'Standard gate for Appraisal Management Companies: active account, ' +
      'unexpired license, and quality score ≥ 3.5.  ' +
      'Suitable for routine residential volume orders.',
    combinator: 'AND',
    providerTypes: ['AMC'],
    criteria: [
      {
        field: 'status',
        operator: 'eq',
        value: 'ACTIVE',
        label: 'Account status is ACTIVE',
      },
      {
        field: 'licenseExpiry',
        operator: 'not_expired',
        value: null,
        label: 'License not expired',
      },
      {
        field: 'performance.qualityScore',
        operator: 'gte',
        value: 3.5,
        label: 'Quality score ≥ 3.5',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ── 6. Inspector Active Certification ─────────────────────────────────────
  {
    id: 'mcs-inspector-active-006',
    tenantId: TENANT_ID,
    name: 'Inspector Active Certification',
    description:
      'Home inspector or inspection company with an active, unexpired ' +
      'certification and ACTIVE account status.  Use for pre-close ' +
      'inspection orders.',
    combinator: 'AND',
    providerTypes: ['INSPECTOR', 'INSPECTION_CO'],
    criteria: [
      {
        field: 'licenseExpiry',
        operator: 'not_expired',
        value: null,
        label: 'Certification not expired',
      },
      {
        field: 'status',
        operator: 'eq',
        value: 'ACTIVE',
        label: 'Account status is ACTIVE',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ── 7. Notary Active — Any State ──────────────────────────────────────────
  {
    id: 'mcs-notary-active-007',
    tenantId: TENANT_ID,
    name: 'Notary Active Credential',
    description:
      'Notary signing agent with active commission and ACTIVE account status. ' +
      'Use for remote online notarization (RON) or closing orders.',
    combinator: 'AND',
    providerTypes: ['NOTARY'],
    criteria: [
      {
        field: 'licenseExpiry',
        operator: 'not_expired',
        value: null,
        label: 'Commission not expired',
      },
      {
        field: 'status',
        operator: 'eq',
        value: 'ACTIVE',
        label: 'Account status is ACTIVE',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ── 8. Texas Coverage ─────────────────────────────────────────────────────
  {
    id: 'mcs-texas-coverage-008',
    tenantId: TENANT_ID,
    name: 'Texas Coverage',
    description:
      'Provider must list Texas (TX) as a covered service area. ' +
      'Use when the subject property is in Texas.',
    combinator: 'AND',
    providerTypes: ['APPRAISER', 'AMC'],
    criteria: [
      {
        field: 'serviceAreas.state',
        operator: 'eq',
        value: 'TX',
        label: 'Covers Texas',
      },
      {
        field: 'status',
        operator: 'eq',
        value: 'ACTIVE',
        label: 'Account status is ACTIVE',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },

  // ── 9. Low Revision Rate — Volume Appraiser ───────────────────────────────
  {
    id: 'mcs-low-revision-rate-009',
    tenantId: TENANT_ID,
    name: 'Low Revision Rate (Volume)',
    description:
      'Appraiser optimised for volume throughput: revision rate ≤ 15 % and ' +
      'on-time delivery ≥ 80 %.  Less strict on quality score than the ' +
      'High-Performance tier, suited for standard residential orders.',
    combinator: 'AND',
    providerTypes: ['APPRAISER'],
    criteria: [
      {
        field: 'performance.revisionRate',
        operator: 'lte',
        value: 15,
        label: 'Revision rate ≤ 15%',
      },
      {
        field: 'performance.onTimeDeliveryRate',
        operator: 'gte',
        value: 80,
        label: 'On-time delivery ≥ 80%',
      },
      {
        field: 'licenseExpiry',
        operator: 'not_expired',
        value: null,
        label: 'License not expired',
      },
      {
        field: 'status',
        operator: 'eq',
        value: 'ACTIVE',
        label: 'Account status is ACTIVE',
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: SEEDED_BY,
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

async function seedCriteriaSets() {
  console.log('🌱 Starting matching criteria sets seed process…');
  console.log(`   Cosmos Endpoint : ${COSMOS_ENDPOINT}`);
  console.log(`   Database        : ${DATABASE_NAME}`);
  console.log(`   Container       : ${CONTAINER_NAME}`);

  const credential = new DefaultAzureCredential();
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
  const container = client.database(DATABASE_NAME).container(CONTAINER_NAME);

  console.log(`\n📦 Upserting ${criteriaSets.length} criteria sets…\n`);

  let succeeded = 0;
  let failed = 0;

  for (const set of criteriaSets) {
    try {
      await container.items.upsert(set);
      const typeLabel = set.providerTypes.length
        ? set.providerTypes.join(', ')
        : 'ALL types';
      console.log(
        `  ✅  ${set.name.padEnd(45)} [${typeLabel}] — ${set.criteria.length} criteria — ${set.id}`
      );
      succeeded++;
    } catch (err) {
      console.error(`  ❌  ${set.id}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Succeeded : ${succeeded}`);
  console.log(`   Failed    : ${failed}`);

  if (failed > 0) {
    throw new Error(`${failed} criteria set(s) failed to seed — see errors above.`);
  }
}

seedCriteriaSets()
  .then(() => {
    console.log('\n✨ Matching criteria sets seeding complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
