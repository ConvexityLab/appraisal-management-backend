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

export interface AppraisalData {
  id: string;
  property: AppraisalProperty;
  comparables: Comparable[];
  valuation: Valuation;
  marketAnalysis: MarketAnalysis;
  adjustments: Adjustment[];
}

export interface AppraisalProperty {
  id: string;
  address: string;
  coordinates: Coordinates;
  propertyType: PropertyType;
  yearBuilt?: number;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  lotSize?: number;
  zoning?: string;
  description?: string;
  uniqueFeatures?: string[];
}

export interface Comparable {
  id: string;
  address: string;
  coordinates: Coordinates;
  saleDate: Date;
  salePrice: number;
  squareFootage: number;
  bedrooms?: number;
  bathrooms?: number;
  lotSize?: number;
  distanceFromSubject: number; // in miles
  adjustments: Adjustment[];
  dataSource: string;
  verificationStatus: VerificationStatus;
}

export interface Adjustment {
  id: string;
  comparableId: string;
  adjustmentType: AdjustmentType;
  category: AdjustmentCategory;
  amount: number;
  description: string;
  justification: string;
  dataSource?: string;
}

export interface Valuation {
  finalValue: number;
  valueRange: {
    low: number;
    high: number;
  };
  methodology: ValuationMethodology;
  confidenceLevel: ConfidenceLevel;
  marketConditions: MarketConditions;
  reconciliation: string;
}

export interface MarketAnalysis {
  neighborhoodDescription: string;
  marketTrends: MarketTrend[];
  pricePerSquareFoot: number;
  daysOnMarket: number;
  absorption: string;
  demographics: AppraisalDemographics;
  economicFactors: AppraisalEconomicFactors;
}

// ===========================
// QC VALIDATION TYPES
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
    complianceValidation: ComplianceValidationReport;
  };
  actionItems: QCActionItem[];
  recommendedRevisions: RecommendedRevision[];
  qcDecision: QCDecision;
  processingTime: number; // milliseconds
}

export interface MarketValidationReport {
  validationScore: number; // 0-100
  censusValidation: {
    incomeValidation: IncomeValidationResult;
    demographicValidation: DemographicValidationResult;
    housingValidation: HousingValidationResult;
  };
  marketAssumptions: MarketAssumptionValidation[];
  riskFlags: MarketRiskFlag[];
  confidenceMetrics: ValidationConfidenceMetrics;
  dataSourcesUsed: string[];
}

export interface ComparableValidationReport {
  validationScore: number; // 0-100
  comparableAnalyses: ComparableAnalysis[];
  locationConsistency: LocationConsistencyAnalysis;
  adjustmentValidation: AdjustmentValidationResult[];
  geographicValidation: GeographicValidationResult;
  riskFlags: ComparableRiskFlag[];
  overallConsistency: ConsistencyMetrics;
}

export interface RiskAssessmentReport {
  overallRiskScore: number; // 0-100 (higher = more risk)
  riskFactors: RiskFactor[];
  fraudIndicators: FraudIndicator[];
  complianceFlags: ComplianceFlag[];
  marketAnomalies: MarketAnomaly[];
  recommendedActions: RiskRecommendation[];
  confidenceLevel: ConfidenceLevel;
}

export interface ComplianceValidationReport {
  usapCompliance: USPAPComplianceResult;
  firreaCompliance: FIRREAComplianceResult;
  clientOverlays: ClientOverlayResult[];
  formValidation: FormValidationResult;
  certificationValidation: CertificationValidationResult;
  overallCompliance: ComplianceStatus;
}

// ===========================
// DETAILED VALIDATION TYPES
// ===========================

export interface IncomeValidationResult {
  appraisalIncomeAssumption: number;
  censusMedianIncome: number;
  variancePercentage: number;
  validationStatus: ValidationStatus;
  riskLevel: RiskLevel;
  explanation: string;
  dataSource: string;
}

export interface DemographicValidationResult {
  appraisalDemographics: AppraisalDemographics;
  censusDemographics: DemographicIntelligence;
  consistencyScore: number; // 0-100
  significantDiscrepancies: DemographicDiscrepancy[];
  validationStatus: ValidationStatus;
}

export interface HousingValidationResult {
  appraisalHousingAssumptions: AppraisalHousingAssumptions;
  censusHousingData: HousingIntelligence;
  consistencyScore: number; // 0-100
  valueRangeValidation: ValueRangeValidation;
  marketConditionValidation: MarketConditionValidation;
  validationStatus: ValidationStatus;
}

export interface ComparableAnalysis {
  comparable: Comparable;
  propertyIntelligence: PropertyIntelligence;
  censusData: DemographicIntelligence;
  creativeFeatures: CreativePropertyFeatures;
  similarityToSubject: SimilarityScore;
  locationValidation: LocationValidation;
  adjustmentRecommendations: AdjustmentRecommendation[];
  riskFactors: ComparableRiskFactor[];
}

export interface LocationConsistencyAnalysis {
  averageDistance: number;
  distanceVariance: number;
  geographicSpread: GeographicSpread;
  neighborhoodConsistency: NeighborhoodConsistency;
  transportationConsistency: TransportationConsistency;
  consistencyScore: number; // 0-100
}

export interface AdjustmentValidationResult {
  adjustmentId: string;
  adjustmentType: AdjustmentType;
  appraisalAmount: number;
  recommendedAmount: number;
  variance: number;
  validationStatus: ValidationStatus;
  supportingData: AdjustmentSupportingData;
  riskLevel: RiskLevel;
}

// ===========================
// RISK AND FRAUD TYPES
// ===========================

export interface RiskFactor {
  id: string;
  type: RiskFactorType;
  severity: RiskSeverity;
  description: string;
  impactOnValue: number; // percentage impact
  dataSource: string;
  recommendation: string;
  autoDetected: boolean;
}

export interface FraudIndicator {
  id: string;
  type: FraudIndicatorType;
  severity: FraudSeverity;
  description: string;
  confidence: number; // 0-100
  evidencePoints: FraudEvidencePoint[];
  recommendedAction: FraudAction;
}

export interface MarketAnomaly {
  type: AnomalyType;
  description: string;
  severity: AnomalySeverity;
  detectedValue: number;
  expectedRange: { min: number; max: number };
  deviation: number;
  possibleCauses: string[];
}

// ===========================
// SIMILARITY AND VALIDATION METRICS
// ===========================

export interface SimilarityScore {
  overallSimilarity: number; // 0-100
  demographicSimilarity: number;
  economicSimilarity: number;
  geographicSimilarity: number;
  housingCharacteristicsSimilarity: number;
  transportationSimilarity: number;
  lifestyleSimilarity: number;
  detailedBreakdown: SimilarityBreakdown;
}

export interface ValidationConfidenceMetrics {
  dataQualityScore: number; // 0-100
  sampleSize: number;
  dataFreshness: number; // days since last update
  crossValidationScore: number; // multiple source validation
  uncertaintyRange: number; // +/- percentage
}

export interface ConsistencyMetrics {
  locationConsistency: number; // 0-100
  priceConsistency: number;
  timeConsistency: number;
  characteristicsConsistency: number;
  adjustmentConsistency: number;
  overallConsistency: number;
}

// ===========================
// QC WORKFLOW TYPES
// ===========================

export interface QCActionItem {
  id: string;
  type: QCActionType;
  priority: ActionPriority;
  description: string;
  assignedTo?: string;
  dueDate?: Date;
  status: ActionStatus;
  relatedRiskFactors: string[];
  estimatedResolutionTime: number; // minutes
}

export interface RecommendedRevision {
  id: string;
  section: AppraisalSection;
  type: RevisionType;
  priority: RevisionPriority;
  description: string;
  currentValue?: string;
  recommendedValue?: string;
  justification: string;
  supportingData: RevisionSupportingData;
}

export interface QCWorkflowStatus {
  appraisalId: string;
  currentStage: QCStage;
  stageHistory: QCStageHistory[];
  totalProcessingTime: number;
  estimatedCompletion?: Date;
  blockers: QCBlocker[];
  escalations: QCEscalation[];
}

// ===========================
// ENUMS AND CONSTANTS
// ===========================

export enum AppraisalStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  IN_QC = 'in_qc',
  QC_APPROVED = 'qc_approved',
  REVISION_REQUIRED = 'revision_required',
  DELIVERED = 'delivered',
  ARCHIVED = 'archived'
}

export enum QCStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  PASSED = 'passed',
  FAILED = 'failed',
  REQUIRES_REVISION = 'requires_revision',
  ESCALATED = 'escalated'
}

export enum PropertyType {
  SINGLE_FAMILY = 'single_family',
  TOWNHOUSE = 'townhouse',
  CONDOMINIUM = 'condominium',
  COOPERATIVE = 'cooperative',
  MULTI_FAMILY = 'multi_family',
  MANUFACTURED = 'manufactured',
  VACANT_LAND = 'vacant_land',
  COMMERCIAL = 'commercial'
}

export enum AdjustmentType {
  LOCATION = 'location',
  SIZE = 'size',
  AGE = 'age',
  CONDITION = 'condition',
  VIEW = 'view',
  TRANSPORTATION = 'transportation',
  AMENITIES = 'amenities',
  MARKET_CONDITIONS = 'market_conditions',
  FINANCING = 'financing',
  OTHER = 'other'
}

export enum AdjustmentCategory {
  PHYSICAL_CHARACTERISTICS = 'physical_characteristics',
  LOCATION_CHARACTERISTICS = 'location_characteristics',
  ECONOMIC_CHARACTERISTICS = 'economic_characteristics',
  USE_CHARACTERISTICS = 'use_characteristics',
  NON_REALTY_COMPONENTS = 'non_realty_components'
}

export enum ValidationStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  WARNING = 'warning',
  REQUIRES_REVIEW = 'requires_review',
  INSUFFICIENT_DATA = 'insufficient_data'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RiskFactorType {
  MARKET_VARIANCE = 'market_variance',
  COMPARABLE_DISTANCE = 'comparable_distance',
  ADJUSTMENT_OUTLIER = 'adjustment_outlier',
  DATA_INCONSISTENCY = 'data_inconsistency',
  VALUE_ANOMALY = 'value_anomaly',
  DEMOGRAPHIC_MISMATCH = 'demographic_mismatch',
  ECONOMIC_INSTABILITY = 'economic_instability',
  HOUSING_MARKET_RISK = 'housing_market_risk'
}

export enum FraudIndicatorType {
  VALUE_INFLATION = 'value_inflation',
  COMPARABLE_MANIPULATION = 'comparable_manipulation',
  FALSE_PROPERTY_DATA = 'false_property_data',
  ADJUSTMENT_MANIPULATION = 'adjustment_manipulation',
  COLLUSION_INDICATOR = 'collusion_indicator'
}

export enum QCDecision {
  ACCEPT = 'accept',
  ACCEPT_WITH_CONDITIONS = 'accept_with_conditions',
  REQUIRE_REVISION = 'require_revision',
  REJECT = 'reject',
  ESCALATE = 'escalate'
}

export enum QCStage {
  INTAKE = 'intake',
  PRELIMINARY_REVIEW = 'preliminary_review',
  MARKET_VALIDATION = 'market_validation',
  COMPARABLE_VALIDATION = 'comparable_validation',
  RISK_ASSESSMENT = 'risk_assessment',
  COMPLIANCE_CHECK = 'compliance_check',
  FINAL_REVIEW = 'final_review',
  DECISION = 'decision'
}

// ===========================
// SUPPORTING INTERFACES
// ===========================

export interface AppraiserInfo {
  id: string;
  name: string;
  licenseNumber: string;
  licenseState: string;
  licenseExpiration: Date;
  certificationLevel: CertificationLevel;
  specialty: PropertyType[];
  experienceYears: number;
  completedAppraisals: number;
  qualityScore?: number;
}

export interface AppraisalDemographics {
  medianIncome?: number;
  populationDensity?: number;
  ageDistribution?: {
    under25: number;
    age25to44: number;
    age45to64: number;
    over65: number;
  };
  householdSize?: number;
  ownershipRate?: number;
}

export interface AppraisalEconomicFactors {
  employmentRate?: number;
  majorIndustries?: string[];
  economicStability?: string;
  developmentActivity?: string;
}

export interface AppraisalHousingAssumptions {
  typicalPriceRange: { low: number; high: number };
  marketingTime: number; // days
  marketConditions: MarketConditions;
  supplyDemandBalance: SupplyDemandBalance;
}

export enum MarketConditions {
  DECLINING = 'declining',
  STABLE = 'stable',
  IMPROVING = 'improving',
  RAPID_GROWTH = 'rapid_growth'
}

export enum SupplyDemandBalance {
  OVERSUPPLY = 'oversupply',
  BALANCED = 'balanced',
  UNDERSUPPLY = 'undersupply'
}

export enum CertificationLevel {
  LICENSED = 'licensed',
  CERTIFIED_RESIDENTIAL = 'certified_residential',
  CERTIFIED_GENERAL = 'certified_general'
}

export enum ConfidenceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum ValuationMethodology {
  SALES_COMPARISON = 'sales_comparison',
  COST_APPROACH = 'cost_approach',
  INCOME_APPROACH = 'income_approach',
  HYBRID = 'hybrid'
}

export enum VerificationStatus {
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
  PARTIALLY_VERIFIED = 'partially_verified',
  REQUIRES_VERIFICATION = 'requires_verification'
}

// Additional supporting interfaces would continue here...
// (Keeping file manageable - can expand specific sections as needed)