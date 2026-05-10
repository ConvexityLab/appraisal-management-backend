/**
 * VendorMatchingRulePackService — vendor-matching shim over
 * DecisionRulePackService (the new generic, category-parameterized service
 * introduced in Phase A of docs/DECISION_ENGINE_RULES_SURFACE.md).
 *
 * This class exists only to keep the original (pre-Phase-A) call sites and
 * tests working unchanged: every method forwards into the generic service
 * with `category: 'vendor-matching'` hard-wired. New code should use
 * `DecisionRulePackService` directly.
 *
 * Slated for removal once Phase C lands and the FE has migrated to the
 * generalized API surface.
 */

import { DecisionRulePackService } from './decision-rule-pack.service.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type {
  CreateRulePackInput,
  RulePackAuditEntry,
  RulePackDocument,
  VendorMatchingRuleDef,
} from '../types/vendor-matching-rule-pack.types.js';

const VENDOR_MATCHING_CATEGORY = 'vendor-matching';

type NewActivePackHook = (pack: RulePackDocument) => Promise<void>;

export class VendorMatchingRulePackService {
  private readonly inner: DecisionRulePackService;

  constructor(db: CosmosDbService) {
    this.inner = new DecisionRulePackService(db);
  }

  /** Direct access to the underlying generic service for new call sites. */
  get generic(): DecisionRulePackService {
    return this.inner;
  }

  // ── Hooks ──────────────────────────────────────────────────────────────

  onNewActivePack(hook: NewActivePackHook): void {
    this.inner.onNewActivePack(VENDOR_MATCHING_CATEGORY, async pack => {
      await hook(pack as RulePackDocument);
    });
  }

  // ── CRUD ───────────────────────────────────────────────────────────────

  async createVersion(input: CreateRulePackInput): Promise<RulePackDocument> {
    return this.inner.createVersion<VendorMatchingRuleDef>({
      ...input,
      category: VENDOR_MATCHING_CATEGORY,
    });
  }

  async getVersion(
    tenantId: string,
    packId: string,
    version: number,
  ): Promise<RulePackDocument | null> {
    return this.inner.getVersion<VendorMatchingRuleDef>(
      VENDOR_MATCHING_CATEGORY,
      tenantId,
      packId,
      version,
    );
  }

  async getActive(tenantId: string, packId: string): Promise<RulePackDocument | null> {
    return this.inner.getActive<VendorMatchingRuleDef>(
      VENDOR_MATCHING_CATEGORY,
      tenantId,
      packId,
    );
  }

  async listVersions(tenantId: string, packId: string): Promise<RulePackDocument[]> {
    return this.inner.listVersions<VendorMatchingRuleDef>(
      VENDOR_MATCHING_CATEGORY,
      tenantId,
      packId,
    );
  }

  async listAudit(tenantId: string, packId: string): Promise<RulePackAuditEntry[]> {
    return this.inner.listAudit(VENDOR_MATCHING_CATEGORY, tenantId, packId);
  }
}
