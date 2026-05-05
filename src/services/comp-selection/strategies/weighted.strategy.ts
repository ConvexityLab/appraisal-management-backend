/**
 * WeightedCompSelectionStrategy
 *
 * Adapter that runs the existing weighted-scoring algorithm
 * (`scoreCandidates` from comparable-selection.service.ts) against the
 * candidate-pool model used by the new `ICompSelectionStrategy` contract.
 *
 * Why an adapter (not a wrapper around `ComparableSelectionService.selectForOrder`):
 * the legacy service queries `property-data-cache` fresh from Cosmos, while
 * the strategy contract receives an already-collected pool of
 * `CollectedCompCandidate`. We re-use the pure scoring functions and
 * ignore the legacy DB-fetch path — keeps unit-testable, no I/O.
 *
 * Splits the pool into SOLD vs ACTIVE per `requested.sold` / `.active`
 * counts. ACTIVE candidates have no sale date, so the ACTIVE pool is
 * scored with a derived weight set (`weightsForActive`) that zeroes the
 * `saleRecency` weight; `scoreCandidates` divides by the sum of weights,
 * so the remaining four factors (distance / GLA / age / bed-bath) are
 * automatically renormalized.
 *
 * Strict failure modes (no silent fallbacks):
 *   - Subject lacks lat/lng → throws.
 *   - Subject GLA <= 0 → throws.
 */

import { Logger } from '../../../utils/logger.js';
import type { PropertyRecord } from '../../../types/property-record.types.js';
import type {
  CompCandidate,
  ScoredCandidate,
  SelectionSubjectSummary,
  RankingWeights,
} from '../../../types/comparable-selection.types.js';
import { scoreCandidates } from '../../comparable-selection.service.js';
import type { CollectedCompCandidate } from '../../../types/order-comparables.types.js';
import type {
  CompSelectionInput,
  CompSelectionResult,
  ICompSelectionStrategy,
  SelectedComp,
} from '../strategy.js';

/**
 * Default weights — kept in sync intentionally with the legacy
 * ComparableSelectionService DEFAULT_WEIGHTS via duplication so this
 * strategy can run without importing private symbols. If the legacy
 * weights are tuned, mirror the change here.
 */
const DEFAULT_WEIGHTS: RankingWeights = {
  distance: 30,
  saleRecency: 25,
  glaSimilarity: 20,
  ageSimilarity: 15,
  bedBathMatch: 10,
};

/**
 * Derive a weight set for the ACTIVE pool by zeroing out `saleRecency`
 * (active listings have no sale date) and redistributing nothing — the
 * `scoreCandidates` composite already divides by the sum of weights, so
 * setting one weight to 0 effectively renormalizes the remaining four.
 */
function weightsForActive(base: RankingWeights): RankingWeights {
  return { ...base, saleRecency: 0 };
}

export class WeightedCompSelectionStrategy implements ICompSelectionStrategy {
  public readonly name = 'weighted' as const;
  private readonly logger = new Logger('WeightedCompSelectionStrategy');
  private readonly weights: RankingWeights;

  constructor(weights: RankingWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  async select(input: CompSelectionInput): Promise<CompSelectionResult> {
    const { orderId, clientOrderNumber, subject, candidates, requested, correlationId } = input;

    const subjectLat = subject.address.latitude;
    const subjectLng = subject.address.longitude;
    if (subjectLat == null || subjectLng == null) {
      throw new Error(
        `WeightedCompSelectionStrategy: subject "${subject.id}" has no lat/lng — cannot score candidates`,
      );
    }
    if (!(subject.building.gla > 0)) {
      throw new Error(
        `WeightedCompSelectionStrategy: subject "${subject.id}" has gla <= 0 (${subject.building.gla})`,
      );
    }

    const subjectSummary: SelectionSubjectSummary = {
      propertyId: subject.id,
      tenantId: input.tenantId,
      latitude: subjectLat,
      longitude: subjectLng,
      gla: subject.building.gla,
      yearBuilt: subject.building.yearBuilt ?? 0,
      bedrooms: subject.building.bedrooms,
      bathrooms: subject.building.bathrooms,
      propertyType: subject.propertyType,
      state: subject.address.state,
    };

    const soldPool = candidates.filter((c) => c.source === 'SOLD');
    const activePool = candidates.filter((c) => c.source === 'ACTIVE');

    const selectedSold = this.scoreAndPick(
      subjectSummary,
      soldPool,
      requested.sold,
      'S',
      this.weights,
    );
    const selectedActive = this.scoreAndPick(
      subjectSummary,
      activePool,
      requested.active,
      'L',
      weightsForActive(this.weights),
    );

    const shortfall: CompSelectionResult['shortfall'] = {};
    if (selectedSold.length < requested.sold) shortfall.sold = requested.sold - selectedSold.length;
    if (selectedActive.length < requested.active) shortfall.active = requested.active - selectedActive.length;

    this.logger.info('Weighted selection complete', {
      orderId,
      correlationId,
      soldRequested: requested.sold,
      soldPicked: selectedSold.length,
      activeRequested: requested.active,
      activePicked: selectedActive.length,
    });

    const result: CompSelectionResult = {
      strategyName: this.name,
      orderId,
      clientOrderNumber,
      selectedSold,
      selectedActive,
    };
    if (shortfall.sold !== undefined || shortfall.active !== undefined) {
      result.shortfall = shortfall;
    }
    return result;
  }

  private scoreAndPick(
    subject: SelectionSubjectSummary,
    pool: CollectedCompCandidate[],
    target: number,
    flagPrefix: 'S' | 'L',
    weights: RankingWeights,
  ): SelectedComp[] {
    if (target <= 0 || pool.length === 0) return [];

    // Map CollectedCompCandidate → CompCandidate (the shape scoreCandidates expects).
    // Drop candidates lacking lat/lng — they can't be scored on distance.
    const compCandidates: Array<{ src: CollectedCompCandidate; cc: CompCandidate }> = [];
    for (const c of pool) {
      const lat = c.propertyRecord.address.latitude;
      const lng = c.propertyRecord.address.longitude;
      if (lat == null || lng == null) continue;
      compCandidates.push({
        src: c,
        cc: {
          attomId: c.propertyRecord.id,
          latitude: lat,
          longitude: lng,
          gla: c.propertyRecord.building.gla,
          yearBuilt: c.propertyRecord.building.yearBuilt ?? 0,
          bedrooms: c.propertyRecord.building.bedrooms,
          bathrooms: c.propertyRecord.building.bathrooms,
          attomPropertyType: String(c.propertyRecord.propertyType),
          // ACTIVE candidates have no sale date. We zero out the saleRecency
          // weight for the ACTIVE pool (see weightsForActive), but still must
          // pass a parseable ISO string here — `0 * NaN === NaN` would poison
          // the composite. Epoch (1970) yields scoreSaleRecency = 0, then
          // multiplied by weight 0 contributes nothing.
          lastSaleDate: c.lastSaleDate ?? new Date(0).toISOString(),
          lastSaleAmount: c.lastSalePrice ?? 0,
          address: `${c.propertyRecord.address.street}, ${c.propertyRecord.address.city}`,
          // cacheEntry is not used by scoreCandidates — pass a minimal stub.
          cacheEntry: undefined as unknown as CompCandidate['cacheEntry'],
        },
      });
    }
    if (compCandidates.length === 0) return [];

    const byAttomId = new Map(compCandidates.map((x) => [x.cc.attomId, x.src]));
    const scored: ScoredCandidate[] = scoreCandidates(
      subject,
      compCandidates.map((x) => x.cc),
      weights,
    );

    const picked: SelectedComp[] = [];
    for (const s of scored) {
      if (picked.length >= target) break;
      const src = byAttomId.get(s.candidate.attomId);
      if (!src) continue;
      picked.push({
        propertyId: src.propertyRecord.id,
        street: src.propertyRecord.address.street,
        city: src.propertyRecord.address.city,
        state: src.propertyRecord.address.state,
        zip: src.propertyRecord.address.zip,
        selectionFlag: `${flagPrefix}${picked.length + 1}`,
        score: s.compositeScore,
        source: 'rule',
      });
    }
    return picked;
  }
}
