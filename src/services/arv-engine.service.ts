/**
 * ARV Engine Service — pure functions, no I/O
 *
 * All exports are deterministic and side-effect-free.
 * Safe to unit-test in isolation.
 */

import type {
  ArvEngineInput,
  ArvEngineResult,
  ArvDealAnalysis,
  DealMetricsInput,
  ScopeOfWorkItem,
  ArvComp,
} from '../types/arv.types.js';

// ─── Cost mode ────────────────────────────────────────────────────────────────

/**
 * COST mode ARV: As-Is value plus the net value added by the scope of work.
 *
 * Each SOW item contributes: estimatedCost × (valueAddPercent / 100).
 * e.g. a $20,000 kitchen remodel with valueAddPercent = 120 adds $24,000 to value.
 */
export function calculateArvCost(asIsValue: number, sow: ScopeOfWorkItem[]): number {
  const totalValueAdded = sow.reduce(
    (sum, item) => sum + item.estimatedCost * (item.valueAddPercent / 100),
    0,
  );
  return asIsValue + totalValueAdded;
}

/**
 * Total rehab cost (simple sum — no value-add weighting).
 */
export function calculateTotalRehabCost(sow: ScopeOfWorkItem[]): number {
  return sow.reduce((sum, item) => sum + item.estimatedCost, 0);
}

/**
 * Net value added above the as-is baseline.
 */
export function calculateNetValueAdd(sow: ScopeOfWorkItem[]): number {
  return sow.reduce(
    (sum, item) => sum + item.estimatedCost * (item.valueAddPercent / 100),
    0,
  );
}

// ─── Comps mode ───────────────────────────────────────────────────────────────

/**
 * COMPS mode ARV: weighted average of adjusted comparable sale values.
 *
 * Steps:
 *   1. adjustedValue for each comp = salePrice + Σ(adjustments)
 *   2. Weights are normalised to sum to 1.0
 *   3. ARV = Σ(adjustedValue × normalisedWeight)
 *
 * Returns 0 when the comp array is empty.
 */
export function calculateArvComps(comps: ArvComp[]): number {
  if (!comps.length) return 0;

  const totalWeight = comps.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) {
    // Equal weights when all are 0
    return comps.reduce((s, c) => s + c.adjustedValue, 0) / comps.length;
  }

  return comps.reduce((s, c) => s + c.adjustedValue * (c.weight / totalWeight), 0);
}

// ─── Unified ARV engine ───────────────────────────────────────────────────────

const DIVERGENCE_THRESHOLD = 0.10; // 10%

/**
 * Compute ARV and confidence band for COMPS, COST, or HYBRID mode.
 *
 * Confidence band:
 *   - COMPS: ± one standard deviation of adjusted comp values
 *   - COST:  ± 5% of the COST ARV
 *   - HYBRID: min of [costLow, compsLow] to max of [costHigh, compsHigh]
 */
export function calculateArv(input: ArvEngineInput): ArvEngineResult {
  const { mode, asIsValue, scopeOfWork: sow, comps } = input;

  const totalRehabCost = calculateTotalRehabCost(sow);
  const netValueAdd = calculateNetValueAdd(sow);

  let arvCost: number | undefined;
  let arvComps: number | undefined;
  let arvEstimate: number;
  let confidenceLow: number;
  let confidenceHigh: number;
  let divergencePct = 0;
  let highDivergenceWarning = false;

  if (mode === 'COST' || mode === 'HYBRID') {
    arvCost = calculateArvCost(asIsValue, sow);
  }

  if (mode === 'COMPS' || mode === 'HYBRID') {
    arvComps = calculateArvComps(comps);
  }

  if (mode === 'COST') {
    arvEstimate = arvCost!;
    confidenceLow = arvEstimate * 0.95;
    confidenceHigh = arvEstimate * 1.05;
  } else if (mode === 'COMPS') {
    arvEstimate = arvComps!;
    // Standard deviation of adjusted comp values as confidence interval
    if (comps.length > 1) {
      const mean = arvEstimate;
      const variance =
        comps.reduce((s, c) => s + Math.pow(c.adjustedValue - mean, 2), 0) /
        comps.length;
      const sd = Math.sqrt(variance);
      confidenceLow = Math.max(0, mean - sd);
      confidenceHigh = mean + sd;
    } else {
      confidenceLow = arvEstimate * 0.95;
      confidenceHigh = arvEstimate * 1.05;
    }
  } else {
    // HYBRID
    arvEstimate = (arvCost! + arvComps!) / 2;
    divergencePct =
      arvEstimate > 0 ? Math.abs(arvCost! - arvComps!) / arvEstimate : 0;
    highDivergenceWarning = divergencePct > DIVERGENCE_THRESHOLD;

    // Wide confidence band spanning both approaches
    const costLow = arvCost! * 0.95;
    const costHigh = arvCost! * 1.05;
    let compsLow = arvComps! * 0.95;
    let compsHigh = arvComps! * 1.05;
    if (comps.length > 1) {
      const mean = arvComps!;
      const variance =
        comps.reduce((s, c) => s + Math.pow(c.adjustedValue - mean, 2), 0) /
        comps.length;
      const sd = Math.sqrt(variance);
      compsLow = Math.max(0, mean - sd);
      compsHigh = mean + sd;
    }
    confidenceLow = Math.min(costLow, compsLow);
    confidenceHigh = Math.max(costHigh, compsHigh);
  }

  return {
    arvEstimate: Math.round(arvEstimate),
    confidenceLow: Math.round(confidenceLow),
    confidenceHigh: Math.round(confidenceHigh),
    totalRehabCost: Math.round(totalRehabCost),
    netValueAdd: Math.round(netValueAdd),
    ...(arvCost !== undefined && { arvCost: Math.round(arvCost) }),
    ...(arvComps !== undefined && { arvComps: Math.round(arvComps) }),
    highDivergenceWarning,
    divergencePct: Math.round(divergencePct * 1000) / 10, // e.g. 0.123 → 12.3
  };
}

// ─── Deal metrics ──────────────────────────────────────────────────────────────

const DEFAULT_FLIP_RATIO = 0.70;
const DEFAULT_LTV_PERCENT = 0.70;
const DEFAULT_EXPENSE_RATIO = 0.40; // 40% of gross rent for operating expenses

/**
 * Compute deal-type-specific underwriting metrics from ARV and deal parameters.
 *
 * Formulas:
 *   FIX_FLIP / REHAB:
 *     MAO = ARV × flipRatio − totalRehabCost
 *     maxLoan = ARV × ltvPercent
 *     estimatedProfit = ARV − acquisitionCost − totalRehabCost − closingCosts
 *     cashOnCashReturn = estimatedProfit / totalCashInvested (if supplied)
 *
 *   BRIDGE / HARD_MONEY:
 *     maxLoan = ARV × ltvPercent (HARD_MONEY default LTV = 0.65)
 *
 *   DSCR:
 *     annualNOI = monthlyRent × 12 × (1 − operatingExpenseRatio)
 *     DSCR = annualNOI / annualDebtService
 */
export function calculateDealMetrics(params: DealMetricsInput): ArvDealAnalysis {
  const {
    arv,
    totalRehabCost,
    dealType,
    acquisitionCost = 0,
    closingCosts = 0,
    ltvPercent,
    flipRatio = DEFAULT_FLIP_RATIO,
    monthlyRent,
    operatingExpenseRatio = DEFAULT_EXPENSE_RATIO,
    annualDebtService,
    totalCashInvested,
  } = params;

  const result: ArvDealAnalysis = {};

  if (dealType === 'FIX_FLIP' || dealType === 'REHAB') {
    const usedLtv = ltvPercent ?? DEFAULT_LTV_PERCENT;
    result.flipRatio = flipRatio;
    result.ltvPercent = usedLtv;
    result.maxAllowableOffer = Math.round(arv * flipRatio - totalRehabCost);
    result.maxLoanAmount = Math.round(arv * usedLtv);
    if (acquisitionCost > 0) {
      result.estimatedProfit = Math.round(
        arv - acquisitionCost - totalRehabCost - closingCosts,
      );
      if (totalCashInvested && totalCashInvested > 0) {
        result.cashOnCashReturn =
          Math.round((result.estimatedProfit / totalCashInvested) * 1000) / 10; // %
      }
    }
  }

  if (dealType === 'BRIDGE') {
    const usedLtv = ltvPercent ?? DEFAULT_LTV_PERCENT;
    result.ltvPercent = usedLtv;
    result.maxLoanAmount = Math.round(arv * usedLtv);
  }

  if (dealType === 'HARD_MONEY') {
    const usedLtv = ltvPercent ?? 0.65; // typical hard-money LTV cap
    result.ltvPercent = usedLtv;
    result.maxLoanAmount = Math.round(arv * usedLtv);
    result.maxAllowableOffer = Math.round(arv * usedLtv - totalRehabCost);
  }

  if (dealType === 'DSCR' && monthlyRent !== undefined && monthlyRent > 0) {
    const annualGrossRent = monthlyRent * 12;
    const annualNOI = Math.round(annualGrossRent * (1 - operatingExpenseRatio));
    result.monthlyRent = monthlyRent;
    result.annualGrossRent = annualGrossRent;
    result.operatingExpenseRatio = operatingExpenseRatio;
    result.annualNOI = annualNOI;

    const usedLtv = ltvPercent ?? 0.75; // typical DSCR LTV
    result.ltvPercent = usedLtv;
    result.maxLoanAmount = Math.round(arv * usedLtv);

    if (annualDebtService && annualDebtService > 0) {
      result.annualDebtService = annualDebtService;
      result.dscr = Math.round((annualNOI / annualDebtService) * 100) / 100;
    }
  }

  return result;
}
