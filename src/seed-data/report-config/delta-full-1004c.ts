/**
 * Product delta for FULL_1004C — Manufactured Home Appraisal Report (Form 1004C).
 *
 * Differences from URAR 1004 base:
 * - Enable `manufactured-home` section (ProjectInfoSection for manufactured home data)
 *   Base config has this section with visible: false; this delta turns it on.
 *
 * The cost approach is REQUIRED for manufactured homes (FNMA B5-2-02 §5).
 * `cost-approach` therefore remains visible (overriding nothing — base default).
 *
 * Section keys MUST match the FE section-registry.tsx keys (hyphen-based).
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_FULL_1004C: ReportConfigDeltaDocument = {
  id: 'delta-product-full-1004c',
  tier: 'product',
  productId: 'FULL_1004C',
  sections: [
    // Enable manufactured-home section — base config has it hidden by default
    { key: 'manufactured-home', visible: true },
  ],
  addSections: [],
  templateBlocks: {},
  createdAt: '2026-05-13T00:00:00.000Z',
  updatedAt: '2026-05-13T00:00:00.000Z',
};
