/**
 * Unified Authentication Middleware
 * 
 * Supports both Azure AD tokens (production) and test tokens (development)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger.js';
import { createAzureEntraAuth } from './azure-entra-auth.middleware';
import { TestTokenGenerator } from '../utils/test-token-generator.js';
import { UserProfileService } from '../services/user-profile.service.js';

export interface UnifiedAuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions?: string[];
    azureAdObjectId?: string;
    tenantId: string;
    accessScope?: any;
    isTestUser?: boolean;
  };
  userProfile?: any;
  tenantId?: string;
}

export class UnifiedAuthMiddleware {
  private logger: Logger;
  private azureAuth: ReturnType<typeof createAzureEntraAuth>;
  private testTokenGen: TestTokenGenerator;
  private userProfileService: UserProfileService;
  private readonly allowTestTokens: boolean;

  constructor() {
    this.logger = new Logger();
    this.azureAuth = createAzureEntraAuth();
    this.testTokenGen = new TestTokenGenerator();
    this.userProfileService = new UserProfileService();
    
    // Allow test tokens in development/test environments
    this.allowTestTokens = process.env.ALLOW_TEST_TOKENS === 'true' || 
                           process.env.NODE_ENV === 'development' ||
                           process.env.NODE_ENV === 'test';

    if (this.allowTestTokens) {
      this.logger.warn('⚠️  Test tokens are ENABLED - DO NOT USE IN PRODUCTION');
    }
  }

  /**
   * Main authentication middleware
   * Tries Azure AD first, falls back to test tokens if allowed
   */
  authenticate = () => {
    return async (req: UnifiedAuthRequest, res: Response, next: NextFunction): Promise<any> => {
      try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'NO_AUTH_TOKEN'
          });
        }

        const token = authHeader.replace('Bearer ', '');

        // Decode token to check if it's a test token
        const decoded: any = jwt.decode(token);
        
        // Check if it's a test token
        if (decoded?.isTestToken) {
          if (!this.allowTestTokens) {
            return res.status(401).json({
              error: 'Test tokens are not allowed in this environment',
              code: 'TEST_TOKEN_DISABLED'
            });
          }
          
          const validation = this.testTokenGen.verifyToken(token);
          
          if (validation.valid && validation.user) {
            req.user = validation.user;
            req.tenantId = validation.user.tenantId; // Set tenantId for profile loading
            return next();
          } else {
            return res.status(401).json({
              error: validation.error || 'Invalid test token',
              code: 'INVALID_TEST_TOKEN'
            });
          }
        }

        // Not a test token, try Azure AD authentication
        return this.azureAuth.authenticate(req as any, res, next);

      } catch (error: any) {
        this.logger.error('Authentication failed', { 
          errorMessage: error?.message,
          errorName: error?.name,
          errorStack: error?.stack,
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
        return res.status(401).json({
          error: 'Authentication failed',
          code: 'AUTH_FAILED'
        });
      }
    };
  };

  /**
   * Optional authentication middleware
   * Allows requests through with or without authentication
   * Sets req.user if token is valid, but doesn't reject if missing/invalid
   */
  optionalAuth = () => {
    return async (req: UnifiedAuthRequest, res: Response, next: NextFunction): Promise<any> => {
      try {
        const authHeader = req.headers.authorization;

        // If no auth header, just continue without user
        if (!authHeader) {
          return next();
        }

        const token = authHeader.replace('Bearer ', '');

        // Decode token to check if it's a test token
        const decoded: any = jwt.decode(token);
        
        // Check if it's a test token
        if (decoded?.isTestToken && this.allowTestTokens) {
          const validation = this.testTokenGen.verifyToken(token);
          
          if (validation.valid && validation.user) {
            req.user = validation.user;
            req.tenantId = validation.user.tenantId;
          }
          
          return next();
        }

        // Try Azure AD authentication (but don't fail if invalid)
        try {
          return this.azureAuth.authenticate(req as any, res, next);
        } catch {
          // If Azure AD fails, just continue without user
          return next();
        }

      } catch (error) {
        // If any error, just continue without authentication
        this.logger.debug('Optional auth failed, continuing without user', { error });
        return next();
      }
    };
  };

  /**
   * Require specific role
   */
  requireRole = (...roles: string[]) => {
    return (req: UnifiedAuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (req.user.role === 'admin') {
        return next(); // Admin has all roles
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          error: `Access denied. Required roles: ${roles.join(', ')}`,
          code: 'INSUFFICIENT_ROLE'
        });
      }

      next();
    };
  };

  /**
   * Require specific permission
   */
  requirePermission = (...permissions: string[]) => {
    return (req: UnifiedAuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const userPermissions = req.user.permissions || [];

      // Check for wildcard permission (admin)
      if (userPermissions.includes('*')) {
        return next();
      }

      // Check if user has any of the required permissions
      const hasPermission = permissions.some(perm => userPermissions.includes(perm));

      if (!hasPermission) {
        return res.status(403).json({
          error: `Access denied. Required permissions: ${permissions.join(', ')}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    };
  };

  /**
   * Sync test user profile to database
   */
  private async syncTestUserProfile(user: NonNullable<UnifiedAuthRequest['user']>): Promise<any> {
    try {
      await this.userProfileService.syncUserProfile({
        email: user.email,
        name: user.name,
        azureAdObjectId: `test-${user.id}`,
        role: user.role,
        tenantId: user.tenantId,
        accessScope: user.accessScope
      });
    } catch (error) {
      // Don't fail auth if profile sync fails
      this.logger.warn('Failed to sync test user profile', { error, userId: user.id });
    }
  }
}

/**
 * Factory function to create unified auth middleware
 */
export const createUnifiedAuth = (): UnifiedAuthMiddleware => {
  return new UnifiedAuthMiddleware();
};
