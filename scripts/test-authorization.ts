/**
 * Authorization Testing Script
 * 
 * Test authorization policies, filtering, and access control
 */

import { AuthorizationService } from '../services/authorization.service';
import { AccessGraphService } from '../services/access-graph.service';
import { UserProfile, ResourceType, Action } from '../types/authorization.types';

// Test users matching our JWT tokens
const testUsers: Record<string, UserProfile> = {
  admin: {
    id: 'test-admin',
    email: 'admin@test.local',
    name: 'Test Admin',
    role: 'admin',
    permissions: ['*'],
    tenantId: 'test-tenant',
    accessScope: {
      teamIds: ['team-all'],
      departmentIds: ['dept-all'],
      managedClientIds: ['client-all'],
      canViewAllOrders: true,
      canViewAllVendors: true,
      canOverrideQC: true
    },
    isActive: true
  },
  
  manager: {
    id: 'test-manager',
    email: 'manager@test.local',
    name: 'Test Manager',
    role: 'manager',
    permissions: ['order_manage', 'order_view', 'vendor_manage', 'analytics_view'],
    tenantId: 'test-tenant',
    accessScope: {
      teamIds: ['team-1', 'team-2'],
      managedClientIds: ['client-1', 'client-2'],
      statesCovered: ['CA', 'NV', 'AZ'],
      canViewAllOrders: false,
      canViewAllVendors: false
    },
    isActive: true
  },
  
  qc_analyst: {
    id: 'test-qc-analyst',
    email: 'qc.analyst@test.local',
    name: 'Test QC Analyst',
    role: 'qc_analyst',
    permissions: ['qc_validate', 'qc_execute', 'order_view'],
    tenantId: 'test-tenant',
    accessScope: {
      teamIds: ['team-qc'],
      statesCovered: ['CA', 'NV'],
      canViewAllOrders: false,
      canViewAllVendors: false
    },
    isActive: true
  },
  
  appraiser: {
    id: 'test-appraiser',
    email: 'appraiser@test.local',
    name: 'Test Appraiser',
    role: 'appraiser',
    permissions: ['order_view', 'order_update'],
    tenantId: 'test-tenant',
    accessScope: {
      teamIds: ['team-appraisers'],
      statesCovered: ['CA'],
      canViewAllOrders: false,
      canViewAllVendors: false
    },
    isActive: true
  }
};

async function testAuthorization() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         AUTHORIZATION TESTING - INTERACTIVE                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const authzService = new AuthorizationService();
  await authzService.initialize();

  // Test 1: Can different users read orders?
  console.log('📋 TEST 1: Can users READ orders?\n');
  for (const [name, user] of Object.entries(testUsers)) {
    const decision = await authzService.canAccess(
      user,
      'order',
      'test-order-1',
      'read'
    );
    
    console.log(`  ${decision.allowed ? '✅' : '❌'} ${name.padEnd(12)} - ${decision.allowed ? 'ALLOWED' : 'DENIED'}`);
    if (!decision.allowed) {
      console.log(`     Reason: ${decision.reason}`);
    }
  }

  // Test 2: Can different users CREATE orders?
  console.log('\n📋 TEST 2: Can users CREATE orders?\n');
  for (const [name, user] of Object.entries(testUsers)) {
    const decision = await authzService.canAccess(
      user,
      'order',
      'new',
      'create'
    );
    
    console.log(`  ${decision.allowed ? '✅' : '❌'} ${name.padEnd(12)} - ${decision.allowed ? 'ALLOWED' : 'DENIED'}`);
    if (!decision.allowed) {
      console.log(`     Reason: ${decision.reason}`);
    }
  }

  // Test 3: Query filters for different users
  console.log('\n🔍 TEST 3: Query filters (what WOULD each user see?)\n');
  for (const [name, user] of Object.entries(testUsers)) {
    const filter = await authzService.buildQueryFilter(user, 'order', 'read');
    
    console.log(`  ${name}:`);
    console.log(`     Filter: ${JSON.stringify(filter, null, 6).split('\n').join('\n     ')}`);
  }

  // Test 4: Test with mock order data
  console.log('\n📦 TEST 4: Which users can see which orders?\n');
  
  const mockOrders = [
    { id: 'order-1', accessControl: { teamId: 'team-1', clientId: 'client-1', ownerId: 'test-admin', assignedUserIds: [] }},
    { id: 'order-2', accessControl: { teamId: 'team-2', clientId: 'client-2', ownerId: 'test-manager', assignedUserIds: [] }},
    { id: 'order-3', accessControl: { teamId: 'team-qc', clientId: 'client-3', ownerId: 'test-qc-analyst', assignedUserIds: ['test-qc-analyst'] }},
    { id: 'order-4', accessControl: { teamId: 'team-appraisers', clientId: 'client-4', ownerId: 'test-appraiser', assignedUserIds: ['test-appraiser'] }}
  ];

  for (const [name, user] of Object.entries(testUsers)) {
    console.log(`\n  ${name}:`);
    for (const order of mockOrders) {
      const decision = await authzService.canAccess(
        user,
        'order',
        order.id,
        'read',
        order.accessControl
      );
      
      console.log(`    ${decision.allowed ? '✅' : '❌'} ${order.id} (team: ${order.accessControl.teamId})`);
    }
  }

  // Test 5: Access graph relationships
  console.log('\n🔗 TEST 5: Testing access graph (exception grants)\n');
  
  const graphService = new AccessGraphService();
  
  // Grant special access: Let appraiser access an order outside their scope
  await graphService.grantAccess({
    entityType: 'user',
    entityId: 'test-appraiser',
    objectType: 'order',
    objectId: 'order-1',
    actions: ['read', 'update'],
    grantedBy: 'test-admin',
    reason: 'Special project assignment'
  });
  
  console.log('  ✅ Granted test-appraiser access to order-1 (normally team-1)');
  
  // Test if appraiser can now access it
  const decision = await authzService.canAccess(
    testUsers.appraiser,
    'order',
    'order-1',
    'read',
    { teamId: 'team-1', clientId: 'client-1', ownerId: 'test-admin', assignedUserIds: [] },
    { checkGraph: true }
  );
  
  console.log(`  ${decision.allowed ? '✅' : '❌'} Appraiser can now access order-1: ${decision.allowed ? 'YES' : 'NO'}`);
  if (decision.allowed) {
    console.log(`     Via: ${decision.via}`);
  }

  console.log('\n✅ Testing complete!\n');
}

// Run if called directly
if (require.main === module) {
  testAuthorization()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testAuthorization };
