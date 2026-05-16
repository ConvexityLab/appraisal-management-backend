/**
 * STR Feasibility Service
 *
 * Orchestrates Short-Term Rental feasibility analysis by calling AirROI,
 * AirDNA, live Airbnb comp, and STR regulation services; assembles and
 * persists a StrFeasibilityOrder in Cosmos DB.
 *
 * Container: str-feasibility-orders / partition key: /tenantId
 */

import type { Container } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service.js';
import { AirRoiService } from './airroi.service.js';
import { AirDnaService } from './airdna.service.js';
import { AirbnbCompService } from './airbnb-comp.service.js';
import { StrRegulationService } from './str-regulation.service.js';
import type {
  StrFeasibilityOrder,
  StrFeasibilityStatus,
  CreateStrFeasibilityRequest,
  UpdateStrFeasibilityRequest,
  StrProjection,
} from '../types/str-feasibility.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('StrFeasibilityService');

const CONTAINER = 'str-feasibility-orders';

function now(): string {
  return new Date().toISOString();
}

function generateOrderId(): string {
  return `str-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Service singleton ─────────────────────────────────────────────────────────

let _instance: StrFeasibilityService | null = null;

export function getStrFeasibilityService(db: CosmosDbService): StrFeasibilityService {
  if (!_instance) {
    _instance = new StrFeasibilityService(db);
  }
  return _instance;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class StrFeasibilityService {
  private readonly container: Container;
  private readonly airRoi: AirRoiService;
  private readonly airDna: AirDnaService;
  private readonly airbnbComp: AirbnbCompService;
  private readonly regulation: StrRegulationService;

  constructor(private readonly db: CosmosDbService) {
    this.container = db.getContainer(CONTAINER);
    this.airRoi = new AirRoiService();
    this.airDna = new AirDnaService();
    this.airbnbComp = new AirbnbCompService();
    this.regulation = new StrRegulationService(db);
  }

  // ── Create order ─────────────────────────────────────────────────────────

  async createOrder(
    request: CreateStrFeasibilityRequest,
    tenantId: string,
    createdBy: string,
  ): Promise<StrFeasibilityOrder> {
    const order: StrFeasibilityOrder = {
      id: generateOrderId(),
      productType: 'STR_FEASIBILITY',
      status: 'DRAFT',
      tenantId,
      ...(request.engagementId !== undefined && { engagementId: request.engagementId }),
      ...(request.clientOrderId !== undefined && { clientOrderId: request.clientOrderId }),
      ...(request.clientName !== undefined && { clientName: request.clientName }),
      ...(request.borrowerName !== undefined && { borrowerName: request.borrowerName }),
      ...(request.lenderLoanNumber !== undefined && { lenderLoanNumber: request.lenderLoanNumber }),
      subjectAddress: request.subjectAddress,
      subjectCity: request.subjectCity,
      subjectState: request.subjectState,
      subjectPostalCode: request.subjectPostalCode,
      subjectBedrooms: request.subjectBedrooms,
      subjectBathrooms: request.subjectBathrooms,
      ...(request.subjectSquareFeet !== undefined && { subjectSquareFeet: request.subjectSquareFeet }),
      ...(request.subjectYearBuilt !== undefined && { subjectYearBuilt: request.subjectYearBuilt }),
      ...(request.subjectPropertyType !== undefined && { subjectPropertyType: request.subjectPropertyType }),
      requestedDataSources: request.requestedDataSources ?? ['AirROI', 'AirDNA'],
      compSearchRadiusMiles: request.compSearchRadiusMiles ?? 1,
      targetCompCount: request.targetCompCount ?? 5,
      projections: [],
      comparables: [],
      createdBy,
      createdAt: now(),
      updatedAt: now(),
    };

    const { resource } = await this.container.items.create(order);
    if (!resource) {
      throw new Error(`Failed to create STR feasibility order for tenant ${tenantId}`);
    }

    logger.info('STR feasibility order created', { orderId: order.id, tenantId });
    return resource as StrFeasibilityOrder;
  }

  // ── Run analysis ──────────────────────────────────────────────────────────

  async analyze(orderId: string, tenantId: string): Promise<StrFeasibilityOrder> {
    const order = await this.getOrder(orderId, tenantId);
    if (!order) {
      throw new Error(`STR feasibility order ${orderId} not found for tenant ${tenantId}`);
    }

    const lat = order.subjectLatitude;
    const lng = order.subjectLongitude;

    if (!lat || !lng) {
      throw new Error(
        `Cannot analyze order ${orderId}: subjectLatitude and subjectLongitude are required. ` +
        'Update the order with geocoded coordinates before running analysis.',
      );
    }

    logger.info('Starting STR feasibility analysis', { orderId, lat, lng });

    const projections: StrProjection[] = [];

    // ── Primary: AirROI ──────────────────────────────────────────────────────
    if (order.requestedDataSources.includes('AirROI')) {
      try {
        const proj = await this.airRoi.getPropertyEstimate({
          address: order.subjectAddress,
          city: order.subjectCity,
          state: order.subjectState,
          zip: order.subjectPostalCode,
          bedrooms: order.subjectBedrooms,
          bathrooms: order.subjectBathrooms,
          ...(order.subjectAmenities !== undefined && { amenities: order.subjectAmenities }),
        });
        projections.push(proj);
      } catch (err) {
        logger.warn('AirROI estimate failed — continuing without it', { orderId, error: err });
      }
    }

    // ── Secondary: AirDNA ────────────────────────────────────────────────────
    if (order.requestedDataSources.includes('AirDNA')) {
      if (!lat || !lng) {
        logger.warn('AirDNA skipped — coordinates unavailable', { orderId });
      } else {
        try {
          const proj = await this.airDna.getRentalizerEstimate({
            latitude: lat,
            longitude: lng,
            bedrooms: order.subjectBedrooms,
            bathrooms: order.subjectBathrooms,
          });
          projections.push(proj);
        } catch (err) {
          logger.warn('AirDNA estimate failed — continuing without it', { orderId, error: err });
        }
      }
    }

    // ── Comparables: AirROI primary → Airbnb public fallback ─────────────────
    let comps = [...order.comparables];
    try {
      comps = await this.airRoi.getNearbyComps({
        address: order.subjectAddress,
        city: order.subjectCity,
        state: order.subjectState,
        zip: order.subjectPostalCode,
        bedrooms: order.subjectBedrooms,
        bathrooms: order.subjectBathrooms,
      });
    } catch (_) {
      logger.warn('AirROI comps unavailable — trying Airbnb public comp service', { orderId });
      if (lat && lng) {
        try {
          comps = await this.airbnbComp.getNearbyListings({
            latitude: lat,
            longitude: lng,
            bedrooms: order.subjectBedrooms,
            radiusMiles: order.compSearchRadiusMiles,
          });
        } catch (err) {
          logger.warn('Airbnb comp fallback also failed', { orderId, error: err });
        }
      }
    }

    // Limit to target count and assign sequential compNumbers
    const trimmedComps = comps.slice(0, order.targetCompCount).map((c, i) => ({
      ...c,
      compNumber: i + 1,
    }));

    // ── Regulatory profile ───────────────────────────────────────────────────
    let regulatoryProfile = order.regulatoryProfile;
    try {
      regulatoryProfile = await this.regulation.lookup({ city: order.subjectCity, state: order.subjectState }) ?? undefined;
    } catch (err) {
      logger.warn('Regulation lookup failed', {
        orderId,
        city: order.subjectCity,
        state: order.subjectState,
        error: err,
      });
    }

    // Designate first projection as primary if none already set
    const primaryProjection = projections[0];
    const primarySourceName = primaryProjection?.sourceName ?? order.primarySourceName;

    const updated: StrFeasibilityOrder = {
      ...order,
      status: projections.length > 0 ? 'ANALYST_REVIEW' : 'DATA_COLLECTION',
      projections,
      ...(primaryProjection !== undefined && { primaryProjection }),
      ...(primarySourceName !== undefined && { primarySourceName }),
      comparables: trimmedComps,
      ...(regulatoryProfile !== undefined && { regulatoryProfile }),
      updatedAt: now(),
    };

    const { resource } = await this.container.items.upsert(updated);
    if (!resource) {
      throw new Error(`Failed to persist analyzed STR feasibility order ${orderId}`);
    }

    logger.info('STR feasibility analysis complete', {
      orderId,
      projectionsCount: projections.length,
      compsCount: trimmedComps.length,
      hasRegProfile: !!regulatoryProfile,
    });

    return resource as unknown as StrFeasibilityOrder;
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  async getOrder(orderId: string, tenantId: string): Promise<StrFeasibilityOrder | null> {
    const { resource } = await this.container.item(orderId, tenantId).read<StrFeasibilityOrder>();
    if (!resource) return null;
    if (resource.tenantId !== tenantId) {
      throw new Error(`Order ${orderId} does not belong to tenant ${tenantId}`);
    }
    return resource;
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listOrders(tenantId: string, status?: StrFeasibilityStatus): Promise<StrFeasibilityOrder[]> {
    const query = status
      ? 'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.status = @status ORDER BY c.createdAt DESC'
      : 'SELECT * FROM c WHERE c.tenantId = @tenantId ORDER BY c.createdAt DESC';

    const parameters = status
      ? [{ name: '@tenantId', value: tenantId }, { name: '@status', value: status }]
      : [{ name: '@tenantId', value: tenantId }];

    const { resources } = await this.container.items
      .query<StrFeasibilityOrder>({ query, parameters })
      .fetchAll();

    return resources;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateOrder(
    orderId: string,
    tenantId: string,
    updates: UpdateStrFeasibilityRequest,
  ): Promise<StrFeasibilityOrder> {
    const existing = await this.getOrder(orderId, tenantId);
    if (!existing) {
      throw new Error(`STR feasibility order ${orderId} not found for tenant ${tenantId}`);
    }

    const updated: StrFeasibilityOrder = {
      ...existing,
      ...updates,
      id: existing.id,
      productType: existing.productType,
      tenantId: existing.tenantId,
      updatedAt: now(),
    };

    const { resource } = await this.container.items.upsert(updated);
    if (!resource) {
      throw new Error(`Failed to update STR feasibility order ${orderId}`);
    }

    return resource as unknown as StrFeasibilityOrder;
  }
}
