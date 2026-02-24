/**
 * QC Rules Service
 *
 * Persists QC automation rules to Cosmos DB (container: 'qc-rules').
 * Rules define conditions + actions that drive automated quality checks.
 */

import { randomUUID } from 'crypto';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type QCRuleCategory =
  | 'SUBJECT'
  | 'NEIGHBORHOOD'
  | 'COMPARABLES'
  | 'SALES_COMPARISON'
  | 'APPRAISER'
  | 'GENERAL';

export type QCRuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RuleConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterOrEqual'
  | 'lessOrEqual'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty';

export type RuleActionType =
  | 'FLAG_ISSUE'
  | 'AUTO_FAIL'
  | 'REQUIRE_REVIEW'
  | 'ADJUST_SCORE'
  | 'NOTIFY';

export interface QCRuleCondition {
  id: string;
  field: string;
  operator: RuleConditionOperator;
  value: string | number;
  logicalOperator?: 'AND' | 'OR';
}

export interface QCRuleAction {
  id: string;
  type: RuleActionType;
  parameters: Record<string, string | number | boolean | string[]>;
}

export interface QCRule {
  id: string;
  type: 'qc-rule';
  tenantId: string;
  name: string;
  description: string;
  category: QCRuleCategory;
  severity: QCRuleSeverity;
  enabled: boolean;
  conditions: QCRuleCondition[];
  actions: QCRuleAction[];
  createdAt: string;
  lastModified: string;
  createdBy: string;
}

export interface CreateQCRuleRequest {
  name: string;
  description: string;
  category: QCRuleCategory;
  severity: QCRuleSeverity;
  enabled?: boolean;
  conditions: QCRuleCondition[];
  actions: QCRuleAction[];
}

export interface UpdateQCRuleRequest {
  name?: string;
  description?: string;
  category?: QCRuleCategory;
  severity?: QCRuleSeverity;
  enabled?: boolean;
  conditions?: QCRuleCondition[];
  actions?: QCRuleAction[];
}

export interface QCRuleFilters {
  category?: QCRuleCategory;
  severity?: QCRuleSeverity;
  enabled?: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const CONTAINER = 'qc-rules';

export class QCRulesService {
  private readonly logger: Logger;
  private readonly dbService: CosmosDbService;

  constructor(dbService?: CosmosDbService) {
    this.logger = new Logger('QCRulesService');
    this.dbService = dbService ?? new CosmosDbService();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.dbService.isDbConnected()) {
      await this.dbService.initialize();
    }
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listRules(tenantId: string, filters: QCRuleFilters = {}): Promise<QCRule[]> {
    await this.ensureInitialized();

    const conditions: string[] = [
      'c.type = "qc-rule"',
      'c.tenantId = @tenantId',
    ];
    const parameters: { name: string; value: unknown }[] = [
      { name: '@tenantId', value: tenantId },
    ];

    if (filters.category !== undefined) {
      conditions.push('c.category = @category');
      parameters.push({ name: '@category', value: filters.category });
    }
    if (filters.severity !== undefined) {
      conditions.push('c.severity = @severity');
      parameters.push({ name: '@severity', value: filters.severity });
    }
    if (filters.enabled !== undefined) {
      conditions.push('c.enabled = @enabled');
      parameters.push({ name: '@enabled', value: filters.enabled });
    }

    const query = `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.lastModified DESC`;
    const result = await this.dbService.queryItems<QCRule>(CONTAINER, query, parameters);

    if (!result.success) {
      this.logger.error('Failed to list QC rules', { error: result.error, tenantId });
      throw new Error(result.error?.message ?? 'Failed to list QC rules');
    }

    return result.data ?? [];
  }

  // ── Get ───────────────────────────────────────────────────────────────────

  async getRule(id: string, tenantId: string): Promise<QCRule> {
    await this.ensureInitialized();

    const result = await this.dbService.getItem<QCRule>(CONTAINER, id, tenantId);
    if (!result.success || !result.data) {
      throw new Error(`QC rule not found: ${id}`);
    }

    // Enforce tenant isolation
    if (result.data.tenantId !== tenantId) {
      throw new Error(`QC rule not found: ${id}`);
    }

    return result.data;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createRule(request: CreateQCRuleRequest, tenantId: string, userId: string): Promise<QCRule> {
    await this.ensureInitialized();

    this.validateRule(request);

    const now = new Date().toISOString();
    const rule: QCRule = {
      id: randomUUID(),
      type: 'qc-rule',
      tenantId,
      name: request.name.trim(),
      description: request.description.trim(),
      category: request.category,
      severity: request.severity,
      enabled: request.enabled ?? true,
      conditions: request.conditions,
      actions: request.actions,
      createdAt: now,
      lastModified: now,
      createdBy: userId,
    };

    const result = await this.dbService.createItem<QCRule>(CONTAINER, rule);
    if (!result.success || !result.data) {
      this.logger.error('Failed to create QC rule', { error: result.error, tenantId, name: request.name });
      throw new Error(result.error?.message ?? 'Failed to create QC rule');
    }

    this.logger.info('QC rule created', { id: result.data.id, name: rule.name, tenantId });
    return result.data;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateRule(id: string, updates: UpdateQCRuleRequest, tenantId: string): Promise<QCRule> {
    await this.ensureInitialized();

    // Verify ownership before updating
    await this.getRule(id, tenantId);

    const patch: Partial<QCRule> = {
      ...updates,
      lastModified: new Date().toISOString(),
    };
    if (typeof patch.name === 'string') patch.name = patch.name.trim();
    if (typeof patch.description === 'string') patch.description = patch.description.trim();

    const result = await this.dbService.updateItem<QCRule>(CONTAINER, id, patch, tenantId);
    if (!result.success || !result.data) {
      this.logger.error('Failed to update QC rule', { error: result.error, id, tenantId });
      throw new Error(result.error?.message ?? 'Failed to update QC rule');
    }

    this.logger.info('QC rule updated', { id, tenantId });
    return result.data;
  }

  // ── Toggle enabled ────────────────────────────────────────────────────────

  async toggleRule(id: string, tenantId: string): Promise<QCRule> {
    const existing = await this.getRule(id, tenantId);
    return this.updateRule(id, { enabled: !existing.enabled }, tenantId);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteRule(id: string, tenantId: string): Promise<void> {
    await this.ensureInitialized();

    // Verify ownership before deleting
    await this.getRule(id, tenantId);

    const result = await this.dbService.deleteItem(CONTAINER, id, tenantId);
    if (!result.success) {
      this.logger.error('Failed to delete QC rule', { error: result.error, id, tenantId });
      throw new Error(result.error?.message ?? 'Failed to delete QC rule');
    }

    this.logger.info('QC rule deleted', { id, tenantId });
  }

  // ── Duplicate ─────────────────────────────────────────────────────────────

  async duplicateRule(id: string, tenantId: string, userId: string): Promise<QCRule> {
    const source = await this.getRule(id, tenantId);
    return this.createRule(
      {
        name: `${source.name} (Copy)`,
        description: source.description,
        category: source.category,
        severity: source.severity,
        enabled: false, // duplicates start disabled — require deliberate activation
        conditions: source.conditions.map((c) => ({ ...c, id: randomUUID() })),
        actions: source.actions.map((a) => ({ ...a, id: randomUUID() })),
      },
      tenantId,
      userId
    );
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private validateRule(request: CreateQCRuleRequest): void {
    if (!request.name?.trim()) {
      throw new Error('Rule name is required');
    }
    if (!request.conditions?.length) {
      throw new Error('At least one condition is required');
    }
    if (!request.actions?.length) {
      throw new Error('At least one action is required');
    }
    for (const c of request.conditions) {
      if (!c.field) throw new Error(`Condition is missing a field: ${JSON.stringify(c)}`);
      if (!c.operator) throw new Error(`Condition is missing an operator: ${JSON.stringify(c)}`);
    }
    for (const a of request.actions) {
      if (!a.type) throw new Error(`Action is missing a type: ${JSON.stringify(a)}`);
    }
  }
}
