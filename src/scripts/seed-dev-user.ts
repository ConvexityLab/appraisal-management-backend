#!/usr/bin/env tsx
/**
 * One-time dev helper: upserts the developer's Azure AD user as an admin
 * in the Cosmos `users` container so the auth middleware can load a profile.
 *
 * Usage:  npx tsx --env-file .env src/scripts/seed-dev-user.ts
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
if (!endpoint) {
  console.error('COSMOS_ENDPOINT is not set');
  process.exit(1);
}

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });
const container = client.database('appraisal-management').container('users');

const userDoc = {
  id: '3cb04a10-b6f3-4fd1-8997-798507299d73',
  tenantId: '885097ba-35ea-48db-be7a-a0aa7ff451bd',
  email: 'hiro@loneanalytics.com',
  name: 'Hiro Hikawa',
  azureAdObjectId: '3cb04a10-b6f3-4fd1-8997-798507299d73',
  role: 'admin',
  isActive: true,
  accessScope: {
    teamIds: [],
    departmentIds: [],
    managedClientIds: [],
    managedVendorIds: [],
    managedUserIds: [],
    regionIds: [],
    statesCovered: [],
    canViewAllOrders: true,
    canViewAllVendors: true,
    canOverrideQC: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function main() {
  console.log('Upserting dev user into Cosmos users container...');
  const { resource, statusCode } = await container.items.upsert(userDoc);
  console.log(`Done (HTTP ${statusCode}): id=${resource?.id} email=${resource?.email} role=${resource?.role}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
