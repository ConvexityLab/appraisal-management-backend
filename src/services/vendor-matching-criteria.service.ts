/**
 * Vendor Matching Criteria Profile Service
 *
 * CRUD + resolution for VendorMatchingCriteriaProfile docs. Profiles let
 * Doug & David toggle each matching criterion (performance, availability,
 * proximity, experience, cost, licensure) per scope (BASE / CLIENT /
 * PRODUCT / CLIENT_PRODUCT) and per phase (ORIGINAL / REVIEW), with
 * monotonically-increasing versions per (scope, phase) pair.
 *
 * Storage: a single new Cosmos container `vendor-matching-criteria-profiles`,
 * partition key /tenantId. The matcher calls `resolveProfile(...)` at
 * decision time and walks the overlay chain BASE → CLIENT → PRODUCT →
 * CLIENT_PRODUCT, merging the most-specific configured criteria onto the
 * base. Inactive versions are retained for replay but never resolved.
 *
 * Why a new container instead of embedding in tenant config:
 *   - profiles need their own version chain (overlay × phase × version)
 *   - access by the matcher is keyed on tenant + scope + phase, which is a
 *     natural partition + filter pattern
 *   - audit trail on edits is cleaner with discrete docs
 */

import { v4 as uuidv4 } from 'uuid';
import { CosmosDbService } from './cosmos-db.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import { Logger } from '../utils/logger.js';
import type {
  VendorMatchingCriteriaProfile,
  MatchingCriterionConfig,
  ProximityCriterionConfig,
} from '../types/vendor-marketplace.types.js';

const CONTAINER = 'vendor-matching-criteria-profiles';
const DOC_TYPE = 'vendor-matching-criteria-profile';

/**
 * The default BASE profile shipped with the system. Resolution falls back to
 * this if no BASE doc exists in the tenant. Mirrors the legacy
 * VendorMatchingEngine.WEIGHTS so behaviour is unchanged for tenants that
 * haven't authored any profiles.
 */
export const DEFAULT_BASE_PROFILE: Omit<
  VendorMatchingCriteriaProfile,
  'id' | 'tenantId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
> = {
  type: DOC_TYPE,
  scope: { kind: 'BASE' },
  phase: 'ANY',
  version: 0,
  active: true,
  criteria: {
    performance: { enabled: true, weight: 0.30, mode: 'SCORED' },
    availability: { enabled: true, weight: 0.25, mode: 'SCORED' },
    proximity: {
      enabled: true,
      weight: 0.20,
      mode: 'SCORED',
      primaryRadiusMiles: 50,
      expansionRadiusMiles: 100,
    },
    experience: { enabled: true, weight: 0.15, mode: 'SCORED' },
    cost: { enabled: true, weight: 0.10, mode: 'SCORED' },
    licensure: { enabled: false, weight: 0, mode: 'HARD_GATE' },
  },
};

export interface ProfileResolutionInput {
  tenantId: string;
  clientId?: string;
  productType?: string;
  /** Phase modifier ('ORIGINAL' vs 'REVIEW'); defaults to 'ORIGINAL'. */
  phase?: 'ORIGINAL' | 'REVIEW';
}

export interface ResolvedCriteriaProfile {
  /** Effective per-criterion config after walking the overlay chain. */
  criteria: VendorMatchingCriteriaProfile['criteria'];
  /** The profile docs (oldest-overlay-first) that contributed to the result. */
  appliedProfileIds: string[];
}

export class VendorMatchingCriteriaService {
  private logger = new Logger('VendorMatchingCriteriaService');

  constructor(
    private dbService: CosmosDbService,
    private auditService: AuditTrailService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async createProfile(
    tenantId: string,
    payload: Omit<
      VendorMatchingCriteriaProfile,
      'id' | 'tenantId' | 'type' | 'version' | 'active' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
    >,
    createdBy: string,
  ): Promise<VendorMatchingCriteriaProfile> {
    const validationErrors = validateProfilePayload(payload);
    if (validationErrors.length > 0) {
      throw new CriteriaProfileError(
        400,
        `Profile validation failed: ${validationErrors.join(' | ')}`,
      );
    }

    const existing = await this.findActiveByScopeAndPhase(
      tenantId,
      payload.scope,
      payload.phase,
    );
    const nextVersion = existing ? existing.version + 1 : 1;

    const now = new Date().toISOString();
    const profile: VendorMatchingCriteriaProfile = {
      id: `mcp-${tenantId}-${uuidv4()}`,
      tenantId,
      type: DOC_TYPE,
      scope: payload.scope,
      phase: payload.phase,
      version: nextVersion,
      active: true,
      criteria: payload.criteria,
      createdAt: now,
      createdBy,
      updatedAt: now,
      updatedBy: createdBy,
    };

    // Deactivate the previous version (if any) before writing the new one.
    if (existing) {
      const supersededDoc: VendorMatchingCriteriaProfile = {
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
      action: 'matching-criteria-profile.create',
      resource: { type: 'matching-criteria-profile', id: profile.id },
      metadata: { scope: profile.scope, phase: profile.phase, version: profile.version },
    });

    return profile;
  }

  async listProfiles(
    tenantId: string,
    filter: { activeOnly?: boolean } = {},
  ): Promise<VendorMatchingCriteriaProfile[]> {
    const query = filter.activeOnly
      ? `SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = '${DOC_TYPE}' AND c.active = true`
      : `SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = '${DOC_TYPE}'`;
    const result = await this.dbService.queryItems<VendorMatchingCriteriaProfile>(
      CONTAINER,
      query,
      [{ name: '@tenantId', value: tenantId }],
    );
    return result.success && result.data ? result.data : [];
  }

  async getProfile(
    tenantId: string,
    profileId: string,
  ): Promise<VendorMatchingCriteriaProfile | null> {
    const query =
      `SELECT * FROM c WHERE c.tenantId = @tenantId AND c.id = @id AND c.type = '${DOC_TYPE}'`;
    const result = await this.dbService.queryItems<VendorMatchingCriteriaProfile>(
      CONTAINER,
      query,
      [
        { name: '@tenantId', value: tenantId },
        { name: '@id', value: profileId },
      ],
    );
    return result.success && result.data && result.data.length > 0 ? result.data[0] ?? null : null;
  }

  // ─── Resolution ──────────────────────────────────────────────────────────

  /**
   * Walk the overlay chain BASE → CLIENT → PRODUCT → CLIENT_PRODUCT for the
   * given input. Each step overrides whichever criteria are configured; the
   * earlier-resolved BASE provides the default for anything not overridden.
   * Falls back to DEFAULT_BASE_PROFILE if no BASE doc is present for the
   * tenant.
   */
  async resolveProfile(input: ProfileResolutionInput): Promise<ResolvedCriteriaProfile> {
    const phase: 'ORIGINAL' | 'REVIEW' = input.phase ?? 'ORIGINAL';
    const appliedProfileIds: string[] = [];

    // 1. BASE (phase-specific or ANY)
    const baseDoc =
      (await this.findActiveByScopeAndPhase(input.tenantId, { kind: 'BASE' }, phase)) ??
      (await this.findActiveByScopeAndPhase(input.tenantId, { kind: 'BASE' }, 'ANY'));

    const merged = { ...DEFAULT_BASE_PROFILE.criteria };
    if (baseDoc) {
      appliedProfileIds.push(baseDoc.id);
      mergeCriteria(merged, baseDoc.criteria);
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
        mergeCriteria(merged, clientDoc.criteria);
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
        mergeCriteria(merged, productDoc.criteria);
      }
    }

    // 4. CLIENT_PRODUCT overlay (the most specific)
    if (input.clientId && input.productType) {
      const cpDoc =
        (await this.findActiveByScopeAndPhase(
          input.tenantId,
          {
            kind: 'CLIENT_PRODUCT',
            clientId: input.clientId,
            productType: input.productType,
          },
          phase,
        )) ??
        (await this.findActiveByScopeAndPhase(
          input.tenantId,
          {
            kind: 'CLIENT_PRODUCT',
            clientId: input.clientId,
            productType: input.productType,
          },
          'ANY',
        ));
      if (cpDoc) {
        appliedProfileIds.push(cpDoc.id);
        mergeCriteria(merged, cpDoc.criteria);
      }
    }

    return { criteria: merged, appliedProfileIds };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async findActiveByScopeAndPhase(
    tenantId: string,
    scope: VendorMatchingCriteriaProfile['scope'],
    phase: 'ORIGINAL' | 'REVIEW' | 'ANY',
  ): Promise<VendorMatchingCriteriaProfile | null> {
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
    const result = await this.dbService.queryItems<VendorMatchingCriteriaProfile>(
      CONTAINER,
      query,
      params,
    );
    return result.success && result.data && result.data.length > 0 ? result.data[0] ?? null : null;
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateProfilePayload(
  payload: Omit<
    VendorMatchingCriteriaProfile,
    'id' | 'tenantId' | 'type' | 'version' | 'active' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
  >,
): string[] {
  const errors: string[] = [];
  if (!payload.scope || !payload.scope.kind) {
    errors.push('scope.kind is required');
  } else {
    if (
      (payload.scope.kind === 'CLIENT' || payload.scope.kind === 'CLIENT_PRODUCT') &&
      !payload.scope.clientId
    ) {
      errors.push('scope.clientId is required for CLIENT and CLIENT_PRODUCT scopes');
    }
    if (
      (payload.scope.kind === 'PRODUCT' || payload.scope.kind === 'CLIENT_PRODUCT') &&
      !payload.scope.productType
    ) {
      errors.push('scope.productType is required for PRODUCT and CLIENT_PRODUCT scopes');
    }
  }
  if (!['ORIGINAL', 'REVIEW', 'ANY'].includes(payload.phase)) {
    errors.push(`phase must be ORIGINAL, REVIEW, or ANY (received ${payload.phase})`);
  }
  if (!payload.criteria) {
    errors.push('criteria is required');
    return errors;
  }
  for (const key of ['performance', 'availability', 'proximity', 'experience', 'cost', 'licensure'] as const) {
    const c = payload.criteria[key] as MatchingCriterionConfig | undefined;
    if (!c) {
      errors.push(`criteria.${key} is required`);
      continue;
    }
    if (typeof c.enabled !== 'boolean') errors.push(`criteria.${key}.enabled must be a boolean`);
    if (typeof c.weight !== 'number' || c.weight < 0 || c.weight > 1) {
      errors.push(`criteria.${key}.weight must be 0..1`);
    }
    if (c.mode !== 'SCORED' && c.mode !== 'HARD_GATE') {
      errors.push(`criteria.${key}.mode must be SCORED or HARD_GATE`);
    }
  }
  const prox = payload.criteria.proximity as ProximityCriterionConfig | undefined;
  if (prox && typeof prox.primaryRadiusMiles !== 'number') {
    errors.push('criteria.proximity.primaryRadiusMiles must be a number');
  }
  return errors;
}

// ─── Merge ───────────────────────────────────────────────────────────────────

function mergeCriteria(
  base: VendorMatchingCriteriaProfile['criteria'],
  overlay: VendorMatchingCriteriaProfile['criteria'],
): void {
  for (const key of ['performance', 'availability', 'experience', 'cost', 'licensure'] as const) {
    if (overlay[key]) base[key] = overlay[key];
  }
  if (overlay.proximity) base.proximity = overlay.proximity;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class CriteriaProfileError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'CriteriaProfileError';
  }
}
