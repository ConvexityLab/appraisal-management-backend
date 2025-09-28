/**
 * Quality Control (QC) Core Types
 * 
 * Essential type definitions for QC validation services
 */

import { Coordinates } from './geospatial';
import { 
  DemographicIntelligence, 
  EconomicIntelligence, 
  HousingIntelligence,
  PropertyIntelligence
} from './property-intelligence';

// ===========================
// CORE QC TYPES
// ===========================

export interface QCValidationReport {
  appraisalId: string;
  validatedAt: Date;
  validatedBy: string;
  overallQCScore: number; // 0-100
  validationResults: {
    marketValidation: MarketValidationReport;
    comparableValidation: ComparableValidationReport;
    riskAssessment: RiskAssessmentReport;
  };
  actionItems: QCActionItem[];
  qcDecision: QCDecision;
  processingTime: number;
}

export interface MarketValidationReport {
  validationScore: number; // 0-100
  censusValidation: {
    incomeValidation: IncomeValidationResult;
    demographicValidation: DemographicValidationResult;
    housingValidation: HousingValidationResult;
  };
  riskFlags: MarketRiskFlag[];
  confidenceScore: number;
  dataSourcesUsed: string[];
}

export interface ComparableValidationReport {
  validationScore: number; // 0-100
  comparableAnalyses: ComparableAnalysis[];
  locationConsistency: LocationConsistencyAnalysis;
  adjustmentValidation: AdjustmentValidationResult[];
  riskFlags: ComparableRiskFlag[];
  overallConsistency: number;
}

export interface RiskAssessmentReport {
  overallRiskScore: number; // 0-100 (higher = more risk)
  riskFactors: RiskFactor[];
  fraudIndicators: FraudIndicator[];
  marketAnomalies: MarketAnomaly[];
  recommendedActions: RiskRecommendation[];
  confidenceLevel: ConfidenceLevel;
}

// ===========================
// APPRAISAL DATA TYPES
// ===========================

export interface AppraisalData {
  id: string;
  property: AppraisalProperty;
  comparables: Comparable[];
  valuation: Valuation;
  marketAnalysis: MarketAnalysis;
  adjustments: Adjustment[];
}

export interface AppraisalProperty {
  address: string;
  coordinates: Coordinates;
  propertyType: PropertyType;
  yearBuilt?: number;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
}

export interface Comparable {
  address: string;
  coordinates: Coordinates;
  saleDate: Date;
  salePrice: number;
  squareFootage: number;
  distanceFromSubject: number;
  adjustments: Adjustment[];
  dataSource: string;
}

export interface Adjustment {
  comparableId: string;
  adjustmentType: AdjustmentType;
  amount: number;
  description: string;
  justification: string;
}

export interface Valuation {
  finalValue: number;
  valueRange: { low: number; high: number };
  confidenceLevel: ConfidenceLevel;
  marketConditions: MarketConditions;
}

export interface MarketAnalysis {
  neighborhoodDescription: string;
  pricePerSquareFoot: number;
  daysOnMarket: number;
  demographics: AppraisalDemographics;
  economicFactors: AppraisalEconomicFactors;
}

// ===========================
// VALIDATION RESULT TYPES
// ===========================

export interface IncomeValidationResult {
  appraisalIncomeAssumption: number;
  censusMedianIncome: number;
  variancePercentage: number;
  validationStatus: ValidationStatus;
  riskLevel: RiskLevel;
  explanation: string;
}

export interface DemographicValidationResult {
  appraisalDemographics: AppraisalDemographics;
  censusDemographics: DemographicIntelligence;
  consistencyScore: number;
  validationStatus: ValidationStatus;
  discrepancies: string[];
}

export interface HousingValidationResult {
  appraisalValue: number;
  censusMedianValue: number;
  valueVariancePercentage: number;
  marketConditionConsistency: number;
  validationStatus: ValidationStatus;
}

export interface ComparableAnalysis {
  comparable: Comparable;
  propertyIntelligence: PropertyIntelligence;
  censusData: DemographicIntelligence;
  similarityToSubject: SimilarityScore;
  riskFactors: string[];
}

export interface LocationConsistencyAnalysis {
  averageDistance: number;
  distanceVariance: number;
  consistencyScore: number;
}

export interface AdjustmentValidationResult {
  adjustmentType: AdjustmentType;
  appraisalAmount: number;
  recommendedAmount: number;
  variance: number;
  validationStatus: ValidationStatus;
  riskLevel: RiskLevel;
}

// ===========================
// RISK AND FLAGS
// ===========================

export interface RiskFactor {
  type: RiskFactorType;
  severity: RiskSeverity;
  description: string;
  impactOnValue: number;
  dataSource: string;
  recommendation: string;
}

export interface FraudIndicator {
  type: FraudIndicatorType;
  severity: FraudSeverity;
  description: string;
  confidence: number;
}

export interface MarketAnomaly {
  type: AnomalyType;
  description: string;
  severity: AnomalySeverity;
  detectedValue: number;
  expectedRange: { min: number; max: number };
}

export interface MarketRiskFlag {
  type: string;
  severity: RiskSeverity;
  description: string;
  value: number;
  threshold: number;
}

export interface ComparableRiskFlag {
  type: string;
  severity: RiskSeverity;
  description: string;
  comparableId: string;
}

export interface RiskRecommendation {
  priority: ActionPriority;
  description: string;
  action: string;
  estimatedImpact: number;
}

// ===========================
// SUPPORTING TYPES
// ===========================

export interface AppraisalDemographics {
  medianIncome?: number;
  populationDensity?: number;
  householdSize?: number;
  ownershipRate?: number;
}

export interface AppraisalEconomicFactors {
  employmentRate?: number;
  majorIndustries?: string[];
  economicStability?: string;
}

export interface SimilarityScore {
  overallSimilarity: number; // 0-100
  demographicSimilarity: number;
  economicSimilarity: number;
  geographicSimilarity: number;
}

export interface QCActionItem {
  type: QCActionType;
  priority: ActionPriority;
  description: string;
  dueDate?: Date;
  status: ActionStatus;
}

// ===========================
// ENUMS
// ===========================

export enum ValidationStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  WARNING = 'warning',
  REQUIRES_REVIEW = 'requires_review'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RiskFactorType {
  MARKET_VARIANCE = 'market_variance',
  COMPARABLE_DISTANCE = 'comparable_distance',
  ADJUSTMENT_OUTLIER = 'adjustment_outlier',
  VALUE_ANOMALY = 'value_anomaly',
  DEMOGRAPHIC_MISMATCH = 'demographic_mismatch'
}

export enum FraudIndicatorType {
  VALUE_INFLATION = 'value_inflation',
  COMPARABLE_MANIPULATION = 'comparable_manipulation',
  ADJUSTMENT_MANIPULATION = 'adjustment_manipulation'
}

export enum FraudSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AnomalyType {
  PRICE_OUTLIER = 'price_outlier',
  MARKET_TIME_ANOMALY = 'market_time_anomaly',
  DEMOGRAPHIC_INCONSISTENCY = 'demographic_inconsistency'
}

export enum AnomalySeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  SEVERE = 'severe'
}

export enum PropertyType {
  SINGLE_FAMILY = 'single_family',
  TOWNHOUSE = 'townhouse',
  CONDOMINIUM = 'condominium',
  MULTI_FAMILY = 'multi_family'
}

export enum AdjustmentType {
  LOCATION = 'location',
  SIZE = 'size',
  AGE = 'age',
  CONDITION = 'condition',
  VIEW = 'view',
  TRANSPORTATION = 'transportation',
  AMENITIES = 'amenities'
}

export enum MarketConditions {
  DECLINING = 'declining',
  STABLE = 'stable',
  IMPROVING = 'improving',
  RAPID_GROWTH = 'rapid_growth'
}

export enum ConfidenceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum QCDecision {
  ACCEPT = 'accept',
  ACCEPT_WITH_CONDITIONS = 'accept_with_conditions',
  REQUIRE_REVISION = 'require_revision',
  REJECT = 'reject',
  ESCALATE = 'escalate'
}

export enum QCActionType {
  VERIFY_COMPARABLE = 'verify_comparable',
  VALIDATE_ADJUSTMENT = 'validate_adjustment',
  REVIEW_MARKET_DATA = 'review_market_data',
  INVESTIGATE_ANOMALY = 'investigate_anomaly'
}

export enum ActionPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ActionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}