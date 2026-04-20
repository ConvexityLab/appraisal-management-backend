/**
 * Comparable Selection Types
 *
 * Types for the automated comparable-property selection pipeline that runs
 * when certain order types are created (BPO, Desktop Review, DVR, etc.).
 *
 * Two-phase pipeline:
 *   Phase 1 — Build a candidate pool from `property-data-cache` using
 *             geospatial radius search + hard disqualification filters.
 *   Phase 2 — Score and rank candidates via weighted criteria, return top N.
 *
 * @see ComparableSelectionService
 */

import type { PropertyDataCacheEntry } from '../services/property-data-cache.service.js';
import type { PropertyRecordType } from './property-record.types.js';

// ─── Ranking Weights ──────────────────────────────────────────────────────────

/**
 * Relative importance of each scoring factor.
 * Each weight is a positive number; they are normalized to sum to 1.0
 * inside the scoring function, so absolute values don't matter —
 * only relative ratios.
 *
 * All factors produce a 0–1 sub-score where 1 = best match.
 */
export interface RankingWeights {
  /** Proximity: closer to subject = higher score. */
  distance: number;
  /** Sale recency: more recent sale date = higher score. */
  saleRecency: number;
  /** GLA similarity: closer living area to subject = higher score. */
  glaSimilarity: number;
  /** Age similarity: closer yearBuilt to subject = higher score. */
  ageSimilarity: number;
  /** Bedroom/bathroom match: exact or near match = higher score. */
  bedBathMatch: number;
}

// ─── Per-Product-Type Configuration ───────────────────────────────────────────

export interface CompSelectionConfig {
  /** Search radius in miles for the ST_DISTANCE spatial query. */
  radiusMiles: number;
  /** Only consider properties with a sale within this many months of today. */
  saleDateMaxMonths: number;
  /** Maximum candidates to fetch from the spatial query (Cosmos TOP limit). */
  maxCandidates: number;
  /** How many top-ranked comparables to return. */
  topN: number;
  /** Ranking weights for Phase 2 scoring. */
  weights: RankingWeights;
}

// ─── Subject Property Summary ─────────────────────────────────────────────────

/**
 * The subset of PropertyRecord data needed by the selection pipeline.
 * Extracted once at the start of selectForOrder() to avoid passing
 * the full PropertyRecord through the pipeline.
 */
export interface SelectionSubjectSummary {
  propertyId: string;
  tenantId: string;
  latitude: number;
  longitude: number;
  gla: number;
  yearBuilt: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: PropertyRecordType;
  state: string;
}

// ─── Candidate (Phase 1 output) ──────────────────────────────────────────────

/**
 * A property-data-cache entry that passed Phase 1 hard filters
 * and is eligible for Phase 2 scoring.
 */
export interface CompCandidate {
  /** The attomId from the cache entry — used as the unique candidate key. */
  attomId: string;
  latitude: number;
  longitude: number;
  gla: number;
  yearBuilt: number;
  bedrooms: number;
  bathrooms: number;
  attomPropertyType: string;
  lastSaleDate: string;
  lastSaleAmount: number;
  address: string;
  /** Reference to the full cache entry for downstream use. */
  cacheEntry: PropertyDataCacheEntry;
}

// ─── Scored Candidate (Phase 2 output) ────────────────────────────────────────

export interface ScoredCandidate {
  candidate: CompCandidate;
  /** Composite score: weighted sum of sub-scores, 0–1 where 1 = perfect match. */
  compositeScore: number;
  /** Distance from subject in miles. */
  distanceMiles: number;
  /** Individual sub-scores for transparency / debugging. */
  subScores: {
    distance: number;
    saleRecency: number;
    glaSimilarity: number;
    ageSimilarity: number;
    bedBathMatch: number;
  };
}

// ─── Selection Result ─────────────────────────────────────────────────────────

export interface CompSelectionResult {
  orderId: string;
  tenantId: string;
  propertyId: string;
  productType: string;
  /** Total candidates that passed Phase 1 filters. */
  candidateCount: number;
  /** The top-N scored comparables. */
  selected: ScoredCandidate[];
  /** Config used for this run (for auditability). */
  config: CompSelectionConfig;
  createdAt: string;
}
