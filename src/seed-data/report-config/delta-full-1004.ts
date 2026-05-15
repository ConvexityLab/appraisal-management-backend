/**
 * Product delta for FULL_1004 — Full URAR 1004 Appraisal.
 *
 * Identity delta: no section or field overrides. Exists to validate
 * that the merge pipeline produces the unmodified base when this product
 * is in scope, and to carry the templateBlockOverrides for the 1004 layout.
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_FULL_1004: ReportConfigDeltaDocument = {
  id: 'delta-product-full-1004',
  tier: 'product',
  productId: 'FULL_1004',
  sections: [],
  addSections: [],
  templateBlocks: {
    base: 'templates/blocks/urar-1004-base.html',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
