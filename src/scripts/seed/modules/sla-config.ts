/**
 * Seed Module: SLA Configuration
 *
 * Seeds default SLA rules per product type.
 * Container: sla-configurations (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { SLA_CONFIG_IDS, PRODUCT_IDS } from '../seed-ids.js';

const CONTAINER = 'sla-configurations';

function buildSlaConfigs(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: SLA_CONFIG_IDS.FULL_APPRAISAL, tenantId, type: 'sla-configuration',
      name: 'Full Appraisal (1004) SLA',
      productIds: [PRODUCT_IDS.FULL_1004, PRODUCT_IDS.CONDO_1073, PRODUCT_IDS.MULTI_FAMILY_1025],
      status: 'ACTIVE',
      rules: {
        assignmentAcceptanceDays: 1,
        inspectionCompletionDays: 5,
        reportSubmissionDays: 10,
        qcReviewDays: 3,
        totalTurnaroundDays: 14,
        rushTurnaroundDays: 5,
        revisionResponseDays: 3,
      },
      escalationThresholds: {
        warningPercentElapsed: 75,
        criticalPercentElapsed: 90,
        autoEscalateOnBreach: true,
      },
      createdAt: daysAgo(365), updatedAt: daysAgo(30),
    },
    {
      id: SLA_CONFIG_IDS.DRIVE_BY, tenantId, type: 'sla-configuration',
      name: 'Drive-By (2055) SLA',
      productIds: [PRODUCT_IDS.DRIVE_BY_2055],
      status: 'ACTIVE',
      rules: {
        assignmentAcceptanceDays: 1,
        inspectionCompletionDays: 3,
        reportSubmissionDays: 7,
        qcReviewDays: 2,
        totalTurnaroundDays: 10,
        rushTurnaroundDays: 3,
        revisionResponseDays: 2,
      },
      escalationThresholds: {
        warningPercentElapsed: 70,
        criticalPercentElapsed: 85,
        autoEscalateOnBreach: true,
      },
      createdAt: daysAgo(365), updatedAt: daysAgo(30),
    },
    {
      id: SLA_CONFIG_IDS.DESKTOP, tenantId, type: 'sla-configuration',
      name: 'Desktop Review SLA',
      productIds: [PRODUCT_IDS.DESKTOP_REVIEW, PRODUCT_IDS.FIELD_REVIEW_2000],
      status: 'ACTIVE',
      rules: {
        assignmentAcceptanceDays: 1,
        inspectionCompletionDays: 0,
        reportSubmissionDays: 5,
        qcReviewDays: 2,
        totalTurnaroundDays: 7,
        rushTurnaroundDays: 3,
        revisionResponseDays: 2,
      },
      escalationThresholds: {
        warningPercentElapsed: 70,
        criticalPercentElapsed: 85,
        autoEscalateOnBreach: true,
      },
      createdAt: daysAgo(365), updatedAt: daysAgo(30),
    },
  ];
}

export const module: SeedModule = {
  name: 'sla-config',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const cfg of buildSlaConfigs(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, cfg, result);
    }

    return result;
  },
};
