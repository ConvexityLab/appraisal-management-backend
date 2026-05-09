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
  VendorMatchRequest,
  VendorMatchResult,
  VendorMatchCriteria,
  VendorAvailability,
  VendorPerformanceMetrics,
  GeographicArea
} from '../types/vendor-marketplace.types.js';

interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export class VendorMatchingEngine {
  private logger: Logger;
  private dbService: CosmosDbService;
  private performanceService: VendorPerformanceCalculatorService;

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

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.performanceService = new VendorPerformanceCalculatorService();
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

      // Get eligible vendors (with precomputed per-vendor distance — see T3 in
      // docs/AUTO_ASSIGNMENT_REVIEW.md). Distance is computed once here so it is
      // available to both the rules engine (T4, max_distance_miles rule) and the
      // proximity scorer without recomputation.
      const eligibleVendors = await this.getEligibleVendors(request, propertyCoords);
      this.logger.info(`Found ${eligibleVendors.length} eligible vendors`);

      if (eligibleVendors.length === 0) {
        return [];
      }

      // Score each vendor
      const scoredVendors = await Promise.all(
        eligibleVendors.map(({ vendor, distance }) =>
          this.scoreVendor(vendor, request, propertyCoords, distance)
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
    precomputedDistance?: number | null
  ): Promise<VendorMatchResult> {
    // Hard gate: required capabilities — vendor scored 0 if any are missing
    if (request.requiredCapabilities?.length) {
      const vendorCaps: string[] = vendor.capabilities ?? [];
      const missing = request.requiredCapabilities.filter(c => !vendorCaps.includes(c));
      if (missing.length > 0) {
        return {
          vendorId: vendor.id,
          matchScore: 0,
          scoreBreakdown: { performance: 0, availability: 0, proximity: 0, experience: 0, cost: 0 },
          distance: null,
          estimatedTurnaround: 0,
          estimatedFee: null,
          matchReasons: [`Missing required capabilities: ${missing.join(', ')}`],
          vendor: {
            id: vendor.id,
            name: vendor.name || vendor.businessName,
            tier: 'BRONZE' as const,
            overallScore: 0
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
      request.productId
    );
    const costScore = this.calculateCostScore(
      vendor,
      request.budget,
      request.clientPreferences?.maxFee
    );

    // Weighted overall score
    const matchScore = Math.round(
      performanceScore * this.WEIGHTS.performance +
      availabilityScore * this.WEIGHTS.availability +
      proximityScore.score * this.WEIGHTS.proximity +
      experienceScore * this.WEIGHTS.experience +
      costScore * this.WEIGHTS.cost
    );

    return {
      vendorId: vendor.id,
      matchScore,
      recentOrders: performance?.ordersLast30Days ?? performance?.totalOrdersCompleted ?? 0,
      scoreBreakdown: {
        performance: performanceScore,
        availability: availabilityScore,
        proximity: proximityScore.score,
        experience: experienceScore,
        cost: costScore
      },
      distance: proximityScore.distance,
      estimatedTurnaround: this.estimateTurnaround(performance, effectiveAvailability),
      estimatedFee: vendor.typicalFees?.[request.propertyType] || null,
      matchReasons: [],
      vendor: {
        id: vendor.id,
        name: vendor.name || vendor.businessName,
        tier: performance?.tier || 'BRONZE',
        overallScore: performance?.overallScore || 0
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
    productId?: string
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

    // Product grade bonus: reward vendors with proven competency on this product
    if (productId) {
      const gradeEntry = (vendor.productGrades as Array<{ productId: string; grade: string }> | undefined)
        ?.find(g => g.productId === productId);
      if (gradeEntry) {
        const gradeBonus: Record<string, number> = { trainee: 0, proficient: 5, expert: 10, lead: 15 };
        score += gradeBonus[gradeEntry.grade] ?? 0;
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
   * Get eligible vendors for the order, with per-vendor precomputed distance.
   *
   * Distance is precomputed here (T3) so it is available to:
   *   - the rules engine (T4: max_distance_miles deny rule)
   *   - the proximity scorer (without recomputing)
   *
   * `distance` is null when either propertyCoords is null (no geocoding) or
   * the vendor has no usable coordinates.
   */
  private async getEligibleVendors(
    request: VendorMatchRequest,
    propertyCoords?: GeoCoordinates | null
  ): Promise<Array<{ vendor: any; distance: number | null }>> {
    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
      AND c.entityType = 'vendor'
      AND c.isActive = true
      AND (NOT IS_DEFINED(c.serviceAreas) OR EXISTS(SELECT VALUE sa FROM sa IN c.serviceAreas WHERE sa.state = @state))
    `;

    // Extract state from address (simplified)
    const state = this.extractStateFromAddress(request.propertyAddress);

    const result = await this.dbService.queryItems(
      'vendors',
      query,
      [
        { name: '@tenantId', value: request.tenantId },
        { name: '@state', value: state }
      ]
    ) as any;

    let vendors: any[] = result.resources || [];

    // Hard gate: product eligibility — if vendor has an explicit allow-list, order's product must be in it
    if (request.productId) {
      vendors = vendors.filter((v: any) =>
        !v.eligibleProductIds?.length || v.eligibleProductIds.includes(request.productId)
      );
    }

    return vendors.map(vendor => ({
      vendor,
      distance: this.computeVendorDistance(vendor, propertyCoords ?? null)
    }));
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
    // Simple regex to extract US state code
    const stateMatch = address.match(/\b([A-Z]{2})\b\s+\d{5}/);
    return stateMatch && stateMatch[1] ? stateMatch[1] : 'CA'; // Default to CA
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
        propertyAddress: request.propertyAddress,
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
