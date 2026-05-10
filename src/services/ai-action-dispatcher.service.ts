import type {
  DatabaseOrderRepository,
  DatabasePropertyRepository,
  DatabaseVendorRepository,
} from './database.service.js';
import { DatabaseService } from './database.service.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { OrderManagementService } from './order-management.service.js';
import { VendorManagementService } from './vendor-management.service.js';
import { NotificationService } from './notification.service.js';
import { AuditService } from './audit.service.js';
import { Logger } from '../utils/logger.js';
import { EngagementService } from './engagement.service.js';
import { PropertyRecordService } from './property-record.service.js';
import { AutoAssignmentOrchestratorService } from './auto-assignment-orchestrator.service.js';
import { ClientOrderService } from './client-order.service.js';
import type { OrderFilters } from '../types/index.js';
import type { VendorOrder as Order } from '../types/vendor-order.types.js';
import {
  OrderContextLoader,
  getPropertyAddress,
  getLoanInformation,
  getDueDate,
  type OrderContext,
} from './order-context-loader.service.js';
import type { CreateEngagementRequest } from '../types/engagement.types.js';

type RecordValue = Record<string, unknown>;

export interface AiActionExecutionContext {
  tenantId: string;
  userId: string;
}

export interface AiActionDispatchResult {
  message: string;
  data?: Record<string, unknown>;
}

export class AiActionDispatchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AiActionDispatchError';
  }
}

export interface AiActionDispatcherDependencies {
  orderService?: Pick<OrderManagementService, 'createOrder' | 'assignOrderToVendor'>;
  engagementService?: Pick<EngagementService, 'createEngagement'>;
  autoAssignmentOrchestrator?: Pick<AutoAssignmentOrchestratorService, 'triggerVendorAssignment'>;
}

class CosmosOrderRepository implements DatabaseOrderRepository {
  constructor(private readonly dbService: CosmosDbService) {}

  async create(order: Order): Promise<Order> {
    return this.dbService.createDocument<Order>('orders', {
      ...(order as Order & Record<string, unknown>),
      type: 'order',
    } as Order & { type: 'order' });
  }

  async findById(id: string): Promise<Order | null> {
    const result = await this.dbService.findOrderById(id);
    if (!result.success) {
      throw new Error(result.error?.message ?? `Failed to load order '${id}'`);
    }
    return result.data ?? null;
  }

  async findMany(filters: OrderFilters, offset: number, limit: number): Promise<{ orders: Order[]; total: number }> {
    const result = await this.dbService.findOrders(filters, offset, limit);
    if (!result.success) {
      throw new Error(result.error?.message ?? 'Failed to load orders');
    }
    return {
      orders: result.data ?? [],
      total: Number(result.metadata?.total ?? (result.data?.length ?? 0)),
    };
  }

  async update(id: string, order: Order): Promise<Order> {
    const result = await this.dbService.updateOrder(id, order);
    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? `Failed to update order '${id}'`);
    }
    return result.data;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      return;
    }
    const result = await this.dbService.deleteOrder(id, existing.tenantId);
    if (!result.success) {
      throw new Error(result.error?.message ?? `Failed to delete order '${id}'`);
    }
  }
}

class UnsupportedVendorRepository implements DatabaseVendorRepository {
  async create(): Promise<never> { throw new Error('Vendor repository is not used by AI action dispatcher'); }
  async findById(): Promise<null> { throw new Error('Vendor repository is not used by AI action dispatcher'); }
  async findMany(): Promise<{ vendors: []; total: 0 }> { throw new Error('Vendor repository is not used by AI action dispatcher'); }
  async update(): Promise<never> { throw new Error('Vendor repository is not used by AI action dispatcher'); }
  async delete(): Promise<void> { throw new Error('Vendor repository is not used by AI action dispatcher'); }
}

class UnsupportedPropertyRepository implements DatabasePropertyRepository {
  async create(): Promise<never> { throw new Error('Property repository is not used by AI action dispatcher'); }
  async findById(): Promise<null> { throw new Error('Property repository is not used by AI action dispatcher'); }
  async findMany(): Promise<{ properties: []; total: 0 }> { throw new Error('Property repository is not used by AI action dispatcher'); }
  async update(): Promise<never> { throw new Error('Property repository is not used by AI action dispatcher'); }
  async delete(): Promise<void> { throw new Error('Property repository is not used by AI action dispatcher'); }
  async count(): Promise<number> { throw new Error('Property repository is not used by AI action dispatcher'); }
}

class CosmosBackedOrderDatabaseService extends DatabaseService {
  constructor(dbService: CosmosDbService) {
    super();
    this.orders = new CosmosOrderRepository(dbService);
    this.vendors = new UnsupportedVendorRepository();
    this.properties = new UnsupportedPropertyRepository();
  }
}

function asRecord(payload: unknown, intent: string): RecordValue {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AiActionDispatchError(`${intent} requires an object payload.`);
  }
  return payload as RecordValue;
}

function getString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AiActionDispatchError(`${fieldName} is required and must be a non-empty string.`);
  }
  return value.trim();
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    throw new AiActionDispatchError(`${fieldName} is required and must be a non-empty string array.`);
  }
  return value.map((item) => item.trim());
}

function getDate(value: unknown, fieldName: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  throw new AiActionDispatchError(`${fieldName} must be a valid ISO-8601 date/time value.`);
}

function getNumber(value: unknown, fieldName: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw new AiActionDispatchError(`${fieldName} must be a valid number.`);
}

function normalizePropertyAddress(payload: RecordValue): Record<string, unknown> {
  const propertyAddress = asRecord(payload.propertyAddress, 'CREATE_ORDER propertyAddress');
  return {
    ...propertyAddress,
    streetAddress: getString(propertyAddress.streetAddress ?? propertyAddress.street, 'propertyAddress.streetAddress'),
    city: getString(propertyAddress.city, 'propertyAddress.city'),
    state: getString(propertyAddress.state, 'propertyAddress.state'),
    zipCode: getString(propertyAddress.zipCode ?? propertyAddress.zip, 'propertyAddress.zipCode'),
    county: getOptionalString(propertyAddress.county) ?? '',
  };
}

function formatOrderAddress(ctx: OrderContext): string {
  const address = getPropertyAddress(ctx);
  if (!address) return '';
  const street = getOptionalString(address.streetAddress) ?? '';
  const city = getOptionalString(address.city) ?? '';
  const state = getOptionalString(address.state) ?? '';
  const zipCode = getOptionalString(address.zipCode) ?? '';
  return `${street}, ${city} ${state} ${zipCode}`.trim();
}

function normalizeDispatcherError(error: unknown, fallbackMessage: string): AiActionDispatchError {
  if (error instanceof AiActionDispatchError) {
    return error;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const statusCode = /required|must be|not found|cannot assign/i.test(message) ? 400 : 500;
  return new AiActionDispatchError(message, statusCode);
}

function mapAutoAssignmentPriority(priority: Order['priority']): 'STANDARD' | 'RUSH' | 'EMERGENCY' {
  if (priority === 'urgent') {
    return 'EMERGENCY';
  }
  if (priority === 'rush') {
    return 'RUSH';
  }
  return 'STANDARD';
}

export class AiActionDispatcherService {
  private readonly logger = new Logger('AiActionDispatcherService');
  private readonly orderService: Pick<OrderManagementService, 'createOrder' | 'assignOrderToVendor'>;
  private readonly engagementService: Pick<EngagementService, 'createEngagement'>;
  private readonly autoAssignmentOrchestrator: Pick<AutoAssignmentOrchestratorService, 'triggerVendorAssignment'>;
  private readonly contextLoader: OrderContextLoader;
  private readonly clientOrderService: ClientOrderService;

  constructor(
    private readonly dbService: CosmosDbService,
    dependencies: AiActionDispatcherDependencies = {},
  ) {
    this.orderService = dependencies.orderService ?? this.createOrderService(dbService);
    this.engagementService = dependencies.engagementService ??
      new EngagementService(dbService, new PropertyRecordService(dbService));
    this.autoAssignmentOrchestrator = dependencies.autoAssignmentOrchestrator ??
      new AutoAssignmentOrchestratorService(dbService);
    this.contextLoader = new OrderContextLoader(dbService);
    this.clientOrderService = new ClientOrderService(dbService);
  }

  async handleCreateOrder(payload: unknown, context: AiActionExecutionContext): Promise<AiActionDispatchResult> {
    try {
      const requestPayload = asRecord(payload, 'CREATE_ORDER');
      // Phase B step 7: AI-driven order creation must carry the full engagement
      // hierarchy: engagementId + engagementPropertyId + clientOrderId. The AI
      // tool's contract requires the model to first call CREATE_ENGAGEMENT
      // (or look up an existing engagement), then choose which embedded
      // clientOrder this VendorOrder fulfills. getString throws
      // AiActionDispatchError when a required field is missing — that bubbles
      // up as a structured 400 to the AI runtime, giving the model a clear
      // correction signal.
      //
      // (Note: AI tool schema must be updated in lockstep — the prompt should
      // expose engagementPropertyId + clientOrderId on the CREATE_ORDER tool.)
      const tenantId = context.tenantId;
      const engagementId = getString(requestPayload.engagementId, 'engagementId');
      const canonicalPropertyId = getString(
        requestPayload.propertyId ?? requestPayload.engagementPropertyId,
        'propertyId',
      );
      const clientOrderId = getString(
        requestPayload.clientOrderId ?? requestPayload.engagementClientOrderId,
        'clientOrderId',
      );
      const { propertyAddress: _propertyAddress, ...requestPayloadWithoutAddress } = requestPayload;
      const inheritedFields = {
        ...requestPayloadWithoutAddress,
        propertyId: canonicalPropertyId,
        clientId: getString(requestPayload.clientId, 'clientId'),
        engagementId,
        engagementPropertyId: getString(requestPayload.engagementPropertyId, 'engagementPropertyId'),
        engagementClientOrderId: clientOrderId,
        clientOrderId,
        orderType: getString(requestPayload.orderType, 'orderType'),
        productType: getString(requestPayload.productType, 'productType'),
        dueDate: getDate(requestPayload.dueDate, 'dueDate'),
        tenantId,
        createdBy: context.userId,
        ...(requestPayload.propertyAddress != null && !requestPayload.propertyId
          ? { propertyAddress: normalizePropertyAddress(requestPayload) }
          : {}),
      };

      const vendorOrderSpec = {
        vendorWorkType: inheritedFields.productType as never,
      };

      let createdVendorOrders;
      try {
        createdVendorOrders = await this.clientOrderService.addVendorOrders(
          clientOrderId,
          tenantId,
          [vendorOrderSpec],
          inheritedFields as never,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'addVendorOrders failed';
        throw new AiActionDispatchError(`Failed to create order: ${msg}`, 500);
      }

      if (createdVendorOrders.length === 0) {
        throw new AiActionDispatchError('addVendorOrders returned no rows.', 500);
      }
      const created = createdVendorOrders[0]!;

      return {
        message: `Order ${created.orderNumber} created successfully.`,
        data: {
          orderId: created.id,
          orderNumber: created.orderNumber,
          status: created.status,
        },
      };
    } catch (error) {
      throw normalizeDispatcherError(error, 'Failed to create order.');
    }
  }

  async handleCreateEngagement(payload: unknown, context: AiActionExecutionContext): Promise<AiActionDispatchResult> {
    try {
      const requestPayload = asRecord(payload, 'CREATE_ENGAGEMENT');
      const createRequest: CreateEngagementRequest = {
        ...(requestPayload as unknown as Omit<CreateEngagementRequest, 'tenantId' | 'createdBy'>),
        tenantId: context.tenantId,
        createdBy: context.userId,
      };

      const engagement = await this.engagementService.createEngagement(createRequest);
      return {
        message: `Engagement ${engagement.engagementNumber} created successfully.`,
        data: {
          engagementId: engagement.id,
          engagementNumber: engagement.engagementNumber,
          engagementType: engagement.engagementType,
          loanCount: engagement.properties.length,
        },
      };
    } catch (error) {
      throw normalizeDispatcherError(error, 'Failed to create engagement.');
    }
  }

  async handleTriggerAutoAssignment(payload: unknown, context: AiActionExecutionContext): Promise<AiActionDispatchResult> {
    const requestPayload = asRecord(payload, 'TRIGGER_AUTO_ASSIGNMENT');
    const orderIds = getStringArray(requestPayload.orderIds, 'orderIds');

    const results = await Promise.all(orderIds.map(async (orderId) => {
      try {
        const orderResult = await this.dbService.findOrderById(orderId);
        if (!orderResult.success) {
          throw new AiActionDispatchError(orderResult.error?.message ?? `Failed to load order '${orderId}'.`, 500);
        }
        const order = orderResult.data;
        if (!order) {
          throw new AiActionDispatchError(`Order '${orderId}' was not found.`, 400);
        }
        if (order.tenantId !== context.tenantId) {
          throw new AiActionDispatchError(`Order '${orderId}' does not belong to tenant '${context.tenantId}'.`, 400);
        }
        if ((order as Order & { autoVendorAssignment?: { status?: string } }).autoVendorAssignment?.status === 'ACCEPTED') {
          throw new AiActionDispatchError(
            `Order '${orderId}' already has an accepted vendor assignment; re-trigger is not allowed.`,
            400,
          );
        }

        // Phase 7: load joined OrderContext so propertyAddress / loanAmount
        // / dueDate / orderType resolve from the parent ClientOrder when
        // present (engagement-flow rows don't carry them on the VendorOrder).
        const ctx = await this.contextLoader.loadByVendorOrder(order, { includeProperty: true });
        await this.autoAssignmentOrchestrator.triggerVendorAssignment({
          orderId: order.id,
          orderNumber: order.orderNumber ?? '',
          tenantId: context.tenantId,
          engagementId: order.engagementId ?? order.id,
          productType: String(order.productType ?? ctx.clientOrder?.orderType ?? order.orderType ?? ''),
          propertyAddress: formatOrderAddress(ctx),
          propertyState: getString(getPropertyAddress(ctx)?.state, `order '${orderId}' propertyAddress.state`),
          clientId: getString(order.clientId, `order '${orderId}' clientId`),
          loanAmount: getNumber(getLoanInformation(ctx)?.loanAmount ?? 0, `order '${orderId}' loanInformation.loanAmount`),
          priority: mapAutoAssignmentPriority(order.priority),
          dueDate: getDate(getDueDate(ctx), `order '${orderId}' dueDate`),
          ...(getOptionalString((order as unknown as { productId?: unknown }).productId)
            ? { productId: getOptionalString((order as unknown as { productId?: unknown }).productId)! }
            : {}),
          ...(Array.isArray((order as unknown as { requiredCapabilities?: unknown }).requiredCapabilities)
            ? {
                requiredCapabilities: ((order as unknown as { requiredCapabilities?: unknown[] }).requiredCapabilities ?? [])
                  .filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
              }
            : {}),
        });

        return { orderId, success: true as const };
      } catch (error) {
        const normalized = normalizeDispatcherError(error, `Failed to trigger auto-assignment for order '${orderId}'.`);
        this.logger.warn('AI auto-assignment dispatch failed', { orderId, error: normalized.message });
        return { orderId, success: false as const, error: normalized.message };
      }
    }));

    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.length - successCount;

    return {
      message: failureCount === 0
        ? `Triggered auto-assignment for ${successCount} order(s).`
        : `Triggered auto-assignment for ${successCount} order(s); ${failureCount} failed.`,
      data: {
        successCount,
        failureCount,
        results,
      },
    };
  }

  async handleAssignVendor(payload: unknown, context: AiActionExecutionContext): Promise<AiActionDispatchResult> {
    const requestPayload = asRecord(payload, 'ASSIGN_VENDOR');
    const vendorId = getString(requestPayload.vendorId ?? requestPayload.appraiserId, 'vendorId');
    const orderIds = Array.isArray(requestPayload.orderIds)
      ? getStringArray(requestPayload.orderIds, 'orderIds')
      : [getString(requestPayload.orderId, 'orderId')];

    const results = await Promise.all(orderIds.map(async (orderId) => {
      try {
        const result = await this.orderService.assignOrderToVendor(orderId, vendorId, context.userId);
        if (!result.success || !result.data) {
          throw new AiActionDispatchError(result.error?.message ?? `Failed to assign vendor for order '${orderId}'.`, 500);
        }
        return {
          orderId,
          success: true as const,
          status: result.data.status,
          assignedVendorId: result.data.assignedVendorId,
        };
      } catch (error) {
        const normalized = normalizeDispatcherError(error, `Failed to assign vendor for order '${orderId}'.`);
        this.logger.warn('AI vendor assignment failed', { orderId, vendorId, error: normalized.message });
        return { orderId, success: false as const, error: normalized.message };
      }
    }));

    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.length - successCount;

    return {
      message: failureCount === 0
        ? `Assigned vendor '${vendorId}' to ${successCount} order(s).`
        : `Assigned vendor '${vendorId}' to ${successCount} order(s); ${failureCount} failed.`,
      data: {
        vendorId,
        successCount,
        failureCount,
        results,
      },
    };
  }

  private createOrderService(dbService: CosmosDbService): OrderManagementService {
    return new OrderManagementService(
      new CosmosBackedOrderDatabaseService(dbService),
      new VendorManagementService(dbService),
      new NotificationService(),
      new AuditService(),
      new Logger('AiActionDispatcherOrderService'),
    );
  }
}