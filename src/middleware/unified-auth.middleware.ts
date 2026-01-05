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

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'Authorization header required',
            code: 'NO_AUTH_HEADER'
          });
        }

        const token = authHeader.substring(7);

        // Try to decode to check if it's a test token
        let decoded: any;
        try {
          decoded = jwt.decode(token);
        } catch (error) {
          return res.status(401).json({
            error: 'Invalid token format',
            code: 'INVALID_TOKEN_FORMAT'
          });
        }

        // Check if it's a test token
        if (decoded?.isTestToken === true) {
          if (!this.allowTestTokens) {
            this.logger.error('Test token used in production environment');
            return res.status(401).json({
              error: 'Test tokens not allowed in this environment',
              code: 'TEST_TOKEN_NOT_ALLOWED'
            });
          }

          // Verify and use test token
          try {
            const verified = this.testTokenGen.verifyToken(token);
            
            req.user = {
              id: verified.sub,
              email: verified.email,
              name: verified.name,
              role: verified.role,
              permissions: verified.permissions,
              tenantId: verified.tenantId,
              accessScope: verified.accessScope,
              isTestUser: true
            };

            req.tenantId = verified.tenantId;

            // Sync test user profile to database
            await this.syncTestUserProfile(req.user);

            this.logger.debug('Test token authenticated', {
              userId: req.user.id,
              role: req.user.role
            });

            next();
          } catch (error) {
            this.logger.error('Test token verification failed', { error });
            return res.status(401).json({
              error: 'Invalid test token',
              code: 'INVALID_TEST_TOKEN'
            });
          }
        } else {
          // Use Azure AD authentication
          await this.azureAuth.authenticate(req as any, res, next);
        }
      } catch (error) {
        this.logger.error('Authentication error', { error });
        res.status(500).json({
          error: 'Authentication failed',
          code: 'AUTH_ERROR'
        });
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
