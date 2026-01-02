#!/usr/bin/env ts-node
/**
 * Create Test Orders with Access Control Metadata
 * 
 * This script creates test orders via the API with realistic access control
 * patterns for testing authorization filtering and enforcement.
 * 
 * Usage:
 *   npm run create-test-orders
 *   or
 *   ts-node scripts/create-test-orders.ts
 */

import axios, { AxiosError } from 'axios';
import { config } from 'dotenv';
import { Logger } from '../src/utils/logger';

config();

const logger = new Logger();
const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000'; // Use IPv4 explicitly

interface TestOrderTemplate {
  name: string;
  token: string;
  data: any;
  expectedOwner: string;
  expectedTeam?: string;
  expectedClient?: string;
  expectedAssignedUsers?: string[];
}

/**
 * Test order templates with different access patterns
 */
const testOrders: TestOrderTemplate[] = [
  {
    name: 'Admin-owned order (Team 1, Client 1)',
    token: process.env.TEST_JWT_ADMIN || '',
    expectedOwner: 'test-admin',
    expectedTeam: 'team-1',
    expectedClient: '11111111-1111-1111-1111-111111111111',
    data: {
      orderNumber: 'TEST-ADMIN-001',
      clientId: '11111111-1111-1111-1111-111111111111', // UUID format
      propertyAddress: '123 Admin Plaza, San Francisco, CA 94102', // Simple string format
      orderType: 'purchase',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      accessControl: {
        ownerId: 'test-admin',
        ownerEmail: 'test-admin@example.com',
        teamId: 'team-1',
        clientId: '11111111-1111-1111-1111-111111111111',
        assignedUserIds: [],
        visibilityScope: 'TEAM',
        tenantId: 'test-tenant'
      }
    }
  },
  {
    name: 'Manager-owned order (Team 2, Client 2)',
    token: process.env.TEST_JWT_MANAGER || '',
    expectedOwner: 'test-manager',
    expectedTeam: 'team-2',
    expectedClient: '22222222-2222-2222-2222-222222222222',
    data: {
      orderNumber: 'TEST-MGR-001',
      clientId: '22222222-2222-2222-2222-222222222222',
      propertyAddress: '456 Manager Street, Los Angeles, CA 90001',
      orderType: 'refinance',
      priority: 'standard',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      accessControl: {
        ownerId: 'test-manager',
        ownerEmail: 'test-manager@example.com',
        teamId: 'team-2',
        clientId: '22222222-2222-2222-2222-222222222222',
        assignedUserIds: [],
        visibilityScope: 'TEAM',
        tenantId: 'test-tenant'
      }
    }
  },
  {
    name: 'Manager-owned order (Team 1 - should be visible to admin)',
    token: process.env.TEST_JWT_MANAGER || '',
    expectedOwner: 'test-manager',
    expectedTeam: 'team-1',
    expectedClient: '11111111-1111-1111-1111-111111111111',
    data: {
      orderNumber: 'TEST-MGR-002',
      clientId: '11111111-1111-1111-1111-111111111111',
      propertyAddress: '789 Shared Team Drive, San Diego, CA 92101',
      orderType: 'purchase',
      priority: 'rush',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      accessControl: {
        ownerId: 'test-manager',
        ownerEmail: 'test-manager@example.com',
        teamId: 'team-1',
        clientId: '11111111-1111-1111-1111-111111111111',
        assignedUserIds: [],
        visibilityScope: 'TEAM',
        tenantId: 'test-tenant'
      }
    }
  },
  {
    name: 'QC Analyst-owned order (Team QC, assigned to analyst)',
    token: process.env.TEST_JWT_QC_ANALYST || '',
    expectedOwner: 'test-qc-analyst',
    expectedTeam: 'team-qc',
    expectedAssignedUsers: ['test-qc-analyst'],
    data: {
      orderNumber: 'TEST-QC-001',
      clientId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      propertyAddress: '321 QC Boulevard, Oakland, CA 94601',
      orderType: 'refinance',
      priority: 'standard',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      accessControl: {
        ownerId: 'test-qc-analyst',
        ownerEmail: 'test-qc-analyst@example.com',
        teamId: 'team-qc',
        assignedUserIds: ['test-qc-analyst'],
        visibilityScope: 'ASSIGNED_ONLY',
        tenantId: 'test-tenant'
      }
    }
  },
  {
    name: 'Appraiser-owned order (assigned to appraiser)',
    token: process.env.TEST_JWT_APPRAISER || '',
    expectedOwner: 'test-appraiser',
    expectedAssignedUsers: ['test-appraiser'],
    data: {
      orderNumber: 'TEST-APP-001',
      clientId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      propertyAddress: '654 Appraiser Lane, Sacramento, CA 95814',
      orderType: 'purchase',
      priority: 'standard',
      dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      accessControl: {
        ownerId: 'test-appraiser',
        ownerEmail: 'test-appraiser@example.com',
        assignedUserIds: ['test-appraiser'],
        visibilityScope: 'ASSIGNED_ONLY',
        tenantId: 'test-tenant'
      }
    }
  },
  {
    name: 'Admin-created order assigned to appraiser',
    token: process.env.TEST_JWT_ADMIN || '',
    expectedOwner: 'test-admin',
    expectedTeam: 'team-1',
    expectedClient: '11111111-1111-1111-1111-111111111111',
    expectedAssignedUsers: ['test-appraiser'],
    data: {
      orderNumber: 'TEST-ADMIN-002',
      clientId: '11111111-1111-1111-1111-111111111111',
      propertyAddress: '999 Assignment Court, Fresno, CA 93701',
      orderType: 'purchase',
      priority: 'rush',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      accessControl: {
        ownerId: 'test-admin',
        ownerEmail: 'test-admin@example.com',
        teamId: 'team-1',
        clientId: '11111111-1111-1111-1111-111111111111',
        assignedUserIds: ['test-appraiser'],
        visibilityScope: 'TEAM',
        tenantId: 'test-tenant'
      }
    }
  }
];

/**
 * Create a single test order via API
 */
async function createOrder(template: TestOrderTemplate): Promise<any> {
  try {
    logger.info(`Creating order: ${template.name}`, {
      orderNumber: template.data.orderNumber,
      expectedOwner: template.expectedOwner,
      expectedTeam: template.expectedTeam
    });

    const response = await axios.post(
      `${API_BASE}/api/orders`,
      template.data,
      {
        headers: {
          'Authorization': `Bearer ${template.token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`✓ Order created successfully`, {
      orderNumber: template.data.orderNumber,
      orderId: response.data.id || response.data.data?.id,
      status: response.status
    });

    return {
      success: true,
      template: template.name,
      orderNumber: template.data.orderNumber,
      orderId: response.data.id || response.data.data?.id,
      response: response.data
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      logger.error(`✗ Failed to create order: ${template.name}`, {
        orderNumber: template.data.orderNumber,
        status: axiosError.response?.status,
        error: axiosError.response?.data || axiosError.message
      });

      return {
        success: false,
        template: template.name,
        orderNumber: template.data.orderNumber,
        error: axiosError.response?.data || axiosError.message
      };
    }

    logger.error(`✗ Unexpected error creating order: ${template.name}`, { error });
    return {
      success: false,
      template: template.name,
      orderNumber: template.data.orderNumber,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create all test orders
 */
async function createAllTestOrders() {
  logger.info('Starting test order creation', {
    totalOrders: testOrders.length,
    apiBase: API_BASE
  });

  console.log('\n========================================');
  console.log('Creating Test Orders with Access Control');
  console.log('========================================\n');

  // Check that tokens are available
  const missingTokens: string[] = [];
  if (!process.env.TEST_JWT_ADMIN) missingTokens.push('TEST_JWT_ADMIN');
  if (!process.env.TEST_JWT_MANAGER) missingTokens.push('TEST_JWT_MANAGER');
  if (!process.env.TEST_JWT_QC_ANALYST) missingTokens.push('TEST_JWT_QC_ANALYST');
  if (!process.env.TEST_JWT_APPRAISER) missingTokens.push('TEST_JWT_APPRAISER');

  if (missingTokens.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingTokens.forEach(token => console.error(`   - ${token}`));
    console.error('\nPlease ensure all test JWT tokens are set in your .env file.');
    process.exit(1);
  }

  const results = [];

  // Create orders sequentially to avoid race conditions
  for (const template of testOrders) {
    const result = await createOrder(template);
    results.push(result);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n========================================');
  console.log('Test Order Creation Summary');
  console.log('========================================\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total Orders: ${results.length}`);
  console.log(`✓ Successful: ${successful.length}`);
  console.log(`✗ Failed: ${failed.length}\n`);

  if (successful.length > 0) {
    console.log('Successfully Created Orders:');
    successful.forEach(r => {
      console.log(`  ✓ ${r.orderNumber} (ID: ${r.orderId})`);
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log('Failed Orders:');
    failed.forEach(r => {
      console.log(`  ✗ ${r.orderNumber}`);
      console.log(`    Error: ${JSON.stringify(r.error)}`);
    });
    console.log();
  }

  console.log('========================================\n');

  // Test queries with each user
  if (successful.length > 0) {
    console.log('Next Steps:');
    console.log('1. Test GET /api/orders with each user token:');
    console.log(`   - Admin should see ${successful.filter(r => r.template.includes('Admin') || r.template.includes('Team 1')).length} orders (team-1 + owned)`);
    console.log(`   - Manager should see ${successful.filter(r => r.template.includes('Manager') || r.template.includes('client-2')).length} orders (team-2/client-2 + owned)`);
    console.log(`   - QC Analyst should see ${successful.filter(r => r.template.includes('QC')).length} orders (own + assigned)`);
    console.log(`   - Appraiser should see ${successful.filter(r => r.template.includes('Appraiser') || r.template.includes('assigned to appraiser')).length} orders (own + assigned)`);
    console.log('\n2. Check audit logs for query filters');
    console.log('3. Enable ENFORCE_AUTHORIZATION=true and verify filtering');
    console.log();
  }

  logger.info('Test order creation completed', {
    successful: successful.length,
    failed: failed.length
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    await createAllTestOrders();
    process.exit(0);
  } catch (error) {
    logger.error('Fatal error in test order creation', { error });
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { createAllTestOrders, testOrders };
