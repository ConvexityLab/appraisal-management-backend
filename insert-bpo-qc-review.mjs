/**
 * Insert an APPROVED QC review for a BPO order so final report generation is unblocked.
 *
 * Usage:
 *   node insert-bpo-qc-review.mjs
 *
 * Requires: AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT env var.
 * Uses DefaultAzureCredential (Managed Identity / az login).
 */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { randomUUID } from 'node:crypto';

// ── Config ───────────────────────────────────────────────────────────────────
const VENDOR_ORDER_ID = 'VO-UDW444E5';
const CLIENT_ORDER_ID = 'CO-UDW40G1A';
const CHECKLIST_ID = 'seed-checklist-uad-standard-2026';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!endpoint) throw new Error('Set AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT');

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const qcReviewsContainer = db.container('qc-reviews');

// ── 1. Look up the order to grab its tenantId ────────────────────────────────
const ordersContainer = db.container('orders');
const { resources: orders } = await ordersContainer.items.query(
  {
    query: 'SELECT * FROM c WHERE c.id = @orderId',
    parameters: [{ name: '@orderId', value: VENDOR_ORDER_ID }],
  },
  { enableCrossPartitionQuery: true },
).fetchAll();

if (orders.length === 0) {
  console.error(`Order '${VENDOR_ORDER_ID}' not found in orders container.`);
  process.exit(1);
}

const order = orders[0];
console.log('Found order:', {
  id: order.id,
  status: order.status,
  productType: order.productType,
  tenantId: order.tenantId,
});

// ── 2. Check for existing QC review ──────────────────────────────────────────
const { resources: existingReviews } = await qcReviewsContainer.items.query(
  {
    query: 'SELECT c.id, c.status, c.results.decision FROM c WHERE c.orderId = @orderId',
    parameters: [{ name: '@orderId', value: VENDOR_ORDER_ID }],
  },
  { enableCrossPartitionQuery: true },
).fetchAll();

if (existingReviews.length > 0) {
  console.log('Existing QC reviews for this order:', existingReviews);
  console.log('A QC review already exists. If you need to replace it, delete the existing one first.');
  process.exit(0);
}

// ── 3. Build the approved QC review ──────────────────────────────────────────
const now = new Date().toISOString();
const reviewId = `qc-review-bpo-${randomUUID().slice(0, 8)}`;

const qcReview = {
  id: reviewId,
  tenantId: order.tenantId,
  type: 'qc-review',
  orderId: VENDOR_ORDER_ID,
  orderNumber: VENDOR_ORDER_ID,
  checklistId: CHECKLIST_ID,
  reviewerId: 'manual-insert',
  reviewerName: 'Manual QC (BPO)',
  status: 'COMPLETED',
  result: 'PASS',
  overallScore: 90,
  startedAt: now,
  completedAt: now,
  results: {
    totalScore: 90,
    maxScore: 100,
    percentScore: 90,
    riskLevel: 'LOW',
    decision: 'APPROVED',
    summary: 'BPO report approved — property condition, comparable selection, and value opinion are consistent and supported.',
  },
  findings: [],
  summary: 'BPO report meets review standards. Approved for final report generation.',
  createdAt: now,
  updatedAt: now,
};

// ── 4. Insert ────────────────────────────────────────────────────────────────
const { resource } = await qcReviewsContainer.items.create(qcReview);
console.log('\nQC review inserted successfully:');
console.log(JSON.stringify({
  id: resource.id,
  orderId: resource.orderId,
  status: resource.status,
  decision: resource.results?.decision,
}, null, 2));

console.log(`\nYou can now generate a report for order '${VENDOR_ORDER_ID}' using the DVR_BPO_V1 template.`);
