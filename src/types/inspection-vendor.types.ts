// ──────────────────────────────────────────────────────────────────────────────
// Types shared between the InspectionProvider interface, IVueit provider,
// InspectionVendorService, and the VendorOrder document stored in Cosmos DB.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The four PDF variants iVueit may generate on completion.
 * All IDs are vendor-assigned file UUIDs that can be fetched via
 * GET /api/v1/file/url/{id}.
 */
export interface InspectionPdfFileIds {
  main?: string;     // pdfFileId
  survey?: string;   // pdfFileIdSurvey
  photos?: string;   // pdfFileIdPhotos
  ordered?: string;  // pdfFileIdOrdered
}

/**
 * Input required to place an inspection order with any vendor.
 * Populated by the caller (controller) and passed to provider.createOrder().
 */
export interface CreateInspectionOrderInput {
  /** Our internal vendor-order ID. Embedded as vendor metadata for reconciliation. */
  vendorOrderId: string;
  tenantId: string;
  /** Vendor-side survey template UUID. */
  surveyTemplateId: string;
  address: {
    street: string;
    city: string;
    /** Two-character state/province code. */
    stateCode: string;
    zipCode: string;
  };
  schedulingWindow: {
    /** 24-hour time string "HH:MM". */
    startTime: string;
    /** 24-hour time string "HH:MM". */
    endTime: string;
    /** Nanoseconds from Unix epoch as string. '0' means publish immediately. */
    publishAt?: string;
    /** Nanoseconds from Unix epoch as string. */
    expiresAt?: string;
  };
  isInternal?: boolean;
  /** Pre-uploaded vendor file IDs to attach to the order. */
  attachmentFileIds?: string[];
  notes?: string;
}

/**
 * Returned by provider.createOrder() — identifies the order on the vendor side.
 */
export interface ExternalOrderRef {
  /** Primary vendor UUID for the order. */
  externalOrderId: string;
  /** Human-readable integer ID used by some vendors (e.g. iVueit canonicalId). */
  externalCanonicalId?: string;
  externalBatchId?: string;
  externalSubmissionId?: string;
}

/**
 * Returned by provider.getOrder() — current order state from the vendor.
 */
export interface ExternalOrderStatus {
  externalOrderId: string;
  /** Raw vendor status string (provider-specific). */
  externalStatus: string;
  isComplete: boolean;
  isCancelled: boolean;
  escalated?: boolean;
  escalationNotes?: string;
  pdfFileIds?: InspectionPdfFileIds;
  submissionId?: string;
  externalCompletedAt?: string;
  externalExpiresAt?: string;
}

/**
 * Input for uploading a supplementary file to the vendor platform.
 */
export interface UploadFileInput {
  filename: string;
  mimeType: string;
  data: Buffer;
}

/**
 * Persisted on the VendorOrder document in Cosmos DB.
 * Tracks all inspection-vendor state and blob storage paths for artifacts.
 */
export interface InspectionVendorData {
  /** Identifies the provider, e.g. 'ivueit'. */
  externalProvider: string;
  externalOrderId?: string;
  /** Human-readable integer ID (e.g. iVueit canonicalId). */
  externalCanonicalId?: string;
  externalBatchId?: string;
  externalSubmissionId?: string;
  externalStatus?: string;
  surveyTemplateId?: string;
  escalated?: boolean;
  escalationNotes?: string;
  pdfFileIds?: InspectionPdfFileIds;
  /** Vendor file IDs of supplementary files we uploaded. */
  attachmentFileIds?: string[];
  externalCreatedAt?: string;
  externalCompletedAt?: string;
  externalExpiresAt?: string;
  /** Blob path for the raw submission JSON (e.g. orders/{tenantId}/{orderId}/inspection-results/submission.json). */
  resultsBlobPath?: string;
  /** Blob paths for the downloaded PDF reports. */
  reportBlobPaths?: {
    main?: string;
    survey?: string;
    photos?: string;
    ordered?: string;
  };
  lastPolledAt?: string;
  pollFailureCount?: number;
}
