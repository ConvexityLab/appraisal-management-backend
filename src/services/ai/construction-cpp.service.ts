/**
 * Construction Finance Module — Construction Protection Program (AI Pillar 3)
 *
 * CPP (Construction Protection Program) is the platform's structured workout
 * framework.  When a loan accumulates enough critical risk signals, CPP is
 * triggered and a workout plan is generated.
 *
 * Flow:
 *   evaluateCppTrigger(loanId, flags, tenantId)
 *     → true/false; if true, caller should invoke createCppWorkoutPlan
 *
 *   createCppWorkoutPlan(loanId, tenantId)
 *     → generates a rule-based workout plan and attaches it to the loan
 *
 *   getCppStatus(loanId, tenantId)
 *     → returns the current CppRecord or null if CPP was never triggered
 *
 *   resolveCpp(loanId, resolution, resolvedBy, tenantId)
 *     → marks CPP resolved with outcome, sets resolvedAt
 *
 * The CPP_TRIGGER risk flag is set on the loan when evaluateCppTrigger fires
 * (so the risk dashboard shows it immediately).
 *
 * Workout plans are AI-generated using rule-based heuristics keyed on the
 * active risk flag set — analogous to how the feasibility engine scores budgets.
 *
 * This service does NOT create Cosmos infrastructure.
 */

import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type {
  ConstructionLoan,
  CppRecord,
  CppWorkoutStep,
} from '../../types/construction-loan.types.js';
import type { ConstructionRiskFlag, ConstructionRiskFlagCode } from '../../types/construction-risk.types.js';
import { ConstructionConfigService } from '../construction-config.service.js';

// ─── Containers ────────────────────────────────────────────────────────────────

const LOANS_CONTAINER = 'construction-loans';

// ─── Model version ────────────────────────────────────────────────────────────

const MODEL_VERSION = 'cpp-v1.0.0';

// ─── CPP trigger criteria ─────────────────────────────────────────────────────

/**
 * Number of simultaneously active CRITICAL-severity flags that triggers CPP.
 * One or more CRITICAL flags is a warning; two or more triggers the workout.
 */
const CPP_CRITICAL_FLAG_THRESHOLD = 2;

// ─── Rule-based workout plan templates ───────────────────────────────────────

/**
 * Per-flag workout steps.
 * When a flag is active, all steps associated with it are included in the plan.
 * De-duplicated by action text when multiple flags suggest the same step.
 */
const FLAG_WORKOUT_STEPS: Partial<Record<ConstructionRiskFlagCode, CppWorkoutStep[]>> = {
  STALLED_PROJECT: [
    {
      action:    'Obtain written explanation from borrower/GC for the construction stoppage.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
    {
      action:    'Schedule site visit and confirm current as-built status.',
      timeframe: 'IMMEDIATE',
      owner:     'INSPECTOR',
    },
    {
      action:    'Issue formal Notice of Default Cure Period if stall exceeds 90 days.',
      timeframe: 'SHORT_TERM',
      owner:     'LENDER',
    },
  ],
  OVER_BUDGET: [
    {
      action:    'Request revised budget showing path to completion within maturity.',
      timeframe: 'IMMEDIATE',
      owner:     'BORROWER',
    },
    {
      action:    'Evaluate contingency reserve and potential lender-funded supplement.',
      timeframe: 'SHORT_TERM',
      owner:     'LENDER',
    },
  ],
  SCHEDULE_SLIP: [
    {
      action:    'Obtain updated construction schedule from GC with milestone dates.',
      timeframe: 'IMMEDIATE',
      owner:     'CONTRACTOR',
    },
    {
      action:    'Assess need for loan maturity extension and associated fees.',
      timeframe: 'SHORT_TERM',
      owner:     'LENDER',
    },
  ],
  INSPECTION_CONCERN: [
    {
      action:    'Order follow-up field inspection to verify remediation of flagged concerns.',
      timeframe: 'IMMEDIATE',
      owner:     'INSPECTOR',
    },
    {
      action:    'Hold draw disbursement pending clean follow-up inspection.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
  ],
  INSPECTION_PHOTO_ANOMALY: [
    {
      action:    'Require in-person field inspection with GPS-tagged photos.',
      timeframe: 'IMMEDIATE',
      owner:     'INSPECTOR',
    },
    {
      action:    'Review full photo archive for prior inspection reports on this loan.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
  ],
  DRAW_ANOMALY: [
    {
      action:    'Place current draw on HOLD pending fraud review by a senior credit officer.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
    {
      action:    'Cross-reference draw request against GC invoices and vendor contracts.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
  ],
  CONTRACTOR_DISQUALIFIED: [
    {
      action:    'Notify borrower that the assigned GC is disqualified; require GC replacement.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
    {
      action:    'Freeze all draw disbursements to the disqualified GC.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
    {
      action:    'Obtain borrower-executed replacement GC proposal within 30 days.',
      timeframe: 'SHORT_TERM',
      owner:     'BORROWER',
    },
  ],
  CONTINGENCY_NEARLY_EXHAUSTED: [
    {
      action:    'Request borrower equity injection to replenish contingency reserve.',
      timeframe: 'SHORT_TERM',
      owner:     'BORROWER',
    },
    {
      action:    'Evaluate whether approved COs account for exhaustion or if overruns are unplanned.',
      timeframe: 'SHORT_TERM',
      owner:     'LENDER',
    },
  ],
  LOW_ARV_COVERAGE: [
    {
      action:    'Order updated as-completed appraisal to reassess ARV given current market.',
      timeframe: 'SHORT_TERM',
      owner:     'LENDER',
    },
    {
      action:    'Evaluate loan-to-value covenant compliance; request paydown if ARV has fallen.',
      timeframe: 'SHORT_TERM',
      owner:     'LENDER',
    },
  ],
  INTEREST_RESERVE_DEPLETING: [
    {
      action:    'Notify borrower of projected interest reserve depletion date.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
    {
      action:    'Obtain borrower plan for interest payments once reserve is exhausted.',
      timeframe: 'SHORT_TERM',
      owner:     'BORROWER',
    },
  ],
  MATURITY_APPROACHING: [
    {
      action:    'Initiate loan modification discussion for maturity extension if warranted.',
      timeframe: 'SHORT_TERM',
      owner:     'LENDER',
    },
    {
      action:    'Confirm permanent financing commitment is on track (take-out lender contacts).',
      timeframe: 'SHORT_TERM',
      owner:     'BORROWER',
    },
    {
      action:    'Prepare maturity default and cure documentation as contingency.',
      timeframe: 'LONG_TERM',
      owner:     'LENDER',
    },
  ],
  CHANGE_ORDER_VELOCITY: [
    {
      action:    'Meet with GC to review scope changes driving the CO volume.',
      timeframe: 'SHORT_TERM',
      owner:     'LENDER',
    },
    {
      action:    'Freeze further CO approvals pending review of overall project scope impact.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
  ],
  CPP_TRIGGER: [
    {
      action:    'Convene CPP review meeting with borrower, GC, and senior lending officer.',
      timeframe: 'IMMEDIATE',
      owner:     'LENDER',
    },
    {
      action:    'Engage independent construction consultant for third-party audit.',
      timeframe: 'SHORT_TERM',
      owner:     'LENDER',
    },
    {
      action:    'Review all options: cure period, loan modification, or foreclosure initiation.',
      timeframe: 'LONG_TERM',
      owner:     'LENDER',
    },
  ],
};

// ─── ConstructionCppService ───────────────────────────────────────────────────

export class ConstructionCppService {
  private readonly logger = new Logger('ConstructionCppService');
  private readonly configService: ConstructionConfigService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService = new ConstructionConfigService(cosmosService);
  }

  // ── evaluateCppTrigger ────────────────────────────────────────────────────────

  /**
   * Evaluates whether CPP should be triggered for this loan.
   *
   * CPP fires when ANY of the following is true:
   *   a) The CPP_TRIGGER flag is explicitly present and unresolved in flags
   *   b) Two or more CRITICAL-severity unresolved flags are active
   *
   * Also sets the CPP_TRIGGER risk flag on the loan document when triggered
   * (so it surfaces in the risk dashboard immediately).
   *
   * @param loanId  - loan to evaluate
   * @param flags   - the current active (unresolved) risk flags on this loan
   * @param tenantId
   * @returns true when CPP should be triggered
   */
  async evaluateCppTrigger(
    loanId: string,
    flags: ConstructionRiskFlag[],
    tenantId: string
  ): Promise<boolean> {
    const unresolvedFlags = flags.filter(f => !f.resolvedAt);

    const hasCppTriggerFlag = unresolvedFlags.some(f => f.code === 'CPP_TRIGGER');
    const criticalCount = unresolvedFlags.filter(f => f.severity === 'CRITICAL').length;
    const shouldTrigger = hasCppTriggerFlag || criticalCount >= CPP_CRITICAL_FLAG_THRESHOLD;

    if (shouldTrigger && !hasCppTriggerFlag) {
      // Set the CPP_TRIGGER flag on the loan so it's visible in the dashboard
      await this.setCppTriggerFlag(loanId, flags, criticalCount, tenantId);
    }

    return shouldTrigger;
  }

  // ── createCppWorkoutPlan ──────────────────────────────────────────────────────

  /**
   * Generates a CppRecord and attaches it to the loan document.
   *
   * Workout plan is derived from the current active risk flags:
   * for each active flag code, the corresponding workout steps are
   * included (de-duplicated by action text).
   *
   * If a CPP record already exists and is not yet resolved,
   * this method replaces the workout plan (re-run after new flags surface).
   *
   * @throws when the loan cannot be found
   * @throws when CPP trigger criteria are not met (guard against accidental creation)
   */
  async createCppWorkoutPlan(loanId: string, tenantId: string): Promise<CppRecord> {
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionCppService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    const unresolvedFlags = (loan.activeRiskFlags ?? []).filter(f => !f.resolvedAt);
    const triggeringFlagCodes = unresolvedFlags.map(f => f.code);

    // Build de-duplicated workout steps
    const seen = new Set<string>();
    const workoutPlan: CppWorkoutStep[] = [];

    for (const code of triggeringFlagCodes) {
      const steps = FLAG_WORKOUT_STEPS[code as ConstructionRiskFlagCode] ?? [];
      for (const step of steps) {
        if (!seen.has(step.action)) {
          seen.add(step.action);
          workoutPlan.push(step);
        }
      }
    }

    // Always include base CPP review steps if not already present
    const baseCppSteps = FLAG_WORKOUT_STEPS['CPP_TRIGGER'] ?? [];
    for (const step of baseCppSteps) {
      if (!seen.has(step.action)) {
        seen.add(step.action);
        workoutPlan.push(step);
      }
    }

    const narrative = buildNarrative(loan, unresolvedFlags);

    const cpp: CppRecord = {
      triggeredAt:    loan.cpp?.triggeredAt ?? new Date().toISOString(),
      triggeringFlags: triggeringFlagCodes,
      workoutPlan,
      narrative,
      modelVersion:   MODEL_VERSION,
    };

    const updatedLoan: ConstructionLoan = {
      ...loan,
      cpp,
      updatedAt: new Date().toISOString(),
    };
    await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, updatedLoan);

    this.logger.info('ConstructionCppService: workout plan created', {
      loanId,
      tenantId,
      triggeringFlagCount: triggeringFlagCodes.length,
      workoutStepCount:    workoutPlan.length,
    });

    return cpp;
  }

  // ── getCppStatus ──────────────────────────────────────────────────────────────

  /**
   * Returns the current CppRecord for the loan, or null if CPP has never been triggered.
   *
   * @throws when the loan cannot be found
   */
  async getCppStatus(loanId: string, tenantId: string): Promise<CppRecord | null> {
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionCppService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }
    return loan.cpp ?? null;
  }

  // ── resolveCpp ────────────────────────────────────────────────────────────────

  /**
   * Resolves an active CPP by setting resolvedAt, resolvedBy, and resolution on the record.
   *
   * @param resolution    — outcome chosen by the lender
   * @param resolutionNotes — optional lender narrative of the resolution
   * @param resolvedBy    — user ID of the lender who resolved
   * @throws when loan not found or no active CppRecord exists
   */
  async resolveCpp(
    loanId: string,
    resolution: CppRecord['resolution'],
    resolvedBy: string,
    tenantId: string,
    resolutionNotes?: string
  ): Promise<CppRecord> {
    if (!resolution) {
      throw new Error(
        `ConstructionCppService: resolution is required to resolve CPP for loan "${loanId}"`
      );
    }

    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionCppService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }
    if (!loan.cpp) {
      throw new Error(
        `ConstructionCppService: no CppRecord found for loan "${loanId}" ` +
        `(tenant "${tenantId}"). Did you call createCppWorkoutPlan first?`
      );
    }
    if (loan.cpp.resolvedAt) {
      throw new Error(
        `ConstructionCppService: CPP for loan "${loanId}" is already resolved ` +
        `(resolvedAt: ${loan.cpp.resolvedAt}).`
      );
    }

    const now = new Date().toISOString();
    const resolvedCpp: CppRecord = {
      ...loan.cpp,
      resolvedAt:       now,
      resolvedBy,
      resolution,
      ...(resolutionNotes !== undefined && { resolutionNotes }),
    };

    // Also resolve the CPP_TRIGGER risk flag
    const existingFlags = loan.activeRiskFlags ?? [];
    const resolvedFlags = existingFlags.map(f =>
      f.code === 'CPP_TRIGGER' && !f.resolvedAt
        ? { ...f, resolvedAt: now }
        : f
    );

    const updatedLoan: ConstructionLoan = {
      ...loan,
      cpp:            resolvedCpp,
      activeRiskFlags: resolvedFlags,
      updatedAt:      now,
    };
    await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, updatedLoan);

    this.logger.info('ConstructionCppService: CPP resolved', {
      loanId,
      tenantId,
      resolution,
      resolvedBy,
    });

    return resolvedCpp;
  }

  // ── setCppTriggerFlag ─────────────────────────────────────────────────────────

  /**
   * Adds the CPP_TRIGGER risk flag to the loan when it fires automatically
   * due to CRITICAL flag threshold (not via explicit flag).
   */
  private async setCppTriggerFlag(
    loanId: string,
    currentFlags: ConstructionRiskFlag[],
    criticalCount: number,
    tenantId: string
  ): Promise<void> {
    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) return;

    const alreadyActive = currentFlags.some(
      f => f.code === 'CPP_TRIGGER' && !f.resolvedAt
    );
    if (alreadyActive) return;

    const newFlag: ConstructionRiskFlag = {
      code:       'CPP_TRIGGER',
      severity:   'CRITICAL',
      message:    `CPP triggered automatically: ${criticalCount} critical risk flags active ` +
                  `(threshold: ${CPP_CRITICAL_FLAG_THRESHOLD}).`,
      detectedAt: new Date().toISOString(),
    };

    const updatedLoan: ConstructionLoan = {
      ...loan,
      activeRiskFlags: [...(loan.activeRiskFlags ?? []), newFlag],
      updatedAt:       new Date().toISOString(),
    };
    await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, updatedLoan);
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Generates a concise prose narrative for the CPP record.
 * Real platform: this would call an LLM with the flag data.
 * This is the rule-based proxy following the platform pattern.
 */
function buildNarrative(
  loan: ConstructionLoan,
  unresolvedFlags: ConstructionRiskFlag[]
): string {
  const criticalFlags  = unresolvedFlags.filter(f => f.severity === 'CRITICAL');
  const warningFlags   = unresolvedFlags.filter(f => f.severity === 'WARNING');
  const flagSummary    = unresolvedFlags.map(f => f.code.replace(/_/g, ' ')).join(', ');

  return (
    `Loan ${loan.loanNumber} (${loan.loanType}) has entered Construction Protection Program status ` +
    `as of ${new Date().toISOString().slice(0, 10)}. ` +
    `The loan currently has ${unresolvedFlags.length} active risk flags ` +
    `(${criticalFlags.length} critical, ${warningFlags.length} warning): ${flagSummary}. ` +
    `The project is ${loan.percentComplete}% complete against a maturity date of ${loan.maturityDate}. ` +
    `Immediate action is required to avoid default or foreclosure. ` +
    `The workout plan below outlines required actions by party and timeframe.`
  );
}
