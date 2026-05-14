/**
 * Scorecard Rollup Profile Service
 *
 * CRUD + overlay resolution for ScorecardRollupProfile docs. The calculator
 * (VendorPerformanceCalculatorService) calls `resolveProfile(...)` at compute
 * time and gets back the merged fixed-shape parameters; if any layer carried
 * a customFormulaOverride, that wins.
 *
 * Overlay hierarchy: BASE → CLIENT → PRODUCT → CLIENT_PRODUCT × phase.
 * categoryWeights is replaced WHOLE on overlay merge to preserve sum-to-1;
 * every other field merges field-by-field.
 *
 * Storage: Cosmos container `scorecard-rollup-profiles`, partition key /tenantId.
 * CRUD-N: every save bumps version per (scope, phase) pair, prior is deactivated.
 */

import { v4 as uuidv4 } from 'uuid';
import { CosmosDbService } from './cosmos-db.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import { Logger } from '../utils/logger.js';
import type {
  ScorecardRollupProfile,
  ResolvedScorecardRollupProfile,
  ScorecardCategoryWeights,
  ScorecardWindowConfig,
  ScorecardTimeDecayConfig,
  ScorecardGate,
  ScorecardPenalty,
  ScorecardTierThresholds,
} from '../types/vendor-marketplace.types.js';

const CONTAINER = 'scorecard-rollup-profiles';
const DOC_TYPE = 'scorecard-rollup-profile';

/**
 * Default BASE profile — used when no profile exists for a tenant. Mirrors
 * the legacy hard-coded constants (SCORECARD_WINDOW_SIZE=25, blend=0.5,
 * equal-weight categories) so behaviour is unchanged for unprofiled tenants.
 */
export const DEFAULT_BASE_PROFILE: Omit<
  ScorecardRollupProfile,
  'id' | 'tenantId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
> = {
  type: DOC_TYPE,
  scope: { kind: 'BASE' },
  phase: 'ANY',
  version: 0,
  active: true,
  categoryWeights: {
    // Equal weight default — David's algorithm will override per-tenant.
    report: 0.20,
    quality: 0.20,
    communication: 0.20,
    turnTime: 0.20,
    professionalism: 0.20,
  },
  window: {
    mode: 'TRAILING_ORDERS',
    size: 25,
    minSampleSize: 3,
  },
  timeDecay: {
    enabled: false,
    halfLifeDays: 180,
  },
  derivedSignalBlendWeight: 0.5,
  gates: [],
  penalties: [],
  tierThresholds: {
    PLATINUM: 90,
    GOLD: 75,
    SILVER: 60,
    BRONZE: 40,
  },
};

export interface RollupProfileResolutionInput {
  tenantId: string;
  clientId?: string;
  productType?: string;
  phase?: 'ORIGINAL' | 'REVIEW';
}

export class ScorecardRollupProfileService {
  private logger = new Logger('ScorecardRollupProfileService');
  /**
   * Per-process cache of tenants whose BASE profile has already been
   * verified-or-seeded. Resolver checks this before issuing the ensure
   * attempt so we don't hit Cosmos on every resolve call after the first.
   * Reset on process restart (cheap re-check; ensure is idempotent).
   */
  private readonly baseProfileSeededTenants = new Set<string>();

  constructor(
    private dbService: CosmosDbService,
    private auditService: AuditTrailService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async createProfile(
    tenantId: string,
    payload: Omit<
      ScorecardRollupProfile,
      'id' | 'tenantId' | 'type' | 'version' | 'active' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
    >,
    createdBy: string,
  ): Promise<ScorecardRollupProfile> {
    const errors = validateProfilePayload(payload);
    if (errors.length > 0) {
      throw new RollupProfileError(400, `Validation failed: ${errors.join(' | ')}`);
    }

    const existing = await this.findActiveByScopeAndPhase(tenantId, payload.scope, payload.phase);
    const nextVersion = existing ? existing.version + 1 : 1;

    const now = new Date().toISOString();
    const profile: ScorecardRollupProfile = {
      id: `srp-${tenantId}-${uuidv4()}`,
      tenantId,
      type: DOC_TYPE,
      scope: payload.scope,
      phase: payload.phase,
      version: nextVersion,
      active: true,
      categoryWeights: renormalizeWeights(payload.categoryWeights),
      window: payload.window,
      timeDecay: payload.timeDecay,
      derivedSignalBlendWeight: clamp01(payload.derivedSignalBlendWeight),
      gates: payload.gates ?? [],
      penalties: payload.penalties ?? [],
      tierThresholds: payload.tierThresholds,
      ...(payload.customFormulaOverride
        ? { customFormulaOverride: payload.customFormulaOverride }
        : {}),
      createdAt: now,
      createdBy,
      updatedAt: now,
      updatedBy: createdBy,
    };

    if (existing) {
      const supersededDoc: ScorecardRollupProfile = {
        ...existing,
        active: false,
        updatedAt: now,
        updatedBy: createdBy,
      };
      await this.dbService.upsertItem(CONTAINER, supersededDoc as unknown as Record<string, unknown>);
    }

    await this.dbService.createItem(CONTAINER, profile as unknown as Record<string, unknown>);

    await this.auditService.log({
      actor: { userId: createdBy },
      action: 'scorecard-rollup-profile.create',
      resource: { type: 'scorecard-rollup-profile', id: profile.id },
      metadata: {
        scope: profile.scope,
        phase: profile.phase,
        version: profile.version,
        hadCustomFormula: !!profile.customFormulaOverride,
      },
    });

    return profile;
  }

  async listProfiles(
    tenantId: string,
    filter: { activeOnly?: boolean } = {},
  ): Promise<ScorecardRollupProfile[]> {
    const query = filter.activeOnly
      ? `SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = '${DOC_TYPE}' AND c.active = true`
      : `SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = '${DOC_TYPE}'`;
    const result = await this.dbService.queryItems<ScorecardRollupProfile>(CONTAINER, query, [
      { name: '@tenantId', value: tenantId },
    ]);
    return result.success && result.data ? result.data : [];
  }

  async getProfile(tenantId: string, profileId: string): Promise<ScorecardRollupProfile | null> {
    const query = `SELECT * FROM c WHERE c.tenantId = @tenantId AND c.id = @id AND c.type = '${DOC_TYPE}'`;
    const result = await this.dbService.queryItems<ScorecardRollupProfile>(CONTAINER, query, [
      { name: '@tenantId', value: tenantId },
      { name: '@id', value: profileId },
    ]);
    return result.success && result.data && result.data.length > 0 ? result.data[0] ?? null : null;
  }

  /**
   * Idempotently ensure a BASE/ANY profile exists for the tenant. Used by
   * the resolver on first touch so admins always see at least one row in
   * the UI. Returns the existing doc if one is found, otherwise creates a
   * v1 BASE profile mirroring DEFAULT_BASE_PROFILE.
   *
   * Concurrency: two parallel callers both miss the read, both try to
   * insert — the second's createItem returns a 409 conflict on the unique
   * key (scope.kind, scope.clientId, scope.productType, phase, version).
   * That case is swallowed and re-resolved by a follow-up read.
   *
   * Cached in-process via `baseProfileSeededTenants` to keep the resolver
   * hot-path single-read after first seed.
   */
  async ensureBaseProfile(
    tenantId: string,
    createdBy = 'system:auto-seed',
  ): Promise<ScorecardRollupProfile> {
    if (this.baseProfileSeededTenants.has(tenantId)) {
      // Cached as already-present; re-read to return the doc (the resolver
      // only calls this when its prior read found nothing, so we shouldn't
      // be in the cache here unless something is off — defensive re-read).
      const existing = await this.findActiveByScopeAndPhase(tenantId, { kind: 'BASE' }, 'ANY');
      if (existing) return existing;
    }

    // Re-check inside the seed path in case another caller raced us between
    // the resolver's read and our write.
    const existing = await this.findActiveByScopeAndPhase(tenantId, { kind: 'BASE' }, 'ANY');
    if (existing) {
      this.baseProfileSeededTenants.add(tenantId);
      return existing;
    }

    const now = new Date().toISOString();
    const profile: ScorecardRollupProfile = {
      id: `srp-${tenantId}-${uuidv4()}`,
      tenantId,
      type: DOC_TYPE,
      scope: { kind: 'BASE' },
      phase: 'ANY',
      version: 1,
      active: true,
      categoryWeights: { ...DEFAULT_BASE_PROFILE.categoryWeights },
      window: { ...DEFAULT_BASE_PROFILE.window },
      timeDecay: { ...DEFAULT_BASE_PROFILE.timeDecay },
      derivedSignalBlendWeight: DEFAULT_BASE_PROFILE.derivedSignalBlendWeight,
      gates: [...DEFAULT_BASE_PROFILE.gates],
      penalties: [...DEFAULT_BASE_PROFILE.penalties],
      tierThresholds: { ...DEFAULT_BASE_PROFILE.tierThresholds },
      createdAt: now,
      createdBy,
      updatedAt: now,
      updatedBy: createdBy,
    };

    try {
      await this.dbService.createItem(CONTAINER, profile as unknown as Record<string, unknown>);
      await this.auditService.log({
        actor: { userId: createdBy },
        action: 'scorecard-rollup-profile.auto-seed',
        resource: { type: 'scorecard-rollup-profile', id: profile.id },
        metadata: { scope: profile.scope, phase: profile.phase, version: profile.version },
      });
      this.baseProfileSeededTenants.add(tenantId);
      this.logger.info('Auto-seeded BASE scorecard-rollup profile for tenant', {
        tenantId,
        profileId: profile.id,
      });
      return profile;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 409 = a parallel caller seeded first; re-read and return whatever
      // they wrote. Anything else propagates — caller (resolver) logs + falls
      // back to in-memory defaults.
      if (message.includes('409') || message.includes('Conflict')) {
        const racedExisting = await this.findActiveByScopeAndPhase(
          tenantId,
          { kind: 'BASE' },
          'ANY',
        );
        if (racedExisting) {
          this.baseProfileSeededTenants.add(tenantId);
          return racedExisting;
        }
      }
      throw err;
    }
  }

  // ─── Resolution ──────────────────────────────────────────────────────────

  async resolveProfile(
    input: RollupProfileResolutionInput,
  ): Promise<ResolvedScorecardRollupProfile> {
    const phase: 'ORIGINAL' | 'REVIEW' = input.phase ?? 'ORIGINAL';
    const appliedProfileIds: string[] = [];

    // Start with the code-default; layer DB overlays on top.
    let merged: ResolvedScorecardRollupProfile = {
      categoryWeights: { ...DEFAULT_BASE_PROFILE.categoryWeights },
      window: { ...DEFAULT_BASE_PROFILE.window },
      timeDecay: { ...DEFAULT_BASE_PROFILE.timeDecay },
      derivedSignalBlendWeight: DEFAULT_BASE_PROFILE.derivedSignalBlendWeight,
      gates: [...DEFAULT_BASE_PROFILE.gates],
      penalties: [...DEFAULT_BASE_PROFILE.penalties],
      tierThresholds: { ...DEFAULT_BASE_PROFILE.tierThresholds },
      appliedProfileIds,
    };

    // 1. BASE — phase-specific then ANY fallback. If neither exists this
    // is the tenant's first resolve; seed a BASE profile (mirroring
    // DEFAULT_BASE_PROFILE) so admins land on an editable doc rather than
    // an empty list. Idempotent + cached in-process.
    let baseDoc =
      (await this.findActiveByScopeAndPhase(input.tenantId, { kind: 'BASE' }, phase)) ??
      (await this.findActiveByScopeAndPhase(input.tenantId, { kind: 'BASE' }, 'ANY'));
    if (!baseDoc && !this.baseProfileSeededTenants.has(input.tenantId)) {
      baseDoc = await this.ensureBaseProfile(input.tenantId).catch((err) => {
        this.logger.warn('ensureBaseProfile failed during resolve', {
          tenantId: input.tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
    }
    if (baseDoc) {
      appliedProfileIds.push(baseDoc.id);
      merged = applyOverlay(merged, baseDoc);
    }

    // 2. CLIENT overlay
    if (input.clientId) {
      const clientDoc =
        (await this.findActiveByScopeAndPhase(
          input.tenantId,
          { kind: 'CLIENT', clientId: input.clientId },
          phase,
        )) ??
        (await this.findActiveByScopeAndPhase(
          input.tenantId,
          { kind: 'CLIENT', clientId: input.clientId },
          'ANY',
        ));
      if (clientDoc) {
        appliedProfileIds.push(clientDoc.id);
        merged = applyOverlay(merged, clientDoc);
      }
    }

    // 3. PRODUCT overlay
    if (input.productType) {
      const productDoc =
        (await this.findActiveByScopeAndPhase(
          input.tenantId,
          { kind: 'PRODUCT', productType: input.productType },
          phase,
        )) ??
        (await this.findActiveByScopeAndPhase(
          input.tenantId,
          { kind: 'PRODUCT', productType: input.productType },
          'ANY',
        ));
      if (productDoc) {
        appliedProfileIds.push(productDoc.id);
        merged = applyOverlay(merged, productDoc);
      }
    }

    // 4. CLIENT_PRODUCT overlay — the most specific.
    if (input.clientId && input.productType) {
      const cpDoc =
        (await this.findActiveByScopeAndPhase(
          input.tenantId,
          { kind: 'CLIENT_PRODUCT', clientId: input.clientId, productType: input.productType },
          phase,
        )) ??
        (await this.findActiveByScopeAndPhase(
          input.tenantId,
          { kind: 'CLIENT_PRODUCT', clientId: input.clientId, productType: input.productType },
          'ANY',
        ));
      if (cpDoc) {
        appliedProfileIds.push(cpDoc.id);
        merged = applyOverlay(merged, cpDoc);
      }
    }

    // Renormalize at the end — overlay merge may have left weights slightly off.
    merged.categoryWeights = renormalizeWeights(merged.categoryWeights);
    return merged;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async findActiveByScopeAndPhase(
    tenantId: string,
    scope: ScorecardRollupProfile['scope'],
    phase: 'ORIGINAL' | 'REVIEW' | 'ANY',
  ): Promise<ScorecardRollupProfile | null> {
    const filters: string[] = [
      'c.tenantId = @tenantId',
      `c.type = '${DOC_TYPE}'`,
      'c.active = true',
      'c.scope.kind = @kind',
      'c.phase = @phase',
    ];
    const params: Array<{ name: string; value: unknown }> = [
      { name: '@tenantId', value: tenantId },
      { name: '@kind', value: scope.kind },
      { name: '@phase', value: phase },
    ];
    if (scope.clientId) {
      filters.push('c.scope.clientId = @clientId');
      params.push({ name: '@clientId', value: scope.clientId });
    }
    if (scope.productType) {
      filters.push('c.scope.productType = @productType');
      params.push({ name: '@productType', value: scope.productType });
    }
    const query = `SELECT TOP 1 * FROM c WHERE ${filters.join(' AND ')} ORDER BY c.version DESC`;
    const result = await this.dbService.queryItems<ScorecardRollupProfile>(
      CONTAINER,
      query,
      params,
    );
    return result.success && result.data && result.data.length > 0 ? result.data[0] ?? null : null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Merge an overlay doc on top of the running resolved profile. Per the
 * "Replace categoryWeights as whole" decision, weights overwrite atomically;
 * every other field also overwrites (no deep merge on gates/penalties — an
 * overlay either keeps the inherited arrays or replaces them entirely).
 */
function applyOverlay(
  base: ResolvedScorecardRollupProfile,
  overlay: ScorecardRollupProfile,
): ResolvedScorecardRollupProfile {
  const next: ResolvedScorecardRollupProfile = { ...base };
  // categoryWeights: replace whole if the overlay provided them.
  if (overlay.categoryWeights) {
    next.categoryWeights = overlay.categoryWeights;
  }
  if (overlay.window) next.window = overlay.window;
  if (overlay.timeDecay) next.timeDecay = overlay.timeDecay;
  if (typeof overlay.derivedSignalBlendWeight === 'number') {
    next.derivedSignalBlendWeight = clamp01(overlay.derivedSignalBlendWeight);
  }
  if (overlay.gates) next.gates = overlay.gates;
  if (overlay.penalties) next.penalties = overlay.penalties;
  if (overlay.tierThresholds) next.tierThresholds = overlay.tierThresholds;
  if (overlay.customFormulaOverride !== undefined) {
    next.customFormulaOverride = overlay.customFormulaOverride;
  }
  return next;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function renormalizeWeights(w: ScorecardCategoryWeights): ScorecardCategoryWeights {
  const sum = w.report + w.quality + w.communication + w.turnTime + w.professionalism;
  if (sum <= 0) {
    return { report: 0.2, quality: 0.2, communication: 0.2, turnTime: 0.2, professionalism: 0.2 };
  }
  return {
    report: w.report / sum,
    quality: w.quality / sum,
    communication: w.communication / sum,
    turnTime: w.turnTime / sum,
    professionalism: w.professionalism / sum,
  };
}

function validateProfilePayload(
  payload: Omit<
    ScorecardRollupProfile,
    'id' | 'tenantId' | 'type' | 'version' | 'active' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
  >,
): string[] {
  const errors: string[] = [];
  if (!payload.scope?.kind) errors.push('scope.kind is required');
  else {
    if (
      (payload.scope.kind === 'CLIENT' || payload.scope.kind === 'CLIENT_PRODUCT') &&
      !payload.scope.clientId
    ) {
      errors.push('scope.clientId is required for CLIENT and CLIENT_PRODUCT');
    }
    if (
      (payload.scope.kind === 'PRODUCT' || payload.scope.kind === 'CLIENT_PRODUCT') &&
      !payload.scope.productType
    ) {
      errors.push('scope.productType is required for PRODUCT and CLIENT_PRODUCT');
    }
  }
  if (!['ORIGINAL', 'REVIEW', 'ANY'].includes(payload.phase)) {
    errors.push(`phase must be ORIGINAL, REVIEW, or ANY (got ${payload.phase})`);
  }
  if (!payload.categoryWeights) {
    errors.push('categoryWeights is required');
  } else {
    for (const k of ['report', 'quality', 'communication', 'turnTime', 'professionalism'] as const) {
      const v = payload.categoryWeights[k];
      if (typeof v !== 'number' || v < 0 || v > 1) {
        errors.push(`categoryWeights.${k} must be 0..1`);
      }
    }
  }
  if (!payload.window) errors.push('window is required');
  else {
    if (!['TRAILING_ORDERS', 'TIME_WINDOW', 'BOTH'].includes(payload.window.mode)) {
      errors.push('window.mode must be TRAILING_ORDERS, TIME_WINDOW, or BOTH');
    }
    if (typeof payload.window.size !== 'number' || payload.window.size < 1) {
      errors.push('window.size must be >= 1');
    }
    if (
      typeof payload.window.minSampleSize !== 'number' ||
      payload.window.minSampleSize < 1
    ) {
      errors.push('window.minSampleSize must be >= 1');
    }
  }
  if (!payload.tierThresholds) errors.push('tierThresholds is required');
  else {
    const t = payload.tierThresholds;
    if (!(t.PLATINUM > t.GOLD && t.GOLD > t.SILVER && t.SILVER > t.BRONZE)) {
      errors.push('tierThresholds must be strictly descending: PLATINUM > GOLD > SILVER > BRONZE');
    }
  }
  return errors;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class RollupProfileError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'RollupProfileError';
  }
}

export { applyOverlay, renormalizeWeights, validateProfilePayload };
