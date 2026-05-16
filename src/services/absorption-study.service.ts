/**
 * Absorption Study Service
 *
 * Orchestrates new-construction sellout analysis by pulling MLS comps from
 * Bridge Interactive and deriving base / upside / downside absorption
 * scenarios.  Persists AbsorptionStudyOrder documents in Cosmos DB.
 *
 * Container: absorption-study-orders / partition key: /tenantId
 */

import type { Container } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service.js';
import { BridgeInteractiveService } from './bridge-interactive.service.js';
import type {
  AbsorptionStudyOrder,
  AbsorptionStudyStatus,
  AbsorptionScenario,
  AbsorptionComparable,
  CreateAbsorptionStudyRequest,
  UpdateAbsorptionStudyRequest,
} from '../types/absorption-study.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AbsorptionStudyService');

const CONTAINER = 'absorption-study-orders';

function now(): string {
  return new Date().toISOString();
}

function generateOrderId(): string {
  return `abs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Service singleton ─────────────────────────────────────────────────────────

let _instance: AbsorptionStudyService | null = null;

export function getAbsorptionStudyService(db: CosmosDbService): AbsorptionStudyService {
  if (!_instance) {
    _instance = new AbsorptionStudyService(db);
  }
  return _instance;
}

// ── Scenario derivation ───────────────────────────────────────────────────────

/**
 * Derive base / upside / downside scenarios from comparable project data.
 *
 * Logic mirrors the La Linda Surfside sample report (Vision VMC, 1/28/2026):
 *  - Base: uses median absorption from comps, typical presale fraction
 *  - Upside: best-quartile absorption, higher presale fraction
 *  - Downside: worst-quartile absorption, lower presale fraction
 */
function deriveScenarios(totalUnits: number, comps: AbsorptionComparable[]): AbsorptionScenario[] {
  // Collect sellout window months from comps that have data
  const windows = comps
    .map(c => c.totalSelloutMonths)
    .filter((m): m is number => typeof m === 'number' && m > 0);

  const presaleRatios = comps
    .map(c => c.presalePercent)
    .filter((r): r is number => typeof r === 'number' && r > 0);

  // Fall back to sensible market defaults if comp data is sparse
  const sortedWindows = windows.length > 0 ? [...windows].sort((a, b) => a - b) : [9, 12, 18];
  const sortedPresale = presaleRatios.length > 0
    ? [...presaleRatios].sort((a, b) => a - b)
    : [0.3, 0.5, 0.7];

  const p25 = (arr: number[]) => arr[Math.floor(arr.length * 0.25)] ?? arr[0]!;
  const p50 = (arr: number[]) => arr[Math.floor(arr.length * 0.5)] ?? arr[0]!;
  const p75 = (arr: number[]) => arr[Math.floor(arr.length * 0.75)] ?? arr[arr.length - 1]!;

  const buildScenario = (
    tier: AbsorptionScenario['tier'],
    label: string,
    description: string,
    presaleRatio: number,
    totalMonths: number,
    keyAssumptions: string[],
    riskFactors?: string[],
  ): AbsorptionScenario => {
    const presaleUnits = Math.round(totalUnits * presaleRatio);
    const remaining = totalUnits - presaleUnits;
    const postCompletion = Math.max(1, totalMonths - Math.round(totalMonths * 0.3));
    return {
      tier,
      label,
      description,
      presaleUnits,
      presalePercent: presaleRatio,
      remainingUnitsAtCompletion: remaining,
      postCompletionMonths: postCompletion,
      totalSelloutWindowMonths: totalMonths,
      marketingTimePerUnit: `${Math.round(totalMonths / totalUnits * 4) / 4}–${Math.round((totalMonths * 1.2) / totalUnits * 4) / 4} months per unit`,
      keyAssumptions,
      ...(riskFactors !== undefined && { riskFactors }),
    };
  };

  return [
    buildScenario(
      'BASE',
      'Base Case',
      'Typical market absorption based on median comparable project performance.',
      p50(sortedPresale),
      p50(sortedWindows),
      [
        'Market conditions remain stable through sellout',
        'Pricing in line with confirmed comp range',
        'No material change in interest rate environment',
      ],
    ),
    buildScenario(
      'UPSIDE',
      'Upside Case',
      'Accelerated absorption assuming strong pre-launch demand and favorable market tailwinds.',
      p75(sortedPresale),
      p25(sortedWindows),
      [
        'Above-average pre-construction contract activity',
        'Interest rate environment improves or holds',
        'Amenity package resonates strongly with target buyer demographic',
      ],
    ),
    buildScenario(
      'DOWNSIDE',
      'Downside Case',
      'Slower sellout reflecting thin buyer pool, increased competition, or market softening.',
      p25(sortedPresale),
      p75(sortedWindows),
      [
        'Limited presales — project enters market primarily post-completion',
        'Interest rate headwinds compress buyer purchasing power',
        'Competing supply enters the submarket during sellout window',
      ],
      [
        'Extended marketing period may require price reductions',
        'Developer carry costs increase with prolonged sellout',
      ],
    ),
  ];
}

// ── Service ───────────────────────────────────────────────────────────────────

export class AbsorptionStudyService {
  private readonly container: Container;
  private readonly bridge: BridgeInteractiveService;

  constructor(private readonly db: CosmosDbService) {
    this.container = db.getContainer(CONTAINER);
    this.bridge = new BridgeInteractiveService();
  }

  // ── Create order ─────────────────────────────────────────────────────────

  async createOrder(
    request: CreateAbsorptionStudyRequest,
    tenantId: string,
    createdBy: string,
  ): Promise<AbsorptionStudyOrder> {
    const order: AbsorptionStudyOrder = {
      id: generateOrderId(),
      productType: 'ABSORPTION_STUDY',
      status: 'DRAFT',
      tenantId,
      ...(request.engagementId !== undefined && { engagementId: request.engagementId }),
      ...(request.clientOrderId !== undefined && { clientOrderId: request.clientOrderId }),
      ...(request.clientName !== undefined && { clientName: request.clientName }),
      ...(request.developerName !== undefined && { developerName: request.developerName }),
      ...(request.projectName !== undefined && { projectName: request.projectName }),
      ...(request.linkedAppraisalOrderId !== undefined && {
        linkedAppraisalOrderId: request.linkedAppraisalOrderId,
      }),
      ...(request.anticipatedCompletionDate !== undefined && {
        anticipatedCompletionDate: request.anticipatedCompletionDate,
      }),
      ...(request.indicativePricePerSqFt !== undefined && {
        indicativePricePerSqFt: request.indicativePricePerSqFt,
      }),
      subjectAddress: request.subjectAddress,
      subjectCity: request.subjectCity,
      subjectState: request.subjectState,
      subjectPostalCode: request.subjectPostalCode,
      projectStage: request.projectStage,
      totalUnits: request.totalUnits,
      unitMix: request.unitMix,
      compSearchRadiusMiles: request.compSearchRadiusMiles ?? 1,
      compSoldWithinDays: request.compSoldWithinDays ?? 365,
      scenarios: [],
      comparables: [],
      createdBy,
      createdAt: now(),
      updatedAt: now(),
    };

    const { resource } = await this.container.items.create(order);
    if (!resource) {
      throw new Error(`Failed to create absorption study order for tenant ${tenantId}`);
    }

    logger.info('Absorption study order created', { orderId: order.id, tenantId });
    return resource as AbsorptionStudyOrder;
  }

  // ── Run analysis ──────────────────────────────────────────────────────────

  async analyze(orderId: string, tenantId: string): Promise<AbsorptionStudyOrder> {
    const order = await this.getOrder(orderId, tenantId);
    if (!order) {
      throw new Error(`Absorption study order ${orderId} not found for tenant ${tenantId}`);
    }

    const lat = order.subjectLatitude;
    const lng = order.subjectLongitude;

    if (!lat || !lng) {
      throw new Error(
        `Cannot analyze order ${orderId}: subjectLatitude and subjectLongitude are required. ` +
        'Update the order with geocoded coordinates before running analysis.',
      );
    }

    logger.info('Starting absorption study analysis', { orderId, lat, lng });

    // ── Pull MLS comps from Bridge Interactive ────────────────────────────────
    let comparables: AbsorptionComparable[] = [];
    try {
      const bridgeResult = await this.bridge.getSoldComps({
        latitude: lat,
        longitude: lng,
        radiusMiles: order.compSearchRadiusMiles,
        soldWithinDays: order.compSoldWithinDays,
        limit: 20,
      });

      comparables = (bridgeResult?.value ?? []).map((listing: any): AbsorptionComparable => ({
        address: listing.UnparsedAddress ?? '',
        city: listing.City ?? '',
        state: listing.StateOrProvince ?? '',
        postalCode: listing.PostalCode ?? '',
        latitude: listing.Coordinates?.[1],
        longitude: listing.Coordinates?.[0],
        unitCount: 1,                        // MLS "project" — single unit sold
        priceRangeMin: listing.ClosePrice,
        priceRangeMax: listing.ClosePrice,
        ...(listing.LivingArea > 0 && {
          pricePerSqFtMin: Math.round(listing.ClosePrice / listing.LivingArea),
          pricePerSqFtMax: Math.round(listing.ClosePrice / listing.LivingArea),
        }),
        saleDate: listing.CloseDate,
        dataSource: 'Bridge Interactive',
        ...(listing.ListingId ? { mlsListingIds: [listing.ListingId] } : {}),
      }));

      logger.info('Bridge Interactive comps retrieved', {
        orderId,
        compsCount: comparables.length,
      });
    } catch (err) {
      logger.warn('Bridge Interactive comp pull failed — proceeding with empty comp set', {
        orderId,
        error: err,
      });
    }

    // ── Derive scenarios from comp data ───────────────────────────────────────
    const scenarios = deriveScenarios(order.totalUnits, comparables);

    const updated: AbsorptionStudyOrder = {
      ...order,
      status: 'ANALYST_REVIEW',
      comparables,
      scenarios,
      updatedAt: now(),
    };

    const { resource } = await this.container.items.upsert(updated);
    if (!resource) {
      throw new Error(`Failed to persist analyzed absorption study order ${orderId}`);
    }

    logger.info('Absorption study analysis complete', {
      orderId,
      compsCount: comparables.length,
      scenariosCount: scenarios.length,
    });

    return resource as unknown as AbsorptionStudyOrder;
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  async getOrder(orderId: string, tenantId: string): Promise<AbsorptionStudyOrder | null> {
    const { resource } = await this.container.item(orderId, tenantId).read<AbsorptionStudyOrder>();
    if (!resource) return null;
    if (resource.tenantId !== tenantId) {
      throw new Error(`Order ${orderId} does not belong to tenant ${tenantId}`);
    }
    return resource;
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listOrders(tenantId: string, status?: AbsorptionStudyStatus): Promise<AbsorptionStudyOrder[]> {
    const query = status
      ? 'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.status = @status ORDER BY c.createdAt DESC'
      : 'SELECT * FROM c WHERE c.tenantId = @tenantId ORDER BY c.createdAt DESC';

    const parameters = status
      ? [{ name: '@tenantId', value: tenantId }, { name: '@status', value: status }]
      : [{ name: '@tenantId', value: tenantId }];

    const { resources } = await this.container.items
      .query<AbsorptionStudyOrder>({ query, parameters })
      .fetchAll();

    return resources;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateOrder(
    orderId: string,
    tenantId: string,
    updates: UpdateAbsorptionStudyRequest,
  ): Promise<AbsorptionStudyOrder> {
    const existing = await this.getOrder(orderId, tenantId);
    if (!existing) {
      throw new Error(`Absorption study order ${orderId} not found for tenant ${tenantId}`);
    }

    const updated: AbsorptionStudyOrder = {
      ...existing,
      ...updates,
      id: existing.id,
      productType: existing.productType,
      tenantId: existing.tenantId,
      updatedAt: now(),
    };

    const { resource } = await this.container.items.upsert(updated);
    if (!resource) {
      throw new Error(`Failed to update absorption study order ${orderId}`);
    }

    return resource as unknown as AbsorptionStudyOrder;
  }
}
