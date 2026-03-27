/**
 * Post-Delivery Task Management Service (Phase 1.10)
 *
 * Manages post-delivery tasks: 1004D recertification tracking, report archiving,
 * delivery confirmation follow-up, and post-delivery quality checks.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type PostDeliveryTaskType =
  | 'RECERTIFICATION_1004D'
  | 'ARCHIVE_REPORT'
  | 'DELIVERY_CONFIRMATION'
  | 'POST_DELIVERY_QC'
  | 'INVESTOR_FOLLOWUP'
  | 'MISMO_SUBMISSION_VERIFY';

export type PostDeliveryTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'WAIVED' | 'CANCELLED';

export interface PostDeliveryTask {
  id: string;
  orderId: string;
  tenantId: string;
  taskType: PostDeliveryTaskType;
  status: PostDeliveryTaskStatus;
  title: string;
  description: string;
  /** ISO date when the task is due */
  dueDate: string;
  /** ISO date when task was completed */
  completedAt?: string;
  completedBy?: string;
  /** For 1004D: original effective date of the appraisal */
  appraisalEffectiveDate?: string;
  /** For 1004D: recertification expiry (typically +120 days) */
  recertificationDeadline?: string;
  /** For archiving: storage location reference */
  archiveLocation?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecertificationCheckResult {
  orderId: string;
  isExpiringSoon: boolean;
  daysRemaining: number;
  effectiveDate: string;
  deadline: string;
  hasExistingTask: boolean;
}

export interface PostDeliveryTaskCreateRequest {
  orderId: string;
  tenantId: string;
  taskType: PostDeliveryTaskType;
  title?: string;
  description?: string;
  dueDate?: string;
  notes?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class PostDeliveryService {
  private logger: Logger;
  private dbService: CosmosDbService;

  /** Default days after delivery before 1004D recertification expires */
  static readonly RECERT_WINDOW_DAYS = 120;
  /** Days before deadline to flag as expiring soon */
  static readonly EXPIRY_WARNING_DAYS = 30;
  /** Days after delivery for archive to occur */
  static readonly ARCHIVE_DUE_DAYS = 14;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('PostDeliveryService');
  }

  /**
   * Create a post-delivery task for an order.
   */
  async createTask(request: PostDeliveryTaskCreateRequest): Promise<PostDeliveryTask> {
    const now = new Date().toISOString();
    const taskId = `pdt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const dueDate = request.dueDate ?? this.calculateDueDate(request.taskType);

    const task: PostDeliveryTask = {
      id: taskId,
      orderId: request.orderId,
      tenantId: request.tenantId,
      taskType: request.taskType,
      status: 'PENDING',
      title: request.title ?? this.getDefaultTitle(request.taskType),
      description: request.description ?? this.getDefaultDescription(request.taskType),
      dueDate,
      ...(request.notes !== undefined && { notes: request.notes }),
      createdAt: now,
      updatedAt: now,
    };

    await this.saveTask(task);
    this.logger.info('Post-delivery task created', { taskId, orderId: request.orderId, taskType: request.taskType });
    return task;
  }

  /**
   * Generate all standard post-delivery tasks when an order reaches DELIVERED status.
   */
  async generateDeliveryTasks(orderId: string, tenantId: string, appraisalEffectiveDate?: string): Promise<PostDeliveryTask[]> {
    this.logger.info('Generating post-delivery tasks', { orderId });

    const tasks: PostDeliveryTask[] = [];
    const now = new Date();

    // 1. Delivery confirmation follow-up (due in 3 days)
    tasks.push(await this.createTask({
      orderId,
      tenantId,
      taskType: 'DELIVERY_CONFIRMATION',
      title: 'Confirm delivery receipt',
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    // 2. Post-delivery QC check (due in 7 days)
    tasks.push(await this.createTask({
      orderId,
      tenantId,
      taskType: 'POST_DELIVERY_QC',
      title: 'Post-delivery quality check',
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    // 3. Archive report (due in 14 days)
    tasks.push(await this.createTask({
      orderId,
      tenantId,
      taskType: 'ARCHIVE_REPORT',
      title: 'Archive appraisal report',
      dueDate: new Date(now.getTime() + PostDeliveryService.ARCHIVE_DUE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    }));

    // 4. MISMO submission verification (due in 5 days)
    tasks.push(await this.createTask({
      orderId,
      tenantId,
      taskType: 'MISMO_SUBMISSION_VERIFY',
      title: 'Verify MISMO/GSE submission',
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    // 5. 1004D Recertification tracking (only if effective date provided)
    if (appraisalEffectiveDate) {
      const effectiveMs = new Date(appraisalEffectiveDate).getTime();
      const deadline = new Date(effectiveMs + PostDeliveryService.RECERT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const warningDate = new Date(deadline.getTime() - PostDeliveryService.EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);

      const recertTask = await this.createTask({
        orderId,
        tenantId,
        taskType: 'RECERTIFICATION_1004D',
        title: '1004D Recertification due',
        description: `Appraisal effective ${appraisalEffectiveDate}. Recertification expires ${deadline.toISOString().slice(0, 10)}.`,
        dueDate: warningDate.toISOString(),
      });
      recertTask.appraisalEffectiveDate = appraisalEffectiveDate;
      recertTask.recertificationDeadline = deadline.toISOString();
      await this.saveTask(recertTask);
      tasks.push(recertTask);
    }

    return tasks;
  }

  /**
   * Check 1004D recertification status for an order.
   */
  async checkRecertificationStatus(orderId: string, tenantId: string): Promise<RecertificationCheckResult | null> {
    const existingTasks = await this.getTasksForOrder(orderId, tenantId);
    const recertTask = existingTasks.find(t => t.taskType === 'RECERTIFICATION_1004D');

    if (!recertTask?.appraisalEffectiveDate) return null;

    const effectiveMs = new Date(recertTask.appraisalEffectiveDate).getTime();
    const deadline = new Date(effectiveMs + PostDeliveryService.RECERT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const now = Date.now();
    const daysRemaining = Math.ceil((deadline.getTime() - now) / (24 * 60 * 60 * 1000));

    return {
      orderId,
      isExpiringSoon: daysRemaining <= PostDeliveryService.EXPIRY_WARNING_DAYS && daysRemaining > 0,
      daysRemaining: Math.max(0, daysRemaining),
      effectiveDate: recertTask.appraisalEffectiveDate,
      deadline: deadline.toISOString(),
      hasExistingTask: true,
    };
  }

  /**
   * Complete a post-delivery task.
   */
  async completeTask(taskId: string, tenantId: string, completedBy: string, notes?: string): Promise<PostDeliveryTask> {
    const task = await this.loadTask(taskId, tenantId);
    if (!task) {
      throw new Error(`Post-delivery task not found: ${taskId}`);
    }
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      throw new Error(`Task ${taskId} is already ${task.status}`);
    }

    task.status = 'COMPLETED';
    task.completedAt = new Date().toISOString();
    task.completedBy = completedBy;
    if (notes) task.notes = notes;
    task.updatedAt = new Date().toISOString();

    await this.saveTask(task);
    this.logger.info('Post-delivery task completed', { taskId, completedBy });
    return task;
  }

  /**
   * Get all post-delivery tasks for an order.
   */
  async getTasksForOrder(orderId: string, tenantId: string): Promise<PostDeliveryTask[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'post-delivery-task' AND c.orderId = @oid AND c.tenantId = @tid ORDER BY c.dueDate ASC`,
      parameters: [
        { name: '@oid', value: orderId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources as PostDeliveryTask[];
  }

  /**
   * Get overdue tasks across all orders for a tenant.
   */
  async getOverdueTasks(tenantId: string): Promise<PostDeliveryTask[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const now = new Date().toISOString();
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'post-delivery-task' AND c.tenantId = @tid AND c.status = 'PENDING' AND c.dueDate < @now ORDER BY c.dueDate ASC`,
      parameters: [
        { name: '@tid', value: tenantId },
        { name: '@now', value: now },
      ],
    }).fetchAll();

    // Mark them as overdue
    for (const task of resources) {
      if (task.status === 'PENDING') {
        task.status = 'OVERDUE';
        task.updatedAt = new Date().toISOString();
        await this.saveTask(task as PostDeliveryTask);
      }
    }

    return resources as PostDeliveryTask[];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private calculateDueDate(taskType: PostDeliveryTaskType): string {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const dueDays: Record<PostDeliveryTaskType, number> = {
      DELIVERY_CONFIRMATION: 3,
      POST_DELIVERY_QC: 7,
      ARCHIVE_REPORT: 14,
      MISMO_SUBMISSION_VERIFY: 5,
      RECERTIFICATION_1004D: 90,
      INVESTOR_FOLLOWUP: 10,
    };
    return new Date(now + dueDays[taskType] * day).toISOString();
  }

  private getDefaultTitle(taskType: PostDeliveryTaskType): string {
    const titles: Record<PostDeliveryTaskType, string> = {
      RECERTIFICATION_1004D: '1004D Recertification due',
      ARCHIVE_REPORT: 'Archive appraisal report',
      DELIVERY_CONFIRMATION: 'Confirm delivery receipt',
      POST_DELIVERY_QC: 'Post-delivery quality check',
      INVESTOR_FOLLOWUP: 'Investor follow-up',
      MISMO_SUBMISSION_VERIFY: 'Verify MISMO/GSE submission',
    };
    return titles[taskType];
  }

  private getDefaultDescription(taskType: PostDeliveryTaskType): string {
    const descriptions: Record<PostDeliveryTaskType, string> = {
      RECERTIFICATION_1004D: 'Track 1004D recertification status and deadline.',
      ARCHIVE_REPORT: 'Archive the completed appraisal report for long-term storage.',
      DELIVERY_CONFIRMATION: 'Confirm the client received the delivered report.',
      POST_DELIVERY_QC: 'Run post-delivery quality review for compliance.',
      INVESTOR_FOLLOWUP: 'Follow up with investor on delivery acceptance.',
      MISMO_SUBMISSION_VERIFY: 'Verify the report was successfully submitted to GSE portals.',
    };
    return descriptions[taskType];
  }

  private async saveTask(task: PostDeliveryTask): Promise<void> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      this.logger.warn('Cannot save task — container not initialized');
      return;
    }
    await container.items.upsert({ ...task, type: 'post-delivery-task' });
  }

  private async loadTask(taskId: string, tenantId: string): Promise<PostDeliveryTask | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'post-delivery-task' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: taskId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources.length > 0 ? resources[0] as PostDeliveryTask : null;
  }
}
