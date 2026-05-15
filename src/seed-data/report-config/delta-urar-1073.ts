/**
 * Product delta for URAR 1073 — Individual Condominium Unit Appraisal Report.
 *
 * Differences from URAR 1004 base:
 * - Suppress `site` (condos do not have a separate site section)
 * - Suppress `cost-approach` (rarely applicable to condos per FNMA B4-1.4-01)
 * - Enable `project-info` (ProjectInfoSection.tsx — reads CanonicalCondoDetail + CanonicalHoaDetail from Redux)
 *
 * Section keys MUST match the FE section-registry.tsx keys (hyphen-based).
 * The project-info section is in the base config with visible: false; this delta enables it.
 * ProjectInfoSection is a self-contained component backed by selectDraftCondoDetail;
 * it does NOT use ConfigDrivenSection — no addSections needed here.
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_URAR_1073: ReportConfigDeltaDocument = {
  id: 'delta-product-urar-1073',
  tier: 'product',
  productId: 'URAR_1073',
  sections: [
    // Suppress site section — condos share common areas; no individual site analysis
    { key: 'site',          visible: false },
    // Suppress cost approach — FNMA B4-1.4-01: cost approach rarely applicable to condo units
    { key: 'cost-approach', visible: false },
    // Enable project-info — ProjectInfoSection collects CanonicalCondoDetail + CanonicalHoaDetail
    // Base config has this section with visible: false; this delta turns it on.
    { key: 'project-info',  visible: true },
  ],
  addSections: [],
  templateBlocks: {},
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-13T00:00:00.000Z',
};
