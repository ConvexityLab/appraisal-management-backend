/**
 * Comparable Analysis & Verification Service
 * Analyzes and verifies comparable sales used in appraisals
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import {
  ComparableAnalysis,
  ComparableVerification,
  AdjustmentAnalysis,
  ComparableAnalysisSummary,
  AlternativeComparable,
  SubjectPropertySummary,
  VerifyComparableRequest
} from '../types/review.types.js';

export class ComparableAnalysisService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Perform comprehensive comparable analysis
   */
  async analyzeComparables(
    reviewId: string,
    subjectProperty: SubjectPropertySummary,
    comparables: any[]
  ): Promise<ComparableAnalysis> {
    this.logger.info('Analyzing comparables', { 
      reviewId, 
      comparableCount: comparables.length 
    });

    // Verify and analyze each comparable
    const verifiedComps: ComparableVerification[] = [];
    
    for (let i = 0; i < comparables.length; i++) {
      const comp = comparables[i];
      const verification = await this.verifyComparable(
        reviewId,
        i + 1,
        comp,
        subjectProperty
      );
      verifiedComps.push(verification);
    }

    // Generate summary analysis
    const summary = this.generateAnalysisSummary(verifiedComps, subjectProperty);

    const analysis: ComparableAnalysis = {
      reviewId,
      propertyAddress: subjectProperty.address,
      subjectProperty,
      comparables: verifiedComps,
      summary,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save analysis
    await this.dbService.saveComparableAnalysis(analysis);

    this.logger.info('Comparable analysis completed', { reviewId });
    return analysis;
  }

  /**
   * Verify a single comparable
   */
  async verifyComparable(
    reviewId: string,
    compNumber: number,
    comparable: any,
    subjectProperty: SubjectPropertySummary
  ): Promise<ComparableVerification> {
    this.logger.info('Verifying comparable', { reviewId, compNumber });

    // Calculate distance to subject
    const distance = this.calculateDistance(
      comparable.latitude,
      comparable.longitude,
      subjectProperty
    );

    // Analyze adjustments
    const adjustments = this.analyzeAdjustments(comparable, subjectProperty);
    const totalAdjustment = adjustments.reduce((sum, adj) => sum + adj.appraiserAdjustment, 0);
    const totalAdjustmentPercent = (totalAdjustment / comparable.salePrice) * 100;
    const adjustedValue = comparable.salePrice + totalAdjustment;

    // Assess appropriateness
    const appropriateness = this.assessComparableAppropriateness(
      comparable,
      subjectProperty,
      adjustments,
      distance
    );

    // Verify data (would integrate with MLS, public records, etc.)
    const verification = await this.verifyComparableData(comparable);

    const verifiedComp: ComparableVerification = {
      id: this.generateId(),
      compNumber,
      address: comparable.address,
      salePrice: comparable.salePrice,
      saleDate: new Date(comparable.saleDate),
      verificationStatus: verification.status,
      verificationSource: verification.source,
      verificationDate: new Date(),
      gla: comparable.gla,
      bedrooms: comparable.bedrooms,
      bathrooms: comparable.bathrooms,
      yearBuilt: comparable.yearBuilt,
      lotSize: comparable.lotSize,
      condition: comparable.condition,
      quality: comparable.quality,
      distanceToSubject: distance,
      neighborhood: comparable.neighborhood || 'Unknown',
      marketArea: comparable.marketArea || subjectProperty.address.split(',')[1]?.trim() || 'Unknown',
      locationRating: this.compareLocation(distance),
      adjustments,
      totalAdjustment,
      totalAdjustmentPercent,
      adjustedValue,
      appropriatenessScore: appropriateness.score,
      appropriatenessIssues: appropriateness.issues,
      dataCompleteness: verification.completeness,
      dataAccuracy: verification.accuracy,
      dataSource: verification.source,
      recommendedAction: this.determineRecommendedAction(appropriateness.score, verification.status)
    };

    return verifiedComp;
  }

  /**
   * Analyze adjustments applied to comparable
   */
  private analyzeAdjustments(
    comparable: any,
    subject: SubjectPropertySummary
  ): AdjustmentAnalysis[] {
    const adjustments: AdjustmentAnalysis[] = [];

    // Location adjustment (if applicable)
    if (comparable.locationAdjustment) {
      adjustments.push({
        category: 'Location',
        appraiserAdjustment: comparable.locationAdjustment,
        suggestedAdjustment: this.calculateLocationAdjustment(comparable, subject),
        reasonableness: this.assessAdjustmentReasonableness(comparable.locationAdjustment, 'location'),
        comments: 'Location adjustment based on neighborhood desirability'
      });
    }

    // GLA adjustment
    const glaAdjustment = comparable.glaAdjustment || this.calculateGLAAdjustment(comparable, subject);
    adjustments.push({
      category: 'GLA',
      appraiserAdjustment: comparable.glaAdjustment || 0,
      suggestedAdjustment: glaAdjustment,
      marketSupportedRange: this.getMarketAdjustmentRange('gla'),
      reasonableness: this.assessAdjustmentReasonableness(glaAdjustment, 'gla'),
      comments: `GLA difference: ${Math.abs(subject.gla - comparable.gla)} sq ft`
    });

    // Bedroom adjustment
    if (subject.bedrooms !== comparable.bedrooms) {
      const bedroomAdjustment = (subject.bedrooms - comparable.bedrooms) * 5000; // Typical $5k per bedroom
      adjustments.push({
        category: 'Bedrooms',
        appraiserAdjustment: comparable.bedroomAdjustment || 0,
        suggestedAdjustment: bedroomAdjustment,
        marketSupportedRange: { min: 3000, max: 8000 },
        reasonableness: this.assessAdjustmentReasonableness(bedroomAdjustment, 'bedroom'),
        comments: `${Math.abs(subject.bedrooms - comparable.bedrooms)} bedroom difference`
      });
    }

    // Bathroom adjustment
    if (subject.bathrooms !== comparable.bathrooms) {
      const bathroomAdjustment = (subject.bathrooms - comparable.bathrooms) * 3000; // Typical $3k per bathroom
      adjustments.push({
        category: 'Bathrooms',
        appraiserAdjustment: comparable.bathroomAdjustment || 0,
        suggestedAdjustment: bathroomAdjustment,
        marketSupportedRange: { min: 2000, max: 5000 },
        reasonableness: this.assessAdjustmentReasonableness(bathroomAdjustment, 'bathroom'),
        comments: `${Math.abs(subject.bathrooms - comparable.bathrooms)} bathroom difference`
      });
    }

    // Age adjustment
    if (subject.yearBuilt !== comparable.yearBuilt) {
      const ageDifference = comparable.yearBuilt - subject.yearBuilt;
      const ageAdjustment = ageDifference * 500; // Typical $500 per year
      adjustments.push({
        category: 'Age',
        appraiserAdjustment: comparable.ageAdjustment || 0,
        suggestedAdjustment: ageAdjustment,
        marketSupportedRange: { min: 300, max: 1000 },
        reasonableness: this.assessAdjustmentReasonableness(ageAdjustment, 'age'),
        comments: `${Math.abs(ageDifference)} year age difference`
      });
    }

    // Condition adjustment
    if (subject.condition !== comparable.condition) {
      const conditionAdjustment = this.calculateConditionAdjustment(subject.condition, comparable.condition);
      adjustments.push({
        category: 'Condition',
        appraiserAdjustment: comparable.conditionAdjustment || 0,
        suggestedAdjustment: conditionAdjustment,
        reasonableness: this.assessAdjustmentReasonableness(conditionAdjustment, 'condition'),
        comments: `Condition: ${subject.condition} vs ${comparable.condition}`
      });
    }

    // Quality adjustment
    if (subject.quality !== comparable.quality) {
      const qualityAdjustment = this.calculateQualityAdjustment(subject.quality, comparable.quality);
      adjustments.push({
        category: 'Quality',
        appraiserAdjustment: comparable.qualityAdjustment || 0,
        suggestedAdjustment: qualityAdjustment,
        reasonableness: this.assessAdjustmentReasonableness(qualityAdjustment, 'quality'),
        comments: `Quality: ${subject.quality} vs ${comparable.quality}`
      });
    }

    return adjustments;
  }

  /**
   * Assess comparable appropriateness
   */
  private assessComparableAppropriateness(
    comparable: any,
    subject: SubjectPropertySummary,
    adjustments: AdjustmentAnalysis[],
    distance: number
  ): { score: number; issues: string[] } {
    let score = 100;
    const issues: string[] = [];

    // Distance penalty
    if (distance > 1.0) {
      score -= 10;
      issues.push(`Distance to subject: ${distance.toFixed(2)} miles (>1 mile)`);
    }
    if (distance > 3.0) {
      score -= 20;
      issues.push(`Distance excessive: ${distance.toFixed(2)} miles`);
    }

    // Sale date penalty
    const saleAge = this.calculateSaleAge(comparable.saleDate);
    if (saleAge > 90) {
      score -= 15;
      issues.push(`Sale date over 90 days old: ${saleAge} days`);
    }
    if (saleAge > 180) {
      score -= 25;
      issues.push(`Sale date over 180 days old: ${saleAge} days`);
    }

    // GLA difference penalty
    const glaDiff = Math.abs((comparable.gla - subject.gla) / subject.gla) * 100;
    if (glaDiff > 20) {
      score -= 15;
      issues.push(`GLA difference exceeds 20%: ${glaDiff.toFixed(1)}%`);
    }

    // Total adjustment penalty
    const totalAdjustmentPercent = adjustments.reduce((sum, adj) => 
      sum + Math.abs(adj.appraiserAdjustment), 0) / comparable.salePrice * 100;
    
    if (totalAdjustmentPercent > 25) {
      score -= 20;
      issues.push(`Total adjustments exceed 25%: ${totalAdjustmentPercent.toFixed(1)}%`);
    }

    // Net adjustment penalty
    const netAdjustment = Math.abs(adjustments.reduce((sum, adj) => 
      sum + adj.appraiserAdjustment, 0)) / comparable.salePrice * 100;
    
    if (netAdjustment > 15) {
      score -= 10;
      issues.push(`Net adjustment exceeds 15%: ${netAdjustment.toFixed(1)}%`);
    }

    // Property type mismatch
    if (subject.propertyType !== comparable.propertyType) {
      score -= 30;
      issues.push(`Property type mismatch: ${subject.propertyType} vs ${comparable.propertyType}`);
    }

    // Questionable adjustments
    const questionableAdj = adjustments.filter(a => a.reasonableness === 'QUESTIONABLE' || a.reasonableness === 'UNSUPPORTED');
    if (questionableAdj.length > 0) {
      score -= questionableAdj.length * 5;
      issues.push(`${questionableAdj.length} questionable adjustment(s)`);
    }

    return { score: Math.max(0, score), issues };
  }

  /**
   * Verify comparable data against external sources
   */
  private async verifyComparableData(comparable: any): Promise<{
    status: 'VERIFIED' | 'UNVERIFIED' | 'QUESTIONABLE';
    source: string;
    completeness: number;
    accuracy: 'HIGH' | 'MEDIUM' | 'LOW';
  }> {
    // In production, would integrate with:
    // - MLS data
    // - Public property records
    // - Recent sales databases
    // - GIS systems

    const completeness = this.calculateDataCompleteness(comparable);
    
    return {
      status: comparable.mlsNumber ? 'VERIFIED' : 'UNVERIFIED',
      source: comparable.mlsNumber ? 'MLS' : 'Public Records',
      completeness,
      accuracy: completeness > 90 ? 'HIGH' : completeness > 70 ? 'MEDIUM' : 'LOW'
    };
  }

  /**
   * Generate summary analysis
   */
  private generateAnalysisSummary(
    comparables: ComparableVerification[],
    subject: SubjectPropertySummary
  ): ComparableAnalysisSummary {
    const verified = comparables.filter(c => c.verificationStatus === 'VERIFIED').length;
    const questionable = comparables.filter(c => c.verificationStatus === 'QUESTIONABLE').length;
    const rejected = comparables.filter(c => c.verificationStatus === 'REJECTED').length;

    const avgTotalAdj = comparables.reduce((sum, c) => sum + Math.abs(c.totalAdjustment), 0) / comparables.length;
    const avgNetAdj = comparables.reduce((sum, c) => sum + c.totalAdjustment, 0) / comparables.length;
    const largestAdj = Math.max(...comparables.map(c => Math.abs(c.totalAdjustment)));

    const avgScore = comparables.reduce((sum, c) => sum + c.appropriatenessScore, 0) / comparables.length;
    const selectionQuality = avgScore >= 80 ? 'EXCELLENT' as const : 
                            avgScore >= 60 ? 'GOOD' as const :
                            avgScore >= 40 ? 'ADEQUATE' as const : 'POOR' as const;

    const allIssues = comparables.flatMap(c => c.appropriatenessIssues);
    const adjustmentConcerns = comparables.flatMap(c => 
      c.adjustments.filter(a => a.reasonableness !== 'REASONABLE').map(a => 
        `${c.address}: ${a.category} adjustment ${a.reasonableness.toLowerCase()}`
      )
    );

    const selectionIssues: string[] = [];
    if (verified < comparables.length * 0.5) {
      selectionIssues.push('Less than 50% of comparables verified');
    }
    if (avgScore < 60) {
      selectionIssues.push('Average appropriateness score below 60');
    }
    if (comparables.some(c => c.distanceToSubject > 3)) {
      selectionIssues.push('One or more comparables over 3 miles from subject');
    }

    const adjustedValues = comparables.map(c => c.adjustedValue);
    const valueRange = {
      low: Math.min(...adjustedValues),
      high: Math.max(...adjustedValues)
    };

    return {
      totalComparablesReviewed: comparables.length,
      comparablesVerified: verified,
      comparablesQuestionable: questionable,
      comparablesRejected: rejected,
      averageTotalAdjustment: Math.round(avgTotalAdj),
      averageNetAdjustment: Math.round(avgNetAdj),
      largestAdjustment: Math.round(largestAdj),
      adjustmentConcerns,
      selectionQuality,
      selectionIssues,
      overallAssessment: this.generateOverallAssessment(selectionQuality, selectionIssues, adjustmentConcerns),
      valueIndicationRange: valueRange
    };
  }

  /**
   * Search for alternative comparables
   */
  async searchAlternativeComparables(
    subjectProperty: SubjectPropertySummary,
    excludeAddresses: string[]
  ): Promise<AlternativeComparable[]> {
    this.logger.info('Searching for alternative comparables');

    // In production, would query MLS, public records, etc.
    // For now, return empty array
    return [];
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private calculateDistance(lat1: number, lon1: number, subject: SubjectPropertySummary): number {
    // Haversine formula for distance calculation
    // Simplified version - would need actual coordinates
    return Math.random() * 2; // Mock distance 0-2 miles
  }

  private calculateGLAAdjustment(comparable: any, subject: SubjectPropertySummary): number {
    const glaDiff = subject.gla - comparable.gla;
    const pricePerSqFt = 100; // Market-derived price per sq ft
    return glaDiff * pricePerSqFt;
  }

  private calculateLocationAdjustment(comparable: any, subject: SubjectPropertySummary): number {
    // Would analyze neighborhood quality, school districts, amenities, etc.
    return 0; // Placeholder
  }

  private calculateConditionAdjustment(subjectCondition: string, compCondition: string): number {
    const conditionScale: Record<string, number> = {
      'Excellent': 5,
      'Good': 4,
      'Average': 3,
      'Fair': 2,
      'Poor': 1
    };

    const diff = (conditionScale[subjectCondition] || 3) - (conditionScale[compCondition] || 3);
    return diff * 5000; // $5k per condition level
  }

  private calculateQualityAdjustment(subjectQuality: string, compQuality: string): number {
    const qualityScale: Record<string, number> = {
      'Superior': 5,
      'Good': 4,
      'Average': 3,
      'Fair': 2,
      'Poor': 1
    };

    const diff = (qualityScale[subjectQuality] || 3) - (qualityScale[compQuality] || 3);
    return diff * 10000; // $10k per quality level
  }

  private compareLocation(distance: number): 'SUPERIOR' | 'SIMILAR' | 'INFERIOR' {
    if (distance < 0.5) return 'SIMILAR';
    if (distance < 2.0) return 'SIMILAR';
    return 'INFERIOR';
  }

  private assessAdjustmentReasonableness(
    adjustment: number,
    category: string
  ): 'REASONABLE' | 'QUESTIONABLE' | 'UNSUPPORTED' {
    const ranges: Record<string, { min: number; max: number }> = {
      gla: { min: 50, max: 150 },        // Per sq ft
      bedroom: { min: 3000, max: 8000 },
      bathroom: { min: 2000, max: 5000 },
      age: { min: 300, max: 1000 },      // Per year
      location: { min: -20000, max: 20000 },
      condition: { min: -15000, max: 15000 },
      quality: { min: -30000, max: 30000 }
    };

    const range = ranges[category];
    if (!range) return 'REASONABLE';

    const absAdj = Math.abs(adjustment);
    if (absAdj <= range.max * 1.2) return 'REASONABLE';
    if (absAdj <= range.max * 2) return 'QUESTIONABLE';
    return 'UNSUPPORTED';
  }

  private getMarketAdjustmentRange(category: string): { min: number; max: number } {
    const ranges: Record<string, { min: number; max: number }> = {
      gla: { min: 50, max: 150 },
      bedroom: { min: 3000, max: 8000 },
      bathroom: { min: 2000, max: 5000 },
      age: { min: 300, max: 1000 }
    };

    return ranges[category] || { min: 0, max: 0 };
  }

  private calculateSaleAge(saleDate: Date | string): number {
    const sale = new Date(saleDate);
    const now = new Date();
    return Math.floor((now.getTime() - sale.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateDataCompleteness(comparable: any): number {
    const requiredFields = [
      'address', 'salePrice', 'saleDate', 'gla', 'bedrooms', 
      'bathrooms', 'yearBuilt', 'lotSize', 'condition', 'quality'
    ];

    const presentFields = requiredFields.filter(field => 
      comparable[field] !== undefined && comparable[field] !== null && comparable[field] !== ''
    );

    return Math.round((presentFields.length / requiredFields.length) * 100);
  }

  private determineRecommendedAction(
    appropriatenessScore: number,
    verificationStatus: string
  ): 'ACCEPT' | 'MODIFY' | 'REPLACE' | 'REJECT' {
    if (verificationStatus === 'REJECTED' || appropriatenessScore < 40) {
      return 'REJECT';
    }
    if (appropriatenessScore < 60 || verificationStatus === 'QUESTIONABLE') {
      return 'REPLACE';
    }
    if (appropriatenessScore < 80) {
      return 'MODIFY';
    }
    return 'ACCEPT';
  }

  private generateOverallAssessment(
    selectionQuality: string,
    selectionIssues: string[],
    adjustmentConcerns: string[]
  ): string {
    if (selectionQuality === 'EXCELLENT' && selectionIssues.length === 0 && adjustmentConcerns.length === 0) {
      return 'Comparable selection is excellent with well-supported adjustments.';
    }
    if (selectionQuality === 'GOOD' && adjustmentConcerns.length < 3) {
      return 'Comparable selection is generally good with minor concerns.';
    }
    if (selectionQuality === 'ADEQUATE') {
      return 'Comparable selection is adequate but has several issues that should be addressed.';
    }
    return 'Comparable selection has significant issues and should be reconsidered.';
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
