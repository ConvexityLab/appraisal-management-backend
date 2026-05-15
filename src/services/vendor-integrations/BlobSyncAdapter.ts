/**
 * Blob-Sync Integration — Adapter Interface
 *
 * Defines the contract that every blob-drop flavor adapter must implement.
 * Two built-in implementations:
 *   - DataShareBlobSyncAdapter  → 'data-share-sync' (Azure Data Share completion events)
 *   - BlobCreatedBlobSyncAdapter → 'blob-created'   (direct BlobCreated Event Grid events)
 *
 * Adding a new transport flavor = implementing BlobSyncAdapter and registering it
 * in BlobSyncWorkerService. No changes to the worker or types required.
 */

import type { CosmosDbService } from '../cosmos-db.service.js';
import type { VendorEventOutboxService } from './VendorEventOutboxService.js';
import type { VendorConnection } from '../../types/vendor-integration.types.js';
import type { VendorBlobStorageClient } from './VendorBlobStorageClient.js';

// ─── Message Shape ────────────────────────────────────────────────────────────
// Deserialized from the Service Bus message body. The `vendorType` property is
// stamped as a custom delivery property by the Event Grid subscription's advanced
// filter — it is NOT set by the external client.

export type BlobSyncFlavor = 'data-share-sync' | 'blob-created';

export interface BlobSyncMessage {
  /**
   * Stamped by Event Grid subscription advanced filter.
   * Used to look up the VendorConnection in Cosmos.
   */
  vendorType: string;
  /** Service Bus message ID — outer idempotency guard at the message level */
  messageId: string;
  /** Discriminates which adapter handles this message */
  flavor: BlobSyncFlavor;

  // ── data-share-sync fields ─────────────────────────────────────────────────
  /** Azure Data Share synchronizationId guid */
  syncRunId?: string;
  /** ISO-8601 — blobs with lastModified <= this value belong to this sync run */
  syncEndTime?: string;
  /** "Succeeded" | "Failed" | "Canceled" — adapter must check before processing */
  syncStatus?: string;

  // ── blob-created fields ────────────────────────────────────────────────────
  /** Full blob URL from the BlobCreated event */
  blobUrl?: string;
  eTag?: string;
  contentLengthBytes?: number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface BlobSyncAdapterContext {
  blobClient: VendorBlobStorageClient;
  db: CosmosDbService;
  outboxService: VendorEventOutboxService;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface BlobSyncResult {
  blobsEnumerated: number;
  /** New BlobIntakeJobDocuments created and queued in vendor-event-outbox */
  jobsCreated: number;
  /** Blobs already processed (idempotent — same eTag seen before) */
  jobsSkipped: number;
  /** Previously-failed jobs reset for retry (retryCount < maxRetries) */
  jobsRequeued: number;
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

export interface BlobSyncAdapter {
  readonly supportedFlavor: BlobSyncFlavor;

  /**
   * Returns true if this adapter can handle the given message for the given
   * connection. Called by BlobSyncWorkerService to select the right adapter.
   */
  canHandle(message: BlobSyncMessage, connection: VendorConnection): boolean;

  /**
   * Core processing entrypoint. Called once per Service Bus message.
   * Responsible for:
   *   1. Validating the message is processable (e.g. syncStatus === 'Succeeded')
   *   2. Enumerating affected blobs (batch or single)
   *   3. Idempotency check per blob (BlobIntakeJobDocument in Cosmos)
   *   4. Emitting vendor.file.received events into the vendor-event-outbox
   *   5. Advancing the BlobSyncCursorDocument (where applicable)
   *
   * Must be idempotent — if called twice with the same message, the second
   * call must produce zero new jobs (all blobs already recorded as 'queued').
   */
  processSync(
    message: BlobSyncMessage,
    connection: VendorConnection,
    context: BlobSyncAdapterContext,
  ): Promise<BlobSyncResult>;
}

// ─── Path Parser ──────────────────────────────────────────────────────────────
// Shared utility used by both adapters.

/**
 * Parses a blob path against a blobPathPattern, extracting named token values.
 *
 * Pattern syntax: token names wrapped in braces, separated by /
 * Example pattern:  "{year}/{month}/{day}/{subClientRef}/{filename}"
 * Example blobPath: "2026/05/12/ELN-12345/appraisal-report.pdf"
 * Result: { year: "2026", month: "05", day: "12", subClientRef: "ELN-12345", filename: "appraisal-report.pdf" }
 *
 * Returns null if the path does not match the pattern.
 */
export function parseBlobPathTokens(
  blobPath: string,
  pattern: string,
): Record<string, string> | null {
  // Escape regex metacharacters except for our {} tokens, then replace tokens
  // with named capture groups. Each segment is [^/]+ (no path separators).
  const regexSource = pattern
    .replace(/[.+*?^$|[\]\\()]/g, '\\$&')  // escape regex metacharacters
    .replace(/\{(\w+)\}/g, '(?<$1>[^/]+)'); // {token} → named capture group

  const regex = new RegExp(`^${regexSource}$`);
  const match = regex.exec(blobPath);
  if (!match?.groups) return null;
  return { ...match.groups };
}
