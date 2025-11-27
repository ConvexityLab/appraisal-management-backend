// Core domain types for the Appraisal Management System

// Import geospatial risk assessment types
export * from './geospatial';
import { PropertyRiskAssessment } from './geospatial';

export interface AppraisalOrder {
  id: string;
  clientId: string;
  orderNumber: string;
  propertyAddress: PropertyAddress;
  propertyDetails: PropertyDetails;
  orderType: OrderType;
  productType: ProductType;
  dueDate: Date;
  rushOrder: boolean;
  specialInstructions?: string;
  borrowerInformation: BorrowerInfo;
  loanInformation: LoanInfo;
  contactInformation: ContactInfo;
  status: OrderStatus;
  priority: Priority;
  assignedVendorId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface PropertyAddress {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  apn?: string; // Assessor's Parcel Number
  legalDescription?: string;
  subdivision?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  // Geospatial risk assessment data
  riskAssessment?: PropertyRiskAssessment;
}

export interface PropertyDetails {
  propertyType: PropertyType;
  occupancy: OccupancyType;
  yearBuilt?: number;
  grossLivingArea?: number;
  lotSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  stories?: number;
  garage?: boolean;
  pool?: boolean;
  features: string[];
  condition?: PropertyCondition;
  viewType?: ViewType;
  constructionType?: ConstructionType;
}

export interface BorrowerInfo {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  alternateContact?: ContactInfo;
}

export interface LoanInfo {
  loanAmount: number;
  loanType: LoanType;
  loanPurpose: LoanPurpose;
  contractPrice?: number;
  downPayment?: number;
  ltv?: number; // Loan-to-Value ratio
  dti?: number; // Debt-to-Income ratio
  creditScore?: number;
}

export interface ContactInfo {
  name: string;
  role: ContactRole;
  email?: string;
  phone?: string;
  preferredMethod: ContactMethod;
  availabilityNotes?: string;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseState: string;
  licenseExpiry: Date;
  certifications: Certification[];
  serviceAreas: ServiceArea[];
  productTypes: ProductType[];
  specialties: Specialty[];
  performance: VendorPerformance;
  status: VendorStatus;
  onboardingDate: Date;
  lastActive: Date;
  insuranceInfo: InsuranceInfo;
  paymentInfo: PaymentInfo;
  preferences: VendorPreferences;
}

export interface VendorPerformance {
  totalOrders: number;
  completedOrders: number;
  averageTurnTime: number; // in hours
  revisionRate: number; // percentage
  onTimeDeliveryRate: number; // percentage
  qualityScore: number; // 1-5 scale
  clientSatisfactionScore: number; // 1-5 scale
  cuRiskScore?: number; // Collateral Underwriter risk score
  lastUpdated: Date;
}

export interface ServiceArea {
  state: string;
  counties: string[];
  zipCodes?: string[];
  maxDistance?: number; // miles from vendor location
  travelFee?: number;
}

export interface ValuationResult {
  orderId: string;
  productType: ProductType;
  estimatedValue: number;
  valuationRange: {
    low: number;
    high: number;
  };
  confidence: number; // 0-100
  methodology: ValuationMethodology;
  comparables: Comparable[];
  adjustments: Adjustment[];
  marketConditions: MarketConditions;
  riskFlags: RiskFlag[];
  dataQuality: DataQualityScore;
  generatedAt: Date;
  modelVersion: string;
  analyst?: string;
}

export interface Comparable {
  id: string;
  address: PropertyAddress;
  saleDate: Date;
  salePrice: number;
  propertyDetails: PropertyDetails;
  distance: number; // miles from subject property
  daysOnMarket: number;
  adjustments: Adjustment[];
  weight: number; // importance in final valuation
  source: DataSource;
  verified: boolean;
}

export interface Adjustment {
  type: AdjustmentType;
  description: string;
  amount: number;
  percentage?: number;
  rationale: string;
  confidence: number;
}

export interface QualityControlResult {
  orderId: string;
  productId: string;
  level: QCLevel;
  status: QCStatus;
  flags: QCFlag[];
  recommendations: QCRecommendation[];
  reviewedBy: string;
  reviewedAt: Date;
  timeSpent: number; // minutes
  notes: string;
  score: number; // overall QC score 1-100
}

export interface RiskAssessment {
  orderId: string;
  overallRisk: RiskLevel;
  riskFactors: RiskFactor[];
  fraudIndicators: FraudIndicator[];
  marketRisk: MarketRisk;
  complianceRisk: ComplianceRisk;
  recommendations: string[];
  assessedAt: Date;
  assessedBy: string; // system or analyst
}

// Enums
export enum OrderType {
  PURCHASE = 'purchase',
  REFINANCE = 'refinance',
  EQUITY_LINE = 'equity_line',
  CONSTRUCTION = 'construction',
  OTHER = 'other'
}

export enum ProductType {
  FULL_APPRAISAL = 'full_appraisal',
  DESKTOP_APPRAISAL = 'desktop_appraisal',
  HYBRID_APPRAISAL = 'hybrid_appraisal',
  BPO_EXTERIOR = 'bpo_exterior',
  BPO_INTERIOR = 'bpo_interior',
  EVALUATION = 'evaluation',
  DVR = 'dvr', // Desktop Valuation Review
  AVM = 'avm', // Automated Valuation Model
  FIELD_REVIEW = 'field_review',
  DESK_REVIEW = 'desk_review'
}

export enum OrderStatus {
  NEW = 'new',
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  SCHEDULED = 'scheduled',
  INSPECTED = 'inspected',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  IN_QC = 'in_qc',
  REVISION_REQUESTED = 'revision_requested',
  COMPLETED = 'completed',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold'
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  RUSH = 'rush'
}

export enum PropertyType {
  SFR = 'single_family_residential',
  CONDO = 'condominium',
  TOWNHOME = 'townhome',
  MULTI_FAMILY = 'multi_family',
  MANUFACTURED = 'manufactured',
  VACANT_LAND = 'vacant_land',
  COMMERCIAL = 'commercial',
  MIXED_USE = 'mixed_use'
}

export enum OccupancyType {
  OWNER_OCCUPIED = 'owner_occupied',
  SECOND_HOME = 'second_home',
  INVESTMENT = 'investment',
  VACANT = 'vacant'
}

export enum QCLevel {
  LEVEL_1 = 'level_1', // Technical/UAD checks
  LEVEL_2 = 'level_2', // Compliance/AIR
  LEVEL_3 = 'level_3', // Analytic & risk
  LEVEL_4 = 'level_4'  // Investor system checks
}

export enum QCStatus {
  PASS = 'pass',
  CONDITIONAL_PASS = 'conditional_pass',
  FAIL = 'fail',
  NEEDS_REVIEW = 'needs_review'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum VendorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_APPROVAL = 'pending_approval',
  UNDER_REVIEW = 'under_review'
}

export enum PropertyCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  AVERAGE = 'average',
  FAIR = 'fair',
  POOR = 'poor'
}

export enum ViewType {
  NONE = 'none',
  WATER = 'water',
  MOUNTAIN = 'mountain',
  CITY = 'city',
  GOLF_COURSE = 'golf_course',
  PARK = 'park',
  OTHER = 'other'
}

export enum ConstructionType {
  FRAME = 'frame',
  BRICK = 'brick',
  CONCRETE_BLOCK = 'concrete_block',
  STEEL = 'steel',
  LOG = 'log',
  ADOBE = 'adobe',
  OTHER = 'other'
}

export enum LoanType {
  CONVENTIONAL = 'conventional',
  FHA = 'fha',
  VA = 'va',
  USDA = 'usda',
  JUMBO = 'jumbo',
  PORTFOLIO = 'portfolio',
  PRIVATE = 'private'
}

export enum LoanPurpose {
  PURCHASE = 'purchase',
  REFINANCE = 'refinance',
  CASH_OUT_REFINANCE = 'cash_out_refinance',
  CONSTRUCTION = 'construction',
  EQUITY_LINE = 'equity_line'
}

export enum ContactRole {
  BORROWER = 'borrower',
  AGENT = 'agent',
  LOAN_OFFICER = 'loan_officer',
  PROCESSOR = 'processor',
  UNDERWRITER = 'underwriter',
  APPRAISER = 'appraiser',
  OTHER = 'other'
}

export enum ContactMethod {
  EMAIL = 'email',
  PHONE = 'phone',
  SMS = 'sms',
  PORTAL = 'portal'
}

export enum ValuationMethodology {
  SALES_COMPARISON = 'sales_comparison',
  COST_APPROACH = 'cost_approach',
  INCOME_APPROACH = 'income_approach',
  AVM = 'avm',
  HYBRID = 'hybrid'
}

export enum AdjustmentType {
  TIME = 'time',
  LOCATION = 'location',
  SITE = 'site',
  VIEW = 'view',
  DESIGN = 'design',
  QUALITY = 'quality',
  AGE = 'age',
  CONDITION = 'condition',
  SIZE = 'size',
  ROOM_COUNT = 'room_count',
  GROSS_LIVING_AREA = 'gross_living_area',
  BASEMENT = 'basement',
  FUNCTIONAL_UTILITY = 'functional_utility',
  HEATING_COOLING = 'heating_cooling',
  ENERGY_EFFICIENT = 'energy_efficient',
  GARAGE_CARPORT = 'garage_carport',
  PORCH_PATIO_DECK = 'porch_patio_deck',
  POOL = 'pool',
  FENCE = 'fence',
  OTHER = 'other'
}

export enum DataSource {
  MLS = 'mls',
  PUBLIC_RECORDS = 'public_records',
  ASSESSOR = 'assessor',
  APPRAISER = 'appraiser',
  THIRD_PARTY = 'third_party',
  MANUAL_ENTRY = 'manual_entry'
}

// Additional interface definitions
export interface Certification {
  type: string;
  number: string;
  issuingAuthority: string;
  issueDate: Date;
  expiryDate: Date;
  status: 'active' | 'expired' | 'suspended';
}

export interface Specialty {
  type: string;
  description: string;
  yearsExperience: number;
  certification?: string;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  coverage: number;
  expiryDate: Date;
  status: 'active' | 'expired' | 'pending';
}

export interface PaymentInfo {
  method: 'ach' | 'check' | 'wire';
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  address?: string;
}

export interface VendorPreferences {
  orderTypes: OrderType[];
  productTypes: ProductType[];
  maxOrdersPerDay: number;
  workingHours: {
    start: string;
    end: string;
  };
  workingDays: string[];
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    portal: boolean;
  };
}

export interface MarketConditions {
  averageDaysOnMarket: number;
  priceAppreciation: number; // annual percentage
  salesVolume: number;
  listingInventory: number;
  absorptionRate: number;
  marketTrend: 'increasing' | 'stable' | 'declining';
  lastUpdated: Date;
}

export interface RiskFlag {
  type: RiskFlagType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation?: string;
  autoGenerated: boolean;
}

export enum RiskFlagType {
  NON_ARMS_LENGTH = 'non_arms_length',
  FLIP_INFLATION = 'flip_inflation',
  COMP_GAMING = 'comp_gaming',
  GLA_CONFLICT = 'gla_conflict',
  IMAGE_REUSE = 'image_reuse',
  STR_MISREP = 'str_misrep',
  MARKET_STRESS = 'market_stress',
  BUILDER_RISK = 'builder_risk'
}

export interface DataQualityScore {
  overall: number; // 0-100
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  details: Record<string, number>;
}

export interface QCFlag {
  type: QCFlagType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  description: string;
  location?: string; // page/section reference
  recommendation?: string;
}

export enum QCFlagType {
  MISSING_FIELD = 'missing_field',
  INVALID_VALUE = 'invalid_value',
  INCONSISTENT_DATA = 'inconsistent_data',
  UNSUPPORTED_ADJUSTMENT = 'unsupported_adjustment',
  UAD_VIOLATION = 'uad_violation',
  PHOTO_ISSUE = 'photo_issue',
  SIGNATURE_MISSING = 'signature_missing',
  DATE_ISSUE = 'date_issue',
  MATH_ERROR = 'math_error',
  COMP_ISSUE = 'comp_issue'
}

export interface QCRecommendation {
  type: 'revision' | 'clarification' | 'additional_info' | 'review';
  priority: 'low' | 'medium' | 'high';
  description: string;
  actionRequired: string;
  dueDate?: Date;
}

export interface RiskFactor {
  category: RiskCategory;
  type: string;
  score: number; // 0-100
  impact: 'low' | 'medium' | 'high';
  description: string;
  mitigationSteps?: string[];
}

export enum RiskCategory {
  MARKET_RISK = 'market_risk',
  CREDIT_RISK = 'credit_risk',
  OPERATIONAL_RISK = 'operational_risk',
  COMPLIANCE_RISK = 'compliance_risk',
  FRAUD_RISK = 'fraud_risk'
}

export interface FraudIndicator {
  type: FraudType;
  confidence: number; // 0-100
  description: string;
  evidence: string[];
  recommendation: string;
}

export enum FraudType {
  IDENTITY_FRAUD = 'identity_fraud',
  INCOME_FRAUD = 'income_fraud',
  ASSET_FRAUD = 'asset_fraud',
  OCCUPANCY_FRAUD = 'occupancy_fraud',
  PROPERTY_FRAUD = 'property_fraud',
  STRAW_BUYER = 'straw_buyer',
  FLIP_FRAUD = 'flip_fraud'
}

export interface MarketRisk {
  level: RiskLevel;
  factors: string[];
  trend: 'improving' | 'stable' | 'declining';
  timeHorizon: '3_months' | '6_months' | '12_months';
  impactAssessment: string;
}

export interface ComplianceRisk {
  level: RiskLevel;
  violations: ComplianceViolation[];
  recommendations: string[];
  regulatoryRequirements: string[];
}

export interface ComplianceViolation {
  type: ComplianceType;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  regulation: string;
  remediation: string;
}

export enum ComplianceType {
  USPAP = 'uspap',
  FIRREA = 'firrea',
  DODD_FRANK = 'dodd_frank',
  AIR = 'air',
  STATE_REGULATION = 'state_regulation',
  CLIENT_OVERLAY = 'client_overlay'
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationInfo;
  metadata?: Record<string, any>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Service Configuration Types
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  connectionTimeout: number;
  requestTimeout: number;
}

export interface AzureConfig {
  subscriptionId: string;
  resourceGroupName: string;
  storageAccount: string;
  cosmosDbEndpoint: string;
  keyVaultUrl: string;
  serviceBusConnectionString: string;
  eventHubConnectionString: string;
  applicationInsightsKey: string;
}

export interface PerligoConfig {
  apiEndpoint: string;
  apiKey: string;
  agentConfig: {
    qcAgent: AgentConfig;
    riskAgent: AgentConfig;
    routingAgent: AgentConfig;
    notificationAgent: AgentConfig;
  };
}

export interface AgentConfig {
  name: string;
  version: string;
  enabled: boolean;
  config: Record<string, any>;
}

// Additional service interfaces
export interface OrderFilters {
  clientId?: string;
  status?: OrderStatus[];
  productType?: ProductType[];
  priority?: Priority[];
  assignedVendorId?: string;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface OrderUpdateData {
  status?: OrderStatus;
  priority?: Priority;
  assignedVendorId?: string;
  specialInstructions?: string;
  dueDate?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}