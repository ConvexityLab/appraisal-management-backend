/**
 * VendorMatchingRulePackService — AMS-side storage for per-tenant rule packs
 * consumed by the MOP vendor-matching evaluator.
 *
 * Phase 3 of docs/AUTO_ASSIGNMENT_REVIEW.md §13.4. AMS owns storage; MOP
 * caches compiled reasoners and is told about new versions via push (the
 * onNewActivePack hook fires after every successful create — the proxy
 * controller wires it to MOP's PUT /tenants/:tid/rules endpoint).
 *
 * Storage model:
 *   - vendor-matching-rule-packs (Cosmos, partitioned by /tenantId)
 *     Immutable; one document per (tenantId, packId, version). Synthetic id
 *     `${tenantId}__${packId}__v${version}` enables fast point reads.
 *   - vendor-matching-rule-audit (Cosmos, partitioned by /tenantId)
 *     Append-only; one row per CRUD action with a name-level diff against
 *     the parent version.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type {
  CreateRulePackInput,
  RulePackAuditEntry,
  RulePackDocument,
  VendorMatchingRuleDef,
} from '../types/vendor-matching-rule-pack.types.js';

const PACKS_CONTAINER = 'vendor-matching-rule-packs';
const AUDIT_CONTAINER = 'vendor-matching-rule-audit';

type NewActivePackHook = (pack: RulePackDocument) => Promise<void>;

export class VendorMatchingRulePackService {
  private readonly logger = new Logger('VendorMatchingRulePackService');
  private hooks: NewActivePackHook[] = [];

  constructor(private readonly db: CosmosDbService) {}

  // ── Hooks ──────────────────────────────────────────────────────────────

  /**
   * Register a callback fired after every successful createVersion. The
   * callback runs OUT OF BAND of the create's success — its failure does
   * NOT roll back the create (rationale: AMS storage is the source of
   * truth; MOP push is best-effort and self-heals on the next call or
   * via the startup re-seeder).
   */
  onNewActivePack(hook: NewActivePackHook): void {
    this.hooks.push(hook);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────

  async createVersion(input: CreateRulePackInput): Promise<RulePackDocument> {
    this.validateRules(input.rules);

    const existing = await this.getActive(input.tenantId, input.packId);
    const newVersion = existing ? existing.version + 1 : 1;
    const parentVersion = existing ? existing.version : null;

    const now = new Date().toISOString();
    const newPack: RulePackDocument = {
      id: this.packId(input.tenantId, input.packId, newVersion),
      type: 'vendor-matching-rule-pack',
      tenantId: input.tenantId,
      packId: input.packId,
      version: newVersion,
      parentVersion,
      status: 'active',
      rules: input.rules,
      metadata: input.metadata ?? {},
      createdAt: now,
      createdBy: input.createdBy,
    };

    // Demote the previous active version BEFORE writing the new one so two
    // concurrent creates don't both end up with status='active' on overlap
    // (last-writer-wins on the demoted doc, but invariant holds: at most
    // one 'active' per (tenantId, packId) eventually).
    if (existing) {
      const demoted: RulePackDocument = { ...existing, status: 'inactive' };
      await this.db.upsertDocument(PACKS_CONTAINER, demoted);
    }

    await this.db.createDocument(PACKS_CONTAINER, newPack);

    // Audit row.
    const audit: RulePackAuditEntry = {
      id: uuidv4(),
      type: 'vendor-matching-rule-audit',
      tenantId: input.tenantId,
      packId: input.packId,
      fromVersion: parentVersion,
      toVersion: newVersion,
      action: parentVersion === null ? 'create' : 'update',
      ...(existing
        ? { diff: this.diffRules(existing.rules, input.rules) }
        : {}),
      actor: input.createdBy,
      ...(input.reason ? { reason: input.reason } : {}),
      timestamp: now,
    };
    await this.db.createDocument(AUDIT_CONTAINER, audit);

    // Fire hooks last; their failure must not undo the storage write.
    await Promise.all(
      this.hooks.map(async hook => {
        try {
          await hook(newPack);
        } catch (err) {
          this.logger.error('Rule-pack hook failed (best-effort; storage write succeeded)', {
            tenantId: input.tenantId,
            packId: input.packId,
            version: newVersion,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );

    this.logger.info('Rule pack version created', {
      tenantId: input.tenantId,
      packId: input.packId,
      version: newVersion,
      ruleCount: input.rules.length,
    });

    return newPack;
  }

  async getVersion(
    tenantId: string,
    packId: string,
    version: number,
  ): Promise<RulePackDocument | null> {
    const result = await this.db.getItem<RulePackDocument>(
      PACKS_CONTAINER,
      this.packId(tenantId, packId, version),
      tenantId,
    );
    return result.success && result.data ? result.data : null;
  }

  async getActive(tenantId: string, packId: string): Promise<RulePackDocument | null> {
    const all = await this.listVersions(tenantId, packId);
    return all.find(p => p.status === 'active') ?? null;
  }

  async listVersions(tenantId: string, packId: string): Promise<RulePackDocument[]> {
    const docs = await this.db.queryDocuments<RulePackDocument>(
      PACKS_CONTAINER,
      `SELECT * FROM c
       WHERE c.type = 'vendor-matching-rule-pack'
         AND c.tenantId = @tenantId
         AND c.packId = @packId
       ORDER BY c.version DESC`,
      [
        { name: '@tenantId', value: tenantId },
        { name: '@packId', value: packId },
      ],
    );
    return docs;
  }

  async listAudit(tenantId: string, packId: string): Promise<RulePackAuditEntry[]> {
    const docs = await this.db.queryDocuments<RulePackAuditEntry>(
      AUDIT_CONTAINER,
      `SELECT * FROM c
       WHERE c.type = 'vendor-matching-rule-audit'
         AND c.tenantId = @tenantId
         AND c.packId = @packId
       ORDER BY c.timestamp DESC`,
      [
        { name: '@tenantId', value: tenantId },
        { name: '@packId', value: packId },
      ],
    );
    return docs;
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  private packId(tenantId: string, packId: string, version: number): string {
    return `${tenantId}__${packId}__v${version}`;
  }

  /**
   * Light validation. Heavy schema validation (e.g. unrecognized fact_id)
   * happens server-side in MOP via VendorMatchingService::validateRulesJson;
   * this layer only catches the obviously-broken inputs that would never
   * round-trip through MOP.
   */
  private validateRules(rules: VendorMatchingRuleDef[]): void {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new Error('Rule pack must contain at least one rule (empty array rejected)');
    }
    const names = new Set<string>();
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i]!;
      if (!r.name || typeof r.name !== 'string') {
        throw new Error(`rules[${i}].name is required and must be a non-empty string`);
      }
      if (names.has(r.name)) {
        throw new Error(`Duplicate rule name "${r.name}" — names must be unique within a pack`);
      }
      names.add(r.name);
      if (!r.pattern_id || typeof r.pattern_id !== 'string') {
        throw new Error(`rules[${i}].pattern_id is required (rule "${r.name}")`);
      }
      if (typeof r.salience !== 'number') {
        throw new Error(`rules[${i}].salience must be a number (rule "${r.name}")`);
      }
      if (!r.conditions || typeof r.conditions !== 'object') {
        throw new Error(`rules[${i}].conditions must be an object (rule "${r.name}")`);
      }
      if (!Array.isArray(r.actions) || r.actions.length === 0) {
        throw new Error(`rules[${i}].actions must be a non-empty array (rule "${r.name}")`);
      }
    }
  }

  private diffRules(
    oldRules: VendorMatchingRuleDef[],
    newRules: VendorMatchingRuleDef[],
  ): { added: string[]; removed: string[]; modified: string[] } {
    const oldByName = new Map(oldRules.map(r => [r.name, r]));
    const newByName = new Map(newRules.map(r => [r.name, r]));

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    for (const [name, newRule] of newByName) {
      if (!oldByName.has(name)) {
        added.push(name);
      } else {
        const oldRule = oldByName.get(name)!;
        if (JSON.stringify(oldRule) !== JSON.stringify(newRule)) {
          modified.push(name);
        }
      }
    }
    for (const name of oldByName.keys()) {
      if (!newByName.has(name)) removed.push(name);
    }

    return { added, removed, modified };
  }
}
