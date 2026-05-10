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
  rules: unknown[];
  sinceDays?: number;
  ids?: string[];
  samplePercent?: number;
}

/** Result shape returned by `replay`. Phase D fleshes out the diff structure. */
export interface CategoryReplayDiff {
  totalEvaluated: number;
  changedCount: number;
  unchangedCount: number;
  newDenialsCount: number;
  perDecision?: Array<Record<string, unknown>>;
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
