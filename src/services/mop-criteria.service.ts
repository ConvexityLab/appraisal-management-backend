/**
 * MopCriteriaService
 *
 * Owns the compilation of MOP rule sets from the two-tier hierarchy:
 *
 *   canonical (clientId = null)  → platform base rules
 *       ↓  deep-merge
 *   client    (clientId = string) → client-specific overrides
 *
 * Compiled results are cached in-memory (same TTL pattern as
 * AxiomService.compileCache).  Use force=true to bypass the cache.
 *
 * Container: mop-criteria (partition key: /clientId)
 * Query key: (programId + programVersion + tier)
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { MopCriteriaDefinition, MopCriteriaCompileResult } from '../types/mop-criteria.types.js';

const CONTAINER = 'mop-criteria';

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: MopCriteriaCompileResult;
  expiresAt: number;
}

export class MopCriteriaService {
  private readonly logger = new Logger('MopCriteriaService');
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly dbService: CosmosDbService) {}

  // ── Cache helpers ──────────────────────────────────────────────────────────

  private cacheKey(clientId: string, tenantId: string, programId: string, programVersion: string): string {
    return `${clientId}:${tenantId}:${programId}:${programVersion}`;
  }

  private cacheTtlMs(): number {
    const ttl = parseInt(process.env.MOP_CRITERIA_CACHE_TTL_SECONDS ?? '300', 10);
    if (isNaN(ttl) || ttl < 0) {
      throw new Error(
        `MOP_CRITERIA_CACHE_TTL_SECONDS must be a non-negative integer, got: "${process.env.MOP_CRITERIA_CACHE_TTL_SECONDS}"`,
      );
    }
    return ttl * 1000;
  }

  // ── Cosmos fetch helpers ───────────────────────────────────────────────────

  private async fetchTier(
    programId: string,
    programVersion: string,
    tier: 'canonical' | 'client',
    clientId: string | null,
  ): Promise<MopCriteriaDefinition | null> {
    // Canonical: clientId stored as null; client: clientId is a string.
    const query = tier === 'canonical'
      ? `SELECT * FROM c
         WHERE c.programId = @programId
           AND c.programVersion = @programVersion
           AND c.tier = 'canonical'
           AND (c.clientId = null OR NOT IS_DEFINED(c.clientId))
           AND c.status = 'ACTIVE'`
      : `SELECT * FROM c
         WHERE c.programId = @programId
           AND c.programVersion = @programVersion
           AND c.tier = 'client'
           AND c.clientId = @clientId
           AND c.status = 'ACTIVE'`;

    const params: Array<{ name: string; value: unknown }> = [
      { name: '@programId', value: programId },
      { name: '@programVersion', value: programVersion },
    ];
    if (tier === 'client' && clientId !== null) {
      params.push({ name: '@clientId', value: clientId });
    }

    try {
      const queryResult = await this.dbService.queryItems<MopCriteriaDefinition>(
        CONTAINER,
        query,
        params,
      );

      if (!queryResult.success || !queryResult.data?.length) {
        return null;
      }

      return queryResult.data[0] ?? null;
    } catch (err) {
      this.logger.warn('MopCriteriaService: failed to fetch tier', {
        programId, programVersion, tier, clientId, error: (err as Error).message,
      });
      return null;
    }
  }

  // ── Compilation ────────────────────────────────────────────────────────────

  /**
   * Deep-merges client onto canonical.
   *
   * Arrays (autoFlags, manualFlags) are replaced wholesale if the client tier
   * provides them — partial array merging is error-prone with flag DSL objects.
   * Thresholds are merged field-by-field so a client can override just one value.
   */
  private merge(canonical: MopCriteriaDefinition, client: MopCriteriaDefinition): MopCriteriaDefinition {
    return {
      ...canonical,
      thresholds: { ...canonical.thresholds, ...client.thresholds },
      autoFlags:     client.autoFlags.length     > 0 ? client.autoFlags     : canonical.autoFlags,
      manualFlags:   client.manualFlags.length   > 0 ? client.manualFlags   : canonical.manualFlags,
      decisionRules: client.decisionRules        ? client.decisionRules     : canonical.decisionRules,
    };
  }

  /**
   * Cache-first compilation.
   *
   * Loads the canonical tier, then optionally deep-merges the client tier on
   * top.  The merged result is cached for cacheTtlMs() milliseconds.
   *
   * Throws if the canonical tier does not exist for programId + programVersion.
   */
  async getCompiledCriteria(
    clientId: string,
    tenantId: string,
    programId: string,
    programVersion: string,
    force = false,
  ): Promise<MopCriteriaCompileResult> {
    const key = this.cacheKey(clientId, tenantId, programId, programVersion);

    if (!force) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.result, cached: true };
      }
    }

    const result = await this.compile(clientId, tenantId, programId, programVersion);
    this.cache.set(key, { result, expiresAt: Date.now() + this.cacheTtlMs() });
    return result;
  }

  /**
   * Always recompiles from Cosmos — bypasses the cache and updates it afterwards.
   * Use after editing a canonical or client-tier document.
   */
  async compileCriteria(
    clientId: string,
    tenantId: string,
    programId: string,
    programVersion: string,
  ): Promise<MopCriteriaCompileResult> {
    const result = await this.compile(clientId, tenantId, programId, programVersion);
    const key = this.cacheKey(clientId, tenantId, programId, programVersion);
    this.cache.set(key, { result, expiresAt: Date.now() + this.cacheTtlMs() });
    return result;
  }

  private async compile(
    clientId: string,
    tenantId: string,
    programId: string,
    programVersion: string,
  ): Promise<MopCriteriaCompileResult> {
    const canonical = await this.fetchTier(programId, programVersion, 'canonical', null);
    if (!canonical) {
      const err = new Error(
        `MOP canonical criteria not found for programId="${programId}" programVersion="${programVersion}"`,
      );
      (err as any).statusCode = 404;
      throw err;
    }

    const clientTier = await this.fetchTier(programId, programVersion, 'client', clientId);
    const merged = clientTier ? this.merge(canonical, clientTier) : canonical;

    return {
      criteria: merged,
      cached: false,
      metadata: {
        programId,
        programVersion,
        clientId,
        tenantId,
        compiledAt: new Date().toISOString(),
        hasClientOverride: clientTier !== null,
      },
    };
  }

  // ── List ───────────────────────────────────────────────────────────────────

  /**
   * Returns all canonical (platform-wide) rule set definitions, optionally
   * filtered by status.  Intended for building program-picker dropdowns.
   */
  async listCanonical(status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT'): Promise<MopCriteriaDefinition[]> {
    const statusFilter = status ? `AND c.status = @status` : '';
    const query = `
      SELECT * FROM c
      WHERE c.tier = 'canonical'
        AND (c.clientId = null OR NOT IS_DEFINED(c.clientId))
        ${statusFilter}
      ORDER BY c.programId ASC
    `;
    const params = status ? [{ name: '@status', value: status }] : [];
    const result = await this.dbService.queryItems<MopCriteriaDefinition>(
      CONTAINER, query, params,
    );
    return result.success ? (result.data ?? []) : [];
  }
}
