/**
 * Product delta for BPO — Broker Price Opinion.
 *
 * Differences from URAR 1004 base:
 * - Suppress `cost_approach` (not applicable to BPO)
 * - Suppress `income_approach` (not applicable to standard BPO)
 * - Add `bpo_pricing_section` with BPO-specific pricing and condition fields
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_BPO: ReportConfigDeltaDocument = {
  id: 'delta-product-bpo',
  tier: 'product',
  productId: 'BPO',
  sections: [
    { key: 'cost_approach',   visible: false },
    { key: 'income_approach', visible: false },
  ],
  addSections: [
    {
      key: 'bpo_pricing_section',
      label: 'BPO Pricing & Market Analysis',
      order: 45,                   // renders after sales comparison
      required: true,
      visible: true,
      templateBlockKey: 'bpo_pricing_section',
      fields: [
        { key: 'as_is_value',          label: 'As-Is Value',                type: 'number', required: true,  visible: true, order: 1, prefix: '$' },
        { key: 'quick_sale_value',     label: 'Quick Sale Value (90 days)', type: 'number', required: false, visible: true, order: 2, prefix: '$' },
        { key: 'as_repaired_value',    label: 'As-Repaired Value',          type: 'number', required: false, visible: true, order: 3, prefix: '$' },
        { key: 'repair_estimate',      label: 'Estimated Repair Cost',      type: 'number', required: false, visible: true, order: 4, prefix: '$' },
        { key: 'recommended_list',     label: 'Recommended List Price',     type: 'number', required: true,  visible: true, order: 5, prefix: '$' },
        { key: 'marketing_time',       label: 'Estimated Marketing Time',   type: 'select', required: true,  visible: true, order: 6,
          options: [
            {value:'0-30',label:'0-30 days'},
            {value:'31-90',label:'31-90 days'},
            {value:'91-180',label:'91-180 days'},
            {value:'180+',label:'Over 180 days'},
          ] },
        { key: 'occupancy_status',     label: 'Occupancy Status',           type: 'select', required: true,  visible: true, order: 7,
          options: [{value:'Owner',label:'Owner Occupied'},{value:'Tenant',label:'Tenant Occupied'},{value:'Vacant',label:'Vacant'}] },
        { key: 'bpo_comments',         label: 'Broker Comments',            type: 'textarea', required: false, visible: true, order: 8 },
      ],
    },
  ],
  templateBlocks: {
    bpo_pricing_section: 'templates/blocks/bpo-pricing.html',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
