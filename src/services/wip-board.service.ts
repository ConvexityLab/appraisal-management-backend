/**
 * WIP Status Board Service (Phase 1.9)
 *
 * Aggregates orders by status category for a Kanban-style WIP board.
 * Uses the canonical OrderStatus enum and STATUS_CONFIG categories.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { OrderStatus, STATUS_CONFIG, getStatusesByCategory, getStatusLabel } from '../types/order-status.js';
import { VENDOR_ORDER_TYPE_PREDICATE } from '../types/vendor-order.types.js';
import { CLIENT_ORDERS_CONTAINER, type ClientOrder } from '../types/client-order.types.js';
import { PROPERTY_RECORDS_CONTAINER } from './property-record.service.js';
import type { PropertyRecord } from '../types/property-record.types.js';
import type { PropertyAddress } from '../types/index.js';

interface WipBoardOrderRow {
  id: string;
  orderNumber?: string;
  status: OrderStatus;
  propertyId?: string;
  clientOrderId?: string;
  propertyAddress?: string | PropertyAddress;
  clientName?: string;
  vendorName?: string;
  borrowerName?: string;
  borrower?: {
    lastName?: string;
  };
  productType?: string;
  dueDate?: string;
  isRush?: boolean;
  rush?: boolean;
  updatedAt: string;
  createdAt: string;
  vendorId?: string;
  clientId?: string;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type BoardCategory = 'intake' | 'assignment' | 'active' | 'review' | 'final';

export interface BoardColumn {
  category: BoardCategory;
  label: string;
  statuses: Array<{
    status: OrderStatus;
    label: string;
    count: number;
  }>;
  totalCount: number;
  /** SLA: orders overdue in this column */
  overdueCount: number;
}

export interface BoardOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  category: BoardCategory;
  /** Property address (short) */
  propertyAddress: string;
  /** Borrower last name */
  borrowerName: string;
  /** Client/lender name */
  clientName: string;
  /** Vendor/appraiser name (if assigned) */
  vendorName?: string;
  /** Product type */
  productType: string;
  /** SLA due date */
  dueDate?: string;
  /** Is past due? */
  isOverdue: boolean;
  /** Priority flag */
  isRush: boolean;
  /** Last updated */
  updatedAt: string;
  createdAt: string;
}

export interface WIPBoard {
  tenantId: string;
  generatedAt: string;
  columns: WIPColumn[];
  totalOrders: number;
  overdueOrders: number;
  /** Recently updated (last 24h) */
  recentlyUpdated: number;
  summary: {
    rushOrders: number;
    slaAtRisk: number;
    overdueCount: number;
  };
}

export interface WIPColumn {
  category: BoardCategory;
  label: string;
  count: number;
  /** Alias for count — total orders in this category column */
  totalCount: number;
  orders: WIPOrderCard[];
}

export interface WIPOrderCard {
  orderId: string;
  orderNumber: string;
  propertyAddress: string;
  clientName: string;
  vendorName?: string;
  productType: string;
  dueDate?: string;
  category: BoardCategory;
  isRush: boolean;
  daysInCategory: number;
  slaStatus: 'ok' | 'warning' | 'critical' | 'breach';
}

export interface BoardFilters {
  vendorId?: string;
  clientId?: string;
  productType?: string;
  isRush?: boolean;
  searchTerm?: string;
  categories?: BoardCategory[];
}

// ── Service ──────────────────────────────────────────────────────────────────

export class WIPBoardService {
  private logger: Logger;
  private dbService: CosmosDbService;

  private static readonly BOARD_CATEGORIES: BoardCategory[] = [
    'intake', 'assignment', 'active', 'review', 'final',
  ];

  private static readonly CATEGORY_LABELS: Record<BoardCategory, string> = {
    intake: 'Intake',
    assignment: 'Assignment',
    active: 'Active',
    review: 'Review',
    final: 'Final',
  };

  private static slaStatus(dueDateStr: string | undefined): 'ok' | 'warning' | 'critical' | 'breach' {
    if (!dueDateStr) return 'ok';
    const daysLeft = (new Date(dueDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft < 0) return 'breach';
    if (daysLeft <= 2) return 'critical';
    if (daysLeft <= 7) return 'warning';
    return 'ok';
  }

  private static daysAgo(dateStr: string | undefined): number {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('WIPBoardService');
  }

  private async loadClientOrderMap(
    tenantId: string,
    clientOrderIds: string[],
  ): Promise<Map<string, ClientOrder>> {
    if (clientOrderIds.length === 0) {
      return new Map();
    }

    const clientOrders = await this.dbService.queryDocuments<ClientOrder>(
      CLIENT_ORDERS_CONTAINER,
      'SELECT * FROM c WHERE c.tenantId = @tenantId AND ARRAY_CONTAINS(@clientOrderIds, c.id)',
      [
        { name: '@tenantId', value: tenantId },
        { name: '@clientOrderIds', value: clientOrderIds },
      ],
    );

    return new Map(clientOrders.map((order) => [order.id, order]));
  }

  private async loadPropertyRecordMap(
    tenantId: string,
    propertyIds: string[],
  ): Promise<Map<string, PropertyRecord>> {
    if (propertyIds.length === 0) {
      return new Map();
    }

    const properties = await this.dbService.queryDocuments<PropertyRecord>(
      PROPERTY_RECORDS_CONTAINER,
      'SELECT * FROM c WHERE c.tenantId = @tenantId AND ARRAY_CONTAINS(@propertyIds, c.id)',
      [
        { name: '@tenantId', value: tenantId },
        { name: '@propertyIds', value: propertyIds },
      ],
    );

    return new Map(properties.map((property) => [property.id, property]));
  }

  private async buildAddressContext(
    tenantId: string,
    rows: WipBoardOrderRow[],
  ): Promise<{
    clientOrders: Map<string, ClientOrder>;
    properties: Map<string, PropertyRecord>;
  }> {
    const clientOrderIds = Array.from(new Set(
      rows
        .map((row) => row.clientOrderId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ));

    const clientOrders = await this.loadClientOrderMap(tenantId, clientOrderIds);

    const propertyIds = Array.from(new Set(
      rows
        .map((row) => row.propertyId ?? (row.clientOrderId ? clientOrders.get(row.clientOrderId)?.propertyId : undefined))
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ));

    const properties = await this.loadPropertyRecordMap(tenantId, propertyIds);

    return { clientOrders, properties };
  }

  private resolveAddressText(
    row: WipBoardOrderRow,
    clientOrders: Map<string, ClientOrder>,
    properties: Map<string, PropertyRecord>,
  ): string {
    const propertyId = row.propertyId ?? (row.clientOrderId ? clientOrders.get(row.clientOrderId)?.propertyId : undefined);
    const property = propertyId ? properties.get(propertyId) : undefined;

    if (property) {
      return formatPropertyRecordAddress(property);
    }

    const clientOrder = row.clientOrderId ? clientOrders.get(row.clientOrderId) : undefined;
    if (clientOrder?.propertyAddress) {
      return formatPropertyAddress(clientOrder.propertyAddress);
    }

    if (typeof row.propertyAddress === 'string') {
      return row.propertyAddress;
    }

    return formatPropertyAddress(row.propertyAddress);
  }

  private resolveDisplayAddress(
    row: WipBoardOrderRow,
    clientOrders: Map<string, ClientOrder>,
    properties: Map<string, PropertyRecord>,
  ): string {
    const propertyId = row.propertyId ?? (row.clientOrderId ? clientOrders.get(row.clientOrderId)?.propertyId : undefined);
    const property = propertyId ? properties.get(propertyId) : undefined;

    if (property?.address?.street) {
      return property.address.street;
    }

    const clientOrder = row.clientOrderId ? clientOrders.get(row.clientOrderId) : undefined;
    const clientOrderStreet = clientOrder?.propertyAddress?.streetAddress;
    if (clientOrderStreet) {
      return clientOrderStreet;
    }

    if (typeof row.propertyAddress === 'string') {
      return row.propertyAddress;
    }

    return row.propertyAddress?.streetAddress ?? '';
  }

  /**
   * Get the full WIP board with all columns and order cards.
   */
  async getBoard(tenantId: string, filters?: BoardFilters): Promise<WIPBoard> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      return this.emptyBoard(tenantId);
    }

    // Build query with optional filters. The board now carries forward only
    // canonical join keys (`propertyId`, `clientOrderId`) and resolves the
    // display/search address after the query, instead of depending on the
    // deprecated embedded VendorOrder property blob.
    let query = `SELECT c.id, c.orderNumber, c.status, c.propertyId, c.clientOrderId, c.clientName, c.vendorName, c.productType, c.dueDate, c.isRush, c.rush, c.updatedAt, c.createdAt FROM c WHERE ${VENDOR_ORDER_TYPE_PREDICATE} AND c.tenantId = @tid`;
    const params: Array<{ name: string; value: any }> = [{ name: '@tid', value: tenantId }];

    if (filters?.vendorId) {
      query += ` AND c.vendorId = @vid`;
      params.push({ name: '@vid', value: filters.vendorId });
    }
    if (filters?.clientId) {
      query += ` AND c.clientId = @cid`;
      params.push({ name: '@cid', value: filters.clientId });
    }
    if (filters?.productType) {
      query += ` AND c.productType = @pt`;
      params.push({ name: '@pt', value: filters.productType });
    }

    query += ` ORDER BY c.updatedAt DESC`;

    const { resources } = await container.items.query({ query, parameters: params }).fetchAll();
    const rawOrders = resources as WipBoardOrderRow[];
    const { clientOrders, properties } = await this.buildAddressContext(tenantId, rawOrders);

    // Build one column per BoardCategory (always exactly 5)
    const columnMap = new Map<BoardCategory, WIPColumn>();
    for (const cat of WIPBoardService.BOARD_CATEGORIES) {
      columnMap.set(cat, {
        category: cat,
        label: WIPBoardService.CATEGORY_LABELS[cat],
        count: 0,
        totalCount: 0,
        orders: [],
      });
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    let totalOrders = 0;
    let overdueOrders = 0;
    let recentlyUpdated = 0;
    let rushOrders = 0;
    let slaAtRisk = 0;

    for (const raw of rawOrders) {
      const status = raw.status as OrderStatus;
      const statusConfig = STATUS_CONFIG.get(status);
      if (!statusConfig) continue; // unknown status — skip
      const cat = statusConfig.category;
      const col = columnMap.get(cat);
      if (!col) continue;

      // Text search filter
      if (filters?.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const resolvedAddress = this.resolveAddressText(raw, clientOrders, properties);
        const searchable = [raw.orderNumber, resolvedAddress, raw.clientName, raw.vendorName]
          .filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(term)) continue;
      }

      const isRush = raw.isRush ?? raw.rush ?? false;
      if (filters?.isRush !== undefined && isRush !== filters.isRush) continue;

      const sla = WIPBoardService.slaStatus(raw.dueDate);
      const isOverdue = sla === 'breach';

      totalOrders++;
      if (isOverdue && !(statusConfig?.isFinal ?? false)) overdueOrders++;
      if (new Date(raw.updatedAt).getTime() > oneDayAgo) recentlyUpdated++;
      if (isRush) rushOrders++;
      if (sla === 'warning' || sla === 'critical') slaAtRisk++;

      const card: WIPOrderCard = {
        orderId: raw.id,
        orderNumber: raw.orderNumber ?? raw.id,
        propertyAddress: this.resolveDisplayAddress(raw, clientOrders, properties),
        clientName: raw.clientName ?? '',
        productType: raw.productType ?? '',
        // Use the raw OrderStatus (e.g. 'IN_PROGRESS') not the grouped BoardCategory.
        // The frontend Kanban keyField matches on exact OrderStatus strings.
        category: status as unknown as BoardCategory,
        isRush,
        daysInCategory: WIPBoardService.daysAgo(raw.updatedAt),
        slaStatus: sla,
        ...(raw.vendorName ? { vendorName: raw.vendorName } : {}),
        ...(raw.dueDate ? { dueDate: raw.dueDate } : {}),
      };

      col.orders.push(card);
      col.count++;
      col.totalCount++;
    }

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      columns: Array.from(columnMap.values()),
      totalOrders,
      overdueOrders,
      recentlyUpdated,
      summary: { rushOrders, slaAtRisk, overdueCount: overdueOrders },
    };
  }

  /**
   * Get orders for a specific board column/category.
   */
  async getColumnOrders(tenantId: string, category: BoardCategory, filters?: BoardFilters, limit = 50, offset = 0): Promise<BoardOrder[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const statuses = getStatusesByCategory(category as any);
    if (statuses.length === 0) return [];

    const statusList = statuses.map(s => `'${s}'`).join(',');
    let query = `SELECT c.id, c.orderNumber, c.status, c.propertyId, c.clientOrderId, c.clientName, c.vendorName, c.productType, c.dueDate, c.isRush, c.rush, c.updatedAt, c.createdAt FROM c WHERE ${VENDOR_ORDER_TYPE_PREDICATE} AND c.tenantId = @tid AND c.status IN (${statusList})`;
    const params: Array<{ name: string; value: any }> = [{ name: '@tid', value: tenantId }];

    if (filters?.vendorId) {
      query += ` AND c.vendorId = @vid`;
      params.push({ name: '@vid', value: filters.vendorId });
    }
    if (filters?.clientId) {
      query += ` AND c.clientId = @cid`;
      params.push({ name: '@cid', value: filters.clientId });
    }

    query += ` ORDER BY c.updatedAt DESC OFFSET @offset LIMIT @limit`;
    params.push({ name: '@offset', value: offset }, { name: '@limit', value: limit });

    const { resources } = await container.items.query({ query, parameters: params }).fetchAll();
    const rows = resources as WipBoardOrderRow[];
    const { clientOrders, properties } = await this.buildAddressContext(tenantId, rows);
    const now = Date.now();

    return rows.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber ?? order.id,
      status: order.status as OrderStatus,
      statusLabel: getStatusLabel(order.status as OrderStatus),
      category,
      propertyAddress: this.resolveDisplayAddress(order, clientOrders, properties),
      borrowerName: order.borrowerName ?? order.borrower?.lastName ?? '',
      clientName: order.clientName ?? '',
      productType: order.productType ?? '',
      isOverdue: order.dueDate ? new Date(order.dueDate).getTime() < now : false,
      isRush: order.isRush ?? order.rush ?? false,
      updatedAt: order.updatedAt,
      createdAt: order.createdAt,
      ...(order.vendorName ? { vendorName: order.vendorName } : {}),
      ...(order.dueDate ? { dueDate: order.dueDate } : {}),
    }));
  }

  private emptyBoard(tenantId: string): WIPBoard {
    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      columns: WIPBoardService.BOARD_CATEGORIES.map(cat => ({
        category: cat,
        label: WIPBoardService.CATEGORY_LABELS[cat],
        count: 0,
        totalCount: 0,
        orders: [],
      })),
      totalOrders: 0,
      overdueOrders: 0,
      recentlyUpdated: 0,
      summary: { rushOrders: 0, slaAtRisk: 0, overdueCount: 0 },
    };
  }
}

function formatPropertyAddress(address?: PropertyAddress): string {
  if (!address) {
    return '';
  }

  const street = address.streetAddress ?? '';
  const locality = [address.city, address.state].filter(Boolean).join(', ');
  const trailing = [locality, address.zipCode].filter(Boolean).join(' ');
  return [street, trailing].filter(Boolean).join(', ');
}

function formatPropertyRecordAddress(property: PropertyRecord): string {
  const locality = [property.address?.city, property.address?.state].filter(Boolean).join(', ');
  const trailing = [locality, property.address?.zip].filter(Boolean).join(' ');
  return [property.address?.street, trailing].filter(Boolean).join(', ');
}
