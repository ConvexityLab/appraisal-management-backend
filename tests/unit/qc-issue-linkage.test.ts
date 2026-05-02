import { describe, expect, it } from 'vitest';
import { buildQCIssueLinkage } from '../../src/utils/qc-issue-linkage.js';

describe('buildQCIssueLinkage', () => {
  it('includes all three linkage fields when mapped + meta carry them', () => {
    const linkage = buildQCIssueLinkage({
      mapped: { programId: 'urar-1004', programVersion: '2.0' },
      meta: { runId: 'run-700' },
    });

    expect(linkage).toEqual({
      programId: 'urar-1004',
      programVersion: '2.0',
      sourceRunId: 'run-700',
    });
  });

  it('omits programId when missing or empty', () => {
    expect(buildQCIssueLinkage({ mapped: { programVersion: '2.0' }, meta: { runId: 'r' } }))
      .toEqual({ programVersion: '2.0', sourceRunId: 'r' });
    expect(buildQCIssueLinkage({ mapped: { programId: '', programVersion: '2.0' }, meta: { runId: 'r' } }))
      .toEqual({ programVersion: '2.0', sourceRunId: 'r' });
  });

  it('omits programVersion when missing', () => {
    expect(buildQCIssueLinkage({ mapped: { programId: 'p' }, meta: { runId: 'r' } }))
      .toEqual({ programId: 'p', sourceRunId: 'r' });
  });

  it('omits sourceRunId when meta.runId is missing or non-string', () => {
    expect(buildQCIssueLinkage({ mapped: { programId: 'p', programVersion: 'v' }, meta: {} }))
      .toEqual({ programId: 'p', programVersion: 'v' });
    expect(buildQCIssueLinkage({ mapped: { programId: 'p' }, meta: { runId: 42 as unknown } }))
      .toEqual({ programId: 'p' });
  });

  it('returns an empty linkage when nothing is in scope', () => {
    expect(buildQCIssueLinkage({})).toEqual({});
    expect(buildQCIssueLinkage({ mapped: {}, meta: {} })).toEqual({});
  });
});
