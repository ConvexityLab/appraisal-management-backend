/**
 * OrderComparablesController — read-only REST surface over the
 * `order-comparables` Cosmos container.
 *
 * The container holds documents from two pipeline stages:
 *   - COLLECTION  raw candidates pulled from ATTOM (sold + active)
 *   - RANKING     scored / selected candidates from Phase 2
 *
 * Both stage docs share `/orderId` as the partition key, where `orderId`
 * is the parent ClientOrder's id (NOT a VendorOrder id).
 *
 * The controller exposes two mount points so the UI can ask for an order's
 * comparables either by clientOrderId directly or by a VendorOrder id
 * (the vendor order is read first to recover the parent clientOrderId):
 *
 *   GET /api/orders/:orderId/comparables
 *   GET /api/vendor-orders/:vendorOrderId/comparables
 *
 * Response shape (identical across both routes):
 *   {
 *     clientOrderId: string,
 *     vendorOrderId?: string,            // present on vendor-order route
 *     latestCollection: OrderCompCollectionDoc | null,
 *     latestRanking: OrderCompRankingDoc | null,
 *     candidates: CollectedCompCandidate[],   // RANKING if present, else COLLECTION sold+active
 *   }
 *
 * Tenant scoping is enforced via req.user.tenantId; cross-tenant docs are
 * filtered out at the query level.
 *
 * No silent fallbacks: an empty container returns 200 with empty arrays
 * and explicit nulls, NOT a 404. A missing/wrong-type vendor-order returns
 * 404 with code NOT_FOUND. A vendor-order without a clientOrderId returns
 * 400 with code VENDOR_ORDER_MISSING_CLIENT_ORDER_ID.
 */

import { Router, Response } from 'express';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import {
  ORDER_COMPARABLES_CONTAINER,
  type CollectedCompCandidate,
  type OrderCompCollectionDoc,
} from '../types/order-comparables.types.js';
import {
  VENDOR_ORDERS_CONTAINER,
  VENDOR_ORDER_DOC_TYPE,
  LEGACY_VENDOR_ORDER_DOC_TYPE,
  type VendorOrder,
} from '../types/vendor-order.types.js';
import type { PropertyRecord } from '../types/property-record.types.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('OrderComparablesController');

/**
 * Minimal RANKING doc shape the controller cares about. The full ranking
 * type is not yet defined in the codebase; we read defensively so this
 * endpoint becomes useful as soon as RANKING docs start being written.
 */
interface OrderCompRankingDocLike {
  id: string;
  stage: 'RANKING';
  orderId: string;
  tenantId: string;
  createdAt: string;
  candidates?: CollectedCompCandidate[];
}

/**
 * Subject property coordinates and key characteristics sourced from the
 * `property-records` container.  Only populated on the vendor-order route
 * (the vendor order doc carries a required `propertyId` FK).
 */
interface SubjectPropertyData {
  latitude: number | null;
  longitude: number | null;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    county: string;
  };
  building: {
    gla: number;
    yearBuilt: number;
    bedrooms: number;
    bathrooms: number;
    stories?: number;
  };
  propertyType: string;
  lotSizeSqFt?: number;
}

interface OrderComparablesResponse {
  clientOrderId: string;
  vendorOrderId?: string;
  latestCollection: OrderCompCollectionDoc | null;
  latestRanking: OrderCompRankingDocLike | null;
  candidates: CollectedCompCandidate[];
  /** Subject property from `property-records` — present only on the vendor-order route. */
  subject?: SubjectPropertyData;
}

export class OrderComparablesController {
  /** Mount under `/api/orders/:orderId/comparables` */
  public routerByClientOrder: Router;
  /** Mount under `/api/vendor-orders/:vendorOrderId/comparables` */
  public routerByVendorOrder: Router;

  constructor(private readonly dbService: CosmosDbService) {
    this.routerByClientOrder = Router({ mergeParams: true });
    this.routerByClientOrder.get('/', this.handleByClientOrder.bind(this));

    this.routerByVendorOrder = Router({ mergeParams: true });
    this.routerByVendorOrder.get('/', this.handleByVendorOrder.bind(this));
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  private async handleByClientOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }
    const clientOrderId = (req.params as { orderId?: string }).orderId ?? '';
    if (!clientOrderId) {
      res.status(400).json({ error: 'orderId is required', code: 'VALIDATION_ERROR' });
      return;
    }

    try {
      const payload = await this.loadComparables(clientOrderId, req.user.tenantId);
      res.json(payload);
    } catch (err) {
      logger.error('handleByClientOrder failed', { error: err, clientOrderId });
      res.status(500).json({
        error: 'Failed to load order comparables',
        code: 'ORDER_COMPARABLES_READ_ERROR',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  private async handleByVendorOrder(req: UnifiedAuthRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }
    const vendorOrderId = (req.params as { vendorOrderId?: string }).vendorOrderId ?? '';
    if (!vendorOrderId) {
      res.status(400).json({ error: 'vendorOrderId is required', code: 'VALIDATION_ERROR' });
      return;
    }

    try {
      const vo = await this.readVendorOrder(vendorOrderId, req.user.tenantId);
      if (!vo) {
        res.status(404).json({ error: 'VendorOrder not found', code: 'NOT_FOUND' });
        return;
      }
      const clientOrderId = vo.clientOrderId;
      if (!clientOrderId) {
        res.status(400).json({
          error: 'VendorOrder has no clientOrderId; cannot resolve comparables',
          code: 'VENDOR_ORDER_MISSING_CLIENT_ORDER_ID',
        });
        return;
      }
      const [payload, subject] = await Promise.all([
        this.loadComparables(clientOrderId, req.user.tenantId),
        this.readSubjectFromPropertyRecord(vo.propertyId, vo.tenantId),
      ]);
      const response: OrderComparablesResponse = { ...payload, vendorOrderId };
      if (subject) response.subject = subject;
      res.json(response);
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 404) {
        res.status(404).json({ error: 'VendorOrder not found', code: 'NOT_FOUND' });
        return;
      }
      logger.error('handleByVendorOrder failed', { error: err, vendorOrderId });
      res.status(500).json({
        error: 'Failed to load order comparables',
        code: 'ORDER_COMPARABLES_READ_ERROR',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async readVendorOrder(
    vendorOrderId: string,
    tenantId: string
  ): Promise<VendorOrder | null> {
    const container = this.dbService.getContainer(VENDOR_ORDERS_CONTAINER);
    const { resource } = await container.item(vendorOrderId, tenantId).read<VendorOrder>();
    if (!resource) return null;
    if (
      resource.type !== VENDOR_ORDER_DOC_TYPE &&
      resource.type !== LEGACY_VENDOR_ORDER_DOC_TYPE
    ) {
      return null;
    }
    return resource;
  }

  private async loadComparables(
    clientOrderId: string,
    tenantId: string
  ): Promise<OrderComparablesResponse> {
    const container = this.dbService.getContainer(ORDER_COMPARABLES_CONTAINER);
    const { resources } = await container.items
      .query<OrderCompCollectionDoc | OrderCompRankingDocLike>({
        query:
          'SELECT * FROM c WHERE c.orderId = @orderId AND c.tenantId = @tenantId ' +
          'ORDER BY c.createdAt DESC',
        parameters: [
          { name: '@orderId', value: clientOrderId },
          { name: '@tenantId', value: tenantId },
        ],
      })
      .fetchAll();

    const latestCollection =
      (resources.find((d) => d.stage === 'COLLECTION') as OrderCompCollectionDoc | undefined) ??
      null;
    const latestRanking =
      (resources.find((d) => d.stage === 'RANKING') as OrderCompRankingDocLike | undefined) ??
      null;

    const candidates: CollectedCompCandidate[] =
      latestRanking?.candidates && latestRanking.candidates.length > 0
        ? latestRanking.candidates
        : latestCollection && !latestCollection.skipped
          ? [
              ...(latestCollection.soldCandidates ?? []),
              ...(latestCollection.activeCandidates ?? []),
            ]
          : [];

    return {
      clientOrderId,
      latestCollection,
      latestRanking,
      candidates,
    };
  }

  /**
   * Read the subject `PropertyRecord` from `property-records` and return a
   * compact `SubjectPropertyData` for the comparables response.  Returns null
   * if the record is missing or the read fails — callers must not throw.
   */
  private async readSubjectFromPropertyRecord(
    propertyId: string,
    tenantId: string,
  ): Promise<SubjectPropertyData | null> {
    try {
      const container = this.dbService.getContainer('property-records');
      const { resource } = await container.item(propertyId, tenantId).read<PropertyRecord>();
      if (!resource) return null;

      const addr = resource.address;
      const b = resource.building;

      return {
        latitude: addr.latitude ?? null,
        longitude: addr.longitude ?? null,
        address: {
          street: addr.street,
          city: addr.city,
          state: addr.state,
          zip: addr.zip,
          county: addr.county ?? '',
        },
        building: {
          gla: b.gla,
          yearBuilt: b.yearBuilt,
          bedrooms: b.bedrooms,
          bathrooms: b.bathrooms,
          ...(b.stories !== undefined && { stories: b.stories }),
        },
        propertyType: resource.propertyType,
        ...(resource.lotSizeSqFt !== undefined && { lotSizeSqFt: resource.lotSizeSqFt }),
      };
    } catch (err) {
      logger.warn('readSubjectFromPropertyRecord failed — subject omitted from response', {
        propertyId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
