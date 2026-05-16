/**
 * Product delta for STR Feasibility Report.
 *
 * This is a standalone product — no URAR 1004 base applies.
 * The delta adds all sections needed for the STR Feasibility Report:
 *   - Subject property characteristics
 *   - Revenue & occupancy projection table (one row per data source)
 *   - STR comparable listings grid
 *   - Regulatory profile summary
 *   - Analyst assumptions & certifications
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_STR_FEASIBILITY: ReportConfigDeltaDocument = {
  id: 'delta-product-str-feasibility',
  tier: 'product',
  productId: 'STR_FEASIBILITY',
  // Suppress all standard URAR sections — this product uses its own layout
  sections: [
    { key: 'cost_approach',          visible: false },
    { key: 'income_approach',        visible: false },
    { key: 'sales_comparison',       visible: false },
    { key: 'site_section',           visible: false },
    { key: 'improvements_interior',  visible: false },
    { key: 'interior_condition',     visible: false },
    { key: 'basement',               visible: false },
    { key: 'heating_cooling',        visible: false },
    { key: 'kitchen',                visible: false },
    { key: 'bathrooms',              visible: false },
    { key: 'additional_features',    visible: false },
    { key: 'rental_information',     visible: false },
  ],
  addSections: [
    // ── Subject Property ─────────────────────────────────────────────────────
    {
      key: 'str_subject_property',
      label: 'Subject Property Characteristics',
      order: 10,
      required: true,
      visible: true,
      templateBlockKey: 'str_subject_property',
      fields: [
        { key: 'subject_address',      label: 'Property Address',        type: 'text',     required: true,  visible: true, order: 1 },
        { key: 'subject_bedrooms',     label: 'Bedrooms',                type: 'number',   required: true,  visible: true, order: 2 },
        { key: 'subject_bathrooms',    label: 'Bathrooms',               type: 'number',   required: true,  visible: true, order: 3 },
        { key: 'subject_sqft',         label: 'Square Feet',             type: 'number',   required: false, visible: true, order: 4 },
        { key: 'subject_year_built',   label: 'Year Built',              type: 'number',   required: false, visible: true, order: 5 },
        { key: 'subject_design',       label: 'Design / Style',          type: 'text',     required: false, visible: true, order: 6 },
        { key: 'subject_property_type',label: 'Property Type',           type: 'select',   required: false, visible: true, order: 7,
          options: [
            { value: 'SFR',       label: 'Single-Family' },
            { value: 'Condo',     label: 'Condominium' },
            { value: 'Townhouse', label: 'Townhouse' },
            { value: 'Cabin',     label: 'Cabin / Cottage' },
            { value: 'Duplex',    label: 'Duplex' },
            { value: 'Other',     label: 'Other' },
          ],
        },
        { key: 'subject_amenities',    label: 'Key Amenities',           type: 'textarea', required: false, visible: true, order: 8 },
        { key: 'data_sources',         label: 'Data Sources Used',       type: 'text',     required: true,  visible: true, order: 9 },
      ],
    },

    // ── Revenue & Occupancy Projections ──────────────────────────────────────
    {
      key: 'str_projection_table',
      label: 'Revenue & Occupancy Projections',
      order: 20,
      required: true,
      visible: true,
      templateBlockKey: 'str_projection_table',
      fields: [
        { key: 'primary_source',           label: 'Primary Source',               type: 'text',   required: true,  visible: true, order: 1 },
        { key: 'projected_annual_revenue', label: 'Projected Annual Gross Revenue', type: 'number', required: true,  visible: true, order: 2, prefix: '$' },
        { key: 'occupancy_rate',           label: 'Projected Occupancy Rate',      type: 'number', required: true,  visible: true, order: 3, suffix: '%' },
        { key: 'average_daily_rate',       label: 'Average Daily Rate (ADR)',      type: 'number', required: true,  visible: true, order: 4, prefix: '$' },
        { key: 'annual_operating_expenses',label: 'Estimated Annual Expenses',     type: 'number', required: false, visible: true, order: 5, prefix: '$' },
        { key: 'estimated_noi',            label: 'Estimated Net Operating Income',type: 'number', required: false, visible: true, order: 6, prefix: '$' },
        { key: 'high_season_months',       label: 'High-Season Months',           type: 'text',   required: false, visible: true, order: 7 },
      ],
    },

    // ── STR Comparable Listings ───────────────────────────────────────────────
    {
      key: 'str_comparables',
      label: 'Short-Term Rental Comparable Listings',
      order: 30,
      required: false,
      visible: true,
      templateBlockKey: 'str_comparables',
      fields: [
        { key: 'comp_count',           label: 'Number of Comparables',     type: 'number', required: false, visible: true, order: 1 },
        { key: 'comp_search_radius',   label: 'Search Radius (miles)',      type: 'number', required: false, visible: true, order: 2 },
        { key: 'comp_source',          label: 'Comparable Data Source',     type: 'text',   required: false, visible: true, order: 3 },
      ],
    },

    // ── Regulatory Profile ────────────────────────────────────────────────────
    {
      key: 'str_regulatory_summary',
      label: 'STR Regulatory Environment',
      order: 40,
      required: false,
      visible: true,
      templateBlockKey: 'str_regulatory_summary',
      fields: [
        { key: 'jurisdiction',           label: 'Jurisdiction',             type: 'text',     required: false, visible: true, order: 1 },
        { key: 'permit_required',        label: 'Permit Required',          type: 'select',   required: false, visible: true, order: 2,
          options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Unknown' }] },
        { key: 'regulation_tier',        label: 'Regulation Tier',          type: 'select',   required: false, visible: true, order: 3,
          options: [
            { value: 'UNRESTRICTED', label: 'Unrestricted' },
            { value: 'PERMISSIVE',   label: 'Permissive (permit only)' },
            { value: 'RESTRICTIVE',  label: 'Restrictive (zone/HOA limits)' },
            { value: 'PROHIBITIVE',  label: 'Prohibitive — STR banned' },
            { value: 'UNKNOWN',      label: 'Unknown' },
          ],
        },
        { key: 'total_lodging_tax_rate', label: 'Total Lodging Tax Rate',   type: 'number',   required: false, visible: true, order: 4, suffix: '%' },
        { key: 'compliance_summary',     label: 'Compliance Summary',       type: 'textarea', required: false, visible: true, order: 5 },
      ],
    },

    // ── Assumptions & Certifications ─────────────────────────────────────────
    {
      key: 'str_assumptions',
      label: 'Limiting Conditions & Assumptions',
      order: 50,
      required: true,
      visible: true,
      templateBlockKey: 'str_assumptions',
      fields: [
        { key: 'analyst_assumptions', label: 'Analyst Assumptions', type: 'textarea', required: false, visible: true, order: 1 },
        { key: 'data_date',           label: 'Data Effective Date',  type: 'date',     required: false, visible: true, order: 2 },
        { key: 'completed_by_name',   label: 'Completed By',         type: 'text',     required: false, visible: true, order: 3 },
        { key: 'completed_by_creds',  label: 'Credentials',          type: 'text',     required: false, visible: true, order: 4 },
        { key: 'signature_date',      label: 'Signature Date',        type: 'date',     required: false, visible: true, order: 5 },
      ],
    },
  ],
  templateBlocks: {
    str_subject_property:  'templates/blocks/str-subject-property.html',
    str_projection_table:  'templates/blocks/str-projection-table.html',
    str_comparables:       'templates/blocks/str-comparables.html',
    str_regulatory_summary:'templates/blocks/str-regulatory-summary.html',
    str_assumptions:       'templates/blocks/str-assumptions.html',
    base:                  'templates/str-feasibility-v1.hbs',
  },
  createdAt: '2026-05-15T00:00:00.000Z',
  updatedAt: '2026-05-15T00:00:00.000Z',
};
