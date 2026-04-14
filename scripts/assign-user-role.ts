#!/usr/bin/env node
/**
 * Assign an Entra App Role to a user
 *
 * Idempotent: safe to re-run. If the user already has the role, does nothing.
 * Removes any previously-assigned app role from this app before assigning the
 * new one, so calling with a different --role updates rather than stacks.
 *
 * Prerequisites:
 *   - DefaultAzureCredential must resolve to a principal with
 *     AppRoleAssignment.ReadWrite.All in Graph API permissions.
 *   - App Roles must already be defined on the app registration
 *     (done by the entra-extension-attributes.bicep deployment script).
 *
 * Usage:
 *   npx tsx scripts/assign-user-role.ts \
 *     --user <entra-object-id>           \
 *     --role Admin|Manager|QCAnalyst|Appraiser
 *
 * Required env vars:
 *   AZURE_TENANT_ID     – AAD tenant GUID
 *   AZURE_API_CLIENT_ID – App registration client ID
 *                         Default: dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a
 */

import 'dotenv/config';
import { DefaultAzureCredential } from '@azure/identity';
import axios, { AxiosInstance } from 'axios';

const VALID_ROLES = ['Admin', 'Manager', 'QCAnalyst', 'Appraiser'] as const;
type AppRoleValue = (typeof VALID_ROLES)[number];

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArgs(): { user: string; role: AppRoleValue } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const user = get('--user');
  const role = get('--role');

  if (!user || !role) {
    console.error(
      `Usage: npx tsx scripts/assign-user-role.ts --user <objectId> --role <${VALID_ROLES.join('|')}>`,
    );
    process.exit(1);
  }

  if (!VALID_ROLES.includes(role as AppRoleValue)) {
    console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  return { user, role: role as AppRoleValue };
}

// ─── Config ──────────────────────────────────────────────────────────────────

function getConfig(): { tenantId: string; appClientId: string } {
  const tenantId = process.env['AZURE_TENANT_ID'];
  if (!tenantId) {
    throw new Error(
      'AZURE_TENANT_ID environment variable is required.',
    );
  }
  const appClientId =
    process.env['AZURE_API_CLIENT_ID'] ?? 'dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a';
  return { tenantId, appClientId };
}

// ─── Graph helpers ───────────────────────────────────────────────────────────

function graphClient(accessToken: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://graph.microsoft.com/v1.0',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
}

async function getServicePrincipal(
  graph: AxiosInstance,
  appClientId: string,
): Promise<{ id: string; appRoles: Array<{ id: string; value: string; displayName: string }> }> {
  const res = await graph.get(
    `/servicePrincipals?$filter=appId eq '${appClientId}'&$select=id,appRoles`,
  );
  const sps = res.data.value as any[];
  if (sps.length === 0) {
    throw new Error(
      `No service principal found for appId ${appClientId}. ` +
      'Has the app registration been consented to in this tenant?',
    );
  }
  return sps[0];
}

async function getCurrentAssignments(
  graph: AxiosInstance,
  userId: string,
  spId: string,
): Promise<Array<{ id: string; appRoleId: string }>> {
  const res = await graph.get(
    `/users/${userId}/appRoleAssignments?$filter=resourceId eq ${spId}`,
  );
  return res.data.value ?? [];
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { user, role } = parseArgs();
  const { tenantId, appClientId } = getConfig();

  console.log('\n🔐 Acquiring Graph API token via DefaultAzureCredential…');
  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
  const graph = graphClient(tokenResponse.token);

  console.log(`\n🔍 Resolving service principal for app ${appClientId}…`);
  const sp = await getServicePrincipal(graph, appClientId);
  console.log(`   SP object ID: ${sp.id}`);

  // Find the target App Role by value string
  const targetRole = sp.appRoles.find((r) => r.value === role);
  if (!targetRole) {
    throw new Error(
      `App Role "${role}" not found on service principal ${sp.id}. ` +
      'Run the entra-extension-attributes Bicep module first to register App Roles.',
    );
  }
  console.log(`   App Role "${role}" → ID ${targetRole.id}`);

  // Get existing assignments for this user + SP
  const existing = await getCurrentAssignments(graph, user, sp.id);

  // Remove any stale assignments from this same app so roles don't stack
  for (const assignment of existing) {
    if (assignment.appRoleId === targetRole.id) {
      console.log(`\n✅ User already has role "${role}" — nothing to do.`);
      return;
    }
    // Different role from same app: revoke it so we don't stack
    console.log(`   Revoking previous app role assignment ${assignment.id}…`);
    await graph.delete(`/users/${user}/appRoleAssignments/${assignment.id}`);
  }

  // Assign the requested role
  console.log(`\n📝 Assigning role "${role}" (${targetRole.id}) to user ${user} via SP ${sp.id}…`);
  await graph.post(`/users/${user}/appRoleAssignments`, {
    principalId: user,
    resourceId: sp.id,
    appRoleId: targetRole.id,
  });

  console.log(`\n✅ Role "${role}" assigned successfully.`);
  console.log('ℹ️  The roles claim will appear in tokens after the user\'s next sign-in.');
}

main().catch((err) => {
  console.error('\n❌ Failed to assign role:', err instanceof Error ? err.message : err);
  if (axios.isAxiosError(err) && err.response) {
    console.error('   Graph API response:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
