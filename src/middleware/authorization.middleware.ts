/**
 * Authorization Middleware
 * 
 * Express middleware for HTTP authorization
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
import { AuthorizationService } from '../services/authorization.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { EntraGroupSyncService } from '../services/entra-group-sync.service.js';
import { ResourceType, Action, UserProfile, AccessControl, Role, PortalDomain } from '../types/authorization.types.js';

/**
 * Extended Express Request with authorization context
 */
export interface AuthorizedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
    azureAdObjectId?: string;
    tenantId?: string;
  };
  userProfile?: UserProfile;
  tenantId?: string;
}

/**
 * Authorization Middleware Class
 */
export class AuthorizationMiddleware {
  private logger: Logger;
  private authzService: AuthorizationService;
  /**
   * Controls how authorization decisions are applied:
   *   'enforce' — deny requests that fail the policy check (default, required in production)
   *   'audit'   — evaluate policies and log decisions, but never block traffic
   *   'off'     — skip evaluation entirely; forbidden in production (startup throws)
   *
   * Set via ENFORCE_AUTHORIZATION env var:
   *   (unset) or 'enforce' or 'true' → 'enforce'
   *   'audit'                         → 'audit'
   *   'off' or 'false'                → 'off'
   */
  private readonly authorizationMode: 'enforce' | 'audit' | 'off';
  private readonly entraGroupSync: EntraGroupSyncService;
  private readonly dbService: CosmosDbService;
  /**
   * When true (AUTO_PROVISION_USERS=true), a first-time authenticated user with
   * no UserProfile in Cosmos is automatically provisioned with DEFAULT_USER_ROLE.
   * Intended for pre-production environments where real user records don't yet exist.
   * Never set this in production alongside ENFORCE_AUTHORIZATION=enforce.
   */
  private readonly autoProvisionUsers: boolean;
  private readonly defaultUserRole: Role;

  constructor(authzService?: AuthorizationService, dbService?: CosmosDbService) {
    this.logger = new Logger();
    const db = dbService || new CosmosDbService();
    this.dbService = db;
    this.authzService = authzService || new AuthorizationService(undefined, db);
    this.entraGroupSync = new EntraGroupSyncService(db);

    // Parse ENFORCE_AUTHORIZATION into the three-way mode enum.
    const rawMode = process.env.ENFORCE_AUTHORIZATION ?? 'enforce';
    if (rawMode === 'off' || rawMode === 'false') {
      this.authorizationMode = 'off';
    } else if (rawMode === 'audit') {
      this.authorizationMode = 'audit';
    } else {
      this.authorizationMode = 'enforce';
    }

    // FATAL: 'off' mode must never reach production.
    // A misconfigured deployment would expose all protected resources.
    // Throw at startup so the process fails before accepting any traffic.
    if (process.env.NODE_ENV === 'production' && this.authorizationMode === 'off') {
      throw new Error(
        'FATAL: ENFORCE_AUTHORIZATION=off (or false) is not permitted in production. ' +
        'Remove the variable or set it to "enforce" before deploying.',
      );
    }

    if (this.authorizationMode === 'off') {
      this.logger.warn('⚠️  Authorization DISABLED (ENFORCE_AUTHORIZATION=off) — all requests pass through');
      this.logger.warn('Set ENFORCE_AUTHORIZATION=enforce (or remove variable) to enable enforcement');
    } else if (this.authorizationMode === 'audit') {
      this.logger.warn('⚠️  Authorization in AUDIT MODE — decisions logged but requests not blocked');
      this.logger.warn('Set ENFORCE_AUTHORIZATION=enforce (or remove variable) to enable enforcement');
    } else {
      this.logger.info('✅ Authorization ENFORCEMENT ENABLED — Casbin policies will be enforced');
    }

    // ── Auto-provision config ────────────────────────────────────────────
    this.autoProvisionUsers = process.env.AUTO_PROVISION_USERS === 'true';
    if (this.autoProvisionUsers) {
      const rawRole = process.env.DEFAULT_USER_ROLE;
      const validRoles: Role[] = ['admin', 'manager', 'supervisor', 'analyst', 'appraiser', 'reviewer'];
      if (!rawRole || !validRoles.includes(rawRole as Role)) {
        throw new Error(
          `AUTO_PROVISION_USERS=true requires DEFAULT_USER_ROLE to be set to one of: ${validRoles.join(', ')}. ` +
          `Got: "${rawRole ?? '(unset)'}"`,
        );
      }
      this.defaultUserRole = rawRole as Role;
      this.logger.warn(
        `⚠️  AUTO_PROVISION_USERS=true — first-time users will be auto-provisioned with role="${this.defaultUserRole}"`,
      );
    } else {
      // Satisfies TS definite-assignment; value never used when autoProvisionUsers is false.
      this.defaultUserRole = 'appraiser';
    }
  }

  /**
   * Initialize middleware (initialize authorization service)
   */
  async initialize(dbAlreadyInitialized: boolean = false): Promise<void> {
    await this.authzService.initialize(dbAlreadyInitialized);
    this.logger.info('Authorization middleware initialized');
  }

  /**
   * Load user profile into request
   * Should be called after authentication middleware
   */
  loadUserProfile = () => {
    return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          res.status(401).json({
            error: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          });
          return;
        }

        const tenantId = req.tenantId ?? req.user.tenantId;
        if (!tenantId) {
          // Both req.tenantId and req.user.tenantId are absent — the authentication
          // chain didn't populate tenant context, which should not happen.
          this.logger.error('Cannot resolve tenantId for user profile lookup', { userId: req.user.id });
          res.status(500).json({
            error: 'Tenant context missing — authentication chain error',
            code: 'TENANT_RESOLUTION_FAILED'
          });
          return;
        }

        // ── E2E test-token bypass (dev/test environments only) ───────────
        // Synthesize a fully-authorized admin profile when the request was
        // authenticated via a test JWT (req.user.isTestToken). This unblocks
        // Playwright / live-fire scripts without requiring a Cosmos `users`
        // record for the synthetic subject. Gated to NODE_ENV !== 'production'
        // so a stolen test JWT can never escalate against a prod deployment.
        if (process.env.NODE_ENV !== 'production' && (req.user as any).isTestToken) {
          this.logger.info('Authorization: synthesizing profile for test-token request', {
            userId: req.user.id,
            tenantId,
          });
          req.userProfile = {
            id: req.user.id,
            email: (req.user as any).email ?? `${req.user.id}@test.local`,
            name: (req.user as any).name ?? 'E2E Test User',
            azureAdObjectId: req.user.id,
            tenantId,
            role: (req.user as any).role ?? 'admin',
            accessScope: {
              teamIds: [],
              departmentIds: [],
              managedClientIds: [],
              managedVendorIds: [],
              managedUserIds: [],
              regionIds: [],
              statesCovered: [],
              canViewAllOrders: true,
              canViewAllVendors: true,
              canOverrideQC: true,
            },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any;
          return next();
        }

        const userProfile = await this.authzService.getUserProfile(req.user.id, tenantId);

        if (!userProfile) {
          if (!this.autoProvisionUsers) {
            // No silent auto-provisioning. A valid JWT for a subject with no
            // user-profile document is a 403 — onboarding must happen via an
            // explicit admin/sync flow (Entra group sync, manual provisioning,
            // or POST /api/users) so we never grant access to a caller we
            // haven't seen before. Per CLAUDE.md: silent fallbacks are a
            // major source of bugs.
            this.logger.warn('User profile not found', { userId: req.user.id, tenantId });
            res.status(403).json({
              error: 'User profile not found',
              code: 'USER_PROFILE_NOT_FOUND',
            });
            return;
          }

          // AUTO_PROVISION_USERS=true: synthesize and persist a minimal profile so the
          // platform can operate before real Entra user records are onboarded.
          const autoProfile: UserProfile = {
            id: req.user.id,
            email: req.user.email ?? `${req.user.id}@auto-provisioned.local`,
            name: (req.user as any).name ?? req.user.email ?? req.user.id,
            azureAdObjectId: req.user.id,
            tenantId,
            role: this.defaultUserRole,
            portalDomain: 'platform',
            boundEntityIds: [],
            accessScope: { teamIds: [], departmentIds: [] },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.logger.warn('AUTO-PROVISIONING user profile (AUTO_PROVISION_USERS=true)', {
            userId: req.user.id,
            email: req.user.email,
            tenantId,
            role: this.defaultUserRole,
          });
          // Persist synchronously so subsequent requests find the profile.
          // Error propagates to the outer catch → 500 (not silently swallowed).
          const usersContainer = this.dbService.getContainer('users');
          await usersContainer.items.upsert(autoProfile);
          req.userProfile = autoProfile;
          next();
          return;
        }

        if (!userProfile.isActive) {
          res.status(403).json({
            error: 'User account is inactive',
            code: 'USER_INACTIVE'
          });
          return;
        }

        req.userProfile = userProfile;

        // ── Entra group → role sync ─────────────────────────────────────────
        // If the JWT carries group OIDs, derive the authoritative role from
        // the Entra group→role mapping table and hot-patch the profile for
        // this request (DB is also updated if the role actually changed).
        const jwtGroups: string[] | undefined = (req.user as any).groups;
        if (Array.isArray(jwtGroups) && jwtGroups.length > 0) {
          const newRole = await this.entraGroupSync.syncGroupsToRole(
            req.user.id,
            tenantId,
            userProfile.role,
            jwtGroups,
          );
          if (newRole !== null) {
            req.userProfile = { ...req.userProfile, role: newRole };
          }
        }

        next();
      } catch (error) {
        this.logger.error('Failed to load user profile', { error, userId: req.user?.id });
        res.status(500).json({
          error: 'Failed to load user profile',
          code: 'USER_PROFILE_LOAD_ERROR'
        });
      }
    };
  };

  /**
   * Authorize a specific action on a resource type
   * Used for creating new resources or accessing endpoints
   */
  authorize = (resourceType: ResourceType, action: Action) => {
    return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.userProfile) {
          res.status(401).json({
            error: 'User profile not loaded',
            code: 'USER_PROFILE_REQUIRED'
          });
          return;
        }

        const decision = await this.authzService.canAccess(
          req.userProfile,
          resourceType,
          'new', // Special ID for new resources
          action,
          undefined,
          { auditLog: true }
        );

        if (!decision.allowed) {
          this.logger.warn('Authorization denied', {
            userId: req.userProfile.id,
            resourceType,
            action,
            reason: decision.reason,
            mode: this.authorizationMode
          });

          // Audit/off mode: log but don't block
          if (this.authorizationMode !== 'enforce') {
            this.logger.info('🔍 AUDIT MODE: Would have blocked this request', {
              userId: req.userProfile.id,
              email: req.userProfile.email,
              role: req.userProfile.role,
              resourceType,
              action,
              reason: decision.reason
            });
            next(); // Allow through in audit mode
            return;
          }

          // Enforcement mode: block
          res.status(403).json({
            error: 'Access denied',
            code: 'AUTHORIZATION_DENIED',
            reason: decision.reason
          });
          return;
        }

        this.logger.debug('Authorization granted', {
          userId: req.userProfile.id,
          resourceType,
          action
        });

        next();
      } catch (error) {
        this.logger.error('Authorization error', { error, resourceType, action });
        res.status(500).json({
          error: 'Authorization check failed',
          code: 'AUTHORIZATION_ERROR'
        });
      }
    };
  };

  /**
   * Authorize access to a specific resource
   * Extracts resource ID from request params
   */
  authorizeResource = (
    resourceType: ResourceType,
    action: Action,
    options?: {
      resourceIdParam?: string;
      loadResource?: boolean;
    }
  ) => {
    const resourceIdParam = options?.resourceIdParam || 'id';
    const loadResource = options?.loadResource !== false;

    return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.userProfile) {
          res.status(401).json({
            error: 'User profile not loaded',
            code: 'USER_PROFILE_REQUIRED'
          });
          return;
        }

        const resourceId = req.params[resourceIdParam];
        
        if (!resourceId) {
          res.status(400).json({
            error: `Resource ID parameter '${resourceIdParam}' is required`,
            code: 'RESOURCE_ID_REQUIRED'
          });
          return;
        }

        // Optionally load resource to get access control metadata
        let accessControl: Partial<AccessControl> | undefined;

        if (loadResource) {
          const loadedAccess = await this.loadResourceAccessControl(resourceType, resourceId, req.userProfile.tenantId);
          accessControl = loadedAccess === null ? undefined : loadedAccess;
          
          if (accessControl === undefined) {
            res.status(404).json({
              error: 'Resource not found',
              code: 'RESOURCE_NOT_FOUND'
            });
            return;
          }
        }

        // Authorize access
        try {
          await this.authzService.authorizeResource(
            req.userProfile,
            resourceType,
            resourceId,
            action,
            accessControl,
            { checkGraph: true, auditLog: true }
          );
        } catch (authError: any) {
          if (authError.code === 'AUTHORIZATION_DENIED') {
            res.status(403).json({
              error: authError.message,
              code: authError.code,
              details: authError.details
            });
            return;
          }
          throw authError;
        }

        next();
      } catch (error) {
        this.logger.error('Resource authorization error', { error, resourceType, action });
        res.status(500).json({
          error: 'Resource authorization check failed',
          code: 'AUTHORIZATION_ERROR'
        });
      }
    };
  };

  /**
   * Authorize list/query operations
   * Builds a query filter based on user's access scope
   */
  authorizeQuery = (resourceType: ResourceType, action: Action = 'read') => {
    return async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.userProfile) {
          res.status(401).json({
            error: 'User profile not loaded',
            code: 'USER_PROFILE_REQUIRED'
          });
          return;
        }

        const queryFilter = await this.authzService.buildQueryFilter(
          req.userProfile,
          resourceType,
          action
        );

        // Log filter that would be applied
        this.logger.debug('Query authorization filter', {
          userId: req.userProfile.id,
          resourceType,
          action,
          filter: queryFilter,
          mode: this.authorizationMode
        });

        // In audit/off mode, log but don't apply filter
        if (this.authorizationMode !== 'enforce') {
          this.logger.info('🔍 AUDIT MODE: Would apply query filter', {
            userId: req.userProfile.id,
            email: req.userProfile.email,
            role: req.userProfile.role,
            resourceType,
            filter: queryFilter
          });
          // Don't attach filter in audit mode - let all queries through
          next();
          return;
        }

        // Attach filter to request for controller to use
        (req as any).authorizationFilter = queryFilter;

        next();
      } catch (error) {
        this.logger.error('Query authorization error', { error, resourceType, action });
        res.status(500).json({
          error: 'Query authorization failed',
          code: 'AUTHORIZATION_ERROR'
        });
      }
    };
  };

  /**
   * Load resource access control metadata from database
   */
  private async loadResourceAccessControl(
    resourceType: string,
    resourceId: string,
    tenantId: string
  ): Promise<Partial<AccessControl> | null> {
    try {
      // Map resource types to container names
      const containerMap: Record<string, string> = {
        order: 'orders',
        client_order: 'client-orders',
        vendor_order: 'orders',
        vendor: 'vendors',
        qc_review: 'qc_reviews',
        qc_queue: 'qc_queues',
        revision: 'revisions',
        escalation: 'escalations',
        user: 'users'
      };

      const containerName = containerMap[resourceType];
      
      if (!containerName) {
        this.logger.warn('Unknown resource type', { resourceType });
        return null;
      }

      const dbService = this.authzService['dbService']; // Access private property
      const resource = await dbService.getDocument<any>(containerName, resourceId, tenantId);

      if (!resource) {
        return null;
      }

      return (resource.accessControl ?? {}) as Partial<AccessControl>;
    } catch (error) {
      this.logger.error('Failed to load resource access control', {
        resourceType,
        resourceId,
        tenantId,
        error
      });
      return null;
    }
  }
}

/**
 * Factory function to create middleware instance
 */
export const createAuthorizationMiddleware = async (
  authzService?: AuthorizationService,
  dbService?: CosmosDbService
): Promise<AuthorizationMiddleware> => {
  const middleware = new AuthorizationMiddleware(authzService, dbService);
  await middleware.initialize(!!dbService); // Skip db init if dbService was passed
  return middleware;
};
