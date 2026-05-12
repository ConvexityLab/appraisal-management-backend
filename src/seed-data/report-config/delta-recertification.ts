/**
 * Product delta for RECERTIFICATION — Recertification of Value.
 *
 * Differences from URAR 1004 base:
 * - Valuation sections are not re-performed; set required=false
 * - Adds `recertification_statement` section
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_RECERTIFICATION: ReportConfigDeltaDocument = {
  id: 'delta-product-recertification',
  tier: 'product',
  productId: 'RECERTIFICATION',
  sections: [
    { key: 'cost_approach',             required: false },
    { key: 'income_approach',           required: false },
    { key: 'sales_comparison_approach', required: false },
    { key: 'site_section',              required: false },
    { key: 'improvements_interior',     required: false },
    { key: 'interior_condition',        required: false },
  ],
  addSections: [
    {
      key: 'recertification_statement',
      label: 'Recertification of Value',
      order: 55,
      required: true,
      visible: true,
      templateBlockKey: 'recertification_statement',
      fields: [
        { key: 'original_appraisal_date',  label: 'Original Appraisal Date',         type: 'date',     required: true,  visible: true, order: 1 },
        { key: 'original_value',           label: 'Original Appraised Value',         type: 'number',   required: true,  visible: true, order: 2, prefix: '$' },
        { key: 'conditions_met',           label: 'All Original Conditions Met?',     type: 'switch',   required: true,  visible: true, order: 3 },
        { key: 'value_change',             label: 'Has Value Changed?',               type: 'switch',   required: true,  visible: true, order: 4 },
        { key: 'recertified_value',        label: 'Recertified Value',                type: 'number',   required: true,  visible: true, order: 5, prefix: '$' },
        { key: 'recertification_comments', label: 'Comments',                         type: 'textarea', required: false, visible: true, order: 6 },
      ],
    },
  ],
  templateBlocks: {
    recertification_statement: 'templates/blocks/recertification-statement.html',
    base: 'templates/blocks/recertification.html',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
