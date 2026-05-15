/**
 * Product delta for DRIVE_BY_2055 — Exterior-Only Inspection (Form 2055 / Drive-By).
 *
 * Differences from URAR 1004 base:
 * - Suppress `cost-approach`   (not collected on drive-by per FNMA B4-1.2-03)
 * - Suppress `income-approach` (not applicable — no interior inspection)
 *
 * Interior field suppression (within the `improvements` section) is handled
 * at the template level via the `isExteriorOnly` Handlebars flag produced by
 * the mapper (Phase J of URAR_CONDITIONAL_RENDERING_PLAN.md). The `improvements`
 * section itself REMAINS visible so the appraiser can capture exterior-observable
 * data (GLA, year built, condition from exterior, roof surface, etc.).
 *
 * Section keys MUST match the FE section-registry.tsx keys (hyphen-based).
 * Previously this delta referenced non-existent keys (interior_condition, basement,
 * kitchen, etc.) which were no-ops. Those have been removed.
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_DRIVE_BY_2055: ReportConfigDeltaDocument = {
  id: 'delta-product-drive-by-2055',
  tier: 'product',
  productId: 'DRIVE_BY_2055',
  sections: [
    // Suppress cost approach — drive-by does not support cost-new analysis
    { key: 'cost-approach',   visible: false },
    // Suppress income approach — exterior-only; rental interior not observed
    { key: 'income-approach', visible: false },
  ],
  addSections: [],
  templateBlocks: {},
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-13T00:00:00.000Z',
};
