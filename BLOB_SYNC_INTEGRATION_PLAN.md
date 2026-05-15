# Blob-Sync Integration — Design & Progress Tracker

**Status:** In Planning  
**Last Updated:** 2026-05-12  
**Owner:** Backend Platform Team

---

## Objective

Provide a universal, client-agnostic framework for any external party (lender,
data partner, GSE, servicer, etc.) to deliver files and data to the platform by
dropping them in Azure Blob Storage — via Azure Data Share, direct RBAC grant, or
Object Replication — without requiring HTTP push endpoints or custom per-client
code.

Adding a new client = one new `VendorConnection` document in Cosmos + one new
Event Grid subscription in Bicep. Zero application code changes.

---

## Identity Model

Every blob-drop event and every intake job carries four identity dimensions:

| Field | Source | Description |
|---|---|---|
| `tenantId` | `VendorConnection.tenantId` | Platform tenant (the lender using our platform) |
| `clientId` | `VendorConnection.inboundIdentifier` | External party dropping files (e.g. `"ellington"`, `"freddie-mac"`) |
| `subClientId` | Parsed from blob path via `{subClientRef}` token | Sub-division within a client: fund, branch, loan pool, portfolio. Allows one connection to serve many subdivisions. |
| `taskType` | `VendorConnectionBlobConfig.taskType` | Which processing pipeline consumes these files. Becomes the Service Bus routing key downstream. |

### `taskType` values (open-ended, config-driven)

| Value | Intended pipeline |
|---|---|
| `"underwriting-review"` | PDF extraction + underwriting scoring (Axiom pipeline) |
| `"appraisal-extraction"` | Appraisal form parsing + canonical schema mapping |
| `"pool-tape-ingestion"` | Loan pool tape CSV/XLSX → structured records |
| `"document-indexing"` | Generic document intake + OCR + metadata indexing |
| `"comparable-import"` | Comparable sales data ingestion |

New `taskType` values require no code change — they are string values on the
connection config that downstream Service Bus subscribers filter on.

---

## Data Flow

```
External party drops file(s) in Azure Blob Storage
             │
             │  (Azure Data Share sync  OR  BlobCreated event)
             ▼
Event Grid fires → stamps vendorType as custom delivery property
             │
             ▼
Service Bus queue: blob-sync-events  (single fan-in, all clients)
             │
             ▼
BlobSyncWorkerService.receiver.subscribe()  ← streaming push, no poll loop
             │
             ├── resolves VendorConnection by vendorType
             ├── reads blobConfig (taskType, containers, pathPattern, etc.)
             ├── routes to correct BlobSyncAdapter implementation
             │
             ▼
BlobSyncAdapter.processSync()
             │
             ├── enumerates blobs since last SyncCursor (Data Share flavor)
             │   OR processes single blob (BlobCreated flavor)
             │
             ├── parses blob path → extracts subClientId via {subClientRef} token
             │
             ├── SHA-256 idempotency check → BlobIntakeJobDocument in Cosmos
             │
             └── for each new/changed blob:
                   emits vendor.file.received with VendorFileRef
                   writes to vendor-event-outbox (PENDING)
                   advances BlobSyncCursorDocument
             │
             ▼
VendorEventOutboxService  (existing, unchanged)
             │
             ▼
VendorOutboxWorkerService  (existing, unchanged — poll loop)
             │
             ▼
Service Bus topic → downstream consumers filter on:
  - event.vendorType  (which client)
  - event.taskType    (which pipeline)
  - event.tenantId    (which tenant)
```

---

## New Types

### `VendorConnectionBlobConfig`

```typescript
export interface VendorConnectionBlobConfig {
  /** Azure Storage account name (platform-controlled) where synced blobs land */
  storageAccountName: string;
  /** Container name where incoming files arrive */
  receivedContainerName: string;
  /** Optional container for writing results back to client */
  resultsContainerName?: string;
  /**
   * Blob path pattern with named tokens.
   * Supported tokens: {year} {month} {day} {subClientRef} {filename}
   * Example: "{year}/{month}/{day}/{subClientRef}/{filename}"
   *
   * The {subClientRef} token becomes subClientId on every event and job.
   * It represents a sub-division of the client: a loan ID, fund name,
   * portfolio ID, etc. If the client has no sub-division concept, use a
   * fixed literal in the pattern (e.g. "all/{year}/{month}/{day}/{filename}").
   */
  blobPathPattern: string;
  /**
   * The processing pipeline that should handle these files.
   * Becomes taskType on VendorDomainEvent — Service Bus subscribers filter on it.
   * Examples: "underwriting-review" | "pool-tape-ingestion" | "appraisal-extraction"
   */
  taskType: string;
  /** File extensions to process. Others are silently skipped. Default: [".pdf"] */
  acceptedExtensions: string[];
  /** Max retries before a BlobIntakeJobDocument is dead-lettered. Default: 3 */
  maxRetries?: number;
  /**
   * Optional webhook URL to notify client when processing of a subClientRef batch
   * completes. If absent, client must poll the status API.
   */
  completionWebhookUrl?: string;
}
```

### `VendorFileRef` (blob-path reference, replaces inline base64 for large files)

```typescript
export interface VendorFileRef {
  /** SHA-256(storageAccountName + containerName + blobPath + eTag) */
  fileId: string;
  filename: string;
  /** Inferred from extension or path convention */
  category: string;
  storageAccountName: string;
  containerName: string;
  blobPath: string;
  eTag: string;
  contentLengthBytes?: number;
  /** The parsed {subClientRef} token from the blob path — e.g. loan ID, fund ID */
  subClientId: string;
  /** Task type from the connection config — routing key for downstream pipelines */
  taskType: string;
}
```

### `VendorFileReceivedPayload` (extended)

```typescript
// Exactly one of files or fileRefs will be populated, never both.
export interface VendorFileReceivedPayload {
  /** Inline base64 content — HTTP path (AIM-Port, Class Valuation, etc.) */
  files?: VendorFile[];
  /** Blob storage references — blob-drop path (large files, Data Share clients) */
  fileRefs?: VendorFileRef[];
}
```

### `BlobSyncMessage` (deserialized from Service Bus)

```typescript
export interface BlobSyncMessage {
  /** Stamped by Event Grid subscription advanced filter — routes to VendorConnection */
  vendorType: string;
  /** Service Bus message ID — used for idempotency at the message level */
  messageId: string;
  /** Discriminates between Data Share sync completion and single-blob arrival */
  flavor: 'data-share-sync' | 'blob-created';
  // data-share-sync fields
  syncRunId?: string;
  syncEndTime?: string;     // ISO-8601; blobs modified BEFORE this are from this sync
  syncStatus?: string;      // "Succeeded" | "Failed" | "Canceled"
  // blob-created fields
  blobUrl?: string;
  eTag?: string;
  contentLengthBytes?: number;
}
```

### `BlobIntakeJobDocument` (Cosmos, container: `blob-intake-jobs`)

```typescript
export interface BlobIntakeJobDocument {
  /** SHA-256(storageAccountName + containerName + blobPath + eTag) */
  id: string;
  /** Partition key */
  tenantId: string;
  type: 'blob-intake-job';
  /** Platform tenant */
  tenantId: string;
  /** External party — VendorConnection.inboundIdentifier */
  clientId: string;
  /** Sub-division within client: loan ID, fund name, portfolio ID, etc. */
  subClientId: string;
  /** Which processing pipeline — from VendorConnectionBlobConfig.taskType */
  taskType: string;
  /** VendorConnection.id — so we can always trace back to config */
  connectionId: string;
  blobPath: string;
  storageAccountName: string;
  containerName: string;
  eTag: string;
  contentLengthBytes?: number;
  filename: string;
  /** The sync run that brought this blob in (Data Share) or 'blob-created' */
  syncRunId: string;
  status: 'received' | 'queued' | 'processing' | 'complete' | 'failed' | 'dead-lettered';
  retryCount: number;
  receivedAt: string;       // ISO-8601
  completedAt?: string;
  resultPaths?: {
    json?: string;
    xlsx?: string;
    csv?: string;
  };
  lastError?: string;
}
```

### `BlobSyncCursorDocument` (Cosmos, container: `blob-intake-jobs`)

```typescript
export interface BlobSyncCursorDocument {
  /** "cursor:{connectionId}" */
  id: string;
  /** tenantId — same partition key as BlobIntakeJobDocument */
  tenantId: string;
  type: 'blob-sync-cursor';
  connectionId: string;
  clientId: string;
  lastSyncRunId: string;
  /** Blobs with lastModified BEFORE this timestamp are skipped in next enumeration */
  lastSyncCompletedAt: string;  // ISO-8601
}
```

### `BlobSyncAdapter` interface

```typescript
export interface BlobSyncAdapterContext {
  blobClient: VendorBlobStorageClient;
  db: CosmosDbService;
  outboxService: VendorEventOutboxService;
}

export interface BlobSyncResult {
  blobsEnumerated: number;
  jobsCreated: number;
  jobsSkipped: number;    // already processed (idempotent)
  jobsRequeued: number;   // previously failed, re-queued for retry
}

export interface BlobSyncAdapter {
  readonly supportedFlavor: 'data-share-sync' | 'blob-created';
  canHandle(message: BlobSyncMessage, connection: VendorConnection): boolean;
  processSync(
    message: BlobSyncMessage,
    connection: VendorConnection,
    context: BlobSyncAdapterContext,
  ): Promise<BlobSyncResult>;
}
```

---

## `VendorDomainEvent` extension

The existing `VendorDomainEvent` gains two fields (both optional so existing events
are unaffected):

```typescript
export interface VendorDomainEvent {
  // ... existing fields ...
  /** Sub-division of the client: loan ID, fund, portfolio. Populated for blob-drop events. */
  subClientId?: string;
  /** Processing pipeline routing key. Populated for blob-drop events. */
  taskType?: string;
}
```

Downstream Service Bus consumers that handle blob events filter on both:
```sql
vendorType = 'ellington' AND taskType = 'underwriting-review'
```

---

## New Files

| File | Status | Notes |
|---|---|---|
| `src/types/vendor-integration.types.ts` | ✅ Complete | Add `VendorConnectionBlobConfig`, `VendorFileRef`, extend `VendorFileReceivedPayload`, extend `VendorDomainEvent`, add `BlobIntakeJobDocument`, `BlobSyncCursorDocument`, `InboundTransport` value |
| `src/services/vendor-integrations/BlobSyncAdapter.ts` | ✅ Complete | Interface + context types + `BlobSyncMessage` |
| `src/services/vendor-integrations/VendorBlobStorageClient.ts` | ✅ Complete | `@azure/storage-blob` + `DefaultAzureCredential` wrapper |
| `src/services/vendor-integrations/DataShareBlobSyncAdapter.ts` | ✅ Complete | `data-share-sync` flavor: enumerate delta since cursor, idempotency, cursor advance |
| `src/services/vendor-integrations/BlobCreatedBlobSyncAdapter.ts` | ✅ Complete | `blob-created` flavor: single-blob path from event |
| `src/services/vendor-integrations/BlobSyncWorkerService.ts` | ✅ Complete | Service Bus streaming subscriber; routes by vendorType; no poll loop |
| `tests/unit/data-share-blob-sync-adapter.test.ts` | ✅ Complete (15 tests) | |
| `tests/unit/blob-created-blob-sync-adapter.test.ts` | ✅ Complete (12 tests) | |
| `tests/unit/blob-sync-worker-service.test.ts` | ✅ Complete (11 tests) | |

---

## Modified Files

| File | Status | Change summary |
|---|---|---|
| `src/types/vendor-integration.types.ts` | ✅ Complete | See new types above |
| `src/api/api-server.ts` | ✅ Complete | Start `BlobSyncWorkerService` alongside existing workers |
| `infrastructure/modules/blob-sync-integration.bicep` | ⬜ Not started | Shared queue + Event Grid topic + Cosmos container + per-client parameterized subscriptions |
| `infrastructure/main.bicep` | ⬜ Not started | Wire in new module |

---

## Implementation Order

1. **Types** — `vendor-integration.types.ts` extensions (no deps, foundation for everything)
2. **`BlobSyncAdapter.ts`** — interface file (no deps beyond types)
3. **`VendorBlobStorageClient.ts`** — storage wrapper (no deps beyond Azure SDK)
4. **`DataShareBlobSyncAdapter.ts`** + tests
5. **`BlobCreatedBlobSyncAdapter.ts`** + tests
6. **`BlobSyncWorkerService.ts`** + tests
7. **`api-server.ts`** wiring
8. **Bicep module**

---

## Environment Variables Required (new)

```bash
# Service Bus (Managed Identity — existing namespace, new queue)
BLOB_SYNC_SERVICE_BUS_QUEUE=blob-sync-events

# Storage (Managed Identity — resolved per-connection from VendorConnectionBlobConfig)
# No fixed env vars — all storage account names come from the connection config
```

No new secrets. All Azure SDK clients use `DefaultAzureCredential`.

---

## Onboarding a New Blob-Drop Client (no code changes needed)

1. **Create `VendorConnection` in Cosmos** with:
   - `vendorType`: client identifier string
   - `inboundIdentifier`: same as `vendorType` (used to look up connection from SB message)
   - `blobConfig.taskType`: which pipeline
   - `blobConfig.blobPathPattern`: path convention the client follows
   - `blobConfig.receivedContainerName`: where files land
   - `blobConfig.acceptedExtensions`: e.g. `[".pdf"]`

2. **Provision received blob container** (Bicep: `blob-sync-integration.bicep` per-client params)

3. **Add Event Grid subscription** pointing at `blob-sync-events` queue, with advanced filter stamping `vendorType = '<their-value>'` as a delivery property

4. **Share infrastructure details with client** (storage account + container name, or Data Share invitation)

5. **Smoke test**: client drops a file → verify `BlobIntakeJobDocument` created in Cosmos with `status='queued'`, `vendor.file.received` event appears in `vendor-event-outbox`

---

## Open Questions

| # | Question | Decision |
|---|---|---|
| 1 | Should `taskType` be a closed enum or an open string? | Open string — config-driven, no redeploy for new pipelines |
| 2 | Should `subClientId` be mandatory in `blobPathPattern`? | Yes — if client has no subdivision, they use a fixed literal token |
| 3 | Results write-back: blob only, or also webhook notification? | Both supported — `completionWebhookUrl` optional on `blobConfig` |
| 4 | Network isolation: Private Endpoint on blob storage for prod? | Out of scope for Phase 1 |
| 5 | Should `BlobSyncWorkerService` be a separate Container App or co-located? | Co-located for now; extract if throughput demands it |
