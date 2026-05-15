/**
 * Product delta for FIELD_REVIEW_2000 — Field Review Appraisal.
 *
 * Differences from URAR 1004 base:
 * - Most standard appraisal sections are suppressed (reviewer observes, doesn't re-appraise)
 * - Adds `field_review_findings` section specific to field review workflow
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_FIELD_REVIEW_2000: ReportConfigDeltaDocument = {
  id: 'delta-product-field-review-2000',
  tier: 'product',
  productId: 'FIELD_REVIEW_2000',
  sections: [
    { key: 'cost_approach',           visible: false },
    { key: 'income_approach',         visible: false },
    { key: 'sales_comparison_approach', visible: false },
    { key: 'site_section',            visible: false },
    { key: 'improvements_interior',   visible: false },
    { key: 'interior_condition',      visible: false },
    { key: 'basement',                visible: false },
    { key: 'heating_cooling',         visible: false },
    { key: 'kitchen',                 visible: false },
    { key: 'bathrooms',               visible: false },
    { key: 'additional_features',     visible: false },
    { key: 'rental_information',      visible: false },
  ],
  addSections: [
    {
      key: 'field_review_findings',
      label: 'Field Review Findings',
      order: 50,
      required: true,
      visible: true,
      templateBlockKey: 'field_review_findings',
      fields: [
        { key: 'visit_date',              label: 'Date of Field Visit',          type: 'date',     required: true,  visible: true, order: 1 },
        { key: 'exterior_condition_ok',   label: 'Exterior Consistent with Report?', type: 'switch', required: true,  visible: true, order: 2 },
        { key: 'neighborhood_ok',         label: 'Neighborhood Description Consistent?', type: 'switch', required: true, visible: true, order: 3 },
        { key: 'value_opinion',           label: 'Reviewer Value Opinion',        type: 'number',   required: true,  visible: true, order: 4, prefix: '$' },
        { key: 'value_supported',         label: 'Original Value Supported?',     type: 'select',   required: true,  visible: true, order: 5,
          options: [
            { value: 'yes',        label: 'Yes — value is supported' },
            { value: 'no',         label: 'No — value is not supported' },
            { value: 'conditional', label: 'Conditional — subject to corrections' },
          ],
        },
        { key: 'reviewer_comments',       label: 'Reviewer Comments',             type: 'textarea', required: false, visible: true, order: 6 },
      ],
    },
  ],
  templateBlocks: {
    field_review_findings: 'templates/blocks/field-review-findings.html',
    base: 'templates/blocks/field-review-2000.html',
  },
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-11T00:00:00.000Z',
};
