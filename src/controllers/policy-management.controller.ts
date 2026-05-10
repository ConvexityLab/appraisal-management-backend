/**
 * Policy Management Controller (Sprint 3)
 *
 * CRUD and dry-run evaluate endpoints for DB-backed ABAC policy rules.
 * All mutations write a `PolicyChangeAuditEntry` to the same Cosmos container.
 *
 * Routes (mounted at /api/policies):
 *   GET    /           — list policies for the caller's tenant
 *   POST   /           — create a policy rule
 *   PUT    /:id        — replace a policy rule
 *   DELETE /:id        — delete a policy rule
 *   POST   /evaluate   — dry-run: return the computed QueryFilter for given params
 *
 * Access: all routes require role 'admin' (enforced by the caller in api-server.ts).
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { PolicyEvaluatorService } from '../services/policy-evaluator.service.js';
import { AuthorizationService } from '../services/authorization.service.js';
import { AuthorizedRequest } from '../middleware/authorization.middleware.js';
import type { UserProfile } from '../types/authorization.types.js';
import type { PolicyRule, PolicyChangeAuditEntry } from '../types/policy.types.js';

const CONTAINER = 'authorization-policies';

const comparePolicies = (left: PolicyRule, right: PolicyRule): number => {
  const roleComparison = left.role.localeCompare(right.role);
  if (roleComparison !== 0) {
    return roleComparison;
  }

  const resourceTypeComparison = left.resourceType.localeCompare(right.resourceType);
  if (resourceTypeComparison !== 0) {
    return resourceTypeComparison;
  }

  const priorityComparison = right.priority - left.priority;
  if (priorityComparison !== 0) {
    return priorityComparison;
  }

  return left.id.localeCompare(right.id);
};

type PolicyScope = 'tenant-wide' | 'client-scoped' | 'sub-client-scoped';
type PolicyAccessMode = 'platform-admin' | 'client-admin';

interface PolicyAccessContext {
  tenantId: string;
  actorId?: string;
  mode: PolicyAccessMode;
  allowedClientIds: string[];
  subClientId?: string;
}

interface PolicyListFilters {
  role?: string;
  resourceType?: string;
  effect?: 'allow' | 'deny';
  clientId?: string;
  subClientId?: string;
  scope?: PolicyScope;
  search?: string;
}

interface PolicyScopeValidationResult {
  allowed: boolean;
  code?: string;
  error?: string;
}

const POLICY_SCOPE_VALUES: PolicyScope[] = ['tenant-wide', 'client-scoped', 'sub-client-scoped'];

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const uniqueStrings = (values: Array<string | undefined>): string[] => Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const getPolicyScope = (policy: Pick<PolicyRule, 'clientId' | 'subClientId'>): PolicyScope => {
  if (normalizeOptionalString(policy.subClientId)) {
    return 'sub-client-scoped';
  }

  if (normalizeOptionalString(policy.clientId)) {
    return 'client-scoped';
  }

  return 'tenant-wide';
};

const isPlatformPolicyAdmin = (profile: UserProfile): boolean => profile.role === 'admin' && profile.portalDomain === 'platform';

const isClientPolicyAdmin = (profile: UserProfile): boolean => profile.role === 'manager' && profile.portalDomain === 'client';

const buildPolicyAccessContext = (profile: UserProfile): PolicyAccessContext | null => {
  if (isPlatformPolicyAdmin(profile)) {
    return {
      tenantId: profile.tenantId,
      actorId: profile.id,
      mode: 'platform-admin',
      allowedClientIds: [],
    };
  }

  if (!isClientPolicyAdmin(profile)) {
    return null;
  }

  const allowedClientIds = uniqueStrings([
    normalizeOptionalString(profile.clientId),
    ...(profile.boundEntityIds ?? []).map((value) => normalizeOptionalString(value)),
  ]);

  if (allowedClientIds.length === 0) {
    return null;
  }

  const normalizedSubClientId = normalizeOptionalString(profile.subClientId);

  if (normalizedSubClientId) {
    return {
      tenantId: profile.tenantId,
      actorId: profile.id,
      mode: 'client-admin',
      allowedClientIds,
      subClientId: normalizedSubClientId,
    };
  }

  return {
    tenantId: profile.tenantId,
    actorId: profile.id,
    mode: 'client-admin',
    allowedClientIds,
  };
};

const isPolicyVisibleToCaller = (policy: PolicyRule, accessContext: PolicyAccessContext): boolean => {
  if (policy.tenantId !== accessContext.tenantId) {
    return false;
  }

  if (accessContext.mode === 'platform-admin') {
    return true;
  }

  const clientId = normalizeOptionalString(policy.clientId);
  if (!clientId || !accessContext.allowedClientIds.includes(clientId)) {
    return false;
  }

  const subClientId = normalizeOptionalString(policy.subClientId);
  if (!accessContext.subClientId) {
    return !subClientId;
  }

  return !subClientId || subClientId === accessContext.subClientId;
};

const matchesPolicyListFilters = (policy: PolicyRule, filters: PolicyListFilters): boolean => {
  if (filters.role && policy.role !== filters.role) {
    return false;
  }

  if (filters.resourceType && policy.resourceType !== filters.resourceType) {
    return false;
  }

  if (filters.effect && policy.effect !== filters.effect) {
    return false;
  }

  if (filters.clientId && normalizeOptionalString(policy.clientId) !== filters.clientId) {
    return false;
  }

  if (filters.subClientId && normalizeOptionalString(policy.subClientId) !== filters.subClientId) {
    return false;
  }

  if (filters.scope && getPolicyScope(policy) !== filters.scope) {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const searchTerm = filters.search.toLowerCase();

  return [
    policy.role,
    policy.resourceType,
    policy.effect,
    policy.description,
    policy.actions.join(', '),
    normalizeOptionalString(policy.clientId),
    normalizeOptionalString(policy.subClientId),
    getPolicyScope(policy),
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(searchTerm));
};

const validateRequestedPolicyFilters = (filters: PolicyListFilters, accessContext: PolicyAccessContext): PolicyScopeValidationResult => {
  if (accessContext.mode === 'platform-admin') {
    return { allowed: true };
  }

  if (filters.scope === 'tenant-wide') {
    return {
      allowed: false,
      code: 'POLICY_SCOPE_FORBIDDEN',
      error: 'Client administrators cannot list tenant-wide policies.',
    };
  }

  if (filters.clientId && !accessContext.allowedClientIds.includes(filters.clientId)) {
    return {
      allowed: false,
      code: 'POLICY_SCOPE_FORBIDDEN',
      error: `Client administrator scope does not include clientId '${filters.clientId}'.`,
    };
  }

  if (filters.subClientId) {
    if (!accessContext.subClientId) {
      return {
        allowed: false,
        code: 'POLICY_SCOPE_FORBIDDEN',
        error: `Client administrator scope does not include subClientId '${filters.subClientId}'.`,
      };
    }

    if (filters.subClientId !== accessContext.subClientId) {
      return {
        allowed: false,
        code: 'POLICY_SCOPE_FORBIDDEN',
        error: `Client administrator scope does not include subClientId '${filters.subClientId}'.`,
      };
    }
  }

  return { allowed: true };
};

const validateMutablePolicyScope = (
  policy: Pick<PolicyRule, 'clientId' | 'subClientId'>,
  accessContext: PolicyAccessContext,
): PolicyScopeValidationResult => {
  if (accessContext.mode === 'platform-admin') {
    return { allowed: true };
  }

  const clientId = normalizeOptionalString(policy.clientId);
  if (!clientId) {
    return {
      allowed: false,
      code: 'POLICY_SCOPE_FORBIDDEN',
      error: 'Client administrators may only manage client-scoped or sub-client-scoped policies.',
    };
  }

  if (!accessContext.allowedClientIds.includes(clientId)) {
    return {
      allowed: false,
      code: 'POLICY_SCOPE_FORBIDDEN',
      error: `Client administrator scope does not include clientId '${clientId}'.`,
    };
  }

  const subClientId = normalizeOptionalString(policy.subClientId);
  if (!accessContext.subClientId) {
    if (subClientId) {
      return {
        allowed: false,
        code: 'POLICY_SCOPE_FORBIDDEN',
        error: `Client administrator scope does not include subClientId '${subClientId}'.`,
      };
    }

    return { allowed: true };
  }

  if (subClientId && subClientId !== accessContext.subClientId) {
    return {
      allowed: false,
      code: 'POLICY_SCOPE_FORBIDDEN',
      error: `Client administrator scope does not include subClientId '${subClientId}'.`,
    };
  }

  return { allowed: true };
};

const parsePolicyListFilters = (req: AuthorizedRequest): { filters?: PolicyListFilters; error?: { status: number; code: string; error: string } } => {
  const role = normalizeOptionalString(req.query.role);
  const resourceType = normalizeOptionalString(req.query.resourceType);
  const effectRaw = normalizeOptionalString(req.query.effect);
  const clientId = normalizeOptionalString(req.query.clientId);
  const subClientId = normalizeOptionalString(req.query.subClientId);
  const scopeRaw = normalizeOptionalString(req.query.scope);
  const search = normalizeOptionalString(req.query.search);

  if (effectRaw && effectRaw !== 'allow' && effectRaw !== 'deny') {
    return {
      error: {
        status: 400,
        code: 'INVALID_POLICY_EFFECT_FILTER',
        error: `Invalid effect filter '${effectRaw}'. Expected 'allow' or 'deny'.`,
      },
    };
  }

  if (scopeRaw && !POLICY_SCOPE_VALUES.includes(scopeRaw as PolicyScope)) {
    return {
      error: {
        status: 400,
        code: 'INVALID_POLICY_SCOPE_FILTER',
        error: `Invalid scope filter '${scopeRaw}'. Expected one of: ${POLICY_SCOPE_VALUES.join(', ')}.`,
      },
    };
  }

  return {
    filters: {
      ...(role ? { role } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(effectRaw ? { effect: effectRaw as 'allow' | 'deny' } : {}),
      ...(clientId ? { clientId } : {}),
      ...(subClientId ? { subClientId } : {}),
      ...(scopeRaw ? { scope: scopeRaw as PolicyScope } : {}),
      ...(search ? { search } : {}),
    },
  };
};

export const createPolicyManagementRouter = (dbService: CosmosDbService): Router => {
  const router = Router();
  const logger = new Logger();
  const policyEvaluator = new PolicyEvaluatorService(dbService);
  const authorizationService = new AuthorizationService(undefined, dbService);

  // ── GET / ─────────────────────────────────────────────────────────────────
  router.get('/', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const userProfile = req.userProfile;
      const tenantId = userProfile?.tenantId;
      if (!tenantId || !userProfile) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const accessContext = buildPolicyAccessContext(userProfile);
      if (!accessContext) {
        return res.status(403).json({ error: 'Policy administration access denied', code: 'POLICY_ADMIN_FORBIDDEN' });
      }

      const parsedFilters = parsePolicyListFilters(req);
      if (parsedFilters.error) {
        return res.status(parsedFilters.error.status).json({ error: parsedFilters.error.error, code: parsedFilters.error.code });
      }

      const filters = parsedFilters.filters ?? {};
      const scopeValidation = validateRequestedPolicyFilters(filters, accessContext);
      if (!scopeValidation.allowed) {
        return res.status(403).json({ error: scopeValidation.error, code: scopeValidation.code });
      }

      const container = dbService.getContainer(CONTAINER);
      const { resources } = await container.items.query<PolicyRule>({
        query: `SELECT * FROM c
                WHERE c.type = 'authorization-policy'
                  AND c.tenantId = @tenantId`,
        parameters: [{ name: '@tenantId', value: tenantId }],
      }).fetchAll();

      const visiblePolicies = resources
        .filter((policy) => isPolicyVisibleToCaller(policy, accessContext))
        .filter((policy) => matchesPolicyListFilters(policy, filters))
        .sort(comparePolicies);

      res.json({ success: true, data: visiblePolicies });
    } catch (error) {
      logger.error('Failed to list policies', { error });
      res.status(500).json({ error: 'Failed to list policies', code: 'INTERNAL_ERROR' });
    }
  });

  // ── GET /audit ───────────────────────────────────────────────────────────
  router.get('/audit', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const userProfile = req.userProfile;
      const tenantId = userProfile?.tenantId;
      if (!tenantId || !userProfile) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const accessContext = buildPolicyAccessContext(userProfile);
      if (!accessContext) {
        return res.status(403).json({ error: 'Policy administration access denied', code: 'POLICY_ADMIN_FORBIDDEN' });
      }

      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.trunc(limitRaw), 200) : 100;

      const container = dbService.getContainer(CONTAINER);
      const { resources } = await container.items.query<PolicyChangeAuditEntry>({
        query: `SELECT TOP ${limit} * FROM c
                WHERE c.type = 'authorization-policy-audit'
                  AND c.tenantId = @tenantId
                ORDER BY c.timestamp DESC`,
        parameters: [{ name: '@tenantId', value: tenantId }],
      }).fetchAll();

      const filteredResources = resources.filter((entry) => {
        const scopedPolicy = (entry.after ?? entry.before) as PolicyRule | undefined;
        return scopedPolicy ? isPolicyVisibleToCaller(scopedPolicy, accessContext) : accessContext.mode === 'platform-admin';
      });

      return res.json({ success: true, data: filteredResources, count: filteredResources.length });
    } catch (error) {
      logger.error('Failed to list policy audit entries', { error });
      return res.status(500).json({ error: 'Failed to list policy audit entries', code: 'INTERNAL_ERROR' });
    }
  });

  // ── POST / ────────────────────────────────────────────────────────────────
  router.post('/', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const userProfile = req.userProfile;
      const tenantId = userProfile?.tenantId;
      const actorId = userProfile?.id;
      if (!tenantId || !actorId || !userProfile) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const accessContext = buildPolicyAccessContext(userProfile);
      if (!accessContext) {
        return res.status(403).json({ error: 'Policy administration access denied', code: 'POLICY_ADMIN_FORBIDDEN' });
      }

      const scopeValidation = validateMutablePolicyScope(req.body as Pick<PolicyRule, 'clientId' | 'subClientId'>, accessContext);
      if (!scopeValidation.allowed) {
        return res.status(403).json({ error: scopeValidation.error, code: scopeValidation.code });
      }

      const now = new Date().toISOString();
      const policy: PolicyRule = {
        ...req.body,
        id: uuidv4(),
        type: 'authorization-policy',
        tenantId,
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
      };

      const container = dbService.getContainer(CONTAINER);
      await container.items.create(policy);

      // Audit
      const audit: PolicyChangeAuditEntry = {
        id: uuidv4(),
        type: 'authorization-policy-audit',
        policyId: policy.id,
        tenantId,
        actorUserId: actorId,
        changeType: 'create',
        after: policy,
        timestamp: now,
      };
      await container.items.create(audit);

      policyEvaluator.invalidateCacheForPolicyChange(undefined, policy);

      res.status(201).json({ success: true, data: policy });
    } catch (error) {
      logger.error('Failed to create policy', { error });
      res.status(500).json({ error: 'Failed to create policy', code: 'INTERNAL_ERROR' });
    }
  });

  // ── PUT /:id ──────────────────────────────────────────────────────────────
  router.put('/:id', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const userProfile = req.userProfile;
      const tenantId = userProfile?.tenantId;
      const actorId = userProfile?.id;
      if (!tenantId || !actorId || !userProfile) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const accessContext = buildPolicyAccessContext(userProfile);
      if (!accessContext) {
        return res.status(403).json({ error: 'Policy administration access denied', code: 'POLICY_ADMIN_FORBIDDEN' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Policy id is required', code: 'MISSING_ID' });
      }
      const container = dbService.getContainer(CONTAINER);

      // Read existing for audit
      const { resource: existing } = await container.item(id, tenantId!).read<PolicyRule>();
      if (!existing || existing.type !== 'authorization-policy') {
        return res.status(404).json({ error: 'Policy not found', code: 'POLICY_NOT_FOUND' });
      }
      if (existing.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Cross-tenant access denied', code: 'FORBIDDEN' });
      }
      if (!isPolicyVisibleToCaller(existing, accessContext)) {
        return res.status(403).json({ error: 'Policy scope is outside the caller access scope', code: 'POLICY_SCOPE_FORBIDDEN' });
      }

      const now = new Date().toISOString();
      const updated: PolicyRule = {
        ...existing,
        ...req.body,
        id,
        type: 'authorization-policy',
        tenantId,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
        updatedAt: now,
      };

      const scopeValidation = validateMutablePolicyScope(updated, accessContext);
      if (!scopeValidation.allowed) {
        return res.status(403).json({ error: scopeValidation.error, code: scopeValidation.code });
      }

      await container.items.upsert(updated);

      const audit: PolicyChangeAuditEntry = {
        id: uuidv4(),
        type: 'authorization-policy-audit',
        policyId: id!,
        tenantId: tenantId!,
        actorUserId: actorId!,
        changeType: 'update',
        before: existing,
        after: updated,
        timestamp: now,
      };
      await container.items.create(audit);

      policyEvaluator.invalidateCacheForPolicyChange(existing, updated);

      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update policy', { error });
      res.status(500).json({ error: 'Failed to update policy', code: 'INTERNAL_ERROR' });
    }
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────
  router.delete('/:id', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const userProfile = req.userProfile;
      const tenantId = userProfile?.tenantId;
      const actorId = userProfile?.id;
      if (!tenantId || !actorId || !userProfile) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const accessContext = buildPolicyAccessContext(userProfile);
      if (!accessContext) {
        return res.status(403).json({ error: 'Policy administration access denied', code: 'POLICY_ADMIN_FORBIDDEN' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Policy id is required', code: 'MISSING_ID' });
      }
      const container = dbService.getContainer(CONTAINER);

      const { resource: existing } = await container.item(id, tenantId!).read<PolicyRule>();
      if (!existing || existing.type !== 'authorization-policy') {
        return res.status(404).json({ error: 'Policy not found', code: 'POLICY_NOT_FOUND' });
      }
      if (existing.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Cross-tenant access denied', code: 'FORBIDDEN' });
      }
      if (!isPolicyVisibleToCaller(existing, accessContext)) {
        return res.status(403).json({ error: 'Policy scope is outside the caller access scope', code: 'POLICY_SCOPE_FORBIDDEN' });
      }

      await container.item(id, tenantId!).delete();

      const now = new Date().toISOString();
      const audit: PolicyChangeAuditEntry = {
        id: uuidv4(),
        type: 'authorization-policy-audit',
        policyId: id!,
        tenantId: tenantId!,
        actorUserId: actorId!,
        changeType: 'delete',
        before: existing,
        timestamp: now,
      };
      await container.items.create(audit);

      policyEvaluator.invalidateCacheForPolicyChange(existing, undefined);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete policy', { error });
      res.status(500).json({ error: 'Failed to delete policy', code: 'INTERNAL_ERROR' });
    }
  });

  // ── GET /:id/history ─────────────────────────────────────────────────────
  /**
   * List all audit trail entries for a specific policy rule.
   * Returns entries in reverse-chronological order.
   */
  router.get('/:id/history', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const userProfile = req.userProfile;
      const tenantId = userProfile?.tenantId;
      if (!tenantId || !userProfile) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const accessContext = buildPolicyAccessContext(userProfile);
      if (!accessContext) {
        return res.status(403).json({ error: 'Policy administration access denied', code: 'POLICY_ADMIN_FORBIDDEN' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Policy id is required', code: 'MISSING_ID' });
      }

      const container = dbService.getContainer(CONTAINER);
      const { resource: existing } = await container.item(id, tenantId).read<PolicyRule>();
      if (!existing || existing.type !== 'authorization-policy') {
        return res.status(404).json({ error: 'Policy not found', code: 'POLICY_NOT_FOUND' });
      }
      if (!isPolicyVisibleToCaller(existing, accessContext)) {
        return res.status(403).json({ error: 'Policy scope is outside the caller access scope', code: 'POLICY_SCOPE_FORBIDDEN' });
      }

      const { resources } = await container.items.query<PolicyChangeAuditEntry>({
        query: `SELECT * FROM c
                WHERE c.type = 'authorization-policy-audit'
                  AND c.policyId = @policyId
                  AND c.tenantId = @tenantId
                ORDER BY c.timestamp DESC`,
        parameters: [
          { name: '@policyId', value: id },
          { name: '@tenantId', value: tenantId },
        ],
      }).fetchAll();

      res.json({ success: true, data: resources });
    } catch (error) {
      logger.error('Failed to fetch policy history', { error });
      res.status(500).json({ error: 'Failed to fetch policy history', code: 'INTERNAL_ERROR' });
    }
  });

  // ── POST /evaluate ────────────────────────────────────────────────────────
  /**
   * Dry-run: given a userId, resourceType, and action, return the computed
   * QueryFilter the caller would get.  Requires a full UserProfile to be
   * loaded (guaranteed by loadUserProfile() middleware upstream).
   *
   * Body: { targetUserId?: string, resourceType: string, action?: string }
   * Defaults to the caller's own profile if `targetUserId` is omitted.
   */
  router.post('/evaluate', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      if (!req.userProfile) {
        return res.status(401).json({ error: 'User profile required', code: 'USER_PROFILE_REQUIRED' });
      }

      const accessContext = buildPolicyAccessContext(req.userProfile);
      if (!accessContext) {
        return res.status(403).json({ error: 'Policy administration access denied', code: 'POLICY_ADMIN_FORBIDDEN' });
      }

      const { resourceType, action = 'read', targetUserId } = req.body as {
        resourceType: string;
        action?: string;
        targetUserId?: string;
      };
      if (!resourceType) {
        return res.status(400).json({ error: 'resourceType is required', code: 'MISSING_RESOURCE_TYPE' });
      }

      let effectiveProfile = req.userProfile;
      if (targetUserId && targetUserId !== req.userProfile.id) {
        const targetProfile = await authorizationService.getUserProfile(targetUserId, req.userProfile.tenantId);
        if (!targetProfile) {
          return res.status(404).json({ error: 'Target user not found', code: 'TARGET_USER_NOT_FOUND' });
        }
        if (!isPlatformPolicyAdmin(req.userProfile)) {
          const targetAccessContext = buildPolicyAccessContext(targetProfile);
          if (!targetAccessContext || targetAccessContext.mode !== 'client-admin') {
            return res.status(403).json({ error: 'Target user is outside the caller access scope', code: 'POLICY_SCOPE_FORBIDDEN' });
          }

          const sharesClientScope = targetAccessContext.allowedClientIds.some((clientId) => accessContext.allowedClientIds.includes(clientId));
          const sharesSubClientScope = !accessContext.subClientId || targetAccessContext.subClientId === accessContext.subClientId;
          if (!sharesClientScope || !sharesSubClientScope) {
            return res.status(403).json({ error: 'Target user is outside the caller access scope', code: 'POLICY_SCOPE_FORBIDDEN' });
          }
        }
        effectiveProfile = targetProfile;
      }

      const filter = await policyEvaluator.buildQueryFilter(
        effectiveProfile.id,
        effectiveProfile,
        resourceType,
        action,
      );

      res.json({
        success: true,
        data: filter,
        evaluatedUserId: effectiveProfile.id,
      });
    } catch (error) {
      logger.error('Failed to evaluate policy', { error });
      res.status(500).json({ error: 'Failed to evaluate policy', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
