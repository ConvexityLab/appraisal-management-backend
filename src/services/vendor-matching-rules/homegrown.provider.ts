/**
 * HomegrownVendorMatchingRulesProvider
 *
 * Adapter over the in-process VendorMatchingRulesService. Loads active rules
 * from Cosmos once per request, then applies them synchronously to each
 * vendor context. This is the safety-net implementation — preserves the
 * Phase 1 behavior verbatim and is what the fallback provider degrades to
 * when MOP is unavailable.
 */

import { Logger } from '../../utils/logger.js';
import {
  VendorMatchingRulesService,
  type RuleEvaluationContext,
  type RuleEvaluationResult,
  type VendorMatchingRule,
} from '../vendor-matching-rules.service.js';
import type { VendorMatchingRulesProvider } from './provider.types.js';

export class HomegrownVendorMatchingRulesProvider implements VendorMatchingRulesProvider {
  readonly name = 'homegrown' as const;
  private readonly logger = new Logger('HomegrownRulesProvider');

  constructor(private readonly rulesService: VendorMatchingRulesService) {}

  async evaluateForVendors(
    tenantId: string,
    contexts: RuleEvaluationContext[]
  ): Promise<RuleEvaluationResult[]> {
    if (contexts.length === 0) return [];

    let rules: VendorMatchingRule[] = [];
    try {
      rules = await this.rulesService.listRules(tenantId, true);
    } catch (err) {
      // Fail open: with no rules loaded, every vendor passes with no adjustment.
      // The matching engine's pre-rules hard gates still apply.
      this.logger.error('Failed to load rules; treating all vendors as eligible', err as Record<string, any>);
      return contexts.map(() => ({
        eligible: true,
        scoreAdjustment: 0,
        appliedRuleIds: [],
        denyReasons: [],
      }));
    }

    return contexts.map(ctx => this.rulesService.applyRules(rules, ctx));
  }

  async isHealthy(): Promise<boolean> {
    // The homegrown service has no external dependency beyond Cosmos, which
    // the engine already depends on. Always healthy from this provider's
    // perspective; Cosmos failures surface inside evaluateForVendors and
    // are caught there.
    return true;
  }
}
