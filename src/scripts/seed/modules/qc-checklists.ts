/**
 * Seed Module: QC Checklists & Assignments
 *
 * Seeds 1 UAD-standard QC checklist with 4 categories and 10 scored questions,
 * plus QC checklist assignments that link the checklist to specific clients.
 *
 * Containers:
 *   - criteria  (partition /clientId) — checklist definitions
 *   - qc_assignments (partition /targetId) — checklist-to-client assignments
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
import { QC_CHECKLIST_IDS, QC_CHECKLIST_ASSIGNMENT_IDS, CLIENT_IDS, SUB_CLIENT_SLUGS } from '../seed-ids.js';

const CHECKLISTS_CONTAINER = 'criteria';
const ASSIGNMENTS_CONTAINER = 'qc_assignments';

function buildChecklists(tenantId: string, clientId: string): Record<string, unknown>[] {
  return [
    {
      id: QC_CHECKLIST_IDS.UAD_STANDARD,
      tenantId,
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON], clientRecordId: CLIENT_IDS.FIRST_HORIZON,
      type: 'qc-checklist',
      name: 'UAD Standard Residential QC Checklist (2026)',
      version: '2026.1',
      status: 'ACTIVE',
      effectiveDate: daysAgo(90),
      categories: [
        {
          name: 'Subject Property',
          weight: 25,
          questions: [
            {
              id: 'q-subj-01',
              text: 'Is the property address complete and accurate?',
              weight: 5,
              type: 'PASS_FAIL',
              requiredForPass: true,
              // Axiom: subject property address fully formed with required components.
              axiomCriterionIds: ['URAR-1004-001'],
            },
            {
              id: 'q-subj-02',
              text: 'Are the site dimensions and lot size correctly reported?',
              weight: 5,
              type: 'SCORED',
              maxScore: 10,
              requiredForPass: false,
              // Axiom: lot/site size reported.
              axiomCriterionIds: ['URAR-1004-011'],
            },
            {
              id: 'q-subj-03',
              text: 'Is the neighborhood description consistent with MLS data?',
              weight: 5,
              type: 'SCORED',
              maxScore: 10,
              requiredForPass: false,
              // Axiom: neighborhood built-up % + property value trend + marketing time.
              axiomCriterionIds: ['URAR-1004-007', 'URAR-1004-008', 'URAR-1004-009'],
            },
          ],
        },
        {
          name: 'Comparable Selection',
          weight: 30,
          questions: [
            {
              id: 'q-comp-01',
              text: 'Are at least 3 closed comparables within 1 mile used?',
              weight: 10,
              type: 'PASS_FAIL',
              requiredForPass: true,
              // Axiom: ≥3 closed comparable sales + full addresses for distance/proximity check.
              axiomCriterionIds: ['URAR-1004-020', 'URAR-1004-021'],
            },
            {
              id: 'q-comp-02',
              text: 'Are all comparables within 12-month sale date?',
              weight: 10,
              type: 'PASS_FAIL',
              requiredForPass: true,
              // Axiom: closed sale prices and dates for comparables.
              axiomCriterionIds: ['URAR-1004-022'],
            },
            {
              id: 'q-comp-03',
              text: 'Are gross adjustments within 25% and net within 15%?',
              weight: 10,
              type: 'SCORED',
              maxScore: 10,
              requiredForPass: false,
              // Axiom: net adjustments ≤15% + gross adjustments ≤25%.
              axiomCriterionIds: ['URAR-1004-024', 'URAR-1004-025'],
            },
          ],
        },
        {
          name: 'Reconciliation & Value',
          weight: 25,
          questions: [
            {
              id: 'q-val-01',
              text: 'Is the final value supported by the comparable analysis?',
              weight: 10,
              type: 'SCORED',
              maxScore: 10,
              requiredForPass: true,
              // Axiom: reconciled indicated value from sales comp + final market value opinion.
              axiomCriterionIds: ['URAR-1004-026', 'URAR-1004-027'],
            },
            {
              id: 'q-val-02',
              text: 'Is the effective date reasonable relative to inspection?',
              weight: 5,
              type: 'PASS_FAIL',
              requiredForPass: false,
              // Axiom: effective date of appraisal.
              axiomCriterionIds: ['URAR-1004-028'],
            },
          ],
        },
        {
          name: 'UAD Compliance',
          weight: 20,
          questions: [
            {
              id: 'q-uad-01',
              text: 'Are all UAD-required fields populated?',
              weight: 10,
              type: 'PASS_FAIL',
              requiredForPass: true,
              // Axiom: legal description + APN + year built + above-grade GLA + room count.
              // These are the structural URAR identity/measurement fields most often missing.
              axiomCriterionIds: [
                'URAR-1004-002',
                'URAR-1004-003',
                'URAR-1004-014',
                'URAR-1004-016',
                'URAR-1004-017',
              ],
            },
            {
              id: 'q-uad-02',
              text: 'Is the condition/quality rating formatted per UAD standards?',
              weight: 10,
              type: 'SCORED',
              maxScore: 10,
              requiredForPass: false,
              // Axiom: UAD C1-C6 condition rating + Q1-Q6 quality rating.
              axiomCriterionIds: ['URAR-1004-018', 'URAR-1004-019'],
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

/**
 * Build QC checklist assignments that link the UAD checklist to specific clients.
 * This allows any client's orders (including BPO) to resolve a checklist via
 * `getActiveChecklistsForTarget(clientId)`.
 */
function buildAssignments(): Record<string, unknown>[] {
  return [
    {
      id: QC_CHECKLIST_ASSIGNMENT_IDS.UAD_FIRST_HORIZON,
      checklistId: QC_CHECKLIST_IDS.UAD_STANDARD,
      assignmentType: 'client',
      targetId: CLIENT_IDS.FIRST_HORIZON,
      isDefault: true,
      priority: 10,
      effectiveFrom: daysAgo(90),
      createdBy: 'seed-system',
      createdAt: daysAgo(90),
    },
    {
      id: QC_CHECKLIST_ASSIGNMENT_IDS.UAD_PACIFIC_COAST,
      checklistId: QC_CHECKLIST_IDS.UAD_STANDARD,
      assignmentType: 'client',
      targetId: CLIENT_IDS.PACIFIC_COAST,
      isDefault: true,
      priority: 10,
      effectiveFrom: daysAgo(90),
      createdBy: 'seed-system',
      createdAt: daysAgo(90),
    },
    {
      id: QC_CHECKLIST_ASSIGNMENT_IDS.UAD_NATIONAL_AMC,
      checklistId: QC_CHECKLIST_IDS.UAD_STANDARD,
      assignmentType: 'client',
      targetId: CLIENT_IDS.NATIONAL_AMC,
      isDefault: true,
      priority: 10,
      effectiveFrom: daysAgo(90),
      createdBy: 'seed-system',
      createdAt: daysAgo(90),
    },
  ];
}

export const module: SeedModule = {
  name: 'qc-checklists',
  containers: [CHECKLISTS_CONTAINER, ASSIGNMENTS_CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned += await cleanContainer(ctx, CHECKLISTS_CONTAINER, '/clientId');
      result.cleaned += await cleanContainer(ctx, ASSIGNMENTS_CONTAINER, '/targetId');
    }

    for (const checklist of buildChecklists(ctx.tenantId, ctx.clientId)) {
      await upsert(ctx, CHECKLISTS_CONTAINER, checklist, result);
    }

    for (const assignment of buildAssignments()) {
      await upsert(ctx, ASSIGNMENTS_CONTAINER, assignment, result);
    }

    return result;
  },
};
