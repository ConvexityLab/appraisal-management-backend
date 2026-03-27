export interface RuleAction {
  type: string;
  fact_id: string;
  source: string;
  data: Record<string, any>;
}

export interface Rule {
  id: string;
  category?: string;
  name?: string;
  pattern_id?: string;
  salience?: number;
  conditions: Record<string, any>;
  actions: RuleAction[];
  canonical_override?: string;
  lender_override?: string;
}

export interface RuleSetMetadata {
  hierarchy_level?: string;
  lender_id?: string;
  program_id?: string;
  description?: string;
  version?: string;
  last_updated?: string;
}

export interface RuleSet {
  metadata: RuleSetMetadata;
  rules: Rule[];
}

export class RuleMergerService {
  /**
   * Merges multiple hierarchical rule sets (Canonical -> Lender -> Program)
   * into a single flat array suitable for the Prio evaluation engine.
   * Higher hierarchies override lower ones based on override IDs.
   */
  public static merge(
    canonical: RuleSet,
    lender?: RuleSet,
    program?: RuleSet
  ): RuleSet {
    const ruleMap = new Map<string, Rule>();

    // 1. Process Canonical Baseline
    for (const rule of canonical.rules) {
      ruleMap.set(rule.id, rule);
    }

    // 2. Process Lender Overlays
    if (lender?.rules && Array.isArray(lender.rules)) {
      for (const rule of lender.rules) {
        // If it flags a canonical rule to override, delete the canonical base
        if (rule.canonical_override && ruleMap.has(rule.canonical_override)) {
          ruleMap.delete(rule.canonical_override);
        }
        // Insert the overlay rule (it will be evaluated instead, or alongside if no override specified)
        ruleMap.set(rule.id, rule);
      }
    }

    // 3. Process Program Overlays
    if (program?.rules && Array.isArray(program.rules)) {
      for (const rule of program.rules) {
        if (rule.canonical_override && ruleMap.has(rule.canonical_override)) {
          ruleMap.delete(rule.canonical_override);
        }
        if (rule.lender_override && ruleMap.has(rule.lender_override)) {
          ruleMap.delete(rule.lender_override);
        }
        ruleMap.set(rule.id, rule);
      }
    }

    // Build the final merged output structure
    return {
      metadata: {
        hierarchy_level: "merged",
        description: "Dynamically merged rule set",
        version: "runtime-merged",
        last_updated: new Date().toISOString()
      },
      rules: Array.from(ruleMap.values())
    };
  }
}
