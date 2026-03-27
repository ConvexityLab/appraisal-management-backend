import { RuleMergerService } from '../../services/rule-merger.service';
import { RuleSet } from '../../types/rules.types';

describe('RuleMergerService', () => {
  it('should merge canonical, lender, and program rules correctly', () => {
    const canonical: RuleSet = {
      metadata: { hierarchy_level: 'canonical', description: '', version: '1', last_updated: '' },
      rules: [
        {
          id: 'CANONICAL_01',
          category: 'Valuation',
          name: 'Baseline_Rule',
          pattern_id: 'data',
          salience: 100,
          conditions: { '==': [{ var: 'status' }, 'ok'] },
          actions: []
        }
      ]
    };

    const lenderOverlay: RuleSet = {
      metadata: { hierarchy_level: 'lender', lender_id: 'CHASE', description: '', version: '1', last_updated: '' },
      rules: [
        {
          id: 'CHASE_01',
          canonical_override: 'CANONICAL_01',
          category: 'Valuation',
          name: 'Chase_Stricter_Rule',
          pattern_id: 'data',
          salience: 110,
          conditions: { '==': [{ var: 'status' }, 'strict_ok'] },
          actions: []
        },
        {
          id: 'CHASE_02', // Net new rule
          category: 'Valuation',
          name: 'Chase_New_Rule',
          pattern_id: 'data',
          salience: 50,
          conditions: { '==': [{ var: 'other' }, true] },
          actions: []
        }
      ]
    };

    const merged = RuleMergerService.mergeRuleSets(canonical, lenderOverlay);
    
    expect(merged.rules.length).toBe(2);
    // CANONICAL_01 should be removed, CHASE_01 taking its place
    expect(merged.rules.find(r => r.id === 'CANONICAL_01')).toBeUndefined();
    expect(merged.rules.find(r => r.id === 'CHASE_01')).toBeDefined();
    expect(merged.rules.find(r => r.id === 'CHASE_02')).toBeDefined();
  });
});
