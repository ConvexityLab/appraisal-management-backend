/**
 * Client Configuration Service (Phase 1.3)
 *
 * Manages per-client configuration overrides: SLA terms, fee schedules,
 * delivery format preferences, ROV policy, waiver preferences, and
 * product-specific settings.
 *
 * These configs layer on top of global Product defaults. When a client
 * config exists, it overrides the product-level defaults for orders
 * placed by that client.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { ClientReportBranding } from '@l1/shared-types';

// ── Types ────────────────────────────────────────────────────────────────────

export type DeliveryFormat = 'PDF' | 'MISMO_XML' | 'PDF_AND_XML' | 'ENV_FILE';
export type ROVPolicy = 'STANDARD' | 'ENHANCED' | 'RESTRICTED' | 'CUSTOM';

export interface ClientFeeSchedule {
  /** Product type → fee override */
  productFees: Record<string, {
    baseFee: number;
    rushFeeMultiplier?: number;
    techFee?: number;
    complexityMultiplier?: number;
  }>;
  /** Default fee if no product-specific override */
  defaultBaseFee?: number;
  /** Volume discount tiers */
  volumeDiscounts?: Array<{
    minOrdersPerMonth: number;
    discountPercent: number;
  }>;
}

export interface ClientSLAConfig {
  /** Product type → turn time override (days) */
  productTurnTimes: Record<string, {
    standardDays: number;
    rushDays?: number;
  }>;
  /** Default turn time if no product-specific override */
  defaultTurnTimeDays?: number;
  /** Escalation hours before SLA breach for auto-notification */
  escalationWarningHours?: number;
  /** Whether to auto-reassign on SLA breach */
  autoReassignOnBreach?: boolean;
}

export interface ClientDeliveryConfig {
  /** Preferred delivery format */
  preferredFormat: DeliveryFormat;
  /** Whether UCDP/EAD submission is required */
  requireGSESubmission: boolean;
  /** Required GSE portal(s) */
  gsePortals?: Array<'UCDP' | 'EAD'>;
  /** Whether to include XML with PDF deliveries */
  includeXMLWithPDF?: boolean;
  /** Custom delivery instructions */
  deliveryInstructions?: string;
}

export interface ClientROVConfig {
  /** ROV policy level */
  policy: ROVPolicy;
  /** Maximum re-evaluation attempts before escalation */
  maxROVAttempts: number;
  /** Custom ROV instructions */
  instructions?: string;
  /** Days allowed for ROV response */
  responseDays: number;
}

export interface ClientWaiverConfig {
  /** Whether PIW/ACE waivers are accepted */
  acceptWaivers: boolean;
  /** Accepted waiver programs */
  acceptedPrograms?: string[];
  /** LTV threshold override for waiver eligibility */
  maxLTV?: number;
  /** Max loan amount for waiver eligibility */
  maxLoanAmount?: number;
  /** States excluded from waiver eligibility */
  excludedStates?: string[];
}

export interface BlockedAppraiserEntry {
  /** Vendor/appraiser ID to block */
  vendorId: string;
  /** Human name for display */
  vendorName: string;
  /** Why blocked */
  reason: string;
  /** Who added the block */
  addedBy: string;
  /** When added */
  addedAt: string;
  /** Optional expiry — if omitted, block is permanent */
  expiresAt?: string;
}

export interface ClientMatchingCriteria {
  /** Appraisers blocked for this client */
  blockedAppraisers: BlockedAppraiserEntry[];
  /** Geographic restrictions — states where this client cannot operate */
  excludedStates?: string[];
  /** Required certifications for vendors (e.g., 'Certified General', 'Licensed Residential') */
  requiredCertifications?: string[];
  /** Minimum vendor tier for assignment */
  minimumVendorTier?: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE';
  /** Maximum distance (miles) from subject property to vendor office */
  maxVendorDistanceMiles?: number;
}

export interface ClientConfiguration {
  id: string;
  clientId: string;
  tenantId: string;
  /** Human-readable name for this config set */
  configName: string;
  feeSchedule?: ClientFeeSchedule;
  slaConfig?: ClientSLAConfig;
  deliveryConfig?: ClientDeliveryConfig;
  rovConfig?: ClientROVConfig;
  waiverConfig?: ClientWaiverConfig;
  /** Matching criteria: blocked appraisers, geo restrictions, required certs */
  matchingCriteria?: ClientMatchingCriteria;
  /**
   * Report branding applied to all Handlebars-rendered reports for this client (R-21).
   * When present, values are injected into the Handlebars context under the `branding` key.
   */
  reportBranding?: ClientReportBranding;
  /** Custom fields for client-specific business rules */
  customFields?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface ResolvedOrderConfig {
  baseFee: number;
  rushFeeMultiplier: number;
  techFee: number;
  turnTimeDays: number;
  rushTurnTimeDays: number;
  deliveryFormat: DeliveryFormat;
  requireGSESubmission: boolean;
  rovPolicy: ROVPolicy;
  maxROVAttempts: number;
  acceptWaivers: boolean;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class ClientConfigurationService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('ClientConfigurationService');
  }

  /**
   * Create or update a client configuration.
   */
  async upsertConfiguration(config: Omit<ClientConfiguration, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ClientConfiguration> {
    const now = new Date().toISOString();
    const record: ClientConfiguration = {
      id: config.id ?? `ccfg-${config.clientId}-${Date.now()}`,
      clientId: config.clientId,
      tenantId: config.tenantId,
      configName: config.configName,
      isActive: config.isActive,
      createdAt: now,
      updatedAt: now,
      ...(config.feeSchedule !== undefined && { feeSchedule: config.feeSchedule }),
      ...(config.slaConfig !== undefined && { slaConfig: config.slaConfig }),
      ...(config.deliveryConfig !== undefined && { deliveryConfig: config.deliveryConfig }),
      ...(config.rovConfig !== undefined && { rovConfig: config.rovConfig }),
      ...(config.waiverConfig !== undefined && { waiverConfig: config.waiverConfig }),
      ...(config.matchingCriteria !== undefined && { matchingCriteria: config.matchingCriteria }),
      ...(config.reportBranding !== undefined && { reportBranding: config.reportBranding }),
      ...(config.customFields !== undefined && { customFields: config.customFields }),
      ...(config.createdBy !== undefined && { createdBy: config.createdBy }),
    };

    await this.saveConfig(record);
    this.logger.info('Client configuration upserted', { id: record.id, clientId: record.clientId });
    return record;
  }

  /**
   * Get the active configuration for a client.
   */
  async getActiveConfig(clientId: string, tenantId: string): Promise<ClientConfiguration | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'client-config' AND c.clientId = @cid AND c.tenantId = @tid AND c.isActive = true`,
      parameters: [
        { name: '@cid', value: clientId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources.length > 0 ? resources[0] as ClientConfiguration : null;
  }

  /**
   * Get all configurations for a client (active and inactive).
   */
  async getConfigHistory(clientId: string, tenantId: string): Promise<ClientConfiguration[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'client-config' AND c.clientId = @cid AND c.tenantId = @tid ORDER BY c.updatedAt DESC`,
      parameters: [
        { name: '@cid', value: clientId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources as ClientConfiguration[];
  }

  /**
   * Resolve effective order configuration by merging:
   *   Product defaults ← Client config overrides
   *
   * Returns a flat config object suitable for order creation.
   */
  async resolveOrderConfig(clientId: string, tenantId: string, productType: string): Promise<ResolvedOrderConfig> {
    // Load product defaults
    const product = await this.loadProduct(tenantId, productType);
    const clientConfig = await this.getActiveConfig(clientId, tenantId);

    // Start with product defaults
    const resolved: ResolvedOrderConfig = {
      baseFee: product?.defaultFee ?? 0,
      rushFeeMultiplier: product?.rushFeeMultiplier ?? 1.5,
      techFee: product?.techFee ?? 0,
      turnTimeDays: product?.turnTimeDays ?? 10,
      rushTurnTimeDays: product?.rushTurnTimeDays ?? 5,
      deliveryFormat: 'PDF' as DeliveryFormat,
      requireGSESubmission: false,
      rovPolicy: 'STANDARD' as ROVPolicy,
      maxROVAttempts: 2,
      acceptWaivers: false,
    };

    if (!clientConfig) return resolved;

    // Layer client fee overrides
    if (clientConfig.feeSchedule) {
      const productFee = clientConfig.feeSchedule.productFees[productType];
      if (productFee) {
        resolved.baseFee = productFee.baseFee;
        if (productFee.rushFeeMultiplier !== undefined) resolved.rushFeeMultiplier = productFee.rushFeeMultiplier;
        if (productFee.techFee !== undefined) resolved.techFee = productFee.techFee;
      } else if (clientConfig.feeSchedule.defaultBaseFee !== undefined) {
        resolved.baseFee = clientConfig.feeSchedule.defaultBaseFee;
      }
    }

    // Layer client SLA overrides
    if (clientConfig.slaConfig) {
      const productSLA = clientConfig.slaConfig.productTurnTimes[productType];
      if (productSLA) {
        resolved.turnTimeDays = productSLA.standardDays;
        if (productSLA.rushDays !== undefined) resolved.rushTurnTimeDays = productSLA.rushDays;
      } else if (clientConfig.slaConfig.defaultTurnTimeDays !== undefined) {
        resolved.turnTimeDays = clientConfig.slaConfig.defaultTurnTimeDays;
      }
    }

    // Layer delivery config
    if (clientConfig.deliveryConfig) {
      resolved.deliveryFormat = clientConfig.deliveryConfig.preferredFormat;
      resolved.requireGSESubmission = clientConfig.deliveryConfig.requireGSESubmission;
    }

    // Layer ROV config
    if (clientConfig.rovConfig) {
      resolved.rovPolicy = clientConfig.rovConfig.policy;
      resolved.maxROVAttempts = clientConfig.rovConfig.maxROVAttempts;
    }

    // Layer waiver config
    if (clientConfig.waiverConfig) {
      resolved.acceptWaivers = clientConfig.waiverConfig.acceptWaivers;
    }

    return resolved;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async loadProduct(tenantId: string, productType: string): Promise<any | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'product' AND c.tenantId = @tid AND c.productType = @pt AND c.isActive = true`,
      parameters: [
        { name: '@tid', value: tenantId },
        { name: '@pt', value: productType },
      ],
    }).fetchAll();

    return resources.length > 0 ? resources[0] : null;
  }

  private async saveConfig(config: ClientConfiguration): Promise<void> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      this.logger.warn('Cannot save client config — container not initialized');
      return;
    }
    await container.items.upsert({ ...config, type: 'client-config' });
  }
}
