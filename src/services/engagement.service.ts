/**
 * Engagement Service
 *
 * Manages CRUD for Engagement documents in Cosmos DB.
 * An Engagement represents a lender's inbound request for valuation services —
 * the aggregate root for all work product on a given loan.
 *
 * Cosmos container: "engagements"
 * Partition key:    /tenantId
 */

import type { Container, SqlQuerySpec } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  Engagement,
  EngagementProduct,
  EngagementStatus,
  CreateEngagementRequest,
  UpdateEngagementRequest,
  EngagementListRequest,
  EngagementListResponse,
} from '../types/engagement.types.js';
import { EngagementProductStatus } from '../types/engagement.types.js';
import { OrderPriority } from '../types/order-management.js';

const logger = new Logger('EngagementService');

// ── ID helpers ────────────────────────────────────────────────────────────────

function generateEngagementId(): string {
  return `eng-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateProductId(): string {
  return `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

let engagementCounter = 0;

function generateEngagementNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(++engagementCounter).padStart(6, '0');
  return `ENG-${year}-${seq}`;
}

function now(): string {
  return new Date().toISOString();
}

// ── Service ───────────────────────────────────────────────────────────────────

export class EngagementService {
  private readonly container: Container;

  constructor(private readonly dbService: CosmosDbService) {
    this.container = dbService.getEngagementsContainer();
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async createEngagement(request: CreateEngagementRequest): Promise<Engagement> {
    if (!request.tenantId) {
      throw new Error('tenantId is required to create an Engagement');
    }
    if (!request.createdBy) {
      throw new Error('createdBy is required to create an Engagement');
    }
    if (!request.client?.clientId) {
      throw new Error('client.clientId is required to create an Engagement');
    }
    if (!request.client?.loanNumber) {
      throw new Error('client.loanNumber is required to create an Engagement');
    }
    if (!request.products || request.products.length === 0) {
      throw new Error('At least one EngagementProduct is required');
    }

    const products: EngagementProduct[] = request.products.map((p) => ({
      id: generateProductId(),
      productType: p.productType,
      status: EngagementProductStatus.PENDING,
      ...(p.instructions !== undefined && { instructions: p.instructions }),
      ...(p.fee !== undefined && { fee: p.fee }),
      ...(p.dueDate !== undefined && { dueDate: p.dueDate }),
      vendorOrderIds: [],
    }));

    const engagement: Engagement = {
      id: generateEngagementId(),
      engagementNumber: generateEngagementNumber(),
      tenantId: request.tenantId,
      client: request.client,
      property: request.property,
      products,
      status: 'RECEIVED' as EngagementStatus,
      priority: request.priority ?? OrderPriority.ROUTINE,
      receivedAt: now(),
      ...(request.clientDueDate !== undefined && { clientDueDate: request.clientDueDate }),
      ...(request.internalDueDate !== undefined && { internalDueDate: request.internalDueDate }),
      ...(request.totalEngagementFee !== undefined && { totalEngagementFee: request.totalEngagementFee }),
      ...(request.accessInstructions !== undefined && { accessInstructions: request.accessInstructions }),
      ...(request.specialInstructions !== undefined && { specialInstructions: request.specialInstructions }),
      ...(request.engagementInstructions !== undefined && { engagementInstructions: request.engagementInstructions }),
      createdAt: now(),
      createdBy: request.createdBy,
      updatedAt: now(),
    };

    const { resource } = await this.container.items.create(engagement);
    if (!resource) {
      throw new Error('Cosmos DB did not return a resource after creating the Engagement');
    }

    logger.info('Engagement created', { id: engagement.id, engagementNumber: engagement.engagementNumber });
    return resource as Engagement;
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async getEngagement(id: string, tenantId: string): Promise<Engagement> {
    const { resource } = await this.container.item(id, tenantId).read<Engagement>();
    if (!resource) {
      throw new Error(`Engagement not found: id=${id}`);
    }
    return resource;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async updateEngagement(
    id: string,
    tenantId: string,
    updates: UpdateEngagementRequest,
  ): Promise<Engagement> {
    const existing = await this.getEngagement(id, tenantId);

    const updated: Engagement = {
      ...existing,
      ...(updates.client !== undefined && {
        client: { ...existing.client, ...updates.client },
      }),
      ...(updates.property !== undefined && {
        property: { ...existing.property, ...updates.property },
      }),
      ...(updates.products !== undefined && { products: updates.products }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.clientDueDate !== undefined && { clientDueDate: updates.clientDueDate }),
      ...(updates.internalDueDate !== undefined && { internalDueDate: updates.internalDueDate }),
      ...(updates.totalEngagementFee !== undefined && {
        totalEngagementFee: updates.totalEngagementFee,
      }),
      ...(updates.accessInstructions !== undefined && {
        accessInstructions: updates.accessInstructions,
      }),
      ...(updates.specialInstructions !== undefined && {
        specialInstructions: updates.specialInstructions,
      }),
      ...(updates.engagementInstructions !== undefined && {
        engagementInstructions: updates.engagementInstructions,
      }),
      updatedAt: now(),
      updatedBy: updates.updatedBy,
    };

    const { resource } = await this.container.item(id, tenantId).replace<Engagement>(updated);
    if (!resource) {
      throw new Error(`Cosmos DB did not return a resource after updating Engagement id=${id}`);
    }

    logger.info('Engagement updated', { id, updatedBy: updates.updatedBy });
    return resource;
  }

  // ── Change status ──────────────────────────────────────────────────────────

  async changeStatus(
    id: string,
    tenantId: string,
    newStatus: EngagementStatus,
    updatedBy: string,
  ): Promise<Engagement> {
    return this.updateEngagement(id, tenantId, { status: newStatus, updatedBy });
  }

  // ── Link VendorOrder to EngagementProduct ──────────────────────────────────

  async addVendorOrderToProduct(
    engagementId: string,
    tenantId: string,
    productId: string,
    vendorOrderId: string,
    updatedBy: string,
  ): Promise<Engagement> {
    const engagement = await this.getEngagement(engagementId, tenantId);
    const product = engagement.products.find((p) => p.id === productId);
    if (!product) {
      throw new Error(
        `EngagementProduct not found: engagementId=${engagementId} productId=${productId}`,
      );
    }
    if (!product.vendorOrderIds.includes(vendorOrderId)) {
      product.vendorOrderIds.push(vendorOrderId);
    }
    return this.updateEngagement(engagementId, tenantId, {
      products: engagement.products,
      updatedBy,
    });
  }

  // ── List ───────────────────────────────────────────────────────────────────

  async listEngagements(request: EngagementListRequest): Promise<EngagementListResponse> {
    if (!request.tenantId) {
      throw new Error('tenantId is required to list Engagements');
    }

    const page = request.page ?? 1;
    const pageSize = Math.min(request.pageSize ?? 25, 100);
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['c.tenantId = @tenantId'];
    const parameters: { name: string; value: unknown }[] = [
      { name: '@tenantId', value: request.tenantId },
    ];

    if (request.status && request.status.length > 0) {
      const statusParams = request.status.map((s, i) => `@status${i}`);
      conditions.push(`c.status IN (${statusParams.join(', ')})`);
      request.status.forEach((s, i) => parameters.push({ name: `@status${i}`, value: s }));
    }

    if (request.clientId) {
      conditions.push('c.client.clientId = @clientId');
      parameters.push({ name: '@clientId', value: request.clientId });
    }

    if (request.propertyState) {
      conditions.push('c.property.state = @propertyState');
      parameters.push({ name: '@propertyState', value: request.propertyState });
    }

    if (request.propertyZipCode) {
      conditions.push('c.property.zipCode = @zipCode');
      parameters.push({ name: '@zipCode', value: request.propertyZipCode });
    }

    if (request.searchText) {
      conditions.push(
        '(CONTAINS(LOWER(c.client.loanNumber), LOWER(@search)) OR ' +
        'CONTAINS(LOWER(c.client.borrowerName), LOWER(@search)) OR ' +
        'CONTAINS(LOWER(c.engagementNumber), LOWER(@search)) OR ' +
        'CONTAINS(LOWER(c.property.city), LOWER(@search)))',
      );
      parameters.push({ name: '@search', value: request.searchText });
    }

    const sortField = request.sortBy ?? 'createdAt';
    const sortDir = request.sortDirection ?? 'DESC';

    const whereClause = conditions.join(' AND ');

    // Count query
    const countQuery: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause}`,
      parameters: parameters as { name: string; value: string | number | boolean }[],
    };
    const { resources: countResult } = await this.container.items
      .query<number>(countQuery)
      .fetchAll();
    const totalCount = countResult[0] ?? 0;

    // Data query
    const dataQuery: SqlQuerySpec = {
      query:
        `SELECT * FROM c WHERE ${whereClause} ` +
        `ORDER BY c.${String(sortField)} ${sortDir} ` +
        `OFFSET ${offset} LIMIT ${pageSize}`,
      parameters: parameters as { name: string; value: string | number | boolean }[],
    };
    const { resources: engagements } = await this.container.items
      .query<Engagement>(dataQuery)
      .fetchAll();

    return {
      engagements,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  // ── Soft delete ────────────────────────────────────────────────────────────

  async deleteEngagement(id: string, tenantId: string, deletedBy: string): Promise<void> {
    // Soft-delete: set status to CANCELLED rather than hard-deleting
    await this.changeStatus(id, tenantId, 'CANCELLED' as EngagementStatus, deletedBy);
    logger.info('Engagement soft-deleted (set to CANCELLED)', { id, deletedBy });
  }

  // ── Sub-resource queries (Phase 3 FK reads) ────────────────────────────────

  /**
   * List VendorOrders (AppraisalOrders) linked to this engagement.
   * Queries the orders container by engagementId.
   */
  async getVendorOrders<T = unknown>(engagementId: string, tenantId: string): Promise<T[]> {
    const result = await this.dbService.queryItems<T>(
      'orders',
      'SELECT * FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    );
    if (!result.success || !result.data) {
      throw new Error(`Failed to query vendor orders for engagement ${engagementId}`);
    }
    return result.data;
  }

  /**
   * List ARV analyses linked to this engagement.
   */
  async getArvAnalyses<T = unknown>(engagementId: string, tenantId: string): Promise<T[]> {
    const result = await this.dbService.queryItems<T>(
      'arv-analyses',
      'SELECT * FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    );
    if (!result.success || !result.data) {
      throw new Error(`Failed to query ARV analyses for engagement ${engagementId}`);
    }
    return result.data;
  }

  /**
   * List QC reviews linked to this engagement.
   */
  async getQcReviews<T = unknown>(engagementId: string, tenantId: string): Promise<T[]> {
    const result = await this.dbService.queryItems<T>(
      'qc-reviews',
      'SELECT * FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    );
    if (!result.success || !result.data) {
      throw new Error(`Failed to query QC reviews for engagement ${engagementId}`);
    }
    return result.data;
  }

  /**
   * List documents linked to this engagement.
   */
  async getDocuments<T = unknown>(engagementId: string, tenantId: string): Promise<T[]> {
    const result = await this.dbService.queryItems<T>(
      'documents',
      'SELECT * FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    );
    if (!result.success || !result.data) {
      throw new Error(`Failed to query documents for engagement ${engagementId}`);
    }
    return result.data;
  }
}
