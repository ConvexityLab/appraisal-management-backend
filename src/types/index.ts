// Core domain types for the Appraisal Management System

// â”€â”€â”€ Property Data Layer (aggregate root) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PropertyRecord: canonical physical asset â€” the root of all work entities
// PropertyComparableSale: persisted market transaction events (our comp database)
// Phase R0 â€” see PROPERTY_DATA_REFACTOR_PLAN.md
export * from './property-record.types.js';
export * from './comparable-sale.types.js';

// â”€â”€â”€ Engagement domain (aggregate root for lender-side work) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export * from './engagement.types.js';

// ─── Product catalog (single source of truth for all product / document types) ───
// Exports: ProductType, DocumentCategory, PRODUCT_CATALOG, lookupProductDefinition,
//          BULK_ANALYSIS_TYPE_TO_PRODUCT_TYPE, ProductDefinition
export * from './product-catalog.js';
import type { ProductType } from './product-catalog.js';

// Import geospatial risk assessment types
export * from './geospatial';
import { PropertyRiskAssessment } from './geospatial';

// â”€â”€â”€ Construction Cost Catalog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export * from './construction-cost-catalog.types.js';

// â”€â”€â”€ Construction Finance Module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export * from './construction-loan.types.js';
export * from './draw-request.types.js';
export * from './change-order.types.js';
export * from './construction-config.types.js';
export * from './construction-risk.types.js';
export * from './feasibility-report.types.js';
export * from './construction-status-report.types.js';
import { OrderStatus } from './order-status.js';
import { FinalReport } from './final-report.types.js';
import type { QueryFilter } from './authorization.types.js';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'PARTIAL';

/**
 * Order — the combined order shape used by most order code paths.
 *
 * Carries fields from both client-initiated intake (propertyAddress,
 * loanInformation, borrowerInformation) and post-extraction state (axiom*
 * fields, propertyId, engagementId, finalReports). The newer
 * `ClientOrder` and `VendorOrder` types in client-order.types.ts /
 * vendor-order.types.ts split this shape by lifecycle ownership; new
 * code should prefer those specific types where the role is clear.
 */
export interface Order {
  id: string;
  clientId: string;
  tenantId: string;
  orderNumber: string;
  /**
   * @deprecated Phase 3 of Order-relocation refactor. These lender-supplied
   * fields are moving to ClientOrder (their proper home). They remain
   * optional here so legacy reads of pre-relocation rows still type-check.
   * New code should join through `clientOrderId` and read from ClientOrder.
   */
  propertyAddress?: PropertyAddress;
  /** @deprecated see propertyAddress note. */
  propertyDetails?: PropertyDetails;
  /** @deprecated see propertyAddress note. */
  orderType?: OrderType;
  productType: ProductType;
  /** @deprecated lender-side; lives on ClientOrder. */
  dueDate?: Date;
  /** @deprecated lender-side; lives on ClientOrder. */
  rushOrder?: boolean;
  /** @deprecated lender-side; lives on ClientOrder. */
  specialInstructions?: string;
  /** @deprecated lender-side; lives on ClientOrder. */
  borrowerInformation?: BorrowerInfo;
  /** @deprecated lender-side; lives on ClientOrder. */
  loanInformation?: LoanInfo;
  /** @deprecated lender-side; lives on ClientOrder. */
  contactInformation?: ContactInfo;
  status: OrderStatus;
  /**
   * Vendor-side urgency. Distinct value space from ClientOrder.priority
   * (which is the engagement-level OrderPriority: ROUTINE/EXPEDITED/...).
   */
  priority?: Priority;
  assignedVendorId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  /** @deprecated lender-side; lives on ClientOrder. */
  tags?: string[];
  /** @deprecated lender-side; lives on ClientOrder. */
  metadata?: Record<string, any>;
  // Payment tracking
  paymentStatus?: PaymentStatus;
  paidAt?: string;
  paymentNotes?: string;
  // Final report history â€” all generation attempts embedded in the order, newest first when sorted by createdAt
  finalReports?: FinalReport[];
  // â”€â”€ Axiom AI evaluation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** Axiom pipelineJobId returned by POST /api/pipelines */
  axiomPipelineJobId?: string;
  /** Axiom evaluation/batch correlation ID */
  axiomEvaluationId?: string;
  /** Axiom risk score 0â€“100 */
  axiomRiskScore?: number;
  /** Axiom overall decision */
  axiomDecision?: 'ACCEPT' | 'CONDITIONAL' | 'REJECT';
  /** Axiom evaluation lifecycle status */
  axiomStatus?: 'submitted' | 'processing' | 'completed' | 'failed';
  /** ISO timestamp when Axiom completed evaluation */
  axiomCompletedAt?: string;
  /** Risk flags raised by Axiom */
  axiomFlags?: string[];
  /** Axiom evaluation program applied to this order */
  axiomProgramId?: string;
  /** Version of the Axiom evaluation program */
  axiomProgramVersion?: string;
  // â”€â”€ Property FK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** FK â†’ PropertyRecord.id â€” the canonical physical property. Added Phase R0.4. */
  propertyId?: string;
  // â”€â”€ Engagement FK fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** FK to the parent Engagement document */
  engagementId?: string;
  /** FK to the specific EngagementLoan within the engagement */
  engagementLoanId?: string;
  /** FK to the specific EngagementClientOrder within the loan */
  engagementClientOrderId?: string;
  // â”€â”€ Report linkage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** FK to the report document in the reporting container, written back on upsert. */
  reportId?: string;
  // â”€â”€ Auto-generation settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /** If true, a final report is auto-generated when QC review reaches APPROVED status. */
  autoGenerateReport?: boolean;
  /**
   * Template ID to use for auto-generation.
   * Required when autoGenerateReport is true; not needed for on-demand generation.
   */
  defaultReportTemplateId?: string;
  // ── Compliance (Phase 1.4 — written by ComplianceService) ─────────────────
  /** Outcome of the most recent compliance evaluation against MOP rules. */
  complianceStatus?: 'PENDING' | 'PASSED' | 'WARNINGS' | 'HARD_STOP';
  /** Detailed violations from the most recent compliance evaluation. */
  complianceViolations?: Array<{ code: string; reason: string; severity: 'WARNING' | 'STOP' }>;
  // ── Authorization (parallel auth refactor) ───────────────────────────────
  /**
   * Access-control envelope stamped by the auth pipeline at write time
   * (VendorOrderService.createVendorOrder + bulk-portfolio worker). Optional
   * here to keep legacy reads valid until every writer stamps it; the
   * authorization middleware enforces presence at the boundaries it gates.
   */
  accessControl?: import('./authorization.types.js').AccessControl;
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
  tenantId: string;
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
  isBusy?: boolean;
  vacationStartDate?: string;
  vacationEndDate?: string;
  onboardingDate: Date;
  lastActive: Date;
  insuranceInfo: InsuranceInfo;
  paymentInfo: PaymentInfo;
  preferences: VendorPreferences;
  paymentHistory?: PaymentRecord[]; // Recent payment history (last 6 months)
  invoiceHistory?: InvoiceRecord[]; // Recent invoices (last 6 months)

  // â”€â”€ Staff / Internal assignment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * 'internal' = staff member who is assigned directly (no bid loop).
   * 'external' = fee-panel vendor who goes through the bid loop.
   * Defaults to 'external' when absent for backward compatibility.
   */
  staffType?: StaffType;
  /**
   * Specific role â€” only set when staffType === 'internal'.
   */
  staffRole?: StaffRole;
  /**
   * Capacity cap for internal staff.  External vendors have their own
   * capacity managed through VendorAvailability.  Default: 5 for internal.
   */
  maxConcurrentOrders?: number;
  /**
   * Live count used by the orchestrator to avoid over-loading a staff member.
   * Updated atomically whenever an order is directly assigned or completed.
   */
  activeOrderCount?: number;

  // â”€â”€ Extended profile (Increment 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Weekly work schedule.  Used by the supervisor roster to show "Available now"
   * and by the matching engine to prefer vendors reachable for urgent orders.
   */
  workSchedule?: WorkScheduleBlock[];
  /**
   * Geographic coverage split into three zones:
   *   licensed  â€” states/counties the vendor is legally allowed to work in
   *   preferred  â€” areas they actively want work (used for score bonus)
   *   extended   â€” areas they will cover with a travel fee
   */
  geographicCoverage?: GeographicCoverageZones;
  /**
   * Structured capability flags used by the matching engine as hard gates
   * (e.g. order requires fha_approved â†’ only eligible vendors are sent bids).
   */
  capabilities?: VendorCapability[];
  /**
   * Explicit list of Product catalog IDs this vendor / staff member can be
   * assigned to.  The matching engine uses this as a hard gate.
   */
  eligibleProductIds?: string[];
  /**
   * Per-product proficiency grades certified by a supervisor.
   */
  productGrades?: ProductGrade[];
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

/**
 * @deprecated The old snake_case ProductType enum has been replaced by the
 * canonical SCREAMING_SNAKE ProductType const in src/types/product-catalog.ts.
 * Import ProductType from there (or from src/types/index.ts which re-exports it).
 * Values have changed: 'full_appraisal' → 'FULL_APPRAISAL', etc.
 * Cosmos data migration will happen in Phase 5.
 */
// ProductType is now exported from product-catalog.ts above (SCREAMING_SNAKE values).

// OrderStatus â€” canonical definition lives in order-status.ts
export { OrderStatus } from './order-status.js';
export type { OrderStatusConfig, OrderStatusCategory } from './order-status.js';
export { STATUS_CONFIG, isValidStatusTransition, normalizeOrderStatus, getStatusLabel, getStatusesByCategory, getActiveStatuses, getFinalStatuses } from './order-status.js';

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

/**
 * Whether this vendor entry represents an internal staff member or an
 * external fee-panel appraiser.  Internal staff bypass the bid loop and
 * are assigned directly by the auto-assignment orchestrator.
 */
export type StaffType = 'internal' | 'external';

/**
 * Role of an internal staff member.
 * Only meaningful when staffType === 'internal'.
 */
export type StaffRole =
  | 'appraiser_internal'
  | 'inspector_internal'
  | 'reviewer'
  | 'supervisor';

/**
 * A single block of availability within a weekly recurring schedule.
 * dayOfWeek follows JS convention: 0 = Sunday â€¦ 6 = Saturday.
 * startTime / endTime are 24-hour 'HH:mm' strings.
 */
export interface WorkScheduleBlock {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;   // 'HH:mm'
  endTime: string;     // 'HH:mm'
  timezone?: string;   // IANA tz string, e.g. 'America/Chicago'
}

/**
 * Three-zone geographic coverage model.
 * Separates legal authorization (licensed) from operational preference
 * (preferred) and occasional extended reach (extended, may add a fee).
 */
export interface GeographicCoverageZones {
  /** States/counties where the vendor holds a valid license. */
  licensed: {
    states: string[];
    counties?: string[];
    zipCodes?: string[];
  };
  /** Areas the vendor actively wants work â€” score bonus in matching engine. */
  preferred?: {
    states: string[];
    counties?: string[];
    zipCodes?: string[];
    radiusMiles?: number;
  };
  /** Areas covered with a travel fee. */
  extended?: {
    states: string[];
    counties?: string[];
    travelFeePerMile?: number;
  };
}

/**
 * Structured capability flags.  Add new values here as the platform grows;
 * the matching engine and UI both key off this union.
 */
export type VendorCapability =
  | 'fha_approved'
  | 'va_panel'
  | 'uad36_compliant'
  | 'drone_certified'
  | 'luxury_over_1m'
  | 'luxury_over_2m'
  | 'manufactured_housing'
  | 'green_building'
  | 'historical_property'
  | 'can_sign_reports'
  | 'commercial_mai'
  | 'complex_assignments'
  | 'amc_certified'
  | 'desktop_qualified'
  | 'hybrid_qualified';

/** Proficiency level for a specific product type, certified by a supervisor. */
export type ProductGradeLevel = 'trainee' | 'proficient' | 'expert' | 'lead';

export interface ProductGrade {
  /** ID from the Product catalog. */
  productId: string;
  grade: ProductGradeLevel;
  /** userId of the supervisor who certified this grade. */
  certifiedBy: string;
  /** ISO 8601 timestamp. */
  certifiedAt: string;
  notes?: string;
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

export interface PaymentRecord {
  id: string;
  orderId: string;
  invoiceId: string;
  amount: number;
  paymentMethod: 'ach' | 'check' | 'wire';
  status: 'completed' | 'pending' | 'failed';
  transactionId?: string;
  processedAt: Date;
  createdAt: Date;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  orderId: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: 'paid' | 'sent' | 'overdue';
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
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
  tenantId?: string;
  clientId?: string;
  authorizationFilter?: QueryFilter;
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
  // Axiom AI evaluation fields (stamped by webhook handler)
  axiomPipelineJobId?: string;
  axiomEvaluationId?: string;
  axiomRiskScore?: number;
  axiomDecision?: 'ACCEPT' | 'CONDITIONAL' | 'REJECT';
  axiomStatus?: 'submitted' | 'processing' | 'completed' | 'failed';
  axiomCompletedAt?: string;
  axiomFlags?: string[];
  axiomProgramId?: string;
  axiomProgramVersion?: string;
}

// â”€â”€â”€ Client (Lender / AMC / Broker) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type ClientType = 'LENDER' | 'AMC' | 'BROKER' | 'CREDIT_UNION' | 'OTHER';

export interface Client {
  id: string;
  quickbooksId?: string; // Links this client to QuickBooks Customer record
  tenantId: string;
  clientName: string;
  clientType: ClientType;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  loanOfficerName?: string;
  lenderName?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  notes?: string;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateClientRequest {
  clientName: string;
  clientType: ClientType;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  loanOfficerName?: string;
  lenderName?: string;
  address?: Client['address'];
  notes?: string;
}

export interface UpdateClientRequest {
  clientName?: string;
  clientType?: ClientType;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  loanOfficerName?: string;
  lenderName?: string;
  address?: Client['address'];
  notes?: string;
  status?: ClientStatus;
}

// â”€â”€â”€ Product / Fee Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface Product {
  id: string;
  tenantId: string;
  /**
   * Slice 8i: client-tier scoping.
   *
   *   null      → PLATFORM-DEFAULT product. Available to every client in the
   *               tenant. Authored by tenant-admins.
   *   <string>  → CLIENT-SPECIFIC product / override. Only visible to (or
   *               overrides the same name on) that one client.
   *
   * Resolution at order placement: clients see the union of platform defaults
   * + their own overrides, with overrides winning by `name` (the human-
   * readable product slug — clients override "Full Appraisal" by writing
   * their own row with the same name).
   *
   * Optional during transition — pre-8i rows without the field are treated
   * as platform defaults (clientId === null).
   */
  clientId?: string | null;
  name: string;
  productType: string;           // maps to ProductType enum in frontend
  description?: string;
  defaultFee: number;
  rushFeeMultiplier: number;     // e.g. 1.5 = 50% surcharge on top
  techFee?: number;              // AMC tech fee split
  feeSplitPercent?: number;      // vendor split %
  turnTimeDays: number;          // standard SLA
  rushTurnTimeDays?: number;
  isActive: boolean;
  status: ProductStatus;
  /** IDs of MatchingCriteriaSet documents to evaluate for vendor selection on orders using this product. */
  matchingCriteriaSets?: string[];
  /** When true the first bid accepted on an RFB is auto-awarded without coordinator review. */
  autoAwardFirstBid?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateProductRequest {
  name: string;
  productType: string;
  description?: string;
  /**
   * Slice 8i: optional client-tier scoping. Omit (or null) for a platform-
   * default product available to every client in the tenant. Set to a
   * specific clientId to author a client-specific product / override.
   */
  clientId?: string | null;
  defaultFee: number;
  rushFeeMultiplier?: number;
  techFee?: number;
  feeSplitPercent?: number;
  turnTimeDays: number;
  rushTurnTimeDays?: number;
  matchingCriteriaSets?: string[];
  autoAwardFirstBid?: boolean;
}

export interface UpdateProductRequest {
  name?: string;
  productType?: string;
  description?: string;
  defaultFee?: number;
  rushFeeMultiplier?: number;
  techFee?: number;
  feeSplitPercent?: number;
  turnTimeDays?: number;
  rushTurnTimeDays?: number;
  status?: ProductStatus;
  matchingCriteriaSets?: string[];
  autoAwardFirstBid?: boolean;
}
export * from './ai-parser.types';



export * from './ai-parser.types';
