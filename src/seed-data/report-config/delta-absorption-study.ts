/**
 * Product delta for Absorption Rate & Sellout Analysis.
 *
 * This is a standalone product — no URAR 1004 base applies.
 * The delta adds all sections for the Absorption Study report:
 *   - Project characteristics & unit mix
 *   - Market context summary
 *   - Absorption scenarios (base / upside / downside)
 *   - Comparable project grid
 *   - Analyst assumptions & certifications
 */
import type { ReportConfigDeltaDocument } from '@l1/shared-types';

export const DELTA_ABSORPTION_STUDY: ReportConfigDeltaDocument = {
  id: 'delta-product-absorption-study',
  tier: 'product',
  productId: 'ABSORPTION_STUDY',
  // Suppress all standard URAR sections
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
    // ── Project Characteristics ───────────────────────────────────────────────
    {
      key: 'absorption_project_characteristics',
      label: 'Project Characteristics',
      order: 10,
      required: true,
      visible: true,
      templateBlockKey: 'absorption_project_characteristics',
      fields: [
        { key: 'subject_address',   label: 'Project Address',         type: 'text',     required: true,  visible: true, order: 1 },
        { key: 'project_name',      label: 'Project Name',            type: 'text',     required: false, visible: true, order: 2 },
        { key: 'developer_name',    label: 'Developer / Builder',     type: 'text',     required: false, visible: true, order: 3 },
        { key: 'project_stage',     label: 'Project Stage',           type: 'select',   required: true,  visible: true, order: 4,
          options: [
            { value: 'PRE_CONSTRUCTION', label: 'Pre-Construction' },
            { value: 'UNDER_CONSTRUCTION', label: 'Under Construction' },
            { value: 'COMPLETED',        label: 'Completed / Selling' },
          ],
        },
        { key: 'total_units',       label: 'Total Units',             type: 'number',   required: true,  visible: true, order: 5 },
        { key: 'unit_mix_summary',  label: 'Unit Mix Summary',        type: 'textarea', required: false, visible: true, order: 6 },
        { key: 'comp_search_radius',label: 'Comp Search Radius (mi)', type: 'number',   required: false, visible: true, order: 7 },
        { key: 'comp_sold_days',    label: 'Comp Lookback Window (days)', type: 'number', required: false, visible: true, order: 8 },
      ],
    },

    // ── Market Context ────────────────────────────────────────────────────────
    {
      key: 'absorption_market_context',
      label: 'Market Context',
      order: 20,
      required: false,
      visible: true,
      templateBlockKey: 'absorption_market_context',
      fields: [
        { key: 'median_days_on_market',    label: 'Median Days on Market',         type: 'number', required: false, visible: true, order: 1 },
        { key: 'median_price_per_sqft',    label: 'Median $/SF (comps)',            type: 'number', required: false, visible: true, order: 2, prefix: '$' },
        { key: 'active_competing_projects',label: 'Active Competing Projects',      type: 'number', required: false, visible: true, order: 3 },
        { key: 'market_trend',             label: 'Market Trend',                   type: 'select', required: false, visible: true, order: 4,
          options: [
            { value: 'INCREASING',  label: 'Increasing' },
            { value: 'STABLE',      label: 'Stable' },
            { value: 'DECLINING',   label: 'Declining' },
          ],
        },
      ],
    },

    // ── Absorption Scenarios ──────────────────────────────────────────────────
    {
      key: 'absorption_scenarios',
      label: 'Absorption Scenarios',
      order: 30,
      required: true,
      visible: true,
      templateBlockKey: 'absorption_scenarios',
      fields: [
        // Base case
        { key: 'base_presale_pct',    label: 'Base — Pre-Sale %',          type: 'number', required: false, visible: true, order: 1, suffix: '%' },
        { key: 'base_sellout_months', label: 'Base — Sellout Window (mo)', type: 'number', required: false, visible: true, order: 2 },
        // Upside case
        { key: 'up_presale_pct',      label: 'Upside — Pre-Sale %',        type: 'number', required: false, visible: true, order: 3, suffix: '%' },
        { key: 'up_sellout_months',   label: 'Upside — Sellout Window (mo)',type: 'number', required: false, visible: true, order: 4 },
        // Downside case
        { key: 'down_presale_pct',    label: 'Downside — Pre-Sale %',      type: 'number', required: false, visible: true, order: 5, suffix: '%' },
        { key: 'down_sellout_months', label: 'Downside — Sellout Window (mo)',type: 'number', required: false, visible: true, order: 6 },
      ],
    },

    // ── Comparable Projects ───────────────────────────────────────────────────
    {
      key: 'absorption_comparables',
      label: 'Comparable Project Sales',
      order: 40,
      required: false,
      visible: true,
      templateBlockKey: 'absorption_comparables',
      fields: [
        { key: 'comp_count',      label: 'Number of Comparables',  type: 'number', required: false, visible: true, order: 1 },
        { key: 'comp_source',     label: 'Data Source',            type: 'text',   required: false, visible: true, order: 2 },
        { key: 'comp_date_range', label: 'Sale Date Range',        type: 'text',   required: false, visible: true, order: 3 },
      ],
    },

    // ── Assumptions & Certifications ─────────────────────────────────────────
    {
      key: 'absorption_assumptions',
      label: 'Limiting Conditions & Assumptions',
      order: 50,
      required: true,
      visible: true,
      templateBlockKey: 'absorption_assumptions',
      fields: [
        { key: 'analyst_assumptions',  label: 'Analyst Assumptions',     type: 'textarea', required: false, visible: true, order: 1 },
        { key: 'data_date',            label: 'Data Effective Date',      type: 'date',     required: false, visible: true, order: 2 },
        { key: 'completed_by_name',    label: 'Completed By',             type: 'text',     required: false, visible: true, order: 3 },
        { key: 'completed_by_firm',    label: 'Firm / Company',           type: 'text',     required: false, visible: true, order: 4 },
        { key: 'signature_date',       label: 'Signature Date',           type: 'date',     required: false, visible: true, order: 5 },
      ],
    },
  ],
  templateBlocks: {
    absorption_project_characteristics: 'templates/blocks/absorption-project-characteristics.html',
    absorption_market_context:          'templates/blocks/absorption-market-context.html',
    absorption_scenarios:               'templates/blocks/absorption-scenarios.html',
    absorption_comparables:             'templates/blocks/absorption-comparables.html',
    absorption_assumptions:             'templates/blocks/absorption-assumptions.html',
    base:                               'templates/absorption-study-v1.hbs',
  },
  createdAt: '2026-05-15T00:00:00.000Z',
  updatedAt: '2026-05-15T00:00:00.000Z',
};
