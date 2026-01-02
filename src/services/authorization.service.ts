/**
 * Authorization Service
 * 
 * Business logic layer for authorization
 * Combines policy engine, ACL checks, and query filtering
 */

import { Logger } from '../utils/logger';
import { IAuthorizationEngine } from '../interfaces/authorization-engine.interface';
import { CasbinAuthorizationEngine } from './casbin-engine.service';
import { AccessGraphService } from './access-graph.service';
import {
  AuthorizationContext,
  PolicyDecision,
  QueryFilter,
  UserProfile,
  AccessControl,
  AuthorizationAuditLog,
  ResourceType,
  Action
} from '../types/authorization.types';
import { CosmosDbService } from './cosmos-db.service';

export interface AuthorizationOptions {
  checkGraph?: boolean; // Changed from checkACL
  auditLog?: boolean;
  cacheDecision?: boolean;
}

export class AuthorizationService {
  private logger: Logger;
  private engine: IAuthorizationEngine;
  private graphService: AccessGraphService; // Changed from aclService
  private dbService: CosmosDbService;
  private decisionCache: Map<string, { decision: PolicyDecision; timestamp: number }>;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(engine?: IAuthorizationEngine) {
    this.logger = new Logger();
    this.engine = engine || new CasbinAuthorizationEngine();
    this.graphService = new AccessGraphService(); // Changed from ACLService
    this.dbService = new CosmosDbService();
    this.decisionCache = new Map();
  }

  /**
   * Initialize the authorization service
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing authorization service');
    await this.engine.initialize();
    this.logger.info('Authorization service initialized');
  }

  /**
   * Check if a user can perform an action on a resource
   */
  async canAccess(
    user: UserProfile,
    resourceType: ResourceType,
    resourceId: string,
    action: Action,
    resource?: Partial<AccessControl>,
    options: AuthorizationOptions = {}
  ): Promise<PolicyDecision> {
    const cacheKey = this.buildCacheKey(user.id, resourceType, resourceId, action);

    // Check cache if enabled
    if (options.cacheDecision && this.decisionCache.has(cacheKey)) {
      const cached = this.decisionCache.get(cacheKey)!;
      const age = Date.now() - cached.timestamp;
      
      if (age < this.CACHE_TTL_MS) {
        this.logger.debug('Cache hit for authorization decision', { cacheKey, age });
        return cached.decision;
      } else {
        this.decisionCache.delete(cacheKey);
      }
    }

    // Build authorization context
    const context: AuthorizationContext = {
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        teamIds: user.accessScope.teamIds || [],
        departmentIds: user.accessScope.departmentIds || [],
        ...(user.accessScope.managedClientIds && { managedClientIds: user.accessScope.managedClientIds }),
        ...(user.accessScope.canViewAllOrders && { canViewAllOrders: user.accessScope.canViewAllOrders })
      },
      resource: {
        type: resourceType,
        id: resourceId,
        ...(resource?.ownerId && { ownerId: resource.ownerId }),
        ...(resource?.teamId && { teamId: resource.teamId }),
        ...(resource?.departmentId && { departmentId: resource.departmentId }),
        ...(resource?.clientId && { clientId: resource.clientId }),
        ...(resource?.assignedUserIds && { assignedUserIds: resource.assignedUserIds })
      },
      action,
      context: {
        timestamp: new Date(),
        requestId: this.generateRequestId()
      }
    };

    // Enforce policy via engine - PRIMARY ATTRIBUTE-BASED
    const decision = await this.engine.enforce(context);

    // Check access graph relationships if requested - SECONDARY EXCEPTION ONLY
    if (options.checkGraph && !decision.allowed) {
      const graphAllowed = await this.checkAccessGraph(
        user.id,
        resourceType,
        resourceId,
        action,
        user.tenantId,
        context.context
      );
      
      if (graphAllowed) {
        decision.allowed = true;
        decision.reason = 'Access graph relationship grant';
      }
    }

    // Cache decision if enabled
    if (options.cacheDecision) {
      this.decisionCache.set(cacheKey, {
        decision,
        timestamp: Date.now()
      });
    }

    // Audit log if enabled
    if (options.auditLog) {
      await this.logAuthorizationDecision(context, decision);
    }

    return decision;
  }

  /**
   * Authorize a resource for a user (throws error if denied)
   */
  async authorizeResource(
    user: UserProfile,
    resourceType: ResourceType,
    resourceId: string,
    action: Action,
    resource?: Partial<AccessControl>,
    options: AuthorizationOptions = {}
  ): Promise<void> {
    const decision = await this.canAccess(user, resourceType, resourceId, action, resource, options);

    if (!decision.allowed) {
      const error: any = new Error(`Access denied: ${decision.reason}`);
      error.code = 'AUTHORIZATION_DENIED';
      error.statusCode = 403;
      error.details = {
        userId: user.id,
        resourceType,
        resourceId,
        action,
        reason: decision.reason
      };
      throw error;
    }
  }

  /**
   * Build a query filter for Cosmos DB based on user permissions
   */
  async buildQueryFilter(
    user: UserProfile,
    resourceType: ResourceType,
    action: Action = 'read'
  ): Promise<QueryFilter> {
    return await this.engine.buildQueryFilter(
      user.id,
      user.role,
      user.accessScope,
      resourceType,
      action
    );
  }

  /**
   * Build a Cosmos DB query with authorization filter
   */
  async buildAuthorizedQuery(
    user: UserProfile,
    resourceType: ResourceType,
    baseQuery: string,
    baseParameters: any[] = [],
    action: Action = 'read'
  ): Promise<{ query: string; parameters: any[] }> {
    const filter = await this.buildQueryFilter(user, resourceType, action);

    // Combine base query with authorization filter
    let query: string;
    
    if (baseQuery.toLowerCase().includes('where')) {
      // Add to existing WHERE clause
      query = `${baseQuery} AND ${filter.sql}`;
    } else if (baseQuery.toLowerCase().includes('from')) {
      // Add WHERE clause
      query = `${baseQuery} WHERE ${filter.sql}`;
    } else {
      // Simple case: just append
      query = `${baseQuery} WHERE ${filter.sql}`;
    }

    // Combine parameters
    const parameters = [...baseParameters, ...filter.parameters];

    this.logger.debug('Built authorized query', {
      userId: user.id,
      resourceType,
      originalQuery: baseQuery,
      authorizedQuery: query,
      parameterCount: parameters.length
    });

    return { query, parameters };
  }

  /**
   * Get user profile with access scope
   */
  async getUserProfile(userId: string, tenantId: string): Promise<UserProfile | null> {
    try {
      const user = await this.dbService.getDocument<any>('users', userId, tenantId);
      
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        azureAdObjectId: user.azureAdObjectId,
        tenantId: user.tenantId,
        role: user.role,
        accessScope: user.accessScope || {
          teamIds: [],
          departmentIds: []
        },
        isActive: user.isActive !== false,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt)
      };
    } catch (error) {
      this.logger.error('Failed to get user profile', { userId, tenantId, error });
      return null;
    }
  }

  /**
   * Check access graph for relationship-based access
   * This checks if there's a direct entity->object relationship granting access
   */
  private async checkAccessGraph(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    tenantId: string,
    contextInfo?: { ipAddress?: string; timestamp: Date }
  ): Promise<boolean> {
    try {
      // Check direct user->object relationship
      const userRelationship = await this.graphService.canAccess(
        'user',
        userId,
        resourceType,
        resourceId,
        action,
        tenantId,
        contextInfo
      );

      if (userRelationship) {
        this.logger.debug('Access granted via user->object relationship', {
          userId,
          resourceType,
          resourceId,
          action,
          relationshipId: userRelationship.id
        });
        return true;
      }

      // TODO: Check transitive relationships (user->team->object, user->role->object)
      // For now, only direct relationships are supported

      return false;
    } catch (error) {
      this.logger.error('Failed to check access graph', { userId, resourceType, resourceId, error });
      return false;
    }
  }

  /**
   * Log authorization decision for audit trail
   */
  private async logAuthorizationDecision(
    context: AuthorizationContext,
    decision: PolicyDecision
  ): Promise<void> {
    try {
      const auditLog: AuthorizationAuditLog = {
        id: this.generateRequestId(),
        tenantId: 'system', // Will be replaced with actual tenant ID from context
        userId: context.user.id,
        userEmail: context.user.email,
        userRole: context.user.role,
        resourceType: context.resource.type,
        resourceId: context.resource.id,
        action: context.action,
        decision: decision.allowed ? 'allow' : 'deny',
        ...(decision.reason && { reason: decision.reason }),
        ...(decision.matchedPolicies && { matchedPolicies: decision.matchedPolicies }),
        ...(context.context?.ipAddress && { ipAddress: context.context.ipAddress }),
        timestamp: new Date()
      };

      // Store audit log in Cosmos DB
      await this.dbService.upsertDocument('audit_logs', auditLog);
    } catch (error) {
      // Don't fail authorization if audit logging fails
      this.logger.error('Failed to log authorization decision', { context, decision, error });
    }
  }

  /**
   * Build cache key for decision caching
   */
  private buildCacheKey(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string
  ): string {
    return `${userId}:${resourceType}:${resourceId}:${action}`;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear decision cache
   */
  clearCache(): void {
    this.decisionCache.clear();
    this.logger.info('Authorization decision cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttlMs: number } {
    return {
      size: this.decisionCache.size,
      ttlMs: this.CACHE_TTL_MS
    };
  }
}
