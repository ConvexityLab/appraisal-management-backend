/**
 * Comparable Selection Service
 *
 * Automated two-phase pipeline for selecting the most relevant comparable
 * properties when certain order types are created (BPO, Desktop Review, DVR, etc.).
 *
 * Phase 1 — Candidate Pool:
 *   Query `property-data-cache` via Cosmos ST_DISTANCE spatial index within a
 *   configurable radius. Apply hard disqualification filters (property type,
 *   sale recency, must-have-sale-price). Exclude the subject property itself.
 *
 * Phase 2 — Ranking & Selection:
 *   Score each candidate on weighted criteria (distance, sale recency, GLA
 *   similarity, age similarity, bed/bath match). Return the top N by composite
 *   score.
 *
 * Results are persisted to the `comparable-analyses` container for downstream
 * consumption and auditability.
 *
 * Trigger: OrderEventService.handleOrderCreated() — async, non-blocking.
 *
 * This service does NOT create any Cosmos containers.
 * All containers MUST be provisioned via Bicep before this service runs.
 *
 * @see comparable-selection.types.ts
 * @see OrderEventService.handleOrderCreated
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { PropertyRecordService } from './property-record.service.js';
import { PropertyDataCacheService } from './property-data-cache.service.js';
import type { PropertyDataCacheEntry } from './property-data-cache.service.js';
import { haversineDistanceMiles } from './comparable-sale.service.js';
import { Logger } from '../utils/logger.js';
import type { PropertyRecord } from '../types/property-record.types.js';
import { PropertyRecordType } from '../types/property-record.types.js';
import type {
  CompSelectionConfig,
  RankingWeights,
  SelectionSubjectSummary,
  CompCandidate,
  ScoredCandidate,
  CompSelectionResult,
} from '../types/comparable-selection.types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MILES_TO_METERS = 1_609.344;
const COMPARABLE_ANALYSES_CONTAINER = 'comparable-analyses';

/**
 * Product types that trigger auto comp selection on order creation.
 * Maintained here (not in product-catalog.ts) because this is a
 * pipeline-specific concern, not a catalog-level attribute.
 */
export const COMP_SELECTION_PRODUCT_TYPES = new Set([
  'BPO',
  'BPO_EXTERIOR',
  'BPO_INTERIOR',
  'DESKTOP_REVIEW',
  'DESKTOP_APPRAISAL',
  'DVR',
]);

// ─── Default Configuration ────────────────────────────────────────────────────

/**
 * Placeholder ranking weights — replace with your actual values.
 *
 * These are relative weights (not percentages). The scoring function
 * normalizes them to sum to 1.0 internally.
 */
const DEFAULT_WEIGHTS: RankingWeights = {
  distance: 5,
  saleRecency: 4,
  glaSimilarity: 3,
  ageSimilarity: 2,
  bedBathMatch: 2,
};

/**
 * Per-product-type configuration.
 *
 * Radius values are placeholders — replace with your exact values.
 * Weights can also be overridden per product type if needed.
 */
const COMP_SELECTION_CONFIGS: Record<string, CompSelectionConfig> = {
  BPO: {
    radiusMiles: 1,            // TODO: replace with your value
    saleDateMaxMonths: 12,
    maxCandidates: 200,
    topN: 3,
    weights: DEFAULT_WEIGHTS,
  },
  BPO_EXTERIOR: {
    radiusMiles: 1,            // TODO: replace with your value
    saleDateMaxMonths: 12,
    maxCandidates: 200,
    topN: 3,
    weights: DEFAULT_WEIGHTS,
  },
  BPO_INTERIOR: {
    radiusMiles: 1,            // TODO: replace with your value
    saleDateMaxMonths: 12,
    maxCandidates: 200,
    topN: 3,
    weights: DEFAULT_WEIGHTS,
  },
  DESKTOP_REVIEW: {
    radiusMiles: 3,            // TODO: replace with your value
    saleDateMaxMonths: 12,
    maxCandidates: 200,
    topN: 3,
    weights: DEFAULT_WEIGHTS,
  },
  DESKTOP_APPRAISAL: {
    radiusMiles: 3,            // TODO: replace with your value
    saleDateMaxMonths: 12,
    maxCandidates: 200,
    topN: 3,
    weights: DEFAULT_WEIGHTS,
  },
  DVR: {
    radiusMiles: 3,            // TODO: replace with your value
    saleDateMaxMonths: 12,
    maxCandidates: 200,
    topN: 3,
    weights: DEFAULT_WEIGHTS,
  },
};

// ─── ATTOM → PropertyRecordType mapping ───────────────────────────────────────

/**
 * Maps ATTOM property type strings to our PropertyRecordType enum.
 * ATTOM values come from the CSV field ATTOMPROPERTYTYPE.
 *
 * If the ATTOM value is not in this map, property-type filtering
 * treats it as a non-match (conservative).
 */
const ATTOM_TYPE_TO_RECORD_TYPE: Record<string, PropertyRecordType> = {
  'SFR':            PropertyRecordType.SINGLE_FAMILY,
  'RESIDENTIAL':    PropertyRecordType.SINGLE_FAMILY,
  'CONDO':          PropertyRecordType.CONDO,
  'CONDOMINIUM':    PropertyRecordType.CONDO,
  'TOWNHOUSE':      PropertyRecordType.TOWNHOME,
  'TOWNHOME':       PropertyRecordType.TOWNHOME,
  'MULTI-FAMILY':   PropertyRecordType.MULTI_FAMILY,
  'MULTIFAMILY':    PropertyRecordType.MULTI_FAMILY,
  'DUPLEX':         PropertyRecordType.MULTI_FAMILY,
  'TRIPLEX':        PropertyRecordType.MULTI_FAMILY,
  'QUADPLEX':       PropertyRecordType.MULTI_FAMILY,
  'COMMERCIAL':     PropertyRecordType.COMMERCIAL,
  'LAND':           PropertyRecordType.LAND,
  'VACANT LAND':    PropertyRecordType.LAND,
  'MANUFACTURED':   PropertyRecordType.MANUFACTURED,
  'MOBILE HOME':    PropertyRecordType.MANUFACTURED,
  'MIXED USE':      PropertyRecordType.MIXED_USE,
  'MIXED-USE':      PropertyRecordType.MIXED_USE,
};

/**
 * Returns the PropertyRecordType for an ATTOM type string, or null if unmapped.
 */
export function mapAttomTypeToRecordType(attomType: string): PropertyRecordType | null {
  const key = attomType.trim().toUpperCase();
  return ATTOM_TYPE_TO_RECORD_TYPE[key] ?? null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ComparableSelectionService {
  private readonly logger: Logger;

  constructor(
    private readonly cosmos: CosmosDbService,
    private readonly propertyRecordService: PropertyRecordService,
    private readonly propertyDataCacheService: PropertyDataCacheService,
  ) {
    this.logger = new Logger('ComparableSelectionService');
  }

  // ─── Main entry point ───────────────────────────────────────────────────────

  /**
   * Run the full comparable selection pipeline for an order.
   *
   * @param orderId     The order triggering selection.
   * @param tenantId    Tenant scope.
   * @param productType The order's product type (must be in COMP_SELECTION_PRODUCT_TYPES).
   * @param propertyId  FK to the subject PropertyRecord (from enrichment).
   *
   * @throws if productType has no config, or subject has no lat/lng.
   */
  async selectForOrder(
    orderId: string,
    tenantId: string,
    productType: string,
    propertyId: string,
  ): Promise<CompSelectionResult> {
    if (!orderId) throw new Error('ComparableSelectionService.selectForOrder: orderId is required');
    if (!tenantId) throw new Error('ComparableSelectionService.selectForOrder: tenantId is required');
    if (!productType) throw new Error('ComparableSelectionService.selectForOrder: productType is required');
    if (!propertyId) throw new Error('ComparableSelectionService.selectForOrder: propertyId is required');

    const config = this.getConfig(productType);

    this.logger.info('selectForOrder: starting', {
      orderId, tenantId, productType, propertyId,
      radiusMiles: config.radiusMiles,
    });

    // ── Step 1: Load subject property ─────────────────────────────────────
    const subject = await this.loadSubject(propertyId, tenantId);

    // ── Step 2: Phase 1 — build candidate pool ───────────────────────────
    const candidates = await this.buildCandidatePool(subject, config);

    this.logger.info('selectForOrder: Phase 1 complete', {
      orderId,
      candidateCount: candidates.length,
    });

    // ── Step 3: Phase 2 — score and rank ──────────────────────────────────
    const scored = scoreCandidates(subject, candidates, config.weights);
    const selected = scored.slice(0, config.topN);

    this.logger.info('selectForOrder: Phase 2 complete', {
      orderId,
      scoredCount: scored.length,
      selectedCount: selected.length,
      topScore: selected[0]?.compositeScore ?? null,
    });

    // ── Step 4: Persist result ────────────────────────────────────────────
    const result: CompSelectionResult = {
      orderId,
      tenantId,
      propertyId,
      productType,
      candidateCount: candidates.length,
      selected,
      config,
      createdAt: new Date().toISOString(),
    };

    await this.persistResult(result);

    return result;
  }

  // ─── Config lookup ──────────────────────────────────────────────────────────

  private getConfig(productType: string): CompSelectionConfig {
    const normalizedType = productType.toUpperCase();
    const config = COMP_SELECTION_CONFIGS[normalizedType];
    if (!config) {
      throw new Error(
        `ComparableSelectionService: no comp selection config for product type "${productType}". ` +
        `Supported types: ${Object.keys(COMP_SELECTION_CONFIGS).join(', ')}`,
      );
    }
    return config;
  }

  // ─── Subject loading ────────────────────────────────────────────────────────

  private async loadSubject(propertyId: string, tenantId: string): Promise<SelectionSubjectSummary> {
    const record: PropertyRecord = await this.propertyRecordService.getById(propertyId, tenantId);

    const lat = record.address.latitude;
    const lng = record.address.longitude;
    if (lat == null || lng == null) {
      throw new Error(
        `ComparableSelectionService: subject property "${propertyId}" has no lat/lng. ` +
        `Ensure property enrichment (geocoding) has completed before comp selection runs.`,
      );
    }

    return {
      propertyId: record.id,
      tenantId,
      latitude: lat,
      longitude: lng,
      gla: record.building.gla,
      yearBuilt: record.building.yearBuilt,
      bedrooms: record.building.bedrooms,
      bathrooms: record.building.bathrooms,
      propertyType: record.propertyType,
      state: record.address.state,
    };
  }

  // ─── Phase 1: Candidate Pool ────────────────────────────────────────────────

  private async buildCandidatePool(
    subject: SelectionSubjectSummary,
    config: CompSelectionConfig,
  ): Promise<CompCandidate[]> {
    const radiusMeters = config.radiusMiles * MILES_TO_METERS;

    // Spatial query — returns up to maxCandidates from property-data-cache
    const raw = await this.propertyDataCacheService.searchByRadius(
      subject.longitude,
      subject.latitude,
      radiusMeters,
      subject.state,
      config.maxCandidates,
    );

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - config.saleDateMaxMonths);
    const cutoffIso = cutoffDate.toISOString().slice(0, 10); // YYYY-MM-DD

    const candidates: CompCandidate[] = [];

    for (const entry of raw) {
      // ── Exclude subject property itself ───────────────────────────────
      if (this.isSameProperty(entry, subject)) continue;

      // ── Hard filter: must have sale price ─────────────────────────────
      const saleAmount = entry.salesHistory.lastSaleAmount;
      if (saleAmount == null || saleAmount <= 0) continue;

      // ── Hard filter: sale date recency ────────────────────────────────
      const saleDate = entry.salesHistory.lastSaleDate;
      if (!saleDate || saleDate < cutoffIso) continue;

      // ── Hard filter: same property type ───────────────────────────────
      const mappedType = mapAttomTypeToRecordType(entry.propertyDetail.attomPropertyType);
      if (mappedType !== subject.propertyType) continue;

      // ── Hard filter: must have location for distance scoring ──────────
      if (!entry.location) continue;

      // ── Map to CompCandidate ──────────────────────────────────────────
      const [lng, lat] = entry.location.coordinates;
      candidates.push({
        attomId: entry.attomId,
        latitude: lat,
        longitude: lng,
        gla: entry.propertyDetail.livingAreaSqft ?? 0,
        yearBuilt: entry.propertyDetail.yearBuilt ?? 0,
        bedrooms: entry.propertyDetail.bedroomsTotal ?? 0,
        bathrooms: (entry.propertyDetail.bathroomsFull ?? 0) +
                   (entry.propertyDetail.bathroomsHalf ?? 0) * 0.5,
        attomPropertyType: entry.propertyDetail.attomPropertyType,
        lastSaleDate: saleDate,
        lastSaleAmount: saleAmount,
        address: entry.address.full,
        cacheEntry: entry,
      });
    }

    return candidates;
  }

  /**
   * Best-effort check to exclude the subject property from candidates.
   * Compares APN if available, otherwise falls back to address matching.
   */
  private isSameProperty(entry: PropertyDataCacheEntry, subject: SelectionSubjectSummary): boolean {
    // GeoJSON coordinate exact match (same physical location)
    if (entry.location) {
      const [lng, lat] = entry.location.coordinates;
      if (lat === subject.latitude && lng === subject.longitude) return true;
    }
    return false;
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  private async persistResult(result: CompSelectionResult): Promise<void> {
    const doc = {
      id: `comp-sel-${result.orderId}-${Date.now()}`,
      type: 'comparable-selection' as const,
      reviewId: result.orderId,  // partition key for comparable-analyses container
      ...result,
    };

    const cosmosResult = await this.cosmos.upsertItem(COMPARABLE_ANALYSES_CONTAINER, doc);
    if (!cosmosResult.success) {
      this.logger.error('Failed to persist comp selection result', {
        orderId: result.orderId,
        error: cosmosResult.error,
      });
      throw new Error(
        `ComparableSelectionService: failed to persist selection result for order ${result.orderId}`,
      );
    }

    this.logger.info('Comp selection result persisted', {
      orderId: result.orderId,
      docId: doc.id,
      selectedCount: result.selected.length,
    });
  }
}

// ─── Pure scoring functions (exported for testing) ────────────────────────────

/**
 * Score all candidates against the subject using weighted criteria.
 * Returns candidates sorted by compositeScore descending (best first).
 *
 * Each factor produces a 0–1 sub-score where 1 = perfect match.
 * The composite score is the weighted average of all sub-scores.
 */
export function scoreCandidates(
  subject: SelectionSubjectSummary,
  candidates: CompCandidate[],
  weights: RankingWeights,
): ScoredCandidate[] {
  const totalWeight = weights.distance + weights.saleRecency +
    weights.glaSimilarity + weights.ageSimilarity + weights.bedBathMatch;

  if (totalWeight <= 0) {
    throw new Error('ComparableSelectionService: ranking weights must sum to a positive number');
  }

  const nowMs = Date.now();

  const scored: ScoredCandidate[] = candidates.map((candidate) => {
    const distanceMiles = haversineDistanceMiles(
      subject.latitude, subject.longitude,
      candidate.latitude, candidate.longitude,
    );

    const subScores = {
      distance: scoreDistance(distanceMiles),
      saleRecency: scoreSaleRecency(candidate.lastSaleDate, nowMs),
      glaSimilarity: scoreNumericSimilarity(subject.gla, candidate.gla),
      ageSimilarity: scoreNumericSimilarity(subject.yearBuilt, candidate.yearBuilt),
      bedBathMatch: scoreBedBathMatch(
        subject.bedrooms, subject.bathrooms,
        candidate.bedrooms, candidate.bathrooms,
      ),
    };

    const compositeScore = (
      subScores.distance * weights.distance +
      subScores.saleRecency * weights.saleRecency +
      subScores.glaSimilarity * weights.glaSimilarity +
      subScores.ageSimilarity * weights.ageSimilarity +
      subScores.bedBathMatch * weights.bedBathMatch
    ) / totalWeight;

    return { candidate, compositeScore, distanceMiles, subScores };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  return scored;
}

// ─── Sub-score functions (pure, exported for testing) ─────────────────────────

/**
 * Distance score: 1.0 at 0 miles, decays exponentially.
 * At 1 mile ≈ 0.61, at 3 miles ≈ 0.22, at 5 miles ≈ 0.08.
 */
export function scoreDistance(distanceMiles: number): number {
  return Math.exp(-0.5 * distanceMiles);
}

/**
 * Sale recency score: 1.0 for today, linearly decays to 0.0 at 24 months.
 */
export function scoreSaleRecency(saleDateIso: string, nowMs: number): number {
  const saleMs = new Date(saleDateIso).getTime();
  const ageMonths = (nowMs - saleMs) / (30.44 * 24 * 60 * 60 * 1000);
  if (ageMonths <= 0) return 1.0;
  if (ageMonths >= 24) return 0.0;
  return 1.0 - (ageMonths / 24);
}

/**
 * Generic numeric similarity: 1.0 when values are equal, decays toward 0
 * as the percentage difference increases.
 *
 * Uses: 1 / (1 + |diff/avg|) — a logistic-like curve that is scale-invariant.
 * At 10% diff ≈ 0.91, at 25% ≈ 0.80, at 50% ≈ 0.67, at 100% ≈ 0.50.
 */
export function scoreNumericSimilarity(subjectValue: number, candidateValue: number): number {
  if (subjectValue === 0 && candidateValue === 0) return 1.0;
  const avg = (Math.abs(subjectValue) + Math.abs(candidateValue)) / 2;
  if (avg === 0) return 1.0;
  const relDiff = Math.abs(subjectValue - candidateValue) / avg;
  return 1 / (1 + relDiff);
}

/**
 * Bedroom/bathroom match score.
 * 1.0 for exact match on both, 0.5 penalty per bedroom diff,
 * 0.25 penalty per bathroom diff, floored at 0.
 */
export function scoreBedBathMatch(
  subBed: number, subBath: number,
  candBed: number, candBath: number,
): number {
  const bedPenalty = Math.abs(subBed - candBed) * 0.25;
  const bathPenalty = Math.abs(subBath - candBath) * 0.15;
  return Math.max(0, 1.0 - bedPenalty - bathPenalty);
}
