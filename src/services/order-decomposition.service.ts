/**
 * OrderDecompositionService — looks up a DecompositionRule for a given
 * (tenantId, clientId, productType) scope and returns its vendor-order
 * templates.
 *
 * IMPORTANT: This service is ADVISORY in Phase 1. It never auto-creates
 * VendorOrders and never throws when no rule matches — it simply returns
 * null / [] and the caller (UI / controller) decides what to do.
 *
 *   - findRule()              → matched rule or null
 *   - suggestVendorOrders()   → matched rule's vendorOrders[] or []
 *
 * Lookup precedence (most specific wins):
 *   1. (tenantId + clientId + productType)   — tenant-and-client override
 *   2. (tenantId + productType)               — tenant default
 *   3. (productType, default: true)           — global default
 *
 * The `autoApply` flag on the returned rule is the contract for a future
 * "auto-place" path:
 *   - autoApply !== true  → caller must surface templates as suggestions
 *                            for human review (Phase 1 behavior — always).
 *   - autoApply === true  → caller MAY materialize templates without prompting.
 *                            No code path uses this branch yet; it's reserved.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type { ProductType } from '../types/product-catalog.js';
import {
  DECOMPOSITION_RULES_CONTAINER,
  DECOMPOSITION_RULE_DOC_TYPE,
  GLOBAL_DEFAULT_TENANT,
  type DecompositionContext,
  type DecompositionRule,
  type VendorOrderTemplate,
} from '../types/decomposition-rule.types.js';
import { evaluateReviewFlagCondition } from '../utils/review-flag-condition.evaluator.js';

export class OrderDecompositionService {
  private readonly logger = new Logger('OrderDecompositionService');

  constructor(private readonly dbService: CosmosDbService) {}

  /**
   * Resolve the most-specific DecompositionRule for the given scope.
   * Returns null when no rule matches at any tier — this is an EXPECTED
   * outcome, not an error. Day-one zero-rules state must work.
   */
  async findRule(
    tenantId: string,
    clientId: string,
    productType: ProductType,
  ): Promise<DecompositionRule | null> {
    const container = this.dbService.getContainer(DECOMPOSITION_RULES_CONTAINER);

    // Tier 1: tenant + client + productType.
    const tier1 = await container.items
      .query<DecompositionRule>({
        query:
          'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId ' +
          'AND c.clientId = @clientId AND c.productType = @productType',
        parameters: [
          { name: '@type', value: DECOMPOSITION_RULE_DOC_TYPE },
          { name: '@tenantId', value: tenantId },
          { name: '@clientId', value: clientId },
          { name: '@productType', value: productType },
        ],
      })
      .fetchAll();
    if (tier1.resources.length > 0) {
      return tier1.resources[0]!;
    }

    // Tier 2: tenant + productType (no clientId on the row).
    const tier2 = await container.items
      .query<DecompositionRule>({
        query:
          'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId ' +
          'AND c.productType = @productType AND (NOT IS_DEFINED(c.clientId) OR c.clientId = null)',
        parameters: [
          { name: '@type', value: DECOMPOSITION_RULE_DOC_TYPE },
          { name: '@tenantId', value: tenantId },
          { name: '@productType', value: productType },
        ],
      })
      .fetchAll();
    if (tier2.resources.length > 0) {
      return tier2.resources[0]!;
    }

    // Tier 3: global default for productType.
    const tier3 = await container.items
      .query<DecompositionRule>({
        query:
          'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @globalTenant ' +
          'AND c.productType = @productType AND c["default"] = true',
        parameters: [
          { name: '@type', value: DECOMPOSITION_RULE_DOC_TYPE },
          { name: '@globalTenant', value: GLOBAL_DEFAULT_TENANT },
          { name: '@productType', value: productType },
        ],
      })
      .fetchAll();
    if (tier3.resources.length > 0) {
      return tier3.resources[0]!;
    }

    this.logger.debug('No DecompositionRule matched', { tenantId, clientId, productType });
    return null;
  }

  /**
   * Convenience: returns the matched rule's STATIC `vendorOrders` templates,
   * or `[]` if no rule matches. Same behaviour as before slice 8h —
   * intentionally ignores selectors/conditional templates so legacy callers
   * that don't have a context bag still work.
   *
   * For full composition (static + selectors + conditional), use `compose()`.
   */
  async suggestVendorOrders(
    tenantId: string,
    clientId: string,
    productType: ProductType,
  ): Promise<VendorOrderTemplate[]> {
    const rule = await this.findRule(tenantId, clientId, productType);
    return rule?.vendorOrders ?? [];
  }

  /**
   * Slice 8h: full rule-driven composition.
   *
   * Returns the union of every applicable VendorOrderTemplate for the given
   * scope, given the placement context:
   *
   *   1. STATIC      — always-included templates from `rule.vendorOrders[]`
   *   2. SELECTORS   — `rule.selectors[].include[]` whose `when` clause
   *                    matches the context's `productOptions` bag
   *                    (case-insensitive AND across keys).
   *   3. CONDITIONAL — `rule.conditionalTemplates[].include[]` whose
   *                    `condition` evaluates true against the context's
   *                    `canonical` view (uses the shared
   *                    review-flag-condition evaluator).
   *
   * Templates are deduplicated by `templateKey` (when present) — first occurrence
   * wins, so static templates are stable and selectors/conditionals can't shadow
   * them. Templates without a templateKey are always kept (assume distinct).
   *
   * Returns `[]` when no rule matches the scope (same as suggestVendorOrders).
   */
  async compose(
    tenantId: string,
    clientId: string,
    productType: ProductType,
    context: DecompositionContext = {},
  ): Promise<VendorOrderTemplate[]> {
    const rule = await this.findRule(tenantId, clientId, productType);
    if (!rule) return [];
    return composeFromRule(rule, context);
  }
}

// ─── Composition helpers (exported for testability) ──────────────────────────

/**
 * Pure composition of a rule + context → final template list. Exposed for
 * unit testing without needing a CosmosDbService.
 */
export function composeFromRule(
  rule: DecompositionRule,
  context: DecompositionContext,
): VendorOrderTemplate[] {
  const out: VendorOrderTemplate[] = [];
  const seenKeys = new Set<string>();

  const addAll = (templates: VendorOrderTemplate[]) => {
    for (const t of templates) {
      if (t.templateKey && seenKeys.has(t.templateKey)) continue;
      if (t.templateKey) seenKeys.add(t.templateKey);
      out.push(t);
    }
  };

  // 1. Static — always-included.
  addAll(rule.vendorOrders ?? []);

  // 2. Selectors — match against productOptions.
  const options = context.productOptions ?? {};
  for (const selector of rule.selectors ?? []) {
    if (selectorMatches(selector.when, options)) {
      addAll(selector.include);
    }
  }

  // 3. Conditional — evaluate predicate against canonical view.
  if (rule.conditionalTemplates && rule.conditionalTemplates.length > 0) {
    const view = context.canonical ?? {};
    for (const ct of rule.conditionalTemplates) {
      if (evaluateReviewFlagCondition(view, ct.condition)) {
        addAll(ct.include);
      }
    }
  }

  return out;
}

/**
 * AND-match a selector's `when` clause against the caller's productOptions
 * bag. All keys must equal the corresponding option (case-insensitive for
 * strings; strict equality for number/boolean). Missing-from-context keys
 * fail the match (selectors are explicit).
 */
function selectorMatches(
  when: Record<string, string | number | boolean>,
  options: Record<string, string | number | boolean>,
): boolean {
  for (const [k, expected] of Object.entries(when)) {
    const actual = options[k];
    if (actual === undefined) return false;
    if (typeof expected === 'string' && typeof actual === 'string') {
      if (expected.toLowerCase() !== actual.toLowerCase()) return false;
    } else if (expected !== actual) {
      return false;
    }
  }
  return true;
}
