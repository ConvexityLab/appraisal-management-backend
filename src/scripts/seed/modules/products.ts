/**
 * Seed Module: Products
 *
 * Seeds 8 appraisal product types matching standard FNMA/FHLMC forms.
 * Container: products (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer } from '../seed-types.js';
import { PRODUCT_IDS } from '../seed-ids.js';

const CONTAINER = 'products';

function buildProducts(tenantId: string, now: string): Record<string, unknown>[] {
  return [
    {
      id: PRODUCT_IDS.FULL_1004, tenantId,
      name: 'Full Appraisal (Form 1004)', productType: 'FULL_APPRAISAL',
      description: 'FNMA/FHLMC-compliant single-family interior and exterior inspection appraisal. Includes comparable grid, market condition addendum, and digital signature.',
      defaultFee: 450, rushFeeMultiplier: 1.5, techFee: 25, feeSplitPercent: 20,
      turnTimeDays: 5, rushTurnTimeDays: 2,
      requiredCapabilities: ['can_sign_reports', 'uad36_compliant'],
      isActive: true, status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: PRODUCT_IDS.DRIVE_BY_2055, tenantId,
      name: 'Exterior-Only (Form 2055)', productType: 'DRIVE_BY',
      description: 'Exterior drive-by inspection only. Suitable for low-LTV refinances and portfolio review orders where interior access is unavailable.',
      defaultFee: 275, rushFeeMultiplier: 1.5, techFee: 25, feeSplitPercent: 18,
      turnTimeDays: 3, rushTurnTimeDays: 1,
      requiredCapabilities: ['can_sign_reports'],
      isActive: true, status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: PRODUCT_IDS.DESKTOP_REVIEW, tenantId,
      name: 'Desktop Review (Form 1004D / 2075)', productType: 'DESKTOP',
      description: 'Desk review using MLS data, public records, and prior appraisal report. No physical inspection. Suitable for low-risk recertifications.',
      defaultFee: 150, rushFeeMultiplier: 1.4, techFee: 15, feeSplitPercent: 15,
      turnTimeDays: 2, rushTurnTimeDays: 1,
      requiredCapabilities: ['can_sign_reports', 'desktop_qualified'],
      isActive: true, status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: PRODUCT_IDS.CONDO_1073, tenantId,
      name: 'Condominium Appraisal (Form 1073)', productType: 'CONDO',
      description: 'Full interior/exterior appraisal for condominium units. Includes project analysis and PUD addendum where applicable.',
      defaultFee: 500, rushFeeMultiplier: 1.5, techFee: 25, feeSplitPercent: 20,
      turnTimeDays: 6, rushTurnTimeDays: 3,
      requiredCapabilities: ['can_sign_reports', 'uad36_compliant'],
      isActive: true, status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: PRODUCT_IDS.MULTI_FAMILY_1025, tenantId,
      name: 'Multi-Family (Form 1025 / 2-4 Units)', productType: 'MULTI_FAMILY',
      description: 'Small income-producing property appraisal for 2-4 unit residential buildings. Includes rental analysis addendum.',
      defaultFee: 650, rushFeeMultiplier: 1.5, techFee: 30, feeSplitPercent: 22,
      turnTimeDays: 7, rushTurnTimeDays: 4,
      requiredCapabilities: ['can_sign_reports', 'uad36_compliant', 'complex_assignments'],
      isActive: true, status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: PRODUCT_IDS.FIELD_REVIEW_2000, tenantId,
      name: 'Field Review (Form 2000)', productType: 'FIELD_REVIEW',
      description: 'Second-opinion field review of an existing appraisal. Exterior inspection only with comparable analysis.',
      defaultFee: 325, rushFeeMultiplier: 1.4, techFee: 20, feeSplitPercent: 18,
      turnTimeDays: 4, rushTurnTimeDays: 2,
      requiredCapabilities: ['can_sign_reports'],
      isActive: true, status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: PRODUCT_IDS.RECERTIFICATION, tenantId,
      name: 'Recertification of Value (Form 1004D)', productType: 'RECERTIFICATION',
      description: 'Confirms whether the property condition and value remain consistent with the original appraisal. Required for expired commitments.',
      defaultFee: 125, rushFeeMultiplier: 1.3, techFee: 10, feeSplitPercent: 12,
      turnTimeDays: 2, rushTurnTimeDays: 1,
      requiredCapabilities: ['can_sign_reports', 'desktop_qualified'],
      isActive: true, status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
    {
      id: PRODUCT_IDS.ROV, tenantId,
      name: 'Reconsideration of Value (ROV)', productType: 'ROV',
      description: 'Formal reconsideration of value submission per FHFA ROV guidance (Jan 2024). Requires lender-submitted comparable evidence.',
      defaultFee: 95, rushFeeMultiplier: 1.0, techFee: 10, feeSplitPercent: 10,
      turnTimeDays: 3, rushTurnTimeDays: 3,
      requiredCapabilities: ['can_sign_reports'],
      isActive: true, status: 'ACTIVE', createdAt: now, updatedAt: now, createdBy: 'seed-orchestrator',
    },
  ];
}

export const module: SeedModule = {
  name: 'products',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    const products = buildProducts(ctx.tenantId, ctx.now);
    for (const product of products) {
      await upsert(ctx, CONTAINER, product, result);
    }

    return result;
  },
};
