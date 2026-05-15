/**
 * Product delta for DESKTOP_REVIEW — Desktop Appraisal Review.
 *
 * Differences from URAR 1004 base (superset of DRIVE_BY_2055 suppressions):
 * - Suppress `cost_approach`, `income_approach`, interior sections (same as Drive-By)
 * - `sales_comparison_approach` comps: required=false (reviewer may not have access to MLS data)
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_DESKTOP_REVIEW: ReportConfigDeltaDocument = {
  id: 'delta-product-desktop-review',
  tier: 'product',
  productId: 'DESKTOP_REVIEW',
  sections: [
    { key: 'cost_approach',          visible: false },
    { key: 'income_approach',        visible: false },
    { key: 'interior_condition',     visible: false },
    { key: 'improvements_interior',  visible: false },
    { key: 'basement',               visible: false },
    { key: 'heating_cooling',        visible: false },
    { key: 'kitchen',                visible: false },
    { key: 'bathrooms',              visible: false },
    { key: 'additional_features',    visible: false },
    // Comps still visible but not required — reviewer works from existing data
    { key: 'sales_comparison_approach', required: false },
  ],
  addSections: [],
  templateBlocks: {
    base: 'templates/blocks/desktop-review.html',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
