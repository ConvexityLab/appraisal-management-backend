/**
 * Archiving & Retention Service (Phase 1.10)
 *
 * Manages appraisal report archiving and retention policy enforcement.
 * Per USPAP Advisory Opinions and master process requirements:
 *  - 5-year minimum retention for workfiles
 *  - 7-year recommended retention for regulated lending
 *  - Automatic archive on delivery + configurable retention window
 *  - Purge eligibility check (never auto-deletes — flags for manual review)
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type RetentionPolicyType = 'USPAP_5_YEAR' | 'REGULATORY_7_YEAR' | 'CUSTOM';
export type ArchiveStatus = 'PENDING' | 'ARCHIVED' | 'RETENTION_HOLD' | 'PURGE_ELIGIBLE' | 'PURGED';

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  policyType: RetentionPolicyType;
  /** Retention period in years */
  retentionYears: number;
  /** Whether archiving happens automatically upon delivery */
  autoArchiveOnDelivery: boolean;
  /** Product types this policy applies to (empty = all) */
  applicableProductTypes?: string[];
  /** Client IDs this policy applies to (empty = all) */
  applicableClientIds?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ArchiveRecord {
  id: string;
  orderId: string;
  tenantId: string;
  /** Applied retention policy */
  policyId: string;
  policyName: string;
  status: ArchiveStatus;
  /** When the order was delivered */
  deliveredAt: string;
  /** When the archive record was created */
  archivedAt: string;
  /** When retention expires and record becomes purge-eligible */
  retentionExpiresAt: string;
  /** Blob storage reference for archived report */
  archiveLocation?: string;
  /** Size in bytes of archived package */
  archiveSizeBytes?: number;
  /** Who initiated the archive */
  archivedBy: string;
  /** If purged, when and by whom */
  purgedAt?: string;
  purgedBy?: string;
  /** Optional legal hold — prevents purge even after retention expires */
  legalHold: boolean;
  legalHoldReason?: string;
  notes?: string;
}

export interface RetentionSummary {
  tenantId: string;
  totalArchived: number;
  retentionHold: number;
  purgeEligible: number;
  purged: number;
  /** Breakdown by policy */
  byPolicy: Array<{
    policyId: string;
    policyName: string;
    count: number;
  }>;
  generatedAt: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class ArchivingRetentionService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('ArchivingRetentionService');
  }

  // ── Retention Policy CRUD ──────────────────────────────────────────────────

  async createPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<RetentionPolicy> {
    if (policy.retentionYears < 1) {
      throw new Error(`Invalid retention period: ${policy.retentionYears} years. Minimum is 1 year.`);
    }
    const now = new Date().toISOString();
    const record: RetentionPolicy = {
      ...policy,
      id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };

    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database container not initialized');
    await container.items.upsert({ ...record, type: 'retention-policy' });

    this.logger.info('Retention policy created', { id: record.id, name: record.name, retentionYears: record.retentionYears });
    return record;
  }

  async updatePolicy(policyId: string, tenantId: string, updates: Partial<Pick<RetentionPolicy, 'name' | 'description' | 'retentionYears' | 'isActive' | 'autoArchiveOnDelivery' | 'applicableProductTypes' | 'applicableClientIds'>>): Promise<RetentionPolicy> {
    const existing = await this.getPolicy(policyId, tenantId);
    if (!existing) throw new Error(`Retention policy not found: ${policyId}`);

    if (updates.retentionYears !== undefined && updates.retentionYears < 1) {
      throw new Error(`Invalid retention period: ${updates.retentionYears} years. Minimum is 1 year.`);
    }

    const updated: RetentionPolicy = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database container not initialized');
    await container.items.upsert({ ...updated, type: 'retention-policy' });

    this.logger.info('Retention policy updated', { id: policyId });
    return updated;
  }

  async getPolicy(policyId: string, tenantId: string): Promise<RetentionPolicy | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'retention-policy' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: policyId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources.length > 0 ? resources[0] as RetentionPolicy : null;
  }

  async getPolicies(tenantId: string, activeOnly = true): Promise<RetentionPolicy[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const activeFilter = activeOnly ? ' AND c.isActive = true' : '';
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'retention-policy' AND c.tenantId = @tid${activeFilter} ORDER BY c.createdAt DESC`,
      parameters: [{ name: '@tid', value: tenantId }],
    }).fetchAll();

    return resources as RetentionPolicy[];
  }

  async deletePolicy(policyId: string, tenantId: string): Promise<void> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database container not initialized');

    try {
      await container.item(policyId, tenantId).delete();
      this.logger.info('Retention policy deleted', { id: policyId });
    } catch {
      this.logger.warn('Policy not found for deletion', { id: policyId });
    }
  }

  // ── Archive Operations ─────────────────────────────────────────────────────

  /**
   * Archive an order — applies the best-matching retention policy and creates
   * an archive record.
   */
  async archiveOrder(
    orderId: string,
    tenantId: string,
    deliveredAt: string,
    archivedBy: string,
    opts?: { productType?: string; clientId?: string; archiveLocation?: string; archiveSizeBytes?: number },
  ): Promise<ArchiveRecord> {
    const policies = await this.getPolicies(tenantId);
    const policy = this.selectPolicy(policies, opts?.productType, opts?.clientId);

    if (!policy) {
      throw new Error(`No active retention policy found for tenant ${tenantId}. Create a policy before archiving.`);
    }

    const deliveryDate = new Date(deliveredAt);
    const expiresAt = new Date(deliveryDate);
    expiresAt.setFullYear(expiresAt.getFullYear() + policy.retentionYears);

    const record: ArchiveRecord = {
      id: `arc-${orderId}-${Date.now()}`,
      orderId,
      tenantId,
      policyId: policy.id,
      policyName: policy.name,
      status: 'ARCHIVED',
      deliveredAt,
      archivedAt: new Date().toISOString(),
      retentionExpiresAt: expiresAt.toISOString(),
      archivedBy,
      legalHold: false,
      ...(opts?.archiveLocation !== undefined && { archiveLocation: opts.archiveLocation }),
      ...(opts?.archiveSizeBytes !== undefined && { archiveSizeBytes: opts.archiveSizeBytes }),
    };

    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database container not initialized');
    await container.items.upsert({ ...record, type: 'archive-record' });

    this.logger.info('Order archived', { orderId, policyId: policy.id, retentionExpiresAt: record.retentionExpiresAt });
    return record;
  }

  /**
   * Get the archive record for an order.
   */
  async getArchiveRecord(orderId: string, tenantId: string): Promise<ArchiveRecord | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'archive-record' AND c.orderId = @oid AND c.tenantId = @tid`,
      parameters: [
        { name: '@oid', value: orderId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources.length > 0 ? resources[0] as ArchiveRecord : null;
  }

  /**
   * Scan all archived records and flag those past their retention expiry as purge-eligible.
   * Records with legal holds are not flagged.
   */
  async scanForPurgeEligible(tenantId: string): Promise<ArchiveRecord[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const now = new Date().toISOString();
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'archive-record' AND c.tenantId = @tid AND c.status = 'ARCHIVED' AND c.retentionExpiresAt < @now AND c.legalHold = false`,
      parameters: [
        { name: '@tid', value: tenantId },
        { name: '@now', value: now },
      ],
    }).fetchAll();

    const flagged: ArchiveRecord[] = [];
    for (const rec of resources) {
      const record = rec as ArchiveRecord;
      record.status = 'PURGE_ELIGIBLE';
      await container.items.upsert({ ...record, type: 'archive-record' });
      flagged.push(record);
    }

    if (flagged.length > 0) {
      this.logger.info('Flagged records as purge-eligible', { count: flagged.length, tenantId });
    }

    return flagged;
  }

  /**
   * Set a legal hold on an archive record (prevents purge).
   */
  async setLegalHold(orderId: string, tenantId: string, hold: boolean, reason?: string): Promise<ArchiveRecord> {
    const record = await this.getArchiveRecord(orderId, tenantId);
    if (!record) throw new Error(`Archive record not found for order: ${orderId}`);

    record.legalHold = hold;
    // exactOptionalPropertyTypes: cannot assign `undefined` to optional field — use delete instead
    if (hold && reason !== undefined) {
      record.legalHoldReason = reason;
    } else {
      delete (record as { legalHoldReason?: string }).legalHoldReason;
    }
    if (hold && record.status === 'PURGE_ELIGIBLE') {
      record.status = 'RETENTION_HOLD';
    }

    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database container not initialized');
    await container.items.upsert({ ...record, type: 'archive-record' });

    this.logger.info('Legal hold updated', { orderId, hold, reason });
    return record;
  }

  /**
   * Generate a retention summary for a tenant.
   */
  async getRetentionSummary(tenantId: string): Promise<RetentionSummary> {
    const container = (this.dbService as any).ordersContainer;
    const empty: RetentionSummary = {
      tenantId,
      totalArchived: 0,
      retentionHold: 0,
      purgeEligible: 0,
      purged: 0,
      byPolicy: [],
      generatedAt: new Date().toISOString(),
    };
    if (!container) return empty;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'archive-record' AND c.tenantId = @tid`,
      parameters: [{ name: '@tid', value: tenantId }],
    }).fetchAll();

    const records = resources as ArchiveRecord[];
    const byPolicy = new Map<string, { policyId: string; policyName: string; count: number }>();

    for (const rec of records) {
      const key = rec.policyId;
      const entry = byPolicy.get(key) ?? { policyId: rec.policyId, policyName: rec.policyName, count: 0 };
      entry.count++;
      byPolicy.set(key, entry);
    }

    return {
      tenantId,
      totalArchived: records.filter(r => r.status === 'ARCHIVED').length,
      retentionHold: records.filter(r => r.status === 'RETENTION_HOLD').length,
      purgeEligible: records.filter(r => r.status === 'PURGE_ELIGIBLE').length,
      purged: records.filter(r => r.status === 'PURGED').length,
      byPolicy: Array.from(byPolicy.values()),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Select the best-matching policy for an order. Prefers policies matching
   * the specific product type or client, falling back to the broadest policy.
   */
  private selectPolicy(
    policies: RetentionPolicy[],
    productType?: string,
    clientId?: string,
  ): RetentionPolicy | null {
    if (policies.length === 0) return null;

    // Try client-specific + product-specific
    if (clientId && productType) {
      const match = policies.find(
        p => p.applicableClientIds?.includes(clientId) && p.applicableProductTypes?.includes(productType),
      );
      if (match) return match;
    }
    // Try client-specific
    if (clientId) {
      const match = policies.find(p => p.applicableClientIds?.includes(clientId));
      if (match) return match;
    }
    // Try product-specific
    if (productType) {
      const match = policies.find(p => p.applicableProductTypes?.includes(productType));
      if (match) return match;
    }
    // Fall back to global policy (no restrictions)
    return policies.find(
      p => (!p.applicableClientIds || p.applicableClientIds.length === 0) &&
           (!p.applicableProductTypes || p.applicableProductTypes.length === 0),
    ) ?? policies[0]!;
  }
}
