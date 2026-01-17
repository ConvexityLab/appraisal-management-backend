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

    // Role mapping from Azure AD groups/roles to application roles
    // Load from environment variables (actual Azure AD group/role IDs)
    this.roleMapping = new Map();
    
    // Configure role mappings from environment variables
    if (process.env.AZURE_ADMIN_GROUP_ID) {
      this.roleMapping.set(process.env.AZURE_ADMIN_GROUP_ID, { role: 'admin', permissions: ['*'] });
      logger.info('Configured admin group mapping', { groupId: process.env.AZURE_ADMIN_GROUP_ID });
    }
    if (process.env.AZURE_MANAGER_GROUP_ID) {
      this.roleMapping.set(process.env.AZURE_MANAGER_GROUP_ID, { 
        role: 'manager', 
        permissions: ['order_manage', 'vendor_manage', 'analytics_view', 'qc_metrics', 'qc_validate'] 
      });
      logger.info('Configured manager group mapping', { groupId: process.env.AZURE_MANAGER_GROUP_ID });
    }
    if (process.env.AZURE_QC_ANALYST_GROUP_ID) {
      this.roleMapping.set(process.env.AZURE_QC_ANALYST_GROUP_ID, { 
        role: 'qc_analyst', 
        permissions: ['qc_validate', 'qc_execute', 'qc_metrics', 'order_view', 'revision_create', 'escalation_create'] 
      });
      logger.info('Configured QC analyst group mapping', { groupId: process.env.AZURE_QC_ANALYST_GROUP_ID });
    }
    if (process.env.AZURE_APPRAISER_GROUP_ID) {
      this.roleMapping.set(process.env.AZURE_APPRAISER_GROUP_ID, { 
        role: 'appraiser', 
        permissions: ['order_view', 'order_update', 'revision_create'] 
      });
      logger.info('Configured appraiser group mapping', { groupId: process.env.AZURE_APPRAISER_GROUP_ID });
    }
    
    // Check for App Roles (recommended Azure AD approach)
    if (process.env.AZURE_APP_ROLE_ADMIN) {
      this.roleMapping.set(process.env.AZURE_APP_ROLE_ADMIN, { role: 'admin', permissions: ['*'] });
      logger.info('Configured admin app role', { roleId: process.env.AZURE_APP_ROLE_ADMIN });
    }
    if (process.env.AZURE_APP_ROLE_MANAGER) {
      this.roleMapping.set(process.env.AZURE_APP_ROLE_MANAGER, { 
        role: 'manager', 
        permissions: ['order_manage', 'vendor_manage', 'analytics_view', 'qc_metrics', 'qc_validate'] 
      });
      logger.info('Configured manager app role', { roleId: process.env.AZURE_APP_ROLE_MANAGER });
    }
    if (process.env.AZURE_APP_ROLE_QC_ANALYST) {
      this.roleMapping.set(process.env.AZURE_APP_ROLE_QC_ANALYST, { 
        role: 'qc_analyst', 
        permissions: ['qc_validate', 'qc_execute', 'qc_metrics', 'order_view', 'revision_create', 'escalation_create'] 
      });
      logger.info('Configured QC analyst app role', { roleId: process.env.AZURE_APP_ROLE_QC_ANALYST });
    }
    
    // Warning if no mappings configured
    if (this.roleMapping.size === 0) {
      logger.warn('⚠️  No Azure AD group/role mappings configured - all users will get default appraiser role');
      logger.warn('Set environment variables: AZURE_ADMIN_GROUP_ID, AZURE_MANAGER_GROUP_ID, AZURE_QC_ANALYST_GROUP_ID');
      logger.warn('Or use App Roles: AZURE_APP_ROLE_ADMIN, AZURE_APP_ROLE_MANAGER, AZURE_APP_ROLE_QC_ANALYST');
    }

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
    logger.info('Token decod (recommended Azure AD approach)
    for (const appRole of appRoles) {
      const mapping = this.roleMapping.get(appRole);
      if (mapping) {
        logger.info('User role mapped via app role', { appRole, mappedRole: mapping.role });
        return mapping;
      }
    }

    // Check groups
    for (const group of groups) {
      const mapping = this.roleMapping.get(group);
      if (mapping) {
        logger.info('User role mapped via group', { groupId: group, mappedRole: mapping.role });
        return mapping;
      }
    }

    // TEMPORARY: If no mappings configured and user has groups/roles, grant admin for testing
    // This allows development/testing with real tokens before group IDs are configured
    if (this.roleMapping.size === 0 && (groups.length > 0 || appRoles.length > 0)) {
      logger.warn('⚠️  No role mappings configured - granting admin access for testing', {
        userGroups: groups,
        userAppRoles: appRoles,
        message: 'Configure AZURE_*_GROUP_ID or AZURE_APP_ROLE_* environment variables'
      });
      return { role: 'admin', permissions: ['*'] };
    }

    // Default role if no mapping found
    logger.info('No role mapping found - assigning default appraiser role', {
      userGroups: groups,
      userAppRoles: appRoles
    });
    return { role: 'appraiser', permissions: ['order_view', 'order_update
    }

    // Get signing key from Microsoft's JWKS endpoint
    const signingKey = await this.getSigningKey(header.kid);

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

      // Extract user information from token claims
      const groups = payload.groups || [];
      const appRoles = payload.roles || [];
      const { role, permissions } = this.mapUserRole(groups, appRoles);

      req.user = {
        id: payload.sub || payload.oid,
        email: payload.email || payload.preferred_username || payload.upn,
        name: payload.name || (payload.given_name && payload.family_name ? payload.given_name + ' ' + payload.family_name : 'Unknown'),
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
