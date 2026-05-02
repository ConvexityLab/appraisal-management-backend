import { describe, expect, it } from 'vitest';
import { computeVerdictCounts } from '../../src/utils/verdict-counts.js';

describe('computeVerdictCounts', () => {
  it('counts pass / warning / fail evaluations and reports total criteria', () => {
    const result = computeVerdictCounts([
      { evaluation: 'pass' },
      { evaluation: 'pass' },
      { evaluation: 'warning' },
      { evaluation: 'fail' },
    ]);

    expect(result).toEqual({
      passCount: 2,
      warnCount: 1,
      failCount: 1,
      totalCount: 4,
    });
  });

  it('returns all-zero verdict counts but the correct totalCount when no criterion has a recognised evaluation', () => {
    const result = computeVerdictCounts([
      { evaluation: 'unknown' as unknown as string },
      { evaluation: null },
      {},
    ]);

    expect(result).toEqual({
      passCount: 0,
      warnCount: 0,
      failCount: 0,
      totalCount: 3,
    });
  });

  it('returns all-zero counts and totalCount=0 when given an empty array', () => {
    expect(computeVerdictCounts([])).toEqual({
      passCount: 0,
      warnCount: 0,
      failCount: 0,
      totalCount: 0,
    });
  });
});
