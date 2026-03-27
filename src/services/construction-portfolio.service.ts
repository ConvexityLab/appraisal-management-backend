/**
 * Construction Finance Module — Construction Portfolio Service (Phase 3)
 *
 * Provides cross-loan, portfolio-level analytics for the tenant.
 * All queries are read-only against Cosmos; this service never modifies documents.
 *
 * Discrimination note: All financial metrics are based on loan data only — no demographic
 * or protected-class data is accessed or surfaced.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { ConstructionLoan, ConstructionLoanStatus } from '../types/construction-loan.types.js';
import type { DrawRequest } from '../types/draw-request.types.js';
import { ConstructionConfigService } from './construction-config.service.js';

// ─── Portfolio Dashboard ──────────────────────────────────────────────────────

export interface PortfolioDashboard {
  tenantId: string;
  snapshotAt: string;
  totalActiveLoans: number;
  totalCommitment: number;          // sum of loanAmount for ACTIVE + SUBSTANTIALLY_COMPLETE
  totalDisbursed: number;           // sum of totalDrawsDisbursed
  totalRetainageHeld: number;       // sum of retainageHeld
  avgPercentComplete: number;       // mean percentComplete across active loans
  loansByStatus: Partial<Record<ConstructionLoanStatus, number>>;
  loansByType: Record<string, number>;
  loanCountWithCriticalFlags: number;
}

// ─── Draw Velocity ────────────────────────────────────────────────────────────

export interface DrawVelocityMonth {
  yearMonth: string;         // e.g. "2025-03"
  count: number;             // number of disbursed draws
  totalDisbursed: number;    // USD disbursed in that month
}

// ─── Geography Breakdown ─────────────────────────────────────────────────────

export interface PortfolioGeographyRow {
  state: string;
  count: number;
  totalCommitment: number;   // sum of loanAmount
  totalDisbursed: number;
}

// ─── Maturing Loans ───────────────────────────────────────────────────────────

export interface MaturingLoanSummary {
  loanId: string;
  loanNumber: string;
  borrowerName: string;
  loanAmount: number;
  maturityDate: string;
  daysToMaturity: number;
  percentComplete: number;
  status: ConstructionLoanStatus;
}

// ─── Pending Draws Widget ─────────────────────────────────────────────────────

export interface PendingDrawSummary {
  loanId: string;
  loanNumber: string;
  borrowerName: string;
  pendingDrawCount: number;
  pendingDrawTotal: number;
}

// ─── ConstructionPortfolioService ────────────────────────────────────────────

export class ConstructionPortfolioService {
  private readonly logger = new Logger('ConstructionPortfolioService');
  private readonly configService: ConstructionConfigService;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.configService = new ConstructionConfigService(cosmosService);
  }

  // ── Portfolio Dashboard ───────────────────────────────────────────────────

  /**
   * Returns high-level portfolio KPIs across all non-terminal loans for the tenant.
   */
  async getPortfolioDashboard(tenantId: string): Promise<PortfolioDashboard> {
    const loans = await this.queryLoans(tenantId, [
      'ACTIVE',
      'SUBSTANTIALLY_COMPLETE',
      'APPROVED',
    ]);

    const activeStatuses = new Set<ConstructionLoanStatus>(['ACTIVE', 'SUBSTANTIALLY_COMPLETE']);

    let totalCommitment = 0;
    let totalDisbursed = 0;
    let totalRetainageHeld = 0;
    let percentCompleteSum = 0;
    let activeCount = 0;
    let loanCountWithCriticalFlags = 0;

    const loansByStatus: Partial<Record<ConstructionLoanStatus, number>> = {};
    const loansByType: Record<string, number> = {};

    for (const loan of loans) {
      if (activeStatuses.has(loan.status)) {
        totalCommitment += loan.loanAmount;
        totalDisbursed += loan.totalDrawsDisbursed;
        totalRetainageHeld += loan.retainageHeld;
        percentCompleteSum += loan.percentComplete;
        activeCount++;
      }

      loansByStatus[loan.status] = (loansByStatus[loan.status] ?? 0) + 1;
      loansByType[loan.loanType] = (loansByType[loan.loanType] ?? 0) + 1;

      const hasCritical = (loan.activeRiskFlags ?? []).some(
        f => f.severity === 'CRITICAL' && !f.resolvedAt
      );
      if (hasCritical) loanCountWithCriticalFlags++;
    }

    return {
      tenantId,
      snapshotAt: new Date().toISOString(),
      totalActiveLoans: activeCount,
      totalCommitment,
      totalDisbursed,
      totalRetainageHeld,
      avgPercentComplete: activeCount > 0 ? round2(percentCompleteSum / activeCount) : 0,
      loansByStatus,
      loansByType,
      loanCountWithCriticalFlags,
    };
  }

  // ── Draw Velocity ─────────────────────────────────────────────────────────

  /**
   * Returns monthly disbursement totals for the tenant portfolio over the past
   * `windowMonths` calendar months (default: 12).
   *
   * Queries the `draws` container directly — must supply partitioned query
   * using the tenant's loans as the partition scope.
   */
  async getDrawVelocity(
    tenantId: string,
    windowMonths: number = 12
  ): Promise<DrawVelocityMonth[]> {
    if (windowMonths < 1 || windowMonths > 60) {
      throw new Error(
        `ConstructionPortfolioService.getDrawVelocity: windowMonths must be 1–60, got ${windowMonths}`
      );
    }

    // Get all active loan IDs to bound the draw query
    const loans = await this.queryLoans(tenantId, ['ACTIVE', 'SUBSTANTIALLY_COMPLETE', 'COMPLETED', 'APPROVED']);
    const loanIds = loans.map(l => l.id);

    if (loanIds.length === 0) {
      return [];
    }

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - windowMonths);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    // Collect disbursed draws for each loan (fan-out: one query per loanId due to partition key)
    // For manageability, batch in groups of 10
    const BATCH = 10;
    const allDraws: DrawRequest[] = [];

    for (let i = 0; i < loanIds.length; i += BATCH) {
      const batch = loanIds.slice(i, i + BATCH);
      const drawBatches = await Promise.all(
        batch.map(loanId =>
          this.cosmosService.queryDocuments<DrawRequest>(
            'draws',
            `SELECT c.id, c.disbursedAt, c.requestedAmount, c.netDisbursementAmount, c.constructionLoanId
             FROM c
             WHERE c.constructionLoanId = @loanId
               AND c.tenantId = @tenantId
               AND c.status = 'DISBURSED'
               AND c.disbursedAt >= @cutoff
               AND IS_DEFINED(c.drawNumber)`,
            [
              { name: '@loanId', value: loanId },
              { name: '@tenantId', value: tenantId },
              { name: '@cutoff', value: cutoffIso },
            ]
          )
        )
      );
      for (const batch of drawBatches) {
        allDraws.push(...batch);
      }
    }

    // Aggregate by YYYY-MM
    const monthMap = new Map<string, { count: number; total: number }>();

    for (const draw of allDraws) {
      if (!draw.disbursedAt) continue;
      const ym = draw.disbursedAt.slice(0, 7); // "YYYY-MM"
      const entry = monthMap.get(ym) ?? { count: 0, total: 0 };
      entry.count++;
      entry.total += draw.netDisbursementAmount ?? draw.requestedAmount;
      monthMap.set(ym, entry);
    }

    // Return sorted chronologically, filling in zero-months is intentionally omitted
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([yearMonth, { count, total }]) => ({
        yearMonth,
        count,
        totalDisbursed: round2(total),
      }));
  }

  // ── Portfolio by Geography ────────────────────────────────────────────────

  /**
   * Breaks down the active portfolio commitment and disbursement by state.
   */
  async getPortfolioByGeography(tenantId: string): Promise<PortfolioGeographyRow[]> {
    const loans = await this.queryLoans(tenantId, ['ACTIVE', 'SUBSTANTIALLY_COMPLETE']);

    const stateMap = new Map<string, { count: number; commitment: number; disbursed: number }>();

    for (const loan of loans) {
      const state = loan.propertyAddress.state.toUpperCase();
      const entry = stateMap.get(state) ?? { count: 0, commitment: 0, disbursed: 0 };
      entry.count++;
      entry.commitment += loan.loanAmount;
      entry.disbursed += loan.totalDrawsDisbursed;
      stateMap.set(state, entry);
    }

    return Array.from(stateMap.entries())
      .sort(([, a], [, b]) => b.commitment - a.commitment)
      .map(([state, { count, commitment, disbursed }]) => ({
        state,
        count,
        totalCommitment: round2(commitment),
        totalDisbursed: round2(disbursed),
      }));
  }

  // ── Loans Nearing Maturity ────────────────────────────────────────────────

  /**
   * Returns active loans whose maturity date is within `config.maturityWarningDays`.
   * Results are sorted soonest-maturity first.
   */
  async getLoansNearingMaturity(tenantId: string): Promise<MaturingLoanSummary[]> {
    const config = await this.configService.getConfig(tenantId);
    const loans = await this.queryLoans(tenantId, ['ACTIVE', 'SUBSTANTIALLY_COMPLETE']);

    const today = new Date().toISOString().slice(0, 10);
    const results: MaturingLoanSummary[] = [];

    for (const loan of loans) {
      const daysToMaturity = daysBetween(today, loan.maturityDate.slice(0, 10));
      if (daysToMaturity > config.maturityWarningDays) continue;

      results.push({
        loanId: loan.id,
        loanNumber: loan.loanNumber,
        borrowerName: loan.borrowerName,
        loanAmount: loan.loanAmount,
        maturityDate: loan.maturityDate.slice(0, 10),
        daysToMaturity,
        percentComplete: loan.percentComplete,
        status: loan.status,
      });
    }

    return results.sort((a, b) => a.daysToMaturity - b.daysToMaturity);
  }

  // ── Loans with Pending Draws ──────────────────────────────────────────────

  /**
   * Returns active loans that have at least one draw in SUBMITTED or UNDER_REVIEW status.
   * Useful for a lender dashboard "Action Required" widget.
   */
  async getLoansWithPendingDraws(tenantId: string): Promise<PendingDrawSummary[]> {
    const loans = await this.queryLoans(tenantId, ['ACTIVE', 'SUBSTANTIALLY_COMPLETE']);

    if (loans.length === 0) return [];

    const BATCH = 10;
    const results: PendingDrawSummary[] = [];

    for (let i = 0; i < loans.length; i += BATCH) {
      const batchLoans = loans.slice(i, i + BATCH);
      const batches = await Promise.all(
        batchLoans.map(async loan => {
          const pending = await this.cosmosService.queryDocuments<DrawRequest>(
            'draws',
            `SELECT c.id, c.requestedAmount
             FROM c
             WHERE c.constructionLoanId = @loanId
               AND c.tenantId = @tenantId
               AND c.status IN (@s0, @s1)
               AND IS_DEFINED(c.drawNumber)`,
            [
              { name: '@loanId', value: loan.id },
              { name: '@tenantId', value: tenantId },
              { name: '@s0', value: 'SUBMITTED' },
              { name: '@s1', value: 'UNDER_REVIEW' },
            ]
          );
          return { loan, pending };
        })
      );

      for (const { loan, pending } of batches) {
        if (pending.length === 0) continue;
        const total = pending.reduce((sum, d) => sum + d.requestedAmount, 0);
        results.push({
          loanId: loan.id,
          loanNumber: loan.loanNumber,
          borrowerName: loan.borrowerName,
          pendingDrawCount: pending.length,
          pendingDrawTotal: round2(total),
        });
      }
    }

    return results.sort((a, b) => b.pendingDrawTotal - a.pendingDrawTotal);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async queryLoans(
    tenantId: string,
    statuses: ConstructionLoanStatus[]
  ): Promise<ConstructionLoan[]> {
    if (statuses.length === 0) return [];

    const statusParams = statuses.map((s, i) => ({ name: `@s${i}`, value: s }));
    const statusList = statusParams.map(p => p.name).join(', ');

    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
        AND c.status IN (${statusList})
        AND IS_DEFINED(c.loanAmount)
        AND IS_DEFINED(c.maturityDate)
        AND NOT IS_DEFINED(c.lineItems)
        AND NOT IS_DEFINED(c.changeOrderNumber)
        AND NOT IS_DEFINED(c.drawNumber)
    `;

    return this.cosmosService.queryDocuments<ConstructionLoan>('construction-loans', query, [
      { name: '@tenantId', value: tenantId },
      ...statusParams,
    ]);
  }
}

// ─── Pure date utilities ──────────────────────────────────────────────────────

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
