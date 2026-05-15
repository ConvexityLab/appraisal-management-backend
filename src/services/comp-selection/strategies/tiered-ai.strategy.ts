/**
 * TieredAiCompSelectionStrategy
 *
 * Rule-based 5-tier filtering + AI waterfall, ported from onelend-backend's
 * `selectComps.js`. Implements `ICompSelectionStrategy` so the pipeline can
 * pick this strategy by name (`'tiered-ai'`) without referencing this class.
 *
 * Algorithm per pool (sold, then active):
 *   1. Compute distance + tier (1–5) for every candidate using
 *      `assignCompTier`. Drop tier=null candidates (no distance).
 *   2. Walk tiers 1 → 5. For each tier with candidates, call
 *      `UniversalAIService.generateCompletion()` once with the prompt body
 *      built from the subject + that tier's candidate batch.
 *   3. Parse the JSON response, validate every returned `propertyId` exists
 *      in the input batch (reject hallucinations — fail loudly).
 *   4. Accumulate selections in tier order. Stop when the accumulated count
 *      reaches `requested.{sold|active}`.
 *   5. Assign `selectionFlag` `S1..Sn` (sold) or `L1..Ln` (active) in
 *      selection order. Populate `tier`, `reasoning`, and `source: 'ai'`.
 *
 * Strict failure modes:
 *   - Subject GLA <= 0 → throws (assignCompTier guards).
 *   - LLM returns non-JSON or non-array → throws.
 *   - LLM returns a `propertyId` not in the input batch → throws.
 *
 * The strategy is pure compute. Persistence is done by the caller.
 */

import type {
  ICompSelectionStrategy,
  CompSelectionInput,
  CompSelectionResult,
  SelectedComp,
} from '../strategy.js';
import {
  assignCompTier,
  COMP_TIER_MATRIX,
} from '../../../config/comp-tiering.config.js';
import type { UniversalAIService } from '../../universal-ai.service.js';
import type { CompSelectionPromptLoader, PromptCandidate } from '../prompt-loader.js';
import { Logger } from '../../../utils/logger.js';
import { calculateHaversineDistance } from '../../../utils/geo.js';
import type { CollectedCompCandidate } from '../../../types/order-comparables.types.js';
import type { PropertyRecord } from '@l1/shared-types';

/** Per-tier LLM-call diagnostic emitted in `result.diagnostics`. */
interface TierCallDiagnostic {
  pool: 'sold' | 'active';
  tier: number;
  candidateCount: number;
  pickedCount: number;
  tokensUsed: number;
}

export class TieredAiCompSelectionStrategy implements ICompSelectionStrategy {
  public readonly name = 'tiered-ai' as const;
  private readonly logger = new Logger('TieredAiCompSelectionStrategy');

  constructor(
    private readonly ai: UniversalAIService,
    private readonly promptLoader: CompSelectionPromptLoader,
    /**
     * Optional: hard ceiling on per-pool LLM calls so a degenerate dataset
     * can't run all 5 tiers × 2 pools. Defaults to 5 (one per tier).
     */
    private readonly maxCallsPerPool: number = COMP_TIER_MATRIX.length + 1,
  ) {}

  async select(input: CompSelectionInput): Promise<CompSelectionResult> {
    const { subject, candidates, requested, orderId, clientOrderNumber, correlationId } = input;

    const subjectView = {
      gla: subject.building.gla,
      bedrooms: subject.building.bedrooms,
      bathrooms: subject.building.bathrooms,
    };

    const subjectLat = subject.address.latitude;
    const subjectLng = subject.address.longitude;
    if (subjectLat == null || subjectLng == null) {
      throw new Error(
        `TieredAiCompSelectionStrategy: subject "${subject.id}" has no lat/lng — cannot tier candidates`,
      );
    }

    // Split candidates by source.
    const soldPool = candidates.filter((c) => c.source === 'SOLD');
    const activePool = candidates.filter((c) => c.source === 'ACTIVE');

    const diagnostics: TierCallDiagnostic[] = [];

    const selectedSold = await this.runWaterfall({
      pool: 'sold',
      poolCandidates: soldPool,
      target: requested.sold,
      flagPrefix: 'S',
      subject,
      subjectView,
      subjectLat,
      subjectLng,
      diagnostics,
      correlationId,
    });
    const selectedActive = await this.runWaterfall({
      pool: 'active',
      poolCandidates: activePool,
      target: requested.active,
      flagPrefix: 'L',
      subject,
      subjectView,
      subjectLat,
      subjectLng,
      diagnostics,
      correlationId,
    });

    const shortfall: { sold?: number; active?: number } = {};
    if (selectedSold.length < requested.sold) {
      shortfall.sold = requested.sold - selectedSold.length;
    }
    if (selectedActive.length < requested.active) {
      shortfall.active = requested.active - selectedActive.length;
    }

    const result: CompSelectionResult = {
      strategyName: this.name,
      promptVersion: this.promptLoader.version,
      orderId,
      clientOrderNumber,
      selectedSold,
      selectedActive,
      diagnostics: { tierCalls: diagnostics },
    };
    if (Object.keys(shortfall).length > 0) {
      result.shortfall = shortfall;
    }

    this.logger.info('Tiered-AI selection complete', {
      orderId,
      clientOrderNumber,
      soldSelected: selectedSold.length,
      activeSelected: selectedActive.length,
      shortfall: result.shortfall,
      tierCalls: diagnostics.length,
    });

    return result;
  }

  // ─── Internal: per-pool waterfall ─────────────────────────────────────────

  private async runWaterfall(args: {
    pool: 'sold' | 'active';
    poolCandidates: CollectedCompCandidate[];
    target: number;
    flagPrefix: 'S' | 'L';
    subject: PropertyRecord;
    subjectView: { gla: number; bedrooms: number; bathrooms: number };
    subjectLat: number;
    subjectLng: number;
    diagnostics: TierCallDiagnostic[];
    correlationId: string | undefined;
  }): Promise<SelectedComp[]> {
    const { pool, poolCandidates, target, flagPrefix, subject, subjectView, subjectLat, subjectLng, diagnostics, correlationId } = args;

    if (target <= 0 || poolCandidates.length === 0) return [];

    // Tier every candidate once. Drop nulls (no distance).
    const tieredById = new Map<string, { candidate: CollectedCompCandidate; tier: number; distanceMi: number }>();
    for (const c of poolCandidates) {
      const propLat = c.propertyRecord.address.latitude;
      const propLng = c.propertyRecord.address.longitude;
      if (propLat == null || propLng == null) continue;
      const distanceMi = calculateHaversineDistance(subjectLat, subjectLng, propLat, propLng);
      const tier = assignCompTier(
        subjectView,
        {
          gla: c.propertyRecord.building.gla,
          bedrooms: c.propertyRecord.building.bedrooms,
          bathrooms: c.propertyRecord.building.bathrooms,
          lastSaleDate: c.lastSaleDate,
        },
        distanceMi,
      );
      if (tier == null) continue;
      tieredById.set(c.propertyRecord.id, { candidate: c, tier, distanceMi });
    }

    const accumulated: SelectedComp[] = [];
    const seenPropertyIds = new Set<string>();
    let calls = 0;

    for (let tier = 1; tier <= COMP_TIER_MATRIX.length + 1; tier++) {
      if (accumulated.length >= target) break;
      if (calls >= this.maxCallsPerPool) {
        this.logger.warn('Per-pool LLM-call ceiling hit — stopping waterfall', {
          pool,
          maxCallsPerPool: this.maxCallsPerPool,
          accumulated: accumulated.length,
          target,
          correlationId,
        });
        break;
      }

      const tierBatch = Array.from(tieredById.values()).filter(
        (t) => t.tier === tier && !seenPropertyIds.has(t.candidate.propertyRecord.id),
      );
      if (tierBatch.length === 0) continue;

      const remaining = target - accumulated.length;
      const promptCandidates: PromptCandidate[] = tierBatch.map((t) =>
        toPromptCandidate(t.candidate, t.distanceMi),
      );
      const promptBody = this.promptLoader.buildPrompt(
        toPromptSubject(subject),
        promptCandidates,
        remaining,
      );

      this.logger.debug('Tiered-AI: calling LLM for tier', {
        pool,
        tier,
        candidateCount: tierBatch.length,
        remaining,
        correlationId,
      });

      const aiResponse = await this.ai.generateCompletion({
        provider: 'azure-openai',
        temperature: 0,
        responseFormat: 'json',
        messages: [{ role: 'user', content: promptBody }],
      });
      calls += 1;

      const picks = parseAndValidatePicks(
        aiResponse.content,
        new Set(tierBatch.map((t) => t.candidate.propertyRecord.id)),
      );

      let pickedThisTier = 0;
      for (const pick of picks) {
        if (accumulated.length >= target) break;
        if (seenPropertyIds.has(pick.propertyId)) continue;
        const tierEntry = tieredById.get(pick.propertyId)!;
        const c = tierEntry.candidate;
        accumulated.push({
          propertyId: pick.propertyId,
          street: c.propertyRecord.address.street,
          city: c.propertyRecord.address.city,
          state: c.propertyRecord.address.state,
          zip: c.propertyRecord.address.zip,
          tier: tierEntry.tier,
          selectionFlag: `${flagPrefix}${accumulated.length + 1}`,
          ...(pick.reasoning ? { reasoning: pick.reasoning } : {}),
          source: 'ai',
        });
        seenPropertyIds.add(pick.propertyId);
        pickedThisTier += 1;
      }

      diagnostics.push({
        pool,
        tier,
        candidateCount: tierBatch.length,
        pickedCount: pickedThisTier,
        tokensUsed: aiResponse.tokensUsed,
      });
    }

    return accumulated;
  }
}

// ─── Pure helpers (exported for testing if needed) ──────────────────────────

function toPromptSubject(subject: PropertyRecord): Record<string, unknown> {
  // Trim down to just the fields the model needs for selection. Avoids
  // sending volatile fields like _etag / version history.
  //
  // Phase P6 note: `avm` here is a runtime projection already attached to the
  // subject input for this selection flow. The tiered-AI strategy does not
  // reach back into property observations; canonical API/controller paths own
  // observation-derived AVM materialization.
  return {
    propertyId: subject.id,
    address: subject.address,
    propertyType: subject.propertyType,
    building: subject.building,
    avm: subject.avm,
  };
}

function toPromptCandidate(
  c: CollectedCompCandidate,
  distanceMi: number,
): PromptCandidate {
  // Candidate `propertyRecord.avm` is a per-run comp-collection projection,
  // not a canonical parcel truth read. Keep that boundary explicit so this
  // strategy remains pure over the assembled candidate batch.
  return {
    propertyId: c.propertyRecord.id,
    address: c.propertyRecord.address,
    propertyType: c.propertyRecord.propertyType,
    building: c.propertyRecord.building,
    avm: c.propertyRecord.avm,
    distanceMiles: distanceMi,
    lastSalePrice: c.lastSalePrice,
    lastSaleDate: c.lastSaleDate,
  };
}

interface AiPick {
  propertyId: string;
  reasoning?: string;
}

/**
 * Parse the LLM's response into a list of picks. Throws on malformed JSON,
 * non-array responses, missing `propertyId`, or hallucinated ids that aren't
 * in `validIds`.
 *
 * The function is permissive about leading/trailing whitespace and code-fence
 * wrappers (```json ... ```) — some models add them despite instructions —
 * but never silently swaps the content.
 */
export function parseAndValidatePicks(
  rawContent: string,
  validIds: Set<string>,
): AiPick[] {
  const stripped = stripCodeFences(rawContent.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(
      `TieredAiCompSelectionStrategy: failed to parse AI response as JSON — ${
        err instanceof Error ? err.message : String(err)
      }. Raw: ${truncate(rawContent, 500)}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `TieredAiCompSelectionStrategy: AI response was not a JSON array (got ${typeof parsed}). Raw: ${truncate(
        rawContent,
        500,
      )}`,
    );
  }

  const picks: AiPick[] = [];
  for (const [i, entry] of parsed.entries()) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(
        `TieredAiCompSelectionStrategy: AI response item ${i} is not an object`,
      );
    }
    const obj = entry as Record<string, unknown>;
    const propertyId = obj.propertyId;
    if (typeof propertyId !== 'string' || propertyId.length === 0) {
      throw new Error(
        `TieredAiCompSelectionStrategy: AI response item ${i} missing string propertyId`,
      );
    }
    if (!validIds.has(propertyId)) {
      throw new Error(
        `TieredAiCompSelectionStrategy: AI returned propertyId "${propertyId}" not present in the input batch (hallucination)`,
      );
    }
    const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : undefined;
    picks.push(reasoning != null ? { propertyId, reasoning } : { propertyId });
  }
  return picks;
}

function stripCodeFences(s: string): string {
  if (s.startsWith('```')) {
    const firstNl = s.indexOf('\n');
    const closing = s.lastIndexOf('```');
    if (firstNl > 0 && closing > firstNl) {
      return s.slice(firstNl + 1, closing).trim();
    }
  }
  return s;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '…';
}
