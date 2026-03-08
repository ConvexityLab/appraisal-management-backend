/**
 * Shared Seed IDs — single source of truth for all cross-referenced seed data.
 *
 * Every seed module imports IDs from here so foreign-key relationships
 * are consistent regardless of execution order.
 *
 * Convention: all IDs use a `seed-` prefix to make cleanup easy.
 */

// ─── Clients ──────────────────────────────────────────────────────────────────
export const CLIENT_IDS = {
  FIRST_HORIZON: 'seed-client-lender-firsthorizon-001',
  PACIFIC_COAST: 'seed-client-lender-pacificcoast-002',
  NATIONAL_AMC: 'seed-client-amc-nationalamc-003',
  CLEARPATH: 'seed-client-amc-clearpath-004',
  SUNCOAST: 'seed-client-broker-suncoast-005',
  FIRST_TECH_CU: 'seed-client-cu-firsttechfcu-006',
} as const;

// ─── Products ─────────────────────────────────────────────────────────────────
export const PRODUCT_IDS = {
  FULL_1004: 'seed-product-1004-full-001',
  DRIVE_BY_2055: 'seed-product-2055-driveby-002',
  DESKTOP_REVIEW: 'seed-product-desktop-review-003',
  CONDO_1073: 'seed-product-1073-condo-004',
  MULTI_FAMILY_1025: 'seed-product-1025-multifam-005',
  FIELD_REVIEW_2000: 'seed-product-field-review-006',
  RECERTIFICATION: 'seed-product-1004d-recert-007',
  ROV: 'seed-product-rov-standard-008',
} as const;

// ─── Vendors ──────────────────────────────────────────────────────────────────
export const VENDOR_IDS = {
  PREMIER: 'seed-vendor-001',
  ROCKY_MOUNTAIN: 'seed-vendor-002',
  TX_PROPERTY: 'seed-vendor-003',
  METROPLEX: 'seed-vendor-004',
  NVN: 'seed-vendor-005',
  // CA/FL extended vendors (from seed-vendors.ts)
  JAMES_WILLIAMS_CA: 'seed-vendor-ca-james-williams',
  MARIA_RODRIGUEZ_CA: 'seed-vendor-ca-maria-rodriguez',
  AMANDA_WILSON_FL: 'seed-vendor-fl-amanda-wilson',
} as const;

// ─── Appraisers (stored in vendors container, type='appraiser') ───────────────
export const APPRAISER_IDS = {
  MICHAEL_THOMPSON: 'seed-appraiser-001',
  PATRICIA_NGUYEN: 'seed-appraiser-002',
  KEVIN_OKAFOR: 'seed-appraiser-003',
  ANGELA_REEVES_CA: 'seed-appraiser-ca-001',
  CARMEN_DELGADO_TX: 'seed-appraiser-tx-001',
  ELENA_VASQUEZ_FL: 'seed-appraiser-fl-001',
} as const;

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ORDER_IDS = {
  /** COMPLETED — full 1004, passed QC, delivered */
  COMPLETED_001: 'seed-order-001',
  /** QC_REVIEW — pending QC analyst assignment */
  QC_REVIEW_002: 'seed-order-002',
  /** IN_PROGRESS — rush, inspection completed */
  IN_PROGRESS_003: 'seed-order-003',
  /** PENDING_ASSIGNMENT — new, awaiting RFB */
  PENDING_004: 'seed-order-004',
  /** NEW — just received from client */
  NEW_005: 'seed-order-005',
  /** IN_PROGRESS — fix-and-flip, ARV analysis */
  FIX_FLIP_006: 'seed-order-006',
  /** ASSIGNED — vendor assigned, awaiting acceptance */
  ASSIGNED_007: 'seed-order-007',
  /** ACCEPTED — vendor accepted, inspection scheduled */
  ACCEPTED_008: 'seed-order-008',
  /** SUBMITTED — report submitted, awaiting QC */
  SUBMITTED_009: 'seed-order-009',
  /** REVISION_REQUESTED — QC found issues */
  REVISION_010: 'seed-order-010',
  /** CANCELLED — client cancelled */
  CANCELLED_011: 'seed-order-011',
  /** COMPLETED — drive-by, routine */
  COMPLETED_DRIVEBY_012: 'seed-order-012',
} as const;

export const ORDER_NUMBERS: Record<string, string> = {
  [ORDER_IDS.COMPLETED_001]: 'SEED-2026-00101',
  [ORDER_IDS.QC_REVIEW_002]: 'SEED-2026-00102',
  [ORDER_IDS.IN_PROGRESS_003]: 'SEED-2026-00103',
  [ORDER_IDS.PENDING_004]: 'SEED-2026-00104',
  [ORDER_IDS.NEW_005]: 'SEED-2026-00105',
  [ORDER_IDS.FIX_FLIP_006]: 'SEED-2026-00106',
  [ORDER_IDS.ASSIGNED_007]: 'SEED-2026-00107',
  [ORDER_IDS.ACCEPTED_008]: 'SEED-2026-00108',
  [ORDER_IDS.SUBMITTED_009]: 'SEED-2026-00109',
  [ORDER_IDS.REVISION_010]: 'SEED-2026-00110',
  [ORDER_IDS.CANCELLED_011]: 'SEED-2026-00111',
  [ORDER_IDS.COMPLETED_DRIVEBY_012]: 'SEED-2026-00112',
};

// ─── QC ───────────────────────────────────────────────────────────────────────
export const QC_CHECKLIST_IDS = {
  UAD_STANDARD: 'seed-checklist-uad-standard-2026',
} as const;

export const QC_REVIEW_IDS = {
  REVIEW_ORDER_001: 'seed-qc-review-001',
  REVIEW_ORDER_002: 'seed-qc-review-002',
  REVIEW_ORDER_009: 'seed-qc-review-009',
} as const;

// ─── Documents ────────────────────────────────────────────────────────────────
export const DOCUMENT_IDS = {
  REPORT_ORDER_001: 'seed-doc-report-001',
  ENGAGEMENT_ORDER_001: 'seed-doc-engagement-001',
  PHOTOS_ORDER_003: 'seed-doc-photos-003',
  REPORT_ORDER_009: 'seed-doc-report-009',
  REPORT_ORDER_012: 'seed-doc-report-012',
} as const;

// ─── Communications ───────────────────────────────────────────────────────────
export const COMM_IDS = {
  SMS_ASSIGN_003: 'seed-comm-sms-001',
  SMS_CONFIRM_003: 'seed-comm-sms-002',
  EMAIL_DELIVERED_001: 'seed-comm-email-001',
  EMAIL_QC_PASS_001: 'seed-comm-email-002',
} as const;

// ─── Matching Criteria ────────────────────────────────────────────────────────
export const CRITERIA_SET_IDS = {
  GEO_DALLAS: 'seed-criteria-geo-dallas',
  HIGH_PERFORMANCE: 'seed-criteria-performance',
  ACTIVE_LICENSE: 'seed-mcs-active-license-001',
  FLORIDA_COVERAGE: 'seed-mcs-florida-coverage-002',
  SOUTHEAST: 'seed-mcs-southeast-003',
  TEXAS_COVERAGE: 'seed-mcs-texas-coverage-008',
  LOW_REVISION: 'seed-mcs-low-revision-009',
} as const;

// ─── RFB ──────────────────────────────────────────────────────────────────────
export const RFB_IDS = {
  RFB_ORDER_004: 'seed-rfb-001',
} as const;

// ─── ARV ──────────────────────────────────────────────────────────────────────
export const ARV_IDS = {
  ARV_ORDER_006: 'seed-arv-001',
} as const;

// ─── Construction ─────────────────────────────────────────────────────────────
export const CONTRACTOR_IDS = {
  APEX_BUILD: 'seed-gc-001',
  SWIFT_RENO: 'seed-gc-002',
} as const;

export const CONSTRUCTION_LOAN_IDS = {
  GROUND_UP: 'seed-cloan-ground-up-001',
  FIX_FLIP: 'seed-cloan-fix-flip-002',
  REHAB: 'seed-cloan-rehab-003',
} as const;

export const DRAW_IDS = {
  DRAW_1_GROUND_UP: 'seed-draw-001',
  DRAW_2_GROUND_UP: 'seed-draw-002',
  DRAW_1_FIX_FLIP: 'seed-draw-003',
  DRAW_1_REHAB: 'seed-draw-004',
} as const;

// ─── Bulk Portfolios ─────────────────────────────────────────────────────────
export const BULK_JOB_IDS = {
  TAPE_EVAL_COMPLETE: 'seed-bulk-job-001',
  TAPE_EVAL_COMPLETE_2: 'seed-bulk-job-002',
  ORDER_CREATION_PARTIAL: 'seed-bulk-job-003',
} as const;

// ─── Review Programs ──────────────────────────────────────────────────────────
export const REVIEW_PROGRAM_IDS = {
  VISION_APPRAISAL_V1: 'seed-review-program-vision-v1',
} as const;

// ─── SLA ──────────────────────────────────────────────────────────────────────
export const SLA_CONFIG_IDS = {
  FULL_APPRAISAL: 'seed-sla-config-full',
  DRIVE_BY: 'seed-sla-config-driveby',
  DESKTOP: 'seed-sla-config-desktop',
} as const;

// ─── Escalations ──────────────────────────────────────────────────────────────
export const ESCALATION_IDS = {
  LATE_DELIVERY: 'seed-escalation-001',
  QC_FAILURE: 'seed-escalation-002',
} as const;

// ─── Revisions ────────────────────────────────────────────────────────────────
export const REVISION_IDS = {
  REVISION_ORDER_010: 'seed-revision-001',
  REVISION_ORDER_002: 'seed-revision-002',
} as const;

// ─── Properties ───────────────────────────────────────────────────────────────
export const PROPERTY_IDS = {
  MOCKINGBIRD_LANE: 'seed-property-001',
  SWISS_AVE: 'seed-property-002',
  LAMAR_ST: 'seed-property-003',
  GREENVILLE_AVE: 'seed-property-004',
  ABRAMS_RD: 'seed-property-005',
  BOULDER_MAIN_ST: 'seed-property-006',
} as const;

// ─── Staff / Users ────────────────────────────────────────────────────────────
export const STAFF_IDS = {
  QC_ANALYST_1: 'seed-user-qc-analyst-001',
  QC_ANALYST_2: 'seed-user-qc-analyst-002',
  ADMIN_1: 'seed-user-admin-001',
  MANAGER_1: 'seed-user-manager-001',
  COORDINATOR_1: 'seed-user-coordinator-001',
} as const;

// ─── PDF Templates ────────────────────────────────────────────────────────────
export const PDF_TEMPLATE_IDS = {
  FORM_1004: 'seed-pdf-template-1004',
} as const;
