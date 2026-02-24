/**
 * ARV (As-Repaired Value) Service
 *
 * Manages CRUD for ArvAnalysis documents in Cosmos DB and orchestrates
 * calls to the pure ARV/deal-metrics engine functions.
 *
 * Partition key for arv-analyses: /tenantId
 */

import type { Container } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service.js';
import { calculateArv, calculateDealMetrics } from './arv-engine.service.js';
import type {
  ArvAnalysis,
  ArvStatus,
  DealType,
  CreateArvRequest,
  UpdateArvRequest,
  ArvEngineInput,
  DealMetricsInput,
} from '../types/arv.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

// ─── ID helper ────────────────────────────────────────────────────────────────

function generateArvId(): string {
  return `arv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ArvService {
  private readonly container: Container;

  constructor(private readonly dbService: CosmosDbService) {
    this.container = dbService.getArvAnalysesContainer();
  }

  // ── Create draft ──────────────────────────────────────────────────────────

  async createAnalysis(request: CreateArvRequest, tenantId: string, createdBy: string): Promise<ArvAnalysis> {
    const draft: ArvAnalysis = {
      id: generateArvId(),
      tenantId,
      ...(request.orderId !== undefined && { orderId: request.orderId }),
      dealType: request.dealType,
      mode: request.mode,
      status: 'DRAFT',
      propertyAddress: request.propertyAddress,
      asIsValue: request.asIsValue,
      asIsSource: request.asIsSource,
      scopeOfWork: request.scopeOfWork ?? [],
      comps: request.comps ?? [],
      // Zeroed-out engine outputs until calculateAndPersist() is called
      arvEstimate: 0,
      confidenceLow: 0,
      confidenceHigh: 0,
      totalRehabCost: 0,
      netValueAdd: 0,
      dealAnalysis: request.dealAnalysis ?? {},
      ...(request.notes !== undefined && { notes: request.notes }),
      createdBy,
      createdAt: now(),
      updatedAt: now(),
    };

    const { resource } = await this.container.items.create(draft);
    if (!resource) {
      throw new Error(`Failed to persist ARV analysis for tenant ${tenantId}`);
    }

    logger.info('ARV analysis draft created', { arvId: draft.id, tenantId, dealType: draft.dealType });
    return resource as ArvAnalysis;
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  async getAnalysis(id: string, tenantId: string): Promise<ArvAnalysis | null> {
    const { resource } = await this.container.item(id, tenantId).read<ArvAnalysis>();
    if (!resource) return null;
    if (resource.tenantId !== tenantId) {
      throw new Error(`ARV analysis ${id} does not belong to tenant ${tenantId}`);
    }
    return resource;
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listAnalyses(
    tenantId: string,
    filters?: { orderId?: string; dealType?: DealType; status?: ArvStatus },
  ): Promise<ArvAnalysis[]> {
    let query = 'SELECT * FROM c WHERE c.tenantId = @tenantId';
    const parameters: import('@azure/cosmos').SqlParameter[] = [
      { name: '@tenantId', value: tenantId },
    ];

    if (filters?.orderId) {
      query += ' AND c.orderId = @orderId';
      parameters.push({ name: '@orderId', value: filters.orderId });
    }
    if (filters?.dealType) {
      query += ' AND c.dealType = @dealType';
      parameters.push({ name: '@dealType', value: filters.dealType });
    }
    if (filters?.status) {
      query += ' AND c.status = @status';
      parameters.push({ name: '@status', value: filters.status });
    }

    query += ' ORDER BY c.createdAt DESC';

    const { resources } = await this.container.items
      .query<ArvAnalysis>({ query, parameters })
      .fetchAll();
    return resources;
  }

  // ── Get by orderId ─────────────────────────────────────────────────────────

  async getByOrderId(orderId: string, tenantId: string): Promise<ArvAnalysis[]> {
    return this.listAnalyses(tenantId, { orderId });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateAnalysis(
    id: string,
    tenantId: string,
    updates: UpdateArvRequest,
  ): Promise<ArvAnalysis> {
    const existing = await this.getAnalysis(id, tenantId);
    if (!existing) {
      throw new Error(`ARV analysis ${id} not found for tenant ${tenantId}`);
    }

    const updated: ArvAnalysis = {
      ...existing,
      ...(updates.dealType !== undefined && { dealType: updates.dealType }),
      ...(updates.mode !== undefined && { mode: updates.mode }),
      ...(updates.propertyAddress !== undefined && { propertyAddress: updates.propertyAddress }),
      ...(updates.asIsValue !== undefined && { asIsValue: updates.asIsValue }),
      ...(updates.asIsSource !== undefined && { asIsSource: updates.asIsSource }),
      ...(updates.scopeOfWork !== undefined && { scopeOfWork: updates.scopeOfWork }),
      ...(updates.comps !== undefined && { comps: updates.comps }),
      ...(updates.dealAnalysis !== undefined && {
        dealAnalysis: { ...existing.dealAnalysis, ...updates.dealAnalysis },
      }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.status !== undefined && { status: updates.status }),
      updatedAt: now(),
    };

    const { resource } = await this.container.item(id, tenantId).replace(updated);
    if (!resource) {
      throw new Error(`Failed to update ARV analysis ${id}`);
    }

    return resource as ArvAnalysis;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteAnalysis(id: string, tenantId: string): Promise<void> {
    const existing = await this.getAnalysis(id, tenantId);
    if (!existing) {
      throw new Error(`ARV analysis ${id} not found for tenant ${tenantId}`);
    }
    if (existing.status !== 'DRAFT') {
      throw new Error(
        `ARV analysis ${id} has status '${existing.status}' — only DRAFT analyses can be deleted`,
      );
    }
    await this.container.item(id, tenantId).delete();
    logger.info('ARV analysis deleted', { arvId: id, tenantId });
  }

  // ── Calculate + persist ────────────────────────────────────────────────────

  /**
   * Runs the ARV engine against the stored comps/SOW, then persists the results.
   * Also re-runs deal metrics using any deal-analysis inputs already on the document.
   */
  async calculateAndPersist(id: string, tenantId: string, dealParams?: Partial<DealMetricsInput>): Promise<ArvAnalysis> {
    const existing = await this.getAnalysis(id, tenantId);
    if (!existing) {
      throw new Error(`ARV analysis ${id} not found for tenant ${tenantId}`);
    }

    const engineInput: ArvEngineInput = {
      mode: existing.mode,
      asIsValue: existing.asIsValue,
      scopeOfWork: existing.scopeOfWork,
      comps: existing.comps,
    };

    const engineResult = calculateArv(engineInput);

    const acq = dealParams?.acquisitionCost ?? existing.dealAnalysis.maxAllowableOffer;
    const closing = dealParams?.closingCosts;
    const ltv = dealParams?.ltvPercent ?? existing.dealAnalysis.ltvPercent;
    const flip = dealParams?.flipRatio ?? existing.dealAnalysis.flipRatio;
    const rent = dealParams?.monthlyRent ?? existing.dealAnalysis.monthlyRent;
    const opex = dealParams?.operatingExpenseRatio ?? existing.dealAnalysis.operatingExpenseRatio;
    const debtSvc = dealParams?.annualDebtService ?? existing.dealAnalysis.annualDebtService;
    const cashIn = dealParams?.totalCashInvested;

    const metricsInput: DealMetricsInput = {
      arv: engineResult.arvEstimate,
      totalRehabCost: engineResult.totalRehabCost,
      dealType: existing.dealType,
      ...(acq !== undefined && { acquisitionCost: acq }),
      ...(closing !== undefined && { closingCosts: closing }),
      ...(ltv !== undefined && { ltvPercent: ltv }),
      ...(flip !== undefined && { flipRatio: flip }),
      ...(rent !== undefined && { monthlyRent: rent }),
      ...(opex !== undefined && { operatingExpenseRatio: opex }),
      ...(debtSvc !== undefined && { annualDebtService: debtSvc }),
      ...(cashIn !== undefined && { totalCashInvested: cashIn }),
    };

    const dealAnalysis = calculateDealMetrics(metricsInput);

    const updated: ArvAnalysis = {
      ...existing,
      arvEstimate: engineResult.arvEstimate,
      confidenceLow: engineResult.confidenceLow,
      confidenceHigh: engineResult.confidenceHigh,
      totalRehabCost: engineResult.totalRehabCost,
      netValueAdd: engineResult.netValueAdd,
      highDivergenceWarning: engineResult.highDivergenceWarning,
      divergencePct: engineResult.divergencePct,
      dealAnalysis,
      updatedAt: now(),
    };

    const { resource } = await this.container.item(id, tenantId).replace(updated);
    if (!resource) {
      throw new Error(`Failed to persist ARV calculation results for analysis ${id}`);
    }

    logger.info('ARV calculation persisted', {
      arvId: id,
      arvEstimate: engineResult.arvEstimate,
      divergenceWarning: engineResult.highDivergenceWarning,
    });
    return resource as ArvAnalysis;
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  /**
   * Transitions status → COMPLETE (analyst has reviewed and accepted the results).
   */
  async completeAnalysis(id: string, tenantId: string): Promise<ArvAnalysis> {
    const existing = await this.getAnalysis(id, tenantId);
    if (!existing) {
      throw new Error(`ARV analysis ${id} not found for tenant ${tenantId}`);
    }
    if (existing.arvEstimate === 0) {
      throw new Error(
        `ARV analysis ${id} has not been calculated yet — run /calculate before completing`,
      );
    }

    const updated: ArvAnalysis = {
      ...existing,
      status: 'COMPLETE',
      updatedAt: now(),
    };

    const { resource } = await this.container.item(id, tenantId).replace(updated);
    if (!resource) {
      throw new Error(`Failed to complete ARV analysis ${id}`);
    }

    logger.info('ARV analysis completed', { arvId: id, tenantId });
    return resource as ArvAnalysis;
  }
}
