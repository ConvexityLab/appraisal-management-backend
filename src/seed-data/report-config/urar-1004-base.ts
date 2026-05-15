/**
 * Seed data for the UAD 3.6 / URAR 1004 base report config document.
 * Stored as singleton in the `report-config-base` Cosmos container.
 *
 * This is the full-feature superset from which all product/client deltas diverge.
 * All sections visible by default; product deltas suppress what is not applicable.
 */
import type { ReportConfigBaseDocument } from '@l1/shared-types';

export const BASE_REPORT_CONFIG_ID = 'report-config-base-v1';

export const URAR_1004_BASE: ReportConfigBaseDocument = {
  id: BASE_REPORT_CONFIG_ID,
  schemaVersion: '1.0.0',
  templateBlocks: {
    subject_property: 'templates/blocks/subject-property.html',
    neighborhood:     'templates/blocks/neighborhood.html',
    site_section:     'templates/blocks/site.html',
    improvements:     'templates/blocks/improvements.html',
    sales_comparison: 'templates/blocks/sales-comparison.html',
    cost_approach:    'templates/blocks/cost-approach.html',
    income_approach:  'templates/blocks/income-approach.html',
    reconciliation:   'templates/blocks/reconciliation.html',
    ai_insights:      'templates/blocks/ai-insights.html',
  },
  sections: [
    {
      key: 'subject_property',
      label: 'Subject Property',
      order: 1,
      required: true,
      visible: true,
      templateBlockKey: 'subject_property',
      fields: [
        { key: 'address',          label: 'Property Address',       type: 'text',   required: true,  visible: true, order: 1 },
        { key: 'legal_description',label: 'Legal Description',      type: 'textarea',required: false, visible: true, order: 2 },
        { key: 'assessors_parcel', label: "Assessor's Parcel #",    type: 'text',   required: false, visible: true, order: 3 },
        { key: 'tax_year',         label: 'Tax Year',               type: 'number', required: false, visible: true, order: 4 },
        { key: 'r_e_taxes',        label: 'R.E. Taxes $',           type: 'number', required: false, visible: true, order: 5, prefix: '$' },
        { key: 'occupant',         label: 'Occupant',               type: 'select', required: true,  visible: true, order: 6,
          options: [{value:'Owner',label:'Owner'},{value:'Tenant',label:'Tenant'},{value:'Vacant',label:'Vacant'}] },
        { key: 'property_rights',  label: 'Property Rights Appraised', type: 'select', required: true, visible: true, order: 7,
          options: [{value:'FeeSimple',label:'Fee Simple'},{value:'Leasehold',label:'Leasehold'}] },
        { key: 'assignment_type',  label: 'Assignment Type',        type: 'select', required: true, visible: true, order: 8,
          options: [{value:'Purchase',label:'Purchase'},{value:'Refinance',label:'Refinance'},{value:'Other',label:'Other'}] },
      ],
    },
    {
      key: 'neighborhood',
      label: 'Neighborhood',
      order: 2,
      required: true,
      visible: true,
      templateBlockKey: 'neighborhood',
      fields: [
        { key: 'location_type',    label: 'Location',              type: 'select', required: true,  visible: true, order: 1,
          options: [{value:'Urban',label:'Urban'},{value:'Suburban',label:'Suburban'},{value:'Rural',label:'Rural'}] },
        { key: 'built_up',         label: 'Built-Up',              type: 'select', required: true,  visible: true, order: 2,
          options: [{value:'Over75',label:'Over 75%'},{value:'25to75',label:'25-75%'},{value:'Under25',label:'Under 25%'}] },
        { key: 'growth',           label: 'Growth',                type: 'select', required: true,  visible: true, order: 3,
          options: [{value:'Rapid',label:'Rapid'},{value:'Stable',label:'Stable'},{value:'Slow',label:'Slow'}] },
        { key: 'property_values',  label: 'Property Values',       type: 'select', required: true,  visible: true, order: 4,
          options: [{value:'Increasing',label:'Increasing'},{value:'Stable',label:'Stable'},{value:'Declining',label:'Declining'}] },
        { key: 'neighborhood_desc',label: 'Neighborhood Description', type: 'textarea', required: false, visible: true, order: 5 },
      ],
    },
    {
      key: 'site_section',
      label: 'Site',
      order: 3,
      required: false,
      visible: true,
      templateBlockKey: 'site_section',
      fields: [
        { key: 'lot_size',        label: 'Lot Size',              type: 'number', required: true,  visible: true, order: 1 },
        { key: 'lot_size_unit',   label: 'Unit',                  type: 'select', required: true,  visible: true, order: 2,
          options: [{value:'sf',label:'sq ft'},{value:'acres',label:'Acres'}] },
        { key: 'zoning',          label: 'Zoning Classification', type: 'text',   required: true,  visible: true, order: 3 },
        { key: 'flood_zone',      label: 'FEMA Flood Zone',       type: 'text',   required: false, visible: true, order: 4 },
        { key: 'hbu',             label: 'Highest & Best Use',    type: 'select', required: true,  visible: true, order: 5,
          options: [{value:'Present',label:'Present Use'},{value:'Other',label:'Other Use'}] },
      ],
    },
    {
      key: 'improvements',
      label: 'Improvements',
      order: 4,
      required: true,
      visible: true,
      templateBlockKey: 'improvements',
      fields: [
        { key: 'gla',            label: 'Gross Living Area (sf)', type: 'number', required: true,  visible: true, order: 1 },
        { key: 'year_built',     label: 'Year Built',             type: 'number', required: true,  visible: true, order: 2 },
        { key: 'condition',      label: 'Condition (C1-C6)',      type: 'select', required: true,  visible: true, order: 3,
          options: ['C1','C2','C3','C4','C5','C6'].map(v => ({value:v,label:v})) },
        { key: 'quality',        label: 'Quality (Q1-Q6)',        type: 'select', required: true,  visible: true, order: 4,
          options: ['Q1','Q2','Q3','Q4','Q5','Q6'].map(v => ({value:v,label:v})) },
        { key: 'bedrooms',       label: 'Bedrooms',               type: 'number', required: true,  visible: true, order: 5 },
        { key: 'baths_full',     label: 'Full Baths',             type: 'number', required: true,  visible: true, order: 6 },
        { key: 'baths_half',     label: 'Half Baths',             type: 'number', required: false, visible: true, order: 7 },
      ],
    },
    {
      key: 'sales_comparison',
      label: 'Sales Comparison Approach',
      order: 5,
      required: true,
      visible: true,
      templateBlockKey: 'sales_comparison',
      fields: [
        { key: 'indicated_value_sca', label: 'Indicated Value by SCA', type: 'number', required: true, visible: true, order: 1, prefix: '$' },
        { key: 'reconciliation_sca',  label: 'SCA Reconciliation Narrative', type: 'textarea', required: false, visible: true, order: 2 },
      ],
    },
    {
      key: 'cost_approach',
      label: 'Cost Approach',
      order: 6,
      required: false,
      visible: true,
      templateBlockKey: 'cost_approach',
      fields: [
        { key: 'estimated_site_value',   label: 'Estimated Site Value',           type: 'number', required: false, visible: true, order: 1, prefix: '$' },
        { key: 'dwelling_cost_new',      label: 'Dwelling — Cost New',            type: 'number', required: false, visible: true, order: 2, prefix: '$' },
        { key: 'depreciation',           label: 'Depreciation',                   type: 'number', required: false, visible: true, order: 3, prefix: '$' },
        { key: 'indicated_value_cost',   label: 'Indicated Value by Cost Approach', type: 'number', required: false, visible: true, order: 4, prefix: '$' },
      ],
    },
    {
      key: 'income_approach',
      label: 'Income Approach',
      order: 7,
      required: false,
      visible: true,
      templateBlockKey: 'income_approach',
      fields: [
        { key: 'estimated_monthly_rent', label: 'Estimated Monthly Market Rent',  type: 'number', required: false, visible: true, order: 1, prefix: '$' },
        { key: 'gross_rent_multiplier',  label: 'Gross Rent Multiplier',          type: 'number', required: false, visible: true, order: 2 },
        { key: 'indicated_value_income', label: 'Indicated Value by Income Approach', type: 'number', required: false, visible: true, order: 3, prefix: '$' },
      ],
    },
    {
      key: 'reconciliation',
      label: 'Reconciliation',
      order: 8,
      required: true,
      visible: true,
      templateBlockKey: 'reconciliation',
      fields: [
        { key: 'final_opinion_value',    label: 'Final Opinion of Value',         type: 'number', required: true,  visible: true, order: 1, prefix: '$' },
        { key: 'effective_date',         label: 'Effective Date of Appraisal',    type: 'date',   required: true,  visible: true, order: 2 },
        { key: 'reconciliation_narrative', label: 'Reconciliation Narrative',     type: 'textarea', required: false, visible: true, order: 3 },
      ],
    },
    {
      key: 'ai_insights',
      label: 'AI Insights & Quality Review',
      order: 9,
      required: false,
      visible: true,
      templateBlockKey: 'ai_insights',
      fields: [
        { key: 'axiom_evaluation_id',    label: 'Axiom Evaluation ID',            type: 'text',   required: false, visible: true, order: 1 },
        { key: 'overall_risk_score',     label: 'Overall Risk Score',             type: 'number', required: false, visible: true, order: 2 },
        { key: 'computed_decision',      label: 'Computed Decision',              type: 'text',   required: false, visible: true, order: 3 },
      ],
    },
    // ── Form-type conditional sections — hidden by default, enabled via product delta ──────────
    //
    // `project-info`: collects CanonicalCondoDetail + CanonicalPudDetail + CanonicalHoaDetail.
    // - Enabled by: delta-urar-1073 (URAR_1073 product) setting visible: true
    // - Also data-driven via visibleWhen: show when reportType is FORM_1073 OR condoDetail present
    // - Rendered by: ProjectInfoSection.tsx (self-contained, reads from Redux selectDraftCondoDetail)
    {
      key: 'project-info',
      label: 'Project Information',
      order: 35,
      required: false,
      visible: false,
      templateBlockKey: 'project-info',
      visibleWhen: {
        or: [
          { '==': [{ var: 'reportType' }, 'FORM_1073'] },
          { '==': [{ var: 'reportType' }, 'FORM_1033'] },
          { in: ['ondo', { var: 'subject.propertyType' }] },
          { in: ['PUD',  { var: 'subject.propertyType' }] },
          { '!=': [{ var: 'subject.condoDetail' }, null] },
        ],
      },
      fields: [],  // All field editing is handled by ProjectInfoSection.tsx component
    },
    // `manufactured-home`: collects CanonicalManufacturedHome.
    // - Enabled by: delta-full-1004C (FULL_1004C product) setting visible: true
    // - Also data-driven via visibleWhen: show when reportType is FORM_1004C OR constructionMethod Manufactured
    // - Rendered by: ManufacturedHomeSection.tsx (self-contained, reads from Redux)
    {
      key: 'manufactured-home',
      label: 'Manufactured Home',
      order: 36,
      required: false,
      visible: false,
      templateBlockKey: 'manufactured-home',
      visibleWhen: {
        or: [
          { '==': [{ var: 'reportType' }, 'FORM_1004C'] },
          { '==': [{ var: 'subject.constructionMethod' }, 'Manufactured'] },
        ],
      },
      fields: [],  // All field editing is handled by ManufacturedHomeSection.tsx component
    },
  ],
  createdAt: '2026-05-11T00:00:00.000Z',
  updatedAt: '2026-05-13T00:00:00.000Z',
};
