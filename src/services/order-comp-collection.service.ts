/**
 * OrderCompCollectionService
 *
 * Comp-collection stage of the comp pipeline. Triggered by a
 * `client-order.created` Service Bus event for ProductTypes in
 * COMP_COLLECTION_TRIGGER_PRODUCT_TYPES.
 *
 * For each triggering order:
 *   1. Loads the subject `PropertyRecord` (requires `propertyId` + lat/lng).
 *      If any of these are missing, writes a SKIPPED audit doc and returns.
 *   2. Calls `AttomDataCompSearchService.searchComps()` twice:
 *        - SOLD comps  — filtered by `salesHistory.lastSaleDate` window
 *        - ACTIVE listings — filtered by `mlsData.listingStatus === 'A'`
 *   3. Maps results to `CollectedCompCandidate[]` and writes a single
 *      `OrderCompCollectionDoc` to the `order-comparables` Cosmos container
 *      (partition key `/orderId`).
 *
 * Each invocation creates a NEW doc (history is preserved) — id format:
 * `collection-{orderId}-{ISO}` for successful runs,
 * `collection-{orderId}-{ISO}-skipped` for SKIPPED runs.
 *
 * Concurrency: not currently re-entrant; if the same event is delivered
 * twice (Service Bus at-least-once delivery), two docs will be written.
 * Downstream consumers should pick the latest by `createdAt`.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type { PropertyRecordService } from './property-record.service.js';
import type { AttomDataCompSearchService } from './attom-data-comp-search.service.js';
import { encodeGeohash } from '../utils/geohash.util.js';
import type { ClientOrderCreatedEvent } from '../types/events.js';
import {
  ORDER_COMPARABLES_CONTAINER,
  type CollectedCompCandidate,
  type OrderCompCollectionDoc,
} from '../types/order-comparables.types.js';
import type { CompSearchResult } from '../types/attom-data.types.js';
import {
  ACTIVE_LISTING_STATUS,
  getCompCollectionConfig,
  shouldTriggerCompCollection,
} from '../config/comp-collection-config.js';

const GEOHASH_PRECISION = 5;
const MILES_TO_METERS = 1609.344;

/** Result shape emitted by `runForOrder` for traceability / tests. */
export type OrderCompCollectionRunResult =
  | {
      status: 'NOT_TRIGGERED';
      reason: 'PRODUCT_TYPE_NOT_IN_TRIGGER_SET';
    }
  | {
      status: 'SKIPPED';
      reason: NonNullable<OrderCompCollectionDoc['skipReason']>;
      docId: string;
    }
  | {
      status: 'COLLECTED';
      docId: string;
      soldCount: number;
      activeCount: number;
    };

export class OrderCompCollectionService {
  private readonly logger = new Logger('OrderCompCollectionService');

  constructor(
    private readonly cosmos: CosmosDbService,
    private readonly propertyRecords: PropertyRecordService,
    private readonly compSearch: AttomDataCompSearchService,
  ) {}

  /**
   * Process a `client-order.created` event. Returns a result describing
   * whether collection ran, was skipped (with audit doc), or wasn't
   * triggered at all (product type not in trigger set).
   *
   * Throws on Cosmos write failures — the listener treats this as a
   * processable Service Bus error so the message can be retried / DLQ'd.
   */
  async runForOrder(event: ClientOrderCreatedEvent): Promise<OrderCompCollectionRunResult> {
    const { clientOrderId, tenantId, propertyId, productType } = event.data;

    if (!shouldTriggerCompCollection(productType)) {
      this.logger.info('Skipping comp collection — product type not in trigger set', {
        clientOrderId,
        productType,
      });
      return { status: 'NOT_TRIGGERED', reason: 'PRODUCT_TYPE_NOT_IN_TRIGGER_SET' };
    }

    if (!propertyId) {
      return this.writeSkipped(clientOrderId, tenantId, productType, 'NO_PROPERTY_ID');
    }

    // Load subject. `getById` throws if missing — translate that to a
    // SKIPPED audit doc rather than failing the whole event.
    let subject;
    try {
      subject = await this.propertyRecords.getById(propertyId, tenantId);
    } catch (err) {
      this.logger.warn('PropertyRecord not found — writing SKIPPED collection doc', {
        clientOrderId,
        propertyId,
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return this.writeSkipped(clientOrderId, tenantId, productType, 'PROPERTY_NOT_FOUND');
    }

    const latitude = subject.address.latitude;
    const longitude = subject.address.longitude;
    if (latitude == null || longitude == null) {
      return this.writeSkipped(clientOrderId, tenantId, productType, 'NO_COORDINATES');
    }

    const config = getCompCollectionConfig(productType);
    const subjectGeohash5 = encodeGeohash(latitude, longitude, GEOHASH_PRECISION);
    const radiusMeters = config.radiusMiles * MILES_TO_METERS;
    const minSaleDate = isoMonthsAgo(config.soldSaleWindowMonths);

    // SOLD comps — sale-window filter, ordered by lastSaleDate DESC by the
    // search service.
    const soldResults = await this.compSearch.searchComps({
      latitude,
      longitude,
      radiusMeters,
      minSaleDate,
      maxResults: config.soldCount,
      expansion: config.geohashExpansion,
    });

    // ACTIVE listings — listingStatus filter; no sale-window filter (active
    // listings haven't sold). NOTE: the underlying search currently sorts
    // by lastSaleDate DESC, which is suboptimal for active-listing pages
    // but produces a deterministic result. A dedicated "order by listingDate"
    // path can be added when the ranking stage needs it.
    const activeResults = await this.compSearch.searchComps({
      latitude,
      longitude,
      radiusMeters,
      listingStatus: ACTIVE_LISTING_STATUS,
      maxResults: config.activeCount,
      expansion: config.geohashExpansion,
    });

    const cellsQueriedSet = new Set<string>();
    cellsQueriedSet.add(subjectGeohash5);
    // We don't have direct access to the actual cells the search service
    // queried; record the subject cell as the canonical entry. Detailed
    // per-cell auditing would require plumbing the cell list out of
    // AttomDataCompSearchService — out of scope for this stage.

    const now = new Date().toISOString();
    const docId = `collection-${clientOrderId}-${now}`;

    const doc: OrderCompCollectionDoc = {
      id: docId,
      stage: 'COLLECTION',
      orderId: clientOrderId,
      tenantId,
      propertyId,
      productType,
      subjectLatitude: latitude,
      subjectLongitude: longitude,
      subjectGeohash5,
      geohash5CellsQueried: Array.from(cellsQueriedSet),
      soldCandidates: soldResults.map(toCandidate('SOLD')),
      activeCandidates: activeResults.map(toCandidate('ACTIVE')),
      config,
      createdAt: now,
    };

    await this.cosmos.createDocument<OrderCompCollectionDoc>(ORDER_COMPARABLES_CONTAINER, doc);

    this.logger.info('Wrote comp-collection doc', {
      clientOrderId,
      tenantId,
      docId,
      soldCount: doc.soldCandidates.length,
      activeCount: doc.activeCandidates.length,
    });

    return {
      status: 'COLLECTED',
      docId,
      soldCount: doc.soldCandidates.length,
      activeCount: doc.activeCandidates.length,
    };
  }

  private async writeSkipped(
    clientOrderId: string,
    tenantId: string,
    productType: string,
    reason: NonNullable<OrderCompCollectionDoc['skipReason']>,
  ): Promise<OrderCompCollectionRunResult> {
    const now = new Date().toISOString();
    const docId = `collection-${clientOrderId}-${now}-skipped`;

    const doc: OrderCompCollectionDoc = {
      id: docId,
      stage: 'COLLECTION',
      orderId: clientOrderId,
      tenantId,
      // propertyId is required on the doc; use empty string when absent so
      // the audit record is queryable by orderId. Tests assert this shape.
      propertyId: '',
      productType,
      subjectLatitude: 0,
      subjectLongitude: 0,
      subjectGeohash5: '',
      geohash5CellsQueried: [],
      soldCandidates: [],
      activeCandidates: [],
      config: getCompCollectionConfig(productType),
      createdAt: now,
      skipped: true,
      skipReason: reason,
    };

    await this.cosmos.createDocument<OrderCompCollectionDoc>(ORDER_COMPARABLES_CONTAINER, doc);

    this.logger.info('Wrote SKIPPED comp-collection doc', {
      clientOrderId,
      tenantId,
      docId,
      skipReason: reason,
    });

    return { status: 'SKIPPED', reason, docId };
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function toCandidate(source: 'SOLD' | 'ACTIVE') {
  return (r: CompSearchResult): CollectedCompCandidate => ({
    attomId: r.document.attomId,
    source,
    distanceMiles: r.distanceMeters / MILES_TO_METERS,
    geohash5: r.document.geohash5,
    sourceDocument: r.document,
  });
}

/** Returns an ISO date string for "now minus N months" (UTC). */
function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}
