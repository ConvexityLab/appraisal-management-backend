/**
 * Report Config Type System
 *
 * Keep this file in sync with:
 *   l1-valuation-platform-ui/src/types/report-config.types.ts
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonLogicRule = Record<string, any>;

export interface ReportFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'switch' | 'date' | 'textarea' | 'array';
  required: boolean;
  visible: boolean;
  order: number;
  options?: Array<{ value: string; label: string }>;
  prefix?: string;
  suffix?: string;
  maxLength?: number;
  rows?: number;
  visibleWhen?: JsonLogicRule;
  requiredWhen?: JsonLogicRule;
}

export interface ReportSectionDef {
  key: string;
  label: string;
  order: number;
  required: boolean;
  visible: boolean;
  templateBlockKey: string;
  fields: ReportFieldDef[];
  visibleWhen?: JsonLogicRule;
}

export type EffectiveReportSectionDef = ReportSectionDef;

/**
 * Client-level report branding injected into every Handlebars template context
 * under the `branding` key (R-21).
 *
 * Template usage:
 *   {{#if branding.logoUrl}}<img src="{{branding.logoUrl}}" class="report-logo">{{/if}}
 *   <style>:root { --accent: {{branding.primaryColor}}; }</style>
 */
export interface ClientReportBranding {
  /** Absolute or SAS URL to the client logo for embedding in the report header. */
  logoUrl?: string;
  /** CSS colour value (hex, rgb, etc.) for client accent colour. */
  primaryColor?: string;
  /** One-line footer text (e.g. "Report prepared for Acme Mortgage Corp."). */
  footerText?: string;
}

export interface EffectiveReportConfig {
  orderId: string;
  productId: string;
  clientId: string;
  subClientId?: string;
  schemaVersion: string;
  mergedAt: string;
  sections: EffectiveReportSectionDef[];
  templateBlocks: Record<string, string>;
  /**
   * Client branding resolved from `ClientConfiguration.reportBranding` (R-21).
   * Absent when the client has no branding configured.
   */
  reportBranding?: ClientReportBranding;
}

// ---------------------------------------------------------------------------
// Config document shapes (Cosmos containers: report-config-base /
// report-config-deltas)  — added R-25 / R-26
// ---------------------------------------------------------------------------

/**
 * Singleton base document stored in the `report-config-base` container.
 * Contains the full UAD 3.6 / URAR 1004 section and field superset.
 * All product/client deltas are applied on top of this.
 */
export interface ReportConfigBaseDocument {
  /** Singleton id — use constant BASE_REPORT_CONFIG_ID. */
  id: string;
  schemaVersion: string;
  sections: ReportSectionDef[];
  templateBlocks: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Merge tier labels — applied in order: client → subClient → product → version
 * (later tiers win on conflict).
 */
export type ReportConfigDeltaTier = 'client' | 'subClient' | 'product' | 'version';

/**
 * Partial override of a single field within a delta's section entry.
 * Only the fields that are explicitly set override the base/prior tier value.
 */
export interface ReportFieldDeltaDef {
  key: string;
  label?: string;
  type?: ReportFieldDef['type'];
  required?: boolean;
  visible?: boolean;
  order?: number;
  options?: ReportFieldDef['options'];
}

/**
 * Partial override of a single section within a delta document.
 * Sections are matched by `key`; only fields explicitly set override prior values.
 */
export interface ReportSectionDeltaDef {
  key: string;
  label?: string;
  order?: number;
  required?: boolean;
  visible?: boolean;
  templateBlockKey?: string;
  /** Field-level overrides within this section — matched by `key`. */
  fields?: ReportFieldDeltaDef[];
}

/**
 * A tier-specific override document stored in the `report-config-deltas` container.
 *
 * Selector fields (`clientId`, `subClientId`, `productId`, `schemaVersion`) identify
 * when this delta applies to a given order. At least one selector should be set.
 *
 * Merge semantics (applied in tier order, later wins):
 * - `sections`: overrides visible/required/label/order/templateBlockKey on matching keys
 * - `addFields`: appends new fields to an existing section (key collision = last wins)
 * - `addSections`: appends entirely new sections (key collision = last wins)
 * - `templateBlocks`: last-wins key merge
 * - `reportBranding`: last-wins shallow merge
 */
export interface ReportConfigDeltaDocument {
  id: string;
  tier: ReportConfigDeltaTier;
  /** Selector: which client this delta applies to. */
  clientId?: string;
  /** Selector: which sub-client this delta applies to (requires clientId match). */
  subClientId?: string;
  /** Selector: which product/program this delta applies to. */
  productId?: string;
  /** Selector: which schema version pin this delta applies to. */
  schemaVersion?: string;
  /** Section-level overrides — matched by section `key`. */
  sections?: ReportSectionDeltaDef[];
  /**
   * New fields to append to existing sections.
   * Map key = section key, value = fields to add/overwrite.
   */
  addFields?: Record<string, ReportFieldDef[]>;
  /** Entirely new sections appended to the section list (key collision = last wins). */
  addSections?: ReportSectionDef[];
  /** Template block overrides — last-wins key merge onto base templateBlocks. */
  templateBlocks?: Record<string, string>;
  /** Client branding override — last-wins shallow merge. */
  reportBranding?: ClientReportBranding;
  createdAt: string;
  updatedAt: string;
}
