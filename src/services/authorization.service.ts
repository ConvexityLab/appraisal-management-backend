/**
 * Authorization Service
 * 
 * Business logic layer for authorization
 * Combines policy engine, ACL checks, and query filtering
 */

import { Logger } from '../utils/logger.js';
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
} from '../types/authorization.types.js';
import { CosmosDbService } from './cosmos-db.service';
import { PolicyEvaluatorService } from './policy-evaluator.service.js';

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
  private policyEvaluator: PolicyEvaluatorService;

  constructor(engine?: IAuthorizationEngine, dbService?: CosmosDbService) {
    this.logger = new Logger();
    this.dbService = dbService || new CosmosDbService();
    this.engine = engine || new CasbinAuthorizationEngine(this.dbService);
    this.graphService = new AccessGraphService(); // Changed from ACLService
    this.decisionCache = new Map();
    this.policyEvaluator = new PolicyEvaluatorService(this.dbService);
  }

  /**
   * Initialize the authorization service
   */
  async initialize(dbAlreadyInitialized: boolean = false): Promise<void> {
    this.logger.info('Initializing authorization service');
    if (!dbAlreadyInitialized) {
      await this.dbService.initialize();
    }
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
        portalDomain: user.portalDomain,
        boundEntityIds: user.boundEntityIds,
        ...(user.isInternal !== undefined && { isInternal: user.isInternal }),
        email: user.email,
        ...(user.clientId && { clientId: user.clientId }),
        ...(user.subClientId && { subClientId: user.subClientId }),
        teamIds: user.accessScope.teamIds || [],
        departmentIds: user.accessScope.departmentIds || [],
        ...(user.accessScope.managedClientIds && { managedClientIds: user.accessScope.managedClientIds }),
        ...(user.accessScope.statesCovered && { statesCovered: user.accessScope.statesCovered }),
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
    return await this.policyEvaluator.buildQueryFilter(user.id, user, resourceType, action);
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
      this.logger.info('Getting user profile', { userId, tenantId });
      
      // Use query instead of point read (Managed Identity permission issue)
      const users = await this.dbService.queryDocuments<any>(
        'users',
        'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
        [
          { name: '@id', value: userId },
          { name: '@tenantId', value: tenantId }
        ]
      );
      
      const user = users[0];
      
      if (!user) {
        this.logger.warn('User not found in database', { userId, tenantId });
        return null;
      }

      this.logger.info('User profile found', { userId, email: user.email });

      if (!user.portalDomain) {
        throw new Error(
          `User profile ${userId} is missing required field 'portalDomain'. ` +
          `Re-seed the user record with portalDomain and boundEntityIds per AUTH_IDENTITY_MODEL_FINAL.md.`
        );
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        azureAdObjectId: user.azureAdObjectId,
        tenantId: user.tenantId,
        ...(user.clientId && { clientId: user.clientId }),
        ...(user.subClientId && { subClientId: user.subClientId }),
        role: user.role,
        portalDomain: user.portalDomain,
        boundEntityIds: user.boundEntityIds ?? [],
        ...(user.isInternal !== undefined && { isInternal: user.isInternal }),
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
   * Auto-provision a minimal UserProfile for a first-time user.
   * Called by AuthorizationMiddleware when a real (non-test) user authenticates
   * but has no existing record in the `users` container.
   *
   * Assigns role 'user' and portalDomain 'platform' — operators can upgrade
   * the role via PATCH /api/users/:id/role.
   */
  async createUserProfile(
    userId: string,
    tenantId: string,
    email: string,
    name: string,
    azureAdObjectId?: string,
  ): Promise<UserProfile> {
    const now = new Date();
    const profile: UserProfile = {
      id: userId,
      email,
      name,
      azureAdObjectId: azureAdObjectId ?? userId,
      tenantId,
      role: 'analyst',
      portalDomain: 'platform',
      boundEntityIds: [],
      isInternal: false,
      accessScope: { teamIds: [], departmentIds: [] },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const doc = {
      ...profile,
      type: 'user-profile',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await this.dbService.getContainer('users').items.create(doc);

    this.logger.info('Auto-provisioned user profile', { userId, tenantId, email });

    // Write a discoverable audit entry so admins can see auto-provisioning events.
    await this.dbService.upsertDocument('audit-trail', {
      id: this.generateRequestId(),
      orderId: 'system',
      type: 'user-auto-provisioned',
      userId,
      tenantId,
      email,
      timestamp: now,
    });

    return profile;
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
        orderId: context.resource.id ?? 'system',
        tenantId: 'system',
        userId: context.user.id,
        userEmail: context.user.email,
        userRole: context.user.role,
        userPortalDomain: context.user.portalDomain,
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
      await this.dbService.upsertDocument('audit-trail', auditLog);
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
