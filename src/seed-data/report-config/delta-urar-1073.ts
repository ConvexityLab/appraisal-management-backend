/**
 * Product delta for URAR 1073 — Individual Condominium Unit Appraisal Report.
 *
 * Differences from URAR 1004 base:
 * - Suppress `site_section` (condos do not have a separate site section)
 * - Suppress `cost_approach` (rarely applicable to condos)
 * - Add `hoa_section` with condominium-specific fields
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_URAR_1073: ReportConfigDeltaDocument = {
  id: 'delta-product-urar-1073',
  tier: 'product',
  productId: 'URAR_1073',
  sections: [
    { key: 'site_section',  visible: false },
    { key: 'cost_approach', visible: false },
  ],
  addSections: [
    {
      key: 'hoa_section',
      label: 'Condominium / HOA Information',
      order: 35,                   // renders after improvements, before sales comparison
      required: true,
      visible: true,
      templateBlockKey: 'hoa_section',
      fields: [
        { key: 'project_name',          label: 'Project Name',               type: 'text',   required: true,  visible: true, order: 1 },
        { key: 'project_type',          label: 'Project Type',               type: 'select', required: true,  visible: true, order: 2,
          options: [{value:'Established',label:'Established'},{value:'New',label:'New'},{value:'Conversion',label:'Conversion'}] },
        { key: 'total_units',           label: 'Total Units in Project',     type: 'number', required: true,  visible: true, order: 3 },
        { key: 'units_sold',            label: 'Units Sold / Closed',        type: 'number', required: false, visible: true, order: 4 },
        { key: 'units_rented',          label: 'Units Rented (Investor)',    type: 'number', required: false, visible: true, order: 5 },
        { key: 'owner_occupancy_pct',   label: 'Owner Occupancy %',          type: 'number', required: true,  visible: true, order: 6 },
        { key: 'hoa_fee',              label: 'Monthly HOA Fee',             type: 'number', required: true,  visible: true, order: 7, prefix: '$' },
        { key: 'pending_litigation',    label: 'Pending Litigation?',        type: 'switch', required: true,  visible: true, order: 8 },
        { key: 'special_assessment',    label: 'Special Assessment $',       type: 'number', required: false, visible: true, order: 9, prefix: '$' },
      ],
    },
  ],
  templateBlocks: {
    hoa_section: 'templates/blocks/hoa-section.html',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
