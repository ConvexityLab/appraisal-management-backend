/**
 * ROV (Reconsideration of Value) Research Service
 * 
 * Provides intelligent comparable property research, automated adjustment calculations,
 * and market trend analysis for ROV responses.
 */

import { Logger } from '../utils/logger';
import { EnhancedPropertyIntelligenceV2Service } from './enhanced-property-intelligence-v2.service';
import { ROVComparable } from '../types/rov.types';

/**
 * Criteria for comparable property search
 */
export interface ComparableSearchCriteria {
  subjectAddress: string;
  latitude: number;
  longitude: number;
  radiusMiles?: number;
  maxResults?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  saleDateStart?: Date;
  saleDateEnd?: Date;
  propertyTypes?: string[];
}

/**
 * Subject property details for adjustment calculations
 */
export interface SubjectProperty {
  address: string;
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  lotSize?: number;
  propertyType: string;
  condition?: 'excellent' | 'good' | 'average' | 'fair' | 'poor';
  features?: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Market trend analysis result
 */
export interface MarketTrendAnalysis {
  averageSalePrice: number;
  medianSalePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  sampleSize: number;
  analysisDate: Date;
  salesByMonth: {
    month: string;
    averagePrice: number;
    count: number;
  }[];
}

/**
 * Adjustment factors for comparable properties
 */
export interface AdjustmentFactors {
  locationAdjustmentPerMile: number;
  squareFeetAdjustmentPerSqFt: number;
  bedroomAdjustment: number;
  bathroomAdjustment: number;
  ageAdjustmentPerYear: number;
  conditionAdjustments: {
    excellent: number;
    good: number;
    average: number;
    fair: number;
    poor: number;
  };
  featureAdjustments: {
    pool: number;
    garage: number;
    updated_kitchen: number;
    updated_bathrooms: number;
    hardwood_floors: number;
    finished_basement: number;
  };
}

/**
 * Default adjustment factors (industry standards)
 */
const DEFAULT_ADJUSTMENT_FACTORS: AdjustmentFactors = {
  locationAdjustmentPerMile: -2000,  // $2k decrease per mile from subject
  squareFeetAdjustmentPerSqFt: 100,   // $100 per sq ft
  bedroomAdjustment: 5000,            // $5k per bedroom
  bathroomAdjustment: 3000,           // $3k per bathroom
  ageAdjustmentPerYear: -500,         // -$500 per year older
  conditionAdjustments: {
    excellent: 10000,
    good: 5000,
    average: 0,
    fair: -5000,
    poor: -15000
  },
  featureAdjustments: {
    pool: 15000,
    garage: 8000,
    updated_kitchen: 12000,
    updated_bathrooms: 8000,
    hardwood_floors: 5000,
    finished_basement: 10000
  }
};

export class ROVResearchService {
  private logger: Logger;
  private propertyIntelligenceService: EnhancedPropertyIntelligenceV2Service;
  private adjustmentFactors: AdjustmentFactors;

  constructor(customAdjustmentFactors?: Partial<AdjustmentFactors>) {
    this.logger = new Logger();
    this.propertyIntelligenceService = new EnhancedPropertyIntelligenceV2Service();
    this.adjustmentFactors = {
      ...DEFAULT_ADJUSTMENT_FACTORS,
      ...customAdjustmentFactors
    };
  }

  /**
   * Search for comparable properties
   */
  async searchComparables(
    criteria: ComparableSearchCriteria
  ): Promise<ROVComparable[]> {
    try {
      this.logger.info('Searching for comparable properties', {
        address: criteria.subjectAddress,
        radius: criteria.radiusMiles
      });

      // TODO: Integrate with MLS data source or property database
      // For now, use mock data structure
      const mockComparables: ROVComparable[] = [];

      // In production, this would query:
      // 1. MLS APIs (Multiple Listing Service)
      // 2. Public records databases
      // 3. Third-party property data providers (CoreLogic, Zillow, etc.)
      // 4. Internal property database

      // Search criteria would include:
      // - Geographic radius from subject property
      // - Similar square footage (±20%)
      // - Same number of bedrooms/bathrooms (±1)
      // - Recent sales (last 6 months preferred)
      // - Similar property type
      // - Similar age (±10 years)

      this.logger.info('Found comparable properties', {
        count: mockComparables.length
      });

      return mockComparables;

    } catch (error) {
      this.logger.error('Error searching for comparables', { error, criteria });
      throw error;
    }
  }

  /**
   * Calculate adjustments for a comparable property
   */
  calculateAdjustments(
    subjectProperty: SubjectProperty,
    comparable: Partial<ROVComparable>
  ): { adjustments: any; adjustedValue: number } {
    try {
      const adjustments: any = {
        location: 0,
        size: 0,
        condition: 0,
        features: 0,
        total: 0
      };

      const salePrice = comparable.salePrice || 0;

      // Location adjustment (distance from subject)
      if (comparable.distanceFromSubject) {
        adjustments.location = Math.round(
          comparable.distanceFromSubject * this.adjustmentFactors.locationAdjustmentPerMile
        );
      }

      // Square footage adjustment
      if (comparable.squareFootage && subjectProperty.squareFootage) {
        const sqFtDifference = subjectProperty.squareFootage - comparable.squareFootage;
        adjustments.size = Math.round(
          sqFtDifference * this.adjustmentFactors.squareFeetAdjustmentPerSqFt
        );
      }

      // Bedroom adjustment
      if (comparable.bedrooms && subjectProperty.bedrooms) {
        const bedroomDifference = subjectProperty.bedrooms - comparable.bedrooms;
        adjustments.size += Math.round(
          bedroomDifference * this.adjustmentFactors.bedroomAdjustment
        );
      }

      // Bathroom adjustment
      if (comparable.bathrooms && subjectProperty.bathrooms) {
        const bathroomDifference = subjectProperty.bathrooms - comparable.bathrooms;
        adjustments.size += Math.round(
          bathroomDifference * this.adjustmentFactors.bathroomAdjustment
        );
      }

      // Condition adjustment
      const subjectCondition = subjectProperty.condition || 'average';
      const comparableCondition = 'average'; // Would come from comparable data
      
      if (subjectCondition !== comparableCondition) {
        const subjectConditionValue = this.adjustmentFactors.conditionAdjustments[subjectCondition];
        const comparableConditionValue = this.adjustmentFactors.conditionAdjustments[comparableCondition as keyof typeof this.adjustmentFactors.conditionAdjustments];
        adjustments.condition = subjectConditionValue - comparableConditionValue;
      }

      // Feature adjustments
      const subjectFeatures = new Set(subjectProperty.features || []);
      const comparableFeatures = new Set<string>(); // Would come from comparable data

      for (const feature of Object.keys(this.adjustmentFactors.featureAdjustments) as Array<keyof typeof this.adjustmentFactors.featureAdjustments>) {
        const subjectHasFeature = subjectFeatures.has(feature);
        const comparableHasFeature = comparableFeatures.has(feature);

        if (subjectHasFeature && !comparableHasFeature) {
          adjustments.features += this.adjustmentFactors.featureAdjustments[feature];
        } else if (!subjectHasFeature && comparableHasFeature) {
          adjustments.features -= this.adjustmentFactors.featureAdjustments[feature];
        }
      }

      // Calculate total adjustment
      adjustments.total = 
        adjustments.location + 
        adjustments.size + 
        adjustments.condition + 
        adjustments.features;

      const adjustedValue = Math.round(salePrice + adjustments.total);

      this.logger.debug('Calculated adjustments', {
        salePrice,
        adjustments,
        adjustedValue
      });

      return { adjustments, adjustedValue };

    } catch (error) {
      this.logger.error('Error calculating adjustments', { error });
      throw error;
    }
  }

  /**
   * Select the best comparables from a list
   * Uses scoring algorithm based on similarity to subject property
   */
  selectBestComparables(
    subjectProperty: SubjectProperty,
    comparables: ROVComparable[],
    count: number = 3
  ): ROVComparable[] {
    try {
      this.logger.info('Selecting best comparables', {
        totalComparables: comparables.length,
        requestedCount: count
      });

      // Score each comparable based on multiple factors
      const scored = comparables.map(comp => {
        let score = 100; // Start with perfect score

        // Penalize distance (prefer closer properties)
        if (comp.distanceFromSubject) {
          score -= comp.distanceFromSubject * 2; // -2 points per mile
        }

        // Penalize square footage difference
        if (comp.squareFootage && subjectProperty.squareFootage) {
          const sqFtDiff = Math.abs(comp.squareFootage - subjectProperty.squareFootage);
          const sqFtDiffPercent = (sqFtDiff / subjectProperty.squareFootage) * 100;
          score -= sqFtDiffPercent * 0.5; // -0.5 points per % difference
        }

        // Penalize bedroom/bathroom differences
        if (comp.bedrooms && subjectProperty.bedrooms) {
          score -= Math.abs(comp.bedrooms - subjectProperty.bedrooms) * 5;
        }
        if (comp.bathrooms && subjectProperty.bathrooms) {
          score -= Math.abs(comp.bathrooms - subjectProperty.bathrooms) * 3;
        }

        // Penalize old sales (prefer recent sales)
        if (comp.saleDate) {
          const ageInDays = Math.floor(
            (Date.now() - new Date(comp.saleDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          score -= ageInDays * 0.1; // -0.1 points per day old
        }

        // Bonus for already selected comparables
        if (comp.selected) {
          score += 20;
        }

        return { ...comp, score };
      });

      // Sort by score (highest first) and take top N
      const bestComparables = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(({ score, ...comp }) => comp); // Remove score from result

      this.logger.info('Selected best comparables', {
        count: bestComparables.length,
        addresses: bestComparables.map(c => c.address)
      });

      return bestComparables;

    } catch (error) {
      this.logger.error('Error selecting best comparables', { error });
      throw error;
    }
  }

  /**
   * Analyze market trends for a location
   */
  async analyzeMarketTrends(
    address: string,
    latitude: number,
    longitude: number,
    analysisWindowDays: number = 180
  ): Promise<MarketTrendAnalysis> {
    try {
      this.logger.info('Analyzing market trends', { address, analysisWindowDays });

      const endDate = new Date();
      const startDate = new Date(Date.now() - analysisWindowDays * 24 * 60 * 60 * 1000);

      // TODO: Query recent sales in the area
      // This would integrate with MLS data or property databases
      const recentSales: any[] = []; // Mock data

      if (recentSales.length === 0) {
        this.logger.warn('No recent sales data available for market analysis');
        
        return {
          averageSalePrice: 0,
          medianSalePrice: 0,
          priceRange: { min: 0, max: 0 },
          trend: 'stable',
          trendPercentage: 0,
          sampleSize: 0,
          analysisDate: new Date(),
          salesByMonth: []
        };
      }

      // Calculate basic statistics
      const prices = recentSales.map(s => s.salePrice).sort((a, b) => a - b);
      const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const medianPrice = prices[Math.floor(prices.length / 2)];

      // Calculate trend (compare first half vs second half of time period)
      const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
      const firstHalfSales = recentSales.filter(s => new Date(s.saleDate) < midDate);
      const secondHalfSales = recentSales.filter(s => new Date(s.saleDate) >= midDate);

      const firstHalfAvg = firstHalfSales.reduce((sum, s) => sum + s.salePrice, 0) / firstHalfSales.length;
      const secondHalfAvg = secondHalfSales.reduce((sum, s) => sum + s.salePrice, 0) / secondHalfSales.length;

      const trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      
      let trend: 'increasing' | 'decreasing' | 'stable';
      if (trendPercentage > 2) {
        trend = 'increasing';
      } else if (trendPercentage < -2) {
        trend = 'decreasing';
      } else {
        trend = 'stable';
      }

      // Group sales by month
      const salesByMonth: { [key: string]: { prices: number[]; count: number } } = {};
      
      recentSales.forEach(sale => {
        const monthKey = new Date(sale.saleDate).toISOString().substring(0, 7); // YYYY-MM
        if (!salesByMonth[monthKey]) {
          salesByMonth[monthKey] = { prices: [], count: 0 };
        }
        salesByMonth[monthKey].prices.push(sale.salePrice);
        salesByMonth[monthKey].count++;
      });

      const salesByMonthArray = Object.entries(salesByMonth).map(([month, data]) => ({
        month,
        averagePrice: data.prices.reduce((sum, p) => sum + p, 0) / data.prices.length,
        count: data.count
      }));

      const analysis: MarketTrendAnalysis = {
        averageSalePrice: Math.round(averagePrice),
        medianSalePrice: Math.round(medianPrice),
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        },
        trend,
        trendPercentage: Math.round(trendPercentage * 100) / 100,
        sampleSize: recentSales.length,
        analysisDate: new Date(),
        salesByMonth: salesByMonthArray
      };

      this.logger.info('Market trend analysis complete', {
        averagePrice: analysis.averageSalePrice,
        trend: analysis.trend,
        sampleSize: analysis.sampleSize
      });

      return analysis;

    } catch (error) {
      this.logger.error('Error analyzing market trends', { error });
      throw error;
    }
  }

  /**
   * Generate a comprehensive market analysis report
   */
  async generateMarketAnalysisReport(
    subjectProperty: SubjectProperty,
    comparables: ROVComparable[],
    marketTrends: MarketTrendAnalysis
  ): Promise<string> {
    try {
      // Generate formatted report text
      let report = '=== MARKET ANALYSIS REPORT ===\n\n';
      
      report += `Subject Property: ${subjectProperty.address}\n`;
      report += `Analysis Date: ${new Date().toLocaleDateString()}\n\n`;

      report += '--- Market Trends ---\n';
      report += `Average Sale Price: $${marketTrends.averageSalePrice.toLocaleString()}\n`;
      report += `Median Sale Price: $${marketTrends.medianSalePrice.toLocaleString()}\n`;
      report += `Price Range: $${marketTrends.priceRange.min.toLocaleString()} - $${marketTrends.priceRange.max.toLocaleString()}\n`;
      report += `Market Trend: ${marketTrends.trend.toUpperCase()} (${marketTrends.trendPercentage}%)\n`;
      report += `Sample Size: ${marketTrends.sampleSize} recent sales\n\n`;

      report += '--- Selected Comparables ---\n';
      comparables.forEach((comp, index) => {
        report += `\nComparable #${index + 1}:\n`;
        report += `  Address: ${comp.address}\n`;
        report += `  Sale Price: $${comp.salePrice.toLocaleString()}\n`;
        report += `  Sale Date: ${new Date(comp.saleDate).toLocaleDateString()}\n`;
        report += `  Distance: ${comp.distanceFromSubject} miles\n`;
        report += `  Size: ${comp.squareFootage} sq ft, ${comp.bedrooms} bed, ${comp.bathrooms} bath\n`;
        
        if (comp.adjustments) {
          report += `  Adjustments:\n`;
          report += `    Location: $${comp.adjustments.location?.toLocaleString() || 0}\n`;
          report += `    Size: $${comp.adjustments.size?.toLocaleString() || 0}\n`;
          report += `    Condition: $${comp.adjustments.condition?.toLocaleString() || 0}\n`;
          report += `    Features: $${comp.adjustments.features?.toLocaleString() || 0}\n`;
          report += `    Total Adjustment: $${(
            (comp.adjustments.location || 0) + 
            (comp.adjustments.size || 0) + 
            (comp.adjustments.condition || 0) + 
            (comp.adjustments.features || 0)
          ).toLocaleString()}\n`;
        }
        
        report += `  Adjusted Value: $${comp.adjustedValue.toLocaleString()}\n`;
      });

      report += '\n--- Conclusion ---\n';
      const avgAdjustedValue = comparables.reduce((sum, c) => sum + c.adjustedValue, 0) / comparables.length;
      report += `Average Adjusted Value: $${Math.round(avgAdjustedValue).toLocaleString()}\n`;

      return report;

    } catch (error) {
      this.logger.error('Error generating market analysis report', { error });
      throw error;
    }
  }
}
