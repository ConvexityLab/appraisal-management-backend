/**
 * MOP Criteria Types
 *
 * Mirrors the Axiom criteria-program hierarchy but is wholly owned by this
 * platform.  MOP/Prio is a stateless deterministic engine that has no criteria
 * store of its own, so we store and compile the rule definitions here.
 *
 * Storage: `mop-criteria` Cosmos container (partition key: /clientId)
 *
 * Compilation hierarchy (same pattern as Axiom):
 *
 *   canonical  (clientId = null)   — platform-wide base rules
 *       ↓  deep-merge on top
 *   client     (clientId = string) — client-specific overrides/additions
 *
 * The compiled result (canonical + client merged) is what gets sent to the
 * MOP_PRIO engine at dispatch time.  Results are cached in-process with a
 * configurable TTL, just like AxiomService.compileCache.
 */

import type {
  ReviewThresholds,
  ReviewProgramAutoFlagDef,
  ReviewProgramManualFlagDef,
  ReviewDecisionRules,
} from './review-tape.types.js';

// ─── Tier ─────────────────────────────────────────────────────────────────────

/**
 * Which layer of the compilation hierarchy this document represents.
 *
 * canonical — platform-wide base definition (clientId must be null)
 * client    — client-specific delta; merged on top of canonical at compile time
 */
export type MopCriteriaTier = 'canonical' | 'client';

// ─── Definition document (stored in Cosmos) ───────────────────────────────────

/**
 * A versioned MOP rule-set definition.
 * One document per (programId + programVersion + tier + clientId) tuple.
 *
 * programId identifies the logical rule set name: e.g. "vision-appraisal",
 * "fnma-full", "dscr-bridge".  programVersion is the semver-style version
 * string for that logical set.
 *
 * To override a specific rule at the client level, create a `client` tier
 * document with the same programId + programVersion and set only the fields
 * that differ.  The compilation service merges client on top of canonical.
 */
export interface MopCriteriaDefinition {
  /** Cosmos document id — conventionally: "{tier}-{programId}-{programVersion}[-{clientId}]" */
  id: string;
  /** Logical name for this rule set: e.g. "vision-appraisal", "fnma-full" */
  programId: string;
  /** SemVer-style version string: e.g. "1.0", "2.1" */
  programVersion: string;
  /** Which layer of the hierarchy this document represents */
  tier: MopCriteriaTier;
  /** null = platform canonical (all clients); string = client-specific override */
  clientId: string | null;
  /** Tenant this definition belongs to; undefined = platform-wide canonical */
  tenantId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  createdAt: string;
  updatedAt: string;

  // ── Rule payload ─────────────────────────────────────────────────────────
  // On a canonical document these are all required.
  // On a client document these are partial — only the fields being overridden
  // need to be present.  The compilation service deep-merges client on top of
  // canonical before the merged result is sent to MOP_PRIO.

  /** Numeric thresholds driving flag evaluation */
  thresholds: ReviewThresholds;
  /** Auto-computed flag definitions */
  autoFlags: ReviewProgramAutoFlagDef[];
  /** Manual (Y/N field) flag definitions */
  manualFlags: ReviewProgramManualFlagDef[];
  /** Score-band → decision mapping */
  decisionRules: ReviewDecisionRules;
}

// ─── Compiled result (in-memory cache value) ──────────────────────────────────

/**
 * The result returned by MopCriteriaService.getCompiledCriteria().
 * Contains the fully merged rule set ready to pass to the MOP_PRIO engine.
 */
export interface MopCriteriaCompileResult {
  /** Merged rule set (canonical + client overrides applied) */
  criteria: MopCriteriaDefinition;
  /** true when the result was served from the in-memory cache */
  cached: boolean;
  metadata: {
    programId: string;
    programVersion: string;
    clientId: string;
    tenantId: string;
    compiledAt: string;
    /** Whether a client-tier override document was found and merged */
    hasClientOverride: boolean;
  };
}
