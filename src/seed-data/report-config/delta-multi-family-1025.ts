/**
 * Product delta for MULTI_FAMILY_1025 — Small Residential Income Property Appraisal.
 *
 * Differences from URAR 1004 base:
 * - `income_approach`: required=true (income properties must include income approach)
 * - `rental_information`: required=true (rent schedules are mandatory)
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_MULTI_FAMILY_1025: ReportConfigDeltaDocument = {
  id: 'delta-product-multi-family-1025',
  tier: 'product',
  productId: 'MULTI_FAMILY_1025',
  sections: [
    { key: 'income_approach',     required: true },
    { key: 'rental_information',  required: true },
  ],
  addSections: [],
  templateBlocks: {
    base: 'templates/blocks/multi-family-1025.html',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
