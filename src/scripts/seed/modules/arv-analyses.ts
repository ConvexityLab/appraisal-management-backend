/**
 * Seed Module: ARV Analyses
 *
 * Seeds After-Repair-Value analysis records for fix-and-flip deals.
 * Container: arv-analyses (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { ARV_IDS, ORDER_IDS } from '../seed-ids.js';

const CONTAINER = 'arv-analyses';

function buildArvAnalyses(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: ARV_IDS.ARV_ORDER_006, tenantId, type: 'arv-analysis',
      orderId: ORDER_IDS.FIX_FLIP_006,
      dealType: 'FIX_FLIP',
      mode: 'HYBRID',
      status: 'DRAFT',
      asIsValue: 195_000,
      estimatedARV: 328_000,
      rehabBudget: 78_000,
      purchasePrice: 185_000,
      afterRepairEquity: 65_000,
      dealMetrics: {
        maxAllowableOffer: 196_800,
        potentialProfit: 65_000,
        roi: 0.351,
        arvLTV: 0.564,
        debtServiceCoverageRatio: null,
        breakEvenRentMonthly: null,
      },
      scopeOfWork: [
        { id: 'sow-001', category: 'KITCHEN', description: 'Full kitchen remodel — new cabinets, counters, appliances', estimatedCost: 28_000, status: 'PLANNED' },
        { id: 'sow-002', category: 'BATHROOMS', description: 'Both bathrooms — new tile, vanity, fixtures', estimatedCost: 14_000, status: 'PLANNED' },
        { id: 'sow-003', category: 'FLOORING', description: 'Hardwood throughout main living areas', estimatedCost: 9_500, status: 'PLANNED' },
        { id: 'sow-004', category: 'ROOF', description: 'Full roof replacement', estimatedCost: 12_000, status: 'PLANNED' },
        { id: 'sow-005', category: 'HVAC', description: 'Replace 19-year-old HVAC system', estimatedCost: 7_500, status: 'PLANNED' },
        { id: 'sow-006', category: 'EXTERIOR', description: 'Paint exterior, landscaping, driveway repair', estimatedCost: 7_000, status: 'PLANNED' },
      ],
      arvComps: [
        {
          id: 'arv-comp-1',
          address: '8721 Abrams Rd, Dallas TX 75243',
          salePrice: 332_000, saleDate: daysAgo(55),
          squareFeet: 1820, bedrooms: 3, bathrooms: 2,
          renovated: true, distanceMiles: 0.3, adjustedValue: 328_000,
        },
        {
          id: 'arv-comp-2',
          address: '8905 Dartmouth Dr, Dallas TX 75243',
          salePrice: 318_000, saleDate: daysAgo(72),
          squareFeet: 1750, bedrooms: 3, bathrooms: 2,
          renovated: true, distanceMiles: 0.5, adjustedValue: 326_000,
        },
      ],
      notes: 'Comparable properties in the Abrams corridor have appreciated ~14% post-renovation. Subject lot size (8,200 sqft) is above neighborhood median which supports the upper range.',
      createdAt: daysAgo(3), updatedAt: daysAgo(1), createdBy: 'seed-script',
    },
  ];
}

export const module: SeedModule = {
  name: 'arv-analyses',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const arv of buildArvAnalyses(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, arv, result);
    }

    return result;
  },
};
