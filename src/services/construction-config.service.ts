/**
 * Construction Finance Module — Tenant Configuration Service
 *
 * Manages per-tenant TenantConstructionConfig documents in the `construction-loans` Cosmos container.
 *
 * Document ID convention: `config-{tenantId}` (well-known, deterministic — no lookup needed)
 * Partition key: /tenantId
 *
 * INVARIANT: retainageReleaseRequiresHumanApproval is ALWAYS written as true, regardless
 * of what any caller passes.  See TenantConstructionConfig type-level docs for rationale.
 *
 * NO createIfNotExists — callers must explicitly call createConfig during tenant onboarding.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER = 'construction-loans';

/** All default values for a fresh TenantConstructionConfig.  Mirrors the JSDoc in the type. */
const CONFIG_DEFAULTS: Omit<TenantConstructionConfig, 'tenantId' | 'updatedAt' | 'updatedBy'> = {
  allowConcurrentDraws: false,
  maxConcurrentDraws: 1,
  requireInspectionBeforeDraw: true,
  allowDesktopInspection: true,
  lienWaiverGracePeriodDays: 0,
  defaultRetainagePercent: 10,
  retainageReleaseAutoTrigger: true,
  retainageReleaseThreshold: 95,
  retainageReleaseRequiresHumanApproval: true, // always true — see invariant above
  feasibilityEnabled: true,
  feasibilityBlocksApproval: false,
  feasibilityMinScore: 65,
  feasibilityCustomRules: [],
  stalledProjectDays: 60,
  overBudgetThresholdPct: 5,
  scheduleSlipDays: 30,
  lowArvCoverageThreshold: 0.9,
  contractorLicenseExpiryWarningDays: 30,
  aiMonitoringEnabled: true,
  aiDrawAnomalyDetection: true,
  aiCompletionForecastingEnabled: true,
  aiServicingEnabled: true,
  interestReserveWarningDays: 30,
  maturityWarningDays: 60,
  autoGenerateStatusReports: true,
  statusReportFrequencyDays: 30,
};

// ─── ConstructionConfigService ────────────────────────────────────────────────

export class ConstructionConfigService {
  private readonly logger = new Logger('ConstructionConfigService');

  constructor(private readonly cosmosService: CosmosDbService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private configDocId(tenantId: string): string {
    return `config-${tenantId}`;
  }

  /**
   * Enforces the retainageReleaseRequiresHumanApproval invariant.
   * Logs a warning if the incoming payload attempted to set it to false.
   */
  private enforceInvariants(config: TenantConstructionConfig): TenantConstructionConfig {
    if (config.retainageReleaseRequiresHumanApproval !== true) {
      this.logger.warn(
        'retainageReleaseRequiresHumanApproval was set to a non-true value in config payload; ' +
        'forcing back to true. This field is non-negotiable by platform design.',
        { tenantId: config.tenantId }
      );
    }
    return { ...config, retainageReleaseRequiresHumanApproval: true };
  }

  // ── getConfig ───────────────────────────────────────────────────────────────

  /**
   * Returns the TenantConstructionConfig for the given tenant.
   *
   * @throws if tenantId is empty
   * @throws if no config document exists for this tenant (NO auto-create)
   */
  async getConfig(tenantId: string): Promise<TenantConstructionConfig> {
    if (!tenantId) {
      throw new Error('ConstructionConfigService.getConfig: tenantId is required');
    }

    const config = await this.cosmosService.getDocument<TenantConstructionConfig>(
      CONTAINER,
      this.configDocId(tenantId),
      tenantId
    );

    if (!config) {
      throw new Error(
        `ConstructionConfigService.getConfig: no construction config found for tenant "${tenantId}". ` +
        'Call createConfig during tenant onboarding to provision a config document.'
      );
    }

    return config;
  }

  // ── createConfig ─────────────────────────────────────────────────────────────

  /**
   * Creates a new TenantConstructionConfig with documented defaults, applying any safe overrides.
   * Intended to be called once during tenant onboarding.
   *
   * retainageReleaseRequiresHumanApproval is always stored as true regardless of overrides.
   *
   * @throws if tenantId is empty
   */
  async createConfig(
    tenantId: string,
    createdBy: string,
    overrides: Partial<Omit<TenantConstructionConfig, 'tenantId' | 'updatedAt' | 'updatedBy'>> = {}
  ): Promise<TenantConstructionConfig> {
    if (!tenantId) {
      throw new Error('ConstructionConfigService.createConfig: tenantId is required');
    }

    const now = new Date().toISOString();
    const config: TenantConstructionConfig = this.enforceInvariants({
      ...CONFIG_DEFAULTS,
      ...overrides,
      tenantId,
      updatedAt: now,
      updatedBy: createdBy,
    });

    // Document ID is deterministic — set it explicitly so Cosmos uses it as the item id
    const doc = { ...config, id: this.configDocId(tenantId) };

    const created = await this.cosmosService.createDocument<TenantConstructionConfig>(CONTAINER, doc);

    this.logger.info('TenantConstructionConfig created', { tenantId, createdBy });
    return created;
  }

  // ── updateConfig ─────────────────────────────────────────────────────────────

  /**
   * Applies partial updates to an existing TenantConstructionConfig.
   * Fetches the current document, merges updates, enforces invariants, and upserts.
   *
   * retainageReleaseRequiresHumanApproval is always preserved as true.
   *
   * @throws if tenantId is empty
   * @throws if no config document exists for this tenant (NO auto-create)
   */
  async updateConfig(
    tenantId: string,
    updates: Partial<Omit<TenantConstructionConfig, 'tenantId'>>,
    updatedBy: string
  ): Promise<TenantConstructionConfig> {
    const existing = await this.getConfig(tenantId); // throws if not found

    const updated: TenantConstructionConfig = this.enforceInvariants({
      ...existing,
      ...updates,
      tenantId,                          // partition key — must not be overwritten
      updatedAt: new Date().toISOString(),
      updatedBy,
    });

    const result = await this.cosmosService.upsertDocument<TenantConstructionConfig>(CONTAINER, updated);

    this.logger.info('TenantConstructionConfig updated', { tenantId, updatedBy });
    return result;
  }
}
