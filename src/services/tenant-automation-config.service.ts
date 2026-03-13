/**
 * Tenant Automation Config Service
 *
 * Manages per-tenant automation settings stored in Cosmos DB.
 * Falls back to DEFAULT_TENANT_AUTOMATION_CONFIG when no document exists.
 *
 * Container: 'tenant-automation-configs'
 * Partition key: tenantId
 */

import { CosmosDbService } from './cosmos-db.service.js';
import {
  TenantAutomationConfig,
  UpdateTenantAutomationConfigRequest,
  DEFAULT_TENANT_AUTOMATION_CONFIG,
} from '../types/tenant-automation-config.types.js';
import { Logger } from '../utils/logger.js';

const CONTAINER = 'tenant-automation-configs';

export class TenantAutomationConfigService {
  private readonly db: CosmosDbService;
  private readonly logger: Logger;

  constructor() {
    this.db = new CosmosDbService();
    this.logger = new Logger('TenantAutomationConfigService');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns the automation config for the given tenant.
   * When no document exists the caller receives DEFAULT_TENANT_AUTOMATION_CONFIG
   * so that features degrade gracefully without silent magic defaults in business
   * logic (callers always get an explicit, typed object).
   */
  async getConfig(tenantId: string): Promise<TenantAutomationConfig> {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    this.logger.info('Loading automation config', { tenantId });

    const result = await this.db.queryItems<TenantAutomationConfig>(
      CONTAINER,
      'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.entityType = @entityType',
      [
        { name: '@tenantId', value: tenantId },
        { name: '@entityType', value: 'tenant-automation-config' },
      ],
    );

    if (!result.success || !result.data || result.data.length === 0) {
      this.logger.info('No config found — returning defaults', { tenantId });
      const now = new Date().toISOString();
      return {
        ...DEFAULT_TENANT_AUTOMATION_CONFIG,
        id: `automation-config-${tenantId}`,
        tenantId,
        updatedAt: now,
        updatedBy: 'system',
        createdAt: now,
      };
    }

    return result.data[0]!
  }

  /**
   * Creates or replaces the automation config for the given tenant.
   * Always does a full upsert (idempotent).
   */
  async updateConfig(
    tenantId: string,
    update: UpdateTenantAutomationConfigRequest,
    updatedBy: string,
  ): Promise<TenantAutomationConfig> {
    if (!tenantId) throw new Error('tenantId is required');
    if (!updatedBy) throw new Error('updatedBy is required');

    // Load existing or start from defaults so we only override explicit fields.
    const existing = await this.getConfig(tenantId);

    const now = new Date().toISOString();

    const updated: TenantAutomationConfig = {
      ...existing,
      ...update,
      tenantId,
      entityType: 'tenant-automation-config' as const,
      id: existing.id ?? `automation-config-${tenantId}`,
      updatedAt: now,
      updatedBy,
      createdAt: existing.createdAt ?? now,
    };

    const upsertResult = await this.db.upsertItem<TenantAutomationConfig>(CONTAINER, updated);

    if (!upsertResult.success || !upsertResult.data) {
      const message = `Failed to persist automation config for tenant ${tenantId}`;
      this.logger.error(message, { tenantId, error: upsertResult.error });
      throw new Error(message);
    }

    this.logger.info('Automation config updated', { tenantId, updatedBy });
    return upsertResult.data;
  }

  /**
   * Narrow check used by the orchestrator to test a single toggle without
   * retrieving the entire config doc.
   */
  async isFeatureEnabled(
    tenantId: string,
    feature: keyof Pick<
      TenantAutomationConfig,
      'autoAssignmentEnabled' | 'bidLoopEnabled' | 'supervisoryReviewForAllOrders'
    >,
  ): Promise<boolean> {
    const config = await this.getConfig(tenantId);
    const value = config[feature];
    if (typeof value !== 'boolean') {
      throw new Error(
        `Feature flag '${feature}' is not a boolean on TenantAutomationConfig`,
      );
    }
    return value;
  }
}
