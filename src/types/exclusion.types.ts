/**
 * Appraiser Exclusionary List Types
 *
 * An exclusion entry represents a tenant-level decision to prevent a specific
 * appraiser/vendor from being assigned to any order under that tenant.
 *
 * Under the hood, exclusions are stored as `blacklist` rules in the
 * `vendor-matching-rules` container so the existing matching engine enforces
 * them automatically — no separate enforcement path.
 */

export type ExclusionReason =
  | 'performance'          // documented quality/SLA failures
  | 'conflict_of_interest' // relationship to borrower or subject property
  | 'regulatory'           // state board sanction, license issue, FIRREA concern
  | 'client_request'       // lender/client does not want this vendor
  | 'internal_policy'      // AMC internal policy decision
  | 'other';

export interface ExclusionListEntry {
  /** Opaque ID (UUID). */
  id: string;
  /** Tenant this exclusion applies to. */
  tenantId: string;
  /** Vendor/appraiser user ID. */
  appraiserId: string;
  /** Display name for audit logs and UI. */
  appraiserName: string;
  reason: ExclusionReason;
  /** Human-readable explanation — required for regulatory/conflict reasons. */
  notes?: string;
  /** User ID who added this exclusion. */
  addedBy: string;
  addedAt: string;
  /** ISO timestamp; null = permanent. */
  expiresAt: string | null;
  /** The vendor-matching-rule ID backing this entry. Used for cleanup on delete. */
  matchingRuleId: string;
  type: 'appraiser-exclusion';
}

export interface CreateExclusionRequest {
  tenantId: string;
  appraiserId: string;
  appraiserName: string;
  reason: ExclusionReason;
  notes?: string;
  expiresAt?: string | null;
}

export interface ExclusionListPageResult {
  entries: ExclusionListEntry[];
  total: number;
  page: number;
  pageSize: number;
}
