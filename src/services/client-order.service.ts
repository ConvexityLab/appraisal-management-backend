/**
 * ClientOrderService — owns the lifecycle of placing a ClientOrder.
 *
 * Phase 1 contract (rules-as-suggestions model):
 *   - placeClientOrder(coInput, vendorOrderSpecs?) → creates the ClientOrder
 *     and ONLY the VendorOrders the caller passed. If `vendorOrderSpecs` is
 *     omitted/empty, the ClientOrder lands in PLACED with zero children.
 *   - addVendorOrders(clientOrderId, tenantId, specs) → appends VendorOrders
 *     to an existing ClientOrder after the fact (post-placement dispatch).
 *
 * Decomposition rules are NOT consulted here. The caller (UI / controller /
 * future auto-place adapter) is responsible for:
 *   1. Optionally calling OrderDecompositionService.findRule() / suggestVendorOrders()
 *      to surface suggestions to the user, and
 *   2. Passing the user-confirmed (or autoApply-derived) specs into these methods.
 *
 * This keeps the door open for a future "auto-place" path without changing
 * any service signatures — that adapter just calls findRule() then forwards
 * `rule.vendorOrders` straight into placeClientOrder() when `rule.autoApply`.
 *
 * Notes:
 *   - VendorOrder docs are still written with `type: 'order'` (legacy
 *     discriminator) per Phase A: existing read queries that filter
 *     `WHERE c.type = 'order'` keep working unchanged. Phase 4 flips both
 *     the discriminator and the read queries in one PR.
 *   - placeClientOrder is NOT atomic across the ClientOrder + VendorOrder
 *     writes. If a VendorOrder write fails, the ClientOrder is left in
 *     PLACED with a partial vendorOrderIds list. Caller surfaces the error;
 *     recovery is Phase 3.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import { VendorOrderService, type CreateVendorOrderInput } from './vendor-order.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import type { EventPublisher } from '../types/events.js';
import { EventCategory, type ClientOrderCreatedEvent } from '../types/events.js';
import {
  CLIENT_ORDERS_CONTAINER,
  CLIENT_ORDER_DOC_TYPE,
  ClientOrderStatus,
  type ClientOrder,
} from '../types/client-order.types.js';
import type { VendorOrder } from '../types/vendor-order.types.js';
import type { VendorOrderTemplate } from '../types/decomposition-rule.types.js';
import type { PropertyDetails } from '../types/index.js';
import type { VendorOrder as Order } from '../types/vendor-order.types.js';
import type { ProductType } from '../types/product-catalog.js';
import { OrderStatus } from '../types/order-status.js';

// ─── Inputs ──────────────────────────────────────────────────────────────────

/**
 * Required input to place a ClientOrder. Carries the union of fields needed
 * to instantiate both the ClientOrder document and any child VendorOrder(s).
 *
 * Required fields are listed explicitly; the remaining `Partial<Order>`
 * is forwarded onto every VendorOrder verbatim (propertyAddress,
 * loanInformation, borrowerInformation, dueDate, orderValue, etc.).
 */
export type PlaceClientOrderInput = Partial<Order> & {
  tenantId: string;
  createdBy: string;
  engagementId: string;
  engagementPropertyId: string;
  clientId: string;
  productType: ProductType;
  propertyDetails: PropertyDetails;
  /** Optional canonical PropertyRecord id; passed through to each VendorOrder. */
  propertyId?: string;
  /** Optional client-facing instructions; copied to each VendorOrder by default. */
  instructions?: string;
  /** Optional client-facing fee. Lives on ClientOrder, not VendorOrder. */
  clientFee?: number;
  /**
   * Optional caller-supplied id for the ClientOrder document. When present,
   * the persisted doc and the published `client-order.created` event use this
   * id verbatim. Used by EngagementService to keep the standalone ClientOrder
   * doc id aligned with the embedded EngagementClientOrder.id. When absent,
   * the service generates one (legacy behavior for `POST /api/client-orders`).
   */
  clientOrderId?: string;
};

/**
 * Caller-supplied spec for a single VendorOrder. Reuses VendorOrderTemplate
 * (vendorWorkType + optional vendorFee / instructions / dependsOn /
 * templateKey) so that templates returned by the decomposer can be passed
 * straight in after user confirmation.
 *
 * Anything not on the spec is inherited from the placeClientOrder input
 * (property/borrower/loan/due date/etc.) — see materializeVendorOrderInput().
 */
export type VendorOrderSpec = VendorOrderTemplate;

export interface PlaceClientOrderResult {
  clientOrder: ClientOrder;
  vendorOrders: VendorOrder[];
}

/** Thrown by placeClientOrder when required ancestry fields are missing. */
export class InvalidClientOrderInputError extends Error {
  public readonly missing: string[];
  constructor(missing: string[]) {
    super(
      `placeClientOrder() called with missing required field(s): ${missing.join(', ')}`,
    );
    this.name = 'InvalidClientOrderInputError';
    this.missing = missing;
  }
}

/** Thrown by addVendorOrders when the parent ClientOrder cannot be loaded. */
export class ClientOrderNotFoundError extends Error {
  constructor(clientOrderId: string, tenantId: string) {
    super(`ClientOrder "${clientOrderId}" not found in tenant "${tenantId}"`);
    this.name = 'ClientOrderNotFoundError';
  }
}

/**
 * Thrown by addVendorOrders when the parent ClientOrder is being modified
 * concurrently by another writer and the optimistic-concurrency retry budget
 * was exhausted. The child VendorOrders WERE created — the failure is the
 * link-back patch on the parent. Caller decides whether to retry the patch
 * or surface the partial state.
 */
export class ClientOrderConcurrencyError extends Error {
  public readonly clientOrderId: string;
  public readonly createdVendorOrderIds: string[];
  constructor(clientOrderId: string, createdVendorOrderIds: string[], attempts: number) {
    super(
      `ClientOrder "${clientOrderId}" patch failed after ${attempts} optimistic-concurrency ` +
        `retries. ${createdVendorOrderIds.length} VendorOrder(s) were created (` +
        `${createdVendorOrderIds.join(', ')}) but their ids were NOT linked to the parent.`,
    );
    this.name = 'ClientOrderConcurrencyError';
    this.clientOrderId = clientOrderId;
    this.createdVendorOrderIds = createdVendorOrderIds;
  }
}

/** Max etag-conflict retries before giving up. */
const ADD_VENDOR_ORDERS_MAX_ATTEMPTS = 4;

const REQUIRED_FIELDS: Array<keyof PlaceClientOrderInput> = [
  'tenantId',
  'createdBy',
  'engagementId',
  'engagementPropertyId',
  'clientId',
  'productType',
  'propertyDetails',
];

// ─── Service ─────────────────────────────────────────────────────────────────

export class ClientOrderService {
  private readonly logger = new Logger('ClientOrderService');
  private readonly publisher: EventPublisher;
  private readonly vendorOrderService: VendorOrderService;

  /**
   * @param dbService            Cosmos DB facade.
   * @param publisher            Optional event publisher (defaults to a fresh
   *                             `ServiceBusEventPublisher`). Tests inject a mock.
   *                             Used to fire `client-order.created` after a
   *                             ClientOrder is persisted so downstream consumers
   *                             (comp-collection listener, etc.) can react.
   * @param vendorOrderService   Optional VendorOrderService injection for tests.
   *                             When omitted, a default instance is constructed
   *                             against the same dbService. Phase 1 (slice 8e)
   *                             routes VendorOrder writes through this service
   *                             instead of calling dbService.createOrder directly.
   */
  constructor(
    private readonly dbService: CosmosDbService,
    publisher?: EventPublisher,
    vendorOrderService?: VendorOrderService,
  ) {
    this.publisher = publisher ?? new ServiceBusEventPublisher();
    this.vendorOrderService = vendorOrderService ?? new VendorOrderService(dbService);
  }

  /**
   * Create a ClientOrder. If `vendorOrderSpecs` is provided (and non-empty),
   * one VendorOrder is created per spec and linked to the ClientOrder. If
   * omitted or empty, the ClientOrder lands in PLACED with zero children;
   * callers can dispatch VendorOrders later via addVendorOrders().
   */
  async placeClientOrder(
    input: PlaceClientOrderInput,
    vendorOrderSpecs?: VendorOrderSpec[],
  ): Promise<PlaceClientOrderResult> {
    const missing = REQUIRED_FIELDS.filter((k) => {
      const v = input[k];
      return v === undefined || v === null || v === '';
    });
    if (missing.length > 0) {
      throw new InvalidClientOrderInputError(missing as string[]);
    }

    const now = new Date().toISOString();
    const clientOrderId = input.clientOrderId ?? newId();
    const clientOrderNumber = clientOrderId;

    const clientOrder: ClientOrder = {
      id: clientOrderId,
      tenantId: input.tenantId,
      type: CLIENT_ORDER_DOC_TYPE,
      clientOrderNumber,

      engagementId: input.engagementId,
      engagementPropertyId: input.engagementPropertyId,
      clientId: input.clientId,

      productType: input.productType,
      propertyDetails: input.propertyDetails,

      clientOrderStatus: ClientOrderStatus.PLACED,
      placedAt: now,

      vendorOrderIds: [],

      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,

      ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
      ...(input.priority !== undefined ? { priority: String(input.priority) } : {}),
      ...(input.dueDate !== undefined
        ? {
            dueDate:
              input.dueDate instanceof Date ? input.dueDate.toISOString() : String(input.dueDate),
          }
        : {}),
      ...(input.clientFee !== undefined ? { clientFee: input.clientFee } : {}),

      // Lender-side fields (Phase 4 of Order-relocation): pick up
      // borrower / loan / contact / address / etc. from PlaceClientOrderInput
      // (which is still `Partial<Order>` today) so they land on the
      // ClientOrder doc — their proper home — instead of being
      // forwarded onto every child VendorOrder.
      ...(input.orderType !== undefined ? { orderType: input.orderType } : {}),
      ...(input.propertyAddress !== undefined ? { propertyAddress: input.propertyAddress } : {}),
      ...(input.rushOrder !== undefined ? { rushOrder: input.rushOrder } : {}),
      ...(input.borrowerInformation !== undefined
        ? { borrowerInformation: input.borrowerInformation }
        : {}),
      ...(input.loanInformation !== undefined
        ? { loanInformation: input.loanInformation }
        : {}),
      ...(input.contactInformation !== undefined
        ? { contactInformation: input.contactInformation }
        : {}),
      ...(input.specialInstructions !== undefined
        ? { specialInstructions: input.specialInstructions }
        : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      // input.priority on Order is the vendor-side urgency (Priority enum).
      // The lender-side ClientOrder.priority is OrderPriority (ROUTINE/...)
      // and is set above. Carry the vendor-side signal as `vendorPriority`
      // on ClientOrder so the materialization listener can stamp child
      // VendorOrders with it later without re-reading the order.
      ...(input.priority !== undefined ? { vendorPriority: input.priority } : {}),
    };

    // 1. Persist ClientOrder.
    const coContainer = this.dbService.getContainer(CLIENT_ORDERS_CONTAINER);
    const { resource: createdClientOrder } = await coContainer.items.create(clientOrder);
    if (!createdClientOrder) {
      throw new Error(
        `Failed to create ClientOrder in container "${CLIENT_ORDERS_CONTAINER}" — Cosmos returned no resource`,
      );
    }

    // 2. Materialize child VendorOrders (if any specs were provided).
    const specs = vendorOrderSpecs ?? [];
    let vendorOrders: VendorOrder[] = [];
    if (specs.length > 0) {
      vendorOrders = await this.createVendorOrders(createdClientOrder as ClientOrder, input, specs);
    }

    // 3. Patch ClientOrder.vendorOrderIds (only if children were created).
    let finalClientOrder: ClientOrder = createdClientOrder as ClientOrder;
    if (vendorOrders.length > 0) {
      const updated: ClientOrder = {
        ...finalClientOrder,
        vendorOrderIds: vendorOrders.map((v) => v.id),
        updatedAt: new Date().toISOString(),
      };
      const { resource: replaced } = await coContainer
        .item(updated.id, updated.tenantId)
        .replace(updated);
      finalClientOrder = (replaced as ClientOrder) ?? updated;
    }

    this.logger.info('Placed ClientOrder', {
      clientOrderId: finalClientOrder.id,
      tenantId: finalClientOrder.tenantId,
      productType: finalClientOrder.productType,
      vendorOrderCount: vendorOrders.length,
    });

    // Fire `client-order.created` as a domain event for any interested
    // consumer (comp-collection listener today; analytics, audit, etc.
    // tomorrow). Consumers do their own filtering. Publish failures are
    // logged but DO NOT roll back the order — the order is already
    // persisted and is the source of truth.
    await this.publishClientOrderCreated(finalClientOrder);

    return { clientOrder: finalClientOrder, vendorOrders };
  }

  /**
   * Build and publish a `client-order.created` event. Errors are caught
   * and logged — never re-thrown — so order placement remains successful
   * even if the bus is unreachable.
   */
  private async publishClientOrderCreated(order: ClientOrder): Promise<void> {
    const event: ClientOrderCreatedEvent = {
      id: `cocreated-${order.id}-${Date.now()}`,
      type: 'client-order.created',
      category: EventCategory.ORDER,
      timestamp: new Date(),
      source: 'ClientOrderService',
      version: '1.0',
      data: {
        clientOrderId: order.id,
        clientOrderNumber: order.clientOrderNumber,
        tenantId: order.tenantId,
        ...(order.propertyId !== undefined ? { propertyId: order.propertyId } : {}),
        productType: order.productType,
        placedAt: order.placedAt,
      },
    };

    try {
      await this.publisher.publish(event);
    } catch (err) {
      this.logger.warn('Failed to publish client-order.created — order already persisted', {
        clientOrderId: order.id,
        tenantId: order.tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Append VendorOrders to an existing ClientOrder. Throws
   * ClientOrderNotFoundError if the parent doesn't exist or `tenantId`
   * doesn't match. Returns the newly-created VendorOrders.
   *
   * The caller-supplied `inheritedFields` carry the property/borrower/loan
   * context that VendorOrders need but ClientOrder doesn't store in full.
   * Callers typically pull these from the original placement request, the
   * engagement, or the linked PropertyRecord.
   *
   * Concurrency: the parent-patch step uses Cosmos optimistic concurrency
   * (`accessCondition: { type: 'IfMatch', condition: _etag }`) and retries
   * up to ADD_VENDOR_ORDERS_MAX_ATTEMPTS times on 412. The child VendorOrders
   * are created BEFORE the patch loop and are not re-created on retry —
   * conflict resolution is purely "merge new ids into the latest
   * vendorOrderIds with the latest etag". If retries are exhausted,
   * ClientOrderConcurrencyError is thrown carrying the orphaned VO ids.
   */
  async addVendorOrders(
    clientOrderId: string,
    tenantId: string,
    specs: VendorOrderSpec[],
    inheritedFields: Partial<Order> = {},
  ): Promise<VendorOrder[]> {
    if (specs.length === 0) {
      return [];
    }

    const coContainer = this.dbService.getContainer(CLIENT_ORDERS_CONTAINER);
    const { resource: parent } = await coContainer
      .item(clientOrderId, tenantId)
      .read<ClientOrder>();
    if (!parent) {
      throw new ClientOrderNotFoundError(clientOrderId, tenantId);
    }

    const placementInput: PlaceClientOrderInput = {
      ...inheritedFields,
      tenantId: parent.tenantId,
      createdBy: parent.createdBy,
      engagementId: parent.engagementId,
      engagementPropertyId: parent.engagementPropertyId,
      clientId: parent.clientId,
      productType: parent.productType,
      propertyDetails: parent.propertyDetails,
      ...(parent.propertyId !== undefined ? { propertyId: parent.propertyId } : {}),
      ...(parent.instructions !== undefined ? { instructions: parent.instructions } : {}),
    };

    const newVendorOrders = await this.createVendorOrders(parent, placementInput, specs);
    const newIds = newVendorOrders.map((v) => v.id);

    // Optimistic-concurrency retry loop on the parent patch.
    let current: ClientOrder = parent;
    let attempt = 0;
    while (true) {
      attempt += 1;
      const etag = (current as { _etag?: string })._etag;
      const updated: ClientOrder = {
        ...current,
        vendorOrderIds: [...current.vendorOrderIds, ...newIds],
        updatedAt: new Date().toISOString(),
      };
      try {
        await coContainer
          .item(updated.id, updated.tenantId)
          .replace(
            updated,
            etag ? { accessCondition: { type: 'IfMatch', condition: etag } } : undefined,
          );
        break; // success
      } catch (err) {
        const code = (err as { code?: number; statusCode?: number }).code
          ?? (err as { code?: number; statusCode?: number }).statusCode;
        if (code !== 412) {
          throw err;
        }
        if (attempt >= ADD_VENDOR_ORDERS_MAX_ATTEMPTS) {
          throw new ClientOrderConcurrencyError(clientOrderId, newIds, attempt);
        }
        // Reread for fresh etag + fresh vendorOrderIds, then retry.
        const reread = await coContainer
          .item(clientOrderId, tenantId)
          .read<ClientOrder>();
        if (!reread.resource) {
          // Parent vanished mid-flight (deleted by another writer). The
          // VendorOrders we just created are orphans; surface that.
          throw new ClientOrderConcurrencyError(clientOrderId, newIds, attempt);
        }
        current = reread.resource;
        this.logger.warn('addVendorOrders etag conflict — retrying', {
          clientOrderId,
          attempt,
        });
      }
    }

    this.logger.info('Added VendorOrders to ClientOrder', {
      clientOrderId,
      addedCount: newVendorOrders.length,
      attempts: attempt,
    });

    return newVendorOrders;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async createVendorOrders(
    clientOrder: ClientOrder,
    placementInput: PlaceClientOrderInput,
    specs: VendorOrderSpec[],
  ): Promise<VendorOrder[]> {
    // Strip ClientOrder-only fields; everything else is forwarded onto each
    // VendorOrder verbatim.
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      clientFee: _co_clientFee,
      ...vendorPassthrough
    } = placementInput;

    const out: VendorOrder[] = [];
    for (const spec of specs) {
      // Slice 8e: route through VendorOrderService (the canonical write path)
      // instead of calling dbService.createOrder directly. Same write, same
      // shape — just owns the discriminator + linkage decisions in one place.
      const vendorOrderInput: CreateVendorOrderInput = {
        ...vendorPassthrough,
        status: OrderStatus.NEW,
        tenantId: clientOrder.tenantId,
        clientOrderId: clientOrder.id,
        engagementId: clientOrder.engagementId,
        engagementPropertyId: clientOrder.engagementPropertyId,
        clientId: clientOrder.clientId,
        propertyId: clientOrder.propertyId ?? '',
        vendorWorkType: spec.vendorWorkType,
        ...(spec.vendorFee !== undefined ? { vendorFee: spec.vendorFee } : {}),
        ...(spec.instructions !== undefined ? { instructions: spec.instructions } : {}),
      };

      const created = await this.vendorOrderService.createVendorOrder(vendorOrderInput);

      // VendorOrderService returns a VendorOrder already shaped with linkage;
      // we only need to ensure productType reflects the parent ClientOrder
      // (vendorWorkType may differ from the parent's productType after future
      // multi-step decomposition; productType here mirrors the parent for
      // back-compat).
      out.push({
        ...created,
        productType: clientOrder.productType,
      } as VendorOrder);
    }
    return out;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function newId(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `CO-${ts}${rand}`;
}
