/**
 * Vendor Integration Framework — Core Types
 *
 * Defines the normalized domain events that flow between any external vendor
 * integration (AIM-Port, Mercury, RemoteVal, etc.) and our internal platform.
 * Every adapter translates vendor-specific payloads INTO these types (inbound)
 * and OUT of these types (outbound). Nothing outside this framework ever sees
 * raw vendor payloads.
 */

// ─── Transport / Adapter Meta ─────────────────────────────────────────────────

export type VendorType = 'aim-port' | 'mercury' | 'remoteVal' | 'class-valuation' | string;

export type InboundTransport = 'sync-post' | 'webhook' | 'polling' | 'blob-sync' | 'none';
export type OutboundTransport = 'sync-post' | 'webhook' | 'none';

// ─── Vendor Connection Record ─────────────────────────────────────────────────
// Stored in Cosmos DB container: vendor-connections
// Credentials are Key Vault secret NAMES — never the actual secrets.

// ─── Blob Drop Config ────────────────────────────────────────────────────────
// Optional block on VendorConnection for clients that deliver files via blob
// storage rather than HTTP. Absent on HTTP-only vendors.

export interface VendorConnectionBlobConfig {
  /** Azure Storage account name (platform-controlled) where synced blobs land */
  storageAccountName: string;
  /** Container name where the client's incoming files arrive */
  receivedContainerName: string;
  /** Optional container for writing results back to the client */
  resultsContainerName?: string;
  /**
   * Blob path pattern with named tokens.
   * Supported tokens: {year} {month} {day} {subClientRef} {filename}
   * Example: "{year}/{month}/{day}/{subClientRef}/{filename}"
   *
   * {subClientRef} becomes subClientId on every downstream event and job.
   * It represents a sub-division of the client: a loan ID, fund name,
   * portfolio ID, etc. Mandatory — if the client has no subdivision concept,
   * use a fixed literal (e.g. "submissions/{year}/{month}/{day}/{filename}"
   * and set subClientRef to a constant in their path).
   */
  blobPathPattern: string;
  /**
   * The processing pipeline that should handle these files.
   * Becomes taskType on VendorDomainEvent — Service Bus subscribers filter on it.
   * Open-ended string; no code change required for new pipeline types.
   * Examples: "underwriting-review" | "pool-tape-ingestion" | "appraisal-extraction"
   */
  taskType: string;
  /** File extensions to process. Others are silently skipped. Example: [".pdf"] */
  acceptedExtensions: string[];
  /**
   * Maximum retries before a BlobIntakeJobDocument is dead-lettered.
   * Defaults to 3 if absent.
   */
  maxRetries?: number;
  /**
   * Optional webhook URL to notify the client when a subClientRef batch
   * completes processing. If absent, client must poll the status API.
   */
  completionWebhookUrl?: string;
}

export interface VendorConnectionCredentials {
  /** Key Vault secret name for the API key they send us (we verify inbound) */
  inboundApiKeySecretName?: string;
  /** Key Vault secret name for our outbound API key (we send to them) */
  outboundApiKeySecretName?: string;
  /** The client_id / vendor account ID we send in outbound requests */
  outboundClientId?: string;
  /** Key Vault secret name for webhook HMAC verification on inbound calls */
  inboundHmacSecretName?: string;
  /** Key Vault secret name for outbound webhook signing */
  outboundHmacSecretName?: string;
}

export interface VendorConnection {
  /** Cosmos document id */
  id: string;
  /** Partition key */
  tenantId: string;
  /** Optional document discriminator for operational queries */
  type?: 'vendor-connection';
  vendorType: VendorType;
  /** Our internal lender/client this connection belongs to */
  lenderId: string;
  lenderName: string;
  /**
   * The identifier we extract from the inbound body/headers to look up this
   * connection. For AIM-Port this is the `client_id` field in the request body.
   */
  inboundIdentifier: string;
  credentials: VendorConnectionCredentials;
  /** Their endpoint — we POST to this URL for outbound calls */
  outboundEndpointUrl: string;
  active: boolean;
  /**
   * Per-connection product mapping table: vendor's product identifier (string or
   * stringified number) → our internal ProductType.  Checked before keyword
   * heuristics when resolving inbound order products.  Admin-editable at any
   * time — no redeploy required.
   */
  productMappings?: Record<string, string>;
  /**
   * Present only on blob-drop vendor connections (inboundTransport === 'blob-sync').
   * Absent on HTTP-only vendors (AIM-Port, Class Valuation, etc.).
   */
  blobConfig?: VendorConnectionBlobConfig;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateVendorConnectionInput {
  vendorType: VendorType;
  lenderId: string;
  lenderName: string;
  inboundIdentifier: string;
  credentials: VendorConnectionCredentials;
  outboundEndpointUrl: string;
  active: boolean;
  /** Optional initial product mappings: vendor product ID → internal ProductType. */
  productMappings?: Record<string, string>;
}

export interface UpdateVendorConnectionInput {
  vendorType?: VendorType;
  lenderId?: string;
  lenderName?: string;
  inboundIdentifier?: string;
  credentials?: VendorConnectionCredentials;
  outboundEndpointUrl?: string;
  active?: boolean;
  /** Merged (not replaced) into the existing productMappings when sent via PATCH. */
  productMappings?: Record<string, string>;
}

// ─── Normalized Domain Events ─────────────────────────────────────────────────
// These are the canonical event types that cross the adapter boundary.
// Internal services subscribe to these via Service Bus — never to vendor types.

export type VendorEventType =
  | 'vendor.order.received'
  | 'vendor.order.assigned'
  | 'vendor.order.accepted'
  | 'vendor.order.scheduled'
  | 'vendor.order.inspected'
  | 'vendor.order.held'
  | 'vendor.order.resumed'
  | 'vendor.order.cancelled'
  | 'vendor.order.due_date_changed'
  | 'vendor.order.fee_changed'
  | 'vendor.order.paid'
  | 'vendor.order.completed'
  | 'vendor.file.received'
  | 'vendor.file.received_no_completion'
  | 'vendor.message.received'
  | 'vendor.revision.requested'
  | 'vendor.loan_number.updated'
  | 'vendor.fha_case_number.updated'
  | 'vendor.products.listed'
  // Internal alert events published by VendorOrderStuckCheckerJob (not from vendor push):
  | 'vendor.order.stalled'
  /**
   * Emitted when AIM-Port sends a GetOrderRequest (status poll).
   * Downstream services react by reading current order state — the ACK itself
   * carries only the order ID; status enrichment requires a service-layer lookup.
   */
  | 'vendor.order.status_queried'
  /**
   * Emitted when AIM-Port sends an OrderUpdateRequest carrying lender-side
   * edits to a previously placed order (address change, product change, etc.).
   */
  | 'vendor.order.updated';

export interface VendorDomainEvent {
  id: string;                      // uuid — for idempotency
  eventType: VendorEventType;
  vendorType: VendorType;
  vendorOrderId: string;           // their order ID
  ourOrderId: string | null;       // our internal order ID (null if not yet mapped)
  lenderId: string;
  tenantId: string;
  occurredAt: string;              // ISO-8601
  payload: VendorEventPayload;
  /**
   * Tracks where this domain event originated.
   * - 'inbound'  — parsed from an inbound webhook/message received FROM the vendor.
   *                The consumer must NOT echo these back outbound (the vendor already
   *                knows — they sent it).
   * - 'internal' — raised by our own platform (e.g. a dispatcher marks an order assigned).
   *                The consumer SHOULD dispatch these outbound to notify the vendor.
   * Defaults to 'inbound' when absent for backward-compat with older persisted events.
   */
  origin?: 'inbound' | 'internal';
  /**
   * External party identifier — equals VendorConnection.inboundIdentifier.
   * Duplicated here so downstream consumers never need the connection record.
   */
  clientId?: string;
  /**
   * Sub-division within the client: loan ID, fund name, portfolio ID, etc.
   * Parsed from the blob path {subClientRef} token. Populated for blob-drop
   * events only; undefined on HTTP-vendor events.
   */
  subClientId?: string;
  /**
   * Processing pipeline routing key — from VendorConnectionBlobConfig.taskType.
   * Downstream Service Bus subscribers filter on this field.
   * Populated for blob-drop events only; undefined on HTTP-vendor events.
   */
  taskType?: string;
}

// ─── Event Payloads ───────────────────────────────────────────────────────────

export type VendorEventPayload =
  | VendorOrderReceivedPayload
  | VendorOrderAssignedPayload
  | VendorOrderAcceptedPayload
  | VendorOrderScheduledPayload
  | VendorOrderInspectedPayload
  | VendorOrderHeldPayload
  | VendorOrderResumedPayload
  | VendorOrderCancelledPayload
  | VendorOrderDueDateChangedPayload
  | VendorOrderFeeChangedPayload
  | VendorOrderPaidPayload
  | VendorOrderCompletedPayload
  | VendorFileReceivedPayload
  | VendorMessageReceivedPayload
  | VendorRevisionRequestedPayload
  | VendorLoanNumberUpdatedPayload
  | VendorFhaCaseNumberUpdatedPayload
  | VendorProductsListedPayload
  | VendorOrderStatusQueriedPayload
  | VendorOrderUpdatedPayload;

export interface VendorOrderReceivedPayload {
  orderType: 'residential' | 'commercial';
  address: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  loanNumber?: string;
  caseNumber?: string;
  purchasePrice?: number;
  disclosedFee?: number;
  loanAmount?: number;
  anticipatedValue?: number;
  propertyType: string;
  loanType?: string;
  loanPurpose?: string;
  occupancy?: string;
  intendedUse?: string;
  borrower: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    email?: string;
    phone?: string;
  };
  coborrower?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  propertyAccess?: {
    type: string;
    name: string;
    homePhone?: string;
    cellPhone?: string;
    workPhone?: string;
    email?: string;
  };
  products: Array<{ id: number | string; name?: string }>;
  paymentMethod?: string;
  dueDate?: string;
  settlementDate?: string;
  itpDate?: string;
  rush: boolean;
  specialInstructions?: string;
  clientName?: string;
  files: VendorFile[];
}

export interface VendorOrderAssignedPayload {
  vendorOrderId: string;
}

export interface VendorOrderAcceptedPayload {
  vendorFirstName?: string;
  vendorLastName?: string;
  vendorLicenseNumber?: string;
  vendorLicenseExpiration?: string;
}

export type VendorInspectionRequestedBy = 'appraiser' | 'client' | 'system' | 'homeowner';

export interface VendorScheduledTimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface VendorInspectionPropertyAccess {
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  accessInstructions?: string;
  requiresEscort: boolean;
  petWarning?: string;
  parkingInstructions?: string;
  specialRequirements?: string[];
}

export interface VendorOrderScheduledPayload {
  inspectionDate: string;
  appraiserId: string;
  scheduledSlot: VendorScheduledTimeSlot;
  propertyAccess: VendorInspectionPropertyAccess;
  requestedBy: VendorInspectionRequestedBy;
  inspectionNotes?: string;
  appointmentType?: 'property_inspection' | 'appraisal_appointment' | 'bpo_site_visit';
}

export interface VendorOrderInspectedPayload {
  inspectionDate: string;
}

export interface VendorOrderHeldPayload {
  message?: string;
}

export interface VendorOrderResumedPayload {
  message?: string;
}

export interface VendorOrderCancelledPayload {
  message: string;
}

export interface VendorOrderDueDateChangedPayload {
  dueDate: string;
}

export interface VendorOrderFeeChangedPayload {
  fee: number;
}

export interface VendorOrderPaidPayload {
  paidAmount: number;
}

export interface VendorOrderCompletedPayload {
  files: VendorFile[];
}

export interface VendorFileReceivedPayload {
  /**
   * Inline base64-encoded files — used by HTTP-path vendors (AIM-Port, etc.).
   * Exactly one of `files` or `fileRefs` is populated, never both.
   */
  files?: VendorFile[];
  /**
   * Blob storage references — used by blob-drop vendors (large files, Data Share).
   * Downstream processors stream the blob at processing time via Managed Identity.
   * Exactly one of `files` or `fileRefs` is populated, never both.
   */
  fileRefs?: VendorFileRef[];
}

export interface VendorMessageReceivedPayload {
  subject: string;
  content: string;
}

export interface VendorRevisionRequestedPayload {
  subject: string;
  content: string;
}

export interface VendorLoanNumberUpdatedPayload {
  loanNumber: string;
}

export interface VendorFhaCaseNumberUpdatedPayload {
  caseNumber: string;
}

export interface VendorOrderStatusQueriedPayload {
  /** The vendor's order ID that AIM-Port is polling. */
  vendorOrderId: string;
}

export interface VendorOrderUpdatedPayload {
  /** Changed loan number, if present in the update. */
  loanNumber?: string;
  /** Changed FHA case number, if present. */
  caseNumber?: string;
  /** Updated property address fields, if present. */
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  /** Updated financial fields, if present. */
  purchasePrice?: number;
  loanAmount?: number;
  disclosedFee?: number;
  anticipatedValue?: number;
  /** Updated due date, if present. */
  dueDate?: string;
  /** Updated fee, if present. */
  fee?: number;
  /** Any files attached to the update. */
  files?: VendorFile[];
}

export interface VendorProductsListedPayload {
  products: Array<{
    productId: number;
    productName: string;
    formType: string;
    orderType: string;
  }>;
}

// ─── File ─────────────────────────────────────────────────────────────────────

export interface VendorFile {
  fileId: string;
  filename: string;
  category: string;
  categoryLabel?: string;
  description?: string;
  /** Base64-encoded content */
  content: string;
}

/**
 * A reference to a large file stored in Azure Blob Storage.
 * Used by blob-drop vendors instead of inline base64 content.
 * Downstream processors stream the blob via DefaultAzureCredential at
 * processing time — no content is embedded in the event payload.
 */
export interface VendorFileRef {
  /** SHA-256(storageAccountName + containerName + blobPath + eTag) */
  fileId: string;
  filename: string;
  /** Inferred from file extension or path convention */
  category: string;
  storageAccountName: string;
  containerName: string;
  blobPath: string;
  eTag: string;
  contentLengthBytes?: number;
  /** The {subClientRef} token parsed from the blob path (e.g. loan ID, fund ID) */
  subClientId: string;
  /** Task type from the connection config — pipeline routing key */
  taskType: string;
}

// ─── Blob Intake Job / Cursor ─────────────────────────────────────────────────
// Stored in Cosmos container: blob-intake-jobs

export type BlobIntakeJobStatus =
  | 'received'
  | 'queued'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'dead-lettered';

/**
 * One document per unique blob (keyed by content hash/eTag).
 * Provides idempotency, status tracking, and result path storage
 * for every file ingested via the blob-drop pathway.
 */
export interface BlobIntakeJobDocument {
  /** SHA-256(storageAccountName + containerName + blobPath + eTag) */
  id: string;
  /** Partition key */
  tenantId: string;
  type: 'blob-intake-job';
  /** Platform tenant (lender using our platform) */
  clientId: string;
  /** Sub-division within client: loan ID, fund name, portfolio ID, etc. */
  subClientId: string;
  /** Processing pipeline — from VendorConnectionBlobConfig.taskType */
  taskType: string;
  /** VendorConnection.id — traces back to the full config */
  connectionId: string;
  storageAccountName: string;
  containerName: string;
  blobPath: string;
  eTag: string;
  contentLengthBytes?: number;
  filename: string;
  /** The sync run that brought this blob in (Data Share syncRunId or 'blob-created') */
  syncRunId: string;
  status: BlobIntakeJobStatus;
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

/**
 * One cursor document per VendorConnection.
 * Tracks the high-water mark for blob enumeration so incremental
 * Data Share syncs only process new/changed blobs.
 * Stored in the same `blob-intake-jobs` container as BlobIntakeJobDocument.
 */
export interface BlobSyncCursorDocument {
  /** "cursor:{connectionId}" */
  id: string;
  /** Same partition key strategy as BlobIntakeJobDocument */
  tenantId: string;
  type: 'blob-sync-cursor';
  connectionId: string;
  clientId: string;
  lastSyncRunId: string;
  /** Blobs with lastModified BEFORE this timestamp are skipped on next enumeration */
  lastSyncCompletedAt: string;  // ISO-8601
}

// ─── Outbound Call ────────────────────────────────────────────────────────────

export interface OutboundCall {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: unknown;
  /** Optional pre-serialized payload used when headers/signatures depend on exact bytes */
  rawBody?: string;
  /** For logging/dead-letter context */
  eventType: VendorEventType;
  vendorOrderId: string;
}

// ─── Real Order Reference / Outbox ───────────────────────────────────────────

export interface VendorOrderReference {
  orderId: string;
  orderNumber: string;
  existed: boolean;
}

export type VendorOutboxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';

export interface VendorOutboxDocument {
  id: string;
  tenantId: string;
  type: 'vendor-event-outbox';
  direction: 'inbound' | 'outbound';
  status: VendorOutboxStatus;
  vendorType: VendorType;
  connectionId: string;
  lenderId: string;
  vendorOrderId: string;
  ourOrderId: string | null;
  eventType: VendorEventType;
  occurredAt: string;
  receivedAt: string;
  availableAt: string;
  attemptCount: number;
  payload: VendorEventPayload;
  /**
   * Present only when direction === 'outbound'.
   * Stores the full VendorDomainEvent so VendorOutboundWorkerService can
   * replay the exact call on retry without re-deriving the payload.
   */
  outboundEvent?: VendorDomainEvent;
  metadata: {
    transport: InboundTransport | OutboundTransport;
    replayKey?: string;
  };
  lastError?: string;
  claimedAt?: string;
  claimedBy?: string;
  lastAttemptAt?: string;
  completedAt?: string;
  deadLetterAcknowledgedAt?: string;
  deadLetterAcknowledgedBy?: string;
  deadLetterAcknowledgeNote?: string;
}

export interface VendorEventReceiptDocument {
  id: string;
  tenantId: string;
  type: 'vendor-event-receipt';
  connectionId: string;
  vendorType: VendorType;
  vendorOrderId: string;
  eventType: VendorEventType;
  replayKey: string;
  payloadHash: string;
  firstSeenAt: string;
}

// ─── Ack Response ─────────────────────────────────────────────────────────────
// What we send back to the vendor after processing their inbound call.

export interface VendorAckResponse {
  /** HTTP status code to send */
  statusCode: number;
  /** JSON body to send */
  body: unknown;
}

// ─── Adapter Inbound Result ───────────────────────────────────────────────────

export interface AdapterInboundResult {
  domainEvents: VendorDomainEvent[];
  ack: VendorAckResponse;
}
