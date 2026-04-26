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
  type DecompositionRule,
  type VendorOrderTemplate,
} from '../types/decomposition-rule.types.js';

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
   * Convenience: returns the matched rule's `vendorOrders` templates, or `[]`
   * if no rule matches. Use this when the caller doesn't need the rule
   * metadata (id, autoApply, etc.) — only the suggested templates.
   */
  async suggestVendorOrders(
    tenantId: string,
    clientId: string,
    productType: ProductType,
  ): Promise<VendorOrderTemplate[]> {
    const rule = await this.findRule(tenantId, clientId, productType);
    return rule?.vendorOrders ?? [];
  }
}
