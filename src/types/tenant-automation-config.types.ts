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
  preferredVendorIds: [],
  // defaultSupervisorId omitted — undefined not allowed with exactOptionalPropertyTypes
  supervisoryReviewForAllOrders: false,
  supervisoryReviewValueThreshold: 0,
  escalationRecipients: [],
  entityType: 'tenant-automation-config',
};
