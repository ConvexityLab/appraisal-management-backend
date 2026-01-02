/**
 * Test JWT Token Generator
 * 
 * Generates JWT tokens for testing and development
 * DO NOT USE IN PRODUCTION
 */

import jwt from 'jsonwebtoken';
import { UserProfile, AccessScope } from '../types/authorization.types';

export interface TestUserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'qc_analyst' | 'appraiser';
  tenantId: string;
  accessScope?: Partial<AccessScope>;
  permissions?: string[];
}

export class TestTokenGenerator {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    // Use a test-specific secret (different from production)
    this.secret = process.env.TEST_JWT_SECRET || 'test-secret-key-DO-NOT-USE-IN-PRODUCTION';
    this.expiresIn = process.env.TEST_JWT_EXPIRES_IN || '24h';
  }

  /**
   * Generate a test JWT token for a user
   */
  generateToken(user: TestUserProfile): string {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      accessScope: user.accessScope || this.getDefaultAccessScope(user.role),
      permissions: user.permissions || this.getDefaultPermissions(user.role),
      iss: 'appraisal-management-test',
      aud: 'appraisal-management-api',
      iat: Math.floor(Date.now() / 1000),
      isTestToken: true // Flag to identify test tokens
    };

    const options: jwt.SignOptions = { expiresIn: this.expiresIn as any };
    return jwt.sign(payload, this.secret, options);
  }

  /**
   * Verify a test token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      throw new Error(`Invalid test token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default access scope for a role
   */
  private getDefaultAccessScope(role: string): AccessScope {
    switch (role) {
      case 'admin':
        return {
          teamIds: ['team-all'],
          departmentIds: ['dept-all'],
          managedClientIds: ['client-all'],
          managedVendorIds: ['vendor-all'],
          managedUserIds: ['user-all'],
          regionIds: ['region-all'],
          statesCovered: ['ALL'],
          canViewAllOrders: true,
          canViewAllVendors: true,
          canOverrideQC: true
        };

      case 'manager':
        return {
          teamIds: ['team-1', 'team-2'],
          departmentIds: ['dept-operations'],
          managedClientIds: ['client-1', 'client-2', 'client-3'],
          managedVendorIds: ['vendor-1', 'vendor-2'],
          managedUserIds: ['user-1', 'user-2', 'user-3'],
          regionIds: ['region-west'],
          statesCovered: ['CA', 'NV', 'AZ'],
          canViewAllOrders: false,
          canViewAllVendors: false,
          canOverrideQC: false
        };

      case 'qc_analyst':
        return {
          teamIds: ['team-qc'],
          departmentIds: ['dept-quality'],
          regionIds: ['region-west'],
          statesCovered: ['CA', 'NV'],
          canViewAllOrders: false,
          canViewAllVendors: false,
          canOverrideQC: false
        };

      case 'appraiser':
        return {
          teamIds: ['team-appraisers'],
          departmentIds: ['dept-field'],
          regionIds: ['region-west'],
          statesCovered: ['CA'],
          canViewAllOrders: false,
          canViewAllVendors: false,
          canOverrideQC: false
        };

      default:
        return {
          teamIds: [],
          departmentIds: [],
          canViewAllOrders: false,
          canViewAllVendors: false,
          canOverrideQC: false
        };
    }
  }

  /**
   * Get default permissions for a role
   */
  private getDefaultPermissions(role: string): string[] {
    switch (role) {
      case 'admin':
        return ['*']; // All permissions

      case 'manager':
        return [
          'order_manage',
          'order_view',
          'order_update',
          'vendor_manage',
          'vendor_assign',
          'analytics_view',
          'qc_metrics',
          'qc_validate',
          'user_view',
          'report_generate'
        ];

      case 'qc_analyst':
        return [
          'qc_validate',
          'qc_execute',
          'qc_metrics',
          'order_view',
          'revision_create',
          'escalation_create'
        ];

      case 'appraiser':
        return [
          'order_view',
          'order_update',
          'revision_create',
          'escalation_create'
        ];

      default:
        return [];
    }
  }

  /**
   * Generate tokens for all test users
   */
  generateAllTestTokens(): Record<string, string> {
    return {
      admin: this.generateToken({
        id: 'test-admin',
        email: 'admin@test.local',
        name: 'Test Admin',
        role: 'admin',
        tenantId: 'test-tenant'
      }),

      manager: this.generateToken({
        id: 'test-manager',
        email: 'manager@test.local',
        name: 'Test Manager',
        role: 'manager',
        tenantId: 'test-tenant'
      }),

      qc_analyst: this.generateToken({
        id: 'test-qc-analyst',
        email: 'qc.analyst@test.local',
        name: 'Test QC Analyst',
        role: 'qc_analyst',
        tenantId: 'test-tenant'
      }),

      appraiser: this.generateToken({
        id: 'test-appraiser',
        email: 'appraiser@test.local',
        name: 'Test Appraiser',
        role: 'appraiser',
        tenantId: 'test-tenant'
      })
    };
  }
}

// CLI helper to generate tokens
if (require.main === module) {
  const generator = new TestTokenGenerator();
  const tokens = generator.generateAllTestTokens();

  console.log('\n=== Test JWT Tokens ===\n');
  console.log('Copy these to your .env file:\n');
  
  Object.entries(tokens).forEach(([role, token]) => {
    console.log(`# ${role.toUpperCase()} Token`);
    console.log(`TEST_JWT_${role.toUpperCase()}=${token}\n`);
  });

  console.log('\n=== Usage ===');
  console.log('Set TEST_JWT_TOKEN environment variable to one of the above tokens');
  console.log('Example: TEST_JWT_TOKEN=$TEST_JWT_ADMIN\n');
  console.log('In API requests, use: Authorization: Bearer <token>\n');
}

export default TestTokenGenerator;
