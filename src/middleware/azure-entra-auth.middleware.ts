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
  role: string;
  permissions?: string[];
  groups?: string[];
  appRoles?: string[];
  tenantId?: string;
  oid?: string; // Azure AD Object ID
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export class AzureEntraAuthMiddleware {
  private jwksClient: jwksClient.JwksClient;
  private config: EntraAuthConfig;
  private roleMapping: Map<string, { role: string; permissions: string[] }>;

  constructor(config: EntraAuthConfig) {
    this.config = {
      validateIssuer: true,
      clockTolerance: 5,
      ...config
    };

    // Initialize JWKS client to fetch Microsoft's public keys
    this.jwksClient = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours
      rateLimit: true,
      jwksRequestsPerMinute: 10
    });

    // Role mapping from Azure AD groups/roles to application roles
    this.roleMapping = new Map([
      ['admin-group-id', { role: 'admin', permissions: ['*'] }],
      ['manager-group-id', { role: 'manager', permissions: ['order_manage', 'vendor_manage', 'analytics_view', 'qc_metrics'] }],
      ['qc-analyst-group-id', { role: 'qc_analyst', permissions: ['qc_validate', 'qc_execute', 'qc_metrics'] }],
      ['appraiser-group-id', { role: 'appraiser', permissions: ['order_view', 'order_update'] }]
    ]);

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
      this.jwksClient.getSigningKey(kid, (err, key) => {
        if (err) {
          reject(err);
        } else {
          const signingKey = key?.getPublicKey();
          resolve(signingKey || '');
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
      throw new Error('Invalid token format');
    }

    const { header, payload } = decoded;

    if (!header.kid) {
      throw new Error('Token missing key ID (kid)');
    }

    // Get signing key from Microsoft's JWKS endpoint
    const signingKey = await this.getSigningKey(header.kid);

    // Verify token signature and claims
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['RS256'],
      audience: this.config.audience || this.config.clientId,
      clockTolerance: this.config.clockTolerance
    };

    if (this.config.validateIssuer) {
      verifyOptions.issuer = this.config.issuer || 
        `https://login.microsoftonline.com/${this.config.tenantId}/v2.0`;
    }

    return jwt.verify(token, signingKey, verifyOptions);
  };

  /**
   * Map Azure AD groups/roles to application role
   */
  private mapUserRole(groups: string[] = [], appRoles: string[] = []): { role: string; permissions: string[] } {
    // Check app roles first
    for (const appRole of appRoles) {
      const mapping = this.roleMapping.get(appRole);
      if (mapping) return mapping;
    }

    // Check groups
    for (const group of groups) {
      const mapping = this.roleMapping.get(group);
      if (mapping) return mapping;
    }

    // Default role if no mapping found
    return { role: 'appraiser', permissions: ['order_view'] };
  }

  /**
   * Configure role mappings from Azure AD groups to application roles
   */
  public setRoleMapping(groupId: string, role: string, permissions: string[]): void {
    this.roleMapping.set(groupId, { role, permissions });
    logger.info('Role mapping configured', { groupId, role, permissions });
  }

  /**
   * Main authentication middleware
   */
  public authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // DEV MODE: Bypass authentication in development
      if (process.env.NODE_ENV === 'development' || process.env.BYPASS_AUTH === 'true') {
        req.user = {
          id: 'dev-user-001',
          email: 'dev@example.com',
          name: 'Dev User',
          role: 'admin',
          permissions: ['*'],
          oid: 'dev-oid-001'
        };
        next();
        return;
      }

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

      // Extract user information from token claims
      const groups = payload.groups || [];
      const appRoles = payload.roles || [];
      const { role, permissions } = this.mapUserRole(groups, appRoles);

      req.user = {
        id: payload.sub || payload.oid,
        email: payload.email || payload.preferred_username || payload.upn,
        name: payload.name || payload.given_name + ' ' + payload.family_name,
        role,
        permissions,
        groups,
        appRoles,
        tenantId: payload.tid,
        oid: payload.oid
      };

      logger.info('User authenticated via Azure Entra ID', {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role
      });

      next();

    } catch (error: any) {
      logger.error('Azure Entra ID authentication failed', { error: error.message });

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

  /**
   * Require specific permission middleware
   */
  public requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      // Admin has all permissions
      if (req.user.permissions?.includes('*')) {
        next();
        return;
      }

      if (!req.user.permissions?.includes(permission)) {
        res.status(403).json({
          error: `Permission required: ${permission}`,
          code: 'PERMISSION_DENIED',
          requiredPermission: permission,
          userPermissions: req.user.permissions
        });
        return;
      }

      next();
    };
  };

  /**
   * Require specific role middleware
   */
  public requireRole = (...roles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      if (!roles.includes(req.user.role)) {
        res.status(403).json({
          error: 'Insufficient role',
          code: 'ROLE_DENIED',
          requiredRoles: roles,
          userRole: req.user.role
        });
        return;
      }

      next();
    };
  };
}

/**
 * Factory function to create Azure Entra auth middleware
 */
export function createAzureEntraAuth(): AzureEntraAuthMiddleware {
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

  return new AzureEntraAuthMiddleware(config);
}
