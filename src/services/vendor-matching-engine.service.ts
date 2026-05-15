/**
 * Vendor Matching Engine Service
 * Intelligent vendor selection using multi-factor scoring algorithm
 * 
 * Scoring Factors:
 * - Performance Score (30%): Historical quality and reliability
 * - Availability (25%): Current capacity and workload
 * - Geographic Proximity (20%): Distance to property
 * - Experience (15%): Property type specialization
 * - Cost Competitiveness (10%): Fee alignment with budget
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { VendorPerformanceCalculatorService } from './vendor-performance-calculator.service';
import {
  type RuleEvaluationContext,
  type RuleEvaluationResult,
} from './vendor-matching-rules.service.js';
import {
  type VendorMatchingRulesProvider,
  createVendorMatchingRulesProvider,
} from './vendor-matching-rules/index.js';
import {
  VendorMatchRequest,
  VendorMatchResult,
  VendorMatchCriteria,
  VendorAvailability,
  VendorPerformanceMetrics,
  MatchExplanation,
  DeniedVendorEntry,
  GeographicArea,
  NoMatchReason,
  NoMatchReasonCode,
} from '../types/vendor-marketplace.types.js';
import {
  VendorMatchingCriteriaService,
  type ResolvedCriteriaProfile,
} from './vendor-matching-criteria.service.js';
import { AuditTrailService } from './audit-trail.service.js';

/**
 * Tag identifying the scoring profile used (T6 audit). Bump when weights or
 * band thresholds change so historical match explanations remain replayable.
 */
const WEIGHTS_VERSION = 'v1-30/25/20/15/10';

// ─── Phase B helpers (no-match reason + radius override + toggles) ─────────

/**
 * Convert a resolved criteria profile's per-criterion enabled+weight
 * settings into the fixed-weight shape the scorer expects. Disabled
 * criteria get weight=0; remaining weights renormalize so the total sums
 * to 1.0. This keeps the per-criterion score values 0..100 from the
 * existing calculators, while letting Doug toggle proximity off for DVR
 * without re-implementing the scorer.
 */
export function computeEffectiveWeights(
  criteria: import('../types/vendor-marketplace.types.js').VendorMatchingCriteriaProfile['criteria'],
): { performance: number; availability: number; proximity: number; experience: number; cost: number } {
  const raw = {
    performance: criteria.performance.enabled ? criteria.performance.weight : 0,
    availability: criteria.availability.enabled ? criteria.availability.weight : 0,
    proximity: criteria.proximity.enabled && criteria.proximity.mode === 'SCORED' ? criteria.proximity.weight : 0,
    experience: criteria.experience.enabled ? criteria.experience.weight : 0,
    cost: criteria.cost.enabled ? criteria.cost.weight : 0,
  };
  const sum = raw.performance + raw.availability + raw.proximity + raw.experience + raw.cost;
  if (sum <= 0) {
    // Pathological: no SCORED criterion. Fall back to the legacy weights so
    // we still rank vendors (every disabled criterion just contributes 0).
    return { performance: 0.30, availability: 0.25, proximity: 0.20, experience: 0.15, cost: 0.10 };
  }
  return {
    performance: raw.performance / sum,
    availability: raw.availability / sum,
    proximity: raw.proximity / sum,
    experience: raw.experience / sum,
    cost: raw.cost / sum,
  };
}

// ─── Phase B helpers (no-match reason + radius override) ────────────────────

function withMaxDistance(
  request: VendorMatchRequest,
  maxDistance: number,
): VendorMatchRequest {
  return {
    ...request,
    clientPreferences: {
      ...(request.clientPreferences ?? {}),
      maxDistance,
    },
  };
}

export function inferNoMatchReason(
  denied: DeniedVendorEntry[],
  ctx: { radiusUsed: number; productState?: string },
): NoMatchReason {
  if (denied.length === 0) {
    // Nothing came back at all — either no vendors exist or none cover the area.
    return {
      code: 'NO_VENDOR_WITHIN_RADIUS',
      message: `No vendor was found within ${ctx.radiusUsed} miles of the property.`,
      hints: [
        'Widen the search radius or attach a fallback overlay.',
        'Check that at least one vendor covers this geography.',
      ],
    };
  }

  // Aggregate denial reasons so we can pick the dominant one. Sanitised — we
  // expose categories, not per-vendor reasons (Doug: "don't list everything").
  const reasonHits: Record<NoMatchReasonCode, number> = {
    NO_LICENSED_VENDOR_IN_STATE: 0,
    NO_VENDOR_WITHIN_RADIUS: 0,
    NO_VENDOR_WITH_CAPACITY: 0,
    NO_VENDOR_MEETS_TIER: 0,
    ALL_VENDORS_EXCLUDED_BY_RULES: 0,
    UNKNOWN: 0,
  };
  for (const entry of denied) {
    const joined = entry.denyReasons.join(' ').toLowerCase();
    if (joined.includes('licens') || joined.includes('state')) {
      reasonHits.NO_LICENSED_VENDOR_IN_STATE++;
    } else if (joined.includes('distance') || joined.includes('mile') || joined.includes('proximity')) {
      reasonHits.NO_VENDOR_WITHIN_RADIUS++;
    } else if (joined.includes('capacity') || joined.includes('available') || joined.includes('busy')) {
      reasonHits.NO_VENDOR_WITH_CAPACITY++;
    } else if (joined.includes('tier') || joined.includes('rating')) {
      reasonHits.NO_VENDOR_MEETS_TIER++;
    } else {
      reasonHits.ALL_VENDORS_EXCLUDED_BY_RULES++;
    }
  }
  const top = (Object.entries(reasonHits) as [NoMatchReasonCode, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0]!;
  const code = top[0];

  const messages: Record<NoMatchReasonCode, string> = {
    NO_LICENSED_VENDOR_IN_STATE: ctx.productState
      ? `No vendor licensed in ${ctx.productState} qualified for this assignment.`
      : 'No vendor with proper state licensing qualified.',
    NO_VENDOR_WITHIN_RADIUS: `No vendor qualified within ${ctx.radiusUsed} miles of the property.`,
    NO_VENDOR_WITH_CAPACITY: 'Every qualified vendor is at capacity or on vacation.',
    NO_VENDOR_MEETS_TIER: 'No vendor meets the minimum performance/tier threshold for this work.',
    ALL_VENDORS_EXCLUDED_BY_RULES:
      'Every candidate was excluded by the active assignment rules. Review the rule pack.',
    UNKNOWN: 'No vendor matched for an unspecified reason.',
  };

  return {
    code,
    message: messages[code],
  };
}

/**
 * Resolve the per-vendor product-weight overlay for a given product type.
 * Returns 1.0 (no adjustment) when:
 *   - vendor has no productWeights array
 *   - request has no productId
 *   - no entry matches the productId
 * Clamps the returned weight to [0.0, 2.0] so a single overlay can't fully
 * zero a vendor (use eligibleProductIds for hard gates) or 10x them past
 * the rest of the candidate pool.
 */
export function lookupProductWeight(
  vendor: { productWeights?: Array<{ productType: string; weight: number }> },
  productId: string | undefined,
): number {
  if (!productId || !vendor.productWeights || vendor.productWeights.length === 0) {
    return 1.0;
  }
  const entry = vendor.productWeights.find((e) => e.productType === productId);
  if (!entry || typeof entry.weight !== 'number' || Number.isNaN(entry.weight)) {
    return 1.0;
  }
  return Math.max(0.0, Math.min(2.0, entry.weight));
}

function extractStateHint(request: VendorMatchRequest): string | undefined {
  // The request carries propertyAddress as a single string; try to pull a
  // two-letter state code from the tail.
  const match = request.propertyAddress?.match(/\b([A-Z]{2})\b/);
  return match?.[1];
}

interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export class VendorMatchingEngine {
  private logger: Logger;
  private dbService: CosmosDbService;
  private performanceService: VendorPerformanceCalculatorService;
  private rulesProvider: VendorMatchingRulesProvider;

  // Scoring weights (must sum to 1.0)
  private readonly WEIGHTS = {
    performance: 0.30,
    availability: 0.25,
    proximity: 0.20,
    experience: 0.15,
    cost: 0.10
  };

  // Distance thresholds (miles)
  private readonly DISTANCE_THRESHOLDS = {
    local: 25,      // < 25 miles: 100 points
    regional: 75,   // 25-75 miles: 80 points
    extended: 150,  // 75-150 miles: 60 points
    remote: 300     // 150-300 miles: 40 points
    // > 300 miles: 0 points
  };

  constructor(rulesProvider?: VendorMatchingRulesProvider) {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.performanceService = new VendorPerformanceCalculatorService();
    // Phase 2: rules evaluation goes through a pluggable provider — homegrown
    // (default), MOP (when enabled via env), or MOP-with-fallback. Engine no
    // longer talks to VendorMatchingRulesService directly. See
    // src/services/vendor-matching-rules/factory.ts for env-driven selection.
    // Tenants with no rules see zero behavior change.
    this.rulesProvider = rulesProvider ?? createVendorMatchingRulesProvider({ dbService: this.dbService });
  }

  /**
   * Find best matching vendors for an order
   */
  async findMatchingVendors(
    request: VendorMatchRequest,
    topN: number = 10
  ): Promise<VendorMatchResult[]> {
    try {
      this.logger.info('Finding matching vendors', {
        propertyAddress: request.propertyAddress,
        propertyType: request.propertyType,
        topN
      });

      // Get property coordinates
      const propertyCoords = await this.geocodeAddress(request.propertyAddress);

      // Fetch product once so gradeBonus values come from the product document,
      // not hardcoded constants. Absent/null gracefully degrades (no grade bonus).
      let productGradeLevels: import('../types/index.js').GradeLevel[] | undefined;
      if (request.productId) {
        const productResult = await this.dbService.findProductById(request.productId, request.tenantId);
        productGradeLevels = productResult.data?.gradeLevels ?? undefined;
      }

      // Get eligible vendors (with precomputed per-vendor distance — see T3 in
      // docs/AUTO_ASSIGNMENT_REVIEW.md). Distance is computed once here so it is
      // available to both the rules engine (T4, max_distance_miles rule) and the
      // proximity scorer without recomputation.
      const { eligible: eligibleVendors } = await this.getEligibleVendors(request, propertyCoords);
      this.logger.info(`Found ${eligibleVendors.length} eligible vendors`);

      if (eligibleVendors.length === 0) {
        return [];
      }

      // Score each vendor (T4: ruleResult collected here, applied to score in T5)
      const scoredVendors = await Promise.all(
        eligibleVendors.map(({ vendor, distance, ruleResult }) =>
          this.scoreVendor(vendor, request, propertyCoords, distance, ruleResult, undefined, productGradeLevels)
        )
      );

      // Sort by match score (descending) and return top N
      const results = scoredVendors
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, topN);

      this.logger.info(`Returning top ${results.length} matches`, {
        topScore: results[0]?.matchScore,
        averageScore: results.reduce((sum, r) => sum + r.matchScore, 0) / results.length
      });

      return results;

    } catch (error: any) {
      this.logger.error('Failed to find matching vendors', error);
      throw error;
    }
  }

  /**
   * Like findMatchingVendors but also returns the list of vendors filtered out
   * by deny rules (with reasons). Used by the orchestrator to persist the full
   * audit trail (denied + ranked) onto the order — see T6/F9.
   */
  async findMatchingVendorsAndDenied(
    request: VendorMatchRequest,
    topN: number = 10,
    /**
     * Phase B — optional resolved criteria profile. When supplied, scoreVendor
     * honours toggles + renormalized weights + licensure HARD_GATE. When
     * absent (the public legacy contract), the fixed-weight scorer runs.
     */
    criteriaProfile?: import('../types/vendor-marketplace.types.js').VendorMatchingCriteriaProfile['criteria'],
  ): Promise<{
    matches: VendorMatchResult[];
    denied: DeniedVendorEntry[];
    /**
     * Phase D.faithful — frozen-fact snapshot of every {vendor, order}
     * bundle the rules engine evaluated. Orchestrator persists this on
     * the assignment-trace doc so Sandbox replay re-evaluates proposed
     * rules against the SAME facts that drove the original decision
     * (not against possibly-drifted current vendor data).
     */
    evaluationsSnapshot: Array<{
      vendor: {
        id: string;
        capabilities?: string[];
        states?: string[];
        performanceScore?: number;
        licenseType?: string;
        distance?: number | null;
      };
      order: { productType?: string; propertyState?: string };
      originallyRanked: boolean;
      originalScore: number;
    }>;
  }> {
    const propertyCoords = await this.geocodeAddress(request.propertyAddress);
    const { eligible, denied } = await this.getEligibleVendors(request, propertyCoords);

    if (eligible.length === 0) {
      return { matches: [], denied, evaluationsSnapshot: [] };
    }

    // Fetch product once so gradeBonus values come from the product document.
    let productGradeLevels: import('../types/index.js').GradeLevel[] | undefined;
    if (request.productId) {
      const productResult = await this.dbService.findProductById(request.productId, request.tenantId);
      productGradeLevels = productResult.data?.gradeLevels ?? undefined;
    }

    const scoredVendors = await Promise.all(
      eligible.map(({ vendor, distance, ruleResult }) =>
        this.scoreVendor(vendor, request, propertyCoords, distance, ruleResult, criteriaProfile, productGradeLevels)
      )
    );

    const matches = scoredVendors
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, topN);

    const evaluationsSnapshot = [
      ...eligible.map(({ vendor, distance }) => ({
        vendor: {
          id: vendor.id as string,
          ...(Array.isArray(vendor.capabilities) ? { capabilities: vendor.capabilities as string[] } : {}),
          ...(Array.isArray((vendor as Record<string, unknown>).serviceAreas)
            ? {
                states: ((vendor as Record<string, unknown>).serviceAreas as Array<{ state?: string }>)
                  .map(s => s.state)
                  .filter((x): x is string => !!x),
              }
            : {}),
          ...(typeof (vendor as Record<string, unknown>).overallScore === 'number'
            ? { performanceScore: (vendor as Record<string, unknown>).overallScore as number }
            : {}),
          ...(typeof (vendor as Record<string, unknown>).licenseType === 'string'
            ? { licenseType: (vendor as Record<string, unknown>).licenseType as string }
            : {}),
          distance: distance ?? null,
        },
        order: {
          ...(request.productId ? { productType: request.productId } : {}),
        },
        originallyRanked: true,
        originalScore: matches.find(m => m.vendorId === vendor.id)?.matchScore ?? 0,
      })),
      ...denied.map(d => ({
        vendor: { id: d.vendorId },
        order: { ...(request.productId ? { productType: request.productId } : {}) },
        originallyRanked: false,
        originalScore: 0,
      })),
    ];

    return { matches, denied, evaluationsSnapshot };
  }

  /**
   * Phase B — match with David/Doug's per-product overlays + a "why no match"
   * reason when results are empty.
   *
   * Pipeline:
   *   1. Resolve the active criteria profile for the (tenant, clientId,
   *      productType, phase) tuple — overlays merged BASE → CLIENT → PRODUCT
   *      → CLIENT_PRODUCT.
   *   2. Run findMatchingVendorsAndDenied with the resolved profile's
   *      primary proximity radius applied to the request's
   *      clientPreferences.maxDistance.
   *   3. If empty AND profile.proximity.expansionRadiusMiles is set,
   *      RE-RUN with the wider radius (Doug's 30→50 mi pattern).
   *   4. If still empty, infer a NoMatchReason from the denied list.
   *
   * NOTE: This is a wrapper. Per-criterion toggle enforcement in scoreVendor
   * (e.g. "skip proximity for DVR product") is the larger rewrite of
   * scoreVendor/getEligibleVendors and is intentionally deferred. The
   * existing weights remain in force; this method changes the OUTER
   * search behaviour and surfaces the no-match reason.
   */
  async findMatchingVendorsWithReason(
    request: VendorMatchRequest,
    options: {
      clientId?: string;
      phase?: 'ORIGINAL' | 'REVIEW';
      topN?: number;
    } = {},
  ): Promise<{
    matches: VendorMatchResult[];
    denied: DeniedVendorEntry[];
    appliedProfileIds: string[];
    noMatchReason: NoMatchReason | null;
    expansionApplied: boolean;
  }> {
    const topN = options.topN ?? 10;
    const criteriaService = new VendorMatchingCriteriaService(
      this.dbService,
      new AuditTrailService(this.dbService),
    );
    const resolved = await criteriaService.resolveProfile({
      tenantId: request.tenantId,
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(request.productId ? { productType: request.productId } : {}),
      ...(options.phase ? { phase: options.phase } : {}),
    });

    const primaryRadius = resolved.criteria.proximity.primaryRadiusMiles;
    const expansionRadius = resolved.criteria.proximity.expansionRadiusMiles;

    // First pass with primary radius — pass criteria through so toggles +
    // licensure HARD_GATE + renormalized weights apply.
    const firstPass = await this.findMatchingVendorsAndDenied(
      withMaxDistance(request, primaryRadius),
      topN,
      resolved.criteria,
    );
    if (firstPass.matches.length > 0) {
      return {
        matches: firstPass.matches,
        denied: firstPass.denied,
        appliedProfileIds: resolved.appliedProfileIds,
        noMatchReason: null,
        expansionApplied: false,
      };
    }

    // Expansion pass (Doug's pattern: 30 → 50 mi).
    if (expansionRadius && expansionRadius > primaryRadius) {
      this.logger.info('No matches at primary radius — expanding', {
        primaryRadius,
        expansionRadius,
      });
      const secondPass = await this.findMatchingVendorsAndDenied(
        withMaxDistance(request, expansionRadius),
        topN,
        resolved.criteria,
      );
      if (secondPass.matches.length > 0) {
        return {
          matches: secondPass.matches,
          denied: secondPass.denied,
          appliedProfileIds: resolved.appliedProfileIds,
          noMatchReason: null,
          expansionApplied: true,
        };
      }
      // Still nothing — fall through to reason inference, using the wider
      // denied list which is more informative.
      return {
        matches: [],
        denied: secondPass.denied,
        appliedProfileIds: resolved.appliedProfileIds,
        noMatchReason: inferNoMatchReason(secondPass.denied, {
          radiusUsed: expansionRadius,
          ...(extractStateHint(request) !== undefined ? { productState: extractStateHint(request) as string } : {}),
        }),
        expansionApplied: true,
      };
    }

    return {
      matches: [],
      denied: firstPass.denied,
      appliedProfileIds: resolved.appliedProfileIds,
      noMatchReason: inferNoMatchReason(firstPass.denied, {
        radiusUsed: primaryRadius,
        ...(extractStateHint(request) !== undefined ? { productState: extractStateHint(request) as string } : {}),
      }),
      expansionApplied: false,
    };
  }

  /**
   * Auto-assign order to best matching vendor
   */
  async autoAssignOrder(
    request: VendorMatchRequest,
    criteria: VendorMatchCriteria
  ): Promise<VendorMatchResult | null> {
    try {
      this.logger.info('Auto-assigning order', { 
        propertyAddress: request.propertyAddress,
        minScore: criteria.minMatchScore 
      });

      // Find matches
      const matches = await this.findMatchingVendors(request, 10);

      if (matches.length === 0) {
        this.logger.warn('No matching vendors found for auto-assignment');
        return null;
      }

      // Apply criteria filters
      const qualified = matches.filter(match => {
        // Minimum score threshold
        if (criteria.minMatchScore && match.matchScore < criteria.minMatchScore) {
          return false;
        }

        // Maximum distance
        if (criteria.maxDistance && match.distance && match.distance > criteria.maxDistance) {
          return false;
        }

        // Required tier
        if (criteria.requiredTier && match.vendor.tier !== criteria.requiredTier) {
          return false;
        }

        // Availability check
        if (criteria.requireAvailability) {
          // Vendor must have been scored for availability to pass
          return true;
        }

        return true;
      });

      if (qualified.length === 0) {
        this.logger.warn('No vendors met assignment criteria');
        return null;
      }

      // Select top match
      const selected = qualified[0];
      if (!selected) {
        return null;
      }
      
      this.logger.info('Selected vendor for auto-assignment', {
        vendorId: selected.vendorId,
        matchScore: selected.matchScore,
        distance: selected.distance
      });

      return selected;

    } catch (error: any) {
      this.logger.error('Failed to auto-assign order', error);
      throw error;
    }
  }

  /**
   * Broadcast order to multiple vendors (auction mode)
   */
  async broadcastToVendors(
    request: VendorMatchRequest,
    topN: number = 5,
    expirationHours: number = 24
  ): Promise<VendorMatchResult[]> {
    try {
      this.logger.info('Broadcasting order to vendors', { 
        propertyAddress: request.propertyAddress,
        topN,
        expirationHours
      });

      // Find top matches
      const matches = await this.findMatchingVendors(request, topN);

      // Create bid invitations
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + expirationHours);

      for (const match of matches) {
        await this.createBidInvitation(
          request.orderId || 'pending',
          match.vendorId,
          request,
          expirationDate
        );
      }

      this.logger.info(`Broadcast sent to ${matches.length} vendors`);
      return matches;

    } catch (error: any) {
      this.logger.error('Failed to broadcast to vendors', error);
      throw error;
    }
  }

  /**
   * Score a vendor against order requirements
   */
  private async scoreVendor(
    vendor: any,
    request: VendorMatchRequest,
    propertyCoords: GeoCoordinates | null,
    precomputedDistance?: number | null,
    ruleResult?: RuleEvaluationResult,
    /**
     * Phase B — resolved criteria profile from VendorMatchingCriteriaService.
     * When provided, per-criterion enabled flags + weights override the
     * fixed WEIGHTS table. Disabled criteria are excluded from the score
     * and remaining weights renormalize to 1.0. When absent, behaviour is
     * identical to the legacy fixed-weight scorer.
     */
    criteriaProfile?: import('../types/vendor-marketplace.types.js').VendorMatchingCriteriaProfile['criteria'],
    /**
     * Grade levels fetched from the Product document, keyed by level key.
     * When provided, gradeBonus values come from the product, not hardcoded constants.
     * When absent, no grade bonus is applied.
     */
    productGradeLevels?: import('../types/index.js').GradeLevel[],
  ): Promise<VendorMatchResult> {
    // Hard gate: required capabilities — vendor scored 0 if any are missing
    if (request.requiredCapabilities?.length) {
      const vendorCaps: string[] = [...(vendor.capabilities ?? []), ...(vendor.capabilityTags ?? [])];
      const missing = request.requiredCapabilities.filter(c => !vendorCaps.includes(c));
      if (missing.length > 0) {
        const zeroComponents = { performance: 0, availability: 0, proximity: 0, experience: 0, cost: 0 };
        return {
          vendorId: vendor.id,
          matchScore: 0,
          scoreBreakdown: zeroComponents,
          distance: null,
          estimatedTurnaround: 0,
          estimatedFee: null,
          matchReasons: [`Missing required capabilities: ${missing.join(', ')}`],
          vendor: {
            id: vendor.id,
            name: vendor.name || vendor.businessName,
            tier: 'BRONZE' as const,
            overallScore: 0
          },
          explanation: {
            vendorId: vendor.id,
            scoreComponents: zeroComponents,
            ruleResult: ruleResult ?? { appliedRuleIds: [], denyReasons: [], scoreAdjustment: 0 },
            baseScore: 0,
            finalScore: 0,
            weightsVersion: WEIGHTS_VERSION,
          }
        };
      }
    }

    // Get vendor data
    const [performance, availability] = await Promise.all([
      this.getVendorPerformance(vendor.id, request.tenantId),
      this.getVendorAvailability(vendor.id)
    ]);

    const propertyState = this.extractStateFromAddress(request.propertyAddress);

    // Phase 1.5.5: Internal staff have no vendor-availability container docs.
    // Synthesize an availability snapshot from their vendor doc capacity fields
    // so they aren't unfairly penalised with a 0 on the 25% availability weight.
    let effectiveAvailability = availability;
    if (!effectiveAvailability && (vendor as any).staffType === 'internal') {
      const active: number = (vendor as any).activeOrderCount ?? (vendor as any).currentActiveOrders ?? 0;
      const max: number = (vendor as any).maxConcurrentOrders ?? (vendor as any).maxActiveOrders ?? 5;
      effectiveAvailability = {
        currentLoad: active,
        maxCapacity: max,
        availableSlots: Math.max(0, max - active),
        isAcceptingOrders: active < max,
      } as any;
    }

    // Calculate individual scores
    const performanceScore = this.calculatePerformanceScore(performance);
    const availabilityScore = this.calculateAvailabilityScore(effectiveAvailability, request.dueDate);
    const proximityScore = await this.calculateProximityScore(vendor, propertyCoords, propertyState, precomputedDistance);
    const experienceScore = this.calculateExperienceScore(
      vendor,
      request.propertyType,
      performance,
      request.productId,
      productGradeLevels,
    );
    const costScore = this.calculateCostScore(
      vendor,
      request.budget,
      request.clientPreferences?.maxFee
    );

    // Phase B — licensure HARD_GATE: when the resolved profile marks
    // licensure as a hard gate, a vendor that isn't licensed in the
    // property's state scores 0 overall (analogous to the requiredCapabilities
    // gate above). 'SCORED' mode would feed the licensure check into
    // experienceScore instead — not yet wired since the existing scorer
    // doesn't have a licensure component to score against; if you want
    // SCORED licensure, do it in a follow-up.
    if (criteriaProfile?.licensure?.enabled && criteriaProfile.licensure.mode === 'HARD_GATE') {
      const licensedStates: string[] = (vendor.licensedStates as string[] | undefined) ?? [];
      if (propertyState && licensedStates.length > 0 && !licensedStates.includes(propertyState)) {
        const zeroComponents = { performance: 0, availability: 0, proximity: 0, experience: 0, cost: 0 };
        return {
          vendorId: vendor.id,
          matchScore: 0,
          scoreBreakdown: zeroComponents,
          distance: precomputedDistance ?? null,
          estimatedTurnaround: 0,
          estimatedFee: null,
          matchReasons: [`Not licensed in ${propertyState} (HARD_GATE).`],
          vendor: {
            id: vendor.id,
            name: vendor.name || vendor.businessName,
            tier: 'BRONZE' as const,
            overallScore: 0,
          },
          explanation: {
            vendorId: vendor.id,
            scoreComponents: zeroComponents,
            ruleResult: ruleResult ?? { appliedRuleIds: [], denyReasons: ['licensure HARD_GATE'], scoreAdjustment: 0 },
            baseScore: 0,
            finalScore: 0,
            weightsVersion: WEIGHTS_VERSION,
          },
        };
      }
    }

    // Weighted overall score — when a criteria profile is supplied, derive
    // weights from it (honoring enabled flags and renormalizing). Otherwise
    // use the legacy fixed WEIGHTS table so unprofiled tenants are unaffected.
    const effectiveWeights = criteriaProfile
      ? computeEffectiveWeights(criteriaProfile)
      : this.WEIGHTS;

    let baseScore = Math.round(
      performanceScore * effectiveWeights.performance +
      availabilityScore * effectiveWeights.availability +
      proximityScore.score * effectiveWeights.proximity +
      experienceScore * effectiveWeights.experience +
      costScore * effectiveWeights.cost
    );

    // Per-vendor product weight (David/Doug meeting: "each vendor can be
    // weighted by each product"). Multiplies the base score by the vendor's
    // per-product weight when present, clamped to [0.0, 2.0] so a single
    // overlay can't either zero a vendor (use eligibleProductIds instead) or
    // 10x them past the rest of the pack. Default 1.0 = no adjustment.
    const productWeight = lookupProductWeight(vendor, request.productId);
    if (productWeight !== 1.0) {
      baseScore = Math.round(Math.min(100, Math.max(0, baseScore * productWeight)));
    }

    // T5: apply rules-engine score adjustments (boost / reduce), clamped to [0, 100].
    // Clamp is documented (D6 in the review doc); revisit when scoring becomes
    // data-driven in Phase 3 and admins may want unbounded scores for tuning.
    const matchScore = this.applyScoreAdjustment(baseScore, ruleResult?.scoreAdjustment ?? 0);

    const scoreComponents = {
      performance: performanceScore,
      availability: availabilityScore,
      proximity: proximityScore.score,
      experience: experienceScore,
      cost: costScore,
    };

    return {
      vendorId: vendor.id,
      matchScore,
      recentOrders: performance?.ordersLast30Days ?? performance?.totalOrdersCompleted ?? 0,
      scoreBreakdown: scoreComponents,
      distance: proximityScore.distance,
      estimatedTurnaround: this.estimateTurnaround(performance, effectiveAvailability),
      estimatedFee: vendor.typicalFees?.[request.propertyType] || null,
      matchReasons: [],
      vendor: {
        id: vendor.id,
        name: vendor.name || vendor.businessName,
        tier: performance?.tier || 'BRONZE',
        overallScore: performance?.overallScore || 0
      },
      explanation: {
        vendorId: vendor.id,
        scoreComponents,
        ruleResult: ruleResult ?? { appliedRuleIds: [], denyReasons: [], scoreAdjustment: 0 },
        baseScore,
        finalScore: matchScore,
        weightsVersion: WEIGHTS_VERSION,
      }
    };
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(
    performance: VendorPerformanceMetrics | null
  ): number {
    if (!performance) return 0;

    // Use the vendor's overall score directly
    return performance.overallScore || 0;
  }

  /**
   * Calculate availability score (0-100).
   * V-09: When the order's dueDate falls inside any of the vendor's blackout
   * ranges, the score is forced to 0 — the vendor is ineligible for that date.
   */
  private calculateAvailabilityScore(
    availability: VendorAvailability | null,
    dueDate?: Date,
  ): number {
    if (!availability || !availability.isAcceptingOrders) return 0;

    // V-09: blackout date enforcement
    if (dueDate && Array.isArray(availability.blackoutDates)) {
      const due = new Date(dueDate).getTime();
      const blocked = availability.blackoutDates.some((range) => {
        if (!range?.startDate || !range?.endDate) return false;
        const start = new Date(range.startDate).getTime();
        const end = new Date(range.endDate).getTime();
        return due >= start && due <= end;
      });
      if (blocked) return 0;
    }

    const { currentLoad, maxCapacity, availableSlots } = availability;

    // Calculate capacity utilization
    const utilization = currentLoad / maxCapacity;

    // Score based on available capacity
    if (availableSlots >= 5) return 100;  // Plenty of capacity
    if (availableSlots >= 3) return 85;   // Good capacity
    if (availableSlots >= 1) return 70;   // Limited capacity
    if (utilization < 0.9) return 50;     // Near capacity but can squeeze in
    return 0;                              // No capacity
  }

  /**
   * Calculate proximity score with distance (0-100)
   */
  private async calculateProximityScore(
    vendor: any,
    propertyCoords: GeoCoordinates | null,
    propertyState?: string,
    precomputedDistance?: number | null
  ): Promise<{ score: number; distance: number | null }> {
    try {
      if (!propertyCoords) {
        // No geocoding available — use state matching only
        const vendorStates: string[] = (vendor.serviceAreas ?? []).map((sa: any) => sa.state);
        if (propertyState && vendorStates.includes(propertyState)) {
          return { score: 70, distance: null }; // Same state, decent score
        }
        return { score: 40, distance: null }; // No state match, lower score
      }

      // Use precomputed distance when supplied (T3: hoisted into getEligibleVendors).
      // A null value here means "vendor has no usable coordinates" — the same case
      // the inline-compute branch returns 50 for, preserving prior behavior.
      let distance: number;
      if (precomputedDistance !== undefined) {
        if (precomputedDistance === null) {
          return { score: 50, distance: null };
        }
        distance = precomputedDistance;
      } else {
        // Fallback: compute inline (preserves backward compatibility for any
        // direct callers / tests that don't pre-compute).
        const vendorCoords = vendor.location || vendor.businessLocation;
        if (!vendorCoords?.latitude || !vendorCoords?.longitude) {
          return { score: 50, distance: null };
        }
        distance = this.calculateDistance(
          propertyCoords.latitude,
          propertyCoords.longitude,
          vendorCoords.latitude,
          vendorCoords.longitude
        );
      }

      // Score based on distance thresholds
      let score = 0;
      if (distance <= this.DISTANCE_THRESHOLDS.local) {
        score = 100;
      } else if (distance <= this.DISTANCE_THRESHOLDS.regional) {
        score = 80;
      } else if (distance <= this.DISTANCE_THRESHOLDS.extended) {
        score = 60;
      } else if (distance <= this.DISTANCE_THRESHOLDS.remote) {
        score = 40;
      } else {
        score = 0;
      }

      // Preferred area bonus: vendor has explicitly listed this state as preferred
      if (propertyState && vendor.geographicCoverage?.preferred?.states?.includes(propertyState)) {
        score = Math.min(100, score + 10);
      }

      return { score, distance };

    } catch (error) {
      this.logger.error('Failed to calculate proximity score', error as Record<string, any>);
      return { score: 50, distance: null };
    }
  }

  /**
   * Calculate experience score for property type (0-100)
   */
  private calculateExperienceScore(
    vendor: any,
    propertyType: string,
    performance: VendorPerformanceMetrics | null,
    productId?: string,
    productGradeLevels?: import('../types/index.js').GradeLevel[],
  ): number {
    let score = 50; // Base score

    // Check specializations
    const specializations = vendor.specializations || [];
    if (specializations.includes(propertyType)) {
      score += 30;
    }

    // Check historical experience
    const propertyTypeExpertise = performance?.propertyTypeExpertise || {};
    const ordersForType = propertyTypeExpertise[propertyType] || 0;
    
    if (ordersForType >= 50) {
      score += 20; // Extensive experience
    } else if (ordersForType >= 20) {
      score += 15; // Good experience
    } else if (ordersForType >= 5) {
      score += 10; // Some experience
    }

    // Product grade bonus: reward vendors with proven competency on this product.
    // Score bonus values come from the product document (data-driven), not hardcoded constants.
    if (productId && productGradeLevels && productGradeLevels.length > 0) {
      const gradeEntry = (vendor.productGrades as Array<{ productId: string; grade: string }> | undefined)
        ?.find(g => g.productId === productId);
      if (gradeEntry) {
        const levelDef = productGradeLevels.find(gl => gl.key === gradeEntry.grade);
        score += levelDef?.scoreBonus ?? 0;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate cost score based on fee competitiveness (0-100)
   */
  private calculateCostScore(
    vendor: any,
    budget?: number,
    maxFee?: number
  ): number {
    const typicalFee = vendor.averageFee || vendor.typicalFee;
    if (!typicalFee) return 75; // No fee data, neutral score

    // Check against budget constraints
    if (maxFee && typicalFee > maxFee) return 0; // Over budget

    if (budget) {
      const ratio = typicalFee / budget;
      if (ratio <= 0.8) return 100;  // Under budget
      if (ratio <= 1.0) return 85;   // At budget
      if (ratio <= 1.1) return 70;   // Slightly over
      if (ratio <= 1.2) return 50;   // Moderately over
      return 25;                     // Significantly over
    }

    return 75; // No budget specified, neutral score
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Round to 1 decimal
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Estimate turnaround time for vendor
   */
  private estimateTurnaround(
    performance: VendorPerformanceMetrics | null,
    availability: VendorAvailability | null
  ): number {
    let baseTurnaround = performance?.avgTurnaroundTime || 72; // Default 72 hours

    // Adjust for current workload
    if (availability) {
      const utilization = availability.currentLoad / availability.maxCapacity;
      if (utilization > 0.8) {
        baseTurnaround *= 1.2; // 20% longer if heavily loaded
      }
    }

    return Math.round(baseTurnaround);
  }

  /**
   * Get eligible vendors for the order, with per-vendor precomputed distance
   * and rules-engine evaluation result.
   *
   * Pipeline (per T3 + T4 in docs/AUTO_ASSIGNMENT_REVIEW.md):
   *   1. Cosmos query: tenant + active + state-area filter
   *   2. Hard gate: productId / eligibleProductIds (legacy field, F4 retires this)
   *   3. Compute per-vendor distance (T3)
   *   4. Load active rules for tenant once (T4)
   *   5. Per vendor: build RuleEvaluationContext, call applyRules, drop denied
   *   6. Return [{vendor, distance, ruleResult}] for the scoring step
   *
   * Tenants with zero rules see zero behavior change — applyRules returns
   * eligible:true with empty appliedRuleIds and zero scoreAdjustment.
   *
   * Known semantic gaps in the rule context (acceptable for Phase 1):
   *   - vendor.licenseType: not derivable from current vendor schema
   *     (license_required rules will no-op until vendor.licenseType is exposed)
   *   - vendor.performanceScore: not loaded until scoreVendor; passed as
   *     undefined here, so min_performance_score rules treat it as 0 (deny).
   *     This is conservative; real fix is loading perf in the eligibility step
   *     or moving rules eval to post-scoring (deferred).
   *   - order.productType: VendorMatchRequest has productId, not productType;
   *     productId is passed as a proxy. Rules scoped to productType strings
   *     should be migrated to productId when this path is used.
   *   - order.orderValueUsd: VendorMatchRequest.budget is a fee budget, not
   *     order value; passed as undefined, so max_order_value rules no-op.
   */
  private async getEligibleVendors(
    request: VendorMatchRequest,
    propertyCoords?: GeoCoordinates | null
  ): Promise<{
    eligible: Array<{ vendor: any; distance: number | null; ruleResult: RuleEvaluationResult }>;
    denied: DeniedVendorEntry[];
  }> {
    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
      AND c.entityType = 'vendor'
      AND c.isActive = true
      AND (NOT IS_DEFINED(c.serviceAreas) OR EXISTS(SELECT VALUE sa FROM sa IN c.serviceAreas WHERE sa.state = @state))
    `;

    // Extract state from address (simplified)
    const propertyState = this.extractStateFromAddress(request.propertyAddress);

    const result = await this.dbService.queryItems(
      'vendors',
      query,
      [
        { name: '@tenantId', value: request.tenantId },
        { name: '@state', value: propertyState }
      ]
    ) as any;

    let vendors: any[] = result.data || [];

    // Hard gate: product eligibility — if vendor has an explicit allow-list, order's product must be in it
    if (request.productId) {
      vendors = vendors.filter((v: any) =>
        !v.eligibleProductIds?.length || v.eligibleProductIds.includes(request.productId)
      );
    }

    // Phase 2: build all per-vendor contexts up front, then evaluate them in
    // a single batch via the rules provider. The provider may be homegrown
    // (Cosmos + in-process apply), MOP (HTTP), or MOP-with-fallback.
    // Build context omitting fields that are not derivable from the current
    // VendorMatchRequest / Vendor schemas (see gap notes above). Omitting
    // (rather than passing undefined) is required by exactOptionalPropertyTypes
    // and lets each rule's eval helper apply its own missing-data semantics.
    const distances: (number | null)[] = vendors.map(v =>
      this.computeVendorDistance(v, propertyCoords ?? null)
    );

    const orderCtx: RuleEvaluationContext['order'] = {
      ...(request.productId !== undefined ? { productType: request.productId } : {}),
      ...(propertyState !== undefined ? { propertyState } : {}),
    };

    const contexts: RuleEvaluationContext[] = vendors.map((vendor, i) => ({
      vendor: {
        id: vendor.id,
        capabilities: vendor.capabilities ?? [],
        states: (vendor.serviceAreas ?? []).map((sa: any) => sa.state).filter(Boolean),
        distance: distances[i] ?? null,
        ...(vendor.licenseType !== undefined ? { licenseType: vendor.licenseType } : {}),
      },
      order: orderCtx,
    }));

    let ruleResults: RuleEvaluationResult[];
    try {
      ruleResults = await this.rulesProvider.evaluateForVendors(request.tenantId, contexts);
    } catch (err) {
      // Fail open: if the provider can't be reached at all (and its own
      // fallback chain — if any — also failed), proceed without rules. The
      // engine's pre-rules hard gates still apply.
      this.logger.error('Rules provider failed; continuing without rules', {
        provider: this.rulesProvider.name,
        error: err instanceof Error ? err.message : String(err),
      });
      ruleResults = contexts.map(() => ({
        eligible: true,
        scoreAdjustment: 0,
        appliedRuleIds: [],
        denyReasons: [],
      }));
    }

    const eligible: Array<{ vendor: any; distance: number | null; ruleResult: RuleEvaluationResult }> = [];
    const denied: DeniedVendorEntry[] = [];

    for (let i = 0; i < vendors.length; i++) {
      const vendor = vendors[i];
      const distance = distances[i] ?? null;
      const ruleResult = ruleResults[i] ?? { eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] };

      if (!ruleResult.eligible) {
        this.logger.info('Vendor denied by rules provider', {
          vendorId: vendor.id,
          tenantId: request.tenantId,
          provider: this.rulesProvider.name,
          denyReasons: ruleResult.denyReasons,
          appliedRuleIds: ruleResult.appliedRuleIds,
        });
        denied.push({
          vendorId: vendor.id,
          vendorName: vendor.name || vendor.businessName || vendor.id,
          denyReasons: ruleResult.denyReasons,
          appliedRuleIds: ruleResult.appliedRuleIds,
        });
        continue;
      }

      eligible.push({ vendor, distance, ruleResult });
    }

    return { eligible, denied };
  }

  /**
   * Apply a rules-engine score adjustment to a base score, clamped to [0, 100].
   * Extracted for direct unit testing; called from scoreVendor.
   */
  private applyScoreAdjustment(baseScore: number, adjustment: number): number {
    return Math.max(0, Math.min(100, baseScore + adjustment));
  }

  /**
   * Compute vendor-to-property distance when both ends have coordinates.
   * Returns null if propertyCoords or vendor location is missing.
   */
  private computeVendorDistance(vendor: any, propertyCoords: GeoCoordinates | null): number | null {
    if (!propertyCoords) return null;
    const vendorCoords = vendor.location || vendor.businessLocation;
    if (!vendorCoords?.latitude || !vendorCoords?.longitude) return null;
    return this.calculateDistance(
      propertyCoords.latitude,
      propertyCoords.longitude,
      vendorCoords.latitude,
      vendorCoords.longitude
    );
  }

  /**
   * Get vendor performance metrics
   */
  private async getVendorPerformance(
    vendorId: string,
    tenantId: string
  ): Promise<VendorPerformanceMetrics | null> {
    try {
      return await this.performanceService.calculateVendorMetrics(vendorId, tenantId);
    } catch (error) {
      this.logger.error('Failed to get vendor performance', error as Record<string, any>);
      return null;
    }
  }

  /**
   * Get vendor availability
   */
  private async getVendorAvailability(vendorId: string): Promise<VendorAvailability | null> {
    try {
      const result = await this.dbService.getItem('vendor-availability', vendorId, vendorId) as any;
      if (!result || result.success === false) {
        return null;
      }
      return result as VendorAvailability;
    } catch (error) {
      this.logger.error('Failed to get vendor availability', error as Record<string, any>);
      return null;
    }
  }

  /**
   * Geocode an address to coordinates
   */
  private async geocodeAddress(address: string): Promise<GeoCoordinates | null> {
    // State centroid coordinates for distance-based scoring when no geocoding API is configured.
    // Vendors within the same state get a proximity boost; cross-state vendors score lower.
    const STATE_CENTROIDS: Record<string, GeoCoordinates> = {
      TX: { latitude: 31.9686, longitude: -99.9018 }, AL: { latitude: 32.3182, longitude: -86.9023 },
      AZ: { latitude: 34.0489, longitude: -111.0937 }, CA: { latitude: 36.7783, longitude: -119.4179 },
      CO: { latitude: 39.5501, longitude: -105.7821 }, FL: { latitude: 27.6648, longitude: -81.5158 },
      GA: { latitude: 32.1656, longitude: -82.9001 }, IL: { latitude: 40.6331, longitude: -89.3985 },
      NC: { latitude: 35.7596, longitude: -79.0193 }, NY: { latitude: 40.7128, longitude: -74.0060 },
      OH: { latitude: 40.4173, longitude: -82.9071 }, PA: { latitude: 41.2033, longitude: -77.1945 },
      SC: { latitude: 33.8361, longitude: -81.1637 }, TN: { latitude: 35.5175, longitude: -86.5804 },
      VA: { latitude: 37.4316, longitude: -78.6569 }, WA: { latitude: 47.7511, longitude: -120.7401 },
    };
    const state = this.extractStateFromAddress(address);
    if (state && STATE_CENTROIDS[state]) {
      return STATE_CENTROIDS[state]!;
    }
    this.logger.warn('Cannot geocode address — no state match for proximity scoring', { address });
    return null;
  }

  /**
   * Extract state from address string
   */
  private extractStateFromAddress(address: string): string {
    // Try comma+space+STATE+comma/end pattern first (handles "Austin, TX, 78701" format).
    const commaFormat = address.match(/,\s*([A-Z]{2})\s*(?:,|$)/);
    if (commaFormat && commaFormat[1]) return commaFormat[1];
    // Fall back to STATE+space+zip format (handles "Austin TX 78701" format).
    const spaceFormat = address.match(/\b([A-Z]{2})\s+\d{5}/);
    return spaceFormat && spaceFormat[1] ? spaceFormat[1] : 'CA'; // Default to CA
  }

  /**
   * Create bid invitation for vendor
   */
  private async createBidInvitation(
    orderId: string,
    vendorId: string,
    request: VendorMatchRequest,
    expiresAt: Date
  ): Promise<void> {
    try {
      const invitation = {
        id: `bid-${orderId}-${vendorId}-${Date.now()}`,
        orderId,
        vendorId,
        tenantId: request.tenantId,
        propertyType: request.propertyType,
        dueDate: request.dueDate,
        urgency: request.urgency,
        status: 'PENDING',
        invitedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        entityType: 'vendor-bid-invitation'
      };

      await this.dbService.createItem('vendor-bids', invitation);
      this.logger.info('Created bid invitation', { orderId, vendorId });

    } catch (error: any) {
      this.logger.error('Failed to create bid invitation', error);
      throw error;
    }
  }
}
