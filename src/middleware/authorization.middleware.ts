/**
 * Authorization Middleware
 * 
 * Express middleware for HTTP authorization
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
import { AuthorizationService } from '../services/authorization.service.js';
import { ResourceType, Action, UserProfile, AccessControl } from '../types/authorization.types.js';

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
  private readonly enforceAuthorization: boolean;

  constructor(authzService?: AuthorizationService) {
    this.logger = new Logger();
    this.authzService = authzService || new AuthorizationService();
    // Default to ENFORCING authorization (can be disabled with ENFORCE_AUTHORIZATION=false)
    this.enforceAuthorization = process.env.ENFORCE_AUTHORIZATION !== 'false';
    
    if (!this.enforceAuthorization) {
      this.logger.warn('⚠️  Authorization in AUDIT MODE - decisions logged but not enforced');
      this.logger.warn('Set ENFORCE_AUTHORIZATION=true (or remove variable) to enable enforcement');
    } else {
      this.logger.info('✅ Authorization ENFORCEMENT ENABLED - Casbin policies will be enforced');
    }
  }

  /**
   * Initialize middleware (initialize authorization service)
   */
  async initialize(): Promise<void> {
    await this.authzService.initialize();
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

        const tenantId = req.tenantId || req.user.id; // Default to user ID if no tenant
        const userProfile = await this.authzService.getUserProfile(req.user.id, tenantId);

        if (!userProfile) {
          this.logger.warn('User profile not found', { userId: req.user.id, tenantId });
          res.status(404).json({
            error: 'User profile not found',
            code: 'USER_PROFILE_NOT_FOUND'
          });
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
            mode: this.enforceAuthorization ? 'ENFORCED' : 'AUDIT_ONLY'
          });

          // Audit mode: log but don't block
          if (!this.enforceAuthorization) {
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
          mode: this.enforceAuthorization ? 'ENFORCED' : 'AUDIT_ONLY'
        });

        // In audit mode, log but don't apply filter
        if (!this.enforceAuthorization) {
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

      if (!resource || !resource.accessControl) {
        return null;
      }

      return resource.accessControl as Partial<AccessControl>;
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
  authzService?: AuthorizationService
): Promise<AuthorizationMiddleware> => {
  const middleware = new AuthorizationMiddleware(authzService);
  await middleware.initialize();
  return middleware;
};
