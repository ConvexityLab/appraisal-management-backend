/**
 * Seed Module: QC Checklists
 *
 * Seeds 1 UAD-standard QC checklist with 4 categories and 10 scored questions.
 * Container: criteria (partition /clientId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { QC_CHECKLIST_IDS, CLIENT_IDS, SUB_CLIENT_SLUGS } from '../seed-ids.js';

const CONTAINER = 'criteria';

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
            { id: 'q-subj-01', text: 'Is the property address complete and accurate?', weight: 5, type: 'PASS_FAIL', requiredForPass: true },
            { id: 'q-subj-02', text: 'Are the site dimensions and lot size correctly reported?', weight: 5, type: 'SCORED', maxScore: 10, requiredForPass: false },
            { id: 'q-subj-03', text: 'Is the neighborhood description consistent with MLS data?', weight: 5, type: 'SCORED', maxScore: 10, requiredForPass: false },
          ],
        },
        {
          name: 'Comparable Selection',
          weight: 30,
          questions: [
            { id: 'q-comp-01', text: 'Are at least 3 closed comparables within 1 mile used?', weight: 10, type: 'PASS_FAIL', requiredForPass: true },
            { id: 'q-comp-02', text: 'Are all comparables within 12-month sale date?', weight: 10, type: 'PASS_FAIL', requiredForPass: true },
            { id: 'q-comp-03', text: 'Are gross adjustments within 25% and net within 15%?', weight: 10, type: 'SCORED', maxScore: 10, requiredForPass: false },
          ],
        },
        {
          name: 'Reconciliation & Value',
          weight: 25,
          questions: [
            { id: 'q-val-01', text: 'Is the final value supported by the comparable analysis?', weight: 10, type: 'SCORED', maxScore: 10, requiredForPass: true },
            { id: 'q-val-02', text: 'Is the effective date reasonable relative to inspection?', weight: 5, type: 'PASS_FAIL', requiredForPass: false },
          ],
        },
        {
          name: 'UAD Compliance',
          weight: 20,
          questions: [
            { id: 'q-uad-01', text: 'Are all UAD-required fields populated?', weight: 10, type: 'PASS_FAIL', requiredForPass: true },
            { id: 'q-uad-02', text: 'Is the condition/quality rating formatted per UAD standards?', weight: 10, type: 'SCORED', maxScore: 10, requiredForPass: false },
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
