/**
 * Azure Entra ID (Azure AD) Authentication Middleware
 * 
 * Direct JWT validation without Passport - validates tokens issued by Microsoft Identity Platform
 * Supports role-based access control via Azure AD groups and app roles
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

export interface EntraAuthConfig {
  tenantId: string;
  clientId: string;
  audience?: string;
  issuer?: string;
  validateIssuer?: boolean;
  clockTolerance?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  oid: string; // Azure AD Object ID
  // groups and appRoles preserved for Casbin to use
  groups?: string[];
  appRoles?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export class AzureEntraAuthMiddleware {
  private jwksClient: jwksClient.JwksClient;
  private config: EntraAuthConfig;

  constructor(config: EntraAuthConfig) {
    this.config = {
      validateIssuer: true,
      clockTolerance: 5,
      ...config
    };

    // Initialize JWKS client to fetch Microsoft's public keys with aggressive caching
    // This prevents rate limiting by caching keys for 24 hours and allowing burst traffic
    this.jwksClient = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours - keys are rotated infrequently
      cacheMaxEntries: 5, // Cache multiple keys
      rateLimit: true,
      jwksRequestsPerMinute: 100, // Increased from 10 to handle high traffic bursts
      timeout: 30000 // 30 second timeout for JWKS requests
    });

    // Authentication middleware only extracts identity - authorization handled by Casbin
    logger.info('Authentication middleware configured - authorization delegated to Casbin');

    logger.info('Azure Entra ID authentication initialized', {
      tenantId: config.tenantId,
      clientId: config.clientId
    });
  }

  /**
   * Get signing key from JWKS endpoint
   */
  private getSigningKey = async (kid: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      logger.info('Fetching signing key from JWKS', { kid });
      this.jwksClient.getSigningKey(kid, (err, key) => {
        if (err) {
          logger.error('Failed to get signing key', { 
            kid, 
            errorMessage: err?.message,
            errorName: err?.name,
            errorStack: err?.stack
          });
          reject(err);
        } else {
          const signingKey = key?.getPublicKey();
          if (!signingKey || signingKey.length === 0) {
            logger.error('Retrieved empty signing key from JWKS', { kid });
            reject(new Error('Empty signing key received from JWKS'));
            return;
          }
          logger.info('Successfully retrieved signing key', { kid, keyLength: signingKey.length });
          resolve(signingKey);
        }
      });
    });
  };

  /**
   * Validate Azure Entra ID JWT token
   */
  private async validateToken(token: string): Promise<any> {
    // Decode token header to get key ID (kid)
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded || typeof decoded === 'string') {
      logger.error('Invalid token format - could not decode');
      throw new Error('Invalid token format');
    }

    const { header, payload } = decoded;
    const payloadData = payload as any;
    
    // Validate tenant ID matches (prevent cross-tenant attacks)
    if (payloadData.tid && payloadData.tid !== this.config.tenantId) {
      logger.error('Token tenant mismatch - possible cross-tenant attack', {
        expectedTenant: this.config.tenantId,
        tokenTenant: payloadData.tid
      });
      throw new Error('Token tenant validation failed');
    }

    // Extract user identity from token claims
    const userId = payloadData.sub || payloadData.oid;
    const email = payloadData.email || payloadData.preferred_username || payloadData.upn;
    const name = payloadData.name || 'Unknown User';
    const tenantId = payloadData.tid;
    const oid = payloadData.oid;
    const groups = payloadData.groups || [];
    const appRoles = payloadData.roles || [];

    if (!userId) {
      throw new Error('Token missing required user identifier (sub/oid)');
    }
    if (!email) {
      throw new Error('Token missing required email claim');
    }
    if (!tenantId) {
      throw new Error('Token missing required tenant ID');
    }

    // Set identity-only user object (no authorization)
    req.user = {
      id: userId,
      email: email,
      name: name,
      tenantId: tenantId,
      oid: oid,
      groups: groups,
      appRoles: appRoles
    };

    logger.info('Azure AD authentication successful (identity extraction)', { 
      userId, 
      email,
      groupCount: groups.length,
      appRoleCount: appRoles.length
    });

    next();
  }

  // Authorization methods removed - use Casbin middleware instead

  private async getSigningKey(kid: string | undefined): Promise<string> {
    if (!kid) {
      throw new Error('Token header missing key ID (kid)');
    }

    // Verify token signature and claims
    const expectedAudience = this.config.audience || this.config.clientId;
    const expectedIssuer = this.config.issuer || 
      `https://login.microsoftonline.com/${this.config.tenantId}/v2.0`;
    
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['RS256'],
      audience: expectedAudience,
      clockTolerance: this.config.clockTolerance,
      // Enforce max age to prevent old token reuse
      maxAge: '24h'
    };

    if (this.config.validateIssuer) {
      verifyOptions.issuer = expectedIssuer;
    }

    logger.info('Verifying token with options', { 
      expectedAudience, 
      expectedIssuer,
      validateIssuer: this.config.validateIssuer,
      algorithms: verifyOptions.algorithms
    });

    return jwt.verify(token, signingKey, verifyOptions);
  };

  /**
   * Main authentication middleware
   */
  public authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers['authorization'];
      if (!authHeader) {
        res.status(401).json({
          error: 'Authorization header required',
          code: 'NO_AUTH_HEADER'
        });
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
          error: 'Invalid authorization header format. Expected: Bearer <token>',
          code: 'INVALID_AUTH_FORMAT'
        });
        return;
      }

      const token = parts[1];
      if (!token) {
        res.status(401).json({
          error: 'Token is missing',
          code: 'TOKEN_MISSING'
        });
        return;
      }

      // Validate token
      const payload = await this.validateToken(token);

      // Validate required claims exist
      if (!payload.sub && !payload.oid) {
        logger.error('Token missing required subject claim (sub or oid)');
        throw new Error('Token missing required subject claim');
      }
      if (!payload.email && !payload.preferred_username && !payload.upn) {
        logger.error('Token missing required email claim');
        throw new Error('Token missing required email claim');
      }

      // Extract IDENTITY ONLY - authorization handled by Casbin
      req.user = {
        id: payload.sub || payload.oid,
        email: payload.email || payload.preferred_username || payload.upn,
        name: payload.name || (payload.given_name && payload.family_name ? payload.given_name + ' ' + payload.family_name : 'Unknown'),
        tenantId: payload.tid,
        oid: payload.oid,
        // Preserve groups/appRoles for Casbin to query if needed
        groups: payload.groups || [],
        appRoles: payload.roles || []
      };

      logger.info('User authenticated via Azure Entra ID', {
        userId: req.user.id,
        email: req.user.email,
        tenantId: req.user.tenantId,
        groupCount: req.user.groups?.length || 0,
        appRoleCount: req.user.appRoles?.length || 0
      });

      next();

    } catch (error: any) {
      logger.error('Azure Entra ID authentication failed', { 
        errorMessage: error?.message,
        errorName: error?.name,
        errorCode: error?.code,
        errorStack: error?.stack,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });

      if (error.name === 'TokenExpiredError') {
        res.status(401).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          message: 'Please obtain a new token'
        });
        return;
      }

      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({
          error: 'Invalid token',
          code: 'TOKEN_INVALID',
          message: error.message
        });
        return;
      }

      res.status(401).json({
        error: 'Authentication failed',
        code: 'AUTH_FAILED',
        message: error.message
      });
    }
  };

  // Authorization methods removed - use Casbin middleware instead:
  // - authzMiddleware.loadUserProfile()
  // - authzMiddleware.authorize(resourceType, action)
}

/**
 * Singleton instance of Azure Entra auth middleware
 * This ensures JWKS cache is shared across all requests
 */
let azureEntraAuthInstance: AzureEntraAuthMiddleware | null = null;

/**
 * Factory function to create Azure Entra auth middleware (singleton)
 */
export function createAzureEntraAuth(): AzureEntraAuthMiddleware {
  // Return existing instance if already created (singleton pattern)
  if (azureEntraAuthInstance) {
    logger.info('Reusing existing Azure Entra auth instance (JWKS cache preserved)');
    return azureEntraAuthInstance;
  }

  const config: EntraAuthConfig = {
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientId: process.env.AZURE_CLIENT_ID || ''
  };

  if (process.env.AZURE_AUDIENCE) {
    config.audience = process.env.AZURE_AUDIENCE;
  }
  if (process.env.AZURE_ISSUER) {
    config.issuer = process.env.AZURE_ISSUER;
  }

  if (!config.tenantId || !config.clientId) {
    logger.warn('Azure Entra ID not configured - authentication will fail in production');
    logger.warn('Required environment variables: AZURE_TENANT_ID, AZURE_CLIENT_ID');
  }

  logger.info('Creating NEW Azure Entra auth instance with JWKS cache');
  azureEntraAuthInstance = new AzureEntraAuthMiddleware(config);
  return azureEntraAuthInstance;
}
