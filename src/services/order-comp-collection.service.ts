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
import { BridgeInteractiveService } from './bridge-interactive.service.js';
import { encodeGeohash } from '../utils/geohash.util.js';
import { attomToPropertyRecord } from '../mappers/attom-to-property-record.mapper.js';
import type { ClientOrderCreatedEvent } from '../types/events.js';
import type { CanonicalAddress } from '../types/property-record.types.js';
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
import type { CompSelectionStrategyRegistry } from './comp-selection/registry.js';
import type {
  CompSelectionInput,
  CompSelectionResult,
} from './comp-selection/strategy.js';
import type {
  IValueEstimator,
  SelectedCompWithPropertyRecord,
  ValueEstimate,
} from './value-estimate/value-estimator.js';

const GEOHASH_PRECISION = 5;
const MILES_TO_METERS = 1609.344;
const COMPARABLE_ANALYSES_CONTAINER = 'comparable-analyses';

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
      /**
       * Set when a comp-selection strategy was configured for this product
       * type AND ran successfully. Absent when no strategy is configured
       * (intentional opt-out) or the strategy was skipped (no candidates).
       */
      selection?: { strategyName: string; soldSelected: number; activeSelected: number };
      /** Set when a value estimate was computed alongside selection. */
      valueEstimate?: { estimatorName: string; estimatedValue: number };
    };

/**
 * Optional selection-step dependencies. Both must be present for selection
 * to run. Either (or both) being undefined is a no-op (selection skipped).
 */
export interface CompSelectionDeps {
  registry: CompSelectionStrategyRegistry;
  valueEstimator: IValueEstimator;
}

export class OrderCompCollectionService {
  private readonly logger = new Logger('OrderCompCollectionService');
  private readonly bridge: BridgeInteractiveService;
  private readonly selectionDeps?: CompSelectionDeps;

  constructor(
    private readonly cosmos: CosmosDbService,
    private readonly propertyRecords: PropertyRecordService,
    private readonly compSearch: AttomDataCompSearchService,
    /**
     * Optional: inject a BridgeInteractiveService instance (used in tests).
     * When omitted, a default instance is created automatically.
     */
    bridgeService?: BridgeInteractiveService,
    /**
     * Optional: comp-selection registry + value estimator. When provided,
     * `runForOrder` invokes the strategy named in the product config
     * inline after candidate upsert. When omitted, only collection runs.
     */
    selectionDeps?: CompSelectionDeps,
  ) {
    this.bridge = bridgeService ?? new BridgeInteractiveService();
    if (selectionDeps) this.selectionDeps = selectionDeps;
  }

  /**
   * Process a `client-order.created` event. Returns a result describing
   * whether collection ran, was skipped (with audit doc), or wasn't
   * triggered at all (product type not in trigger set).
   *
   * Throws on Cosmos write failures — the listener treats this as a
   * processable Service Bus error so the message can be retried / DLQ'd.
   */
  async runForOrder(event: ClientOrderCreatedEvent): Promise<OrderCompCollectionRunResult> {
    const { clientOrderId, clientOrderNumber, tenantId, propertyId, productType } = event.data;

    if (!shouldTriggerCompCollection(productType)) {
      this.logger.info('Skipping comp collection — product type not in trigger set', {
        clientOrderId,
        productType,
      });
      return { status: 'NOT_TRIGGERED', reason: 'PRODUCT_TYPE_NOT_IN_TRIGGER_SET' };
    }

    if (!propertyId) {
      return this.writeSkipped(clientOrderId, clientOrderNumber, tenantId, productType, 'NO_PROPERTY_ID');
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
      return this.writeSkipped(clientOrderId, clientOrderNumber, tenantId, productType, 'PROPERTY_NOT_FOUND');
    }

    const latitude = subject.address.latitude;
    const longitude = subject.address.longitude;
    if (latitude == null || longitude == null) {
      return this.writeSkipped(clientOrderId, clientOrderNumber, tenantId, productType, 'NO_COORDINATES', subject.address);
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

    const soldCandidates = soldResults.map(toCandidate('SOLD', tenantId));
    const activeCandidates = activeResults.map(toCandidate('ACTIVE', tenantId));

    // Enrich all candidates with Zestimate AVM — best-effort, non-fatal.
    await this.enrichCandidatesWithAvm(
      [...soldCandidates, ...activeCandidates],
      clientOrderId,
    );

    const doc: OrderCompCollectionDoc = {
      id: docId,
      stage: 'COLLECTION',
      orderId: clientOrderId,
      clientOrderNumber,
      tenantId,
      propertyId,
      productType,
      subjectLatitude: latitude,
      subjectLongitude: longitude,
      subjectGeohash5: subjectGeohash5,
      subjectAddress: subject.address,
      geohash5CellsQueried: Array.from(cellsQueriedSet),
      soldCandidates,
      activeCandidates,
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

    const baseResult: OrderCompCollectionRunResult = {
      status: 'COLLECTED',
      docId,
      soldCount: doc.soldCandidates.length,
      activeCount: doc.activeCandidates.length,
    };

    // ── Inline selection step ─────────────────────────────────────────
    // Runs only when (a) selection deps are wired, (b) the product config
    // names a strategy, and (c) at least one candidate was collected.
    // Failures rethrow — the listener's Service Bus retry/DLQ covers it.
    const strategyName = config.selectionStrategy;
    if (
      this.selectionDeps &&
      strategyName &&
      strategyName !== 'none' &&
      (soldCandidates.length > 0 || activeCandidates.length > 0)
    ) {
      const selection = await this.runSelection({
        strategyName,
        clientOrderId,
        clientOrderNumber,
        tenantId,
        productType,
        subject,
        soldCandidates,
        activeCandidates,
        numSold: config.numSold ?? config.soldCount,
        numActive: config.numActive ?? config.activeCount,
      });
      const valueEstimate = await this.runValueEstimate(
        subject,
        selection,
        soldCandidates,
        clientOrderId,
      );
      await this.persistSelection({
        selection,
        valueEstimate,
        tenantId,
        propertyId,
        productType,
        clientOrderId,
        clientOrderNumber,
      });
      baseResult.selection = {
        strategyName: selection.strategyName,
        soldSelected: selection.selectedSold.length,
        activeSelected: selection.selectedActive.length,
      };
      if (valueEstimate) {
        baseResult.valueEstimate = {
          estimatorName: valueEstimate.estimatorName,
          estimatedValue: valueEstimate.estimatedValue,
        };
      }
    } else if (this.selectionDeps && (!strategyName || strategyName === 'none')) {
      this.logger.info('Comp-selection skipped — no strategy configured for product type', {
        clientOrderId,
        productType,
      });
    }

    return baseResult;
  }

  /**
   * Batch-fetches Zestimate AVM values for all candidates using
   * Promise.allSettled — failures on individual candidates are logged and
   * skipped so a single bad address never aborts the whole collection write.
   */
  private async enrichCandidatesWithAvm(
    candidates: CollectedCompCandidate[],
    clientOrderId: string,
  ): Promise<void> {
    if (candidates.length === 0) return;

    const results = await Promise.allSettled(
      candidates.map(async (c) => {
        const { street, city, state, zip } = c.propertyRecord.address;
        const result = await this.bridge.getZestimateByStructuredAddress({
          streetAddress: street,
          city,
          state,
          postalCode: zip,
        });

        // Bridge response shape is untyped — probe known envelope variants.
        const bundle = result?.bundle?.[0] ?? result?.value?.[0] ?? result;
        const value: unknown = bundle?.zestimate ?? bundle?.value;
        if (value != null && typeof value === 'number') {
          c.propertyRecord.avm = {
            value,
            fetchedAt: new Date().toISOString(),
            source: 'bridge-zestimate',
          };
        }
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(
        'OrderCompCollectionService: some Zestimate calls failed — avm omitted for those candidates',
        {
          clientOrderId,
          failedCount: failed.length,
          totalCount: candidates.length,
        },
      );
    }
  }

  private async writeSkipped(
    clientOrderId: string,
    clientOrderNumber: string,
    tenantId: string,
    productType: string,
    reason: NonNullable<OrderCompCollectionDoc['skipReason']>,
    subjectAddress?: CanonicalAddress,
  ): Promise<OrderCompCollectionRunResult> {
    const now = new Date().toISOString();
    const docId = `collection-${clientOrderId}-${now}-skipped`;

    const doc: OrderCompCollectionDoc = {
      id: docId,
      stage: 'COLLECTION',
      orderId: clientOrderId,
      clientOrderNumber,
      tenantId,
      // propertyId is required on the doc; use empty string when absent so
      // the audit record is queryable by orderId. Tests assert this shape.
      propertyId: '',
      productType,
      subjectLatitude: 0,
      subjectLongitude: 0,
      subjectGeohash5: '',
      ...(subjectAddress ? { subjectAddress } : {}),
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

  // ─── Selection step helpers ───────────────────────────────────────────────

  /**
   * Resolve the named strategy from the registry and run it. Throws on
   * missing strategy or strategy failures — caller wraps so Service Bus
   * retries the whole event.
   */
  private async runSelection(args: {
    strategyName: string;
    clientOrderId: string;
    clientOrderNumber: string;
    tenantId: string;
    productType: string;
    subject: import('../types/property-record.types.js').PropertyRecord;
    soldCandidates: CollectedCompCandidate[];
    activeCandidates: CollectedCompCandidate[];
    numSold: number;
    numActive: number;
  }): Promise<CompSelectionResult> {
    const strategy = this.selectionDeps!.registry.resolve(args.strategyName);
    const input: CompSelectionInput = {
      orderId: args.clientOrderId,
      clientOrderNumber: args.clientOrderNumber,
      tenantId: args.tenantId,
      subject: args.subject,
      candidates: [...args.soldCandidates, ...args.activeCandidates],
      requested: { sold: args.numSold, active: args.numActive },
      productType: args.productType,
      correlationId: args.clientOrderId,
    };
    const result = await strategy.select(input);
    this.logger.info('Comp-selection strategy completed', {
      clientOrderId: args.clientOrderId,
      strategyName: result.strategyName,
      soldSelected: result.selectedSold.length,
      activeSelected: result.selectedActive.length,
      shortfall: result.shortfall,
    });
    return result;
  }

  /**
   * Compute a value estimate from selected sold comps. Returns undefined
   * (with WARN log) when the estimator throws on data-quality grounds —
   * selection is still useful even when an estimate isn't computable.
   * Other exceptions rethrow.
   */
  private async runValueEstimate(
    subject: import('../types/property-record.types.js').PropertyRecord,
    selection: CompSelectionResult,
    soldCandidates: CollectedCompCandidate[],
    clientOrderId: string,
  ): Promise<ValueEstimate | undefined> {
    if (selection.selectedSold.length === 0) {
      this.logger.warn('Skipping value estimate — no sold comps were selected', {
        clientOrderId,
      });
      return undefined;
    }
    const byPropertyId = new Map(
      soldCandidates.map((c) => [c.propertyRecord.id, c.propertyRecord]),
    );
    const tuples: SelectedCompWithPropertyRecord[] = [];
    for (const sel of selection.selectedSold) {
      const record = byPropertyId.get(sel.propertyId);
      if (!record) {
        // Strategy returned an id we didn't pass in — treat as a contract
        // violation. Selection guard should have caught it; surface anyway.
        throw new Error(
          `OrderCompCollectionService: selected sold propertyId "${sel.propertyId}" not found in collected candidates`,
        );
      }
      tuples.push({ selected: sel, propertyRecord: record });
    }
    try {
      return await this.selectionDeps!.valueEstimator.compute(subject, tuples);
    } catch (err) {
      this.logger.warn('Value estimator failed — persisting selection without estimate', {
        clientOrderId,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  /**
   * Persist the selection + value estimate into the `comparable-analyses`
   * container. Partition key is `/reviewId` on this container; we set
   * `reviewId = orderId` to match existing convention.
   */
  private async persistSelection(args: {
    selection: CompSelectionResult;
    valueEstimate: ValueEstimate | undefined;
    tenantId: string;
    propertyId: string;
    productType: string;
    clientOrderId: string;
    clientOrderNumber: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const doc = {
      id: `comp-selection-${args.clientOrderId}-${now}`,
      type: 'comp-selection' as const,
      // Partition key on comparable-analyses is /reviewId; mirror orderId
      // into it to keep all per-order analysis docs in one partition.
      reviewId: args.clientOrderId,
      orderId: args.clientOrderId,
      clientOrderNumber: args.clientOrderNumber,
      tenantId: args.tenantId,
      propertyId: args.propertyId,
      productType: args.productType,
      strategyName: args.selection.strategyName,
      ...(args.selection.promptVersion ? { promptVersion: args.selection.promptVersion } : {}),
      selectedSold: args.selection.selectedSold,
      selectedActive: args.selection.selectedActive,
      ...(args.selection.shortfall ? { shortfall: args.selection.shortfall } : {}),
      ...(args.selection.diagnostics ? { diagnostics: args.selection.diagnostics } : {}),
      ...(args.valueEstimate ? { valueEstimate: args.valueEstimate } : {}),
      createdAt: now,
    };
    await this.cosmos.createDocument(COMPARABLE_ANALYSES_CONTAINER, doc);
    this.logger.info('Wrote comp-selection analysis doc', {
      clientOrderId: args.clientOrderId,
      docId: doc.id,
      strategyName: doc.strategyName,
    });
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function toCandidate(source: 'SOLD' | 'ACTIVE', tenantId: string) {
  return (r: CompSearchResult): CollectedCompCandidate => {
    const { record, dataCompleteness } = attomToPropertyRecord(r.document, tenantId);
    return {
      source,
      distanceMiles: r.distanceMeters / MILES_TO_METERS,
      geohash5: r.document.geohash5,
      propertyRecord: record,
      lastSalePrice: r.document.salesHistory.lastSaleAmount,
      lastSaleDate: r.document.salesHistory.lastSaleDate || null,
      dataCompleteness,
    };
  };
}

/** Returns an ISO date string for "now minus N months" (UTC). */
function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}
