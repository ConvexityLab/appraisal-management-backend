/**
 * Construction Finance Module — AI Servicing Service (Phase 4c, Pillar 3)
 *
 * Provides per-loan servicing intelligence:
 *
 *   computeInterestReserveStatus  — projects reserve depletion; fires INTEREST_RESERVE_DEPLETING
 *   autoComputeMonthlyInterestDraw— returns the estimated monthly interest draw amount (no draw created)
 *   checkMaturityRisk             — fires MATURITY_APPROACHING when P75 forecast > maturity − warningDays
 *   generateConversionReadinessChecklist — GROUND_UP only; full readiness checklist
 *   getItemsBlockingConversion    — returns only the blocking (incomplete) checklist items
 *
 * All flag-related operations use the same applyRiskFlag pattern established in
 * construction-monitor.service.ts — sets or clears the flag in-place on the loan document.
 *
 * This service does NOT create Cosmos infrastructure.
 */

import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import type { ConstructionLoan } from '../../types/construction-loan.types.js';
import type { ConstructionRiskFlag } from '../../types/construction-risk.types.js';
import { ConstructionConfigService } from '../construction-config.service.js';
import { CompletionForecasterService } from './completion-forecaster.service.js';

// ─── Containers ────────────────────────────────────────────────────────────────

const LOANS_CONTAINER = 'construction-loans';

// ─── Return types ─────────────────────────────────────────────────────────────

export interface InterestReserveStatus {
  /** Gross interest reserve funded into the loan. */
  reserveAmount: number;
  /** Cumulative interest reserve drawn to date. */
  reserveDrawn: number;
  /** reserveAmount − reserveDrawn */
  reserveRemaining: number;
  /**
   * Estimated monthly interest charge based on the current drawn balance
   * and the loan's contractual interest rate.
   */
  monthlyInterestEstimate: number;
  /**
   * Estimated months until the reserve is exhausted at the current draw velocity.
   * null when monthly interest is effectively zero.
   */
  monthsUntilDepletion: number | null;
  /**
   * ISO date of projected depletion.
   * null when monthly interest is effectively zero (reserve will not deplete).
   */
  projectedDepletionDate: string | null;
  /**
   * true when projectedDepletionDate falls within interestReserveWarningDays of today.
   */
  isAtRisk: boolean;
  computedAt: string;
}

export interface ConversionReadinessItem {
  itemKey: string;
  description: string;
  isComplete: boolean;
  detail?: string;
}

export interface ConversionReadinessChecklist {
  loanId: string;
  loanType: string;
  /** true when every item in the checklist is complete. */
  isReadyForConversion: boolean;
  /** Count of checklist items where isComplete = false. */
  blockingCount: number;
  items: ConversionReadinessItem[];
  computedAt: string;
}

const logger = new Logger('ConstructionServicingAiService');

// ─── Service ──────────────────────────────────────────────────────────────────

export class ConstructionServicingAiService {
  private readonly configService: ConstructionConfigService;
  private readonly forecasterService: CompletionForecasterService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService    = new ConstructionConfigService(cosmosService);
    this.forecasterService = new CompletionForecasterService(cosmosService);
  }

  // ── computeInterestReserveStatus ──────────────────────────────────────────────

  /**
   * Estimates how long the interest reserve will last and fires (or clears) the
   * INTEREST_RESERVE_DEPLETING risk flag accordingly.
   *
   * Monthly interest is estimated as:
   *   max(totalDrawsDisbursed, loanAmount * 0.1) * interestRate / 12
   *
   * Using the drawn balance as the base is most accurate once construction is
   * underway; the floor of 10% of loanAmount guards against zero-draw early loans
   * where the reserve would otherwise appear infinite.
   *
   * @throws when loan is not found or aiServicingEnabled = false
   */
  async computeInterestReserveStatus(loanId: string, tenantId: string): Promise<InterestReserveStatus> {
    const config = await this.configService.getConfig(tenantId);
    if (!config.aiServicingEnabled) {
      throw new Error(
        `ConstructionServicingAiService: aiServicingEnabled is false for tenant "${tenantId}". ` +
        'Enable it in TenantConstructionConfig before calling computeInterestReserveStatus.'
      );
    }

    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionServicingAiService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    const reserveAmount    = loan.interestReserveAmount;
    const reserveDrawn     = loan.interestReserveDrawn;
    const reserveRemaining = Math.max(0, reserveAmount - reserveDrawn);

    // Estimate monthly interest on the outstanding drawn balance.
    // Floor at 10% of loanAmount to avoid near-zero estimates early in the project.
    const outstandingBalance     = Math.max(loan.totalDrawsDisbursed, loan.loanAmount * 0.10);
    const monthlyInterestEstimate = (outstandingBalance * loan.interestRate) / 12;

    const now = new Date();

    let monthsUntilDepletion: number | null = null;
    let projectedDepletionDate: string | null = null;
    let isAtRisk = false;

    if (monthlyInterestEstimate > 0 && reserveRemaining > 0) {
      monthsUntilDepletion = reserveRemaining / monthlyInterestEstimate;
      const depletionDate   = new Date(now.getTime() + monthsUntilDepletion * 30 * 24 * 60 * 60 * 1000);
      projectedDepletionDate = depletionDate.toISOString().slice(0, 10);

      const daysUntilDepletion = monthsUntilDepletion * 30;
      isAtRisk = daysUntilDepletion <= config.interestReserveWarningDays;
    } else if (reserveRemaining <= 0) {
      // Reserve already exhausted
      monthsUntilDepletion   = 0;
      projectedDepletionDate = now.toISOString().slice(0, 10);
      isAtRisk               = true;
    }

    // Apply / clear the INTEREST_RESERVE_DEPLETING flag
    await this.applyRiskFlag(
      loan,
      'INTEREST_RESERVE_DEPLETING',
      isAtRisk,
      isAtRisk
        ? {
            code:       'INTEREST_RESERVE_DEPLETING',
            severity:   'CRITICAL',
            message:    `Interest reserve projected to deplete by ${projectedDepletionDate ?? 'N/A'}. ` +
                        `Remaining: $${reserveRemaining.toFixed(2)}, ` +
                        `monthly charge: ~$${monthlyInterestEstimate.toFixed(2)}.`,
            detectedAt: now.toISOString(),
          }
        : undefined,
      tenantId
    );

    return {
      reserveAmount,
      reserveDrawn,
      reserveRemaining,
      monthlyInterestEstimate,
      monthsUntilDepletion,
      projectedDepletionDate,
      isAtRisk,
      computedAt: now.toISOString(),
    };
  }

  // ── autoComputeMonthlyInterestDraw ────────────────────────────────────────────

  /**
   * Returns the estimated amount that should be drawn from the interest reserve
   * this month.  Uses the same formula as computeInterestReserveStatus — no draw
   * document is created by this method.
   *
   * @returns monthly interest draw amount in USD (never negative)
   * @throws when loan is not found or aiServicingEnabled = false
   */
  async autoComputeMonthlyInterestDraw(loanId: string, tenantId: string): Promise<number> {
    const config = await this.configService.getConfig(tenantId);
    if (!config.aiServicingEnabled) {
      throw new Error(
        `ConstructionServicingAiService: aiServicingEnabled is false for tenant "${tenantId}".`
      );
    }

    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionServicingAiService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    const outstandingBalance = Math.max(loan.totalDrawsDisbursed, loan.loanAmount * 0.10);
    return (outstandingBalance * loan.interestRate) / 12;
  }

  // ── checkMaturityRisk ─────────────────────────────────────────────────────────

  /**
   * Fires MATURITY_APPROACHING when the AI completion P75 forecast date is within
   * maturityWarningDays days of the loan's maturity date.
   *
   * Delegates forecasting to CompletionForecasterService so the P75 date is
   * consistent across the platform.
   *
   * @returns true when the flag fires (or is already active)
   * @throws when loan is not found or aiServicingEnabled = false
   */
  async checkMaturityRisk(loanId: string, tenantId: string): Promise<boolean> {
    const config = await this.configService.getConfig(tenantId);
    if (!config.aiServicingEnabled) {
      throw new Error(
        `ConstructionServicingAiService: aiServicingEnabled is false for tenant "${tenantId}".`
      );
    }

    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionServicingAiService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    // Completed or closed loans have no maturity risk
    if (loan.status === 'COMPLETED' || loan.status === 'CLOSED') {
      await this.applyRiskFlag(loan, 'MATURITY_APPROACHING', false, undefined, tenantId);
      return false;
    }

    const forecast = await this.forecasterService.forecastCompletion(loanId, tenantId);
    if (!forecast) {
      // Forecasting disabled — cannot assess; preserve current flag state
      logger.warn('checkMaturityRisk: forecasting returned null, skipping maturity risk check', {
        loanId,
        tenantId,
      });
      return false;
    }

    const p75Date      = new Date(forecast.p75);
    const maturityDate = new Date(loan.maturityDate);
    const warningMs    = config.maturityWarningDays * 24 * 60 * 60 * 1000;
    const warnBefore   = new Date(maturityDate.getTime() - warningMs);

    const shouldFlag = p75Date >= warnBefore;

    await this.applyRiskFlag(
      loan,
      'MATURITY_APPROACHING',
      shouldFlag,
      shouldFlag
        ? {
            code:       'MATURITY_APPROACHING',
            severity:   'CRITICAL',
            message:    `AI P75 completion forecast (${forecast.p75}) is within ` +
                        `${config.maturityWarningDays} days of loan maturity (${loan.maturityDate}). ` +
                        `Risk of extension or default if pace does not improve.`,
            detectedAt: new Date().toISOString(),
          }
        : undefined,
      tenantId
    );

    return shouldFlag;
  }

  // ── generateConversionReadinessChecklist ──────────────────────────────────────

  /**
   * Generates a structured conversion readiness checklist for GROUND_UP loans.
   *
   * Conversion = transition from the construction loan to permanent (take-out) financing.
   * The checklist evaluates the loan's current state against eight criteria drawn from
   * standard HUD/FNMA construction-to-perm guidelines.
   *
   * @throws when loan is not found, aiServicingEnabled = false, or loan type is not GROUND_UP
   */
  async generateConversionReadinessChecklist(
    loanId: string,
    tenantId: string
  ): Promise<ConversionReadinessChecklist> {
    const config = await this.configService.getConfig(tenantId);
    if (!config.aiServicingEnabled) {
      throw new Error(
        `ConstructionServicingAiService: aiServicingEnabled is false for tenant "${tenantId}".`
      );
    }

    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      LOANS_CONTAINER,
      loanId,
      tenantId
    );
    if (!loan) {
      throw new Error(
        `ConstructionServicingAiService: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    if (loan.loanType !== 'GROUND_UP') {
      throw new Error(
        `ConstructionServicingAiService: conversion readiness checklist is only applicable to ` +
        `GROUND_UP loans. Loan "${loanId}" has type "${loan.loanType}".`
      );
    }

    const activeFlags = (loan.activeRiskFlags ?? []).filter(f => !f.resolvedAt);
    const criticalFlags = activeFlags.filter(f => f.severity === 'CRITICAL');
    const hasLienWaiverIssue = activeFlags.some(f => f.code === 'LIEN_WAIVER_MISSING');
    const hasTitleHold = activeFlags.some(f => f.code === 'TITLE_HOLD');

    const retainageFullyReleased = loan.retainageHeld <= 0
      || loan.retainageReleased >= loan.retainageHeld * 0.95;

    const items: ConversionReadinessItem[] = [
      {
        itemKey:    'PROJECT_SUBSTANTIALLY_COMPLETE',
        description: 'Project is at least 95% complete per the last inspector-certified report.',
        isComplete: loan.percentComplete >= 95,
        ...(loan.percentComplete < 95 && {
          detail: `Current completion: ${loan.percentComplete}%. Required: 95%.`,
        }),
      },
      {
        itemKey:     'COMPLETION_DECLARED',
        description: 'Actual completion date recorded on the loan.',
        isComplete:  !!loan.actualCompletionDate,
        ...((!loan.actualCompletionDate) && {
          detail: 'actualCompletionDate has not been set. Lender must declare substantial completion.',
        }),
      },
      {
        itemKey:     'NO_CRITICAL_RISK_FLAGS',
        description: 'No unresolved CRITICAL risk flags on the loan.',
        isComplete:  criticalFlags.length === 0,
        ...(criticalFlags.length > 0 && {
          detail: `Active CRITICAL flags: ${criticalFlags.map(f => f.code).join(', ')}.`,
        }),
      },
      {
        itemKey:     'LIEN_WAIVERS_RESOLVED',
        description: 'All lien waivers obtained from contractors and subcontractors.',
        isComplete:  !hasLienWaiverIssue,
        ...(hasLienWaiverIssue && {
          detail: 'One or more disbursed draws still have outstanding lien waivers.',
        }),
      },
      {
        itemKey:     'TITLE_CLEAR',
        description: 'Title is clear — no unresolved title holds or exceptions.',
        isComplete:  !hasTitleHold,
        ...(hasTitleHold && {
          detail: 'TITLE_HOLD flag is active. Resolve title exception before conversion.',
        }),
      },
      {
        itemKey:     'RETAINAGE_RELEASED',
        description: 'At least 95% of withheld retainage has been released to the general contractor.',
        isComplete:  retainageFullyReleased,
        ...((!retainageFullyReleased) && {
          detail:
            `Retainage held: $${loan.retainageHeld.toFixed(2)}, ` +
            `released: $${loan.retainageReleased.toFixed(2)}. ` +
            `Release remaining balance before conversion.`,
        }),
      },
      {
        itemKey:     'INTEREST_RESERVE_ADEQUATE',
        description: 'Interest reserve has remaining balance to cover the conversion period.',
        isComplete:  loan.interestReserveAmount - loan.interestReserveDrawn > 0,
        ...(loan.interestReserveAmount - loan.interestReserveDrawn <= 0 && {
          detail: 'Interest reserve fully exhausted. Confirm conversion timing with borrower.',
        }),
      },
      {
        itemKey:     'LOAN_NOT_IN_DEFAULT',
        description: 'Loan is not in default or workout status.',
        isComplete:  loan.status !== 'IN_DEFAULT' && !loan.cpp,
        ...(loan.status === 'IN_DEFAULT' || loan.cpp
          ? {
              detail: loan.status === 'IN_DEFAULT'
                ? 'Loan is in IN_DEFAULT status.'
                : 'Active CPP workout record exists on the loan.',
            }
          : undefined),
      },
    ];

    const blockingCount = items.filter(i => !i.isComplete).length;

    return {
      loanId,
      loanType: loan.loanType,
      isReadyForConversion: blockingCount === 0,
      blockingCount,
      items,
      computedAt: new Date().toISOString(),
    };
  }

  // ── getItemsBlockingConversion ────────────────────────────────────────────────

  /**
   * Returns only the checklist items that are not yet satisfied.
   * Convenience wrapper around generateConversionReadinessChecklist.
   *
   * @throws the same conditions as generateConversionReadinessChecklist
   */
  async getItemsBlockingConversion(
    loanId: string,
    tenantId: string
  ): Promise<ConversionReadinessItem[]> {
    const checklist = await this.generateConversionReadinessChecklist(loanId, tenantId);
    return checklist.items.filter(i => !i.isComplete);
  }

  // ── applyRiskFlag ─────────────────────────────────────────────────────────────

  private async applyRiskFlag(
    loan: ConstructionLoan,
    code: ConstructionRiskFlag['code'],
    shouldFlag: boolean,
    flagData: ConstructionRiskFlag | undefined,
    tenantId: string
  ): Promise<void> {
    const existingFlags = loan.activeRiskFlags ?? [];
    const activeIndex   = existingFlags.findIndex(f => f.code === code && !f.resolvedAt);

    if (shouldFlag && activeIndex === -1 && flagData) {
      const updatedLoan: ConstructionLoan = {
        ...loan,
        activeRiskFlags: [...existingFlags, flagData],
        updatedAt:       new Date().toISOString(),
      };
      await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, updatedLoan);
    } else if (!shouldFlag && activeIndex !== -1) {
      const resolvedFlags = existingFlags.map((f, i) =>
        i === activeIndex ? { ...f, resolvedAt: new Date().toISOString() } : f
      );
      const updatedLoan: ConstructionLoan = {
        ...loan,
        activeRiskFlags: resolvedFlags,
        updatedAt:       new Date().toISOString(),
      };
      await this.cosmosService.upsertDocument<ConstructionLoan>(LOANS_CONTAINER, updatedLoan);
    }
  }
}
