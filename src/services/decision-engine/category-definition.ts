/**
 * CategoryDefinition + CategoryRegistry — the plugin contract that lets
 * each decision system (vendor matching, review programs, firing rules,
 * Axiom criteria, …) participate in the generalized Decision Engine
 * surface without the controller / service knowing anything about that
 * system specifically.
 *
 * Phase B of docs/DECISION_ENGINE_RULES_SURFACE.md. The Phase A
 * controller hard-wired a single `MopRulePackPusher` for vendor-matching;
 * this module replaces that hard-wiring with a registry the controller
 * dispatches into at request time.
 *
 * Each category supplies its own:
 *   - `validateRules`  — light pre-write check (heavier validation typically
 *                       lives in the upstream evaluator, e.g. MOP's C++
 *                       VendorMatchingService::validateRulesJson).
 *   - `push`           — best-effort push of a freshly created pack to the
 *                       upstream evaluator (optional for in-process categories).
 *   - `preview`        — stateless preview against sample facts.
 *   - `getSeed`        — read the upstream "default" pack that every tenant
 *                       inherits when they have no override (optional).
 *   - `drop`           — drop a tenant pack on the upstream evaluator
 *                       (optional; mirrors the DELETE endpoint).
 *   - `replay`         — re-evaluate historical decisions with proposed rules
 *                       (Phase D — stubbed today).
 *
 * Categories that don't need a particular method (e.g., an in-process
 * firing-rules evaluator has no upstream `push`) simply omit it; the
 * controller surfaces 501 for the corresponding endpoint.
 */

import type {
  DecisionRuleCategory,
  RulePackDocument,
} from '../../types/decision-rule-pack.types.js';

/** Outcome of a stateless preview run for one sample fact bundle. */
export interface CategoryPreviewResult {
  eligible: boolean;
  scoreAdjustment: number;
  appliedRuleIds: string[];
  denyReasons: string[];
  /** Free-form per-category metadata (e.g. routed program id, escalation reason). */
  extras?: Record<string, unknown>;
}

/** Inputs accepted by `preview`. Each category interprets `evaluations` per its fact schema. */
export interface CategoryPreviewInput {
  rules: unknown[];
  /** Sample fact bundles to evaluate (vendor+order pairs for vendor-matching, etc.). */
  evaluations: Array<Record<string, unknown>>;
  /** Caller-supplied pack id for trace/debug labelling; never persisted. */
  packId?: string;
}

/** Inputs accepted by `replay` (Phase D). */
export interface CategoryReplayInput {
  /** Caller's tenant — every replay is tenant-scoped. */
  tenantId: string;
  rules: unknown[];
  /** Look back this many days of decisions. Default 7. Capped server-side. */
  sinceDays?: number;
  /** Optional explicit list of decision ids/orderIds to replay (overrides sinceDays).
   *  For vendor-matching, the implementation queries by orderId and takes the
   *  MOST RECENT trace per order. Use `traceIds` instead when you need to pin
   *  the replay to a specific historical trace (e.g. the simulator targets
   *  in-flight `pending_bid` traces that may not be the most recent for that
   *  order). */
  ids?: string[];
  /** Optional explicit list of trace Cosmos doc ids. Wins over `ids` + `sinceDays`.
   *  Used by the simulator to evaluate the EXACT in-flight traces, not whatever
   *  trace happens to be most-recent for an order. */
  traceIds?: string[];
  /** 1-100, percentage of in-window traces to sub-sample. Default 100. */
  samplePercent?: number;
  /** Caller-supplied pack id for trace/debug labelling. */
  packId?: string;
}

/** Per-decision summary inside a replay diff. */
export interface CategoryReplayDecision {
  decisionId: string;
  /** What the trace knows about — order id for vendor-matching, etc. */
  subjectId: string;
  initiatedAt: string;
  /** True when the new outcome differs from the original outcome. */
  changed: boolean;
  /** One-line summary of the diff for the row label. */
  summary: string;
  /** Free-form per-category detail rendered in the expandable detail row. */
  details?: Record<string, unknown>;
  /** Set when this trace couldn't be replayed (missing snapshot, vendor not found, etc). */
  skippedReason?: string;
}

/** Result shape returned by `replay`. */
export interface CategoryReplayDiff {
  /** Total traces in the replay window before sampling. */
  windowSize: number;
  /** How many traces were actually re-evaluated. */
  totalEvaluated: number;
  changedCount: number;
  unchangedCount: number;
  skippedCount: number;
  /** Aggregate count of newly-denied subjects across all replayed decisions. */
  newDenialsCount: number;
  /** Aggregate count of newly-allowed subjects (originally denied, now allowed). */
  newAcceptancesCount: number;
  perDecision: CategoryReplayDecision[];
}

/** Inputs accepted by `analytics` (Phase E). */
export interface CategoryAnalyticsInput {
  tenantId: string;
  /** Look back this many days. Default 30. Capped server-side. */
  days?: number;
}

/** Per-rule analytics row inside the response. */
export interface CategoryAnalyticsRule {
  ruleId: string;
  fireCount: number;
  fireRatePercent: number;
  /** When the rule contributed to a denial. */
  denialContributionCount: number;
  /** Sum of score adjustments attributed to this rule across the window. */
  scoreAdjustmentSum: number;
  /** One bucket per day in the window, oldest → newest. Length = `days`. */
  daily: number[];
}

/** Aggregate analytics result for a category over a time window. */
export interface CategoryAnalyticsSummary {
  category: string;
  windowDays: number;
  /** ISO date strings (YYYY-MM-DD), oldest → newest. */
  windowDates: string[];
  totalDecisions: number;
  totalEvaluations: number;
  /** Decisions whose outcome was an escalation (no vendor / exhausted). */
  escalationCount: number;
  /** Free-form per-category counts (e.g., per-outcome bucket sizes). */
  outcomeCounts: Record<string, number>;
  perRule: CategoryAnalyticsRule[];
  /** Generated at server-side; helps the FE display a "computed at" line. */
  computedAt: string;
}

/** Result of a pre-write validation. Errors block the write; warnings surface to the operator. */
export interface CategoryValidationResult {
  errors: string[];
  warnings: string[];
}

export interface CategoryDefinition {
  /** Stable id used in URLs, Cosmos docs, audit rows. */
  id: DecisionRuleCategory;
  /** Human-readable label for headers + selectors. */
  label: string;
  /** Helper text shown under the category header in the UI. */
  description: string;
  /** Icon name (heroicons-outline:*) for nav + selectors. */
  icon: string;

  /**
   * Light, fast validation run before the storage write. Should reject
   * obviously-broken inputs (missing required fields, duplicates).
   * Heavier semantic validation usually lives in the upstream evaluator.
   */
  validateRules(rules: unknown[]): CategoryValidationResult;

  /**
   * Best-effort push to the upstream evaluator after a successful create.
   * Failures are logged but don't roll back the storage write — the
   * service treats AMS as the source of truth and recovers out of band.
   *
   * Omit when the category is evaluated in-process (no separate evaluator
   * to notify).
   */
  push?: (pack: RulePackDocument<unknown>) => Promise<void>;

  /**
   * Stateless preview: evaluate proposed rules against sample fact bundles.
   * Returns one result per evaluation in input order.
   *
   * Omit when the category has no preview surface yet — the FE workspace
   * hides the preview pane in that case.
   */
  preview?: (input: CategoryPreviewInput) => Promise<CategoryPreviewResult[]>;

  /**
   * Read the upstream evaluator's seed/default pack — what's currently
   * firing for any tenant that hasn't published an override. Used by the
   * workspace's "Show seed" + "Seed v1 from default" flows.
   *
   * Omit when the category has no upstream-managed default (e.g., an
   * in-process category where the seed lives in AMS itself).
   */
  getSeed?: () => Promise<{ program: Record<string, unknown>; rules: unknown[] }>;

  /**
   * Drop a tenant pack on the upstream evaluator (returning that tenant
   * to the seed). Omit when there's nothing upstream to drop.
   */
  drop?: (tenantId: string) => Promise<void>;

  /**
   * Re-evaluate historical decisions with a proposed rule set and return
   * a diff. Phase D — left optional / stubbed today; non-implementing
   * categories simply don't expose the Sandbox tab in the workspace.
   */
  replay?: (input: CategoryReplayInput) => Promise<CategoryReplayDiff>;

  /**
   * Per-rule analytics for the workspace's Analytics tab + the cross-category
   * landing page. Phase E — left optional; non-implementing categories
   * simply don't expose the Analytics tab.
   *
   * MVP-style implementations may compute on-the-fly from the category's
   * trace store; later phases can swap in a pre-aggregated container.
   */
  analytics?: (input: CategoryAnalyticsInput) => Promise<CategoryAnalyticsSummary>;

  /**
   * Project the effect of publishing a proposed rule pack against IN-FLIGHT
   * decisions (rev 16 scope expansion). Categories that don't expose the
   * Sandbox "Simulate impact" surface simply omit this method and the
   * controller surfaces 501. The shape mirrors `replay`'s contract; the
   * caller (DecisionImpactSimulatorService for vendor-matching) is free
   * to extend the result with category-specific fields.
   *
   * Why on the interface and not hardcoded in the controller: previously
   * the controller had `if (category !== 'vendor-matching')` which made
   * adding a simulator to firing-rules / review-program a controller edit
   * instead of a category-level change. The plugin pattern is what every
   * other Decision Engine surface uses.
   */
  simulate?: (input: CategoryReplayInput) => Promise<unknown>;
}

/**
 * In-process registry of categories. Wired up at app startup
 * (api-server.ts) and queried by:
 *   - DecisionEngineRulesController on every request
 *   - DecisionRulePackService's onNewActivePack hook dispatch
 */
export class CategoryRegistry {
  private readonly byId = new Map<DecisionRuleCategory, CategoryDefinition>();

  register(definition: CategoryDefinition): void {
    if (!definition.id || typeof definition.id !== 'string') {
      throw new Error('CategoryDefinition.id is required and must be a non-empty string');
    }
    if (this.byId.has(definition.id)) {
      throw new Error(`Category '${definition.id}' is already registered`);
    }
    this.byId.set(definition.id, definition);
  }

  get(id: DecisionRuleCategory): CategoryDefinition | undefined {
    return this.byId.get(id);
  }

  has(id: DecisionRuleCategory): boolean {
    return this.byId.has(id);
  }

  ids(): DecisionRuleCategory[] {
    return Array.from(this.byId.keys());
  }

  list(): CategoryDefinition[] {
    return Array.from(this.byId.values());
  }
}
