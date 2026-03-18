import { RuleDefinition, RuleSet } from '../types/rules.types';

export class RuleMergerService {
  /**
   * Merges multiple rule sets according to the hierarchy:
   * 1. Canonical (Baseline)
   * 2. Lender (Overrides Canonical)
   * 3. Program (Overrides Lender & Canonical)
   * 
   * @param canonicalSet The baseline UAD/GSE rules
   * @param lenderSet    Optional lender-specific overlays
   * @param programSet   Optional program-specific overlays
   * @returns            A single flattened RuleSet ready for the Prio Engine
   */
  public static mergeRuleSets(
    canonicalSet: RuleSet,
    lenderSet?: RuleSet,
    programSet?: RuleSet
  ): { rules: RuleDefinition[] } {
    // Start with a map of base rules for O(1) lookups by ID
    const mergedRules = new Map<string, RuleDefinition>();

    // Load Canonical
    if (canonicalSet?.rules) {
      for (const rule of canonicalSet.rules) {
        mergedRules.set(rule.id, { ...rule });
      }
    }

    // Apply Lender Overlays
    if (lenderSet?.rules) {
      this.applyOverlays(mergedRules, lenderSet.rules);
    }

    // Apply Program Overlays
    if (programSet?.rules) {
      this.applyOverlays(mergedRules, programSet.rules);
    }

    // Return the flat list of rules as expected by GenericRuleLoader
    return {
      rules: Array.from(mergedRules.values()),
    };
  }

  private static applyOverlays(targetMap: Map<string, RuleDefinition>, overlays: RuleDefinition[]) {
    for (const rule of overlays) {
      if (rule.canonical_override && targetMap.has(rule.canonical_override)) {
        // Replace the existing rule but maybe keep the original ID or use the new one?
        // Usually, we want the new one to fully replace the old node in RETE.
        // We delete the old ID so it doesn't fire twice, and insert the new rule.
        targetMap.delete(rule.canonical_override);
      }
      
      // If it also overrides a lender rule (from a program level), we might need logic for `lender_override` 
      // but for now we assume `canonical_override` acts as a generic "parent_override" pointer, 
      // or the ID itself matches. Let's support an explicitly defined `overrides` field in the future, 
      // but stick to `canonical_override` for now based on our schema.
      
      targetMap.set(rule.id, { ...rule });
    }
  }
}
