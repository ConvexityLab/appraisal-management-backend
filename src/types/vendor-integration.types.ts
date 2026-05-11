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

export type InboundTransport = 'sync-post' | 'webhook' | 'polling' | 'none';
export type OutboundTransport = 'sync-post' | 'webhook' | 'none';

// ─── Vendor Connection Record ─────────────────────────────────────────────────
// Stored in Cosmos DB container: vendor-connections
// Credentials are Key Vault secret NAMES — never the actual secrets.

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
}

export interface UpdateVendorConnectionInput {
  vendorType?: VendorType;
  lenderId?: string;
  lenderName?: string;
  inboundIdentifier?: string;
  credentials?: VendorConnectionCredentials;
  outboundEndpointUrl?: string;
  active?: boolean;
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
  | 'vendor.products.listed';

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
  | VendorProductsListedPayload;

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
  files: VendorFile[];
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
