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
    tenantId: string;
    azureAdObjectId?: string;
    accessScope?: any;
    isTestUser?: boolean;
    // groups and appRoles for Casbin
    groups?: string[];
    appRoles?: string[];
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

        // Try Azure AD authentication (but don't fail if token is just missing)
        // Still reject malicious tokens
        try {
          return this.azureAuth.authenticate(req as any, res, next);
        } catch (error: any) {
          // Only bypass auth for missing/expired tokens, not malformed ones
          if (error?.code === 'TOKEN_EXPIRED' || error?.code === 'TOKEN_INVALID') {
            this.logger.debug('Optional auth failed with expired/invalid token, continuing without user', { 
              code: error.code 
            });
            return next();
          }
          // Reject malformed/malicious tokens
          this.logger.warn('Malicious token attempt in optional auth', { error: error?.message });
          return res.status(400).json({
            error: 'Malformed authentication token',
            code: 'MALFORMED_TOKEN'
          });
        }

      } catch (error: any) {
        // If any error in outer try, log and continue without authentication
        this.logger.warn('Optional auth outer error', { error: error?.message });
        return next();
      }
    };
  };

  // Authorization methods removed - use Casbin middleware instead:
  // - authzMiddleware.loadUserProfile()  
  // - authzMiddleware.authorize(resourceType, action)
}

/**
 * Factory function to create unified auth middleware
 */
export const createUnifiedAuth = (): UnifiedAuthMiddleware => {
  return new UnifiedAuthMiddleware();
};
