/**
 * Vendor Matching Rules Service
 *
 * Homegrown configurable rules engine for vendor matching.
 *
 * Rules are stored per-tenant in the 'vendor-matching-rules' Cosmos container
 * and evaluated at match-time against each (vendor, order) pair.
 *
 * Rule execution order:
 *   1. Deny rules  (hard exclusion — evaluated first; any single deny eliminates the vendor)
 *   2. Allow rules (whitelist — a matching allow reverses a deny from a lower-priority rule)
 *   3. Boost/Reduce rules (adjust numeric match score)
 *
 * This service is used by:
 *   - VendorMatchingEngine (called before scoring to filter ineligible vendors)
 *   - The API server's CRUD routes at GET/POST/PUT/DELETE /api/vendor-matching-rules
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type RuleAction = 'deny' | 'allow' | 'boost' | 'reduce';

export type RuleType =
  | 'license_required'
  | 'state_restriction'
  | 'min_performance_score'
  | 'blacklist'
  | 'whitelist'
  | 'required_capability'
  | 'max_order_value'
  | 'max_distance_miles'
  | 'property_type_restriction'
  | 'score_boost'
  | 'score_reduce';

export interface VendorMatchingRule {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  isActive: boolean;
  /** Lower number = evaluated first. Use 1-100 range. Deny rules should be ≤ 20. */
  priority: number;
  ruleType: RuleType;
  action: RuleAction;
  /** Vendor ID targeted by blacklist/whitelist rules. */
  vendorId?: string;
  /** Product types this rule applies to (empty = all). */
  productTypes?: string[];
  /** US state codes this rule applies to (empty = all). */
  states?: string[];
  /** Required license type (e.g. 'CertifiedResidential'). */
  requiredLicenseType?: string;
  /** Required capability string (must match vendor.capabilities[]). */
  requiredCapability?: string;
  /** Vendor must have performance score >= this to pass. */
  minPerformanceScore?: number;
  /** Order fee/value must be <= this USD amount. */
  maxOrderValueUsd?: number;
  /** Maximum driving distance in miles. */
  maxDistanceMiles?: number;
  /** Points to add (boost) or subtract (reduce) from the computed match score. */
  adjustmentPoints?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  type: 'vendor-matching-rule';
}

export type CreateVendorMatchingRuleInput = Omit<VendorMatchingRule, 'id' | 'createdAt' | 'updatedAt' | 'type'>;
export type UpdateVendorMatchingRuleInput = Partial<Omit<VendorMatchingRule, 'id' | 'tenantId' | 'createdAt' | 'type'>>;

export interface RuleEvaluationContext {
  vendor: {
    id: string;
    capabilities?: string[];
    licenseType?: string;
    performanceScore?: number;
    states?: string[];
    distance?: number | null;
  };
  order: {
    productType?: string;
    propertyState?: string;
    orderValueUsd?: number;
  };
}

export interface RuleEvaluationResult {
  eligible: boolean;
  /** Net score adjustment (positive = boost, negative = reduce). */
  scoreAdjustment: number;
  appliedRuleIds: string[];
  denyReasons: string[];
}

// ── Service ────────────────────────────────────────────────────────────────

export class VendorMatchingRulesService {
  private readonly logger = new Logger('VendorMatchingRulesService');

  constructor(private readonly dbService: CosmosDbService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async createRule(input: CreateVendorMatchingRuleInput): Promise<VendorMatchingRule> {
    const now = new Date().toISOString();
    const rule: VendorMatchingRule = {
      ...input,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      type: 'vendor-matching-rule',
    };
    await this.dbService.createDocument('vendor-matching-rules', rule);
    this.logger.info('Vendor matching rule created', { id: rule.id, tenantId: rule.tenantId, ruleType: rule.ruleType });
    return rule;
  }

  async getRule(id: string, tenantId: string): Promise<VendorMatchingRule | null> {
    const container = this.dbService.getContainer('vendor-matching-rules');
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tid AND c.type = 'vendor-matching-rule'`,
      parameters: [
        { name: '@id', value: id },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();
    return resources.length > 0 ? (resources[0] as VendorMatchingRule) : null;
  }

  async listRules(tenantId: string, activeOnly = false): Promise<VendorMatchingRule[]> {
    const container = this.dbService.getContainer('vendor-matching-rules');
    let query = `SELECT * FROM c WHERE c.tenantId = @tid AND c.type = 'vendor-matching-rule'`;
    if (activeOnly) query += ` AND c.isActive = true`;
    query += ` ORDER BY c.priority ASC`;
    const { resources } = await container.items.query({
      query,
      parameters: [{ name: '@tid', value: tenantId }],
    }).fetchAll();
    return resources as VendorMatchingRule[];
  }

  async updateRule(id: string, tenantId: string, updates: UpdateVendorMatchingRuleInput): Promise<VendorMatchingRule> {
    const existing = await this.getRule(id, tenantId);
    if (!existing) {
      throw new Error(`Vendor matching rule not found: id=${id} tenantId=${tenantId}`);
    }
    const updated: VendorMatchingRule = {
      ...existing,
      ...updates,
      id: existing.id,
      tenantId: existing.tenantId,
      createdAt: existing.createdAt,
      type: 'vendor-matching-rule',
      updatedAt: new Date().toISOString(),
    };
    await this.dbService.upsertDocument('vendor-matching-rules', updated);
    this.logger.info('Vendor matching rule updated', { id, tenantId });
    return updated;
  }

  async deleteRule(id: string, tenantId: string): Promise<void> {
    const container = this.dbService.getContainer('vendor-matching-rules');
    await container.item(id, tenantId).delete();
    this.logger.info('Vendor matching rule deleted', { id, tenantId });
  }

  // ── Rules Engine ──────────────────────────────────────────────────────────

  /**
   * Evaluate all active rules for a tenant against a vendor-order context.
   * Returns whether the vendor is eligible and the net score adjustment.
   */
  async evaluateRules(tenantId: string, ctx: RuleEvaluationContext): Promise<RuleEvaluationResult> {
    const rules = await this.listRules(tenantId, true);
    return this.applyRules(rules, ctx);
  }

  /**
   * Pure synchronous evaluation once rules are loaded.
   * Useful for bulk scoring where rules are loaded once and re-applied per vendor.
   */
  applyRules(rules: VendorMatchingRule[], ctx: RuleEvaluationContext): RuleEvaluationResult {
    const appliedRuleIds: string[] = [];
    const denyReasons: string[] = [];
    let scoreAdjustment = 0;
    const deniedRuleIds = new Set<string>();
    const allowOverrideIds = new Set<string>();

    // Sort by priority ascending (already sorted by DB query, but enforce here)
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sorted) {
      if (!this.ruleAppliesTo(rule, ctx)) continue;

      switch (rule.action) {
        case 'deny': {
          const reason = this.evalDenyRule(rule, ctx);
          if (reason) {
            denyReasons.push(reason);
            deniedRuleIds.add(rule.id);
            appliedRuleIds.push(rule.id);
          }
          break;
        }
        case 'allow': {
          // Allow (whitelist) — if this rule matches AND there's a deny, it overrides.
          if (this.evalAllowRule(rule, ctx)) {
            allowOverrideIds.add(rule.id);
            appliedRuleIds.push(rule.id);
          }
          break;
        }
        case 'boost': {
          const pts = rule.adjustmentPoints ?? 0;
          if (pts > 0) {
            scoreAdjustment += pts;
            appliedRuleIds.push(rule.id);
          }
          break;
        }
        case 'reduce': {
          const pts = rule.adjustmentPoints ?? 0;
          if (pts > 0) {
            scoreAdjustment -= pts;
            appliedRuleIds.push(rule.id);
          }
          break;
        }
      }
    }

    // Eligible if no deny reasons remain after allow overrides
    const effectiveDenies = denyReasons.filter((_, i) => {
      const denyId = [...deniedRuleIds][i];
      return !allowOverrideIds.has(denyId ?? '');
    });

    return {
      eligible: effectiveDenies.length === 0,
      scoreAdjustment,
      appliedRuleIds,
      denyReasons: effectiveDenies,
    };
  }

  // ── Private evaluation helpers ────────────────────────────────────────────

  private ruleAppliesTo(rule: VendorMatchingRule, ctx: RuleEvaluationContext): boolean {
    // Product type filter
    if (rule.productTypes && rule.productTypes.length > 0 && ctx.order.productType) {
      if (!rule.productTypes.includes(ctx.order.productType)) return false;
    }
    // State filter (only if the rule targets states and we have a property state)
    if (rule.states && rule.states.length > 0 && ctx.order.propertyState) {
      if (!rule.states.includes(ctx.order.propertyState)) return false;
    }
    return true;
  }

  /** Returns a human-readable deny reason, or null if the vendor passes this deny rule. */
  private evalDenyRule(rule: VendorMatchingRule, ctx: RuleEvaluationContext): string | null {
    switch (rule.ruleType) {
      case 'blacklist':
        return rule.vendorId === ctx.vendor.id ? `Vendor is blacklisted by rule "${rule.name}"` : null;

      case 'license_required':
        if (!rule.requiredLicenseType) return null;
        return ctx.vendor.licenseType !== rule.requiredLicenseType
          ? `Missing required license: ${rule.requiredLicenseType} (rule: "${rule.name}")`
          : null;

      case 'required_capability':
        if (!rule.requiredCapability) return null;
        return !(ctx.vendor.capabilities ?? []).includes(rule.requiredCapability)
          ? `Missing required capability: ${rule.requiredCapability} (rule: "${rule.name}")`
          : null;

      case 'min_performance_score':
        if (rule.minPerformanceScore == null) return null;
        return (ctx.vendor.performanceScore ?? 0) < rule.minPerformanceScore
          ? `Performance score ${ctx.vendor.performanceScore ?? 0} below minimum ${rule.minPerformanceScore} (rule: "${rule.name}")`
          : null;

      case 'max_order_value':
        if (rule.maxOrderValueUsd == null) return null;
        return (ctx.order.orderValueUsd ?? 0) > rule.maxOrderValueUsd
          ? `Order value $${ctx.order.orderValueUsd} exceeds maximum $${rule.maxOrderValueUsd} for this vendor (rule: "${rule.name}")`
          : null;

      case 'max_distance_miles':
        if (rule.maxDistanceMiles == null || ctx.vendor.distance == null) return null;
        return ctx.vendor.distance > rule.maxDistanceMiles
          ? `Vendor is ${ctx.vendor.distance?.toFixed(1)} miles away, exceeds limit of ${rule.maxDistanceMiles} miles (rule: "${rule.name}")`
          : null;

      case 'state_restriction':
        if (!rule.states || rule.states.length === 0) return null;
        if (!ctx.order.propertyState) return null;
        // deny if vendor does NOT have a license in the target state
        return !(ctx.vendor.states ?? []).includes(ctx.order.propertyState)
          ? `Vendor not licensed in ${ctx.order.propertyState} (rule: "${rule.name}")`
          : null;

      case 'property_type_restriction':
        // deny if productType is in the restricted list
        if (!rule.productTypes || rule.productTypes.length === 0) return null;
        return ctx.order.productType && rule.productTypes.includes(ctx.order.productType)
          ? `Vendor denied for product type ${ctx.order.productType} (rule: "${rule.name}")`
          : null;

      default:
        return null;
    }
  }

  /** Returns true if the allow/whitelist rule matches (override deny). */
  private evalAllowRule(rule: VendorMatchingRule, ctx: RuleEvaluationContext): boolean {
    if (rule.ruleType === 'whitelist' && rule.vendorId) {
      return rule.vendorId === ctx.vendor.id;
    }
    return false;
  }
}
