/**
 * AVM Cascade Service - Automated Valuation Model with Fallback Strategy
 * 
 * Implements a waterfall approach to property valuation:
 * 1. Bridge Interactive Zestimate (fast, external)
 * 2. Hedonic Regression Model (MLS comps-based)
 * 3. Cost Approach (fallback)
 * 
 * Pure service - can be called directly or wrapped in workflows later.
 */

import { Logger } from '../utils/logger';
import { BridgeInteractiveService } from './bridge-interactive.service';

export interface AVMCascadeInput {
  address: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  squareFootage?: number;
  yearBuilt?: number;
  bedrooms?: number;
  bathrooms?: number;
  lotSize?: number;
  strategy?: 'speed' | 'quality' | 'cost';
  forceMethod?: 'bridge' | 'hedonic' | 'cost';
}

export interface AVMResult {
  estimatedValue: number;
  method: 'bridge-zestimate' | 'hedonic-regression' | 'cost-approach';
  confidence: number; // 0-100
  valuationRange: {
    low: number;
    high: number;
  };
  comparables?: Array<{
    address: string;
    distance: number; // miles
    soldPrice: number;
    soldDate: string;
    squareFootage: number;
    adjustedValue: number;
  }>;
  modelDetails: {
    provider: string;
    timestamp: string;
    dataPoints: number;
    adjustments: Record<string, number>;
  };
  fallbackReason?: string;
}

export interface AVMCascadeResult {
  success: boolean;
  result?: AVMResult;
  error?: string;
  attempts: Array<{
    method: string;
    success: boolean;
    timestamp: string;
    error?: string;
  }>;
  processingTime: number;
}

export class AVMCascadeService {
  private logger: Logger;
  private bridgeService: BridgeInteractiveService;

  constructor() {
    this.logger = new Logger();
    this.bridgeService = new BridgeInteractiveService();
  }

  /**
   * Execute AVM cascade to get property valuation
   */
  async getValuation(input: AVMCascadeInput): Promise<AVMCascadeResult> {
    const startTime = Date.now();
    const attempts: AVMCascadeResult['attempts'] = [];

    try {
      this.logger.info(`Starting AVM cascade for ${input.address}`);

      // If a specific method is forced, use only that
      if (input.forceMethod) {
        const result = await this.executeSingleMethod(input, input.forceMethod);
        if (result) {
          return {
            success: true,
            result,
            attempts: [{ method: input.forceMethod, success: true, timestamp: new Date().toISOString() }],
            processingTime: Date.now() - startTime,
          };
        }
        return {
          success: false,
          error: `Forced method ${input.forceMethod} failed`,
          attempts: [{ method: input.forceMethod, success: false, timestamp: new Date().toISOString() }],
          processingTime: Date.now() - startTime,
        };
      }

      // Execute cascade based on strategy
      const methods = this.getMethodOrder(input.strategy || 'quality');

      for (const method of methods) {
        try {
          this.logger.info(`Attempting ${method}...`);

          const result = await this.executeSingleMethod(input, method);

          if (result && this.isResultAcceptable(result)) {
            attempts.push({ method, success: true, timestamp: new Date().toISOString() });
            this.logger.info(`✅ Success with ${method}: $${result.estimatedValue.toLocaleString()}`);
            
            return {
              success: true,
              result,
              attempts,
              processingTime: Date.now() - startTime,
            };
          }

          attempts.push({
            method,
            success: false,
            timestamp: new Date().toISOString(),
            error: 'Result quality below threshold',
          });
        } catch (error) {
          this.logger.warn(`${method} failed: ${error}`);
          attempts.push({
            method,
            success: false,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // All methods failed
      this.logger.error(`❌ AVM cascade failed for ${input.address}`);
      return {
        success: false,
        error: 'All AVM methods failed or returned unacceptable results',
        attempts,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Determine method execution order based on strategy
   */
  private getMethodOrder(strategy: string): Array<'bridge' | 'hedonic' | 'cost'> {
    switch (strategy) {
      case 'speed':
        return ['bridge', 'hedonic', 'cost'];
      case 'quality':
        return ['hedonic', 'bridge', 'cost'];
      case 'cost':
        return ['cost', 'hedonic', 'bridge'];
      default:
        return ['bridge', 'hedonic', 'cost'];
    }
  }

  /**
   * Execute a single valuation method
   */
  private async executeSingleMethod(
    input: AVMCascadeInput,
    method: 'bridge' | 'hedonic' | 'cost'
  ): Promise<AVMResult | null> {
    switch (method) {
      case 'bridge':
        return await this.getBridgeZestimate(input);
      case 'hedonic':
        return await this.getHedonicRegression(input);
      case 'cost':
        return await this.getCostApproach(input);
      default:
        return null;
    }
  }

  /**
   * Get Bridge Interactive Zestimate
   */
  private async getBridgeZestimate(input: AVMCascadeInput): Promise<AVMResult | null> {
    try {
      const zestimate = await this.bridgeService.getZestimate({ address: input.address });

      if (!zestimate?.value) {
        return null;
      }

      // Get comparables for additional context
      let comparables: any[] = [];
      if (input.latitude && input.longitude) {
        const comps = await this.bridgeService.getSoldComps({
          latitude: input.latitude,
          longitude: input.longitude,
          radiusMiles: 5,
          soldWithinDays: 180
        });
        comparables = comps.slice(0, 5); // Top 5
      }

      return {
        estimatedValue: zestimate.value,
        method: 'bridge-zestimate',
        confidence: zestimate.confidence || 75,
        valuationRange: {
          low: zestimate.valuationRange?.low || zestimate.value * 0.9,
          high: zestimate.valuationRange?.high || zestimate.value * 1.1,
        },
        comparables: comparables.map((comp: any) => ({
          address: comp.address || 'Unknown',
          distance: comp.distance || 0,
          soldPrice: comp.price || 0,
          soldDate: comp.soldDate || '',
          squareFootage: comp.squareFootage || 0,
          adjustedValue: comp.price || 0,
        })),
        modelDetails: {
          provider: 'Bridge Interactive',
          timestamp: new Date().toISOString(),
          dataPoints: comparables.length,
          adjustments: {},
        },
      };
    } catch (error) {
      this.logger.warn(`Bridge Zestimate failed: ${error}`);
      return null;
    }
  }

  /**
   * Get Hedonic Regression valuation using MLS comparables
   */
  private async getHedonicRegression(input: AVMCascadeInput): Promise<AVMResult | null> {
    if (!input.latitude || !input.longitude || !input.squareFootage) {
      return null;
    }

    try {
      // Get sold comparables
      const comps = await this.bridgeService.getSoldComps({
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMiles: 3,
        soldWithinDays: 365
      });

      if (comps.length < 3) {
        return null; // Need at least 3 comps for regression
      }

      // Perform hedonic regression
      const result = this.performHedonicRegression(input, comps);

      if (!result) {
        return null;
      }

      return {
        estimatedValue: result.estimatedValue,
        method: 'hedonic-regression',
        confidence: result.confidence,
        valuationRange: {
          low: result.estimatedValue * 0.92,
          high: result.estimatedValue * 1.08,
        },
        comparables: result.comparables || [],
        modelDetails: {
          provider: 'Internal Hedonic Model',
          timestamp: new Date().toISOString(),
          dataPoints: comps.length,
          adjustments: result.adjustments,
        },
      };
    } catch (error) {
      this.logger.warn(`Hedonic regression failed: ${error}`);
      return null;
    }
  }

  /**
   * Perform hedonic regression calculation
   */
  private performHedonicRegression(
    subject: AVMCascadeInput,
    comps: any[]
  ): {
    estimatedValue: number;
    confidence: number;
    comparables: AVMResult['comparables'];
    adjustments: Record<string, number>;
  } | null {
    const adjustments: Record<string, number> = {};
    let totalAdjustedValue = 0;
    let weights = 0;

    const comparableResults: AVMResult['comparables'] = [];

    for (const comp of comps.slice(0, 10)) {
      // Use top 10
      let adjustedValue = comp.price || 0;
      const compAdjustments: Record<string, number> = {};

      // Square footage adjustment ($150/sqft baseline)
      if (subject.squareFootage && comp.squareFootage) {
        const sqftDiff = subject.squareFootage - comp.squareFootage;
        const sqftAdjustment = sqftDiff * 150;
        adjustedValue += sqftAdjustment;
        compAdjustments.squareFootage = sqftAdjustment;
      }

      // Age adjustment
      if (subject.yearBuilt && comp.yearBuilt) {
        const ageDiff = (subject.yearBuilt - comp.yearBuilt) / 10; // per decade
        const ageAdjustment = ageDiff * 10000; // $10k per decade
        adjustedValue += ageAdjustment;
        compAdjustments.age = ageAdjustment;
      }

      // Distance-based weighting (closer = more weight)
      const distance = comp.distance || 1;
      const weight = Math.max(0.1, 1 / distance);

      totalAdjustedValue += adjustedValue * weight;
      weights += weight;

      comparableResults.push({
        address: comp.address || 'Unknown',
        distance: distance,
        soldPrice: comp.price || 0,
        soldDate: comp.soldDate || '',
        squareFootage: comp.squareFootage || 0,
        adjustedValue: Math.round(adjustedValue),
      });

      // Aggregate adjustments
      Object.entries(compAdjustments).forEach(([key, value]) => {
        adjustments[key] = (adjustments[key] || 0) + value;
      });
    }

    if (weights === 0) {
      return null;
    }

    const estimatedValue = Math.round(totalAdjustedValue / weights);

    // Confidence based on number of comps and distance
    const compCount = Math.min(comps.length, 10);
    const avgDistance =
      comps.slice(0, 10).reduce((sum, c) => sum + (c.distance || 1), 0) / compCount;
    const confidence = Math.min(95, 50 + compCount * 3 - avgDistance * 2);

    return {
      estimatedValue,
      confidence: Math.max(30, confidence),
      comparables: comparableResults,
      adjustments,
    };
  }

  /**
   * Get Cost Approach valuation (fallback)
   */
  private async getCostApproach(input: AVMCascadeInput): Promise<AVMResult | null> {
    if (!input.squareFootage || !input.yearBuilt) {
      return null;
    }

    try {
      // Simplified cost approach
      const currentYear = new Date().getFullYear();
      const age = currentYear - input.yearBuilt;

      // Base construction cost per sqft (varies by region and type)
      let costPerSqft = 150; // National average

      if (input.propertyType === 'luxury') {
        costPerSqft = 250;
      } else if (input.propertyType === 'starter') {
        costPerSqft = 100;
      }

      // Depreciation: 1.5% per year for first 20 years, 0.5% thereafter
      let depreciationRate = 0;
      if (age <= 20) {
        depreciationRate = age * 0.015;
      } else {
        depreciationRate = 0.3 + (age - 20) * 0.005;
      }
      depreciationRate = Math.min(0.8, depreciationRate); // Max 80% depreciation

      const replacementCost = input.squareFootage * costPerSqft;
      const depreciatedValue = replacementCost * (1 - depreciationRate);

      // Add land value estimate (20-30% of total)
      const landValue = depreciatedValue * 0.25;
      const totalValue = Math.round(depreciatedValue + landValue);

      return {
        estimatedValue: totalValue,
        method: 'cost-approach',
        confidence: 60, // Lower confidence for cost approach
        valuationRange: {
          low: Math.round(totalValue * 0.85),
          high: Math.round(totalValue * 1.15),
        },
        modelDetails: {
          provider: 'Internal Cost Model',
          timestamp: new Date().toISOString(),
          dataPoints: 0,
          adjustments: {
            replacementCost,
            depreciation: -replacementCost * depreciationRate,
            landValue,
          },
        },
      };
    } catch (error) {
      this.logger.warn(`Cost approach failed: ${error}`);
      return null;
    }
  }

  /**
   * Check if result meets quality thresholds
   */
  private isResultAcceptable(result: AVMResult): boolean {
    // Minimum confidence threshold
    if (result.confidence < 30) {
      return false;
    }

    // Sanity check on value (must be between $10k and $50M)
    if (result.estimatedValue < 10000 || result.estimatedValue > 50000000) {
      return false;
    }

    // Range sanity check (high shouldn't be more than 2x low)
    if (result.valuationRange.high > result.valuationRange.low * 2) {
      return false;
    }

    return true;
  }
}
