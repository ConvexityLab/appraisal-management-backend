/**
 * Completion Report Mapper
 *
 * Validates a CanonicalCompletionReport and produces a "generation-ready"
 * snapshot that the CompletionReportXmlGenerator can consume directly.
 *
 * Responsibilities:
 *  - Validate that required sections are present given the marketValueConditions
 *  - Resolve the finalValueConditionStatement at map time (not stored on the doc)
 *  - Normalise optional arrays to empty arrays for safe iteration in the generator
 *  - Fail fast with actionable messages for every missing required value
 *
 * NOT responsible for:
 *  - Fetching data from Cosmos / Blob (callers must pass a fully-loaded doc)
 *  - Creating or modifying the CanonicalCompletionReport document
 *  - Any MISMO XML concerns
 *
 * @see src/services/completion-report-xml-generator.service.ts
 * @see docs/URAR_V1.3_COMPLIANCE_AUDIT.md § Appendix C
 */

import {
  CanonicalCompletionReport,
  CrRepairItem,
  generateFinalValueConditionStatement,
  PropertyValuationConditionalConclusionType,
} from '../types/canonical-completion-report.js';

// ─── Output type ─────────────────────────────────────────────────────────────

/**
 * The generator-ready intermediate produced by this mapper.
 * All arrays are guaranteed non-null / non-undefined.
 * finalValueConditionStatement is resolved.
 */
export interface CompletionReportGenerationContext {
  doc: CanonicalCompletionReport;
  finalValueConditionStatement: string | null;
  repairItems: CrRepairItem[];
  newlyObservedItems: CrRepairItem[];
  showSection03: boolean; // SubjectToRepair present
  showSection04: boolean; // newlyObservedItems non-empty
  showSection05: boolean; // SubjectToCompletionPerPlans present
  showSection06: boolean; // completionCommentary provided
  showSection07: boolean; // any images present
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

export class CompletionReportMapper {
  /**
   * Map and validate a CanonicalCompletionReport into a generation context.
   *
   * Throws an Error with a descriptive message if required data is missing.
   * Callers should catch and surface this as HTTP 422 Unprocessable Entity.
   */
  map(doc: CanonicalCompletionReport): CompletionReportGenerationContext {
    this._validateCore(doc);

    const conditions: PropertyValuationConditionalConclusionType[] =
      doc.originalAppraisal.marketValueConditions;

    const showSection03 = conditions.includes('SubjectToRepair');
    const showSection04 = (doc.newlyObservedItems?.length ?? 0) > 0;
    const showSection05 = conditions.includes('SubjectToCompletionPerPlans');
    const showSection06 = !!doc.completionCommentary;

    if (showSection03) {
      this._validateRepairItems(doc, false);
    }
    if (showSection04) {
      this._validateRepairItems(doc, true);
    }
    if (showSection05) {
      this._validateCompletionStatus(doc);
    }

    this._validateAssignment(doc);
    this._validateCertifications(doc);

    const repairItems = (doc.repairItems ?? []).filter((i) => !i.isNewlyObserved);
    const newlyObservedItems = (doc.newlyObservedItems ?? []).filter((i) => i.isNewlyObserved);

    // Any images present across all sections → show Exhibits
    const hasImages =
      !!doc.subjectProperty.subjectPhotoUrl ||
      !!doc.subjectProperty.legalDescriptionImageUrl ||
      repairItems.some((i) => i.photoUrls.length > 0) ||
      newlyObservedItems.some((i) => i.photoUrls.length > 0) ||
      (doc.completionStatus?.completedConstructionPhotoUrls.length ?? 0) > 0 ||
      (doc.completionStatus?.inconsistentFeatures.some((f) => f.photoUrls.length > 0) ?? false) ||
      (doc.additionalExhibits?.length ?? 0) > 0;

    return {
      doc,
      finalValueConditionStatement: generateFinalValueConditionStatement(conditions),
      repairItems,
      newlyObservedItems,
      showSection03,
      showSection04,
      showSection05,
      showSection06,
      showSection07: hasImages,
    };
  }

  // ─── Private validators ────────────────────────────────────────────────────

  private _validateCore(doc: CanonicalCompletionReport): void {
    if (doc.reportType !== 'CompletionReport') {
      throw new Error(
        `CompletionReportMapper: reportType must be 'CompletionReport', got '${doc.reportType}'. ` +
          `Pass a CanonicalCompletionReport document, not a CanonicalReportDocument.`,
      );
    }
    if (!doc.id) throw new Error(`CompletionReportMapper: doc.id is required.`);
    if (!doc.orderId) throw new Error(`CompletionReportMapper: doc.orderId is required.`);
    if (!doc.originalReportId) {
      throw new Error(
        `CompletionReportMapper: doc.originalReportId is required — ` +
          `a Completion Report must reference the URAR it certifies.`,
      );
    }

    // Section 01 — Subject property
    const addr = doc.subjectProperty?.address;
    if (!addr) {
      throw new Error(`CompletionReportMapper: subjectProperty.address is required.`);
    }
    const requiredAddressFields = ['streetAddress', 'city', 'postalCode', 'state', 'county'] as const;
    for (const f of requiredAddressFields) {
      if (!addr[f]) {
        throw new Error(
          `CompletionReportMapper: subjectProperty.address.${f} is required but was '${addr[f]}'.`,
        );
      }
    }

    // Section 02 — Original appraisal
    const oa = doc.originalAppraisal;
    if (!oa) throw new Error(`CompletionReportMapper: originalAppraisal is required.`);
    if (!oa.effectiveDate) {
      throw new Error(`CompletionReportMapper: originalAppraisal.effectiveDate is required.`);
    }
    if (oa.appraisedValue == null) {
      throw new Error(`CompletionReportMapper: originalAppraisal.appraisedValue is required.`);
    }
    if (!oa.marketValueConditions || oa.marketValueConditions.length === 0) {
      throw new Error(
        `CompletionReportMapper: originalAppraisal.marketValueConditions must have at least one entry.`,
      );
    }
    if (!oa.appraiserName) {
      throw new Error(`CompletionReportMapper: originalAppraisal.appraiserName is required.`);
    }
    if (!oa.appraiserReferenceId) {
      throw new Error(`CompletionReportMapper: originalAppraisal.appraiserReferenceId is required.`);
    }
    if (!oa.originalLenderName) {
      throw new Error(`CompletionReportMapper: originalAppraisal.originalLenderName is required.`);
    }
  }

  /** Validate repair or newly-observed items (isNewlyObserved discriminates). */
  private _validateRepairItems(doc: CanonicalCompletionReport, isNew: boolean): void {
    const items = isNew ? doc.newlyObservedItems : doc.repairItems;
    const section = isNew ? 'Section 04 (New Observed Items)' : 'Section 03 (Repair Items)';

    if (!items || items.length === 0) {
      throw new Error(
        `CompletionReportMapper: ${section} is required when ` +
          `${isNew ? 'newlyObservedItems is non-empty' : "marketValueConditions includes 'SubjectToRepair'"}, ` +
          `but no items were provided.`,
      );
    }

    items.forEach((item, idx) => {
      if (!item.feature) {
        throw new Error(`CompletionReportMapper: ${section} item[${idx}].feature is required.`);
      }
      if (!item.description) {
        throw new Error(`CompletionReportMapper: ${section} item[${idx}].description is required.`);
      }
      if (!isNew && item.repairCompleted === false && !item.completionComment) {
        throw new Error(
          `CompletionReportMapper: ${section} item[${idx}] has repairCompleted=false ` +
            `but completionComment is missing. A comment explaining incomplete repairs is required.`,
        );
      }
    });
  }

  /** Validate Section 05 completion status. */
  private _validateCompletionStatus(doc: CanonicalCompletionReport): void {
    const cs = doc.completionStatus;
    if (!cs) {
      throw new Error(
        `CompletionReportMapper: completionStatus is required when ` +
          `marketValueConditions includes 'SubjectToCompletionPerPlans', but was not provided.`,
      );
    }
    if (cs.constructionComplete && cs.completedPerPlans === false) {
      if (!cs.inconsistentFeatures || cs.inconsistentFeatures.length === 0) {
        throw new Error(
          `CompletionReportMapper: completionStatus.inconsistentFeatures must be non-empty ` +
            `when completedPerPlans=false.`,
        );
      }
      cs.inconsistentFeatures.forEach((f, idx) => {
        if (!f.feature) {
          throw new Error(
            `CompletionReportMapper: completionStatus.inconsistentFeatures[${idx}].feature is required.`,
          );
        }
        if (!f.comment) {
          throw new Error(
            `CompletionReportMapper: completionStatus.inconsistentFeatures[${idx}].comment is required.`,
          );
        }
      });
    }
  }

  /** Validate Section 08 — assignment and appraiser. */
  private _validateAssignment(doc: CanonicalCompletionReport): void {
    const ai = doc.assignmentInformation;
    if (!ai) throw new Error(`CompletionReportMapper: assignmentInformation is required.`);
    if (!ai.clientParties || ai.clientParties.length === 0) {
      throw new Error(`CompletionReportMapper: assignmentInformation.clientParties must have at least one entry.`);
    }
    if (!ai.appraiser) throw new Error(`CompletionReportMapper: assignmentInformation.appraiser is required.`);

    const app = ai.appraiser;
    if (!app.firstName) throw new Error(`CompletionReportMapper: appraiser.firstName is required.`);
    if (!app.lastName) throw new Error(`CompletionReportMapper: appraiser.lastName is required.`);
    if (!app.licenseId) throw new Error(`CompletionReportMapper: appraiser.licenseId is required.`);
    if (!app.licenseState) throw new Error(`CompletionReportMapper: appraiser.licenseState is required.`);
    if (!app.licenseType) throw new Error(`CompletionReportMapper: appraiser.licenseType is required.`);
    if (!app.licenseExpires) throw new Error(`CompletionReportMapper: appraiser.licenseExpires is required.`);

    if (!app.personalInspectionPerformed && !app.conditionsSatisfiedVerificationDescription) {
      throw new Error(
        `CompletionReportMapper: appraiser.conditionsSatisfiedVerificationDescription is required ` +
          `when personalInspectionPerformed=false (Certification 6 alternative).`,
      );
    }
  }

  /** Validate Section 09 — certifications. */
  private _validateCertifications(doc: CanonicalCompletionReport): void {
    const certs = doc.certifications;
    if (!certs) throw new Error(`CompletionReportMapper: certifications is required.`);
    if (!certs.appraiserSignature?.executionDate) {
      throw new Error(`CompletionReportMapper: certifications.appraiserSignature.executionDate is required.`);
    }

    if (doc.assignmentInformation.supervisoryAppraiser && !certs.supervisoryAppraiserSignature) {
      throw new Error(
        `CompletionReportMapper: certifications.supervisoryAppraiserSignature is required ` +
          `when a supervisory appraiser is present.`,
      );
    }
  }
}
