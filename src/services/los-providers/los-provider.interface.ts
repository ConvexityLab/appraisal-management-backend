/**
 * LOS (Loan Origination System) Provider Interface
 *
 * Provider-agnostic contract for integrating with loan origination systems.
 * Implement this interface to add a new LOS backend (Encompass, Black Knight Empower, etc.).
 * The LosController delegates all LOS operations here — swapping providers is a
 * one-variable change (LOS_PROVIDER env var) in the factory (./factory.ts).
 *
 * Operations covered:
 *   importOrder     — pull an appraisal order from the LOS into this platform
 *   pushOrder       — push completed appraisal status/data back to the LOS
 *   getLoan         — fetch loan details by loan number (read-only)
 */

// ============================================================================
// Shared domain types
// ============================================================================

/** Minimal loan data we need from any LOS. */
export interface LosLoan {
  /** LOS-assigned loan number. */
  loanNumber: string;
  /** Borrower full name. */
  borrowerName: string;
  /** Co-borrower name if present. */
  coBorrowerName?: string;
  /** Loan amount in cents. */
  loanAmountCents: number;
  /** Loan purpose: purchase, refinance, etc. */
  loanPurpose: string;
  /** Property address. */
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  /** LOS loan status. */
  losStatus: string;
  /** Lender company name. */
  lenderName?: string;
  /** Loan officer full name. */
  loanOfficerName?: string;
  /** Loan officer email. */
  loanOfficerEmail?: string;
  /** Loan officer phone. */
  loanOfficerPhone?: string;
  /** Raw LOS response for debugging. */
  rawData?: unknown;
}

/** Data the LOS needs to create/find an appraisal order. */
export interface LosImportRequest {
  /** LOS loan number — the primary key for LOS lookup. */
  loanNumber: string;
  /** Optional LOS file/case ID (some LOS systems use this instead). */
  losFileId?: string;
  /** Tenant making the import. */
  tenantId: string;
}

/** Result of importing an order from the LOS. */
export interface LosImportResult {
  /** Our internal order ID created after import. */
  orderId: string;
  loan: LosLoan;
  /** True if order was newly created; false if it already existed. */
  created: boolean;
}

/** Status/completion data to push back to the LOS. */
export interface LosPushRequest {
  /** Our internal order ID. */
  orderId: string;
  /** LOS loan number. */
  loanNumber: string;
  /** Appraised value in cents. */
  appraisedValueCents?: number;
  /** Effective date of the appraisal (YYYY-MM-DD). */
  appraisalEffectiveDate?: string;
  /** Status to set in the LOS: e.g. 'Ordered', 'Completed', 'Delivered'. */
  statusCode: string;
  /** Free-text note to attach to the LOS loan/appraisal record. */
  note?: string;
  /** Base64-encoded PDF blob of the completed appraisal report. */
  reportPdfBase64?: string;
}

/** Result of pushing data back to the LOS. */
export interface LosPushResult {
  success: boolean;
  losConfirmationId?: string;
  message?: string;
}

// ============================================================================
// The interface
// ============================================================================

export interface LosProvider {
  /** Human-readable name used in logs and admin UI. */
  readonly name: string;

  /** Return true if the provider is configured and ready. */
  isAvailable(): boolean;

  /**
   * Import an appraisal order from the LOS into this platform.
   * Fetches the loan record and creates (or opens) an order in our system.
   */
  importOrder(request: LosImportRequest): Promise<LosImportResult>;

  /**
   * Push appraisal status / completion data back to the LOS.
   * Idempotent: calling twice with the same data should not cause errors.
   */
  pushOrder(request: LosPushRequest): Promise<LosPushResult>;

  /**
   * Fetch loan details by loan number (read-only lookup).
   * Returns null if the loan is not found.
   */
  getLoan(loanNumber: string, tenantId: string): Promise<LosLoan | null>;
}
