export type RuleSeverity = 'Warning' | 'Fatal' | 'Info';

export interface RuleCondition {
  [operator: string]: any;
}

export interface RuleAction {
  type: string;
  fact_id: string;
  source: string;
  data: {
    severity: RuleSeverity;
    reason: string;
    violation_code: string;
    [key: string]: any;
  };
}

export interface RuleDefinition {
  id: string;
  category: string;
  name: string;
  pattern_id: string;
  salience: number;
  conditions: RuleCondition;
  actions: RuleAction[];
  canonical_override?: string; // If this rule overrides a baseline canonical rule
}

export interface RuleSetMetadata {
  hierarchy_level: 'canonical' | 'lender' | 'program';
  lender_id?: string;
  program_id?: string;
  description: string;
  version: string;
  last_updated: string;
}

export interface RuleSet {
  metadata: RuleSetMetadata;
  rules: RuleDefinition[];
}
