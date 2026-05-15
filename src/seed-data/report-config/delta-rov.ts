/**
 * Product delta for ROV — Reconsideration of Value.
 *
 * Differences from URAR 1004 base:
 * - All sections hidden except subject property and final valuation
 * - Adds `rov_response` section for the appraiser's formal ROV response
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_ROV: ReportConfigDeltaDocument = {
  id: 'delta-product-rov',
  tier: 'product',
  productId: 'ROV',
  sections: [
    { key: 'cost_approach',             visible: false },
    { key: 'income_approach',           visible: false },
    { key: 'site_section',              visible: false },
    { key: 'improvements_interior',     visible: false },
    { key: 'interior_condition',        visible: false },
    { key: 'basement',                  visible: false },
    { key: 'heating_cooling',           visible: false },
    { key: 'kitchen',                   visible: false },
    { key: 'bathrooms',                 visible: false },
    { key: 'additional_features',       visible: false },
    { key: 'rental_information',        visible: false },
    // Sales comparison stays visible (appraiser may challenge comps)
  ],
  addSections: [
    {
      key: 'rov_response',
      label: 'Reconsideration of Value Response',
      order: 60,
      required: true,
      visible: true,
      templateBlockKey: 'rov_response',
      fields: [
        { key: 'requestor_name',     label: 'Requestor Name',                     type: 'text',     required: true,  visible: true, order: 1 },
        { key: 'request_date',       label: 'ROV Request Date',                   type: 'date',     required: true,  visible: true, order: 2 },
        { key: 'challenged_value',   label: 'Requestor\'s Challenged Value',      type: 'number',   required: true,  visible: true, order: 3, prefix: '$' },
        { key: 'appraiser_position', label: 'Appraiser Position',                 type: 'select',   required: true,  visible: true, order: 4,
          options: [
            { value: 'maintain',  label: 'Maintain original value' },
            { value: 'revise_up',  label: 'Revise value upward' },
            { value: 'revise_down', label: 'Revise value downward' },
          ],
        },
        { key: 'revised_value',     label: 'Revised Value (if applicable)',       type: 'number',   required: false, visible: true, order: 5, prefix: '$' },
        { key: 'rov_rationale',     label: 'Appraiser Rationale / Response',      type: 'textarea', required: true,  visible: true, order: 6 },
        { key: 'comps_reviewed',    label: 'Comparable Sales Reviewed (count)',   type: 'number',   required: false, visible: true, order: 7 },
      ],
    },
  ],
  templateBlocks: {
    rov_response: 'templates/blocks/rov-response.html',
    base: 'templates/blocks/rov.html',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
