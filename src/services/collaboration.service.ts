/**
 * Collaboration Service — Azure Fluid Relay token provider
 *
 * Generates scoped Fluid Relay user JWTs using @fluidframework/azure-service-utils.
 * The tenant signing key is retrieved from Key Vault at runtime via Managed Identity.
 * The key is NEVER stored in an env var or code.
 *
 * Token lifecycle: 1 hour by default.
 * Key cache: 5 minutes to reduce Key Vault round-trips without staling the key.
 */

import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { generateToken, ScopeType } from '@fluidframework/azure-service-utils/legacy';
import { Logger } from '../utils/logger.js';

export interface FluidRelayTokenRequest {
  /** Fluid Relay tenant ID (from AZURE_FLUID_RELAY_TENANT_ID env or override) */
  tenantId: string;
  /** Container (document) ID — undefined means a new container will be created by the client */
  containerId: string | undefined;
  /** Azure AD user id of the requesting user */
  userId: string;
  /** Display name shown to collaborators */
  userName: string;
  /** Token lifetime in seconds (default: 3600) */
  lifetime?: number;
}

export interface FluidRelayTokenResult {
  /** Signed Fluid Relay JWT */
  token: string;
  tenantId: string;
  /** Unix timestamp (seconds) when this token expires */
  expiresAt: number;
}

export class CollaborationService {
  private readonly secretClient: SecretClient;
  private readonly logger: Logger;

  // Key cache — reduces Key Vault round-trips without going stale
  private cachedKey: string | null = null;
  private keyFetchedAt = 0;
  private static readonly KEY_CACHE_MS = 5 * 60 * 1_000; // 5 minutes

  constructor() {
    const keyVaultUrl = process.env.KEY_VAULT_URL;
    if (!keyVaultUrl) {
      throw new Error(
        'KEY_VAULT_URL environment variable is required for CollaborationService. ' +
        'Set it to the Key Vault URI (e.g. https://kv-myapp-sta-abc123.vault.azure.net/).'
      );
    }
    this.secretClient = new SecretClient(keyVaultUrl, new DefaultAzureCredential());
    this.logger = new Logger('CollaborationService');
  }

  /**
   * Returns true when Fluid Relay is configured in this environment.
   * Does NOT attempt a Key Vault fetch — safe to call at startup.
   */
  isConfigured(): boolean {
    return !!(process.env.AZURE_FLUID_RELAY_TENANT_ID && process.env.KEY_VAULT_URL);
  }

  /**
   * Issues a Fluid Relay user token for the given request.
   * The token authorises the user to read and write the specified container
   * (or any new container if containerId is undefined).
   */
  async generateToken(req: FluidRelayTokenRequest): Promise<FluidRelayTokenResult> {
    const { tenantId, containerId, userId, userName, lifetime = 3_600 } = req;
    const tenantKey = await this.getTenantKey();

    const scopes = [ScopeType.DocRead, ScopeType.DocWrite, ScopeType.SummaryWrite];
    const user = { id: userId, name: userName };

    const token = generateToken(tenantId, tenantKey, scopes, containerId, user, lifetime);

    const expiresAt = Math.floor(Date.now() / 1_000) + lifetime;
    this.logger.info('Fluid Relay token issued', { userId, tenantId, containerId, expiresAt });
    return { token, tenantId, expiresAt };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async getTenantKey(): Promise<string> {
    // Local-dev bypass: set AZURE_FLUID_RELAY_KEY to the primary key from the Azure portal
    // (Azure Fluid Relay resource → Access keys). This avoids needing Key Vault RBAC locally.
    const localKey = process.env.AZURE_FLUID_RELAY_KEY;
    if (localKey) {
      this.logger.info('Using AZURE_FLUID_RELAY_KEY env var (local-dev bypass — not Key Vault)');
      return localKey;
    }

    const now = Date.now();
    if (this.cachedKey && now - this.keyFetchedAt < CollaborationService.KEY_CACHE_MS) {
      return this.cachedKey;
    }

    this.logger.info('Fetching fluid-relay-key from Key Vault');
    const secret = await this.secretClient.getSecret('fluid-relay-key');

    if (!secret.value) {
      throw new Error(
        'Secret "fluid-relay-key" exists in Key Vault but has an empty value. ' +
        'Ensure the Bicep deployment set the value from the Fluid Relay listKeys() output.'
      );
    }

    this.cachedKey = secret.value;
    this.keyFetchedAt = now;
    return this.cachedKey;
  }
}
