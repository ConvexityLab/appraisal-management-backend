/**
 * Vendor Order Scorecard — Suggested Scores
 *
 * Computes data-driven score suggestions for the FE scorecard dialog so the
 * QCer starts from a reasonable default rather than 5/5/5/5/5. The reviewer
 * can override any value; nothing here is binding.
 *
 * Heuristics (intentionally simple — refine in a follow-up):
 *
 *   turnTime:
 *     +5 if delivered on or before due date with no revisions
 *     +4 if delivered late by 0-2 days OR on time with 1 revision
 *     +3 if delivered late by 3-7 days OR on time with 2 revisions
 *     +2 if delivered late by 8-14 days
 *     +1 if delivered late by 15+ days
 *
 *   communication:
 *     +5 if vendor responded to every status check within 24h (no signal yet
 *        — we approximate with revisionCount low + no overdue flag)
 *     +4 default
 *     +3 if revisionCount >= 2
 *     +2 if revisionCount >= 4
 *
 *   report / quality:
 *     +5 if zero QC findings of severity CRITICAL or MAJOR
 *     +4 if 1 MAJOR finding
 *     +3 if 2-3 MAJOR findings OR any minor revision-cycle
 *     +2 if 4+ MAJOR findings
 *     +1 if any CRITICAL finding
 *     +0 if rejected
 *
 *   professionalism:
 *     No automatable signal yet — leaves blank (returns undefined for the
 *     key). The reviewer enters it manually.
 *
 * Reviewer always sees and can override. The form passes these as the
 * `suggestedScores` prop; the reviewer either accepts (no edit) or picks a
 * different value.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { Order } from '../types/index.js';

type ScoreValue = 0 | 1 | 2 | 3 | 4 | 5;

export interface SuggestedScores {
  report?: ScoreValue;
  quality?: ScoreValue;
  communication?: ScoreValue;
  turnTime?: ScoreValue;
  professionalism?: ScoreValue;
}

export class VendorOrderScorecardSuggester {
  private logger = new Logger('VendorOrderScorecardSuggester');

  constructor(private dbService: CosmosDbService) {}

  async suggestForOrder(orderId: string): Promise<SuggestedScores> {
    const orderResp = await this.dbService.findOrderById(orderId);
    if (!orderResp.success || !orderResp.data) {
      this.logger.warn('suggestForOrder: order not found', { orderId });
      return {};
    }
    const order = orderResp.data as Order;
    const suggestions: SuggestedScores = {};

    // ── turnTime ──
    const due = (order as any).dueDate ? new Date((order as any).dueDate) : null;
    const delivered = (order as any).deliveredDate ?? (order as any).completedDate;
    const deliveredAt = delivered ? new Date(delivered) : null;
    const revisionCount =
      typeof (order as any).revisionCount === 'number'
        ? ((order as any).revisionCount as number)
        : 0;

    if (due && deliveredAt) {
      const daysLate = (deliveredAt.getTime() - due.getTime()) / (1000 * 60 * 60 * 24);
      if (daysLate <= 0 && revisionCount === 0) suggestions.turnTime = 5;
      else if (daysLate <= 2 || (daysLate <= 0 && revisionCount === 1)) suggestions.turnTime = 4;
      else if (daysLate <= 7 || (daysLate <= 0 && revisionCount === 2)) suggestions.turnTime = 3;
      else if (daysLate <= 14) suggestions.turnTime = 2;
      else suggestions.turnTime = 1;
    }

    // ── communication ──
    if (revisionCount === 0) suggestions.communication = 5;
    else if (revisionCount === 1) suggestions.communication = 4;
    else if (revisionCount <= 3) suggestions.communication = 3;
    else suggestions.communication = 2;

    // ── report + quality ── (from QC findings, if available on the order)
    const qcFindings = ((order as any).qcFindings ?? []) as Array<{
      severity?: string;
    }>;
    const critical = qcFindings.filter((f) => f.severity === 'CRITICAL').length;
    const major = qcFindings.filter((f) => f.severity === 'MAJOR').length;
    let qualityScore: ScoreValue;
    if (critical > 0) qualityScore = 1;
    else if (major >= 4) qualityScore = 2;
    else if (major >= 2) qualityScore = 3;
    else if (major === 1) qualityScore = 4;
    else qualityScore = 5;
    suggestions.quality = qualityScore;
    // Report mirrors quality unless we have an explicit per-finding signal.
    suggestions.report = qualityScore;

    // professionalism: no automated signal — leave undefined.

    return suggestions;
  }
}
