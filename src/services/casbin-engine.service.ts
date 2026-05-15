/**
 * Casbin Authorization Engine
 *
 * Boolean RBAC gate: "can role X perform action Y on resource type Z?"
 * This is a PLATFORM-LEVEL check — the answer is the same for every tenant.
 *
 * Policies are loaded at startup from Cosmos `authorization-policies`
 * documents of type `authorization-capability`.
 *
 * Per-tenant / per-client / per-subClient row-level scoping is handled
 * entirely by `PolicyEvaluatorService` (Cosmos `authorization-policies`).
 *
 * To change what a role can do: update the materialized capability documents
 * in Cosmos (seed/bootstrap support is currently derived from the matrix file).
 * To add per-tenant overrides of WHICH rows a role sees: seed new rules into
 * `authorization-policies` via `PolicyEvaluatorService`.
 */

import { newEnforcer, Enforcer } from 'casbin';
import * as path from 'path';
import { Logger } from '../utils/logger.js';
import { IAuthorizationEngine } from '../interfaces/authorization-engine.interface';
import { AuthorizationContext, PolicyDecision } from '../types/authorization.types.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID } from '../data/platform-capability-matrix.js';
import type { AuthorizationCapabilityDocument } from '../types/policy.types.js';

const CONTAINER = 'authorization-policies';

export class CasbinAuthorizationEngine implements IAuthorizationEngine {
  private enforcer?: Enforcer;
  private logger: Logger;
  private initialized: boolean = false;
  private readonly dbService: CosmosDbService;

  constructor(dbService?: CosmosDbService) {
    this.logger = new Logger();
    this.dbService = dbService ?? new CosmosDbService();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const modelPath = path.join(process.cwd(), 'config', 'casbin', 'model.conf');

      // No CSV adapter — policies are loaded programmatically from Cosmos.
      this.enforcer = await newEnforcer(modelPath);

      const capabilityRules = await this.loadCapabilityRules();
      await this.applyCapabilityRules(capabilityRules);

      this.initialized = true;

      const policyCount = (await this.enforcer.getPolicy()).length;
      this.logger.info('Casbin enforcer initialized from Cosmos capability materialization', {
        rulesLoaded: capabilityRules.length,
        policyCount,
        tenantId: AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
      });
    } catch (error) {
      this.logger.error('Failed to initialize Casbin enforcer', { error });
      throw error;
    }
  }

  async enforce(context: AuthorizationContext): Promise<PolicyDecision> {
    if (!this.enforcer) {
      throw new Error('Casbin enforcer not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    try {
      // Build Casbin request - convert objects to string keys for matcher
      const sub = `${context.user.role}:${context.user.id}`;
      const obj = `${context.resource.type}:${context.resource.id || '*'}`;
      const act = context.action;

      // Enforce policy
      const allowed = await this.enforcer.enforce(sub, obj, act);

      const evaluationTime = Date.now() - startTime;

      this.logger.debug('Policy enforced', {
        userId: context.user.id,
        role: context.user.role,
        resourceType: context.resource.type,
        resourceId: context.resource.id,
        action: context.action,
        sub,
        obj,
        act,
        allowed,
        evaluationTime
      });

      return {
        allowed,
        reason: allowed ? 'Policy matched' : 'No matching policy found',
        evaluationTime
      };
    } catch (error) {
      this.logger.error('Policy enforcement failed', { error, context });
      
      // Fail-safe: deny access on error
      return {
        allowed: false,
        reason: `Policy evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        evaluationTime: Date.now() - startTime
      };
    }
  }

  async addPolicy(policy: string[]): Promise<boolean> {
    if (!this.enforcer) {
      throw new Error('Casbin enforcer not initialized');
    }

    const added = await this.enforcer.addPolicy(...policy);
    
    if (added) {
      this.logger.info('Policy added', { policy });
    }

    return added;
  }

  async removePolicy(policy: string[]): Promise<boolean> {
    if (!this.enforcer) {
      throw new Error('Casbin enforcer not initialized');
    }

    const removed = await this.enforcer.removePolicy(...policy);
    
    if (removed) {
      this.logger.info('Policy removed', { policy });
    }

    return removed;
  }

  async getAllPolicies(): Promise<string[][]> {
    if (!this.enforcer) {
      throw new Error('Casbin enforcer not initialized');
    }

    return await this.enforcer.getPolicy();
  }

  async reloadPolicies(): Promise<void> {
    if (!this.enforcer) {
      throw new Error('Casbin enforcer not initialized');
    }

    await this.enforcer.clearPolicy();

    const capabilityRules = await this.loadCapabilityRules();
    await this.applyCapabilityRules(capabilityRules);

    const policyCount = (await this.enforcer.getPolicy()).length;
    this.logger.info('Casbin policies reloaded from Cosmos capability materialization', {
      policyCount,
      rulesLoaded: capabilityRules.length,
      tenantId: AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
    });
  }

  private async loadCapabilityRules(): Promise<AuthorizationCapabilityDocument[]> {
    const container = this.dbService.getContainer(CONTAINER);
    const { resources } = await container.items.query<AuthorizationCapabilityDocument>({
      query: `SELECT * FROM c
              WHERE c.type = 'authorization-capability'
                AND c.tenantId = @tenantId
                AND (NOT IS_DEFINED(c.enabled) OR c.enabled = true)`,
      parameters: [
        { name: '@tenantId', value: AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID },
      ],
    }).fetchAll();

    if (resources.length === 0) {
      throw new Error(
        'No Casbin capability materialization documents were found in Cosmos. ' +
        `Seed ${CONTAINER} with type="authorization-capability" for tenantId="${AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID}" ` +
        'before starting the API.',
      );
    }

    return [...resources].sort((left, right) => {
      const roleCompare = left.role.localeCompare(right.role);
      if (roleCompare !== 0) {
        return roleCompare;
      }

      return left.resourceType.localeCompare(right.resourceType);
    });
  }

  private async applyCapabilityRules(rules: AuthorizationCapabilityDocument[]): Promise<void> {
    if (!this.enforcer) {
      throw new Error('Casbin enforcer not initialized');
    }

    for (const rule of rules) {
      const sub = `${rule.role}:.*`;
      const obj = `${rule.resourceType}:.*`;
      for (const act of rule.actions) {
        await this.enforcer.addPolicy(sub, obj, act, rule.effect);
      }
    }
  }
}
