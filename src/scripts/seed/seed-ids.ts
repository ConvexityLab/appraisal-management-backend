/**
 * Shared Seed IDs — single source of truth for all cross-referenced seed data.
 *
 * Every seed module imports IDs from here so foreign-key relationships
 * are consistent regardless of execution order.
 *
 * Convention: all IDs use a `seed-` prefix to make cleanup easy.
 */

// ─── Clients (sub-client records under the platform customer) ────────────────
export const CLIENT_IDS = {
  FIRST_HORIZON: 'seed-client-lender-firsthorizon-001',
  PACIFIC_COAST: 'seed-client-lender-pacificcoast-002',
  NATIONAL_AMC: 'seed-client-amc-nationalamc-003',
  CLEARPATH: 'seed-client-amc-clearpath-004',
  SUNCOAST: 'seed-client-broker-suncoast-005',
  FIRST_TECH_CU: 'seed-client-cu-firsttechfcu-006',
} as const;

/**
 * Short sub-client slugs used for config/Axiom routing.
 * Maps 1:1 with CLIENT_IDS — the slug is the canonical subClientId
 * that appears on orders, engagements, SLA configs, criteria lookups, etc.
 */
export const SUB_CLIENT_SLUGS: Record<string, string> = {
  [CLIENT_IDS.FIRST_HORIZON]: 'firsthorizon',
  [CLIENT_IDS.PACIFIC_COAST]: 'pacificcoast',
  [CLIENT_IDS.NATIONAL_AMC]: 'nationalamc',
  [CLIENT_IDS.CLEARPATH]: 'clearpath',
  [CLIENT_IDS.SUNCOAST]: 'suncoast',
  [CLIENT_IDS.FIRST_TECH_CU]: 'firsttechfcu',
};

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
  // CA vendors
  JAMES_WILLIAMS_CA: 'seed-vendor-ca-james-williams',
  MARIA_RODRIGUEZ_CA: 'seed-vendor-ca-maria-rodriguez',
  DAVID_CHEN_CA: 'seed-vendor-ca-david-chen',
  SARAH_THOMPSON_CA: 'seed-vendor-ca-sarah-thompson',
  ROBERT_MARTINEZ_CA: 'seed-vendor-ca-robert-martinez',
  // TX extended
  JENNIFER_LEE_TX: 'seed-vendor-tx-jennifer-lee',
  MICHAEL_JOHNSON_TX: 'seed-vendor-tx-michael-johnson',
  // FL vendors
  AMANDA_WILSON_FL: 'seed-vendor-fl-amanda-wilson',
} as const;

// ─── Appraisers (stored in vendors container, type='appraiser') ───────────────
export const APPRAISER_IDS = {
  MICHAEL_THOMPSON: 'seed-appraiser-001',
  PATRICIA_NGUYEN: 'seed-appraiser-002',
  KEVIN_OKAFOR: 'seed-appraiser-003',
  ANGELA_REEVES_CA: 'seed-appraiser-ca-001',
  BRIAN_KOWALSKI_CA: 'seed-appraiser-ca-002',
  FRANK_MORRISON_CA: 'seed-appraiser-ca-003',
  CARMEN_DELGADO_TX: 'seed-appraiser-tx-001',
  DANIEL_PARK_TX: 'seed-appraiser-tx-002',
  ELENA_VASQUEZ_FL: 'seed-appraiser-fl-001',
} as const;

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ORDER_IDS = {
  /** COMPLETED — full 1004, passed QC, delivered */
  COMPLETED_001: 'SEED-VO-00101',
  /** QC_REVIEW — pending QC analyst assignment */
  QC_REVIEW_002: 'SEED-VO-00102',
  /** IN_PROGRESS — rush, inspection completed */
  IN_PROGRESS_003: 'SEED-VO-00103',
  /** PENDING_ASSIGNMENT — new, awaiting RFB */
  PENDING_004: 'SEED-VO-00104',
  /** NEW — just received from client */
  NEW_005: 'SEED-VO-00105',
  /** IN_PROGRESS — fix-and-flip, ARV analysis */
  FIX_FLIP_006: 'SEED-VO-00106',
  /** ASSIGNED — vendor assigned, awaiting acceptance */
  ASSIGNED_007: 'SEED-VO-00107',
  /** ACCEPTED — vendor accepted, inspection scheduled */
  ACCEPTED_008: 'SEED-VO-00108',
  /** SUBMITTED — report submitted, awaiting QC */
  SUBMITTED_009: 'SEED-VO-00109',
  /** REVISION_REQUESTED — QC found issues */
  REVISION_010: 'SEED-VO-00110',
  /** CANCELLED — client cancelled */
  CANCELLED_011: 'SEED-VO-00111',
  /** COMPLETED — drive-by, routine */
  COMPLETED_DRIVEBY_012: 'SEED-VO-00112',
} as const;

/** @deprecated ID and orderNumber are now the same value. Use ORDER_IDS directly. */
export const ORDER_NUMBERS: Record<string, string> = {
  [ORDER_IDS.COMPLETED_001]: ORDER_IDS.COMPLETED_001,
  [ORDER_IDS.QC_REVIEW_002]: ORDER_IDS.QC_REVIEW_002,
  [ORDER_IDS.IN_PROGRESS_003]: ORDER_IDS.IN_PROGRESS_003,
  [ORDER_IDS.PENDING_004]: ORDER_IDS.PENDING_004,
  [ORDER_IDS.NEW_005]: ORDER_IDS.NEW_005,
  [ORDER_IDS.FIX_FLIP_006]: ORDER_IDS.FIX_FLIP_006,
  [ORDER_IDS.ASSIGNED_007]: ORDER_IDS.ASSIGNED_007,
  [ORDER_IDS.ACCEPTED_008]: ORDER_IDS.ACCEPTED_008,
  [ORDER_IDS.SUBMITTED_009]: ORDER_IDS.SUBMITTED_009,
  [ORDER_IDS.REVISION_010]: ORDER_IDS.REVISION_010,
  [ORDER_IDS.CANCELLED_011]: ORDER_IDS.CANCELLED_011,
  [ORDER_IDS.COMPLETED_DRIVEBY_012]: ORDER_IDS.COMPLETED_DRIVEBY_012,
};

// ─── QC ───────────────────────────────────────────────────────────────────────
export const QC_CHECKLIST_IDS = {
  UAD_STANDARD: 'seed-checklist-uad-standard-2026',
} as const;

export const QC_CHECKLIST_ASSIGNMENT_IDS = {
  /** UAD checklist → First Horizon (appraisal) */
  UAD_FIRST_HORIZON: 'seed-qc-assignment-uad-firsthorizon',
  /** UAD checklist → Pacific Coast (BPO) */
  UAD_PACIFIC_COAST: 'seed-qc-assignment-uad-pacificcoast',
  /** UAD checklist → National AMC (portfolio BPO + drive-by) */
  UAD_NATIONAL_AMC: 'seed-qc-assignment-uad-nationalamc',
} as const;

export const QC_REVIEW_IDS = {
  REVIEW_ORDER_001: 'seed-qc-review-001',
  REVIEW_ORDER_002: 'seed-qc-review-002',
  REVIEW_ORDER_009: 'seed-qc-review-009',
  /** REVISION_REQUESTED order — completed QC with REVISION_REQUIRED result that triggered the revision */
  REVIEW_ORDER_010: 'seed-qc-review-010',
  ENHANCED_AI_REVIEW: 'seed-qc-review-enhanced-001',
  /** Full QCValidationReport with questions[], evidence, and criteria — drives the rich Evidence Panel */
  FULL_VALIDATION_REPORT_001: 'seed-qc-review-full-report-001',
} as const;

// ─── Documents ────────────────────────────────────────────────────────────────
export const DOCUMENT_IDS = {
  REPORT_ORDER_001: 'seed-doc-report-001',
  ENGAGEMENT_ORDER_001: 'seed-doc-engagement-001',
  PHOTOS_ORDER_003: 'seed-doc-photos-003',
  REPORT_ORDER_003: 'seed-doc-report-003',
  REPORT_ORDER_009: 'seed-doc-report-009',
  REPORT_ORDER_012: 'seed-doc-report-012',
  // Vendor-scoped
  VENDOR_LICENSE: 'seed-doc-vendor-license',
  VENDOR_INSURANCE: 'seed-doc-vendor-insurance',
  VENDOR_W9: 'seed-doc-vendor-w9',
  // Appraiser-scoped
  APPRAISER_LICENSE: 'seed-doc-appraiser-license',
  APPRAISER_COMPLIANCE: 'seed-doc-appraiser-compliance',
} as const;

// ─── Communications ───────────────────────────────────────────────────────────
export const COMM_IDS = {
  SMS_ASSIGN_003: 'seed-comm-sms-001',
  SMS_CONFIRM_003: 'seed-comm-sms-002',
  EMAIL_DELIVERED_001: 'seed-comm-email-001',
  EMAIL_QC_PASS_001: 'seed-comm-email-002',
  // Engagement-level communications (not tied to a specific order)
  EMAIL_ENG_KICKOFF_004: 'seed-comm-email-eng-001',
  EMAIL_ENG_STATUS_004: 'seed-comm-email-eng-002',
  SMS_ENG_REMINDER_004: 'seed-comm-sms-eng-003',
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

// ─── Communication Platform ──────────────────────────────────────────────────
export const COMM_PLATFORM_IDS = {
  ACS_USER_COORDINATOR: 'seed-acs-user-coordinator',
  ACS_USER_VENDOR_001: 'seed-acs-user-vendor-001',
  ACS_USER_VENDOR_002: 'seed-acs-user-vendor-002',
  ACS_USER_APPRAISER_001: 'seed-acs-user-appraiser-001',
  ACS_USER_APPRAISER_002: 'seed-acs-user-appraiser-002',
  ACS_USER_APPRAISER_003: 'seed-acs-user-appraiser-003',
  CTX_ORDER_001: 'seed-ctx-order-001',
  CTX_ORDER_002: 'seed-ctx-order-002',
  CTX_ORDER_003: 'seed-ctx-order-003',
  CTX_ORDER_005: 'seed-ctx-order-005',
  MTG_ORDER_002: 'seed-teams-mtg-order-002',
  MTG_ORDER_003: 'seed-teams-mtg-order-003',
  MTG_ORDER_005: 'seed-teams-mtg-order-005',
} as const;

// ─── Construction ─────────────────────────────────────────────────────────────
export const CONTRACTOR_IDS = {
  APEX_BUILD: 'seed-gc-001',
  SWIFT_RENO: 'seed-gc-002',
  RIDGELINE: 'seed-gc-003',
  SUMMIT_PEAK: 'seed-gc-004',
  CLEARWATER: 'seed-gc-005',
  FRONT_RANGE_ELEC: 'seed-sub-001',
  ROCKY_MTN_PLUMBING: 'seed-sub-002',
} as const;

export const CONSTRUCTION_LOAN_IDS = {
  GROUND_UP: 'seed-cloan-ground-up-001',
  FIX_FLIP: 'seed-cloan-fix-flip-002',
  REHAB: 'seed-cloan-rehab-003',
  MULTIFAMILY: 'seed-cloan-multifam-004',
  COMPLETED: 'seed-cloan-completed-005',
} as const;

export const BUDGET_IDS = {
  GROUND_UP: 'seed-budget-001',
  FIX_FLIP: 'seed-budget-002',
  MULTIFAMILY: 'seed-budget-003',
  REHAB: 'seed-budget-004',
  COMPLETED: 'seed-budget-005',
} as const;

export const DRAW_IDS = {
  DRAW_1_GROUND_UP: 'seed-draw-001',
  DRAW_2_GROUND_UP: 'seed-draw-002',
  DRAW_1_FIX_FLIP: 'seed-draw-003',
  DRAW_1_REHAB: 'seed-draw-004',
  DRAW_2_FIX_FLIP: 'seed-draw-005',
  DRAW_1_MULTIFAMILY: 'seed-draw-006',
  DRAW_2_MULTIFAMILY: 'seed-draw-007',
  DRAW_3_GROUND_UP: 'seed-draw-008',
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

// ─── Internal Staff (vendors container, staffType='internal') ─────────────────
export const INTERNAL_STAFF_IDS = {
  SARAH_CHEN_TX_APPRAISER: 'seed-staff-internal-appraiser-001',
  JAMES_OKONKWO_TX_REVIEWER: 'seed-staff-internal-reviewer-001',
  DIANA_MORALES_TX_SUPERVISOR: 'seed-staff-internal-supervisor-001',
} as const;

// ─── PDF Templates (legacy AcroForm template) ─────────────────────────────────
export const PDF_TEMPLATE_IDS = {
  FORM_1004: 'seed-pdf-template-1004',
} as const;

// ─── HTML Report Templates (html-render strategy via Playwright/Handlebars) ────
export const REPORT_TEMPLATE_IDS = {
  URAR_1004_V1:     'seed-report-template-urar-1004-v1',
  /** Vision VMC-branded redesign with UAD 3.6 conditional sections. */
  URAR_1004_V2:     'seed-report-template-urar-1004-v2',
  DVR_BPO_V1:       'seed-report-template-dvr-bpo-v1',
  /** Desk Review – Non-Owner Occupied (DVR-10) — desktop-only, no physical inspection. */
  DVR_DESK_REVIEW_V1: 'seed-report-template-dvr-desk-review-v1',
  /** DVR Non-Owner Occupied Review — appraisal review form matching actual DVR-10 Vision VMC PDF. */
  DVR_NOO_REVIEW_V1: 'seed-report-template-dvr-noo-review-v1',
  /** DVR NOO Desktop Review — same appraisal review fields, URAR v2 navy/gold design system. */
  DVR_NOO_DESKTOP_V1: 'seed-report-template-dvr-noo-desktop-v1',
} as const;

// ─── Negotiation (Phase2 — round-by-round) ────────────────────────────────────
export const NEGOTIATION_IDS = {
  ACCEPTED_DIRECT: 'seed-negotiation-phase2-accepted-001',
  ACCEPTED_COUNTERED: 'seed-negotiation-phase2-countered-001',
  REJECTED: 'seed-negotiation-phase2-rejected-001',
  ACTIVE_COUNTER: 'seed-negotiation-phase2-active-001',
} as const;

// ─── Construction Cost Catalog (division-based IDs) ───────────────────────────
export const TENANT_CONFIG_IDS = {
  CONSTRUCTION: 'seed-tenant-construction-config',
} as const;

// ─── Engagements ──────────────────────────────────────────────────────────────
export const ENGAGEMENT_IDS = {
  /** SINGLE, Full Appraisal, IN_PROGRESS — First Horizon */
  SINGLE_FULL_APPRAISAL_001: 'SEED-ENG-2026-00201',
  /** SINGLE, BPO, IN_PROGRESS (BPO site visit awaiting) — Pacific Coast */
  SINGLE_BPO_002: 'SEED-ENG-2026-00202',
  /** PORTFOLIO (2 loans: BPO + Drive-By), IN_PROGRESS — National AMC */
  PORTFOLIO_BPO_DRIVEBY_003: 'SEED-ENG-2026-00203',
  /** SINGLE, Full Appraisal, DELIVERED — First Horizon */
  SINGLE_DELIVERED_004: 'SEED-ENG-2026-00204',
  /** SINGLE, Hybrid, QC — ClearPath AMC */
  SINGLE_HYBRID_005: 'SEED-ENG-2026-00205',
} as const;

// ─── Reports (canonical reporting container) ──────────────────────────────────
export const REPORT_IDS = {
  /** Full 1004 — completed, all 6 comps selected */
  FULL_1004_ORDER_001: 'seed-report-001',
  /** Full 1004 — in progress, 3 sold + 2 candidates */
  FULL_1004_ORDER_003: 'seed-report-003',
} as const;

// ─── Inspections (InspectionAppointment docs in 'orders' container) ────────────
export const INSPECTION_IDS = {
  /** Completed property inspection — Order 001 */
  COMPLETED_ORDER_001: 'seed-inspection-001',
  /** In-progress property inspection — Order 003 */
  IN_PROGRESS_ORDER_003: 'seed-inspection-003',
  /** Confirmed upcoming property inspection — Order 008 */
  SCHEDULED_ORDER_008: 'seed-inspection-008',
  /** Scheduled BPO site visit — Engagement 002 */
  BPO_SITE_VISIT_004: 'seed-inspection-bpo-004',
  /** Completed appraisal appointment — Order 009 / Engagement 005 */
  APPRAISAL_APPT_005: 'seed-inspection-appraisal-005',
  /** Cancelled inspection — Order 011 */
  CANCELLED_ORDER_011: 'seed-inspection-cancelled-011',
  /** Completed BPO site visit — Order 012 / Portfolio ENG-003 */
  BPO_COMPLETED_007: 'seed-inspection-bpo-completed-007',
} as const;
