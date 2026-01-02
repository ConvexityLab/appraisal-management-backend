/**
 * Casbin Authorization Engine
 * 
 * Implementation of IAuthorizationEngine using Casbin
 */

import { newEnforcer, Enforcer } from 'casbin';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { IAuthorizationEngine } from '../interfaces/authorization-engine.interface';
import { AuthorizationContext, PolicyDecision, QueryFilter } from '../types/authorization.types';

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
      const policyPath = path.join(process.cwd(), 'config', 'casbin', 'policy.csv');

      this.logger.info('Initializing Casbin enforcer', { modelPath, policyPath });

      this.enforcer = await newEnforcer(modelPath, policyPath);
      this.initialized = true;

      const policyCount = (await this.enforcer.getPolicy()).length;
      this.logger.info('Casbin enforcer initialized', { policyCount });
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

  async buildQueryFilter(
    userId: string,
    role: string,
    accessScope: any,
    resourceType: string,
    action: string
  ): Promise<QueryFilter> {
    // Admin sees everything
    if (role === 'admin') {
      return {
        sql: '1=1',
        parameters: []
      };
    }

    // Special permission: canViewAllOrders
    if (resourceType === 'order' && accessScope.canViewAllOrders) {
      return {
        sql: '1=1',
        parameters: []
      };
    }

    // Special permission: canViewAllVendors
    if (resourceType === 'vendor' && accessScope.canViewAllVendors) {
      return {
        sql: '1=1',
        parameters: []
      };
    }

    // Manager: team and client-based access
    if (role === 'manager') {
      const conditions: string[] = [];
      const parameters: Array<{ name: string; value: any }> = [];

      if (resourceType === 'order') {
        // Team-based access
        if (accessScope.teamIds && accessScope.teamIds.length > 0) {
          conditions.push('c.accessControl.teamId IN (@teamIds)');
          parameters.push({ name: '@teamIds', value: accessScope.teamIds });
        }

        // Client-based access
        if (accessScope.managedClientIds && accessScope.managedClientIds.length > 0) {
          conditions.push('c.accessControl.clientId IN (@clientIds)');
          parameters.push({ name: '@clientIds', value: accessScope.managedClientIds });
        }

        // Department-based access
        if (accessScope.departmentIds && accessScope.departmentIds.length > 0) {
          conditions.push('c.accessControl.departmentId IN (@deptIds)');
          parameters.push({ name: '@deptIds', value: accessScope.departmentIds });
        }
      }

      if (resourceType === 'vendor') {
        if (accessScope.managedVendorIds && accessScope.managedVendorIds.length > 0) {
          conditions.push('c.id IN (@vendorIds)');
          parameters.push({ name: '@vendorIds', value: accessScope.managedVendorIds });
        }
      }

      if (resourceType === 'qc_review') {
        if (accessScope.teamIds && accessScope.teamIds.length > 0) {
          conditions.push('c.accessControl.teamId IN (@teamIds)');
          parameters.push({ name: '@teamIds', value: accessScope.teamIds });
        }
      }

      if (conditions.length > 0) {
        return {
          sql: `(${conditions.join(' OR ')})`,
          parameters
        };
      }
    }

    // QC Analyst: assigned items only
    if (role === 'qc_analyst') {
      if (['order', 'qc_review', 'revision', 'escalation'].includes(resourceType)) {
        return {
          sql: 'ARRAY_CONTAINS(c.accessControl.assignedUserIds, @userId)',
          parameters: [{ name: '@userId', value: userId }]
        };
      }

      // Queue is readable by all analysts
      if (resourceType === 'qc_queue') {
        return {
          sql: '1=1',
          parameters: []
        };
      }
    }

    // Appraiser: owned or assigned items
    if (role === 'appraiser') {
      if (['order', 'revision', 'qc_review', 'escalation'].includes(resourceType)) {
        return {
          sql: `(
            c.accessControl.ownerId = @userId OR
            ARRAY_CONTAINS(c.accessControl.assignedUserIds, @userId)
          )`,
          parameters: [{ name: '@userId', value: userId }]
        };
      }
    }

    // Default: deny all (no matches)
    return {
      sql: '1=0',
      parameters: []
    };
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

    await this.enforcer.loadPolicy();
    this.logger.info('Policies reloaded');
  }
}
