import { describe, it, expect } from 'vitest';
import { RuleMergerService, RuleSet } from '../RuleMergerService';

describe('RuleMergerService', () => {
  const canonicalRules: RuleSet = {
    metadata: { hierarchy_level: 'canonical' },
    rules: [
      {
        id: 'CANONICAL_001',
        conditions: { '>': [{ var: 'net_adjustment' }, 15] },
        actions: [{ type: 'assert', fact_id: 'violation', source: 'base', data: { limit: 15 } }]
      },
      {
        id: 'CANONICAL_002',
        conditions: { '==': [{ var: 'condition' }, 'C6'] },
        actions: [{ type: 'assert', fact_id: 'violation', source: 'base', data: { status: 'fatal' } }]
      }
    ]
  };

  const lenderRules: RuleSet = {
    metadata: { hierarchy_level: 'lender', lender_id: 'LENDER_A' },
    rules: [
      {
        id: 'LENDER_A_001',
        canonical_override: 'CANONICAL_001', // Should replace CANONICAL_001
        conditions: { '>': [{ var: 'net_adjustment' }, 10] },
        actions: [{ type: 'assert', fact_id: 'violation', source: 'lender', data: { limit: 10 } }]
      },
      {
        id: 'LENDER_A_ADDITIONAL_001',
        conditions: { '==': [{ var: 'zoning' }, 'Commercial'] },
        actions: [{ type: 'assert', fact_id: 'violation', source: 'lender', data: { status: 'fatal' } }]
      }
    ]
  };

  const programRules: RuleSet = {
    metadata: { hierarchy_level: 'program', program_id: 'PGM_X' },
    rules: [
      {
        id: 'PGM_X_001',
        lender_override: 'LENDER_A_001', // Should override the lender's override
        conditions: { '>': [{ var: 'net_adjustment' }, 5] },
        actions: [{ type: 'assert', fact_id: 'violation', source: 'program', data: { limit: 5 } }]
      }
    ]
  };

  it('should return only canonical rules if no overlays provided', () => {
    const merged = RuleMergerService.merge(canonicalRules);
    expect(merged.rules).toHaveLength(2);
    expect(merged.rules.map(r => r.id)).toEqual(['CANONICAL_001', 'CANONICAL_002']);
  });

  it('should apply lender overrides correctly', () => {
    const merged = RuleMergerService.merge(canonicalRules, lenderRules);
    
    // CANONICAL_001 should be gone, CANONICAL_002 + LENDER_A_001 + LENDER_A_ADDITIONAL_001 should exist
    expect(merged.rules).toHaveLength(3);
    
    const ids = merged.rules.map(r => r.id);
    expect(ids).not.toContain('CANONICAL_001');
    expect(ids).toContain('CANONICAL_002');
    expect(ids).toContain('LENDER_A_001');
    expect(ids).toContain('LENDER_A_ADDITIONAL_001');

    // Verify data reflects the overlay
    const netAdjRule = merged.rules.find(r => r.id === 'LENDER_A_001');
    expect(netAdjRule?.actions[0].data.limit).toBe(10);
  });

  it('should apply program overrides over lender and canonical correctly', () => {
    const merged = RuleMergerService.merge(canonicalRules, lenderRules, programRules);

    // LENDER_A_001 should be replaced by PGM_X_001
    const ids = merged.rules.map(r => r.id);
    expect(ids).not.toContain('CANONICAL_001');
    expect(ids).not.toContain('LENDER_A_001');
    expect(ids).toContain('PGM_X_001');
    
    const overrideChainRule = merged.rules.find(r => r.id === 'PGM_X_001');
    expect(overrideChainRule?.actions[0].data.limit).toBe(5);
  });
});
