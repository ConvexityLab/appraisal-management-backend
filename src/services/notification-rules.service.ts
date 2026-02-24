/**
 * Notification Rules Service
 *
 * DB-backed persistence for event alert configuration rules.
 * Rules are stored in the 'notification-rules' Cosmos container (type = 'notification-rule').
 *
 * A NotificationRule describes:
 *   - Which event type (e.g. 'order.status.changed') triggers the rule
 *   - Which notification channels to use (EMAIL, WEBSOCKET, SMS…)
 *   - A template for the notification title/message
 *   - Optional throttle window (ms) to prevent flooding
 *   - Whether the rule is enabled or disabled
 */

import { randomUUID } from 'crypto';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { NotificationChannel } from '../types/events.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationRuleRecord {
  id: string;
  type: 'notification-rule';
  tenantId: string;

  /** Matches an event type string, e.g. 'order.status.changed' */
  eventType: string;

  /** Human-readable name for the rule */
  name: string;

  /** Optional description */
  description?: string;

  /** Channels to route the notification to */
  channels: NotificationChannel[];

  /** Title template — may contain {orderId}, {status} etc. */
  titleTemplate: string;

  /** Body template — may contain {orderId}, {status} etc. */
  messageTemplate: string;

  /** If set, suppress duplicate notifications for this many ms after the first fires */
  throttleMs?: number;

  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateNotificationRuleRequest {
  eventType: string;
  name: string;
  description?: string;
  channels: NotificationChannel[];
  titleTemplate: string;
  messageTemplate: string;
  throttleMs?: number;
  enabled?: boolean;
}

export interface UpdateNotificationRuleRequest {
  eventType?: string;
  name?: string;
  description?: string;
  channels?: NotificationChannel[];
  titleTemplate?: string;
  messageTemplate?: string;
  throttleMs?: number;
  enabled?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const CONTAINER = 'notification-rules';

export class NotificationRulesService {
  private readonly logger: Logger;
  private readonly dbService: CosmosDbService;

  constructor(dbService?: CosmosDbService) {
    this.logger = new Logger('NotificationRulesService');
    this.dbService = dbService ?? new CosmosDbService();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.dbService.isDbConnected()) {
      await this.dbService.initialize();
    }
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listRules(tenantId: string, enabledOnly = false): Promise<NotificationRuleRecord[]> {
    await this.ensureInitialized();

    const conditions: string[] = ['c.type = "notification-rule"', 'c.tenantId = @tenantId'];
    const parameters: { name: string; value: unknown }[] = [
      { name: '@tenantId', value: tenantId },
    ];

    if (enabledOnly) {
      conditions.push('c.enabled = true');
    }

    const query = `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.eventType, c.name`;
    const result = await this.dbService.queryItems<NotificationRuleRecord>(
      CONTAINER,
      query,
      parameters
    );

    if (!result.success) {
      throw new Error(`Failed to list notification rules: ${result.error?.message ?? 'Unknown error'}`);
    }
    return result.data ?? [];
  }

  // ── Get ───────────────────────────────────────────────────────────────────

  async getRule(ruleId: string, tenantId: string): Promise<NotificationRuleRecord | null> {
    await this.ensureInitialized();

    const result = await this.dbService.queryItems<NotificationRuleRecord>(
      CONTAINER,
      'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId AND c.type = "notification-rule"',
      [
        { name: '@id', value: ruleId },
        { name: '@tenantId', value: tenantId },
      ]
    );

    if (!result.success) {
      throw new Error(`Failed to get notification rule '${ruleId}': ${result.error?.message ?? 'Unknown error'}`);
    }
    return result.data?.[0] ?? null;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createRule(
    input: CreateNotificationRuleRequest,
    tenantId: string,
    userId: string
  ): Promise<NotificationRuleRecord> {
    await this.ensureInitialized();

    const now = new Date().toISOString();
    const rule: NotificationRuleRecord = {
      id:              randomUUID(),
      type:            'notification-rule',
      tenantId,
      eventType:       input.eventType,
      name:            input.name,
      channels:        input.channels,
      titleTemplate:   input.titleTemplate,
      messageTemplate: input.messageTemplate,
      enabled:         input.enabled ?? true,
      createdAt:       now,
      updatedAt:       now,
      createdBy:       userId,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.throttleMs  !== undefined && { throttleMs: input.throttleMs }),
    };

    const result = await this.dbService.upsertItem<NotificationRuleRecord>(CONTAINER, rule);
    if (!result.success || !result.data) {
      throw new Error(`Failed to create notification rule: ${result.error?.message ?? 'Unknown error'}`);
    }

    this.logger.info('Notification rule created', { ruleId: rule.id, eventType: rule.eventType, tenantId });
    return result.data;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateRule(
    ruleId: string,
    updates: UpdateNotificationRuleRequest,
    tenantId: string
  ): Promise<NotificationRuleRecord> {
    await this.ensureInitialized();

    const existing = await this.getRule(ruleId, tenantId);
    if (!existing) {
      throw new Error(`Notification rule '${ruleId}' not found`);
    }

    const updated: NotificationRuleRecord = {
      ...existing,
      ...updates,
      id:        existing.id,
      type:      'notification-rule',
      tenantId:  existing.tenantId,
      createdAt: existing.createdAt,
      createdBy: existing.createdBy,
      updatedAt: new Date().toISOString(),
    };

    const result = await this.dbService.upsertItem<NotificationRuleRecord>(CONTAINER, updated);
    if (!result.success || !result.data) {
      throw new Error(`Failed to update notification rule '${ruleId}': ${result.error?.message ?? 'Unknown error'}`);
    }

    this.logger.info('Notification rule updated', { ruleId, tenantId });
    return result.data;
  }

  // ── Toggle ────────────────────────────────────────────────────────────────

  async toggleRule(ruleId: string, tenantId: string): Promise<NotificationRuleRecord> {
    const existing = await this.getRule(ruleId, tenantId);
    if (!existing) {
      throw new Error(`Notification rule '${ruleId}' not found`);
    }
    return this.updateRule(ruleId, { enabled: !existing.enabled }, tenantId);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteRule(ruleId: string, tenantId: string): Promise<void> {
    await this.ensureInitialized();

    const existing = await this.getRule(ruleId, tenantId);
    if (!existing) {
      throw new Error(`Notification rule '${ruleId}' not found`);
    }

    const result = await this.dbService.deleteItem(CONTAINER, ruleId, tenantId);
    if (!result.success) {
      throw new Error(`Failed to delete notification rule '${ruleId}': ${result.error?.message ?? 'Unknown error'}`);
    }

    this.logger.info('Notification rule deleted', { ruleId, tenantId });
  }
}
