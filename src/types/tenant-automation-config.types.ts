/**
 * Client Automation Configuration Types
 *
 * Per-client settings that control the auto-assignment orchestrator,
 * supervisory review requirements, and notification behaviour.
 *
 * Stored in the 'client-configs' Cosmos container.
 * Partition key: clientId.
 */

export interface ClientAutomationConfig {
  /** Cosmos document id — same as clientId for easy lookup. */
  id: string;
  clientId: string;
  subClientId?: string;

  // ── Auto-assignment behaviour ─────────────────────────────────────────────

  /**
   * Master switch for the bid loop.
   * When false, the orchestrator skips the entire vendor bid cycle
   * and marks the order as requiring manual vendor assignment.
   * @default true
   */
  autoAssignmentEnabled: boolean;

  /**
   * When false, the bid loop still runs but no bid invitation documents
   * are created.  Useful for clients that want ranking but not auto-dispatch.
   * @default true
   */
  bidLoopEnabled: boolean;

  /**
   * Maximum number of vendors to contact before escalating to a human.
   * Overrides the system default of 5.
   * @default 5
   */
  maxVendorAttempts: number;

  /**
   * Hours before a vendor bid expires and the timeout checker fires.
   * Overrides the system default of 4 hours.
   * @default 4
   */
  bidExpiryHours: number;

  /**
   * Hours before a reviewer assignment expires.
   * @default 8
   */
  reviewExpiryHours: number;

  /**
   * Hours a supervisor has to co-sign an order before the
   * SupervisionTimeoutWatcherJob fires a `supervision.timeout` event and
   * escalates to `escalationRecipients`.
   * @default 8
   */
  supervisorTimeoutHours: number;

  // ── Default staff assignments ─────────────────────────────────────────────

  /**
   * Vendor IDs to try first in the ranked list before any other matching.
   * Useful for routing all of a client's orders through a preferred internal
   * appraiser by default.
   */
  preferredVendorIds?: string[];

  /**
   * Default supervisor vendor ID to assign when supervisory review is required
   * and no supervisor has been explicitly selected.
   */
  defaultSupervisorId?: string;

  // ── Supervisory review policy ─────────────────────────────────────────────

  /**
   * When true, every order requires a supervisor co-sign before delivery.
   * The `defaultSupervisorId` is used if no specific supervisor is set.
   * @default false
   */
  supervisoryReviewForAllOrders: boolean;

  /**
   * Order value (in USD) above which supervisory review is automatically
   * triggered.  Set to 0 to disable value-based triggering.
   * @default 0 (disabled)
   */
  supervisoryReviewValueThreshold: number;

  // ── Notification settings ─────────────────────────────────────────────────

  /**
   * Email addresses (or user IDs) that receive escalation notifications
   * when the bid loop or review assignment is exhausted.
   */
  escalationRecipients: string[];

  // ── AI QC gate ────────────────────────────────────────────────────────────

  /**
   * When true, every SUBMITTED order is scored by the AI QC gate before human
   * routing.  Orders scoring >= aiQcPassThreshold skip human review entirely.
   * @default false
   */
  aiQcEnabled: boolean;

  /**
   * AI QC score (0-100) at or above which an order is automatically passed
   * without human review.
   * @default 90
   */
  aiQcPassThreshold: number;

  /**
   * AI QC score (0-100) below which an order is flagged for supervisory review
   * in addition to human QC.  Scores between this and aiQcPassThreshold route
   * to a standard QC analyst.
   * @default 70
   */
  aiQcFlagThreshold: number;

  // ── Auto-delivery & engagement lifecycle ──────────────────────────────────

  /**
   * When true, the system auto-generates the report PDF and delivers it to
   * the client portal after QC/supervision clears (or after an AI auto-pass).
   * @default false
   */
  autoDeliveryEnabled: boolean;

  /**
   * When true, the engagement is automatically closed (status → COMPLETED)
   * once every child order reaches DELIVERED status.
   * @default false
   */
  autoCloseEngagementEnabled: boolean;

  // ── Bid mode ──────────────────────────────────────────────────────────────

  /**
   * 'sequential' — contact vendors one-by-one (classic behaviour).
   * 'broadcast'  — contact broadcastCount vendors simultaneously; first
   *                acceptance wins and cancels the rest.
   * @default 'sequential'
   */
  bidMode: 'sequential' | 'broadcast';

  /**
   * Number of vendors to contact simultaneously in broadcast mode.
   * Ignored when bidMode is 'sequential'.
   * @default 5
   */
  broadcastCount: number;

  // ── Engagement letter ─────────────────────────────────────────────────────

  /**
   * When true, the system automatically generates and emails an engagement
   * letter to the vendor upon bid acceptance or staff assignment.
   * @default false
   */
  engagementLetterAutoSend: boolean;

  /**
   * When true, the order is blocked from progressing past ASSIGNED status
   * until the vendor has signed the engagement letter.
   * @default false
   */
  requireSignedLetterBeforeProgress: boolean;

  // ── Axiom auto-trigger ────────────────────────────────────────────────────

  /**
   * When true, the system automatically submits every SUBMITTED order to the
   * Axiom evaluation pipeline.  The orchestrator will wait up to
   * axiomTimeoutMinutes before routing the order for human QC.
   * @default false
   */
  axiomAutoTrigger: boolean;

  /**
   * Minutes to wait for Axiom evaluation before falling back to normal
   * routing.  Set low in dev (2) and higher in prod (10-15).
   * @default 10
   */
  axiomTimeoutMinutes: number;

  /**
   * Axiom program ID to invoke when axiomAutoTrigger fires for a document
   * upload in this client.  Required when axiomAutoTrigger is true.
   * Example: 'FNMA-URAR'
   */
  axiomProgramId?: string;

  /**
   * Version of the Axiom program to invoke.
   * Required when axiomAutoTrigger is true.
   * Example: '1.0.0'
   */
  axiomProgramVersion?: string;

  /**
   * Sub-client identifier used for document schema and criteria program keys
   * in run-ledger orchestration.
   */
  axiomSubClientId?: string;

  /**
   * Registered Axiom pipeline ID for extraction-only submissions.
   * Default: 'adaptive-document-processing'
   */
  axiomPipelineIdExtraction?: string;

  /**
   * Registered Axiom pipeline ID for criteria-only evaluation.
   * Default: 'smart-criteria-evaluation'
   */
  axiomPipelineIdCriteria?: string;

  /**
   * Registered Axiom pipeline ID for complete (extraction + criteria) evaluation.
   * Default: 'complete-document-criteria-evaluation'
   */
  axiomPipelineIdComplete?: string;

  /**
   * Document schema version used for extraction run schemaKey.version.
   * If omitted, orchestrators may use axiomProgramVersion from client config.
   */
  axiomDocumentSchemaVersion?: string;

  /**
   * Optional default criteria step keys for document-triggered criteria runs.
   * When omitted, RUN_DEFAULT_CRITERIA_STEPS env var is used.
   */
  axiomDefaultCriteriaStepKeys?: string[];

  // ── Review program triggers (Phase K of DECISION_ENGINE_RULES_SURFACE.md) ─
  //
  // Controls which order-creation paths automatically run a review-program
  // evaluation. Today review-program eval only fires on bulk-portfolio
  // upload — these flags extend it to every order created on the platform.
  //
  // Per-tenant defaults; engagement-level overrides (engagement.reviewProgramId)
  // take precedence when set.

  /**
   * When true, every `engagement.order.created` event with this tenant
   * triggers a review-program evaluation against `reviewProgramIdForOrders`
   * (or the engagement's `reviewProgramId` when present).
   * @default false — operators opt in once they've authored a program.
   */
  reviewProgramOnOrderCreated?: boolean;

  /**
   * When true, runs review-program evaluation again after a document upload
   * completes (re-evaluates with fresher extracted fields).
   * @default false
   */
  reviewProgramOnDocumentUploaded?: boolean;

  /**
   * Default ReviewProgram id to evaluate against when no engagement-level
   * `reviewProgramId` is set. When undefined and the engagement also has
   * none, the trigger is skipped (warn log; no decision recorded).
   */
  reviewProgramIdForOrders?: string;

  // ── Metadata ──────────────────────────────────────────────────────────────

  updatedAt: string; // ISO
  updatedBy: string;
  createdAt: string; // ISO
  entityType: 'client-config';
}

/** Payload accepted by the update endpoint. All fields optional except clientId guard. */
export type UpdateClientAutomationConfigRequest = Partial<
  Omit<ClientAutomationConfig, 'id' | 'clientId' | 'updatedAt' | 'updatedBy' | 'createdAt' | 'entityType'>
>;

/** Default config used when no document exists yet for a client. */
export const DEFAULT_CLIENT_AUTOMATION_CONFIG: Omit<
  ClientAutomationConfig,
  'id' | 'clientId' | 'updatedAt' | 'updatedBy' | 'createdAt'
> = {
  autoAssignmentEnabled: true,
  bidLoopEnabled: true,
  maxVendorAttempts: 5,
  bidExpiryHours: 4,
  reviewExpiryHours: 8,
  supervisorTimeoutHours: 8,
  preferredVendorIds: [],
  // defaultSupervisorId omitted — undefined not allowed with exactOptionalPropertyTypes
  supervisoryReviewForAllOrders: false,
  supervisoryReviewValueThreshold: 0,
  escalationRecipients: [],
  aiQcEnabled: false,
  aiQcPassThreshold: 90,
  aiQcFlagThreshold: 70,
  autoDeliveryEnabled: true,
  autoCloseEngagementEnabled: true,
  bidMode: 'sequential',
  broadcastCount: 5,
  engagementLetterAutoSend: true,
  requireSignedLetterBeforeProgress: false,
  axiomAutoTrigger: true,
  axiomTimeoutMinutes: 10,
  // Phase K defaults — off so tenants without authored programs aren't
  // surprised by review-program traces they didn't enable.
  reviewProgramOnOrderCreated: false,
  reviewProgramOnDocumentUploaded: false,
  entityType: 'client-config',
};

// ── Backward-compat aliases — remove once all callers are updated ─────────────
/** @deprecated Use ClientAutomationConfig */
export type TenantAutomationConfig = ClientAutomationConfig;
/** @deprecated Use UpdateClientAutomationConfigRequest */
export type UpdateTenantAutomationConfigRequest = UpdateClientAutomationConfigRequest;
/** @deprecated Use DEFAULT_CLIENT_AUTOMATION_CONFIG */
export const DEFAULT_TENANT_AUTOMATION_CONFIG = DEFAULT_CLIENT_AUTOMATION_CONFIG;
