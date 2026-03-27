/**
 * Canonical Completion Report Schema — v1.0.0
 *
 * UAD 3.6 / Appendix B-3: Completion Report Implementation Guide v1.4 (2026-03-10) aligned.
 *
 * The Completion Report is a DISTINCT UAD 3.6 document type from the URAR. It is submitted
 * to UCDP to certify that conditions from an original "subject to" appraisal have been
 * satisfied (e.g. subject to repair, subject to completion per plans, subject to inspection).
 *
 * It is ALWAYS linked to a prior URAR with a subject-to condition. No URAR → no Completion Report.
 *
 * Design principles:
 *   1. All interface and type names are prefixed with "Cr" to avoid collision with URAR types.
 *   2. UID references in JSDoc comments use the format (UID: NNNN.NNNN) per Appendix B-3.
 *   3. No types from canonical-schema.ts are imported or extended — the Completion Report
 *      has its own parallel types so this file is fully self-contained and safe for both
 *      agents to work independently without merge conflicts.
 *   4. The frontend maintains an IDENTICAL copy at
 *      src/types/canonical-completion-report.ts — keep both in sync manually.
 *
 * Changelog:
 *   v1.0.0 (2026-03-15) — Initial implementation from Appendix B-3 v1.4 gap analysis.
 *
 * @see docs/URAR_V1.3_COMPLIANCE_AUDIT.md § Appendix C
 * @see docs/samples/Appendix B-3 Completion Report Implementation Guide.txt
 */

export const COMPLETION_REPORT_SCHEMA_VERSION = '1.0.0';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED ENUMERATED TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Known GAP_AgencyAppraiserIdentifierType values from the MISMO 3.4 schema.
 * Used for both `agencyAppraiserIdType` (appraiser-level) and
 * `governmentAgencyType` (assignment-level). (UID: 1000.0123 / 2400.0474)
 */
export type GovernmentAgencyAppraisalType = 'FHA' | 'VA' | 'USDA' | 'Other';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 02 SUPPORTING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Market value condition type for the original appraisal.
 * Drives which sections of the Completion Report are required and visible.
 * (UID: 2800.0002)
 *
 * Note: Two enumeration values were removed in revision 2024-021. The four below
 * are the current valid set per Appendix B-3 v1.4.
 */
export type PropertyValuationConditionalConclusionType =
  | 'AsIs'
  | 'SubjectToCompletionPerPlans'
  | 'SubjectToInspection'
  | 'SubjectToRepair';

/**
 * Generates the Final Value Condition Statement narrative from one or more
 * condition types. Returns null when all conditions are 'AsIs'.
 *
 * Appendix B-3 §02.007: The statement starts with "This appraisal is made",
 * lists applicable phrases joined by ", and", and ends with
 * ". This might have affected the assignment results."
 */
export function generateFinalValueConditionStatement(
  conditions: readonly PropertyValuationConditionalConclusionType[],
): string | null {
  const phraseMap: Partial<Record<PropertyValuationConditionalConclusionType, string>> = {
    SubjectToCompletionPerPlans:
      'subject to completion per plans and specifications on the basis of a hypothetical condition that the improvements have been completed',
    SubjectToInspection:
      'subject to the itemized list of required inspections below based on the extraordinary assumption that the condition or deficiency does not require alteration or repair',
    SubjectToRepair:
      'subject to the itemized list of repairs recommended below on the basis of a hypothetical condition that the repairs or alterations have been completed in a professional manner',
  };

  const applicable = conditions.filter((c) => c !== 'AsIs' && phraseMap[c] !== undefined);
  if (applicable.length === 0) return null;

  const phrases = applicable.map((c) => phraseMap[c] as string).join(', and ');
  return `This appraisal is made ${phrases}. This might have affected the assignment results.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 01 — SUBJECT PROPERTY
// ═══════════════════════════════════════════════════════════════════════════════

/** FID 01: Subject property address. Always displays. */
export interface CrAddress {
  /** (UID: 2800.0024) */
  streetAddress: string;
  /** (UID: 2800.0025) Optional unit identifier. */
  unitIdentifier?: string | null;
  /** (UID: 2800.0026) */
  city: string;
  /** (UID: 2800.0028) 5-digit postal code. */
  postalCode: string;
  /** (UID: 2800.0029) 2-letter state code. */
  state: string;
  /** (UID: 2800.0027) County name. Multi-county note goes to Section 06 Commentary. */
  county: string;
}

/** FID 01-01.003: Section 01 — Subject Property. Always displays. */
export interface CrSubjectProperty {
  address: CrAddress;

  /**
   * Subject property photo.
   * (UID: 1400.0842) ImageCategoryType = "PropertyPhoto".
   * Displayed in Section 01 only — does NOT re-display in Section 07 Exhibits.
   */
  subjectPhotoUrl?: string | null;

  /**
   * Legal description as text.
   * (UID: 2800.0049) Displayed when provided; mutually exclusive with legalDescriptionImageUrl.
   */
  legalDescriptionText?: string | null;

  /**
   * Legal description as an image URL.
   * (UID: 1400.0543) ImageCategoryType = "LegalDescription".
   * Used when legal description is too complex for text form.
   */
  legalDescriptionImageUrl?: string | null;

  /**
   * Caption for the legal description image. Displays above the image in bold.
   * (UID: 1400.0545)
   */
  legalDescriptionCaption?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 02 — ORIGINAL APPRAISAL
// ═══════════════════════════════════════════════════════════════════════════════

/** FID 02.001-02.007: Section 02 — Original Appraisal. Always displays. */
export interface CrOriginalAppraisal {
  /**
   * Effective date of the original appraisal. ISO-8601 date string.
   * (UID: 2800.0032)
   */
  effectiveDate: string;

  /**
   * Opinion of market value from the original appraisal, in USD.
   * (UID: 2800.0033)
   */
  appraisedValue: number;

  /**
   * The condition(s) under which the original value was concluded.
   * One or more values; drives section visibility throughout the form.
   * (UID: 2800.0002)
   */
  marketValueConditions: PropertyValuationConditionalConclusionType[];

  /**
   * Unparsed name of the original appraiser.
   * (UID: 2800.0034)
   */
  appraiserName: string;

  /**
   * Appraiser file/reference identifier from the original appraisal.
   * (UID: 2800.0035)
   */
  appraiserReferenceId: string;

  /**
   * Name of the lender from the original appraisal.
   * (UID: 2800.0046)
   */
  originalLenderName: string;

  /**
   * The Final Value Condition Statement.
   * DERIVED — do NOT store; call generateFinalValueConditionStatement() at render time.
   * Null when all conditions are AsIs.
   * (UID: derived from 2800.0002)
   */
  finalValueConditionStatement?: never;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS 03 & 04 — REPAIR / NEW OBSERVED ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A single repair item — either from the original appraisal (Section 03)
 * or a newly observed item (Section 04).
 *
 * The `isNewlyObserved` flag is the CompletionReportNewDefectIndicator discriminator
 * that determines which XML container and UIDs are used.
 */
export interface CrRepairItem {
  /**
   * false = original repair item (Section 03, UIDs 3900.xxxx)
   * true  = newly observed item (Section 04, UIDs 2800.005x)
   *
   * This field maps to MISMO CompletionReportNewDefectIndicator.
   */
  isNewlyObserved: boolean;

  /**
   * Structural feature category (e.g. Roof, Foundation, Plumbing, Electrical).
   * Section 03 (UID: 3900.0117) / Section 04 (UID: 2800.0052).
   */
  feature: string;

  /**
   * Location within the property (Kitchen, Bathroom, or Other).
   * When "Other", locationOtherDescription is required.
   * Section 03 (UID: 3900.0010) / Section 04 (UID: 2800.0056).
   */
  locationType: string;

  /**
   * Free-text description when locationType = "Other".
   * Section 03 (UID: 3900.0162) / Section 04 (UID: 2800.0057).
   */
  locationOtherDescription?: string | null;

  /**
   * Free-text description of the defect or required repair.
   * Section 03 (UID: 3900.0011) / Section 04 (UID: 2800.0055).
   */
  description: string;

  /**
   * Does this item affect soundness or structural integrity?
   * Section 03 (UID: 3900.0012) / Section 04 (UID: 2800.0054).
   */
  affectsSoundnessOrStructuralIntegrity: boolean;

  // ── Section 03 only ────────────────────────────────────────────────────────
  /**
   * Was the repair completed? Section 03 only (isNewlyObserved = false).
   * (UID: 3900.0016)
   */
  repairCompleted?: boolean | null;

  /**
   * Date the repair was inspected. Section 03 only.
   * ISO-8601 date string. (UID: 3900.0017)
   */
  inspectionDate?: string | null;

  /**
   * Completion comment. Section 03 only. Required when repairCompleted = false.
   * (UID: 3900.0018)
   */
  completionComment?: string | null;

  // ── Section 04 only ────────────────────────────────────────────────────────
  /**
   * Recommended action type. Section 04 only (isNewlyObserved = true).
   * (UID: 3900.0013)
   */
  recommendedActionType?: string | null;

  /**
   * Photos of this specific item. REQUIRED per spec; displayed in Exhibits (Section 07).
   * Images are associated via the DEFECT container in MISMO XML.
   */
  photoUrls: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 05 — COMPLETION STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A single feature that is inconsistent with the original plans/specs.
 * Required when completedPerPlans = false.
 */
export interface CrInconsistentFeature {
  /**
   * Feature description (e.g. "Deck", "Master Bathroom").
   * (UID: 2800.0003)
   */
  feature: string;

  /**
   * Location in the property.
   * (UID: 2800.0004)
   */
  location: string;

  /**
   * How this feature compares to the original plans.
   * (UID: 2800.0005)
   */
  comparisonToPlans: string;

  /**
   * Comment explaining the inconsistency.
   * (UID: 2800.0006)
   */
  comment: string;

  /**
   * Photos of the inconsistent feature. Required; displayed in Exhibits (Section 07).
   * Images are associated via SUBJECT_TO_COMPLETION_ITEM container in MISMO XML.
   */
  photoUrls: string[];
}

/**
 * FID 05: Section 05 — Completion Status.
 * Required when marketValueConditions includes SubjectToCompletionPerPlans.
 */
export interface CrCompletionStatus {
  /**
   * Is construction substantially complete?
   * (UID: 2800.0010) Required. Photos required in Exhibits.
   */
  constructionComplete: boolean;

  /**
   * Was completion consistent with the original plans and specifications?
   * Only applicable when constructionComplete = true. (UID: 2800.0011)
   */
  completedPerPlans?: boolean | null;

  /**
   * Photos of the completed construction. Required when constructionComplete = true.
   * (ImageCategoryType: "CompletedConstruction")
   */
  completedConstructionPhotoUrls: string[];

  /**
   * Items that are inconsistent with original plans.
   * Required and non-empty when completedPerPlans = false.
   */
  inconsistentFeatures: CrInconsistentFeature[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 07 — ADDITIONAL EXHIBITS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valid ImageCategoryType values for Completion Report exhibits.
 * Appendix B-3 §07 / UID 1400.0944 (except PropertyPhoto = 1400.0842).
 */
export type CrImageCategoryType =
  | 'PropertyPhoto'                                        // UID: 1400.0842 — Section 01 only
  | 'LegalDescription'                                     // UID: 1400.0543 — Section 01
  | 'CompletedConstruction'                                // UID: 1400.0849 — Section 05
  | 'DwellingFront'                                        // UID: 1400.0944 — Section 07
  | 'DwellingRear'                                         // UID: 1400.0944
  | 'ManufacturedHomeHUDDataPlate'                         // UID: 1400.0944
  | 'ManufacturedHomeHUDCertificationLabel'                // UID: 1400.0944
  | 'ManufacturedHomeFinancingProgramEligibilityCertification' // UID: 1400.0944
  | 'ValuationCompletionExhibit';                          // UID: 1400.0944 — catch-all

/** A standalone exhibit not already attached to a repair/completion item. */
export interface CrExhibit {
  imageUrl: string;
  /** (UID: 1400.0944 / applies to most) */
  imageCategoryType: CrImageCategoryType;
  /**
   * Caption. Displays above the image in bold font per spec.
   * (UID: 1400.0943)
   */
  caption?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 08 — ASSIGNMENT INFORMATION
// ═══════════════════════════════════════════════════════════════════════════════

/** Contact party — used for Client, Lender, AMC, and non-client contacts. */
export interface CrContactParty {
  /**
   * Role(s) this party plays.
   * Client (2400.0367), Lender (2400.0365), ManagementCompany (2400.0365), etc.
   */
  primaryRole: string;
  secondaryRole?: string | null;
  companyName: string;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  /** AMC license ID. (UID: 2400.0363) ManagementCompany only. */
  licenseId?: string | null;
  /** AMC license state. (UID: 2400.0364) ManagementCompany only. */
  licenseState?: string | null;
  /** AMC license expiration. (UID: 2400.0362) ManagementCompany only. */
  licenseExpires?: string | null;
}

/** Appraiser or supervisory appraiser assignment details. */
export interface CrAppraiserAssignment {
  // ── Name ────────────────────────────────────────────────────────────────────
  /** (UID: 2200.0126) */
  firstName: string;
  middleName?: string | null;
  /** (UID: 2200.0129) */
  lastName: string;
  suffixName?: string | null;

  // ── Scope of inspection ─────────────────────────────────────────────────────
  /**
   * Exterior inspection method. (UID: 2400.0293)
   * e.g. "Personal" | "None" | "Virtual"
   */
  exteriorInspectionMethod?: string | null;
  /**
   * Interior inspection method. (UID: 2400.0294)
   * e.g. "Personal" | "None" | "Virtual"
   */
  interiorInspectionMethod?: string | null;
  /**
   * Date of property inspection. ISO-8601. (UID: 2400.0292)
   */
  inspectionDate?: string | null;

  // ── License / credentials ───────────────────────────────────────────────────
  /** (UID: 2200.0131) e.g. "CertifiedResidential" | "CertifiedGeneral" | "Licensed" | "Trainee" */
  licenseType: string;
  /** (UID: 2200.0134) */
  licenseId: string;
  /** (UID: 2200.0135) 2-letter state code. */
  licenseState: string;
  /** (UID: 2200.0133) ISO-8601 date. */
  licenseExpires: string;

  // ── Professional IDs ────────────────────────────────────────────────────────
  /** ASC national registry ID. (UID: 2400.0470) */
  ascId?: string | null;
  /** Designation (MAI, SRA, etc.). (UID: 2400.0475) */
  designation?: string | null;
  /** FHA/VA agency appraiser ID. (UID: 2400.0473) */
  agencyAppraiserId?: string | null;
  /** Agency type for agencyAppraiserId: "FHA" | "VA". (UID: 2400.0474) */
  agencyAppraiserIdType?: 'FHA' | 'VA' | null;
  /** VA employment type. (UID: 2400.0472) VA only. */
  vaEmploymentType?: string | null;

  // ── Company ─────────────────────────────────────────────────────────────────
  /** (UID: 2400.0471) */
  companyName?: string | null;
  companyAddressLine?: string | null;
  companyCity?: string | null;
  companyState?: string | null;
  companyPostalCode?: string | null;

  // ── Certification — personal inspection indicator ───────────────────────────
  /**
   * Did the appraiser personally inspect the property?
   * Drives the text of Certification 6 in Section 09. (UID: 2200.0027)
   */
  personalInspectionPerformed: boolean;

  /**
   * If personalInspectionPerformed = false, this verification statement is required.
   * (UID: 2200.0026)
   */
  conditionsSatisfiedVerificationDescription?: string | null;
}

/** FID 08.001-08.043: Section 08 — Assignment Information. Always displays. */
export interface CrAssignmentInformation {
  // ── Borrower ─────────────────────────────────────────────────────────────────
  /** Borrower first name. (UID: 1000.0147) */
  borrowerFirstName?: string | null;
  borrowerMiddleName?: string | null;
  /** (UID: 1000.0151) */
  borrowerLastName?: string | null;
  borrowerSuffix?: string | null;
  /** Used instead of parsed name when borrower is a legal entity. (UID: 1000.0151) */
  borrowerLegalEntityName?: string | null;

  // ── Fees ─────────────────────────────────────────────────────────────────────
  /** Appraiser fee in USD. FeeType="AppraisalFee". (UID: 1000.0167) */
  appraisalFee?: number | null;
  /** AMC fee in USD. FeeType="AppraisalManagementCompanyFee". (UID: 1000.0157) */
  amcFee?: number | null;

  // ── Government / investor ───────────────────────────────────────────────────
  /** Is this a government agency appraisal? (UID: 1000.0122) */
  governmentAgencyAppraisal?: boolean | null;
  /** Agency type. (UID: 1000.0123) */
  governmentAgencyType?: GovernmentAgencyAppraisalType | null;
  /** Investor requested special ID. (UID: 1000.0126) */
  investorRequestedId?: string | null;

  // ── Clients ──────────────────────────────────────────────────────────────────
  /** Client, lender, and/or AMC contact parties. One or more. */
  clientParties: CrContactParty[];

  // ── Appraiser ────────────────────────────────────────────────────────────────
  appraiser: CrAppraiserAssignment;

  // ── Supervisory Appraiser ────────────────────────────────────────────────────
  /** Only populated when a supervisory appraiser is required / present. */
  supervisoryAppraiser?: CrAppraiserAssignment | null;

  // ── Scope of Work Commentary ─────────────────────────────────────────────────
  /**
   * Scope of work narrative. (UID: 1000.0131)
   * ValuationAnalysisCategoryType = "Assignment".
   */
  scopeOfWorkCommentary?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 09 — CERTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Execution date and optional signature details for one signing party. */
export interface CrSignature {
  /**
   * Date the report was signed. ISO-8601. (UID: 2200.0002 ExecutionDate)
   */
  executionDate: string;
  /**
   * Signing party role. "Appraiser" | "AppraiserSupervisor".
   * Drives which arcrole RELATIONSHIP is generated in MISMO XML.
   */
  partyRole: 'Appraiser' | 'AppraiserSupervisor';
}

/** FID 09: Section 09 — Certifications metadata. Always displays. */
export interface CrCertifications {
  /**
   * Appraiser signature date. Required. (UID: 2200.0002)
   */
  appraiserSignature: CrSignature;

  /**
   * Supervisory appraiser signature. Required when supervisoryAppraiser is present.
   */
  supervisoryAppraiserSignature?: CrSignature | null;

  /**
   * Additional certification text beyond the 7 standard certs.
   * (UID: 2200.0052 AppraiserAdditionalCertificationIndicator)
   */
  additionalCertifications?: string | null;

  /**
   * Government agency intended use. Displayed when GovernmentAgencyAppraisalType = "FHA".
   * (UID: 2200.0012 ValuationIntendedUseDescription)
   */
  additionalIntendedUse?: string | null;

  /**
   * Additional intended users present? (UID: 2200.0055)
   */
  additionalIntendedUsersPresent?: boolean | null;

  /**
   * Description of additional intended users. (UID: 2200.0011)
   */
  additionalIntendedUsersDescription?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEADER / FOOTER
// ═══════════════════════════════════════════════════════════════════════════════

/** Reference IDs that appear in the Completion Report header/footer on every page. */
export interface CrHeaderFooterIds {
  /**
   * Appraiser's internal file reference number. (UID: 2100.0029)
   * Identical to the URAR reference number for this assignment.
   */
  appraiserFileIdentifier: string;

  /** FHA/government agency case file ID. (UID: 2100.0023) When type = "GovernmentAgency". */
  agencyCaseFileId?: string | null;
  /** Client-assigned reference ID. (UID: 2100.0021) When type = "Client". */
  clientReferenceId?: string | null;
  /** AMC-assigned reference ID. (UID: 2100.0025) When type = "ManagementCompany". */
  amcReferenceId?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP-LEVEL COMPLETION REPORT DOCUMENT (Cosmos container: reporting)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The top-level Completion Report document stored in the `reporting` container.
 *
 * reportType MUST be "CompletionReport" to distinguish from CanonicalReportDocument
 * (which uses URAR form codes "1004", "1073", etc.).
 *
 * Section visibility rules (from Appendix B-3 §C.14):
 *   Section 01 Subject Property     — Always
 *   Section 02 Original Appraisal   — Always
 *   Section 03 Itemized Repairs      — When marketValueConditions includes SubjectToRepair
 *   Section 04 New Observed Items    — When newlyObservedItems.length > 0
 *   Section 05 Completion Status     — When marketValueConditions includes SubjectToCompletionPerPlans
 *   Section 06 Commentary            — When completionCommentary provided
 *   Section 07 Exhibits              — When any images provided
 *   Section 08 Assignment Info       — Always
 *   Section 09 Certifications        — Always
 */
export interface CanonicalCompletionReport {
  // ── Cosmos document metadata ────────────────────────────────────────────────
  id: string;
  reportId: string;
  orderId: string;
  /** FK → the CanonicalReportDocument (URAR) this completion report certifies. */
  originalReportId: string;
  reportType: 'CompletionReport';
  status: string;
  schemaVersion: string; // must equal COMPLETION_REPORT_SCHEMA_VERSION

  // ── Header/footer reference IDs ─────────────────────────────────────────────
  headerFooterIds: CrHeaderFooterIds;

  // ── Section 01 ──────────────────────────────────────────────────────────────
  subjectProperty: CrSubjectProperty;

  // ── Section 02 ──────────────────────────────────────────────────────────────
  originalAppraisal: CrOriginalAppraisal;

  // ── Section 03: original appraisal repair items (isNewlyObserved = false) ───
  /**
   * Only populated when originalAppraisal.marketValueConditions includes SubjectToRepair.
   */
  repairItems: CrRepairItem[];

  // ── Section 04: newly observed items (isNewlyObserved = true) ───────────────
  /**
   * Items observed during the completion inspection that were NOT in the original appraisal.
   * Visible whenever this array is non-empty.
   */
  newlyObservedItems: CrRepairItem[];

  // ── Section 05 ──────────────────────────────────────────────────────────────
  /**
   * Only populated when marketValueConditions includes SubjectToCompletionPerPlans.
   */
  completionStatus?: CrCompletionStatus | null;

  // ── Section 06 ──────────────────────────────────────────────────────────────
  /**
   * General Completion Report commentary. (UID: 2800.0007 AppraisalCompletionCommentText)
   * MISMO container: VALUATION_COMPLETION_DETAIL.
   */
  completionCommentary?: string | null;

  // ── Section 07: additional exhibits not attached to a specific item ──────────
  additionalExhibits: CrExhibit[];

  // ── Section 08 ──────────────────────────────────────────────────────────────
  assignmentInformation: CrAssignmentInformation;

  // ── Section 09 ──────────────────────────────────────────────────────────────
  certifications: CrCertifications;

  // ── Cosmos metadata ────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
