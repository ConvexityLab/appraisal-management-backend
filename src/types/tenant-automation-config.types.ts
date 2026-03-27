/**
 * Tenant Automation Configuration Types
 *
 * Per-tenant settings that control the auto-assignment orchestrator,
 * supervisory review requirements, and notification behaviour.
 *
 * Stored in the 'tenant-automation-configs' Cosmos container.
 * Partition key: tenantId.
 */

export interface TenantAutomationConfig {
  /** Cosmos document id — same as tenantId for easy lookup. */
  id: string;
  tenantId: string;

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
   * are created.  Useful for tenants that want ranking but not auto-dispatch.
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
   * Useful for routing all of a tenant's orders through a preferred internal
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

  // ── Metadata ──────────────────────────────────────────────────────────────

  updatedAt: string; // ISO
  updatedBy: string;
  createdAt: string; // ISO
  entityType: 'tenant-automation-config';
}

/** Payload accepted by the update endpoint. All fields optional except tenantId guard. */
export type UpdateTenantAutomationConfigRequest = Partial<
  Omit<TenantAutomationConfig, 'id' | 'tenantId' | 'updatedAt' | 'updatedBy' | 'createdAt' | 'entityType'>
>;

/** Default config used when no document exists yet for a tenant. */
export const DEFAULT_TENANT_AUTOMATION_CONFIG: Omit<
  TenantAutomationConfig,
  'id' | 'tenantId' | 'updatedAt' | 'updatedBy' | 'createdAt'
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
  entityType: 'tenant-automation-config',
};
