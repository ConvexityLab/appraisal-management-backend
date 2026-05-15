/**
 * Seed Module: QC Checklists
 *
 * Seeds 1 UAD-standard QC checklist with 4 categories and 10 scored questions.
 * Container: criteria (partition /clientId)
 *
 * `axiomCriterionIds` map each checklist question to one or more canonical
 * Axiom criterion IDs from the FNMA-1004 program (URAR-1004-001..033).
 *
 * The mapping was derived from a real `criteria-only-evaluation` run against
 * the Axiom dev URL on 2026-04-28 — see
 * `test-artifacts/p-20/criterion-id-audit-2026-04-28.md` for the full list of
 * 33 criterion IDs with their semantic descriptions. Re-run that audit when
 * Axiom releases a new program version.
 *
 * Coverage gap: 14 of the 33 Axiom criteria (legal description, APN, taxes,
 * borrower name, occupancy, zoning, signature/license fields, AMC name, etc.)
 * are NOT represented as separate checklist questions today. They still flow
 * through into the Axiom evaluation results — they're just not pre-filled
 * onto a specific QC question.
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { QC_CHECKLIST_IDS, CLIENT_IDS, SUB_CLIENT_SLUGS } from '../seed-ids.js';

const CONTAINER = 'criteria';

/**
 * Map URAR-1004-XXX short codes to the canonical Axiom node IDs published by
 * the FNMA-1004 compiled program. Each entry is `program:FNMA-1004:<Category>.<Subcategory>.<Concept>:<sequence>`.
 *
 * The FE's axiomQcBridge (`applyAxiomPrefill`) matches a checklist question's
 * `axiomCriterionIds` against the eval result row's `criterionId` field — and
 * those rows now carry the long-form node id. Without this mapping the FE
 * sees zero matches and renders no "AI Verdict:" on questions even when the
 * verdicts exist in evaluation-results. Verified against Axiom dev on
 * 2026-05-13: every short code below resolves to a row in compiled-programs.
 *
 * When Axiom publishes a new program version, re-probe with:
 *   SELECT c.id FROM compiled-programs c WHERE c.programId='FNMA-1004' ORDER BY c.id
 */
const FNMA_1004_NODE_IDS: Record<string, string> = {
  'URAR-1004-001': 'program:FNMA-1004:SubjectProperty.PropertyIdentification.SubjectAddressComplete:001',
  'URAR-1004-002': 'program:FNMA-1004:SubjectProperty.PropertyIdentification.LegalDescriptionPresent:002',
  'URAR-1004-003': 'program:FNMA-1004:SubjectProperty.PropertyIdentification.AssessorsParcelNumberPresent:003',
  'URAR-1004-004': 'program:FNMA-1004:SubjectProperty.PropertyIdentification.TaxYearAndAmountPresent:004',
  'URAR-1004-005': 'program:FNMA-1004:SubjectProperty.PropertyIdentification.BorrowerOwnerNamePresent:005',
  'URAR-1004-006': 'program:FNMA-1004:SubjectProperty.PropertyIdentification.OccupancyStatusIndicated:006',
  'URAR-1004-007': 'program:FNMA-1004:Neighborhood.MarketCharacteristics.LocationTypeIndicated:007',
  'URAR-1004-008': 'program:FNMA-1004:Neighborhood.MarketConditions.PropertyValuesTrendIndicated:008',
  'URAR-1004-009': 'program:FNMA-1004:Neighborhood.MarketConditions.MarketingTimeIndicated:009',
  'URAR-1004-010': 'program:FNMA-1004:Neighborhood.SiteCharacteristics.FemaFloodZoneStated:010',
  'URAR-1004-011': 'program:FNMA-1004:Site.SiteDescription.SiteAreaStated:011',
  'URAR-1004-012': 'program:FNMA-1004:Site.SiteDescription.ZoningClassificationPresent:012',
  'URAR-1004-013': 'program:FNMA-1004:Site.SiteDescription.ZoningComplianceIndicated:013',
  'URAR-1004-014': 'program:FNMA-1004:Improvements.GeneralDescription.YearBuiltStated:014',
  'URAR-1004-015': 'program:FNMA-1004:Improvements.GeneralDescription.EffectiveAgeStated:015',
  'URAR-1004-016': 'program:FNMA-1004:Improvements.RoomCount.GlaCalculatedAndStated:016',
  'URAR-1004-017': 'program:FNMA-1004:Improvements.RoomCount.RoomCountStated:017',
  'URAR-1004-018': 'program:FNMA-1004:Improvements.Condition.ConditionRatingStated:018',
  'URAR-1004-019': 'program:FNMA-1004:Improvements.Condition.QualityRatingStated:019',
  'URAR-1004-020': 'program:FNMA-1004:SalesComparisonApproach.ComparableSelection.MinimumThreeComparables:020',
  'URAR-1004-021': 'program:FNMA-1004:SalesComparisonApproach.ComparableData.ComparableAddressesPresent:021',
  'URAR-1004-022': 'program:FNMA-1004:SalesComparisonApproach.ComparableData.ComparableSalePricesPresent:022',
  'URAR-1004-023': 'program:FNMA-1004:SalesComparisonApproach.ComparableData.ComparableGlaStated:023',
  'URAR-1004-024': 'program:FNMA-1004:SalesComparisonApproach.Adjustments.NetAdjustmentWithinFnmaLimits:024',
  'URAR-1004-025': 'program:FNMA-1004:SalesComparisonApproach.Adjustments.GrossAdjustmentWithinFnmaLimits:025',
  'URAR-1004-026': 'program:FNMA-1004:SalesComparisonApproach.ValuationConclusion.IndicatedValueBySalesComparison:026',
  'URAR-1004-027': 'program:FNMA-1004:Reconciliation.ValuationConclusion.FinalReconciledValueStated:027',
  'URAR-1004-028': 'program:FNMA-1004:Reconciliation.AppraisalDates.EffectiveDateOfAppraisalStated:028',
  'URAR-1004-029': 'program:FNMA-1004:Reconciliation.AppraisalConditions.AppraisalConditionsStated:029',
  'URAR-1004-030': 'program:FNMA-1004:AppraisalCertification.Certification.AppraiserSignaturePresent:030',
  'URAR-1004-031': 'program:FNMA-1004:AppraisalCertification.Certification.AppraiserLicenseNumberStated:031',
  'URAR-1004-032': 'program:FNMA-1004:AppraisalCertification.Certification.DateOfSignatureStated:032',
  'URAR-1004-033': 'program:FNMA-1004:AppraisalCertification.Certification.AppraiserCompanyAddressPresent:033',
};

/** Expand a list of URAR-1004-XXX short codes to full Axiom node IDs. */
function ax(...shortCodes: Array<keyof typeof FNMA_1004_NODE_IDS>): string[] {
  return shortCodes.map((c) => FNMA_1004_NODE_IDS[c]!);
}

function buildChecklists(tenantId: string, clientId: string): Record<string, unknown>[] {
  return [
    {
      id: QC_CHECKLIST_IDS.UAD_STANDARD,
      tenantId,
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON], clientRecordId: CLIENT_IDS.FIRST_HORIZON,
      type: 'qc-checklist',
      name: 'UAD Standard Residential QC Checklist (2026)',
      version: '2026.1',
      // Fields required by QCChecklistManagementService.searchChecklists query:
      //   WHERE c.documentType = 'appraisal' AND c.isTemplate = false AND c.isActive = true
      documentType: 'appraisal',
      isActive: true,
      isTemplate: false,
      status: 'ACTIVE',
      effectiveDate: daysAgo(90),
      // Categories use the engine schema: categories[] → subcategories[] → questions[]
      // Each question uses the field names the QCExecutionEngine reads:
      //   q.question (not q.text), q.scoringWeight (not q.weight), q.priority, q.dataRequirements
      categories: [
        {
          id: 'cat-subject-property',
          name: 'Subject Property',
          weight: 25,
          subcategories: [
            {
              id: 'sub-subject-property',
              name: 'Subject Property',
              questions: [
                {
                  id: 'q-subj-01',
                  question: 'Is the property address complete and accurate?',
                  scoringWeight: 5,
                  priority: 'CRITICAL',
                  dataRequirements: [],
                  // Axiom: subject property address fully formed with required components.
                  axiomCriterionIds: ax('URAR-1004-001'),
                },
                {
                  id: 'q-subj-02',
                  question: 'Are the site dimensions and lot size correctly reported?',
                  scoringWeight: 5,
                  priority: 'MEDIUM',
                  dataRequirements: [],
                  // Axiom: lot/site size reported.
                  axiomCriterionIds: ax('URAR-1004-011'),
                },
                {
                  id: 'q-subj-03',
                  question: 'Is the neighborhood description consistent with MLS data?',
                  scoringWeight: 5,
                  priority: 'MEDIUM',
                  dataRequirements: [],
                  // Axiom: neighborhood built-up % + property value trend + marketing time.
                  axiomCriterionIds: ax('URAR-1004-007', 'URAR-1004-008', 'URAR-1004-009'),
                },
              ],
            },
          ],
        },
        {
          id: 'cat-comparable-selection',
          name: 'Comparable Selection',
          weight: 30,
          subcategories: [
            {
              id: 'sub-comparable-selection',
              name: 'Comparable Selection',
              questions: [
                {
                  id: 'q-comp-01',
                  question: 'Are at least 3 closed comparables within 1 mile used?',
                  scoringWeight: 10,
                  priority: 'CRITICAL',
                  dataRequirements: [],
                  // Axiom: ≥3 closed comparable sales + full addresses for distance/proximity check.
                  axiomCriterionIds: ax('URAR-1004-020', 'URAR-1004-021'),
                },
                {
                  id: 'q-comp-02',
                  question: 'Are all comparables within 12-month sale date?',
                  scoringWeight: 10,
                  priority: 'CRITICAL',
                  dataRequirements: [],
                  // Axiom: closed sale prices and dates for comparables.
                  axiomCriterionIds: ax('URAR-1004-022'),
                },
                {
                  id: 'q-comp-03',
                  question: 'Are gross adjustments within 25% and net within 15%?',
                  scoringWeight: 10,
                  priority: 'MEDIUM',
                  dataRequirements: [],
                  // Axiom: net adjustments ≤15% + gross adjustments ≤25%.
                  axiomCriterionIds: ax('URAR-1004-024', 'URAR-1004-025'),
                },
              ],
            },
          ],
        },
        {
          id: 'cat-reconciliation-value',
          name: 'Reconciliation & Value',
          weight: 25,
          subcategories: [
            {
              id: 'sub-reconciliation-value',
              name: 'Reconciliation & Value',
              questions: [
                {
                  id: 'q-val-01',
                  question: 'Is the final value supported by the comparable analysis?',
                  scoringWeight: 10,
                  priority: 'CRITICAL',
                  dataRequirements: [],
                  // Axiom: reconciled indicated value from sales comp + final market value opinion.
                  axiomCriterionIds: ax('URAR-1004-026', 'URAR-1004-027'),
                },
                {
                  id: 'q-val-02',
                  question: 'Is the effective date reasonable relative to inspection?',
                  scoringWeight: 5,
                  priority: 'MEDIUM',
                  dataRequirements: [],
                  // Axiom: effective date of appraisal.
                  axiomCriterionIds: ax('URAR-1004-028'),
                },
              ],
            },
          ],
        },
        {
          id: 'cat-uad-compliance',
          name: 'UAD Compliance',
          weight: 20,
          subcategories: [
            {
              id: 'sub-uad-compliance',
              name: 'UAD Compliance',
              questions: [
                {
                  id: 'q-uad-01',
                  question: 'Are all UAD-required fields populated?',
                  scoringWeight: 10,
                  priority: 'CRITICAL',
                  dataRequirements: [],
                  // Axiom: legal description + APN + year built + above-grade GLA + room count.
                  // These are the structural URAR identity/measurement fields most often missing.
                  axiomCriterionIds: ax(
                    'URAR-1004-002',
                    'URAR-1004-003',
                    'URAR-1004-014',
                    'URAR-1004-016',
                    'URAR-1004-017',
                  ),
                },
                {
                  id: 'q-uad-02',
                  question: 'Is the condition/quality rating formatted per UAD standards?',
                  scoringWeight: 10,
                  priority: 'MEDIUM',
                  dataRequirements: [],
                  // Axiom: UAD C1-C6 condition rating + Q1-Q6 quality rating.
                  axiomCriterionIds: ax('URAR-1004-018', 'URAR-1004-019'),
                },
              ],
            },
          ],
        },
      ],
      passingScore: 80,
      totalWeight: 100,
      createdAt: daysAgo(90),
      updatedAt: daysAgo(30),
    },
  ];
}

export const module: SeedModule = {
  name: 'qc-checklists',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER, '/clientId');
    }

    for (const checklist of buildChecklists(ctx.tenantId, ctx.clientId)) {
      await upsert(ctx, CONTAINER, checklist, result);
    }

    return result;
  },
};
