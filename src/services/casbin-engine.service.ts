/**
 * Casbin Authorization Engine
 *
 * Boolean RBAC gate: "can role X perform action Y on resource type Z?"
 * This is a PLATFORM-LEVEL check — the answer is the same for every tenant.
 *
 * Policies are loaded at startup from `PLATFORM_CAPABILITY_MATRIX`, a static
 * in-memory constant defined in `src/data/platform-capability-matrix.ts`.
 * Zero I/O.  No CSV.  No database.
 *
 * Per-tenant / per-client / per-subClient row-level scoping is handled
 * entirely by `PolicyEvaluatorService` (Cosmos `authorization-policies`).
 *
 * To change what a role can do: edit `platform-capability-matrix.ts`.
 * To add per-tenant overrides of WHICH rows a role sees: seed new rules
 *   into `authorization-policies` via `PolicyEvaluatorService`.
 */

import { newEnforcer, Enforcer } from 'casbin';
import * as path from 'path';
import { Logger } from '../utils/logger.js';
import { IAuthorizationEngine } from '../interfaces/authorization-engine.interface';
import { AuthorizationContext, PolicyDecision } from '../types/authorization.types.js';
import { PLATFORM_CAPABILITY_MATRIX } from '../data/platform-capability-matrix.js';

export class CasbinAuthorizationEngine implements IAuthorizationEngine {
  private enforcer?: Enforcer;
  private logger: Logger;
  private initialized: boolean = false;

  constructor() {
    this.logger = new Logger();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const modelPath = path.join(process.cwd(), 'config', 'casbin', 'model.conf');

      // No CSV adapter — policies are loaded programmatically from the
      // in-memory platform capability matrix below.
      this.enforcer = await newEnforcer(modelPath);

      for (const rule of PLATFORM_CAPABILITY_MATRIX) {
        const sub = `${rule.role}:.*`;          // matches any user of that role
        const obj = `${rule.resourceType}:.*`; // matches any instance of that type
        const eft = rule.effect;
        for (const act of rule.actions) {
          await this.enforcer.addPolicy(sub, obj, act, eft);
        }
      }

      this.initialized = true;

      const policyCount = (await this.enforcer.getPolicy()).length;
      this.logger.info('Casbin enforcer initialized from platform capability matrix', {
        rulesLoaded: PLATFORM_CAPABILITY_MATRIX.length,
        policyCount,
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

    // Platform capability matrix is a code constant — "reloading" means
    // re-reading the same values.  Useful in tests or if the process needs
    // to reset to a clean state.
    await this.enforcer.clearPolicy();

    for (const rule of PLATFORM_CAPABILITY_MATRIX) {
      const sub = `${rule.role}:.*`;
      const obj = `${rule.resourceType}:.*`;
      const eft = rule.effect;
      for (const act of rule.actions) {
        await this.enforcer.addPolicy(sub, obj, act, eft);
      }
    }

    const policyCount = (await this.enforcer.getPolicy()).length;
    this.logger.info('Casbin policies reloaded from platform capability matrix', { policyCount });
  }
}
