/**
 * Fraud Detection Service - Intelligent appraisal fraud analysis
 * 
 * Uses Azure OpenAI (via UniversalAIService) to detect:
 * - Inflated property values
 * - Manipulated comparables
 * - Collusion patterns
 * - Suspicious adjustments
 * - Data inconsistencies
 * 
 * Pure service - can be called directly or wrapped in workflows later.
 */

import { Logger } from '../utils/logger.js';
import { UniversalAIService } from './universal-ai.service';

export interface FraudDetectionInput {
  appraisalId: string;
  propertyAddress: string;
  appraisedValue: number;
  appraisalDate: string;

  // Subject property details
  subjectProperty: {
    squareFootage: number;
    yearBuilt: number;
    condition: string;
    propertyType: string;
    latitude?: number;
    longitude?: number;
  };

  // Comparables analysis
  comparables: Array<{
    address: string;
    soldPrice: number;
    soldDate: string;
    squareFootage: number;
    distance: number; // miles
    adjustments: {
      location?: number;
      size?: number;
      condition?: number;
      date?: number;
      total: number;
    };
    adjustedValue: number;
  }>;

  // Appraiser information
  appraiser: {
    name: string;
    licenseNumber: string;
    licenseState: string;
    yearsExperience?: number;
  };

  // Market context
  marketData?: {
    medianSalePrice: number;
    pricePerSqft: number;
    daysOnMarket: number;
    marketTrend: 'rising' | 'falling' | 'stable';
  };

  // Optional: Order context
  orderContext?: {
    loanAmount: number;
    loanPurpose: 'purchase' | 'refinance';
    loanToValue: number;
  };
}

export interface FraudFlag {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category:
    | 'value-inflation'
    | 'comp-manipulation'
    | 'data-inconsistency'
    | 'collusion'
    | 'adjustment-abuse'
    | 'licensing';
  description: string;
  evidence: string[];
  confidence: number; // 0-100
  recommendation: string;
}

export interface FraudDetectionResult {
  overallRiskScore: number; // 0-100, higher = more fraud risk
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  fraudFlags: FraudFlag[];
  aiAnalysis: {
    summary: string;
    keyFindings: string[];
    redFlags: string[];
    recommendation: 'approve' | 'review' | 'reject';
    confidence: number;
  };
  valuationAssessment: {
    expectedValueRange: {
      low: number;
      high: number;
    };
    valueDeviation: number; // percentage
    isInflated: boolean;
    inflationAmount?: number;
  };
  comparablesAssessment: {
    qualityScore: number; // 0-100
    distanceScore: number;
    adjustmentScore: number;
    suspiciousComps: string[];
  };
  timestamp: string;
  processingTime: number;
}

export class FraudDetectionService {
  private logger: Logger;
  private aiService: UniversalAIService;

  constructor() {
    this.logger = new Logger();
    this.aiService = new UniversalAIService();
  }

  /**
   * Analyze appraisal for fraud indicators
   */
  async analyzeAppraisal(input: FraudDetectionInput): Promise<FraudDetectionResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting fraud detection for appraisal ${input.appraisalId}`);

      // 1. Perform rule-based checks
      const ruleBasedFlags = this.performRuleBasedChecks(input);

      // 2. Perform AI-powered analysis
      const aiAnalysis = await this.performAIAnalysis(input, ruleBasedFlags);

      // 3. Assess valuation
      const valuationAssessment = this.assessValuation(input);

      // 4. Assess comparables quality
      const comparablesAssessment = this.assessComparables(input);

      // 5. Calculate overall risk score
      const overallRiskScore = this.calculateRiskScore(
        ruleBasedFlags,
        aiAnalysis,
        valuationAssessment,
        comparablesAssessment
      );

      const result: FraudDetectionResult = {
        overallRiskScore,
        riskLevel: this.getRiskLevel(overallRiskScore),
        fraudFlags: ruleBasedFlags,
        aiAnalysis,
        valuationAssessment,
        comparablesAssessment,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
      };

      this.logger.info(
        `✅ Fraud detection complete: ${result.riskLevel} risk (${overallRiskScore}/100) in ${result.processingTime}ms`
      );

      return result;
    } catch (error) {
      this.logger.error(`Fraud detection error: ${error}`);
      throw error;
    }
  }

  /**
   * Perform rule-based fraud checks
   */
  private performRuleBasedChecks(input: FraudDetectionInput): FraudFlag[] {
    const flags: FraudFlag[] = [];

    // Check 1: Value inflation (appraisal > all comps by significant margin)
    if (input.comparables.length > 0) {
      const avgCompPrice =
        input.comparables.reduce((sum, c) => sum + c.soldPrice, 0) / input.comparables.length;
      const deviation = ((input.appraisedValue - avgCompPrice) / avgCompPrice) * 100;

      if (deviation > 20) {
        flags.push({
          severity: deviation > 30 ? 'critical' : 'high',
          category: 'value-inflation',
          description: 'Appraised value significantly exceeds comparable sales',
          evidence: [
            `Appraisal: $${input.appraisedValue.toLocaleString()}`,
            `Average comp: $${avgCompPrice.toLocaleString()}`,
            `Deviation: +${deviation.toFixed(1)}%`,
          ],
          confidence: 85,
          recommendation: 'Review appraisal justification and adjustment methodology',
        });
      }
    }

    // Check 2: Excessive adjustments
    const excessiveAdjustments = input.comparables.filter((c) => {
      const adjustmentPercent = Math.abs((c.adjustments.total / c.soldPrice) * 100);
      return adjustmentPercent > 25;
    });

    if (excessiveAdjustments.length > 0) {
      flags.push({
        severity: excessiveAdjustments.length > 2 ? 'high' : 'medium',
        category: 'adjustment-abuse',
        description: 'Excessive adjustments applied to comparables',
        evidence: excessiveAdjustments.map(
          (c) =>
            `${c.address}: ${Math.abs((c.adjustments.total / c.soldPrice) * 100).toFixed(1)}% adjustment`
        ),
        confidence: 75,
        recommendation: 'Verify adjustment methodology and market data support',
      });
    }

    // Check 3: Suspicious comparable selection (all far away or old)
    const avgDistance =
      input.comparables.reduce((sum, c) => sum + c.distance, 0) / input.comparables.length;
    if (avgDistance > 5) {
      flags.push({
        severity: 'medium',
        category: 'comp-manipulation',
        description: 'Comparables selected from distant locations',
        evidence: [
          `Average distance: ${avgDistance.toFixed(1)} miles`,
          'May indicate cherry-picking to support inflated value',
        ],
        confidence: 65,
        recommendation: 'Check for closer, more recent comparable sales',
      });
    }

    // Check 4: LTV near limit (potential pressure)
    if (input.orderContext && input.orderContext.loanToValue > 95) {
      flags.push({
        severity: 'medium',
        category: 'value-inflation',
        description: 'LTV at or near limit - potential pressure on appraiser',
        evidence: [
          `LTV: ${input.orderContext.loanToValue.toFixed(1)}%`,
          `Loan: $${input.orderContext.loanAmount.toLocaleString()}`,
          `Appraisal: $${input.appraisedValue.toLocaleString()}`,
        ],
        confidence: 60,
        recommendation: 'Enhanced review recommended for high-LTV transactions',
      });
    }

    // Check 5: Comps all adjusted upward (red flag)
    const allUpwardAdjustments = input.comparables.every((c) => c.adjustments.total > 0);
    if (allUpwardAdjustments && input.comparables.length >= 3) {
      flags.push({
        severity: 'high',
        category: 'comp-manipulation',
        description: 'All comparables adjusted upward',
        evidence: [
          'Every comp received positive adjustments',
          'Highly unusual pattern suggesting value inflation',
        ],
        confidence: 80,
        recommendation: 'Review for selection bias and adjustment justification',
      });
    }

    // Check 6: Property condition mismatch
    const conditionKeywords = ['poor', 'fair', 'average', 'good', 'excellent'];
    const subjectConditionIndex = conditionKeywords.indexOf(
      input.subjectProperty.condition.toLowerCase()
    );

    if (subjectConditionIndex <= 1 && input.appraisedValue > 0) {
      // Poor/Fair condition but high value
      const expectedValue =
        input.comparables.length > 0
          ? (input.comparables.reduce((sum, c) => sum + c.soldPrice, 0) /
              input.comparables.length) *
            0.85
          : 0;

      if (input.appraisedValue > expectedValue) {
        flags.push({
          severity: 'medium',
          category: 'data-inconsistency',
          description: 'Poor condition rating inconsistent with high valuation',
          evidence: [
            `Condition: ${input.subjectProperty.condition}`,
            `Value: $${input.appraisedValue.toLocaleString()}`,
          ],
          confidence: 70,
          recommendation: 'Verify condition rating and its impact on value',
        });
      }
    }

    return flags;
  }

  /**
   * Perform AI-powered analysis using UniversalAIService
   */
  private async performAIAnalysis(
    input: FraudDetectionInput,
    ruleBasedFlags: FraudFlag[]
  ): Promise<FraudDetectionResult['aiAnalysis']> {
    try {
      const prompt = this.buildAIPrompt(input, ruleBasedFlags);

      const completion = await this.aiService.generateCompletion({
        messages: [
          {
            role: 'system',
            content: `You are an expert appraisal fraud detection analyst with 20+ years of experience. 
You specialize in identifying value inflation, collusion, and manipulation in residential real estate appraisals.
Analyze the provided appraisal data and identify potential fraud indicators with specific evidence.
Be thorough, objective, and cite specific numbers and patterns.
Return your analysis as JSON with these fields: summary (string), keyFindings (array of strings), redFlags (array of strings), recommendation (one of: approve, review, reject), confidence (number 0-100).`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        maxTokens: 1500,
        temperature: 0.3,
        responseFormat: 'json',
      });

      // Parse JSON response
      let analysis: any;
      try {
        analysis = typeof completion.content === 'string' 
          ? JSON.parse(completion.content) 
          : completion.content;
      } catch (parseError) {
        this.logger.warn(`Failed to parse AI response as JSON: ${parseError}`);
        analysis = {
          summary: completion.content,
          keyFindings: [],
          redFlags: [],
          recommendation: 'review',
          confidence: 50,
        };
      }

      return {
        summary: analysis.summary || 'AI analysis completed',
        keyFindings: analysis.keyFindings || [],
        redFlags: analysis.redFlags || [],
        recommendation: analysis.recommendation || 'review',
        confidence: analysis.confidence || 70,
      };
    } catch (error) {
      this.logger.warn(`AI analysis failed, using rule-based only: ${error}`);

      // Fallback to rule-based summary
      return {
        summary: `Rule-based analysis identified ${ruleBasedFlags.length} potential issues`,
        keyFindings: ruleBasedFlags.map((f) => f.description),
        redFlags: ruleBasedFlags
          .filter((f) => f.severity === 'critical' || f.severity === 'high')
          .map((f) => f.description),
        recommendation:
          ruleBasedFlags.some((f) => f.severity === 'critical') ? 'reject' : 'review',
        confidence: 60,
      };
    }
  }

  /**
   * Build AI prompt for fraud analysis
   */
  private buildAIPrompt(input: FraudDetectionInput, flags: FraudFlag[]): string {
    return `Analyze this residential appraisal for potential fraud indicators:

PROPERTY INFORMATION:
- Address: ${input.propertyAddress}
- Appraised Value: $${input.appraisedValue.toLocaleString()}
- Square Footage: ${input.subjectProperty.squareFootage} sq ft
- Year Built: ${input.subjectProperty.yearBuilt}
- Condition: ${input.subjectProperty.condition}
- Type: ${input.subjectProperty.propertyType}

COMPARABLES (${input.comparables.length} used):
${input.comparables
  .map(
    (c, i) => `
${i + 1}. ${c.address}
   - Sold Price: $${c.soldPrice.toLocaleString()}
   - Sold Date: ${c.soldDate}
   - Distance: ${c.distance.toFixed(1)} miles
   - Size: ${c.squareFootage} sq ft
   - Adjustments: $${c.adjustments.total.toLocaleString()} (${((c.adjustments.total / c.soldPrice) * 100).toFixed(1)}%)
   - Adjusted Value: $${c.adjustedValue.toLocaleString()}
`
  )
  .join('')}

APPRAISER:
- Name: ${input.appraiser.name}
- License: ${input.appraiser.licenseNumber} (${input.appraiser.licenseState})
${input.appraiser.yearsExperience ? `- Experience: ${input.appraiser.yearsExperience} years` : ''}

${
  input.marketData
    ? `MARKET CONTEXT:
- Median Sale Price: $${input.marketData.medianSalePrice.toLocaleString()}
- Price Per Sq Ft: $${input.marketData.pricePerSqft}
- Days on Market: ${input.marketData.daysOnMarket}
- Market Trend: ${input.marketData.marketTrend}
`
    : ''
}

${
  input.orderContext
    ? `LOAN CONTEXT:
- Loan Amount: $${input.orderContext.loanAmount.toLocaleString()}
- Purpose: ${input.orderContext.loanPurpose}
- LTV: ${input.orderContext.loanToValue.toFixed(1)}%
`
    : ''
}

RULE-BASED FLAGS DETECTED (${flags.length}):
${flags.map((f) => `- [${f.severity.toUpperCase()}] ${f.description}`).join('\n')}

Provide a comprehensive fraud risk analysis focusing on:
1. Value inflation patterns
2. Comparable selection and adjustment methodology
3. Data consistency and logic
4. Potential collusion indicators
5. Overall credibility assessment

Be specific with numbers and cite evidence. Assign a confidence score (0-100) to your assessment.`;
  }

  /**
   * Assess valuation reasonableness
   */
  private assessValuation(
    input: FraudDetectionInput
  ): FraudDetectionResult['valuationAssessment'] {
    if (input.comparables.length === 0) {
      return {
        expectedValueRange: { low: 0, high: 0 },
        valueDeviation: 0,
        isInflated: false,
      };
    }

    // Calculate expected value range from comps
    const compValues = input.comparables.map((c) => c.adjustedValue);
    const avgValue = compValues.reduce((sum, v) => sum + v, 0) / compValues.length;
    const stdDev = Math.sqrt(
      compValues.reduce((sum, v) => sum + Math.pow(v - avgValue, 2), 0) / compValues.length
    );

    const expectedLow = avgValue - stdDev;
    const expectedHigh = avgValue + stdDev;

    const deviation = ((input.appraisedValue - avgValue) / avgValue) * 100;
    const isInflated = input.appraisedValue > expectedHigh;

    const result: FraudDetectionResult['valuationAssessment'] = {
      expectedValueRange: {
        low: Math.round(expectedLow),
        high: Math.round(expectedHigh),
      },
      valueDeviation: deviation,
      isInflated,
    };

    if (isInflated) {
      result.inflationAmount = Math.round(input.appraisedValue - expectedHigh);
    }

    return result;
  }

  /**
   * Assess comparables quality
   */
  private assessComparables(
    input: FraudDetectionInput
  ): FraudDetectionResult['comparablesAssessment'] {
    if (input.comparables.length === 0) {
      return {
        qualityScore: 0,
        distanceScore: 0,
        adjustmentScore: 0,
        suspiciousComps: [],
      };
    }

    // Distance score (closer is better)
    const avgDistance =
      input.comparables.reduce((sum, c) => sum + c.distance, 0) / input.comparables.length;
    const distanceScore = Math.max(0, 100 - avgDistance * 10); // Penalty for distance

    // Adjustment score (smaller adjustments are better)
    const avgAdjustmentPercent =
      input.comparables.reduce(
        (sum, c) => sum + Math.abs((c.adjustments.total / c.soldPrice) * 100),
        0
      ) / input.comparables.length;
    const adjustmentScore = Math.max(0, 100 - avgAdjustmentPercent * 2); // Penalty for large adjustments

    // Overall quality score
    const qualityScore = (distanceScore + adjustmentScore) / 2;

    // Identify suspicious comps
    const suspiciousComps = input.comparables
      .filter((c) => {
        const adjustmentPercent = Math.abs((c.adjustments.total / c.soldPrice) * 100);
        return c.distance > 5 || adjustmentPercent > 25;
      })
      .map((c) => c.address);

    return {
      qualityScore: Math.round(qualityScore),
      distanceScore: Math.round(distanceScore),
      adjustmentScore: Math.round(adjustmentScore),
      suspiciousComps,
    };
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(
    flags: FraudFlag[],
    aiAnalysis: FraudDetectionResult['aiAnalysis'],
    valuationAssessment: FraudDetectionResult['valuationAssessment'],
    comparablesAssessment: FraudDetectionResult['comparablesAssessment']
  ): number {
    let riskScore = 0;

    // Rule-based flags contribution (0-40 points)
    const criticalFlags = flags.filter((f) => f.severity === 'critical').length;
    const highFlags = flags.filter((f) => f.severity === 'high').length;
    const mediumFlags = flags.filter((f) => f.severity === 'medium').length;

    riskScore += criticalFlags * 15;
    riskScore += highFlags * 10;
    riskScore += mediumFlags * 5;

    // AI analysis contribution (0-30 points)
    if (aiAnalysis.recommendation === 'reject') {
      riskScore += 30;
    } else if (aiAnalysis.recommendation === 'review') {
      riskScore += 15;
    }

    // Valuation assessment contribution (0-20 points)
    if (valuationAssessment.isInflated) {
      const inflationPercent = Math.abs(valuationAssessment.valueDeviation);
      riskScore += Math.min(20, inflationPercent / 2);
    }

    // Comparables quality contribution (0-10 points)
    const qualityPenalty = (100 - comparablesAssessment.qualityScore) / 10;
    riskScore += qualityPenalty;

    return Math.min(100, Math.round(riskScore));
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' | 'minimal' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }
}
