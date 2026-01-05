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

      // Get eligible vendors
      const eligibleVendors = await this.getEligibleVendors(request);
      this.logger.info(`Found ${eligibleVendors.length} eligible vendors`);

      if (eligibleVendors.length === 0) {
        return [];
      }

      // Score each vendor
      const scoredVendors = await Promise.all(
        eligibleVendors.map(vendor => this.scoreVendor(vendor, request, propertyCoords))
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
    propertyCoords: GeoCoordinates
  ): Promise<VendorMatchResult> {
    // Get vendor data
    const [performance, availability] = await Promise.all([
      this.getVendorPerformance(vendor.id, request.tenantId),
      this.getVendorAvailability(vendor.id)
    ]);

    // Calculate individual scores
    const performanceScore = this.calculatePerformanceScore(performance);
    const availabilityScore = this.calculateAvailabilityScore(availability);
    const proximityScore = await this.calculateProximityScore(vendor, propertyCoords);
    const experienceScore = this.calculateExperienceScore(
      vendor,
      request.propertyType,
      performance
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
      scoreBreakdown: {
        performance: performanceScore,
        availability: availabilityScore,
        proximity: proximityScore.score,
        experience: experienceScore,
        cost: costScore
      },
      distance: proximityScore.distance,
      estimatedTurnaround: this.estimateTurnaround(performance, availability),
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
   * Calculate availability score (0-100)
   */
  private calculateAvailabilityScore(
    availability: VendorAvailability | null
  ): number {
    if (!availability || !availability.isAcceptingOrders) return 0;

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
    propertyCoords: GeoCoordinates
  ): Promise<{ score: number; distance: number | null }> {
    try {
      // Get vendor location
      const vendorCoords = vendor.location || vendor.businessLocation;
      if (!vendorCoords?.latitude || !vendorCoords?.longitude) {
        return { score: 50, distance: null }; // Unknown location, medium score
      }

      // Calculate distance
      const distance = this.calculateDistance(
        propertyCoords.latitude,
        propertyCoords.longitude,
        vendorCoords.latitude,
        vendorCoords.longitude
      );

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
    performance: VendorPerformanceMetrics | null
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
   * Get eligible vendors for the order
   */
  private async getEligibleVendors(request: VendorMatchRequest): Promise<any[]> {
    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
      AND c.entityType = 'vendor'
      AND c.isActive = true
      AND (NOT IS_DEFINED(c.serviceAreas) OR ARRAY_CONTAINS(c.serviceAreas, @state))
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

    return result.resources || [];
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
  private async geocodeAddress(address: string): Promise<GeoCoordinates> {
    // TODO: Integrate with Google Maps Geocoding API or Azure Maps
    // For now, return mock coordinates
    // In production, this should call the geocoding service
    this.logger.warn('Using mock geocoding - integrate with Google Maps or Azure Maps');
    
    return {
      latitude: 37.7749,  // Default to San Francisco
      longitude: -122.4194
    };
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
