/**
 * Client Config Service
 *
 * Manages per-client automation settings stored in Cosmos DB.
 * Falls back to DEFAULT_CLIENT_AUTOMATION_CONFIG when no document exists.
 *
 * Container: 'client-configs'
 * Partition key: clientId
 */

import { CosmosDbService } from './cosmos-db.service.js';
import {
  ClientAutomationConfig,
  UpdateClientAutomationConfigRequest,
  DEFAULT_CLIENT_AUTOMATION_CONFIG,
} from '../types/tenant-automation-config.types.js';
import { Logger } from '../utils/logger.js';

const CONTAINER = 'client-configs';

export class TenantAutomationConfigService {
  private readonly db: CosmosDbService;
  private readonly logger: Logger;

  constructor(dbService?: CosmosDbService) {
    this.db = dbService ?? new CosmosDbService();
    this.logger = new Logger('TenantAutomationConfigService');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the automation config for the given client, with optional
   * sub-client override cascade:
   *   1. clientId + subClientId (sub-client-specific config)
   *   2. clientId + subClientId="platform" (client-wide defaults)
   *   3. DEFAULT_CLIENT_AUTOMATION_CONFIG (hardcoded fallback)
   */
  async getConfig(clientId: string, subClientId?: string): Promise<ClientAutomationConfig> {
    if (!clientId) {
      throw new Error('clientId is required');
    }

    // Try sub-client-specific config first
    if (subClientId && subClientId !== 'platform') {
      this.logger.info('Loading sub-client automation config', { clientId, subClientId });
      const subResult = await this.db.queryItems<ClientAutomationConfig>(
        CONTAINER,
        'SELECT * FROM c WHERE c.clientId = @clientId AND c.subClientId = @subClientId AND c.entityType = @entityType',
        [
          { name: '@clientId', value: clientId },
          { name: '@subClientId', value: subClientId },
          { name: '@entityType', value: 'client-config' },
        ],
      );
      if (subResult.success && subResult.data && subResult.data.length > 0) {
        return subResult.data[0]!;
      }
      this.logger.info('No sub-client config — falling back to client-level', { clientId, subClientId });
    }

    // Fall back to client-level (platform) config
    this.logger.info('Loading client automation config', { clientId });
    const result = await this.db.queryItems<ClientAutomationConfig>(
      CONTAINER,
      'SELECT * FROM c WHERE c.clientId = @clientId AND (c.subClientId = @platform OR NOT IS_DEFINED(c.subClientId)) AND c.entityType = @entityType',
      [
        { name: '@clientId', value: clientId },
        { name: '@platform', value: 'platform' },
        { name: '@entityType', value: 'client-config' },
      ],
    );

    if (!result.success || !result.data || result.data.length === 0) {
      this.logger.info('No config found — returning defaults', { clientId });
      const now = new Date().toISOString();
      return {
        ...DEFAULT_CLIENT_AUTOMATION_CONFIG,
        id: `client-config-${clientId}`,
        clientId,
        updatedAt: now,
        updatedBy: 'system',
        createdAt: now,
      };
    }

    return result.data[0]!;
  }

  /**
   * Creates or replaces the automation config for the given client.
   * Always does a full upsert (idempotent).
   */
  async updateConfig(
    clientId: string,
    update: UpdateClientAutomationConfigRequest,
    updatedBy: string,
  ): Promise<ClientAutomationConfig> {
    if (!clientId) throw new Error('clientId is required');
    if (!updatedBy) throw new Error('updatedBy is required');

    // Load existing or start from defaults so we only override explicit fields.
    const existing = await this.getConfig(clientId);

    const now = new Date().toISOString();

    const updated: ClientAutomationConfig = {
      ...existing,
      ...update,
      clientId,
      entityType: 'client-config' as const,
      id: existing.id ?? `client-config-${clientId}`,
      updatedAt: now,
      updatedBy,
      createdAt: existing.createdAt ?? now,
    };

    const upsertResult = await this.db.upsertItem<ClientAutomationConfig>(CONTAINER, updated);

    if (!upsertResult.success || !upsertResult.data) {
      const message = `Failed to persist automation config for client ${clientId}`;
      this.logger.error(message, { clientId, error: upsertResult.error });
      throw new Error(message);
    }

    this.logger.info('Automation config updated', { clientId, updatedBy });
    return upsertResult.data;
  }

  /**
   * Narrow check used by the orchestrator to test a single toggle without
   * retrieving the entire config doc.
   */
  async isFeatureEnabled(
    clientId: string,
    feature: keyof Pick<
      ClientAutomationConfig,
      'autoAssignmentEnabled' | 'bidLoopEnabled' | 'supervisoryReviewForAllOrders'
    >,
  ): Promise<boolean> {
    const config = await this.getConfig(clientId);
    const value = config[feature];
    if (typeof value !== 'boolean') {
      throw new Error(
        `Feature flag '${feature}' is not a boolean on ClientAutomationConfig`,
      );
    }
    return value;
  }
}
