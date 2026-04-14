#!/usr/bin/env node
/**
 * Set User Extension Attributes in Entra ID
 *
 * Writes `clientId` and `subClientId` extension attributes onto an Entra ID
 * user object.  These attributes are later returned in the OIDC token and
 * used by the backend to scope Cosmos / Axiom calls.
 *
 * Prerequisites:
 *   - DefaultAzureCredential must resolve to a principal that has
 *     "User.ReadWrite.All" (or "Directory.ReadWrite.All") in the app reg's
 *     API permissions (or delegated + admin consent).
 *   - The extension attributes must already exist on the app registration
 *     (created via the entra-extension-attributes.bicep module).
 *
 * Usage:
 *   npx tsx scripts/set-user-identity.ts \
 *     --user <entra-object-id>            \
 *     --clientId <platform-client-id>     \
 *     --subClientId <platform-sub-id>
 *
 * Required env vars:
 *   AZURE_TENANT_ID        – AAD tenant GUID
 *   AZURE_API_CLIENT_ID    – App registration client ID (used to derive the
 *                            extension attribute namespace).
 *                            Default: dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a
 */

import 'dotenv/config';
import { DefaultAzureCredential } from '@azure/identity';
import axios from 'axios';

// ─── Parse CLI args ──────────────────────────────────────────────────────────

function parseArgs(): { user: string; clientId: string; subClientId: string } {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const user = get('--user');
  const clientId = get('--clientId');
  const subClientId = get('--subClientId');

  if (!user || !clientId || !subClientId) {
    console.error(
      'Usage: npx tsx scripts/set-user-identity.ts ' +
      '--user <objectId> --clientId <value> --subClientId <value>',
    );
    process.exit(1);
  }

  return { user, clientId, subClientId };
}

// ─── Config ──────────────────────────────────────────────────────────────────

function getConfig(): { tenantId: string; appClientId: string } {
  const tenantId = process.env['AZURE_TENANT_ID'];
  if (!tenantId) {
    throw new Error(
      'AZURE_TENANT_ID environment variable is required. ' +
      'Set it to the Entra ID tenant GUID (e.g. 885097ba-35ea-48db-be7a-a0aa7ff451bd).',
    );
  }

  // Fall back to the known app registration ID if not overridden
  const appClientId =
    process.env['AZURE_API_CLIENT_ID'] ?? 'dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a';

  return { tenantId, appClientId };
}

// ─── Extension attribute helpers ─────────────────────────────────────────────

/** Derive the Graph extension attribute namespace from an app registration ID.
 *  Strips dashes; prepends "extension_".
 *  e.g. "dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a" → "extension_dd3e7944ecf34cd9bf1dba1a4e857e8a"
 */
function extNs(appClientId: string): string {
  return `extension_${appClientId.replace(/-/g, '')}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { user, clientId, subClientId } = parseArgs();
  const { tenantId, appClientId } = getConfig();

  const ns = extNs(appClientId);
  const clientIdAttr = `${ns}_clientId`;
  const subClientIdAttr = `${ns}_subClientId`;

  console.log('\n🔐 Acquiring Graph API token via DefaultAzureCredential…');
  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
  const accessToken = tokenResponse.token;

  const url = `https://graph.microsoft.com/v1.0/users/${user}`;
  const body = {
    [clientIdAttr]: clientId,
    [subClientIdAttr]: subClientId,
  };

  console.log(`\n📋 Patching user: ${user}`);
  console.log(`   Tenant:       ${tenantId}`);
  console.log(`   App reg:      ${appClientId}`);
  console.log(`   ${clientIdAttr}: ${clientId}`);
  console.log(`   ${subClientIdAttr}: ${subClientId}`);

  await axios.patch(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  // Graph PATCH /users returns 204 No Content on success
  console.log('\n✅ Extension attributes set successfully.');
  console.log(
    '\nNote: The new values will appear in OIDC tokens after the user\'s next sign-in ' +
    '(or when the token is refreshed).',
  );
}

main().catch((err) => {
  console.error('\n❌ Failed to set user identity:', err instanceof Error ? err.message : err);
  if (axios.isAxiosError(err) && err.response) {
    console.error('   Graph API response:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
