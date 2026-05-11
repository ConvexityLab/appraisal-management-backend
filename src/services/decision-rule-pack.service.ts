/**
 * DecisionRulePackService — generic, category-parameterized AMS-side storage
 * for the rule packs that drive every decision-engine evaluator on the
 * platform (vendor matching, review programs, firing rules, Axiom criteria,
 * …). Phase A of docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * Replaces VendorMatchingRulePackService (which is now a thin shim that
 * forwards into this service with `category: 'vendor-matching'`).
 *
 * Storage model (unchanged from the vendor-matching prototype, just with
 * `category` lifted into a first-class column):
 *   - decision-rule-packs (Cosmos, partitioned by /tenantId)
 *     Immutable; one document per (tenantId, category, packId, version).
 *     Synthetic id `${tenantId}__${category}__${packId}__v${version}`
 *     enables fast point reads.
 *   - decision-rule-audit  (Cosmos, partitioned by /tenantId)
 *     Append-only; one row per CRUD action with a name-level diff against
 *     the parent version.
 *
 * Each category registers an `onNewActivePack` hook (typically wired to a
 * push client like `MopRulePackPusher`); the service fires the hook after
 * every successful create. Hook failures are logged but do NOT roll back
 * the storage write — AMS is the source of truth and failed pushes are
 * recovered out of band.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type {
  CreateRulePackInput,
  DecisionRuleCategory,
  RulePackAuditEntry,
  RulePackDocument,
} from '../types/decision-rule-pack.types.js';

const PACKS_CONTAINER = 'decision-rule-packs';
const AUDIT_CONTAINER = 'decision-rule-audit';

type NewActivePackHook = (pack: RulePackDocument<unknown>) => Promise<void>;

/**
 * Per-rule shape used by the validator. Only fields the generic service
 * needs to enforce uniqueness + diff are required; everything else is
 * category-specific and validated by the category's own validator.
 */
interface RuleWithName {
  name?: unknown;
  [k: string]: unknown;
}

export class DecisionRulePackService {
  private readonly logger = new Logger('DecisionRulePackService');
  /** Hooks keyed by category — each category registers its own push target. */
  private hooksByCategory: Map<DecisionRuleCategory, NewActivePackHook[]> = new Map();

  constructor(private readonly db: CosmosDbService) {}

  // ── Hooks ──────────────────────────────────────────────────────────────

  /**
   * Register a callback fired after every successful createVersion for the
   * given category. The callback runs OUT OF BAND of the create's success —
   * its failure does NOT roll back the create (rationale: AMS storage is
   * the source of truth; downstream pushes are best-effort and self-heal).
   */
  onNewActivePack(category: DecisionRuleCategory, hook: NewActivePackHook): void {
    const list = this.hooksByCategory.get(category) ?? [];
    list.push(hook);
    this.hooksByCategory.set(category, list);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────

  async createVersion<R = unknown>(
    input: CreateRulePackInput<R>,
  ): Promise<RulePackDocument<R>> {
    this.validateRules(input.rules);
    this.requireNonEmptyString('category', input.category);
    this.requireNonEmptyString('tenantId', input.tenantId);
    this.requireNonEmptyString('packId', input.packId);

    const existing = await this.getActive<R>(input.category, input.tenantId, input.packId);
    const newVersion = existing ? existing.version + 1 : 1;
    const parentVersion = existing ? existing.version : null;

    const now = new Date().toISOString();
    const newPack: RulePackDocument<R> = {
      id: this.composeId(input.tenantId, input.category, input.packId, newVersion),
      type: 'decision-rule-pack',
      category: input.category,
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
    // one 'active' per (tenantId, category, packId) eventually).
    if (existing) {
      const demoted: RulePackDocument<R> = { ...existing, status: 'inactive' };
      await this.db.upsertDocument(PACKS_CONTAINER, demoted);
    }

    await this.db.createDocument(PACKS_CONTAINER, newPack);

    const audit: RulePackAuditEntry = {
      id: uuidv4(),
      type: 'decision-rule-audit',
      category: input.category,
      tenantId: input.tenantId,
      packId: input.packId,
      fromVersion: parentVersion,
      toVersion: newVersion,
      action: parentVersion === null ? 'create' : 'update',
      ...(existing
        ? { diff: this.diffRules(existing.rules as RuleWithName[], input.rules as RuleWithName[]) }
        : {}),
      actor: input.createdBy,
      ...(input.reason ? { reason: input.reason } : {}),
      timestamp: now,
    };
    await this.db.createDocument(AUDIT_CONTAINER, audit);

    // Fire hooks last; their failure must not undo the storage write.
    const hooks = this.hooksByCategory.get(input.category) ?? [];
    await Promise.all(
      hooks.map(async hook => {
        try {
          await hook(newPack as RulePackDocument<unknown>);
        } catch (err) {
          this.logger.error('Rule-pack hook failed (best-effort; storage write succeeded)', {
            category: input.category,
            tenantId: input.tenantId,
            packId: input.packId,
            version: newVersion,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );

    this.logger.info('Rule pack version created', {
      category: input.category,
      tenantId: input.tenantId,
      packId: input.packId,
      version: newVersion,
      ruleCount: input.rules.length,
    });

    return newPack;
  }

  async getVersion<R = unknown>(
    category: DecisionRuleCategory,
    tenantId: string,
    packId: string,
    version: number,
  ): Promise<RulePackDocument<R> | null> {
    const result = await this.db.getItem<RulePackDocument<R>>(
      PACKS_CONTAINER,
      this.composeId(tenantId, category, packId, version),
      tenantId,
    );
    return result.success && result.data ? result.data : null;
  }

  async getActive<R = unknown>(
    category: DecisionRuleCategory,
    tenantId: string,
    packId: string,
  ): Promise<RulePackDocument<R> | null> {
    const all = await this.listVersions<R>(category, tenantId, packId);
    return all.find(p => p.status === 'active') ?? null;
  }

  async listVersions<R = unknown>(
    category: DecisionRuleCategory,
    tenantId: string,
    packId: string,
  ): Promise<RulePackDocument<R>[]> {
    return this.db.queryDocuments<RulePackDocument<R>>(
      PACKS_CONTAINER,
      `SELECT * FROM c
       WHERE c.type = 'decision-rule-pack'
         AND c.tenantId = @tenantId
         AND c.category = @category
         AND c.packId = @packId
       ORDER BY c.version DESC`,
      [
        { name: '@tenantId', value: tenantId },
        { name: '@category', value: category },
        { name: '@packId', value: packId },
      ],
    );
  }

  async listAudit(
    category: DecisionRuleCategory,
    tenantId: string,
    packId: string,
  ): Promise<RulePackAuditEntry[]> {
    return this.db.queryDocuments<RulePackAuditEntry>(
      AUDIT_CONTAINER,
      `SELECT * FROM c
       WHERE c.type = 'decision-rule-audit'
         AND c.tenantId = @tenantId
         AND c.category = @category
         AND c.packId = @packId
       ORDER BY c.timestamp DESC`,
      [
        { name: '@tenantId', value: tenantId },
        { name: '@category', value: category },
        { name: '@packId', value: packId },
      ],
    );
  }

  /**
   * Phase M.5 — cross-category tenant-wide audit feed. Returns every audit
   * row for the tenant, sorted by timestamp DESC. Single Cosmos query
   * (audit container is partitioned by `/tenantId`).
   */
  async listAuditForTenant(
    tenantId: string,
    opts: { limit?: number; sinceDays?: number; category?: DecisionRuleCategory; action?: string } = {},
  ): Promise<RulePackAuditEntry[]> {
    const limit = Math.min(Math.max(1, opts.limit ?? 200), 500);
    const params: Array<{ name: string; value: unknown }> = [
      { name: '@tenantId', value: tenantId },
      { name: '@limit', value: limit },
    ];
    let extra = '';
    if (opts.sinceDays !== undefined && Number.isFinite(opts.sinceDays) && opts.sinceDays > 0) {
      const sinceIso = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000).toISOString();
      extra += ' AND c.timestamp >= @sinceIso';
      params.push({ name: '@sinceIso', value: sinceIso });
    }
    if (opts.category) {
      extra += ' AND c.category = @category';
      params.push({ name: '@category', value: opts.category });
    }
    if (opts.action) {
      extra += ' AND c.action = @action';
      params.push({ name: '@action', value: opts.action });
    }
    return this.db.queryDocuments<RulePackAuditEntry>(
      AUDIT_CONTAINER,
      `SELECT TOP @limit * FROM c
       WHERE c.type = 'decision-rule-audit'
         AND c.tenantId = @tenantId
         ${extra}
       ORDER BY c.timestamp DESC`,
      params,
    );
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  private composeId(
    tenantId: string,
    category: DecisionRuleCategory,
    packId: string,
    version: number,
  ): string {
    return `${tenantId}__${category}__${packId}__v${version}`;
  }

  private requireNonEmptyString(field: string, value: unknown): void {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${field} is required and must be a non-empty string`);
    }
  }

  /**
   * Generic validation: every rule must be an object with a unique non-empty
   * `name`. Per-category schema validation (recognized fact_ids, action
   * shapes, etc.) is the category's responsibility — registered through
   * `CategoryDefinition.validateRules` in Phase B.
   */
  private validateRules(rules: unknown[]): void {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new Error('Rule pack must contain at least one rule (empty array rejected)');
    }
    const names = new Set<string>();
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i] as RuleWithName | null | undefined;
      if (!r || typeof r !== 'object') {
        throw new Error(`rules[${i}] must be an object`);
      }
      if (typeof r.name !== 'string' || r.name.trim() === '') {
        throw new Error(`rules[${i}].name is required and must be a non-empty string`);
      }
      if (names.has(r.name)) {
        throw new Error(`Duplicate rule name "${r.name}" — names must be unique within a pack`);
      }
      names.add(r.name);
    }
  }

  private diffRules(
    oldRules: RuleWithName[],
    newRules: RuleWithName[],
  ): { added: string[]; removed: string[]; modified: string[] } {
    const oldByName = new Map<string, RuleWithName>();
    for (const r of oldRules) {
      if (typeof r?.name === 'string') oldByName.set(r.name, r);
    }
    const newByName = new Map<string, RuleWithName>();
    for (const r of newRules) {
      if (typeof r?.name === 'string') newByName.set(r.name, r);
    }

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
