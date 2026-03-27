/**
 * Seed Module: Review Programs
 *
 * Seeds 1 versioned review program with scoring criteria.
 * Container: review-programs (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { REVIEW_PROGRAM_IDS } from '../seed-ids.js';

const CONTAINER = 'review-programs';

function buildReviewPrograms(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: REVIEW_PROGRAM_IDS.VISION_APPRAISAL_V1, tenantId, type: 'review-program',
      name: 'Vision Appraisal QC Program',
      version: '1.0',
      status: 'ACTIVE',
      effectiveDate: daysAgo(180),
      description: 'Standard QC review program for all residential appraisal products. Includes automated UAD compliance checks and manual review scoring.',
      scoringModel: {
        type: 'WEIGHTED_AVERAGE',
        passingThreshold: 80,
        categories: [
          { name: 'UAD Compliance', weight: 20, description: 'Automated check of UAD field formatting and completeness' },
          { name: 'Comparable Selection', weight: 30, description: 'Quality and relevance of comparable sales' },
          { name: 'Adjustment Analysis', weight: 25, description: 'Appropriateness and magnitude of adjustments' },
          { name: 'Value Reconciliation', weight: 15, description: 'Support for final value opinion' },
          { name: 'Report Quality', weight: 10, description: 'Clarity, grammar, completeness of narrative' },
        ],
      },
      autoCheckRules: [
        { id: 'auto-01', name: 'GLA_ADJUSTMENT_THRESHOLD', description: 'Flag if GLA adjustment exceeds 25%', threshold: 0.25, severity: 'HIGH' },
        { id: 'auto-02', name: 'COMP_DISTANCE_MAX', description: 'Flag if any comp is >1 mile away', thresholdMiles: 1.0, severity: 'MEDIUM' },
        { id: 'auto-03', name: 'SALE_DATE_MAX_MONTHS', description: 'Flag if any comp sale date >12 months', thresholdMonths: 12, severity: 'HIGH' },
        { id: 'auto-04', name: 'NET_ADJUSTMENT_MAX', description: 'Flag if net adjustments exceed 15%', threshold: 0.15, severity: 'MEDIUM' },
        { id: 'auto-05', name: 'GROSS_ADJUSTMENT_MAX', description: 'Flag if gross adjustments exceed 25%', threshold: 0.25, severity: 'HIGH' },
      ],
      applicableProducts: ['FULL_1004', 'DRIVE_BY_2055', 'CONDO_1073', 'MULTI_FAMILY_1025'],
      createdAt: daysAgo(180), updatedAt: daysAgo(30),
    },
  ];
}

export const module: SeedModule = {
  name: 'review-programs',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const prog of buildReviewPrograms(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, prog, result);
    }

    return result;
  },
};
