import { describe, expect, it } from 'vitest';
import {
  AxiomWebhookValidationError,
  parseAxiomWebhook,
} from '../../src/integrations/axiom/inbound.adapter.js';

describe('parseAxiomWebhook', () => {
  // ── Top-level shape rejection ─────────────────────────────────────────────
  describe('rejects non-object input', () => {
    it('throws on null', () => {
      expect(() => parseAxiomWebhook(null)).toThrow(AxiomWebhookValidationError);
    });
    it('throws on string', () => {
      expect(() => parseAxiomWebhook('hello')).toThrow(AxiomWebhookValidationError);
    });
    it('throws on array', () => {
      expect(() => parseAxiomWebhook([])).toThrow(AxiomWebhookValidationError);
    });
  });

  // ── EXECUTION ─────────────────────────────────────────────────────────────
  describe('EXECUTION', () => {
    it('parses a minimal completed EXECUTION envelope', () => {
      const event = parseAxiomWebhook({
        correlationType: 'EXECUTION',
        correlationId: 'exec-123',
        pipelineJobId: 'job-456',
        payload: { status: 'completed' },
      });
      expect(event.kind).toBe('execution');
      if (event.kind !== 'execution') throw new Error('discriminant');
      expect(event.correlationId).toBe('exec-123');
      expect(event.pipelineJobId).toBe('job-456');
      expect(event.status).toBe('completed');
    });

    it('reads status/result from root level when payload is absent (legacy mock shape)', () => {
      const event = parseAxiomWebhook({
        correlationType: 'EXECUTION',
        correlationId: 'exec-1',
        status: 'completed',
        result: { score: 87 },
      });
      if (event.kind !== 'execution') throw new Error('discriminant');
      expect(event.status).toBe('completed');
      expect(event.result).toEqual({ score: 87 });
    });

    it('payload-level fields take precedence over root-level fields', () => {
      const event = parseAxiomWebhook({
        correlationType: 'EXECUTION',
        correlationId: 'exec-1',
        status: 'completed',
        result: { score: 50 },
        payload: { status: 'failed', result: { score: 99 }, error: 'boom' },
      });
      if (event.kind !== 'execution') throw new Error('discriminant');
      expect(event.status).toBe('failed');
      expect(event.result).toEqual({ score: 99 });
      expect(event.error).toBe('boom');
    });

    it('rejects when correlationId is missing', () => {
      expect(() =>
        parseAxiomWebhook({ correlationType: 'EXECUTION', pipelineJobId: 'j1' }),
      ).toThrow(AxiomWebhookValidationError);
    });
  });

  // ── TAPE_LOAN ────────────────────────────────────────────────────────────
  describe('TAPE_LOAN', () => {
    it('splits the correlationId into jobId and loanNumber', () => {
      const event = parseAxiomWebhook({
        correlationType: 'TAPE_LOAN',
        correlationId: 'job-001::LN-9988',
        executionId: 'exec-5',
        payload: { status: 'completed' },
      });
      if (event.kind !== 'tape-loan') throw new Error('discriminant');
      expect(event.jobId).toBe('job-001');
      expect(event.loanNumber).toBe('LN-9988');
      expect(event.executionId).toBe('exec-5');
    });

    it('handles loanNumbers that contain colons', () => {
      const event = parseAxiomWebhook({
        correlationType: 'TAPE_LOAN',
        correlationId: 'job-001::LN:9988:b',
        payload: { status: 'completed' },
      });
      if (event.kind !== 'tape-loan') throw new Error('discriminant');
      expect(event.loanNumber).toBe('LN:9988:b');
    });

    it('rejects correlationId without "::"', () => {
      expect(() =>
        parseAxiomWebhook({
          correlationType: 'TAPE_LOAN',
          correlationId: 'job-001-LN-9988',
        }),
      ).toThrow(AxiomWebhookValidationError);
    });
  });

  // ── DOCUMENT ──────────────────────────────────────────────────────────────
  describe('DOCUMENT', () => {
    it('parses with documentId = correlationId', () => {
      const event = parseAxiomWebhook({
        correlationType: 'DOCUMENT',
        correlationId: 'doc-abc',
        executionId: 'exec-9',
        payload: { status: 'completed' },
      });
      if (event.kind !== 'document') throw new Error('discriminant');
      expect(event.documentId).toBe('doc-abc');
      expect(event.executionId).toBe('exec-9');
    });

    it('picks inlineResult from payload.result first', () => {
      const event = parseAxiomWebhook({
        correlationType: 'DOCUMENT',
        correlationId: 'doc-1',
        payload: { status: 'completed', result: { fromPayload: true } },
        result: { fromRoot: true },
        output: { fromOutput: true },
      });
      if (event.kind !== 'document') throw new Error('discriminant');
      expect(event.inlineResult).toEqual({ fromPayload: true });
    });

    it('falls back to result, then output, then data', () => {
      const eventA = parseAxiomWebhook({
        correlationType: 'DOCUMENT',
        correlationId: 'doc-1',
        payload: { status: 'completed' },
        output: { fromOutput: true },
      });
      if (eventA.kind !== 'document') throw new Error('discriminant');
      expect(eventA.inlineResult).toEqual({ fromOutput: true });

      const eventB = parseAxiomWebhook({
        correlationType: 'DOCUMENT',
        correlationId: 'doc-1',
        payload: { status: 'completed' },
        data: { fromData: true },
      });
      if (eventB.kind !== 'document') throw new Error('discriminant');
      expect(eventB.inlineResult).toEqual({ fromData: true });
    });

    it('skips empty result objects', () => {
      const event = parseAxiomWebhook({
        correlationType: 'DOCUMENT',
        correlationId: 'doc-1',
        payload: { status: 'completed', result: {} },
        output: { real: 'data' },
      });
      if (event.kind !== 'document') throw new Error('discriminant');
      expect(event.inlineResult).toEqual({ real: 'data' });
    });

    it('returns null inlineResult when no candidate has content', () => {
      const event = parseAxiomWebhook({
        correlationType: 'DOCUMENT',
        correlationId: 'doc-1',
        payload: { status: 'completed' },
      });
      if (event.kind !== 'document') throw new Error('discriminant');
      expect(event.inlineResult).toBeNull();
    });
  });

  // ── ORDER ─────────────────────────────────────────────────────────────────
  describe('ORDER', () => {
    it('strips ~r resubmit suffix from orderId', () => {
      const event = parseAxiomWebhook({
        correlationType: 'ORDER',
        correlationId: 'order-555~r1714780000000',
        pipelineJobId: 'job-1',
        payload: { status: 'completed', result: { overallRiskScore: 42 } },
      });
      if (event.kind !== 'order') throw new Error('discriminant');
      expect(event.correlationId).toBe('order-555~r1714780000000');
      expect(event.orderId).toBe('order-555');
      expect(event.result).toEqual({ overallRiskScore: 42 });
    });

    it('uses correlationId as orderId when no resubmit suffix', () => {
      const event = parseAxiomWebhook({
        correlationType: 'ORDER',
        correlationId: 'order-555',
        payload: { status: 'completed' },
      });
      if (event.kind !== 'order') throw new Error('discriminant');
      expect(event.orderId).toBe('order-555');
    });
  });

  // ── Status normalisation ──────────────────────────────────────────────────
  describe('status normalisation', () => {
    it('passes through canonical statuses', () => {
      for (const s of ['completed', 'failed', 'cancelled', 'running']) {
        const event = parseAxiomWebhook({
          correlationType: 'EXECUTION',
          correlationId: 'exec-1',
          payload: { status: s },
        });
        if (event.kind !== 'execution') throw new Error('discriminant');
        expect(event.status).toBe(s);
      }
    });

    it('coerces unknown status strings to "failed" (not "completed")', () => {
      // Must NOT default to completed — would silently treat garbage as success.
      const event = parseAxiomWebhook({
        correlationType: 'EXECUTION',
        correlationId: 'exec-1',
        payload: { status: 'mystery-state' },
      });
      if (event.kind !== 'execution') throw new Error('discriminant');
      expect(event.status).toBe('failed');
    });

    it('defaults missing status to "completed"', () => {
      // Matches existing controller behavior for legacy/mock shapes.
      const event = parseAxiomWebhook({
        correlationType: 'EXECUTION',
        correlationId: 'exec-1',
      });
      if (event.kind !== 'execution') throw new Error('discriminant');
      expect(event.status).toBe('completed');
    });
  });

  // ── Legacy / mock shape ────────────────────────────────────────────────
  describe('legacy mock shape', () => {
    it('parses { evaluationId, orderId, status }', () => {
      const event = parseAxiomWebhook({
        evaluationId: 'eval-1',
        orderId: 'order-1',
        status: 'completed',
      });
      if (event.kind !== 'legacy') throw new Error('discriminant');
      expect(event.evaluationId).toBe('eval-1');
      expect(event.orderId).toBe('order-1');
      expect(event.status).toBe('completed');
    });

    it('accepts an empty body as legacy with defaults', () => {
      // Legacy schema is permissive; empty body parses with all-null and
      // status defaulted to 'completed'. Caller is responsible for further
      // checks (e.g. requiring evaluationId+orderId before dispatching).
      const event = parseAxiomWebhook({});
      if (event.kind !== 'legacy') throw new Error('discriminant');
      expect(event.evaluationId).toBeNull();
      expect(event.orderId).toBeNull();
    });
  });

  // ── Discriminated rejection ───────────────────────────────────────────────
  describe('rejection vs. fall-through', () => {
    it('REJECTS bodies with a known correlationType but malformed shape', () => {
      // correlationType=EXECUTION is recognised, so we strict-validate.
      // No correlationId → 400.
      expect(() =>
        parseAxiomWebhook({ correlationType: 'EXECUTION' }),
      ).toThrow(AxiomWebhookValidationError);
    });

    it('FALLS THROUGH to legacy for unknown correlationType (forward-compat)', () => {
      // correlationType=PORTFOLIO is not in the discriminated union — instead
      // of strict-rejecting, the adapter routes to the legacy parser, which
      // is permissive. This preserves forward-compat: if Axiom adds a new
      // correlation type, our receiver logs and falls through rather than
      // hard-rejecting valid traffic.
      const event = parseAxiomWebhook({
        correlationType: 'PORTFOLIO',
        correlationId: 'p-1',
      });
      expect(event.kind).toBe('legacy');
    });
  });
});
