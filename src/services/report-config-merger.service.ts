/**
 * ReportConfigMergerService  (R-25)
 *
 * Resolves the effective report configuration for an order by loading the
 * UAD 3.6 base document from `report-config-base` and applying all applicable
 * tier deltas from `report-config-deltas` in order:
 *
 *   canonical base  →  client  →  subClient  →  product  →  version
 *
 * Later tiers win on all conflicts. Results are cached in-process for 5 minutes
 * (keyed by productId + clientId + subClientId + schemaVersion).
 */

import { CosmosDbService } from './cosmos-db.service.js';
import type {
  EffectiveReportConfig,
  ReportConfigBaseDocument,
  ReportConfigDeltaDocument,
  ReportConfigDeltaTier,
  ReportSectionDef,
  ReportFieldDef,
  ClientReportBranding,
} from '@l1/shared-types';
import type { VendorOrder as Order } from '../types/vendor-order.types.js';
import { Logger } from '../utils/logger.js';
import { BASE_REPORT_CONFIG_ID } from '../seed-data/report-config/urar-1004-base.js';

// Apply tiers in this order so that later entries win.
const TIER_ORDER: ReportConfigDeltaTier[] = ['client', 'subClient', 'product', 'version'];

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  value: EffectiveReportConfig;
  expiresAt: number;
}

export class ReportConfigMergerService {
  private readonly logger = new Logger('ReportConfigMergerService');
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly db: CosmosDbService) {}

  /**
   * Return the fully-merged effective report config for an order.
   *
   * Cache key: `${productId}:${clientId}:${subClientId ?? ''}:${schemaVersion}`.
   * TTL: 5 minutes.
   */
  async getEffectiveConfig(order: Order): Promise<EffectiveReportConfig> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o = order as any;
    const orderId       = String(o.id          ?? '');
    const productId     = String(o.productType  ?? o.orderType    ?? 'FULL_APPRAISAL');
    const clientId      = String(o.clientId     ?? '');
    const subClientId   = o.subClientId ? String(o.subClientId) : undefined;
    const schemaVersion = '1.0.0';

    const cacheKey = `${productId}:${clientId}:${subClientId ?? ''}:${schemaVersion}`;
    const cached   = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      this.logger.debug('ReportConfigMergerService — cache hit', { cacheKey });
      return { ...cached.value, orderId };
    }

    this.logger.info('ReportConfigMergerService — computing effective config', {
      orderId, productId, clientId, subClientId, schemaVersion,
    });

    const [base, allDeltas] = await Promise.all([
      this._loadBase(),
      this._loadAllDeltas(),
    ]);

    const relevant = allDeltas.filter(d =>
      (d.clientId      && d.clientId      === clientId)      ||
      (d.subClientId   && d.subClientId   === subClientId)   ||
      (d.productId     && d.productId     === productId)     ||
      (d.schemaVersion && d.schemaVersion === schemaVersion),
    );

    // Sort by tier; secondary sort by id for determinism within a tier.
    relevant.sort((a, b) => {
      const ta = TIER_ORDER.indexOf(a.tier);
      const tb = TIER_ORDER.indexOf(b.tier);
      return ta !== tb ? ta - tb : a.id.localeCompare(b.id);
    });

    const effective = _mergeConfigs(
      base, relevant, orderId, productId, clientId, subClientId, schemaVersion,
    );

    this.cache.set(cacheKey, { value: effective, expiresAt: Date.now() + CACHE_TTL_MS });
    return effective;
  }

  /**
   * Invalidate the cache entry for a specific config coordinate.
   * Call after upserting any delta document.
   */
  invalidateCache(
    productId: string,
    clientId: string,
    subClientId?: string,
    schemaVersion = '1.0.0',
  ): void {
    const cacheKey = `${productId}:${clientId}:${subClientId ?? ''}:${schemaVersion}`;
    this.cache.delete(cacheKey);
    this.logger.info('ReportConfigMergerService — cache invalidated', { cacheKey });
  }

  // ---------------------------------------------------------------------------

  private async _loadBase(): Promise<ReportConfigBaseDocument> {
    const doc = await this.db.getDocument<ReportConfigBaseDocument>(
      'report-config-base',
      BASE_REPORT_CONFIG_ID,
      BASE_REPORT_CONFIG_ID,
    );
    if (!doc) {
      throw new Error(
        `Base report config '${BASE_REPORT_CONFIG_ID}' not found in 'report-config-base'. ` +
        `Run 'npx tsx src/scripts/seed-report-config.ts' to seed it.`,
      );
    }
    return doc;
  }

  private async _loadAllDeltas(): Promise<ReportConfigDeltaDocument[]> {
    return this.db.queryDocuments<ReportConfigDeltaDocument>(
      'report-config-deltas',
      'SELECT * FROM c',
    );
  }
}

// ---------------------------------------------------------------------------
// Pure merge function (exported for unit testing without class instantiation)
// ---------------------------------------------------------------------------

/**
 * Apply deltas in order (later tiers win) onto a deep clone of the base config.
 * Exported so unit tests can exercise the merge logic directly.
 */
export function _mergeConfigs(
  base: ReportConfigBaseDocument,
  deltas: ReportConfigDeltaDocument[],
  orderId: string,
  productId: string,
  clientId: string,
  subClientId: string | undefined,
  schemaVersion: string,
): EffectiveReportConfig {
  // Deep-clone base sections so we never mutate the caller's object.
  const sections: ReportSectionDef[] = base.sections.map(s => ({
    ...s,
    fields: s.fields.map(f => ({ ...f })),
  }));
  const templateBlocks: Record<string, string> = { ...base.templateBlocks };
  let reportBranding: ClientReportBranding | undefined;

  for (const delta of deltas) {
    // ── Section-level overrides ─────────────────────────────────────────────
    for (const sd of delta.sections ?? []) {
      const idx = sections.findIndex(s => s.key === sd.key);
      if (idx < 0) continue;
      const s = sections[idx]!;
      if (sd.label            !== undefined) s.label            = sd.label;
      if (sd.order            !== undefined) s.order            = sd.order;
      if (sd.required         !== undefined) s.required         = sd.required;
      if (sd.visible          !== undefined) s.visible          = sd.visible;
      if (sd.templateBlockKey !== undefined) s.templateBlockKey = sd.templateBlockKey;
      for (const fd of sd.fields ?? []) {
        const fi = s.fields.findIndex(f => f.key === fd.key);
        if (fi < 0) continue;
        const f = s.fields[fi]!;
        if (fd.label    !== undefined) f.label    = fd.label;
        if (fd.type     !== undefined) f.type     = fd.type;
        if (fd.required !== undefined) f.required = fd.required;
        if (fd.visible  !== undefined) f.visible  = fd.visible;
        if (fd.order    !== undefined) f.order    = fd.order;
        if (fd.options  !== undefined) f.options  = fd.options;
      }
    }

    // ── addFields: append/overwrite fields in an existing section ───────────
    for (const [sectionKey, newFields] of Object.entries(delta.addFields ?? {})) {
      const section = sections.find(s => s.key === sectionKey);
      if (!section) continue;
      for (const nf of newFields) {
        const ei = section.fields.findIndex(f => f.key === nf.key);
        if (ei >= 0) {
          section.fields[ei] = { ...nf };
        } else {
          section.fields.push({ ...nf });
        }
      }
    }

    // ── addSections: append/overwrite entire sections ───────────────────────
    for (const ns of delta.addSections ?? []) {
      const clone: ReportSectionDef = {
        ...ns,
        fields: ns.fields.map((f: ReportFieldDef) => ({ ...f })),
      };
      const ei = sections.findIndex(s => s.key === ns.key);
      if (ei >= 0) {
        sections[ei] = clone;
      } else {
        sections.push(clone);
      }
    }

    // ── templateBlocks: last-wins key merge ─────────────────────────────────
    Object.assign(templateBlocks, delta.templateBlocks ?? {});

    // ── reportBranding: last-wins shallow merge ──────────────────────────────
    if (delta.reportBranding) {
      reportBranding = { ...(reportBranding ?? {}), ...delta.reportBranding };
    }
  }

  return {
    orderId,
    productId,
    clientId,
    ...(subClientId !== undefined ? { subClientId } : {}),
    schemaVersion,
    mergedAt: new Date().toISOString(),
    sections,
    templateBlocks,
    ...(reportBranding !== undefined ? { reportBranding } : {}),
  };
}
