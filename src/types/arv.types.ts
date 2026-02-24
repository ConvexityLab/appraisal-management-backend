/**
 * As-Repaired Value (ARV) Calculator Types
 *
 * ARV is the estimated market value of a property after planned improvements.
 * Used for Fix-and-Flip, Rehab loans, DSCR, Bridge, and Hard Money underwriting.
 */

// ─── Enums / Union Types ──────────────────────────────────────────────────────

export type DealType =
  | 'FIX_FLIP'
  | 'DSCR'
  | 'REHAB'
  | 'BRIDGE'
  | 'HARD_MONEY';

export type ArvMode =
  | 'COMPS'   // Weighted average of adjusted comparable sales
  | 'COST'    // As-Is value + net value added by scope of work
  | 'HYBRID'; // Average of COMPS and COST; flags divergence > 10%

export type ArvStatus = 'DRAFT' | 'COMPLETE' | 'REVIEWED';

export type AsIsSource = 'AVM' | 'APPRAISAL' | 'MANUAL';

export type SowCategory =
  | 'ROOF'
  | 'HVAC'
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'FOUNDATION'
  | 'KITCHEN'
  | 'BATHROOMS'
  | 'FLOORING'
  | 'WINDOWS_DOORS'
  | 'EXTERIOR'
  | 'LANDSCAPING'
  | 'GARAGE'
  | 'ADDITION'
  | 'OTHER';

// ─── Scope of Work ────────────────────────────────────────────────────────────

export interface ScopeOfWorkItem {
  id: string;
  category: SowCategory;
  description: string;
  estimatedCost: number;
  /**
   * Percentage of cost that adds to market value.
   * 100 = dollar-for-dollar; >100 = improvement worth more than it costs;
   * <100 = improvement adds less than it costs (over-improvement risk).
   */
  valueAddPercent: number;
}

// ─── Comparable ───────────────────────────────────────────────────────────────

export interface ArvComp {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  closedDate: string;
  salePrice: number;
  gla: number;                          // Gross Living Area (sq ft)
  lotSize?: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt?: number;
  condition?: string;
  /**
   * Adjustment amounts keyed by line item (e.g. { gla: 2500, garage: -3000 }).
   * Positive = subject is superior; negative = subject is inferior.
   */
  adjustments: Record<string, number>;
  /** Computed: salePrice + Σ(adjustments). */
  adjustedValue: number;
  /** Analyst-assigned relative weight 0.0–1.0. Engine normalises to sum = 1. */
  weight: number;
}

// ─── ARV Analysis Document ────────────────────────────────────────────────────

export interface ArvDealAnalysis {
  // Fix & Flip / Rehab
  maxAllowableOffer?: number;     // ARV × flipRatio − totalRehabCost
  flipRatio?: number;             // default 0.70
  maxLoanAmount?: number;         // ARV × ltvPercent
  ltvPercent?: number;
  estimatedProfit?: number;       // ARV − acquisition − rehab − closing costs
  cashOnCashReturn?: number;      // estimatedProfit / total cash invested

  // DSCR
  monthlyRent?: number;
  annualGrossRent?: number;
  operatingExpenseRatio?: number; // default 0.40 (40% of gross rent)
  annualNOI?: number;             // annualGrossRent × (1 − expenseRatio)
  annualDebtService?: number;
  dscr?: number;                  // annualNOI / annualDebtService; ≥ 1.25 = pass
}

export interface ArvAnalysis {
  id: string;
  tenantId: string;
  /** Links to an AppraisalOrder. Null for standalone / pre-order analyses. */
  orderId?: string;
  dealType: DealType;
  mode: ArvMode;
  status: ArvStatus;

  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };

  asIsValue: number;
  asIsSource: AsIsSource;

  scopeOfWork: ScopeOfWorkItem[];
  comps: ArvComp[];

  // Engine outputs — populated by calculateAndPersist()
  arvEstimate: number;
  confidenceLow: number;
  confidenceHigh: number;
  totalRehabCost: number;
  netValueAdd: number;
  /** True when HYBRID mode divergence between COST and COMPS ARV exceeds 10%. */
  highDivergenceWarning?: boolean;
  divergencePct?: number;

  dealAnalysis: ArvDealAnalysis;

  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Request Shapes ───────────────────────────────────────────────────────────

export interface CreateArvRequest {
  dealType: DealType;
  mode: ArvMode;
  orderId?: string;
  propertyAddress: ArvAnalysis['propertyAddress'];
  asIsValue: number;
  asIsSource: AsIsSource;
  notes?: string;
  // Optional initial data
  scopeOfWork?: ScopeOfWorkItem[];
  comps?: ArvComp[];
  dealAnalysis?: Partial<ArvDealAnalysis>;
}

export interface UpdateArvRequest {
  dealType?: DealType;
  mode?: ArvMode;
  propertyAddress?: ArvAnalysis['propertyAddress'];
  asIsValue?: number;
  asIsSource?: AsIsSource;
  scopeOfWork?: ScopeOfWorkItem[];
  comps?: ArvComp[];
  dealAnalysis?: Partial<ArvDealAnalysis>;
  notes?: string;
  status?: ArvStatus;
}

// ─── Engine I/O ───────────────────────────────────────────────────────────────

export interface ArvEngineInput {
  mode: ArvMode;
  asIsValue: number;
  scopeOfWork: ScopeOfWorkItem[];
  comps: ArvComp[];
}

export interface ArvEngineResult {
  arvEstimate: number;
  confidenceLow: number;
  confidenceHigh: number;
  totalRehabCost: number;
  netValueAdd: number;
  /** COST mode ARV (present when mode is COST or HYBRID). */
  arvCost?: number;
  /** COMPS mode ARV (present when mode is COMPS or HYBRID). */
  arvComps?: number;
  highDivergenceWarning: boolean;
  divergencePct: number;
}

export interface DealMetricsInput {
  arv: number;
  totalRehabCost: number;
  dealType: DealType;
  acquisitionCost?: number;
  closingCosts?: number;
  ltvPercent?: number;
  flipRatio?: number;
  monthlyRent?: number;
  operatingExpenseRatio?: number;
  annualDebtService?: number;
  totalCashInvested?: number;
}
