import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type { VendorConnection, VendorType } from '../../types/vendor-integration.types.js';
import { VendorConnectionConfigurationError } from './VendorIntegrationErrors.js';

export class VendorConnectionService {
  private readonly logger = new Logger('VendorConnectionService');
  private readonly db: CosmosDbService;
  private secretClient: SecretClient | null = null;

  constructor(db?: CosmosDbService) {
    this.db = db ?? new CosmosDbService();
  }

  async getActiveConnectionByInboundIdentifier(
    inboundIdentifier: string,
    vendorType: VendorType,
  ): Promise<VendorConnection> {
    const response = await this.db.queryItems<VendorConnection>(
      'vendor-connections',
      'SELECT * FROM c WHERE c.inboundIdentifier = @inboundIdentifier AND c.vendorType = @vendorType AND c.active = true',
      [
        { name: '@inboundIdentifier', value: inboundIdentifier },
        { name: '@vendorType', value: vendorType },
      ],
    );

    if (!response.success || !response.data || response.data.length === 0) {
      throw new VendorConnectionConfigurationError(
        `No active vendor connection is configured for vendorType=${vendorType} inboundIdentifier=${inboundIdentifier}. ` +
        'Create or activate a vendor connection before enabling this inbound integration.',
      );
    }

    if (response.data.length > 1) {
      throw new VendorConnectionConfigurationError(
        `Multiple active vendor connections are configured for vendorType=${vendorType} inboundIdentifier=${inboundIdentifier}. ` +
        'This must be unique.',
      );
    }

    const [connection] = response.data;
    if (!connection) {
      throw new VendorConnectionConfigurationError(
        `No active vendor connection is configured for vendorType=${vendorType} inboundIdentifier=${inboundIdentifier}. ` +
        'Create or activate a vendor connection before enabling this inbound integration.',
      );
    }

    return connection;
  }

  /**
   * Look up a vendor connection by its Cosmos document ID.
   * Used by VendorOutboundDispatcher to resolve the connection from an outbox document's
   * connectionId field, which stores the Cosmos doc ID — NOT the inboundIdentifier.
   */
  async getConnectionById(id: string): Promise<VendorConnection> {
    const response = await this.db.queryItems<VendorConnection>(
      'vendor-connections',
      'SELECT * FROM c WHERE c.id = @id',
      [{ name: '@id', value: id }],
    );

    if (!response.success || !response.data || response.data.length === 0 || !response.data[0]) {
      throw new VendorConnectionConfigurationError(
        `No vendor connection found with id=${id}. It may have been deleted.`,
      );
    }

    return response.data[0];
  }

  async resolveSecret(secretName: string): Promise<string> {
    const client = this.getSecretClient();
    const secret = await client.getSecret(secretName);
    if (!secret.value || !secret.value.trim()) {
      throw new Error(`Key Vault secret ${secretName} is empty. Populate it before enabling this vendor integration.`);
    }
    return secret.value;
  }

  private getSecretClient(): SecretClient {
    if (this.secretClient) return this.secretClient;

    const keyVaultUrl = process.env.KEY_VAULT_URL;
    if (!keyVaultUrl || !keyVaultUrl.trim()) {
      throw new Error(
        'KEY_VAULT_URL is required for vendor integrations. Vendor credentials must be stored in Key Vault and accessed via Managed Identity.',
      );
    }

    this.logger.info('Initializing Key Vault client for vendor integrations', { keyVaultUrl });
    this.secretClient = new SecretClient(keyVaultUrl, new DefaultAzureCredential());
    return this.secretClient;
  }
}
