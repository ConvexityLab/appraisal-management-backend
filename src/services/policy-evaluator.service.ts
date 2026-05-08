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
import type { UserProfile, QueryFilter } from '../types/authorization.types.js';
import type { PolicyRule, PolicyCondition } from '../types/policy.types.js';

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  rules: PolicyRule[];
  expiresAt: number;
}

interface SqlFragment {
  sql: string;
  parameters: Array<{ name: string; value: any }>;
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
    const { tenantId, role } = userProfile;

    const rules = await this.loadRules(userProfile, resourceType);
    const matchingRules = rules.filter(r => r.actions.includes(action as any) || r.actions.includes('*' as any));

    if (matchingRules.length === 0) {
      this.logger.debug('PolicyEvaluatorService: no matching rules — deny-all', { userId, role, resourceType, action });
      return { sql: '1=0', parameters: [] };
    }

    const paramCounter = { n: 0 };

    const evaluableRules = matchingRules
      .map((rule) => ({
        rule,
        fragment: this.buildRuleFragment(rule, userProfile, userId, paramCounter),
      }))
      .filter(
        (
          entry,
        ): entry is {
          rule: PolicyRule;
          fragment: { sql: string; parameters: Array<{ name: string; value: any }> };
        } => entry.fragment !== null,
      );

    if (evaluableRules.length === 0) {
      return { sql: '1=0', parameters: [] };
    }

    const denyRules = evaluableRules.filter((entry) => entry.rule.effect === 'deny');
    const allowRules = evaluableRules.filter((entry) => entry.rule.effect === 'allow');

    const allowFragments: Array<{ sql: string; parameters: Array<{ name: string; value: any }> }> = [];

    for (const allowEntry of allowRules) {
      const blockingDenies = denyRules.filter(({ rule }) => rule.priority >= allowEntry.rule.priority);

      if (blockingDenies.some(({ fragment }) => fragment.sql === '1=1')) {
        continue;
      }

      const blockingSql = blockingDenies
        .map(({ fragment }) => fragment)
        .filter((fragment) => fragment.sql !== '1=1');

      if (allowEntry.fragment.sql === '1=1' && blockingSql.length === 0) {
        return { sql: '1=1', parameters: [] };
      }

      let sql = allowEntry.fragment.sql;
      const parameters = [...allowEntry.fragment.parameters];

      if (blockingSql.length > 0) {
        const denySql = blockingSql.length === 1
          ? blockingSql[0]!.sql
          : `(${blockingSql.map((fragment) => fragment.sql).join(' OR ')})`;
        sql = allowEntry.fragment.sql === '1=1'
          ? `NOT (${denySql})`
          : `(${allowEntry.fragment.sql} AND NOT (${denySql}))`;
        parameters.push(...blockingSql.flatMap((fragment) => fragment.parameters));
      }

      allowFragments.push({ sql, parameters });
    }

    if (allowFragments.length === 0) {
      return { sql: '1=0', parameters: [] };
    }

    const allParams = this.deduplicateParameters(allowFragments.flatMap(f => f.parameters));
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
    const prefix = `${tenantId}:${role}:${resourceType}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
    this.logger.debug('PolicyEvaluatorService: cache invalidated', { tenantId, role, resourceType });
  }

  /**
   * Invalidate all cached rule sets touched by a policy mutation.
   *
   * This must cover both the prior and updated scope triples because a policy
   * update can move a rule from one `(role, resourceType)` bucket to another.
   */
  invalidateCacheForPolicyChange(
    before?: Pick<PolicyRule, 'tenantId' | 'role' | 'resourceType'>,
    after?: Pick<PolicyRule, 'tenantId' | 'role' | 'resourceType'>,
  ): void {
    const keys = new Set<string>();

    for (const rule of [before, after]) {
      if (!rule) {
        continue;
      }
      keys.add(`${rule.tenantId}:${rule.role}:${rule.resourceType}`);
    }

    for (const key of keys) {
      const [tenantId, role, resourceType] = key.split(':');
      if (!tenantId || !role || !resourceType) {
        continue;
      }
      this.invalidateCache(tenantId, role, resourceType);
    }
  }

  // ── Rule loading ───────────────────────────────────────────────────────────

  private async loadRules(userProfile: UserProfile, resourceType: string): Promise<PolicyRule[]> {
    const key = this.cacheKey(userProfile, resourceType);
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.rules;
    }

    const rules = await this.fetchRules(userProfile, resourceType);
    this.cache.set(key, { rules, expiresAt: now + CACHE_TTL_MS });
    return rules;
  }

  private async fetchRules(userProfile: UserProfile, resourceType: string): Promise<PolicyRule[]> {
    const { tenantId, role, portalDomain, clientId, subClientId } = userProfile;
    try {
      const container = this.dbService.getContainer('authorization-policies');
      const clauses = [
        `c.type = 'authorization-policy'`,
        'c.tenantId = @tenantId',
        'c.role = @role',
        'c.resourceType = @resourceType',
        '(NOT IS_DEFINED(c.enabled) OR c.enabled = true)',
      ];
      const parameters: Array<{ name: string; value: any }> = [
        { name: '@tenantId', value: tenantId },
        { name: '@role', value: role },
        { name: '@resourceType', value: resourceType },
      ];

      clauses.push('(NOT IS_DEFINED(c.portalDomain) OR c.portalDomain = @portalDomain)');
      parameters.push({ name: '@portalDomain', value: portalDomain });

      if (clientId) {
        clauses.push('(NOT IS_DEFINED(c.clientId) OR c.clientId = @clientId)');
        parameters.push({ name: '@clientId', value: clientId });
      } else {
        clauses.push('NOT IS_DEFINED(c.clientId)');
      }

      if (subClientId) {
        clauses.push('(NOT IS_DEFINED(c.subClientId) OR c.subClientId = @subClientId)');
        parameters.push({ name: '@subClientId', value: subClientId });
      } else {
        clauses.push('NOT IS_DEFINED(c.subClientId)');
      }

      const query = {
        query: `SELECT * FROM c
                WHERE ${clauses.join('\n                  AND ')}
                ORDER BY c.priority DESC`,
        parameters,
      };
      const { resources } = await container.items.query<PolicyRule>(query).fetchAll();
      return resources.sort((left, right) => {
        const priorityDelta = right.priority - left.priority;
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        const specificityDelta = this.getRuleSpecificity(right) - this.getRuleSpecificity(left);
        if (specificityDelta !== 0) {
          return specificityDelta;
        }

        if (left.effect === right.effect) {
          return 0;
        }

        return left.effect === 'deny' ? -1 : 1;
      });
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
    userProfile: UserProfile,
    userId: string,
    paramCounter: { n: number } = { n: 0 },
  ): { sql: string; parameters: Array<{ name: string; value: any }> } | null {
    if (rule.conditions.length === 0) {
      return { sql: '1=1', parameters: [] };
    }

    const fragments: string[] = [];
    const parameters: Array<{ name: string; value: any }> = [];

    for (const condition of rule.conditions) {
      const result = this.evaluateCondition(condition, userProfile, userId, paramCounter);
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
    userProfile: UserProfile,
    userId: string,
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
        if (userProfile.isInternal !== true) return null;
        return { sql: '1=1', parameters: [] };

      case 'bound_entity_in': {
        const boundEntityIds = userProfile.boundEntityIds;
        if (!boundEntityIds || boundEntityIds.length === 0) return null;
        return this.buildEqualityOrClause(cosmosPath, boundEntityIds, 'boundIds', paramCounter);
      }

      case 'in': {
        // doc field (scalar) must be IN the user's array field
        const userValues = this.resolveUserField(cond.userField, userProfile)
          ?? (Array.isArray(cond.staticValue) ? cond.staticValue : null);
        if (userValues === null || userValues.length === 0) return null;
        return this.buildEqualityOrClause(cosmosPath, userValues, 'inVals', paramCounter);
      }

      case 'contains': {
        // doc field (array) must contain a scalar from the user's field
        const userValues = this.resolveUserField(cond.userField, userProfile)
          ?? (Array.isArray(cond.staticValue) ? cond.staticValue : null);
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
    userProfile: UserProfile,
  ): string[] | null {
    if (!userField) return null;

    if (userField === 'boundEntityIds') {
      return userProfile.boundEntityIds ?? null;
    }

    if (userField.startsWith('accessScope.')) {
      const field = userField.slice('accessScope.'.length) as keyof UserProfile['accessScope'];
      const value = userProfile.accessScope?.[field];
      if (Array.isArray(value)) return value as string[];
      return null;
    }

    if (userField === 'clientId') {
      return userProfile.clientId ? [userProfile.clientId] : null;
    }

    if (userField === 'subClientId') {
      return userProfile.subClientId ? [userProfile.subClientId] : null;
    }

    if (userField === 'tenantId') {
      return userProfile.tenantId ? [userProfile.tenantId] : null;
    }

    this.logger.warn('PolicyEvaluatorService: unresolvable userField', { userField });
    return null;
  }

  private buildEqualityOrClause(
    cosmosPath: string,
    values: string[],
    paramPrefix: string,
    paramCounter: { n: number },
  ): SqlFragment {
    const clauses: string[] = [];
    const parameters: Array<{ name: string; value: any }> = [];

    for (const value of values) {
      const paramName = `@${paramPrefix}_${paramCounter.n++}`;
      clauses.push(`${cosmosPath} = ${paramName}`);
      parameters.push({ name: paramName, value });
    }

    return {
      sql: clauses.length === 1 ? clauses[0]! : `(${clauses.join(' OR ')})`,
      parameters,
    };
  }

  private getRuleSpecificity(rule: PolicyRule): number {
    let specificity = 0;
    if (rule.portalDomain) specificity += 1;
    if (rule.clientId) specificity += 2;
    if (rule.subClientId) specificity += 4;
    return specificity;
  }

  private deduplicateParameters(
    parameters: Array<{ name: string; value: any }>,
  ): Array<{ name: string; value: any }> {
    const seen = new Map<string, { name: string; value: any }>();
    for (const parameter of parameters) {
      if (!seen.has(parameter.name)) {
        seen.set(parameter.name, parameter);
      }
    }
    return [...seen.values()];
  }

  private cacheKey(userProfile: UserProfile, resourceType: string): string {
    return [
      userProfile.tenantId,
      userProfile.role,
      resourceType,
      userProfile.portalDomain,
      userProfile.clientId ?? '*',
      userProfile.subClientId ?? '*',
    ].join(':');
  }
}
