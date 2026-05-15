/**
 * Vendor Order Scorecard Service
 *
 * Appends and lists reviewer scorecards on a VendorOrder. Scorecards are stored
 * as an append-only array embedded on the order doc (Order.scorecards). The
 * latest non-superseded entry is the active rating; re-scoring creates a new
 * entry that marks the prior one as superseded.
 *
 * Rubric: l1-valuation-platform-ui/docs/screens/Appraiser_Scorecard_Definitions.htm
 * Meeting notes (David/Doug): l1-valuation-platform-ui/docs/screens/Appraiser_Scorecard_Definitions_files/VendorAssignemtnMeetignNotes.md
 *
 * Comment policy:
 *   score 0-1 → detailed notes required (min 40 chars)
 *   score 2-4 → justification required (min 15 chars)
 *   score 5  → optional
 *
 * Flow: per Doug's meeting note, the QCer who approves the final product is the
 * one who fills the scorecard — it gates the "release to client" step.
 *
 * Aggregation: VendorPerformanceCalculatorService reads scorecards across a
 * vendor's orders (trailing 25 per Doug's preference) to blend the human signal
 * into VendorPerformanceMetrics. The blended overallScore is what
 * VendorMatchingEngine consumes — no direct dep from the matcher to this service.
 */

import { v4 as uuidv4 } from 'uuid';
import { CosmosDbService } from './cosmos-db.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import { Logger } from '../utils/logger.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { EventCategory, EventPriority } from '../types/events.js';
import { OrderStatus } from '../types/order-status.js';
import type {
  ScorecardCategoryKey,
  ScorecardCategoryScores,
  ScorecardValue,
  VendorOrderScorecardEntry,
  AppendVendorOrderScorecardRequest,
} from '../types/vendor-order.types.js';
import type { Order } from '../types/index.js';

// ─── Comment policy ──────────────────────────────────────────────────────────

const DETAILED_NOTES_MIN_CHARS = 40;
const JUSTIFICATION_MIN_CHARS = 15;

const SCORECARD_CATEGORY_KEYS: ScorecardCategoryKey[] = [
  'report',
  'quality',
  'communication',
  'turnTime',
  'professionalism',
];

const CATEGORY_LABEL: Record<ScorecardCategoryKey, string> = {
  report: 'Report',
  quality: 'Quality',
  communication: 'Communication',
  turnTime: 'Turn Time',
  professionalism: 'Professionalism',
};

const TERMINAL_STATUSES_FOR_SCORING: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.COMPLETED,
  OrderStatus.DELIVERED,
]);

function isValidScoreValue(v: unknown): v is ScorecardValue {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 5;
}

function commentRequirementError(
  categoryKey: ScorecardCategoryKey,
  score: ScorecardValue,
  comment: string | undefined,
): string | null {
  const trimmed = (comment ?? '').trim();
  if (score === 5) return null;
  if (score >= 2 && score <= 4) {
    if (trimmed.length < JUSTIFICATION_MIN_CHARS) {
      return `${CATEGORY_LABEL[categoryKey]}: a justification is required for a score of ${score} (min ${JUSTIFICATION_MIN_CHARS} chars).`;
    }
    return null;
  }
  // score 0 or 1
  if (trimmed.length < DETAILED_NOTES_MIN_CHARS) {
    return `${CATEGORY_LABEL[categoryKey]}: detailed notes are required for a score of ${score} (min ${DETAILED_NOTES_MIN_CHARS} chars).`;
  }
  return null;
}

function validateScores(scores: ScorecardCategoryScores): string[] {
  const errors: string[] = [];
  for (const key of SCORECARD_CATEGORY_KEYS) {
    const entry = (scores as Record<string, unknown>)[key];
    if (!entry || typeof entry !== 'object') {
      errors.push(`${CATEGORY_LABEL[key]}: missing score entry.`);
      continue;
    }
    const e = entry as { value?: unknown; comment?: unknown };
    if (!isValidScoreValue(e.value)) {
      errors.push(
        `${CATEGORY_LABEL[key]}: score must be an integer 0-5 (received ${JSON.stringify(e.value)}).`,
      );
      continue;
    }
    const commentValue =
      typeof e.comment === 'string' ? e.comment : e.comment == null ? undefined : String(e.comment);
    const policyErr = commentRequirementError(key, e.value, commentValue);
    if (policyErr) errors.push(policyErr);
  }
  return errors;
}

function computeOverall(scores: ScorecardCategoryScores): number {
  const sum = SCORECARD_CATEGORY_KEYS.reduce((acc, k) => acc + scores[k].value, 0);
  return Math.round((sum / SCORECARD_CATEGORY_KEYS.length) * 100) / 100;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class VendorOrderScorecardService {
  private publisher = new ServiceBusEventPublisher();
  private logger = new Logger('VendorOrderScorecardService');

  constructor(
    private dbService: CosmosDbService,
    private auditService: AuditTrailService,
  ) {}

  /**
   * Append a scorecard to a vendor order. Returns the new entry.
   * Throws ScorecardError on validation failure or wrong order state.
   */
  async appendScorecard(
    orderId: string,
    payload: AppendVendorOrderScorecardRequest,
    reviewedBy: string,
    options: { allowPreDelivery?: boolean } = {},
  ): Promise<VendorOrderScorecardEntry> {
    const orderResp = await this.dbService.findOrderById(orderId);
    if (!orderResp.success || !orderResp.data) {
      throw new ScorecardError(404, `Order not found: ${orderId}`);
    }
    const order = orderResp.data as Order;

    // Terminal-state gate. Scoring before delivery is not meaningful per the
    // rubric, which presupposes the assignment is complete enough to judge.
    // The QC-approval flow uses allowPreDelivery=true because the scorecard
    // is the gate BEFORE the final DELIVERED transition.
    if (!options.allowPreDelivery && !TERMINAL_STATUSES_FOR_SCORING.has(order.status)) {
      throw new ScorecardError(
        409,
        `Order ${orderId} is in status ${order.status}; scoring is only allowed once the order is COMPLETED or DELIVERED.`,
      );
    }

    if (!payload || typeof payload !== 'object' || !payload.scores) {
      throw new ScorecardError(400, 'Request body must include a `scores` object with all five categories.');
    }

    const errors = validateScores(payload.scores);
    if (errors.length > 0) {
      throw new ScorecardError(400, `Scorecard validation failed: ${errors.join(' | ')}`);
    }

    const existing = order.scorecards ?? [];

    // Re-scoring path: caller passes `supersedes` with the id of the prior entry.
    // We mark that entry as supersededBy the new one and keep both in history.
    let supersedesId: string | undefined;
    if (payload.supersedes) {
      const prior = existing.find((s) => s.id === payload.supersedes);
      if (!prior) {
        throw new ScorecardError(
          400,
          `supersedes references unknown scorecard id ${payload.supersedes} on order ${orderId}.`,
        );
      }
      if (prior.supersededBy) {
        throw new ScorecardError(
          409,
          `Scorecard ${payload.supersedes} has already been superseded by ${prior.supersededBy}; re-score from the latest entry.`,
        );
      }
      supersedesId = prior.id;
    } else {
      // Implicit supersedes: if there's an active (non-superseded) latest, link to it.
      const active = [...existing].reverse().find((s) => !s.supersededBy);
      if (active) supersedesId = active.id;
    }

    const newEntry: VendorOrderScorecardEntry = {
      id: `sc-${Date.now()}-${uuidv4().slice(0, 8)}`,
      scores: payload.scores,
      overallScore: computeOverall(payload.scores),
      ...(payload.generalComments && payload.generalComments.trim().length > 0
        ? { generalComments: payload.generalComments.trim() }
        : {}),
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      ...(supersedesId ? { supersedes: supersedesId } : {}),
    };

    const updatedScorecards: VendorOrderScorecardEntry[] = existing.map((s) =>
      supersedesId && s.id === supersedesId ? { ...s, supersededBy: newEntry.id } : s,
    );
    updatedScorecards.push(newEntry);

    const updateResp = await this.dbService.updateOrder(orderId, {
      scorecards: updatedScorecards,
    });
    if (!updateResp.success) {
      throw new ScorecardError(500, `Failed to persist scorecard on order ${orderId}.`);
    }

    await this.auditService.log({
      actor: { userId: reviewedBy },
      action: 'scorecard.append',
      resource: { type: 'order', id: orderId },
      metadata: {
        scorecardId: newEntry.id,
        overallScore: newEntry.overallScore,
        supersedes: newEntry.supersedes,
        vendorId: order.assignedVendorId,
      },
    });

    // Fire-and-forget event so VendorPerformanceCalculator can recompute the
    // vendor's blended metrics. Best-effort; never throws.
    void this.publish('vendor-scorecard.created', {
      orderId,
      scorecardId: newEntry.id,
      vendorId: order.assignedVendorId,
      overallScore: newEntry.overallScore,
    });

    return newEntry;
  }

  /**
   * List all scorecards for an order (oldest first). The latest non-superseded
   * entry is the active rating.
   */
  async listScorecards(orderId: string): Promise<VendorOrderScorecardEntry[]> {
    const orderResp = await this.dbService.findOrderById(orderId);
    if (!orderResp.success || !orderResp.data) {
      throw new ScorecardError(404, `Order not found: ${orderId}`);
    }
    return (orderResp.data as Order).scorecards ?? [];
  }

  /**
   * Get the active (latest non-superseded) scorecard for an order, or null.
   */
  async getActiveScorecard(orderId: string): Promise<VendorOrderScorecardEntry | null> {
    const all = await this.listScorecards(orderId);
    for (let i = all.length - 1; i >= 0; i--) {
      const entry = all[i];
      if (entry && !entry.supersededBy) return entry;
    }
    return null;
  }

  private async publish(type: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.publisher.publish({
        id: uuidv4(),
        type,
        timestamp: new Date(),
        source: 'vendor-order-scorecard-service',
        version: '1.0',
        category: EventCategory.VENDOR,
        data: { priority: EventPriority.NORMAL, ...data },
      } as never);
    } catch (err) {
      this.logger.warn(`Failed to publish ${type} to Service Bus`, {
        error: (err as Error).message,
      });
    }
  }
}

// ─── Error type ──────────────────────────────────────────────────────────────

export class ScorecardError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'ScorecardError';
  }
}

// Re-exports so tests can import the policy helpers directly.
export {
  DETAILED_NOTES_MIN_CHARS,
  JUSTIFICATION_MIN_CHARS,
  validateScores,
  commentRequirementError,
  computeOverall,
  SCORECARD_CATEGORY_KEYS,
};
