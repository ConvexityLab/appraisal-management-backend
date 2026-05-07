/**
 * PolicyEvaluatorService (Phase 3 — Sprint 3)
 *
 * Loads ABAC policy rules from Cosmos `authorization-policies` and translates
 * them into Cosmos SQL WHERE-clause fragments used to scope list queries.
 *
 * This replaces the hardcoded `buildQueryFilter()` logic in
 * `casbin-engine.service.ts`.  The Casbin enforcer is RETAINED for allow/deny
 * decisions; this service handles the query‑scoping leg only.
 *
 * Constraints (per AUTH_IDENTITY_MODEL_FINAL.md):
 *  - External entity scoping MUST use `boundEntityIds`, NOT
 *    `accessScope.managedClientIds` / `managedVendorIds`.
 *  - NEVER create containers or infrastructure; the `authorization-policies`
 *    container must already exist (provisioned by Bicep).
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { UserProfile, QueryFilter, AccessScope } from '../types/authorization.types.js';
import type { PolicyRule, PolicyCondition } from '../types/policy.types.js';

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  rules: PolicyRule[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

// ─── Service ─────────────────────────────────────────────────────────────────

export class PolicyEvaluatorService {
  private readonly logger: Logger;
  private readonly dbService: CosmosDbService;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(dbService: CosmosDbService) {
    this.logger = new Logger();
    this.dbService = dbService;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Produce a Cosmos SQL filter clause scoping a list query to the documents
   * the caller is permitted to read.
   *
   * Returns `{ sql: '1=0', parameters: [] }` (deny-all) when no rule matches.
   * Returns `{ sql: '1=1', parameters: [] }` when an unconditional allow rule
   * matches (e.g. admin).
   */
  async buildQueryFilter(
    userId: string,
    userProfile: UserProfile,
    resourceType: string,
    action: string,
  ): Promise<QueryFilter> {
    const { tenantId, role, accessScope, boundEntityIds, isInternal } = userProfile;

    const rules = await this.loadRules(tenantId, role, resourceType);
    const matchingRules = rules.filter(r => r.actions.includes(action as any) || r.actions.includes('*' as any));

    if (matchingRules.length === 0) {
      this.logger.debug('PolicyEvaluatorService: no matching rules — deny-all', { userId, role, resourceType, action });
      return { sql: '1=0', parameters: [] };
    }

    // Separate deny and allow rules; deny rules at equal or higher priority win.
    const sorted = [...matchingRules].sort((a, b) => b.priority - a.priority);

    // Check for an unconditional deny (effect=deny, no conditions or conditions that always hold)
    for (const rule of sorted.filter(r => r.effect === 'deny')) {
      const fragment = this.buildRuleFragment(rule, userId, accessScope, boundEntityIds, isInternal);
      if (fragment === null) continue; // conditions not evaluable (no user data)
      if (fragment.sql === '1=1') {
        // Unconditional deny
        return { sql: '1=0', parameters: [] };
      }
    }

    // Build allow fragments (OR-joined)
    const allowFragments: Array<{ sql: string; parameters: Array<{ name: string; value: any }> }> = [];
    const paramCounter = { n: 0 };

    for (const rule of sorted.filter(r => r.effect === 'allow')) {
      const fragment = this.buildRuleFragment(rule, userId, accessScope, boundEntityIds, isInternal, paramCounter);
      if (fragment === null) continue;
      if (fragment.sql === '1=1') {
        // Unconditional allow — short-circuit
        return { sql: '1=1', parameters: [] };
      }
      allowFragments.push(fragment);
    }

    if (allowFragments.length === 0) {
      return { sql: '1=0', parameters: [] };
    }

    // Merge parameters (already de-duplicated by paramCounter suffix)
    const allParams = allowFragments.flatMap(f => f.parameters);
    const sql = allowFragments.length === 1
      ? allowFragments[0]!.sql
      : `(${allowFragments.map(f => f.sql).join(' OR ')})`;

    return { sql, parameters: allParams };
  }

  /**
   * Invalidate cached rules for a given (tenantId, role, resourceType) triple.
   * Call this from the policy management API on every write.
   */
  invalidateCache(tenantId: string, role: string, resourceType: string): void {
    const key = this.cacheKey(tenantId, role, resourceType);
    this.cache.delete(key);
    this.logger.debug('PolicyEvaluatorService: cache invalidated', { tenantId, role, resourceType });
  }

  // ── Rule loading ───────────────────────────────────────────────────────────

  private async loadRules(tenantId: string, role: string, resourceType: string): Promise<PolicyRule[]> {
    const key = this.cacheKey(tenantId, role, resourceType);
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.rules;
    }

    const rules = await this.fetchRules(tenantId, role, resourceType);
    this.cache.set(key, { rules, expiresAt: now + CACHE_TTL_MS });
    return rules;
  }

  private async fetchRules(tenantId: string, role: string, resourceType: string): Promise<PolicyRule[]> {
    try {
      const container = this.dbService.getContainer('authorization-policies');
      const query = {
        query: `SELECT * FROM c
                WHERE c.type = 'authorization-policy'
                  AND c.tenantId = @tenantId
                  AND c.role = @role
                  AND c.resourceType = @resourceType
                ORDER BY c.priority DESC`,
        parameters: [
          { name: '@tenantId', value: tenantId },
          { name: '@role', value: role },
          { name: '@resourceType', value: resourceType },
        ],
      };
      const { resources } = await container.items.query<PolicyRule>(query).fetchAll();
      return resources;
    } catch (err) {
      // Log and fall back to empty (deny-all) rather than blowing up the request.
      // An operator alert on Cosmos errors is expected at the infra level.
      this.logger.error('PolicyEvaluatorService: failed to load rules from Cosmos', { tenantId, role, resourceType, error: err });
      return [];
    }
  }

  // ── Condition evaluation ───────────────────────────────────────────────────

  /**
   * Translate a single PolicyRule's conditions into a SQL fragment.
   * All conditions within a rule are AND-joined (tighter constraint).
   * Returns null if a condition cannot be evaluated (missing user data).
   * Returns `{ sql: '1=1', parameters: [] }` for an unconditional rule.
   */
  private buildRuleFragment(
    rule: PolicyRule,
    userId: string,
    accessScope: AccessScope,
    boundEntityIds: string[],
    isInternal: boolean | undefined,
    paramCounter: { n: number } = { n: 0 },
  ): { sql: string; parameters: Array<{ name: string; value: any }> } | null {
    if (rule.conditions.length === 0) {
      return { sql: '1=1', parameters: [] };
    }

    const fragments: string[] = [];
    const parameters: Array<{ name: string; value: any }> = [];

    for (const condition of rule.conditions) {
      const result = this.evaluateCondition(condition, userId, accessScope, boundEntityIds, isInternal, paramCounter);
      if (result === null) {
        // Condition unevaluable — skip the whole rule
        return null;
      }
      fragments.push(result.sql);
      parameters.push(...result.parameters);
    }

    if (fragments.length === 0) {
      return { sql: '1=1', parameters: [] };
    }

    const sql = fragments.length === 1 ? fragments[0]! : `(${fragments.join(' AND ')})`;
    return { sql, parameters };
  }

  /**
   * Translate a single `PolicyCondition` into a SQL fragment.
   * Returns null if the user context needed to evaluate the condition is absent.
   */
  private evaluateCondition(
    cond: PolicyCondition,
    userId: string,
    accessScope: AccessScope,
    boundEntityIds: string[],
    isInternal: boolean | undefined,
    paramCounter: { n: number },
  ): { sql: string; parameters: Array<{ name: string; value: any }> } | null {
    const attr = cond.attribute; // e.g. 'accessControl.ownerId'
    const cosmosPath = `c.${attr}`;  // e.g. 'c.accessControl.ownerId'

    switch (cond.operator) {
      case 'any':
        return { sql: '1=1', parameters: [] };

      case 'is_owner':
        return {
          sql: `${cosmosPath} = @userId_${paramCounter.n}`,
          parameters: [{ name: `@userId_${paramCounter.n++}`, value: userId }],
        };

      case 'is_assigned':
        return {
          sql: `ARRAY_CONTAINS(${cosmosPath}, @userId_${paramCounter.n})`,
          parameters: [{ name: `@userId_${paramCounter.n++}`, value: userId }],
        };

      case 'is_internal':
        if (isInternal !== true) return null;
        return { sql: '1=1', parameters: [] };

      case 'bound_entity_in': {
        if (!boundEntityIds || boundEntityIds.length === 0) return null;
        const paramName = `@boundIds_${paramCounter.n++}`;
        return {
          sql: `${cosmosPath} IN (${paramName})`,
          parameters: [{ name: paramName, value: boundEntityIds }],
        };
      }

      case 'in': {
        // doc field (scalar) must be IN the user's array field
        const userValues = this.resolveUserField(cond.userField, accessScope, boundEntityIds);
        if (userValues === null || userValues.length === 0) return null;
        const paramName = `@inVals_${paramCounter.n++}`;
        return {
          sql: `${cosmosPath} IN (${paramName})`,
          parameters: [{ name: paramName, value: userValues }],
        };
      }

      case 'contains': {
        // doc field (array) must contain a scalar from the user's field
        const userValues = this.resolveUserField(cond.userField, accessScope, boundEntityIds);
        if (userValues === null || userValues.length === 0) return null;
        // Cosmos SQL: generate ARRAY_CONTAINS OR chain for each value
        const clauses: string[] = [];
        const params: Array<{ name: string; value: any }> = [];
        for (const v of userValues) {
          const paramName = `@cVal_${paramCounter.n++}`;
          clauses.push(`ARRAY_CONTAINS(${cosmosPath}, ${paramName})`);
          params.push({ name: paramName, value: v });
        }
        return { sql: clauses.length === 1 ? clauses[0]! : `(${clauses.join(' OR ')})`, parameters: params };
      }

      case 'eq': {
        const value = cond.staticValue as string;
        if (value === undefined) return null;
        const paramName = `@eqVal_${paramCounter.n++}`;
        return {
          sql: `${cosmosPath} = ${paramName}`,
          parameters: [{ name: paramName, value: value }],
        };
      }

      default:
        this.logger.warn('PolicyEvaluatorService: unknown operator', { operator: cond.operator });
        return null;
    }
  }

  /**
   * Resolve a dot-notation `userField` path against the caller's AccessScope
   * or `boundEntityIds`.
   *
   * Supported shorthand paths:
   *   'boundEntityIds'           → userProfile.boundEntityIds
   *   'accessScope.<field>'      → userProfile.accessScope[field]
   */
  private resolveUserField(
    userField: string | undefined,
    accessScope: AccessScope,
    boundEntityIds: string[],
  ): string[] | null {
    if (!userField) return null;

    if (userField === 'boundEntityIds') {
      return boundEntityIds ?? null;
    }

    if (userField.startsWith('accessScope.')) {
      const field = userField.slice('accessScope.'.length) as keyof AccessScope;
      const value = accessScope?.[field];
      if (Array.isArray(value)) return value as string[];
      return null;
    }

    this.logger.warn('PolicyEvaluatorService: unresolvable userField', { userField });
    return null;
  }

  private cacheKey(tenantId: string, role: string, resourceType: string): string {
    return `${tenantId}:${role}:${resourceType}`;
  }
}
