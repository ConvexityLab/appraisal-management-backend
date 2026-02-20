/**
 * In-App Notification Service
 * 
 * Stores, retrieves, and manages in-app notifications for users.
 * Backed by Cosmos DB 'in-app-notifications' container.
 * 
 * Phase 4.1 — In-app notification API
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// ── Types ────────────────────────────────────────────────────────────────

export interface InAppNotification {
  id: string;
  type: 'in-app-notification';
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: 'low' | 'normal' | 'high' | 'critical';
  read: boolean;
  readAt?: string;
  dismissed: boolean;
  dismissedAt?: string;
  /** Deep-link path in the UI, e.g. "/orders/order-123" */
  actionUrl?: string;
  /** Arbitrary metadata from the triggering event */
  metadata?: Record<string, unknown>;
  /** Source event that created this notification */
  sourceEventType?: string;
  sourceEventId?: string;
  createdAt: string;
  updatedAt: string;
  /** TTL in seconds — auto-expire after 90 days */
  ttl: number;
}

export type NotificationCategory =
  | 'order'
  | 'assignment'
  | 'qc'
  | 'communication'
  | 'sla'
  | 'system'
  | 'revision'
  | 'escalation'
  | 'delivery';

export interface CreateNotificationRequest {
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  sourceEventType?: string;
  sourceEventId?: string;
}

export interface NotificationListParams {
  tenantId: string;
  userId: string;
  unreadOnly?: boolean;
  category?: NotificationCategory;
  limit?: number;
  offset?: number;
}

export interface NotificationListResult {
  notifications: InAppNotification[];
  total: number;
  unreadCount: number;
}

// ── Service ──────────────────────────────────────────────────────────────

const TTL_90_DAYS = 90 * 24 * 60 * 60;

export class InAppNotificationService {
  private logger: Logger;
  private client: CosmosClient | null = null;
  private database: Database | null = null;
  private container: Container | null = null;
  private initialized = false;

  constructor() {
    this.logger = new Logger();
  }

  // ── Initialization ───────────────────────────────────────────────────

  private async ensureInitialized(): Promise<Container> {
    if (this.initialized && this.container) return this.container;

    const endpoint = process.env.COSMOS_ENDPOINT || process.env.AZURE_COSMOS_ENDPOINT;
    if (!endpoint) {
      throw new Error('AZURE_COSMOS_ENDPOINT environment variable is required for in-app notifications');
    }

    const databaseId = 'appraisal-management';
    const containerId = 'in-app-notifications';

    try {
      if (process.env.COSMOS_USE_EMULATOR === 'true') {
        const key = process.env.COSMOS_KEY || 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
        this.client = new CosmosClient({ endpoint, key });
      } else {
        const credential = new DefaultAzureCredential();
        this.client = new CosmosClient({ endpoint, aadCredentials: credential });
      }

      this.database = this.client.database(databaseId);

      // Create container if it doesn't exist (for dev/test — production uses Bicep)
      const { container } = await this.database.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: ['/userId'] },
        defaultTtl: TTL_90_DAYS,
      });

      this.container = container;
      this.initialized = true;
      this.logger.info('In-app notification container initialized');
      return this.container;
    } catch (error) {
      this.logger.error('Failed to initialize in-app notification container', { error });
      throw error;
    }
  }

  // ── Create ───────────────────────────────────────────────────────────

  async createNotification(req: CreateNotificationRequest): Promise<InAppNotification> {
    const container = await this.ensureInitialized();
    const now = new Date().toISOString();

    const notification: InAppNotification = {
      id: uuidv4(),
      type: 'in-app-notification',
      tenantId: req.tenantId,
      userId: req.userId,
      title: req.title,
      message: req.message,
      category: req.category,
      priority: req.priority || 'normal',
      read: false,
      dismissed: false,
      ...(req.actionUrl !== undefined ? { actionUrl: req.actionUrl } : {}),
      ...(req.metadata !== undefined ? { metadata: req.metadata } : {}),
      ...(req.sourceEventType !== undefined ? { sourceEventType: req.sourceEventType } : {}),
      ...(req.sourceEventId !== undefined ? { sourceEventId: req.sourceEventId } : {}),
      createdAt: now,
      updatedAt: now,
      ttl: TTL_90_DAYS,
    };

    await container.items.create(notification);
    this.logger.debug('In-app notification created', { id: notification.id, userId: req.userId, category: req.category });
    return notification;
  }

  // ── List / Query ─────────────────────────────────────────────────────

  async listNotifications(params: NotificationListParams): Promise<NotificationListResult> {
    const container = await this.ensureInitialized();
    const { tenantId, userId, unreadOnly, category, limit = 50, offset = 0 } = params;

    // Build query conditions
    const conditions: string[] = [
      'c.userId = @userId',
      'c.tenantId = @tenantId',
      'c.dismissed = false',
    ];
    const parameters: { name: string; value: string | number | boolean | null }[] = [
      { name: '@userId', value: userId },
      { name: '@tenantId', value: tenantId },
    ];

    if (unreadOnly) {
      conditions.push('c.read = false');
    }
    if (category) {
      conditions.push('c.category = @category');
      parameters.push({ name: '@category', value: category });
    }

    const whereClause = conditions.join(' AND ');

    // Get total + unread counts
    const countQuery = `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause}`;
    const { resources: [total] } = await container.items
      .query<number>({ query: countQuery, parameters })
      .fetchAll();

    const unreadQuery = `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause} AND c.read = false`;
    const { resources: [unreadCount] } = await container.items
      .query<number>({ query: unreadQuery, parameters })
      .fetchAll();

    // Get paginated results
    const dataQuery = `SELECT * FROM c WHERE ${whereClause} ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit`;
    const { resources: notifications } = await container.items
      .query<InAppNotification>({
        query: dataQuery,
        parameters: [
          ...parameters,
          { name: '@offset', value: offset },
          { name: '@limit', value: limit },
        ],
      })
      .fetchAll();

    return { notifications, total: total || 0, unreadCount: unreadCount || 0 };
  }

  // ── Unread Count ─────────────────────────────────────────────────────

  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    const container = await this.ensureInitialized();

    const { resources: [count] } = await container.items
      .query<number>({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId AND c.tenantId = @tenantId AND c.read = false AND c.dismissed = false',
        parameters: [
          { name: '@userId', value: userId },
          { name: '@tenantId', value: tenantId },
        ],
      })
      .fetchAll();

    return count || 0;
  }

  // ── Mark Read ────────────────────────────────────────────────────────

  async markAsRead(userId: string, notificationId: string): Promise<InAppNotification> {
    const container = await this.ensureInitialized();
    const now = new Date().toISOString();

    const { resource } = await container.item(notificationId, userId).read<InAppNotification>();
    if (!resource) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    resource.read = true;
    resource.readAt = now;
    resource.updatedAt = now;

    const { resource: updated } = await container.item(notificationId, userId).replace(resource);
    return updated as unknown as InAppNotification;
  }

  async markAllAsRead(tenantId: string, userId: string): Promise<number> {
    const container = await this.ensureInitialized();
    const now = new Date().toISOString();

    // Fetch all unread
    const { resources: unread } = await container.items
      .query<InAppNotification>({
        query: 'SELECT * FROM c WHERE c.userId = @userId AND c.tenantId = @tenantId AND c.read = false AND c.dismissed = false',
        parameters: [
          { name: '@userId', value: userId },
          { name: '@tenantId', value: tenantId },
        ],
      })
      .fetchAll();

    // Batch update
    let count = 0;
    for (const n of unread) {
      n.read = true;
      n.readAt = now;
      n.updatedAt = now;
      await container.item(n.id, userId).replace(n);
      count++;
    }

    this.logger.info(`Marked ${count} notifications as read`, { userId, tenantId });
    return count;
  }

  // ── Dismiss ──────────────────────────────────────────────────────────

  async dismiss(userId: string, notificationId: string): Promise<void> {
    const container = await this.ensureInitialized();
    const now = new Date().toISOString();

    const { resource } = await container.item(notificationId, userId).read<InAppNotification>();
    if (!resource) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    resource.dismissed = true;
    resource.dismissedAt = now;
    resource.updatedAt = now;

    await container.item(notificationId, userId).replace(resource);
  }
}
