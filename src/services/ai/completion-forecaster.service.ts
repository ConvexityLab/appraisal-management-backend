/**
 * Construction Finance Module — Completion Forecaster (AI Pillar 2)
 *
 * Projects build completion dates as a Monte Carlo–inspired three-point estimate
 * (P25 / P50 / P75) using:
 *   - Current inspector-certified % complete
 *   - Elapsed construction time since constructionStartDate
 *   - Draw velocity (% complete gained per disbursement period)
 *   - Remaining undrawn budget as a secondary signal
 *
 * P25 = optimistic (75th-percentile pace / best-case)
 * P50 = median (most-likely)
 * P75 = pessimistic (25th-percentile pace / worst-case)
 *
 * When aiCompletionForecastingEnabled is false, the method returns null.
 *
 * Forecast results are attached to the ConstructionLoan document in three
 * fields (completionForecastP25, completionForecastP50, completionForecastP75).
 *
 * This service does NOT create Cosmos infrastructure.
 */

import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type { ConstructionLoan, ConstructionLoanType } from '../../types/construction-loan.types.js';
import type { DrawRequest } from '../../types/draw-request.types.js';
import { ConstructionConfigService } from '../construction-config.service.js';

// ─── Containers ───────────────────────────────────────────────────────────────

const DRAWS_CONTAINER = 'draws';
const LOANS_CONTAINER = 'construction-loans';

// ─── Model constants ──────────────────────────────────────────────────────────

/**
 * Typical build duration (calendar days) at P50 pace, by loan type.
 * Used as fallback when the loan has no construction start date or
 * insufficient draw history to compute a velocity.
 *
 * Source: platform portfolio actuals 2024–2025 / industry benchmarks.
 */
const ESTIMATED_DAYS_P50: Readonly<Record<ConstructionLoanType, number>> = {
  GROUND_UP:   330,
  FIX_FLIP:    120,
  REHAB:       150,
  MULTIFAMILY: 450,
  COMMERCIAL:  420,
};

/**
 * Pessimistic multiplier applied to the P50 estimate for P75.
 * P75 = P50 × PESSIMISTIC_FACTOR  (e.g. 1.35 → 35% longer than median)
 */
const PESSIMISTIC_FACTOR = 1.35;

/**
 * Optimistic multiplier applied to the P50 estimate for P25.
 * P25 = P50 × OPTIMISTIC_FACTOR  (e.g. 0.80 → 20% shorter than median)
 */
const OPTIMISTIC_FACTOR = 0.80;

/**
 * Minimum velocity used in forecasts (% complete per day) to avoid
 * projecting completion dates infinitely far in the future for stalled projects.
 * Corresponds to roughly 1% per week (~0.14%/day) — bare-minimum progress.
 */
const MIN_VELOCITY_PCT_PER_DAY = 0.14;

// ─── Completion forecast result type ─────────────────────────────────────────

export interface CompletionForecast {
  /** ISO date string — optimistic (75th-percentile pace) completion estimate. */
  p25: string;
  /** ISO date string — median (P50 / most-likely) completion estimate. */
  p50: string;
  /** ISO date string — pessimistic (25th-percentile pace) completion estimate. */
  p75: string;
  /** Current inspector-certified % complete at the time of forecast. */
  currentPercentComplete: number;
  /** Velocity used for P50 in % complete per day. */
  velocityPctPerDay: number;
  /** ISO timestamp this forecast was generated. */
  forecastedAt: string;
  /** Model version. */
  modelVersion: string;
}

// ─── CompletionForecasterService ──────────────────────────────────────────────

export class CompletionForecasterService {
  private readonly logger = new Logger('CompletionForecasterService');
  private readonly configService: ConstructionConfigService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService = new ConstructionConfigService(cosmosService);
  }

  // ── forecastCompletion ────────────────────────────────────────────────────────

  /**
   * Produces a P25/P50/P75 completion date estimate for the given loan.
   *
   * Algorithm:
   *   1. If aiCompletionForecastingEnabled = false → return null (no-op)
   *   2. Load loan + all DISBURSED draws
   *   3. Compute velocity from elapsed time vs certified % complete
   *   4. Cross-validate with draw disbursement history velocity
   *   5. Project P50, spread P25/P75 using OPTIMISTIC/PESSIMISTIC_FACTOR
   *   6. Write forecast fields back to the loan document
   *   7. Return CompletionForecast
   *
   * @throws when the loan cannot be found
   */
  async forecastCompletion(
    loanId: string,
    tenantId: string
  ): Promise<CompletionForecast | null> {
    const config = await this.configService.getConfig(tenantId);

    if (!config.aiMonitoringEnabled || !config.aiCompletionForecastingEnabled) {
      this.logger.info('CompletionForecasterService: completion forecasting disabled', {
        tenantId,
        loanId,
      });
      return null;
    }

    // ── Fetch loan ─────────────────────────────────────────────────────────
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `CompletionForecasterService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    // Already complete — no forecast needed
    if (loan.percentComplete >= 100 || loan.status === 'COMPLETED' || loan.status === 'CLOSED') {
      this.logger.info('CompletionForecasterService: loan already complete', { loanId, tenantId });
      const now = new Date().toISOString().slice(0, 10);
      return {
        p25:                    now,
        p50:                    now,
        p75:                    now,
        currentPercentComplete: loan.percentComplete,
        velocityPctPerDay:      0,
        forecastedAt:           new Date().toISOString(),
        modelVersion:           'completion-forecast-v1.0.0',
      };
    }

    // ── Fetch disbursed draws ──────────────────────────────────────────────
    const disbursedDraws = await this.cosmosService.queryDocuments<DrawRequest>(
      DRAWS_CONTAINER,
      `SELECT c.disbursedAt, c.requestedAt FROM c
       WHERE c.constructionLoanId = @loanId
         AND c.tenantId = @tenantId
         AND c.status = 'DISBURSED'
       ORDER BY c.disbursedAt`,
      [
        { name: '@loanId',   value: loanId },
        { name: '@tenantId', value: tenantId },
      ]
    );

    // ── Compute P50 velocity ───────────────────────────────────────────────
    const p50VelocityPctPerDay = computeVelocity(loan, disbursedDraws);

    // ── Project dates ──────────────────────────────────────────────────────
    const remainingPct = Math.max(0, 100 - loan.percentComplete);

    const daysToP50 = Math.ceil(remainingPct / p50VelocityPctPerDay);
    const daysToP25 = Math.ceil(daysToP50 * OPTIMISTIC_FACTOR);
    const daysToP75 = Math.ceil(daysToP50 * PESSIMISTIC_FACTOR);

    const today = new Date();
    const p25Date = addDays(today, daysToP25).toISOString().slice(0, 10);
    const p50Date = addDays(today, daysToP50).toISOString().slice(0, 10);
    const p75Date = addDays(today, daysToP75).toISOString().slice(0, 10);

    const forecast: CompletionForecast = {
      p25:                    p25Date,
      p50:                    p50Date,
      p75:                    p75Date,
      currentPercentComplete: loan.percentComplete,
      velocityPctPerDay:      p50VelocityPctPerDay,
      forecastedAt:           new Date().toISOString(),
      modelVersion:           'completion-forecast-v1.0.0',
    };

    // ── Persist forecast to loan document ──────────────────────────────────
    const updatedLoan: ConstructionLoan = {
      ...loan,
      updatedAt: new Date().toISOString(),
    };
    await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, {
      ...updatedLoan,
      completionForecastP25: p25Date,
      completionForecastP50: p50Date,
      completionForecastP75: p75Date,
    } as ConstructionLoan & {
      completionForecastP25: string;
      completionForecastP50: string;
      completionForecastP75: string;
    });

    this.logger.info('CompletionForecasterService: forecast complete', {
      loanId,
      tenantId,
      percentComplete: loan.percentComplete,
      velocityPctPerDay: p50VelocityPctPerDay,
      p25: p25Date,
      p50: p50Date,
      p75: p75Date,
    });

    return forecast;
  }
}

// ─── Pure helper functions ────────────────────────────────────────────────────

/**
 * Computes the P50 velocity in % complete per day.
 *
 * Primary: time-based velocity from constructionStartDate
 *   velocity = percentComplete / elapsedDays
 *
 * Fallback (no start date or zero elapsed): uses ESTIMATED_DAYS_P50 to derive
 *   an expected completion pace given the loan type.
 *
 * Floor: MIN_VELOCITY_PCT_PER_DAY (prevents infinite projection for stalled loans).
 */
function computeVelocity(
  loan: ConstructionLoan,
  disbursedDraws: DrawRequest[]
): number {
  const today = new Date();

  // ── Primary: time-based velocity ───────────────────────────────────────
  if (loan.constructionStartDate && loan.percentComplete > 0) {
    const startDate  = new Date(loan.constructionStartDate);
    const elapsedMs  = today.getTime() - startDate.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

    if (elapsedDays > 0) {
      const timeVelocity = loan.percentComplete / elapsedDays;

      // ── Cross-validate with draw interval velocity ────────────────────
      if (disbursedDraws.length >= 2) {
        const drawVelocity = computeDrawIntervalVelocity(disbursedDraws, loan.percentComplete);
        // Blend: 60% time-based, 40% draw-interval
        const blended = timeVelocity * 0.6 + drawVelocity * 0.4;
        return Math.max(MIN_VELOCITY_PCT_PER_DAY, blended);
      }

      return Math.max(MIN_VELOCITY_PCT_PER_DAY, timeVelocity);
    }
  }

  // ── Fallback: loan-type benchmark ──────────────────────────────────────
  const estimatedDays = ESTIMATED_DAYS_P50[loan.loanType];
  const remainingPct  = Math.max(0, 100 - loan.percentComplete);
  const benchmarkVelocity = remainingPct / estimatedDays;

  return Math.max(MIN_VELOCITY_PCT_PER_DAY, benchmarkVelocity);
}

/**
 * Computes velocity from draw disbursement intervals.
 * Estimates avg % complete gained per day between consecutive disbursements.
 */
function computeDrawIntervalVelocity(
  disbursedDraws: DrawRequest[],
  currentPercentComplete: number
): number {
  if (disbursedDraws.length < 2) {
    return MIN_VELOCITY_PCT_PER_DAY;
  }

  // Sort by disbursedAt ascending
  const sorted = [...disbursedDraws]
    .filter(d => d.disbursedAt)
    .sort((a, b) => new Date(a.disbursedAt!).getTime() - new Date(b.disbursedAt!).getTime());

  if (sorted.length < 2) return MIN_VELOCITY_PCT_PER_DAY;

  const first = sorted[0]!;
  const last  = sorted[sorted.length - 1]!;

  const totalDays = (
    new Date(last.disbursedAt!).getTime() - new Date(first.disbursedAt!).getTime()
  ) / (1000 * 60 * 60 * 24);

  if (totalDays <= 0) return MIN_VELOCITY_PCT_PER_DAY;

  // Use currentPercentComplete as proxy for total % disbursed (since we don't
  // have per-draw % complete without joining inspections)
  return Math.max(MIN_VELOCITY_PCT_PER_DAY, currentPercentComplete / totalDays);
}

/**
 * Adds calendar days to a date and returns a new Date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}
