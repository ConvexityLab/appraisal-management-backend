/**
 * Seed Module: Vendor Connections
 *
 * Seeds VendorConnection documents into the `vendor-connections` container.
 * These are integration configuration records, NOT transient test fixtures —
 * their IDs do NOT carry the `seed-` prefix so a standard `--clean` run
 * does NOT remove them. Use `--module vendor-connections --clean` to
 * explicitly remove them (clean prefix: 'vc-').
 *
 * ─── AIM Port credentials note ─────────────────────────────────────────────
 * `credentials.inboundApiKeySecretName` and `outboundApiKeySecretName` store
 * only the KEY VAULT SECRET NAME — never the actual secret value.
 * Both point to 'aim-port-api-key' in Key Vault.
 * The actual API key is written to Key Vault via the Bicep
 * `key-vault-secrets.bicep` module (param: aimPortApiKey). The deployment
 * pipeline passes the value from a pipeline secret at deploy time.
 *
 * Container: vendor-connections (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer } from '../seed-types.js';

const CONTAINER = 'vendor-connections';
// Use a non-seed-prefix ID so standard --clean doesn't wipe integration config.
// Targeted cleanup uses prefix 'vc-aim-port-' to scope to only AIM Port connections.
const CLEAN_ID_PREFIX = 'vc-aim-port-';

export const module: SeedModule = {
  name: 'vendor-connections',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER, '/tenantId', CLEAN_ID_PREFIX);
    }

    // ── AIM Port — Test Lender (staging) ────────────────────────────────────
    // Handles inbound order pushes from AIM Port (clientReceiveWS integration)
    // and outbound status callbacks back to AIM Port.
    //
    // AIM Port identifies us via login.client_id = '495735' in every request body.
    // inboundIdentifier must match that value.
    //
    // The actual API key is stored in Key Vault as 'aim-port-api-key'.
    // The deployment pipeline populates that secret via the aimPortApiKey param
    // in key-vault-secrets.bicep — never hardcoded here.
    await upsert(ctx, CONTAINER, {
      id: 'vc-aim-port-test-lender',
      type: 'vendor-connection',
      vendorType: 'aim-port',
      tenantId: ctx.tenantId,
      lenderId: 'seed-client-lender-firsthorizon-001',
      lenderName: 'Test Lender (AIM Port staging)',
      // AIM Port posts login.client_id = '495735' on every inbound request.
      // This value is used by identifyInboundConnection() to look up this doc.
      inboundIdentifier: '495735',
      // AIM Port staging callback endpoint (their side).
      outboundEndpointUrl: 'https://staging.aim-port.com/api/clientReceiveWS.php',
      active: true,
      credentials: {
        // Key Vault secret NAME only — value resolved at runtime via Managed Identity.
        // Shared secret: AIM Port sends it inbound and expects it outbound.
        inboundApiKeySecretName: 'aim-port-api-key',
        outboundApiKeySecretName: 'aim-port-api-key',
        // Our client_id as registered with AIM Port.
        outboundClientId: '495735',
      },
      createdAt: ctx.now,
      updatedAt: ctx.now,
    }, result);

    return result;
  },
};
