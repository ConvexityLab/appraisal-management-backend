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
import type { PropertyPhoto } from '../types/canonical-schema.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware, AuthorizedRequest } from '../middleware/authorization.middleware.js';
import { Logger } from '../utils/logger.js';
import { PropertyObservationService } from '../services/property-observation.service.js';
import { materializePropertyRecordHistory } from '../services/property-record-history-materializer.service.js';

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
  valuation?: {
    estimatedValue?: number;
    confidenceScore?: number;
    asOfDate?: string;
  };
  /** Vendor-supplied subject property photos (e.g. ATTOM PHOTOURLPREFIX/PHOTOKEY).
   *  Omitted entirely when the property record carries no photos — never `[]`. */
  photos?: PropertyPhoto[];
}

/**
 * Minimal selected-comp entry — only the fields the UI needs from the
 * `comparable-analyses` comp-selection document. Mirrors the backend
 * `SelectedComp` interface (strategy.ts) without pulling it in as a
 * dependency.
 */
interface MinimalSelectedComp {
  propertyId: string;
  selectionFlag: string;
}

interface CompValueEstimate {
  estimatedValue: number;
  lowerBound: number;
  upperBound: number;
}

/**
 * Comp-selection result from the `comparable-analyses` container,
 * included in the comparables response so the UI can show which comps
 * the backend strategy chose (and their flags) without a second request.
 * Null when no selection document exists for the order yet.
 */
interface LatestSelection {
  selectedSold: MinimalSelectedComp[];
  selectedActive: MinimalSelectedComp[];
  /** Value estimate computed from selected sold comps by CompBasedValueEstimator. */
  valueEstimate?: CompValueEstimate;
}

interface OrderComparablesResponse {
  clientOrderId: string;
  vendorOrderId?: string;
  latestCollection: OrderCompCollectionDoc | null;
  latestRanking: OrderCompRankingDocLike | null;
  candidates: CollectedCompCandidate[];
  /** Subject property from `property-records` — present only on the vendor-order route. */
  subject?: SubjectPropertyData;
  /**
   * Latest comp-selection result from the `comparable-analyses` container.
   * Null when the backend strategy has not yet run for this order.
   */
  latestSelection: LatestSelection | null;
}

export class OrderComparablesController {
  /** Mount under `/api/orders/:orderId/comparables` */
  public routerByClientOrder: Router;
  /** Mount under `/api/vendor-orders/:vendorOrderId/comparables` */
  public routerByVendorOrder: Router;
  private readonly observationService: PropertyObservationService;

  constructor(
    private readonly dbService: CosmosDbService,
    authzMiddleware?: AuthorizationMiddleware,
  ) {
    this.observationService = new PropertyObservationService(dbService);
    this.routerByClientOrder = Router({ mergeParams: true });
    const clientOrderRead = authzMiddleware
      ? [
          authzMiddleware.loadUserProfile(),
          authzMiddleware.authorizeResource('client_order', 'read', { resourceIdParam: 'orderId' }),
        ]
      : [];
    this.routerByClientOrder.get('/', ...clientOrderRead, this.handleByClientOrder.bind(this));

    this.routerByVendorOrder = Router({ mergeParams: true });
    const vendorOrderRead = authzMiddleware
      ? [
          authzMiddleware.loadUserProfile(),
          authzMiddleware.authorizeResource('vendor_order', 'read', {
            resourceIdParam: 'vendorOrderId',
          }),
        ]
      : [];
    this.routerByVendorOrder.get('/', ...vendorOrderRead, this.handleByVendorOrder.bind(this));
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  private async handleByClientOrder(req: AuthorizedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }
    const clientOrderId = (req.params as { orderId?: string }).orderId ?? '';
    if (!clientOrderId) {
      res.status(400).json({ error: 'orderId is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      return;
    }

    try {
      const payload = await this.loadComparables(clientOrderId, tenantId);
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

  private async handleByVendorOrder(req: AuthorizedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
      return;
    }
    const vendorOrderId = (req.params as { vendorOrderId?: string }).vendorOrderId ?? '';
    if (!vendorOrderId) {
      res.status(400).json({ error: 'vendorOrderId is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      return;
    }

    try {
      const vo = await this.readVendorOrder(vendorOrderId, tenantId);
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
        this.loadComparables(clientOrderId, tenantId),
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

    // Load the latest comp-selection result from the `comparable-analyses`
    // container. Partition key on that container is `/reviewId`; the
    // selection pipeline sets reviewId = orderId (clientOrderId). Reading
    // within the partition avoids a cross-partition fan-out.
    // Failures are non-fatal — candidates still render without flags.
    let latestSelection: LatestSelection | null = null;
    try {
      const analysesContainer = this.dbService.getContainer('comparable-analyses');
      const { resources: selectionDocs } = await analysesContainer.items
        .query<{ selectedSold?: unknown[]; selectedActive?: unknown[]; valueEstimate?: unknown }>(
          {
            query:
              'SELECT TOP 1 c.selectedSold, c.selectedActive, c.valueEstimate FROM c ' +
              'WHERE c.reviewId = @orderId AND c.tenantId = @tenantId AND c.type = @type ' +
              'ORDER BY c.createdAt DESC',
            parameters: [
              { name: '@orderId', value: clientOrderId },
              { name: '@tenantId', value: tenantId },
              { name: '@type', value: 'comp-selection' },
            ],
          },
          { partitionKey: clientOrderId },
        )
        .fetchAll();

      if (selectionDocs.length > 0) {
        const doc = selectionDocs[0]!;
        latestSelection = {
          selectedSold: toMinimalSelectedComps(doc.selectedSold),
          selectedActive: toMinimalSelectedComps(doc.selectedActive),
          ...(toCompValueEstimate(doc.valueEstimate) ? { valueEstimate: toCompValueEstimate(doc.valueEstimate)! } : {}),
        };
      }
    } catch (err) {
      logger.warn('loadComparables: could not read comparable-analyses selection doc — latestSelection omitted', {
        clientOrderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      clientOrderId,
      latestCollection,
      latestRanking,
      candidates,
      latestSelection,
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

      const observations = await this.observationService.listByPropertyId(propertyId, tenantId);
      const record = materializePropertyRecordHistory(resource, observations);

      const addr = record.address;
      const b = record.building;

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
        propertyType: record.propertyType,
        ...(record.lotSizeSqFt !== undefined && { lotSizeSqFt: record.lotSizeSqFt }),
        ...(record.avm
          ? {
              valuation: {
                ...(record.avm.value !== undefined ? { estimatedValue: record.avm.value } : {}),
                ...(record.avm.confidence !== undefined ? { confidenceScore: record.avm.confidence } : {}),
                ...(record.avm.fetchedAt ? { asOfDate: record.avm.fetchedAt } : {}),
              },
            }
          : {}),
        ...(record.photos && record.photos.length > 0 && { photos: record.photos }),
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

// ─── module-level helpers ────────────────────────────────────────────────────

/**
 * Validate and narrow the raw `valueEstimate` object stored in the
 * `comparable-analyses` document. Returns null when the shape is invalid
 * so callers never surface corrupt data silently.
 */
function toCompValueEstimate(raw: unknown): CompValueEstimate | null {
  if (
    raw == null ||
    typeof raw !== 'object' ||
    typeof (raw as Record<string, unknown>)['estimatedValue'] !== 'number' ||
    typeof (raw as Record<string, unknown>)['lowerBound'] !== 'number' ||
    typeof (raw as Record<string, unknown>)['upperBound'] !== 'number'
  ) {
    return null;
  }
  const r = raw as Record<string, unknown>;
  return {
    estimatedValue: r['estimatedValue'] as number,
    lowerBound: r['lowerBound'] as number,
    upperBound: r['upperBound'] as number,
  };
}

/**
 * Extract `propertyId` and `selectionFlag` from the raw selection entries
 * stored in the `comparable-analyses` document. Entries that are missing
 * either field are silently skipped — they cannot be matched to candidates.
 */
function toMinimalSelectedComps(raw: unknown[] | undefined): MinimalSelectedComp[] {
  if (!Array.isArray(raw)) return [];
  const result: MinimalSelectedComp[] = [];
  for (const entry of raw) {
    if (
      entry != null &&
      typeof entry === 'object' &&
      typeof (entry as Record<string, unknown>)['propertyId'] === 'string' &&
      typeof (entry as Record<string, unknown>)['selectionFlag'] === 'string'
    ) {
      result.push({
        propertyId: (entry as Record<string, unknown>)['propertyId'] as string,
        selectionFlag: (entry as Record<string, unknown>)['selectionFlag'] as string,
      });
    }
  }
  return result;
}
