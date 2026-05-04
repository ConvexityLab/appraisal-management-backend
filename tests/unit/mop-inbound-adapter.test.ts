import { describe, expect, it } from 'vitest';
import {
  MopResponseValidationError,
  normaliseMopStatus,
  parseMopDispatchResponse,
  parseMopRefreshResponse,
  parsePrioEvaluationResponse,
} from '../../src/integrations/mop/inbound.adapter.js';

describe('normaliseMopStatus', () => {
  it('maps completed/success → completed', () => {
    expect(normaliseMopStatus('completed')).toBe('completed');
    expect(normaliseMopStatus('success')).toBe('completed');
    expect(normaliseMopStatus('SUCCESS')).toBe('completed');
  });
  it('maps failed/error → failed', () => {
    expect(normaliseMopStatus('failed')).toBe('failed');
    expect(normaliseMopStatus('error')).toBe('failed');
  });
  it('maps queued/pending → queued', () => {
    expect(normaliseMopStatus('queued')).toBe('queued');
    expect(normaliseMopStatus('pending')).toBe('queued');
  });
  it('defaults unknown statuses to running', () => {
    expect(normaliseMopStatus('processing')).toBe('running');
    expect(normaliseMopStatus('mystery')).toBe('running');
  });
});

describe('parseMopDispatchResponse', () => {
  it('parses a runId-keyed response', () => {
    const out = parseMopDispatchResponse(
      { runId: 'run-123', status: 'queued', engineVersion: 'mop-prio-2' },
      'mop-prio-current',
    );
    expect(out).toEqual({
      engineRunRef: 'run-123',
      providerStatus: 'queued',
      runStatus: 'queued',
      engineVersion: 'mop-prio-2',
    });
  });

  it('falls back to jobId when runId missing', () => {
    const out = parseMopDispatchResponse(
      { jobId: 'job-456', status: 'completed' },
      'mop-prio-current',
    );
    expect(out.engineRunRef).toBe('job-456');
    expect(out.runStatus).toBe('completed');
  });

  it('uses fallback engineVersion when not present in response', () => {
    const out = parseMopDispatchResponse(
      { runId: 'r-1', status: 'queued' },
      'mop-prio-fallback',
    );
    expect(out.engineVersion).toBe('mop-prio-fallback');
  });

  it('lowercases providerStatus for downstream comparison', () => {
    const out = parseMopDispatchResponse(
      { runId: 'r-1', status: 'COMPLETED' },
      'mop-prio-current',
    );
    expect(out.providerStatus).toBe('completed');
    expect(out.runStatus).toBe('completed');
  });

  it('rejects when neither runId nor jobId is present', () => {
    expect(() =>
      parseMopDispatchResponse({ status: 'queued' }, 'mop-prio-current'),
    ).toThrow(MopResponseValidationError);
  });

  it('rejects when status is missing', () => {
    expect(() =>
      parseMopDispatchResponse({ runId: 'r-1' }, 'mop-prio-current'),
    ).toThrow(MopResponseValidationError);
  });

  it('rejects non-object input', () => {
    expect(() =>
      parseMopDispatchResponse(null, 'mop-prio-current'),
    ).toThrow(MopResponseValidationError);
    expect(() =>
      parseMopDispatchResponse('string', 'mop-prio-current'),
    ).toThrow(MopResponseValidationError);
    expect(() =>
      parseMopDispatchResponse([], 'mop-prio-current'),
    ).toThrow(MopResponseValidationError);
  });

  it('preserves additional unknown fields (passthrough)', () => {
    // Adding new MOP response fields shouldn't break ingestion.
    const out = parseMopDispatchResponse(
      { runId: 'r-1', status: 'queued', futureField: { x: 1 } },
      'mop-prio-current',
    );
    expect(out.engineRunRef).toBe('r-1');
  });
});

describe('parseMopRefreshResponse', () => {
  it('parses status-only response', () => {
    const out = parseMopRefreshResponse({ status: 'running' });
    expect(out).toEqual({
      providerStatus: 'running',
      runStatus: 'running',
      engineVersion: null,
    });
  });

  it('returns engineVersion when present', () => {
    const out = parseMopRefreshResponse({ status: 'completed', engineVersion: 'mop-prio-3' });
    expect(out.engineVersion).toBe('mop-prio-3');
  });

  it('rejects when status is missing', () => {
    expect(() => parseMopRefreshResponse({})).toThrow(MopResponseValidationError);
  });
});

describe('parsePrioEvaluationResponse', () => {
  it('extracts compliance violations and projects to RuleViolation', () => {
    const out = parsePrioEvaluationResponse({
      actions_fired: [
        {
          fact_id: 'compliance_violation',
          source: 'RULE-001',
          data: { severity: 'Critical', reason: 'GLA mismatch', violation_code: 'GLA-DIFF' },
        },
        {
          fact_id: 'compliance_violation',
          source: 'RULE-002',
          data: { severity: 'Warning', reason: 'Comp age > 12 months', violation_code: 'COMP-AGE' },
        },
        // Non-compliance action — should be ignored
        { fact_id: 'something_else', source: 'X', data: { foo: 'bar' } },
      ],
      processing_time_ms: 142,
    });
    expect(out.violations).toEqual([
      { rule_id: 'RULE-001', severity: 'Critical', reason: 'GLA mismatch', violation_code: 'GLA-DIFF' },
      { rule_id: 'RULE-002', severity: 'Warning', reason: 'Comp age > 12 months', violation_code: 'COMP-AGE' },
    ]);
    expect(out.processingTimeMs).toBe(142);
  });

  it('uses defaults for missing rule_id / severity / reason / violation_code', () => {
    const out = parsePrioEvaluationResponse({
      actions_fired: [
        { fact_id: 'compliance_violation', data: {} },
      ],
    });
    expect(out.violations[0]).toEqual({
      rule_id: 'UNKNOWN_RULE',
      severity: 'Warning',
      reason: 'Unknown violation occurred',
      violation_code: 'UNKNOWN_CODE',
    });
  });

  it('returns empty violations when actions_fired is missing', () => {
    const out = parsePrioEvaluationResponse({});
    expect(out.violations).toEqual([]);
    expect(out.processingTimeMs).toBeNull();
  });

  it('returns empty violations when actions_fired is empty', () => {
    const out = parsePrioEvaluationResponse({ actions_fired: [] });
    expect(out.violations).toEqual([]);
  });

  it('rejects non-object input', () => {
    expect(() => parsePrioEvaluationResponse(null)).toThrow(MopResponseValidationError);
    expect(() => parsePrioEvaluationResponse([])).toThrow(MopResponseValidationError);
  });

  it('rejects when actions_fired is not an array', () => {
    expect(() =>
      parsePrioEvaluationResponse({ actions_fired: { foo: 'bar' } }),
    ).toThrow(MopResponseValidationError);
  });
});
