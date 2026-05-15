/**
 * Product delta for DRIVE_BY_2055 — Exterior-Only Inspection (Drive-By).
 *
 * Differences from URAR 1004 base:
 * - Suppress `cost_approach`    (not collected on drive-by)
 * - Suppress `income_approach`  (not collected on drive-by)
 * - Suppress interior-only sections (not inspected)
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_DRIVE_BY_2055: ReportConfigDeltaDocument = {
  id: 'delta-product-drive-by-2055',
  tier: 'product',
  productId: 'DRIVE_BY_2055',
  sections: [
    { key: 'cost_approach',          visible: false },
    { key: 'income_approach',        visible: false },
    // Interior sections — not inspected on a drive-by
    { key: 'interior_condition',     visible: false },
    { key: 'improvements_interior',  visible: false },
    { key: 'basement',               visible: false },
    { key: 'heating_cooling',        visible: false },
    { key: 'kitchen',                visible: false },
    { key: 'bathrooms',              visible: false },
    { key: 'additional_features',    visible: false },
  ],
  addSections: [],
  templateBlocks: {
    base: 'templates/blocks/drive-by-2055.html',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
