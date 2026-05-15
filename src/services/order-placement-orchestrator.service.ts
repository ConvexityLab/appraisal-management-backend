/**
 * OrderPlacementOrchestrator
 *
 * The single, universal funnel through which ALL client order placement and
 * vendor order creation must pass — regardless of the originating interface
 * (UI, REST API, AIM-Port inbound webhook, bulk ingestion worker, AI assistant,
 * bulk portfolio, or any future integration).
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * Before this service existed, seven distinct entry points each wired their own
 * ad-hoc path from "engagement received" to "vendor order created".  Only the
 * AIM-Port adapter consulted decomposition rules; every other path applied a
 * hardcoded 1-to-1 mapping (one ProductType → one VendorOrder of the same type).
 *
 * The canonical process is ONE pipeline:
 *
 *   Entry point (HTTP / webhook / bulk / AI)
 *     ↓
 *   EngagementService.createEngagement()
 *     → Engagement doc + EngagementProperty[] + EngagementClientOrder[]
 *     ↓
 *   OrderPlacementOrchestrator.orchestrateClientOrder()  ← YOU ARE HERE
 *     → consult OrderDecompositionService for the (tenant, client, productType)
 *     → if autoApply rule exists:  compose() → VendorOrderSpec[]
 *     → if no autoApply rule:      undefined  (bare ClientOrder, human confirms)
 *     ↓
 *   ClientOrderService.placeClientOrder(input, specs?)
 *     → ClientOrder doc + VendorOrder docs
 *     ↓
 *   event: order.created → auto-assignment → bidding → acceptance → monitoring
 *
 * ─── Two entry points on this service ───────────────────────────────────────
 *
 * 1. orchestrateClientOrder(input, context?)
 *    Creates a brand-new ClientOrder.  Used by:
 *      • EngagementService.enrichAndPlaceClientOrders  (all non-bulk paths)
 *      • EngagementService.addClientOrderToLoan        (engagement controller)
 *      • VendorOrderReferenceService                   (AIM-Port inbound)
 *      Note: ClientOrderController (POST /) receives explicit user-confirmed
 *      specs from the request body and calls ClientOrderService directly.
 *      Decomposition for that path is advisory-only via GET /suggestions.
 *
 * 2. addDecomposedVendorOrders(...)
 *    Appends VendorOrders to an EXISTING ClientOrder.  Used by:
 *      • BulkIngestionOrderCreationWorkerService — which creates the Engagement +
 *        ClientOrder in a dedicated step (skipClientOrderPlacement=true) and then
 *        enriches each row with full metadata (orderNumber, loanNumber, etc.)
 *        before attaching VendorOrders here.
 *
 * ─── Decomposition semantics ────────────────────────────────────────────────
 * • findRule(tenantId, clientId, productType):
 *     Tier 1 — tenant + client + productType (most specific)
 *     Tier 2 — tenant + productType
 *     Tier 3 — global default (__global__, default=true)
 * • autoApply === true  → compose() is called; templates become VendorOrderSpecs
 * • autoApply !== true  → returns undefined; ClientOrder is placed bare
 * • No rule found       → returns undefined; ClientOrder is placed bare
 *
 * Zero-rules state (no rules configured at all) is a valid, expected state and
 * produces exactly the same behaviour as before this orchestrator existed.
 *
 * ─── Safety ─────────────────────────────────────────────────────────────────
 * • resolveSpecs() never throws on "no rule" or "rule without autoApply" — those
 *   are expected states, not errors.
 * • orchestrateClientOrder() never suppresses ClientOrderService errors — they
 *   still propagate to the caller.
 * • addDecomposedVendorOrders() falls back to the caller-provided fallbackSpecs
 *   when no autoApply rule exists, preserving the previously-working 1-to-1
 *   behaviour for callers that supplied their own spec.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import {
  ClientOrderService,
  type PlaceClientOrderInput,
  type PlaceClientOrderResult,
  type VendorOrderSpec,
} from './client-order.service.js';
import { OrderDecompositionService } from './order-decomposition.service.js';
import type { DecompositionContext } from '../types/decomposition-rule.types.js';
import type { ProductType } from '../types/product-catalog.js';
import type { VendorOrder } from '../types/vendor-order.types.js';
import type { VendorOrder as Order } from '../types/vendor-order.types.js';

export class OrderPlacementOrchestrator {
  private readonly logger = new Logger('OrderPlacementOrchestrator');

  constructor(
    private readonly clientOrderService: ClientOrderService,
    private readonly decompositionService: OrderDecompositionService,
  ) {}

  // ── Factory ────────────────────────────────────────────────────────────────

  /**
   * Convenience factory — constructs an orchestrator from a raw CosmosDbService.
   * Used internally when callers omit the explicit injection (production default).
   */
  static fromDb(dbService: CosmosDbService): OrderPlacementOrchestrator {
    return new OrderPlacementOrchestrator(
      new ClientOrderService(dbService),
      new OrderDecompositionService(dbService),
    );
  }

  // ── Core resolution ────────────────────────────────────────────────────────

  /**
   * Resolve the VendorOrderSpecs to use for a given (tenantId, clientId,
   * productType) scope.
   *
   * Returns:
   *   • VendorOrderSpec[]  — when an autoApply rule exists and compose() returns
   *                          at least one template
   *   • undefined          — when no autoApply rule exists (zero-rules state,
   *                          rule exists but autoApply !== true, or compose()
   *                          returned empty templates)
   *
   * Callers treat `undefined` as "place bare ClientOrder; human to confirm".
   */
  async resolveSpecs(
    tenantId: string,
    clientId: string,
    productType: ProductType,
    context: DecompositionContext = {},
  ): Promise<VendorOrderSpec[] | undefined> {
    let rule;
    try {
      rule = await this.decompositionService.findRule(tenantId, clientId, productType);
    } catch (err) {
      // Decomposition DB read failure is non-fatal — degrade gracefully to bare
      // ClientOrder rather than blocking the entire order creation path.
      this.logger.error('OrderDecompositionService.findRule failed — degrading to no-spec placement', {
        tenantId,
        clientId,
        productType,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }

    if (!rule) {
      this.logger.debug('No decomposition rule found — placing bare ClientOrder', {
        tenantId, clientId, productType,
      });
      return undefined;
    }

    if (rule.autoApply !== true) {
      this.logger.debug('Decomposition rule found but autoApply=false — suggestions-only mode', {
        tenantId, clientId, productType, ruleId: rule.id,
      });
      return undefined;
    }

    let templates;
    try {
      templates = await this.decompositionService.compose(tenantId, clientId, productType, context);
    } catch (err) {
      this.logger.error('OrderDecompositionService.compose failed — degrading to no-spec placement', {
        tenantId,
        clientId,
        productType,
        ruleId: rule.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }

    if (templates.length === 0) {
      this.logger.warn('Decomposition rule has autoApply=true but compose() returned no templates', {
        tenantId, clientId, productType, ruleId: rule.id,
      });
      return undefined;
    }

    this.logger.info('Auto-applying decomposition rule', {
      tenantId, clientId, productType, ruleId: rule.id, templateCount: templates.length,
    });
    return templates;
  }

  // ── Primary entry point: new ClientOrder ──────────────────────────────────

  /**
   * Create a new ClientOrder with decomposition-resolved VendorOrders.
   *
   * This is the canonical entry point for all Engagement → ClientOrder creation
   * paths.  If a decomposition rule with autoApply=true is configured for the
   * (tenantId, clientId, productType) scope, VendorOrders are materialised from
   * the composed templates.  Otherwise the ClientOrder is placed bare (zero
   * VendorOrders) awaiting human confirmation via the suggestions UI.
   *
   * @param input    PlaceClientOrderInput — same contract as ClientOrderService.
   * @param context  Optional decomposition context (productOptions, canonical
   *                 view) passed to compose() for selector + conditional rules.
   */
  async orchestrateClientOrder(
    input: PlaceClientOrderInput,
    context: DecompositionContext = {},
  ): Promise<PlaceClientOrderResult> {
    if (!input.clientId) {
      throw new Error(
        `OrderPlacementOrchestrator.orchestrateClientOrder: clientId is required on input ` +
        `(engagementId=${input.engagementId}, productType=${input.productType})`,
      );
    }
    if (!input.productType) {
      throw new Error(
        `OrderPlacementOrchestrator.orchestrateClientOrder: productType is required on input ` +
        `(engagementId=${input.engagementId}, clientId=${input.clientId})`,
      );
    }

    const specs = await this.resolveSpecs(input.tenantId, input.clientId, input.productType, context);
    return this.clientOrderService.placeClientOrder(input, specs);
  }

  // ── Secondary entry point: add to existing ClientOrder ────────────────────

  /**
   * Append decomposition-resolved VendorOrders to an ALREADY EXISTING
   * ClientOrder.
   *
   * Used by bulk ingestion, which creates the ClientOrder in a prior step
   * (via EngagementService.createEngagement with skipClientOrderPlacement=true
   * followed by a direct placeClientOrder call) and then attaches VendorOrders
   * here with full row-level metadata (orderNumber, loanNumber, etc.) that the
   * engagement-creation step does not have.
   *
   * Fallback behaviour: when no autoApply rule is found, the caller-provided
   * `fallbackSpecs` are used verbatim.  This preserves the previously-working
   * 1-to-1 behaviour for callers that passed their own spec.
   *
   * @param clientOrderId   ID of the existing ClientOrder.
   * @param tenantId        Partition key for the ClientOrder lookup.
   * @param clientId        Used for decomposition lookup.
   * @param productType     Used for decomposition lookup.
   * @param fallbackSpecs   Used when no autoApply rule is found.
   * @param inheritedFields Property/borrower/loan data carried forward to each
   *                        new VendorOrder (see ClientOrderService.addVendorOrders).
   * @param context         Optional decomposition context.
   */
  async addDecomposedVendorOrders(
    clientOrderId: string,
    tenantId: string,
    clientId: string,
    productType: ProductType,
    fallbackSpecs: VendorOrderSpec[],
    inheritedFields: Partial<Order> = {},
    context: DecompositionContext = {},
  ): Promise<VendorOrder[]> {
    const resolvedSpecs =
      (await this.resolveSpecs(tenantId, clientId, productType, context)) ?? fallbackSpecs;

    if (resolvedSpecs.length === 0) {
      this.logger.warn('addDecomposedVendorOrders: no specs resolved and no fallback — skipping', {
        clientOrderId, tenantId, productType,
      });
      return [];
    }

    this.logger.info('addDecomposedVendorOrders: attaching VendorOrders', {
      clientOrderId, tenantId, productType,
      specCount: resolvedSpecs.length,
      viaDecomposition: resolvedSpecs !== fallbackSpecs,
    });

    return this.clientOrderService.addVendorOrders(
      clientOrderId,
      tenantId,
      resolvedSpecs,
      inheritedFields,
    );
  }
}
