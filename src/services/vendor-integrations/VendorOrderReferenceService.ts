import { CosmosDbService } from '../cosmos-db.service.js';
import { EngagementService } from '../engagement.service.js';
import { PropertyRecordService } from '../property-record.service.js';
import { ClientOrderService, type VendorOrderSpec } from '../client-order.service.js';
import { OrderDecompositionService } from '../order-decomposition.service.js';
import { OrderPriority } from '../../types/order-management.js';
import type { ProductType } from '../../types/product-catalog.js';
import { Logger } from '../../utils/logger.js';
import type {
  VendorConnection,
  VendorDomainEvent,
  VendorOrderReceivedPayload,
  VendorOrderReference,
} from '../../types/vendor-integration.types.js';
import type { Engagement } from '../../types/engagement.types.js';

/** Minimal slice of the auto-assignment orchestrator needed to trigger vendor matching. */
export interface VendorAssignmentTrigger {
  triggerVendorAssignment(params: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    engagementId: string;
    productType: string;
    propertyAddress: string;
    propertyState: string;
    clientId: string;
    loanAmount: number;
    priority: 'STANDARD' | 'RUSH' | 'EMERGENCY';
    dueDate: Date;
    productId?: string;
    requiredCapabilities?: string[];
  }): Promise<void>;
}

interface ExistingOrderReference {
  engagementId: string;
  clientOrderId: string;
  vendorOrderId: string;
  vendorOrderNumber: string | undefined;
}

const ENGAGEMENTS_CONTAINER = 'engagements';

function asOrderPayload(event: VendorDomainEvent): VendorOrderReceivedPayload {
  if (event.eventType !== 'vendor.order.received') {
    throw new Error(
      `Order reference resolution only supports vendor.order.received events. Received ${event.eventType}`,
    );
  }

  return event.payload as VendorOrderReceivedPayload;
}

function ensureIsoDate(value: string | undefined, fieldName: string, vendorOrderId: string): string {
  if (!value || !value.trim()) {
    throw new Error(`${fieldName} is required to create internal order reference for vendorOrderId=${vendorOrderId}`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `${fieldName} must be a valid ISO date for vendorOrderId=${vendorOrderId}. Received ${value}`,
    );
  }

  return parsed.toISOString();
}

/**
 * Adds N business days (Mon–Fri) to a date, skipping weekends.
 * Used when a vendor omits due_date on inbound OrderRequest.
 */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/**
/**
 * Resolves one vendor product entry to an internal ProductType string.
 *
 * Resolution order:
 *  1. `productMappings` from the VendorConnection Cosmos doc — admin-configured,
 *     per-connection, no redeploy needed.  Key is the vendor product id stringified.
 *  2. Keyword heuristics on the product name + id — vendor-agnostic safety net
 *     for products not yet explicitly mapped.
 *  3. Hard throw: unknown product — caller must add a mapping via the admin API.
 *
 * To add a new vendor product: PATCH /api/vendor-integrations/connections/:id
 * with { "productMappings": { "<vendorProductId>": "<ProductType>" } }.
 * No code change or redeploy required.
 */
function mapSingleProductType(
  product: VendorOrderReceivedPayload['products'][number],
  vendorOrderId: string,
  productMappings?: Record<string, string>,
): string {
  // 1. Connection-level explicit mapping (admin-configured in Cosmos).
  if (productMappings) {
    const key = String(product.id ?? '');
    const mapped = key ? productMappings[key] : undefined;
    if (mapped) return mapped;
  }

  // 2. Keyword heuristics — order matters; more specific patterns come first.
  const raw = `${product.name ?? ''} ${product.id ?? ''}`.trim().toLowerCase();

  // 1004D = desktop / recertification / update — must precede the generic '1004' check.
  if (raw.includes('1004d') || raw.includes('recertif') || raw.includes('completion cert')) return 'DESKTOP_APPRAISAL';
  if (raw.includes('desktop')) return 'DESKTOP_APPRAISAL';
  if (raw.includes('field review')) return 'FIELD_REVIEW';
  if (raw.includes('desk review')) return 'DESK_REVIEW';
  if (raw.includes('2055') || raw.includes('drive') || raw.includes('exterior')) return 'EXTERIOR_ONLY';
  if (raw.includes('bpo')) return 'BPO';
  if (raw.includes('condo') || raw.includes('1073')) return 'CONDO_APPRAISAL';
  if (raw.includes('1025') || raw.includes('multi-family') || raw.includes('multifamily')) return 'FULL_APPRAISAL';
  if (raw.includes('1004') || raw.includes('appraisal')) return 'FULL_APPRAISAL';

  throw new Error(
    `Unable to map vendor product to internal productType for vendorOrderId=${vendorOrderId}. ` +
    `Received product=${JSON.stringify(product)}. ` +
    `Add an explicit mapping via PATCH /api/vendor-integrations/connections/:id ` +
    `with { "productMappings": { "${product.id}": "<ProductType>" } }.`,
  );
}

/**
 * Maps ALL products in the inbound vendor payload to VendorOrderSpec[]. Each
 * product becomes one VendorOrder under the same ClientOrder. For single-
 * product orders this is a 1-element array — identical to the prior behaviour.
 */
function mapAllProductSpecs(
  products: VendorOrderReceivedPayload['products'],
  vendorOrderId: string,
  specialInstructions?: string,
  productMappings?: Record<string, string>,
): { primaryProductType: string; specs: VendorOrderSpec[] } {
  if (products.length === 0) {
    throw new Error(`At least one vendor product is required to create order reference for vendorOrderId=${vendorOrderId}`);
  }

  const specs: VendorOrderSpec[] = products.map((p) => ({
    vendorWorkType: mapSingleProductType(p, vendorOrderId, productMappings) as ProductType,
    ...(specialInstructions ? { instructions: specialInstructions } : {}),
  }));

  // Non-null assertion: length > 0 checked above.
  return { primaryProductType: specs[0]!.vendorWorkType as string, specs };
}

function normalizeLoanPurpose(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('cash')) return 'cash_out_refinance';
  if (normalized.includes('construct')) return 'construction';
  if (normalized.includes('equity')) return 'equity_line';
  if (normalized.includes('refi')) return 'refinance';
  if (normalized.includes('purchase')) return 'purchase';
  return normalized;
}

function normalizeLoanType(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('conv')) return 'conventional';
  if (normalized.includes('fha')) return 'fha';
  if (normalized.includes('va')) return 'va';
  if (normalized.includes('usda')) return 'usda';
  if (normalized.includes('jumbo')) return 'jumbo';
  if (normalized.includes('portfolio')) return 'portfolio';
  if (normalized.includes('private')) return 'private';
  return normalized;
}

function normalizeOccupancy(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('owner')) return 'owner_occupied';
  if (normalized.includes('second')) return 'second_home';
  if (normalized.includes('invest')) return 'investment';
  if (normalized.includes('vacant')) return 'vacant';
  return normalized;
}

export class VendorOrderReferenceService {
  private readonly logger = new Logger('VendorOrderReferenceService');
  private readonly db: Pick<CosmosDbService, 'queryItems'>;
  private readonly engagementService: EngagementService;
  private readonly clientOrderService: ClientOrderService;
  private readonly decompositionService: OrderDecompositionService;
  private readonly orchestratorRef: (() => VendorAssignmentTrigger | undefined) | undefined;

  constructor(
    db?: Pick<CosmosDbService, 'queryItems'>,
    engagementService?: EngagementService,
    clientOrderService?: ClientOrderService,
    /**
     * Lazy getter for the auto-assignment orchestrator. Called after a VendorOrder
     * is created to trigger vendor matching. Optional — if absent (or if the
     * getter returns undefined) vendor matching is not triggered and a warning
     * is logged. Non-fatal per design: the order is already persisted.
     */
    orchestratorRef?: () => VendorAssignmentTrigger | undefined,
    decompositionService?: OrderDecompositionService,
  ) {
    const cosmosDb = new CosmosDbService();
    this.db = db ?? cosmosDb;
    this.engagementService =
      engagementService ?? new EngagementService(cosmosDb, new PropertyRecordService(cosmosDb));
    this.clientOrderService = clientOrderService ?? new ClientOrderService(cosmosDb);
    this.decompositionService = decompositionService ?? new OrderDecompositionService(cosmosDb);
    this.orchestratorRef = orchestratorRef;
  }

  /**
   * Map all products in the inbound vendor payload to VendorOrderSpec[].
   *
   * For each product:
   *   1. Map the AIM-Port product ID / name to our internal ProductType.
   *   2. Look up the OrderDecompositionRule for (tenantId, clientId, productType).
   *   3. If a rule exists, use its composed templates as the specs for that product.
   *   4. If NO rule exists, fall back to a single 1-to-1 spec
   *      (vendorWorkType = productType).  This preserves day-one zero-rules
   *      behaviour and means every inbound order still creates at least one
   *      VendorOrder even before any decomposition rules are seeded.
   *
   * `primaryProductType` is the productType of the first product — used to
   * stamp the ClientOrder.productType field.
   */
  private async composeAllProductSpecs(
    products: VendorOrderReceivedPayload['products'],
    vendorOrderId: string,
    tenantId: string,
    clientId: string,
    specialInstructions?: string,
    productMappings?: Record<string, string>,
  ): Promise<{ primaryProductType: string; specs: VendorOrderSpec[] }> {
    if (products.length === 0) {
      throw new Error(
        `At least one vendor product is required to create order reference for vendorOrderId=${vendorOrderId}`,
      );
    }

    const allSpecs: VendorOrderSpec[] = [];

    for (const product of products) {
      const productType = mapSingleProductType(product, vendorOrderId, productMappings) as ProductType;

      const templates = await this.decompositionService.compose(tenantId, clientId, productType);

      if (templates.length > 0) {
        // Rule found — use the composed templates (potentially multiple VendorOrders
        // with different vendorWorkType, dependsOn, templateKey, etc.).
        this.logger.debug('Decomposition rule applied for inbound product', {
          vendorOrderId,
          productType,
          templateCount: templates.length,
        });
        allSpecs.push(...templates.map((t) => ({
          ...t,
          // Merge special instructions from the order unless the template
          // already has its own explicit instructions.
          ...(specialInstructions && !t.instructions ? { instructions: specialInstructions } : {}),
        })));
      } else {
        // No rule — fall back to 1-to-1 (vendorWorkType equals productType).
        this.logger.debug('No decomposition rule found for inbound product — using 1-to-1 fallback', {
          vendorOrderId,
          productType,
        });
        allSpecs.push({
          vendorWorkType: productType,
          ...(specialInstructions ? { instructions: specialInstructions } : {}),
        });
      }
    }

    // Non-null assertion safe: length > 0 checked above.
    const primaryProductType = mapSingleProductType(products[0]!, vendorOrderId, productMappings);
    return { primaryProductType, specs: allSpecs };
  }

  async createOrGetOrderReference(
    connection: VendorConnection,
    event: VendorDomainEvent,
  ): Promise<VendorOrderReference> {
    const payload = asOrderPayload(event);

    const existing = await this.findExistingOrderReference(connection, event);
    if (existing) {
      return {
        orderId: existing.vendorOrderId,
        orderNumber: existing.vendorOrderNumber ?? existing.vendorOrderId,
        existed: true,
      };
    }

    const dueDate = payload.dueDate
      ? ensureIsoDate(payload.dueDate, 'payload.dueDate', event.vendorOrderId)
      : (() => {
          // AIM Port does not always supply due_date on OrderRequest.
          // Default to T+10 business days from receipt so internal order
          // creation can proceed. The lender should update the due date
          // if a different deadline applies.
          const fallback = addBusinessDays(new Date(), 10);
          this.logger.warn(
            'Inbound OrderRequest missing due_date — defaulting to T+10 business days',
            { vendorOrderId: event.vendorOrderId, defaultDueDate: fallback.toISOString() },
          );
          return fallback.toISOString();
        })();
    const { primaryProductType: productType, specs: vendorOrderSpecs } = await this.composeAllProductSpecs(
      payload.products,
      event.vendorOrderId,
      connection.tenantId,
      connection.lenderId,
      payload.specialInstructions,
      connection.productMappings,
    );

    // Pre-compute normalized optionals so TypeScript can narrow them properly
    // under exactOptionalPropertyTypes rather than inferring `string | undefined`
    // inside the spread expression.
    const normalizedLoanType = normalizeLoanType(payload.loanType);
    const normalizedLoanPurpose = normalizeLoanPurpose(payload.loanPurpose);

    // Build the engagement request. Property address is the anchor; loan info
    // is purely informational metadata on the EngagementProperty.
    const engagement: Engagement = await this.engagementService.createEngagement({
      tenantId: connection.tenantId,
      createdBy: `vendor:${connection.vendorType}`,
      client: {
        clientId: connection.lenderId,
        clientName: connection.lenderName,
      },
      priority: payload.rush ? OrderPriority.RUSH : OrderPriority.ROUTINE,
      clientDueDate: dueDate,
      ...(payload.specialInstructions ? { specialInstructions: payload.specialInstructions } : {}),
      properties: [
        {
          property: {
            address: payload.address,
            city: payload.city,
            state: payload.state,
            zipCode: payload.zipCode,
            county: payload.county ?? '',
            propertyType: payload.propertyType ?? '',
          } as Parameters<EngagementService['createEngagement']>[0]['properties'][0]['property'],
          loanReferences: (payload.loanNumber
            ? [
                {
                  loanNumber: payload.loanNumber,
                  ...(payload.loanAmount !== undefined ? { loanAmount: payload.loanAmount } : {}),
                  ...(normalizedLoanType !== undefined ? { loanType: normalizedLoanType } : {}),
                  ...(normalizedLoanPurpose !== undefined ? { loanPurpose: normalizedLoanPurpose } : {}),
                },
              ]
            : []) as import('../../types/engagement.types.js').LoanReference[],
          // Deprecated scalar kept in sync with loanReferences[0] per slice 8d
          loanNumber: payload.loanNumber ?? '',
          borrowerName: payload.borrower.name,
          borrowerEmail: payload.borrower.email ?? undefined,
          clientOrders: [
            {
              productType: productType as ProductType,
              ...(payload.specialInstructions ? { instructions: payload.specialInstructions } : {}),
              ...(payload.disclosedFee !== undefined ? { fee: payload.disclosedFee } : {}),
              dueDate,
            },
          ],
        },
      ],
    });

    const engagementProperty = engagement.properties[0];
    if (!engagementProperty) {
      throw new Error(
        `createEngagement returned no properties for vendorOrderId=${event.vendorOrderId}`,
      );
    }

    const engagementClientOrder = engagementProperty.clientOrders[0];
    if (!engagementClientOrder) {
      throw new Error(
        `createEngagement returned no client orders for vendorOrderId=${event.vendorOrderId}`,
      );
    }

    // Place the ClientOrder + VendorOrder atomically via placeClientOrder.
    // We pass clientOrderId = engagementClientOrder.id so that the persisted
    // ClientOrder doc stays aligned with the embedded EngagementClientOrder.
    // createEngagement fires enrichAndPlaceClientOrders fire-and-forget; by the
    // time that reaches Cosmos, we will already have the doc with this ID and it
    // will get a 409 conflict — which the fire-and-forget path swallows as a
    // non-fatal warning. Using placeClientOrder (instead of addVendorOrders)
    // avoids the race where addVendorOrders cannot find the ClientOrder because
    // the fire-and-forget hasn't persisted it yet.
    const { vendorOrders } = await this.clientOrderService.placeClientOrder(
      {
        clientOrderId: engagementClientOrder.id,
        tenantId: connection.tenantId,
        createdBy: `vendor:${connection.vendorType}`,
        engagementId: engagement.id,
        engagementPropertyId: engagementProperty.id,
        clientId: connection.lenderId,
        productType: productType as ProductType,
        // propertyId is set by EngagementService.buildLoan after PropertyRecord resolution.
        // Passing it here satisfies placeClientOrder's propertyId|propertyDetails guard.
        ...(engagementProperty.propertyId !== undefined ? { propertyId: engagementProperty.propertyId } : {}),
        propertyAddress: {
          street: payload.address,
          streetAddress: payload.address,
          city: payload.city,
          state: payload.state,
          zipCode: payload.zipCode,
          county: payload.county ?? '',
        },
        borrowerInfo: {
          name: payload.borrower.name,
          email: payload.borrower.email ?? '',
          phone: payload.borrower.phone ?? '',
        },
        loanInformation: {
          loanNumber: payload.loanNumber ?? '',
          loanAmount: payload.loanAmount ?? 0,
          loanType: normalizeLoanType(payload.loanType),
          occupancyType: normalizeOccupancy(payload.occupancy),
          purpose: normalizeLoanPurpose(payload.loanPurpose),
        },
        rushOrder: payload.rush,
        dueDate,
        metadata: {
          vendorIntegration: {
            connectionId: connection.id,
            inboundIdentifier: connection.inboundIdentifier,
            lenderId: connection.lenderId,
            vendorType: connection.vendorType,
            vendorOrderId: event.vendorOrderId,
            receivedAt: event.occurredAt,
            clientName: payload.clientName,
            productIds: payload.products.map((product) => product.id),
          },
        },
      } as any,
      vendorOrderSpecs,
    );

    const vendorOrder = vendorOrders[0];
    if (!vendorOrder) {
      throw new Error(
        `placeClientOrder returned no vendor orders for vendorOrderId=${event.vendorOrderId}`,
      );
    }

    this.logger.info('Created engagement + vendor order reference for inbound vendor order', {
      connectionId: connection.id,
      vendorType: connection.vendorType,
      vendorOrderId: event.vendorOrderId,
      engagementId: engagement.id,
      engagementPropertyId: engagementProperty.id,
      clientOrderId: engagementClientOrder.id,
      vendorOrderCount: vendorOrders.length,
      vendorOrderDbIds: vendorOrders.map((vo) => vo.id),
    });

    // Trigger auto vendor-matching for every created VendorOrder.
    // Fire-and-forget: the ACK has already been committed — matching failures
    // must not roll back the order. The orchestrator is optional at startup;
    // if absent, log a warning and continue.
    const orchestrator = this.orchestratorRef?.();
    if (orchestrator) {
      const dueDateObj = new Date(dueDate);
      const priority: 'STANDARD' | 'RUSH' | 'EMERGENCY' = payload.rush ? 'RUSH' : 'STANDARD';
      const propertyAddressText = [
        payload.address,
        payload.city,
        payload.state,
        payload.zipCode,
      ].filter(Boolean).join(', ');

      for (const vo of vendorOrders) {
        const triggerParams = {
          orderId: vo.id,
          orderNumber: (vo as any).orderNumber ?? vo.id,
          tenantId: connection.tenantId,
          engagementId: engagement.id,
          productType: (vo as any).productType ?? (vo as any).vendorWorkType ?? productType,
          propertyAddress: propertyAddressText,
          propertyState: payload.state,
          clientId: connection.lenderId,
          loanAmount: payload.loanAmount ?? 0,
          priority,
          dueDate: dueDateObj,
        };
        orchestrator.triggerVendorAssignment(triggerParams).catch((err) => {
          this.logger.warn('triggerVendorAssignment failed for inbound vendor order — matching will need manual trigger', {
            orderId: vo.id,
            vendorOrderId: event.vendorOrderId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    } else {
      this.logger.warn(
        'Auto-assignment orchestrator not available — vendor matching not triggered for inbound order',
        {
          vendorOrderId: event.vendorOrderId,
          vendorOrderCount: vendorOrders.length,
        },
      );
    }

    return {
      orderId: vendorOrder.id,
      orderNumber: (vendorOrder as any).orderNumber ?? vendorOrder.id,
      existed: false,
    };
  }

  private async findExistingOrderReference(
    connection: VendorConnection,
    event: VendorDomainEvent,
  ): Promise<ExistingOrderReference | null> {
    // Query VendorOrders (type='order' in 'orders' container) that carry the
    // vendor integration metadata stamped by addVendorOrders. This covers both
    // new engagement-routed orders and any future replay scenarios.
    const result = await this.db.queryItems<{
      id: string;
      orderNumber?: string;
      engagementId?: string;
      engagementPropertyId?: string;
      engagementClientOrderId?: string;
    }>(
      'orders',
      [
        'SELECT TOP 1 c.id, c.orderNumber, c.engagementId, c.engagementPropertyId, c.engagementClientOrderId',
        'FROM c',
        'WHERE c.tenantId = @tenantId',
        'AND c.metadata.vendorIntegration.connectionId = @connectionId',
        'AND c.metadata.vendorIntegration.vendorType = @vendorType',
        'AND c.metadata.vendorIntegration.vendorOrderId = @vendorOrderId',
      ].join(' '),
      [
        { name: '@tenantId', value: connection.tenantId },
        { name: '@connectionId', value: connection.id },
        { name: '@vendorType', value: connection.vendorType },
        { name: '@vendorOrderId', value: event.vendorOrderId },
      ],
    );

    if (!result.success) {
      throw new Error(
        result.error?.message ??
          `Failed to query existing vendor order reference for vendorOrderId=${event.vendorOrderId}`,
      );
    }

    const row = result.data?.[0];
    if (!row) return null;

    if (!row.engagementId || !row.engagementClientOrderId) {
      // Legacy orphan order created before engagement-primacy migration.
      // Log a warning and treat as non-existent so the proper pipeline runs.
      this.logger.warn(
        'Found existing order for vendor order id but it is missing engagement ancestry — treating as new',
        {
          vendorOrderId: event.vendorOrderId,
          orderId: row.id,
          hasEngagementId: !!row.engagementId,
          hasEngagementClientOrderId: !!row.engagementClientOrderId,
        },
      );
      return null;
    }

    return {
      engagementId: row.engagementId,
      clientOrderId: row.engagementClientOrderId,
      vendorOrderId: row.id,
      vendorOrderNumber: row.orderNumber ?? undefined,
    };
  }
}
