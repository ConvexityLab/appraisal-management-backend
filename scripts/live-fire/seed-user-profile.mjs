#!/usr/bin/env node
/**
 * Direct Cosmos seed for a single user profile — live-fire unblocker.
 *
 * Bypasses `POST /api/users` (currently returning 500 on staging — see
 * separate investigation).  Writes a minimal UserProfile doc straight
 * into the `users` Cosmos container.
 *
 * Use case: you want test 5 (autopilot approval queue UI) to run, but
 * the autopilot orchestrator's sponsor-identity check refuses to fire
 * the recipe because the sponsor's user record is missing.  Seed the
 * record, re-publish the autopilot-task, test 5 has data.
 *
 * Auth: DefaultAzureCredential — uses `az login` cache by default.
 *
 * Usage:
 *   AZURE_COSMOS_ENDPOINT=https://...documents.azure.com \
 *   AZURE_COSMOS_DATABASE_NAME=appraisal-management \
 *   node scripts/live-fire/seed-user-profile.mjs \
 *     <emailOrUserId> <azureAdObjectId> [tenantId] [role]
 *
 * Required positional args:
 *   1. email or canonical user id (used as doc.id — typically email)
 *   2. azureAdObjectId (the AAD `oid` claim — recipe sponsorUserId)
 *
 * Optional:
 *   3. tenantId — defaults to 885097ba-35ea-48db-be7a-a0aa7ff451bd
 *   4. role     — defaults to 'admin'
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const [emailArg, oidArg, tenantArg, roleArg] = process.argv.slice(2);

if (!emailArg || !oidArg) {
	console.error('Usage: node seed-user-profile.mjs <email> <azureAdObjectId> [tenantId] [role]');
	process.exit(1);
}

const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
const dbName = process.env.AZURE_COSMOS_DATABASE_NAME ?? 'appraisal-management';
if (!endpoint) {
	console.error('AZURE_COSMOS_ENDPOINT required (e.g. https://appraisal-mgmt-staging-cosmos.documents.azure.com).');
	process.exit(1);
}

const tenantId = tenantArg ?? '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const role = roleArg ?? 'admin';

// Match UserProfileService.generateUserId — typically a slug of the email.
// For seeding we accept either an email (we slug it) or a pre-built id.
const userId = emailArg.includes('@')
	? emailArg.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
	: emailArg;

const doc = {
	id: userId,
	email: emailArg.includes('@') ? emailArg : `${userId}@l1-analytics.com`,
	name: emailArg.includes('@') ? emailArg.split('@')[0] : userId,
	azureAdObjectId: oidArg,
	tenantId,
	role,
	portalDomain: 'platform',
	boundEntityIds: [],
	isInternal: true,
	isActive: true,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

console.log('[seed-user-profile] Configuration:');
console.log(`  endpoint = ${endpoint}`);
console.log(`  database = ${dbName}`);
console.log(`  container= users`);
console.log(`  doc.id   = ${doc.id}`);
console.log(`  oid      = ${doc.azureAdObjectId}`);
console.log(`  tenantId = ${doc.tenantId}`);
console.log(`  role     = ${doc.role}\n`);

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const container = client.database(dbName).container('users');

try {
	const { resource } = await container.items.upsert(doc);
	console.log('[seed-user-profile] Upsert OK.');
	console.log(`  id      = ${resource?.id}`);
	console.log(`  _etag   = ${resource?._etag}`);
	process.exit(0);
} catch (err) {
	console.error('[seed-user-profile] Upsert failed:', err instanceof Error ? err.message : String(err));
	process.exit(2);
}
