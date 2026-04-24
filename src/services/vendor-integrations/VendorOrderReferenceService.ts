import { CosmosDbService } from '../cosmos-db.service.js';
import { Logger } from '../../utils/logger.js';
import { OrderStatus } from '../../types/order-status.js';
import type {
  VendorConnection,
  VendorDomainEvent,
  VendorOrderReceivedPayload,
  VendorOrderReference,
} from '../../types/vendor-integration.types.js';

interface ExistingOrderReference {
  id: string;
  orderNumber?: string;
}

const ORDERS_CONTAINER = 'orders';

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

function buildOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `VND-${date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function mapProductType(products: VendorOrderReceivedPayload['products'], vendorOrderId: string): string {
  const firstProduct = products[0];
  if (!firstProduct) {
    throw new Error(`At least one vendor product is required to create order reference for vendorOrderId=${vendorOrderId}`);
  }

  const raw = `${firstProduct.name ?? ''} ${firstProduct.id}`.trim().toLowerCase();
  if (raw.includes('desktop')) return 'DESKTOP_APPRAISAL';
  if (raw.includes('2055') || raw.includes('drive') || raw.includes('exterior')) return 'EXTERIOR_ONLY';
  if (raw.includes('bpo')) return 'BPO';
  if (raw.includes('1004') || raw.includes('1073') || raw.includes('appraisal')) return 'FULL_APPRAISAL';

  throw new Error(
    `Unable to map vendor product to internal productType for vendorOrderId=${vendorOrderId}. ` +
      `Received product=${JSON.stringify(firstProduct)}`,
  );
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
  private readonly db: Pick<CosmosDbService, 'queryItems' | 'createOrder'>;

  constructor(db?: Pick<CosmosDbService, 'queryItems' | 'createOrder'>) {
    this.db = db ?? new CosmosDbService();
  }

  async createOrGetOrderReference(
    connection: VendorConnection,
    event: VendorDomainEvent,
  ): Promise<VendorOrderReference> {
    const payload = asOrderPayload(event);

    const existing = await this.findExistingOrderReference(connection, event);
    if (existing) {
      return {
        orderId: existing.id,
        orderNumber: existing.orderNumber ?? existing.id,
        existed: true,
      };
    }

    const dueDate = ensureIsoDate(payload.dueDate, 'payload.dueDate', event.vendorOrderId);
    const orderNumber = buildOrderNumber();

    const createResult = await this.db.createOrder({
      orderNumber,
      tenantId: connection.tenantId,
      clientId: connection.lenderId,
      orderType: payload.orderType === 'commercial' ? 'other' : 'purchase',
      orderStatus: OrderStatus.NEW,
      priority: payload.rush ? 'rush' : 'normal',
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
      productType: mapProductType(payload.products, event.vendorOrderId),
      serviceLevel: payload.rush ? 'rush' : 'standard',
      dueDate,
      fee: payload.disclosedFee ?? 0,
      rushOrder: payload.rush,
      specialInstructions: payload.specialInstructions ?? '',
      assignedStaff: {
        coordinatorId: 'unassigned',
        coordinatorName: 'Unassigned Coordinator',
      },
      notes: `Vendor ${connection.vendorType} order ${event.vendorOrderId}`,
      tags: ['vendor-integration', `vendor:${connection.vendorType}`],
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
      createdBy: `vendor:${connection.vendorType}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      type: 'order',
    } as any);

    if (!createResult.success || !createResult.data?.id) {
      throw new Error(
        createResult.error?.message ??
          `Failed to create internal order reference for vendorOrderId=${event.vendorOrderId}`,
      );
    }

    this.logger.info('Created internal order reference for vendor order', {
      connectionId: connection.id,
      vendorType: connection.vendorType,
      vendorOrderId: event.vendorOrderId,
      orderId: createResult.data.id,
      orderNumber: (createResult.data as any).orderNumber,
    });

    return {
      orderId: createResult.data.id,
      orderNumber: (createResult.data as any).orderNumber ?? createResult.data.id,
      existed: false,
    };
  }

  private async findExistingOrderReference(
    connection: VendorConnection,
    event: VendorDomainEvent,
  ): Promise<ExistingOrderReference | null> {
    const result = await this.db.queryItems<ExistingOrderReference>(
      ORDERS_CONTAINER,
      [
        'SELECT TOP 1 c.id, c.orderNumber',
        'FROM c',
        'WHERE c.type = @type',
        'AND c.tenantId = @tenantId',
        'AND c.metadata.vendorIntegration.connectionId = @connectionId',
        'AND c.metadata.vendorIntegration.vendorType = @vendorType',
        'AND c.metadata.vendorIntegration.vendorOrderId = @vendorOrderId',
      ].join(' '),
      [
        { name: '@type', value: 'order' },
        { name: '@tenantId', value: connection.tenantId },
        { name: '@connectionId', value: connection.id },
        { name: '@vendorType', value: connection.vendorType },
        { name: '@vendorOrderId', value: event.vendorOrderId },
      ],
    );

    if (!result.success) {
      throw new Error(
        result.error?.message ??
          `Failed to query existing internal order for vendorOrderId=${event.vendorOrderId}`,
      );
    }

    return result.data?.[0] ?? null;
  }
}
