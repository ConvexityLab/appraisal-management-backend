/**
 * WIP Status Board Service (Phase 1.9)
 *
 * Aggregates orders by status category for a Kanban-style WIP board.
 * Uses the canonical OrderStatus enum and STATUS_CONFIG categories.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { OrderStatus, STATUS_CONFIG, getStatusesByCategory, getStatusLabel } from '../types/order-status.js';

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

  /**
   * Get the full WIP board with all columns and order cards.
   */
  async getBoard(tenantId: string, filters?: BoardFilters): Promise<WIPBoard> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      return this.emptyBoard(tenantId);
    }

    // Build query with optional filters
    let query = `SELECT c.id, c.orderNumber, c.status, c.propertyAddress, c.clientName, c.vendorName, c.productType, c.dueDate, c.isRush, c.rush, c.updatedAt, c.createdAt FROM c WHERE c.type = 'order' AND c.tenantId = @tid`;
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

    const { resources: rawOrders } = await container.items.query({ query, parameters: params }).fetchAll();

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
        const searchable = [raw.orderNumber, raw.propertyAddress, raw.clientName, raw.vendorName]
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
        propertyAddress: typeof raw.propertyAddress === 'string'
          ? raw.propertyAddress
          : raw.propertyAddress?.street ?? '',
        clientName: raw.clientName ?? '',
        vendorName: raw.vendorName,
        productType: raw.productType ?? '',
        dueDate: raw.dueDate,
        // Use the raw OrderStatus (e.g. 'IN_PROGRESS') not the grouped BoardCategory.
        // The frontend Kanban keyField matches on exact OrderStatus strings.
        category: status as unknown as BoardCategory,
        isRush,
        daysInCategory: WIPBoardService.daysAgo(raw.updatedAt),
        slaStatus: sla,
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
    let query = `SELECT * FROM c WHERE c.type = 'order' AND c.tenantId = @tid AND c.status IN (${statusList})`;
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
    const now = Date.now();

    return resources.map((order: any) => ({
      id: order.id,
      orderNumber: order.orderNumber ?? order.id,
      status: order.status as OrderStatus,
      statusLabel: getStatusLabel(order.status as OrderStatus),
      category,
      propertyAddress: order.propertyAddress ?? order.address?.street ?? '',
      borrowerName: order.borrowerName ?? order.borrower?.lastName ?? '',
      clientName: order.clientName ?? '',
      vendorName: order.vendorName,
      productType: order.productType ?? '',
      dueDate: order.dueDate,
      isOverdue: order.dueDate ? new Date(order.dueDate).getTime() < now : false,
      isRush: order.isRush ?? order.rush ?? false,
      updatedAt: order.updatedAt,
      createdAt: order.createdAt,
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
