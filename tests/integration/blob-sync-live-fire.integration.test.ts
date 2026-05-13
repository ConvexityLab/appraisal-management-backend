/**
 * Blob-Sync Live-Fire Integration Tests
 *
 * End-to-end tests against the deployed staging infrastructure:
 *
 *   1. Happy path — valid PDF blob → Event Grid → Service Bus → BlobSyncWorkerService
 *      → BlobIntakeJobDocument in Cosmos → vendor-event-outbox entry
 *
 *   2. Extension filter — .txt blob is silently skipped; no job document created
 *
 *   3. Path pattern mismatch — flat-path blob (no subClientRef segment) is skipped
 *
 *   4. Idempotency — uploading the same blob a second time produces no duplicate job
 *
 * These tests do NOT start an in-process server. They rely on the BlobSyncWorkerService
 * running inside the deployed staging Container App to consume the Service Bus message
 * and write to Cosmos. We poll Cosmos as the observable signal.
 *
 * ─── Architecture note ───────────────────────────────────────────────────────
 * The Event Grid subscription on the blob-intake storage account stamps a FIXED
 * vendorType application property on every SB message. That value is the
 * `blobIntakeVendorType` Bicep parameter (default: 'internal-blob-intake').
 * The BlobSyncWorkerService looks up a VendorConnection by inboundIdentifier
 * matching that same value. Therefore:
 *
 *   • BLOB_SYNC_VENDOR_TYPE must match the Bicep param `blobIntakeVendorType`
 *     deployed to staging (default: 'internal-blob-intake').
 *   • This test upserts a VendorConnection with that inboundIdentifier, runs
 *     the test, then deletes it. Only one active connection per inboundIdentifier
 *     is allowed — the beforeAll guard fails fast if one already exists.
 *
 * ─── Required environment variables ──────────────────────────────────────────
 *   VITEST_INTEGRATION=true
 *   AZURE_COSMOS_ENDPOINT              — staging Cosmos DB URL
 *   BLOB_INTAKE_STORAGE_ACCOUNT_NAME   — Bicep output of blobIntakeStorage module
 *                                        (e.g. 'apprblinstaxxxxxx')
 *   AZURE_SERVICE_BUS_NAMESPACE        — staging SB namespace hostname
 *   BLOB_SYNC_VENDOR_TYPE              — (optional) matches staging blobIntakeVendorType
 *                                        default: 'internal-blob-intake'
 *   BLOB_SYNC_LIVE_FIRE_TENANT_ID      — (optional) Cosmos tenantId partition key
 *                                        for the seeded connection; default: 'lf-staging'
 *   BLOB_SYNC_LIVE_FIRE_LENDER_ID      — (optional) identifying lenderId for the
 *                                        seeded connection; default: 'lf-staging-lender'
 *
 * ─── RBAC required on the machine / service principal running this test ──────
 *   • Storage Blob Data Contributor on the `received` container of the intake account
 *   • Cosmos DB Built-in Data Contributor on the staging Cosmos account
 *
 * ─── Run command ────────────────────────────────────────────────────────────
 *   VITEST_INTEGRATION=true \
 *   AZURE_COSMOS_ENDPOINT=https://cosmos-appraisal-staging-xxx.documents.azure.com:443 \
 *   BLOB_INTAKE_STORAGE_ACCOUNT_NAME=apprblinstaxxxxxx \
 *   AZURE_SERVICE_BUS_NAMESPACE=sb-appraisal-staging-xxx.servicebus.windows.net \
 *   pnpm vitest run tests/integration/blob-sync-live-fire.integration.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { CosmosDbService } from '../../src/services/cosmos-db.service.js';
import type {
  BlobIntakeJobDocument,
  VendorConnection,
  VendorOutboxDocument,
  VendorFileReceivedPayload,
} from '../../src/types/vendor-integration.types.js';

// ─── Guard: skip unless all required env vars are present ────────────────────
const RUN =
  process.env.VITEST_INTEGRATION === 'true' &&
  !!process.env.AZURE_COSMOS_ENDPOINT &&
  !!process.env.BLOB_INTAKE_STORAGE_ACCOUNT_NAME;

const STORAGE_ACCOUNT_NAME = process.env.BLOB_INTAKE_STORAGE_ACCOUNT_NAME ?? '';
const RECEIVED_CONTAINER = 'received';

// ─── Test configuration (configurable via env, with safe staging defaults) ───
//
// BLOB_SYNC_VENDOR_TYPE must match the `blobIntakeVendorType` Bicep param deployed
// to the target environment. Event Grid stamps this value on every SB message from
// the intake account. The VendorConnection inboundIdentifier must equal this value.
const VENDOR_TYPE = process.env.BLOB_SYNC_VENDOR_TYPE ?? 'internal-blob-intake';

// Tenant + lender IDs used for the seeded VendorConnection. These partition the
// Cosmos query space from real data.
const TENANT_ID = process.env.BLOB_SYNC_LIVE_FIRE_TENANT_ID ?? 'lf-staging';
const CLIENT_ID = process.env.BLOB_SYNC_LIVE_FIRE_LENDER_ID ?? 'lf-staging-lender';

// Fixed doc ID — upsert semantics keep only one live-fire connection at a time.
const VENDOR_CONNECTION_DOC_ID = `vc-blob-sync-live-fire`;

const TASK_TYPE = 'live-fire-test';
const BLOB_PATH_PATTERN = '{year}/{month}/{day}/{subClientRef}/{filename}';

// ─── Per-run blob path uniqueness ────────────────────────────────────────────
// RUN_ID is embedded in blob paths so parallel runs or reruns don't collide
// on job documents. The VendorConnection itself is shared (fixed doc ID).
const RUN_ID = Date.now();
const now = new Date();
const Y = now.getUTCFullYear().toString();
const M = String(now.getUTCMonth() + 1).padStart(2, '0');
const D = String(now.getUTCDate()).padStart(2, '0');
const SUB_CLIENT_ID = `loan-lf-${RUN_ID}`;

const VALID_BLOB_PATH = `${Y}/${M}/${D}/${SUB_CLIENT_ID}/test-appraisal-lf-${RUN_ID}.pdf`;
const WRONG_EXT_BLOB_PATH = `${Y}/${M}/${D}/${SUB_CLIENT_ID}/test-notes-lf-${RUN_ID}.txt`;
const FLAT_BLOB_PATH = `flat-test-lf-${RUN_ID}.pdf`;    // no subClientRef — pattern mismatch

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Poll until `predicate` returns truthy or `timeoutMs` expires.
 * Returns true if condition was met; false on timeout.
 */
async function pollUntil<T>(
  fn: () => Promise<T | null | undefined>,
  predicate: (v: T) => boolean,
  { intervalMs = 5_000, timeoutMs = 120_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result !== null && result !== undefined && predicate(result)) return result;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * Upload a blob to the `received` container of the intake storage account.
 */
async function uploadTestBlob(blobPath: string, content: string): Promise<string> {
  const blobServiceClient = new BlobServiceClient(
    `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  );
  const containerClient = blobServiceClient.getContainerClient(RECEIVED_CONTAINER);
  const blobClient = containerClient.getBlockBlobClient(blobPath);
  const data = Buffer.from(content, 'utf-8');
  const blobResult = await blobClient.upload(data, data.length, {
    blobHTTPHeaders: { blobContentType: 'application/octet-stream' },
  });
  return blobResult.etag ?? '';
}

/**
 * Delete a test blob from the `received` container (best-effort cleanup).
 */
async function deleteTestBlob(blobPath: string): Promise<void> {
  const blobServiceClient = new BlobServiceClient(
    `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  );
  const containerClient = blobServiceClient.getContainerClient(RECEIVED_CONTAINER);
  await containerClient.getBlockBlobClient(blobPath).deleteIfExists();
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe.skipIf(!RUN)('Blob-sync live-fire — full pipeline (staging)', () => {
  let db: CosmosDbService;
  let vendorConnectionId: string;
  let uploadedEtag = '';

  // IDs of Cosmos docs we create so afterAll can clean them up
  const cosmosCleanupQueue: Array<{ container: string; id: string; partitionKey: string }> = [];

  // ── Setup ────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    db = new CosmosDbService();

    // Guard: if another ACTIVE VendorConnection with this inboundIdentifier already
    // exists and is NOT our fixed live-fire doc, fail fast. BlobSyncWorkerService
    // throws when it finds multiple active connections for the same inboundIdentifier.
    const existingCheck = await db.queryItems<VendorConnection>(
      'vendor-connections',
      `SELECT c.id FROM c
       WHERE c.inboundIdentifier = @inboundIdentifier
         AND c.active = true
         AND c.tenantId = @tenantId`,
      [
        { name: '@inboundIdentifier', value: VENDOR_TYPE },
        { name: '@tenantId', value: TENANT_ID },
      ],
    );
    const conflicting = (existingCheck.data ?? []).filter(c => c.id !== VENDOR_CONNECTION_DOC_ID);
    if (conflicting.length > 0) {
      throw new Error(
        `❌ Found ${conflicting.length} unexpected active VendorConnection(s) with ` +
        `inboundIdentifier='${VENDOR_TYPE}' — IDs: ${conflicting.map(c => c.id).join(', ')}.\n` +
        `Deactivate or delete them before running the live-fire suite.`,
      );
    }

    // Upsert the live-fire VendorConnection. Fixed doc ID — idempotent across retries.
    vendorConnectionId = VENDOR_CONNECTION_DOC_ID;
    const connection: VendorConnection = {
      id: vendorConnectionId,
      tenantId: TENANT_ID,
      type: 'vendor-connection',
      vendorType: VENDOR_TYPE,
      lenderId: CLIENT_ID,
      lenderName: 'Blob-Sync Live Fire [staging]',
      inboundIdentifier: VENDOR_TYPE,
      credentials: {},
      outboundEndpointUrl: 'https://noop.example.com',
      active: true,
      blobConfig: {
        storageAccountName: STORAGE_ACCOUNT_NAME,
        receivedContainerName: RECEIVED_CONTAINER,
        blobPathPattern: BLOB_PATH_PATTERN,
        taskType: TASK_TYPE,
        acceptedExtensions: ['.pdf'],
        maxRetries: 3,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const seedResult = await db.upsertItem<VendorConnection>('vendor-connections', connection);
    if (!seedResult.success) {
      throw new Error(`Failed to seed VendorConnection: ${JSON.stringify(seedResult.error)}`);
    }
    cosmosCleanupQueue.push({ container: 'vendor-connections', id: vendorConnectionId, partitionKey: TENANT_ID });
    console.log(`✅ VendorConnection upserted: ${vendorConnectionId} (inboundIdentifier=${VENDOR_TYPE})`);
    console.log(`   TENANT_ID        : ${TENANT_ID}`);
    console.log(`   STORAGE_ACCOUNT  : ${STORAGE_ACCOUNT_NAME}`);
    console.log(`   RUN_ID           : ${RUN_ID}`);
  }, 60_000);

  afterAll(async () => {
    // Remove all Cosmos docs we created during this run.
    for (const item of cosmosCleanupQueue) {
      await (db as any).deleteItem(item.container, item.id, item.partitionKey)
        .catch((e: unknown) => {
          console.warn(`⚠️  Could not delete ${item.container}/${item.id}: ${String(e)}`);
        });
    }
    console.log(`🧹 Cleaned up ${cosmosCleanupQueue.length} Cosmos documents`);

    // Remove test blobs (best-effort — staging storage is cheap, but keep it tidy).
    await Promise.allSettled([
      deleteTestBlob(VALID_BLOB_PATH),
      deleteTestBlob(WRONG_EXT_BLOB_PATH),
      deleteTestBlob(FLAT_BLOB_PATH),
    ]);
    console.log('🧹 Cleaned up test blobs');
  }, 60_000);

  // ── Test 1: Happy path ────────────────────────────────────────────────────
  describe('Happy path — valid PDF blob end-to-end', () => {
    it('uploads a PDF to the received container without error', async () => {
      uploadedEtag = await uploadTestBlob(
        VALID_BLOB_PATH,
        `%PDF-1.4 live-fire test blob — run ${RUN_ID}`,
      );
      expect(uploadedEtag).toBeTruthy();
      console.log(`📤 Uploaded: ${VALID_BLOB_PATH} (etag=${uploadedEtag})`);
    }, 30_000);

    it(
      'creates a BlobIntakeJobDocument in Cosmos within 3 minutes (Event Grid → SB → worker)',
      async () => {
        // The SHA-256 file ID is computed inside the adapter; we query by blobPath + connectionId
        // rather than trying to recompute the exact hash here.
        const job = await pollUntil<BlobIntakeJobDocument>(
          async () => {
            const res = await db.queryItems<BlobIntakeJobDocument>(
              'blob-intake-jobs',
              `SELECT * FROM c WHERE c.type = 'blob-intake-job'
               AND c.connectionId = @connectionId
               AND c.blobPath = @blobPath`,
              [
                { name: '@connectionId', value: vendorConnectionId },
                { name: '@blobPath', value: VALID_BLOB_PATH },
              ],
            );
            return res.data?.[0] ?? null;
          },
          (doc) => !!doc.id,
          { intervalMs: 8_000, timeoutMs: 180_000 },
        );

        if (!job) {
          throw new Error(
            `Timed out waiting for BlobIntakeJobDocument.\n` +
            `  blobPath: ${VALID_BLOB_PATH}\n` +
            `  connectionId: ${vendorConnectionId}\n` +
            `  Check: (1) blobIntakeVendorType in staging Bicep params matches ${VENDOR_TYPE},\n` +
            `         (2) staging BlobSyncWorkerService is running,\n` +
            `         (3) Event Grid subscription is active (not dev env).`,
          );
        }

        console.log(`✅ BlobIntakeJobDocument created: ${job.id} (status=${job.status})`);

        // Register for cleanup
        cosmosCleanupQueue.push({ container: 'blob-intake-jobs', id: job.id, partitionKey: job.tenantId });

        // ── Structural assertions ──────────────────────────────────────────
        expect(job.type).toBe('blob-intake-job');
        expect(job.connectionId).toBe(vendorConnectionId);
        expect(job.storageAccountName).toBe(STORAGE_ACCOUNT_NAME);
        expect(job.containerName).toBe(RECEIVED_CONTAINER);
        expect(job.blobPath).toBe(VALID_BLOB_PATH);
        expect(job.filename).toBe(`test-appraisal-lf-${RUN_ID}.pdf`);
        expect(job.subClientId).toBe(SUB_CLIENT_ID);
        expect(job.taskType).toBe(TASK_TYPE);
        expect(job.clientId).toBe(CLIENT_ID);
        expect(job.syncRunId).toBe('blob-created');
        expect(['received', 'queued', 'processing', 'complete']).toContain(job.status);
      },
      210_000,
    );

    it('writes a vendor.file.received event to vendor-event-outbox', async () => {
      // The outbox ID is keyed as 'vendor-outbox:{eventId}'. We query by tenantId + eventType.
      const outbox = await pollUntil<VendorOutboxDocument>(
        async () => {
          const res = await db.queryItems<VendorOutboxDocument>(
            'vendor-event-outbox',
            `SELECT * FROM c
             WHERE c.tenantId = @tenantId
               AND c.eventType = 'vendor.file.received'
               AND c.lenderId = @lenderId`,
            [
              { name: '@tenantId', value: TENANT_ID },
              { name: '@lenderId', value: CLIENT_ID },
            ],
          );
          return res.data?.[0] ?? null;
        },
        (doc) => !!doc.id,
        { intervalMs: 5_000, timeoutMs: 60_000 },
      );

      if (!outbox) {
        throw new Error(
          `Timed out waiting for vendor-event-outbox entry.\n` +
          `  tenantId: ${TENANT_ID}\n` +
          `  Expected eventType: vendor.file.received`,
        );
      }

      console.log(`✅ vendor-event-outbox entry: ${outbox.id} (eventType=${outbox.eventType})`);
      cosmosCleanupQueue.push({ container: 'vendor-event-outbox', id: outbox.id, partitionKey: outbox.tenantId });

      expect(outbox.eventType).toBe('vendor.file.received');
      expect(outbox.tenantId).toBe(TENANT_ID);
      expect(outbox.lenderId).toBe(CLIENT_ID);
      // fileRefs populated (not inline base64) — blob-drop path
      const fileReceivedPayload = outbox.payload as VendorFileReceivedPayload;
      expect(fileReceivedPayload.fileRefs).toHaveLength(1);
      const ref = fileReceivedPayload.fileRefs![0];
      expect(ref.storageAccountName).toBe(STORAGE_ACCOUNT_NAME);
      expect(ref.containerName).toBe(RECEIVED_CONTAINER);
      expect(ref.blobPath).toBe(VALID_BLOB_PATH);
      expect(ref.subClientId).toBe(SUB_CLIENT_ID);
      expect(ref.taskType).toBe(TASK_TYPE);
    }, 90_000);
  });

  // ── Test 2: Extension filter ──────────────────────────────────────────────
  describe('Extension filter — .txt blob is silently skipped', () => {
    it('uploads a .txt blob without error', async () => {
      const etag = await uploadTestBlob(
        WRONG_EXT_BLOB_PATH,
        `plain text — should be filtered out by acceptedExtensions`,
      );
      expect(etag).toBeTruthy();
      console.log(`📤 Uploaded (wrong ext): ${WRONG_EXT_BLOB_PATH}`);
    }, 30_000);

    it('does NOT create a BlobIntakeJobDocument for the .txt blob within 90 seconds', async () => {
      // Wait long enough for any legitimate processing to have happened.
      await new Promise(r => setTimeout(r, 90_000));

      const res = await db.queryItems<BlobIntakeJobDocument>(
        'blob-intake-jobs',
        `SELECT * FROM c WHERE c.type = 'blob-intake-job'
         AND c.connectionId = @connectionId
         AND c.blobPath = @blobPath`,
        [
          { name: '@connectionId', value: vendorConnectionId },
          { name: '@blobPath', value: WRONG_EXT_BLOB_PATH },
        ],
      );

      expect(res.data ?? []).toHaveLength(0);
      console.log('✅ No job document created for .txt blob — extension filter working');
    }, 110_000);
  });

  // ── Test 3: Path pattern mismatch ────────────────────────────────────────
  describe('Path pattern mismatch — flat-path blob is skipped', () => {
    it('uploads a flat-path blob without error', async () => {
      const etag = await uploadTestBlob(
        FLAT_BLOB_PATH,
        `%PDF-1.4 flat path — should be filtered (pattern mismatch)`,
      );
      expect(etag).toBeTruthy();
      console.log(`📤 Uploaded (flat path): ${FLAT_BLOB_PATH}`);
    }, 30_000);

    it('does NOT create a BlobIntakeJobDocument for the flat-path blob within 90 seconds', async () => {
      await new Promise(r => setTimeout(r, 90_000));

      const res = await db.queryItems<BlobIntakeJobDocument>(
        'blob-intake-jobs',
        `SELECT * FROM c WHERE c.type = 'blob-intake-job'
         AND c.connectionId = @connectionId
         AND c.blobPath = @blobPath`,
        [
          { name: '@connectionId', value: vendorConnectionId },
          { name: '@blobPath', value: FLAT_BLOB_PATH },
        ],
      );

      expect(res.data ?? []).toHaveLength(0);
      console.log('✅ No job document created for flat-path blob — pattern filter working');
    }, 110_000);
  });

  // ── Test 4: Idempotency ───────────────────────────────────────────────────
  describe('Idempotency — uploading the same blob twice produces one job document', () => {
    it('re-uploads the valid PDF blob (same path, new content triggers new etag)', async () => {
      // Upload the same path with different content → new eTag → new Event Grid event.
      // The adapter checks SHA-256(storageAccount+container+blobPath+eTag) for idempotency.
      // A different eTag = a new logical file version = a new job is expected.
      // We upload the EXACT same content to verify within-run dedup.
      const etag = await uploadTestBlob(
        VALID_BLOB_PATH,
        `%PDF-1.4 live-fire test blob — run ${RUN_ID}`,  // identical content → same eTag on same blob
      );
      expect(etag).toBeTruthy();
      console.log(`📤 Re-uploaded same blob: etag=${etag}`);
    }, 30_000);

    it('produces no more than one job document for the same content hash within 60 seconds', async () => {
      await new Promise(r => setTimeout(r, 60_000));

      const res = await db.queryItems<BlobIntakeJobDocument>(
        'blob-intake-jobs',
        `SELECT * FROM c WHERE c.type = 'blob-intake-job'
         AND c.connectionId = @connectionId
         AND c.blobPath = @blobPath`,
        [
          { name: '@connectionId', value: vendorConnectionId },
          { name: '@blobPath', value: VALID_BLOB_PATH },
        ],
      );

      const jobs = res.data ?? [];
      // The same eTag produces the same SHA-256 file ID — upsert semantics give us
      // exactly one document regardless of how many messages arrived.
      expect(jobs.length).toBeLessThanOrEqual(1);
      console.log(`✅ Idempotency confirmed: ${jobs.length} job document(s) for identical upload`);
    }, 80_000);
  });
}, 600_000); // 10-minute outer timeout for the full suite
