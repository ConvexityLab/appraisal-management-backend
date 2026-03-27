/**
 * Field/Desk Review Trigger Service (Phase 1.10)
 *
 * Evaluates completed appraisals against configurable trigger rules to determine
 * if a field review or desk review should be ordered. Rules check:
 *  - Value variance thresholds (appraisal vs AVM/contract price)
 *  - CU/SSR risk scores from GSE submission feedback
 *  - Investor overlay requirements
 *  - Property complexity flags (mixed-use, non-conforming, acreage, etc.)
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type ReviewType = 'FIELD_REVIEW' | 'DESK_REVIEW';

export type TriggerConditionField =
  | 'VALUE_VARIANCE_PCT'
  | 'CU_RISK_SCORE'
  | 'SSR_HARD_STOP_COUNT'
  | 'SSR_WARNING_COUNT'
  | 'LOAN_AMOUNT'
  | 'PROPERTY_AGE_YEARS'
  | 'GLA_VARIANCE_PCT'
  | 'CONDITION_RATING'
  | 'CUSTOM';

export type TriggerOperator = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ' | 'IN' | 'NOT_IN';

export interface TriggerCondition {
  field: TriggerConditionField;
  operator: TriggerOperator;
  value: number | string | string[];
  /** If field = CUSTOM, the Cosmos property path to evaluate */
  customFieldPath?: string;
}

export interface ReviewTriggerRule {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  isActive: boolean;
  /** Which review type this rule triggers */
  reviewType: ReviewType;
  /** ALL conditions must be met (AND logic) */
  conditions: TriggerCondition[];
  /** Investor overlay codes this rule applies to (empty = all) */
  investorOverlayCodes?: string[];
  /** Product types this rule applies to (empty = all) */
  applicableProductTypes?: string[];
  /** Priority: higher = evaluated first; first matching rule wins */
  priority: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TriggerEvaluationInput {
  orderId: string;
  tenantId: string;
  /** Appraised value */
  appraisedValue: number;
  /** AVM or contract price for variance computation */
  referenceValue?: number;
  /** CU risk score from UCDP submission */
  cuRiskScore?: number;
  /** Number of SSR hard-stop findings */
  ssrHardStopCount?: number;
  /** Number of SSR warning findings */
  ssrWarningCount?: number;
  /** Loan amount */
  loanAmount?: number;
  /** Property year built */
  propertyYearBuilt?: number;
  /** Reported GLA */
  reportedGLA?: number;
  /** Public-record GLA for variance */
  publicRecordGLA?: number;
  /** Condition rating (C1-C6) */
  conditionRating?: string;
  /** Investor overlay code */
  investorOverlayCode?: string;
  /** Product type of the order */
  productType?: string;
  /** Additional custom data keyed by field path */
  customData?: Record<string, unknown>;
}

export interface TriggerEvaluationResult {
  orderId: string;
  triggered: boolean;
  reviewType?: ReviewType;
  matchedRuleId?: string;
  matchedRuleName?: string;
  /** Detailed explanation of why the rule matched */
  reasons: string[];
  evaluatedAt: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class FieldReviewTriggerService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('FieldReviewTriggerService');
  }

  // ── Rule CRUD ──────────────────────────────────────────────────────────────

  async createRule(rule: Omit<ReviewTriggerRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReviewTriggerRule> {
    const now = new Date().toISOString();
    const record: ReviewTriggerRule = {
      ...rule,
      id: `frt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };

    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database container not initialized');
    await container.items.upsert({ ...record, type: 'review-trigger-rule' });

    this.logger.info('Review trigger rule created', { id: record.id, name: record.name, reviewType: record.reviewType });
    return record;
  }

  async updateRule(ruleId: string, tenantId: string, updates: Partial<Pick<ReviewTriggerRule, 'name' | 'description' | 'isActive' | 'conditions' | 'priority' | 'investorOverlayCodes' | 'applicableProductTypes'>>): Promise<ReviewTriggerRule> {
    const existing = await this.getRule(ruleId, tenantId);
    if (!existing) throw new Error(`Trigger rule not found: ${ruleId}`);

    const updated: ReviewTriggerRule = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database container not initialized');
    await container.items.upsert({ ...updated, type: 'review-trigger-rule' });

    this.logger.info('Review trigger rule updated', { id: ruleId });
    return updated;
  }

  async getRule(ruleId: string, tenantId: string): Promise<ReviewTriggerRule | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'review-trigger-rule' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: ruleId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources.length > 0 ? resources[0] as ReviewTriggerRule : null;
  }

  async getRules(tenantId: string, activeOnly = true): Promise<ReviewTriggerRule[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const activeFilter = activeOnly ? ' AND c.isActive = true' : '';
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'review-trigger-rule' AND c.tenantId = @tid${activeFilter} ORDER BY c.priority DESC`,
      parameters: [{ name: '@tid', value: tenantId }],
    }).fetchAll();

    return resources as ReviewTriggerRule[];
  }

  async deleteRule(ruleId: string, tenantId: string): Promise<void> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database container not initialized');

    try {
      await container.item(ruleId, tenantId).delete();
      this.logger.info('Review trigger rule deleted', { id: ruleId });
    } catch {
      this.logger.warn('Rule not found for deletion', { id: ruleId });
    }
  }

  // ── Evaluation ─────────────────────────────────────────────────────────────

  /**
   * Evaluate all active trigger rules against order data.
   * Returns the first matching rule (highest priority) or a non-triggered result.
   */
  async evaluate(input: TriggerEvaluationInput): Promise<TriggerEvaluationResult> {
    const rules = await this.getRules(input.tenantId);
    const computedValues = this.computeDerivedValues(input);

    for (const rule of rules) {
      // Filter by investor overlay
      if (rule.investorOverlayCodes && rule.investorOverlayCodes.length > 0) {
        if (!input.investorOverlayCode || !rule.investorOverlayCodes.includes(input.investorOverlayCode)) {
          continue;
        }
      }

      // Filter by product type
      if (rule.applicableProductTypes && rule.applicableProductTypes.length > 0) {
        if (!input.productType || !rule.applicableProductTypes.includes(input.productType)) {
          continue;
        }
      }

      const reasons: string[] = [];
      let allMatch = true;

      for (const condition of rule.conditions) {
        const actualValue = this.resolveFieldValue(condition, input, computedValues);
        const matched = this.evaluateCondition(condition.operator, actualValue, condition.value);

        if (matched) {
          reasons.push(this.describeMatch(condition, actualValue));
        } else {
          allMatch = false;
          break;
        }
      }

      if (allMatch && reasons.length > 0) {
        this.logger.info('Trigger rule matched', {
          orderId: input.orderId,
          ruleId: rule.id,
          reviewType: rule.reviewType,
          reasons,
        });

        return {
          orderId: input.orderId,
          triggered: true,
          reviewType: rule.reviewType,
          matchedRuleId: rule.id,
          matchedRuleName: rule.name,
          reasons,
          evaluatedAt: new Date().toISOString(),
        };
      }
    }

    return {
      orderId: input.orderId,
      triggered: false,
      reasons: [],
      evaluatedAt: new Date().toISOString(),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private computeDerivedValues(input: TriggerEvaluationInput): Record<string, number | undefined> {
    const valueVariancePct = (input.referenceValue && input.appraisedValue)
      ? Math.abs(input.appraisedValue - input.referenceValue) / input.referenceValue * 100
      : undefined;

    const glaVariancePct = (input.reportedGLA && input.publicRecordGLA)
      ? Math.abs(input.reportedGLA - input.publicRecordGLA) / input.publicRecordGLA * 100
      : undefined;

    const propertyAgeYears = input.propertyYearBuilt
      ? new Date().getFullYear() - input.propertyYearBuilt
      : undefined;

    return { valueVariancePct, glaVariancePct, propertyAgeYears };
  }

  private resolveFieldValue(
    condition: TriggerCondition,
    input: TriggerEvaluationInput,
    computed: Record<string, number | undefined>,
  ): number | string | undefined {
    switch (condition.field) {
      case 'VALUE_VARIANCE_PCT': return computed.valueVariancePct;
      case 'CU_RISK_SCORE': return input.cuRiskScore;
      case 'SSR_HARD_STOP_COUNT': return input.ssrHardStopCount;
      case 'SSR_WARNING_COUNT': return input.ssrWarningCount;
      case 'LOAN_AMOUNT': return input.loanAmount;
      case 'PROPERTY_AGE_YEARS': return computed.propertyAgeYears;
      case 'GLA_VARIANCE_PCT': return computed.glaVariancePct;
      case 'CONDITION_RATING': return input.conditionRating;
      case 'CUSTOM': {
        if (!condition.customFieldPath || !input.customData) return undefined;
        return input.customData[condition.customFieldPath] as string | number | undefined;
      }
      default: return undefined;
    }
  }

  private evaluateCondition(
    operator: TriggerOperator,
    actual: number | string | undefined,
    expected: number | string | string[],
  ): boolean {
    if (actual === undefined || actual === null) return false;

    switch (operator) {
      case 'GT': return typeof actual === 'number' && actual > (expected as number);
      case 'GTE': return typeof actual === 'number' && actual >= (expected as number);
      case 'LT': return typeof actual === 'number' && actual < (expected as number);
      case 'LTE': return typeof actual === 'number' && actual <= (expected as number);
      case 'EQ': return actual === expected;
      case 'NEQ': return actual !== expected;
      case 'IN': return Array.isArray(expected) && expected.includes(String(actual));
      case 'NOT_IN': return Array.isArray(expected) && !expected.includes(String(actual));
      default: return false;
    }
  }

  private describeMatch(condition: TriggerCondition, actualValue: number | string | undefined): string {
    const opLabels: Record<TriggerOperator, string> = {
      GT: '>', GTE: '>=', LT: '<', LTE: '<=', EQ: '=', NEQ: '!=', IN: 'in', NOT_IN: 'not in',
    };
    return `${condition.field} ${opLabels[condition.operator]} ${JSON.stringify(condition.value)} (actual: ${actualValue})`;
  }
}
