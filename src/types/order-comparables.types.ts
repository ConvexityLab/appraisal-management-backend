/**
 * Order-Comparables Types (Comp Collection stage)
 *
 * Types for the comp-collection stage of the comp pipeline that runs after a
 * vendor is assigned to an order.
 *
 * Comp collection = pull a configurable number of recent SOLD comparables and
 *                   currently ACTIVE listings from the `attom-data` Cosmos
 *                   container, narrowing partitions by the subject's geohash5
 *                   (adaptive expansion to 8 neighbor cells when the subject
 *                   cell is sparse).
 *
 * Results land in the `order-comparables` Cosmos container, partitioned by
 * `/orderId`, discriminated by a `stage` field so a later RANKING stage can
 * write its own document type into the same container.
 *
 * This module is intentionally separate from `comparable-selection.types.ts`
 * so the existing ranking-style pipeline is unaffected by collection changes.
 *
 * @see OrderCompCollectionService (planned)
 */

import type { AttomDataDocument } from './attom-data.types.js';
import type { PropertyRecordType } from './property-record.types.js';
import type { GeohashExpansion } from '../utils/geohash.util.js';

// Re-exported for backward compatibility with existing imports of this type
// from `order-comparables.types`. The canonical definition now lives in
// `utils/geohash.util.ts` so the comp-search service can depend on it
// without pulling in stage-specific types.
export type { GeohashExpansion };

// ─── Stage discriminator for the order-comparables container ────────────────

export const ORDER_COMPARABLES_CONTAINER = 'order-comparables';

/**
 * Stage of the comp pipeline that produced the document.
 *
 * - COLLECTION  Output of the comp-collection stage (this module).
 * - RANKING     Output of a future ranking stage that will score / select a
 *               final comp set from the collected candidates.
 */
export type OrderCompStage = 'COLLECTION' | 'RANKING';

// ─── Candidate source ────────────────────────────────────────────────────────

/** Whether a candidate was pulled as a sold comp or as an active listing. */
export type CandidateSource = 'SOLD' | 'ACTIVE';

// ─── Comp-collection configuration (per product type) ───────────────────────

/**
 * Per-product-type configuration for the comp-collection stage.
 *
 * NOTE: `radiusMiles` is the post-partition ST_DISTANCE filter applied within
 * the queried geohash cells. It does NOT determine which cells are queried —
 * cell selection is driven by `geohashExpansion` only.
 */
export interface OrderCompCollectionConfig {
  /** Post-partition radius (miles) used in the ST_DISTANCE filter. */
  radiusMiles: number;
  /** Number of recent sold comps to pull. */
  soldCount: number;
  /** Number of currently active listings to pull. */
  activeCount: number;
  /** Sold comps must have a sale within this many months of "now". */
  soldSaleWindowMonths: number;
  /** Geohash5 cell expansion strategy. */
  geohashExpansion: GeohashExpansion;
}

// ─── Subject summary needed for comp collection ─────────────────────────────

/**
 * Minimal subject-property fields the comp-collection stage needs.
 * Lat/lng are required; geohash5 is computed from them at query time.
 */
export interface CompCollectionSubjectSummary {
  propertyId: string;
  tenantId: string;
  latitude: number;
  longitude: number;
  state: string;
  /** Mapped property type used to require an exact-type match in candidates. */
  propertyType: PropertyRecordType;
}

// ─── Candidate (comp-collection output element) ─────────────────────────────

/**
 * A single candidate property pulled from `attom-data` during comp collection.
 * Carries the full source document so downstream stages (and audits) can
 * inspect every field that was available at collection time.
 */
export interface CollectedCompCandidate {
  /** ATTOM property identifier (also the source doc id). */
  attomId: string;
  /** Whether this candidate came from the sold or active query. */
  source: CandidateSource;
  /** Distance from subject in miles, computed by the Cosmos ST_DISTANCE call. */
  distanceMiles: number;
  /** Geohash5 partition the candidate was found in. */
  geohash5: string;
  /** Reference to the full source document. */
  sourceDocument: AttomDataDocument;
}

// ─── Persisted comp-collection document ─────────────────────────────────────

/**
 * The document written to the `order-comparables` Cosmos container per
 * comp-collection run. Multiple runs for the same order produce multiple
 * docs (history is preserved); each doc id includes a timestamp.
 *
 * Partition key: /orderId
 */
export interface OrderCompCollectionDoc {
  /** Cosmos document id: `collection-{orderId}-{ISO timestamp}`. */
  id: string;
  /** Discriminator inside the container. */
  stage: 'COLLECTION';
  /** Partition key. */
  orderId: string;
  tenantId: string;
  /** FK to the subject PropertyRecord. */
  propertyId: string;
  /** The order's product type at collection time (e.g. `BPO`, `DVR`). */
  productType: string;
  /** Subject coordinates for traceability. */
  subjectLatitude: number;
  subjectLongitude: number;
  /** Subject's geohash5 cell. */
  subjectGeohash5: string;
  /** Geohash5 cells actually queried (subject + any expansion). */
  geohash5CellsQueried: string[];
  /** Sold comps collected, ordered by sale-date DESC. */
  soldCandidates: CollectedCompCandidate[];
  /** Active listings collected, ordered by listing-date DESC. */
  activeCandidates: CollectedCompCandidate[];
  /** Snapshot of the config used for this run. */
  config: OrderCompCollectionConfig;
  /** ISO timestamp the doc was created. */
  createdAt: string;
  /**
   * Set to `true` when collection was intentionally not performed (e.g. the
   * subject PropertyRecord could not be loaded). The doc is still written so
   * the SKIPPED state is auditable in the same container.
   *
   * When `skipped === true`, `soldCandidates` and `activeCandidates` are
   * empty arrays and `geohash5CellsQueried` is empty.
   */
  skipped?: boolean;
  /** Why the run was skipped. Required when `skipped === true`. */
  skipReason?: 'NO_PROPERTY_ID' | 'NO_COORDINATES' | 'PROPERTY_NOT_FOUND';
}
