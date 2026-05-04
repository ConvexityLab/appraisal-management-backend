/**
 * B0.4 — buildAxiomLogPayload: pure helper that turns an axios request config
 * + response status into the structured log line we emit on every Axiom
 * round-trip. Tests cover URL parsing, body parsing, severity classification
 * inputs, and best-effort tolerance for malformed bodies.
 */
import { describe, it, expect } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { buildAxiomLogPayload } from '../../src/services/axiom.service.js';

const identity = { axiomClientId: 'vision', axiomSubClientId: 'platform' };

function buildConfig(overrides: Partial<InternalAxiosRequestConfig>): InternalAxiosRequestConfig {
  return {
    url: '/',
    method: 'get',
    headers: {} as InternalAxiosRequestConfig['headers'],
    ...overrides,
  } as InternalAxiosRequestConfig;
}

describe('buildAxiomLogPayload', () => {
  it('extracts fileSetId from /api/documents/:id URL', () => {
    const cfg = buildConfig({ url: '/api/documents/fs-platform-vision-1234-abc/status', method: 'get' });
    const payload = buildAxiomLogPayload(cfg, 200, undefined, identity);
    expect(payload.fileSetId).toBe('fs-platform-vision-1234-abc');
    expect(payload.queueJobId).toBeUndefined();
    expect(payload.pipelineId).toBeUndefined();
    expect(payload.method).toBe('GET');
    expect(payload.status).toBe(200);
  });

  it('extracts queueJobId from /api/pipelines/:id URL', () => {
    const cfg = buildConfig({ url: '/api/pipelines/fs-x-y-1-2/results', method: 'get' });
    const payload = buildAxiomLogPayload(cfg, 200, undefined, identity);
    expect(payload.queueJobId).toBe('fs-x-y-1-2');
    expect(payload.fileSetId).toBeUndefined();
  });

  it('extracts pipelineId + fileSetId from POST /api/pipelines body', () => {
    const cfg = buildConfig({
      url: '/api/pipelines',
      method: 'post',
      data: { pipelineId: 'criteria-only-evaluation', input: { fileSetId: 'fs-abc-123' } },
    });
    const payload = buildAxiomLogPayload(cfg, 202, undefined, identity);
    expect(payload.pipelineId).toBe('criteria-only-evaluation');
    expect(payload.fileSetId).toBe('fs-abc-123');
  });

  it('parses string body (axios serializes JSON when sent over the wire)', () => {
    const cfg = buildConfig({
      url: '/api/pipelines',
      method: 'post',
      data: JSON.stringify({ pipelineId: 'document-extraction', input: { fileSetId: 'fs-1' } }),
    });
    const payload = buildAxiomLogPayload(cfg, 202, undefined, identity);
    expect(payload.pipelineId).toBe('document-extraction');
    expect(payload.fileSetId).toBe('fs-1');
  });

  it('tolerates malformed string body without throwing', () => {
    const cfg = buildConfig({ url: '/api/pipelines', method: 'post', data: '{not json' });
    expect(() => buildAxiomLogPayload(cfg, 200, undefined, identity)).not.toThrow();
  });

  it('rejects URL segments that do not look like real IDs', () => {
    const cfg = buildConfig({ url: '/api/documents//double-slash', method: 'get' });
    const payload = buildAxiomLogPayload(cfg, 200, undefined, identity);
    expect(payload.fileSetId).toBeUndefined();
  });

  it('computes durationMs from __startedAt', () => {
    const cfg = buildConfig({ url: '/api/documents/fs-1/status', method: 'get' });
    (cfg as InternalAxiosRequestConfig & { __startedAt?: number }).__startedAt = Date.now() - 250;
    const payload = buildAxiomLogPayload(cfg, 200, undefined, identity);
    expect(payload.durationMs).toBeGreaterThanOrEqual(240);
    expect(payload.durationMs).toBeLessThan(2000);
  });

  it('omits durationMs when __startedAt is missing', () => {
    const cfg = buildConfig({ url: '/api/documents/fs-1/status', method: 'get' });
    const payload = buildAxiomLogPayload(cfg, 200, undefined, identity);
    expect(payload.durationMs).toBeUndefined();
  });

  it('carries identity fields and errorMessage when provided', () => {
    const cfg = buildConfig({ url: '/api/documents/fs-1/status', method: 'get' });
    const payload = buildAxiomLogPayload(cfg, 503, 'connection refused', identity);
    expect(payload.axiomClientId).toBe('vision');
    expect(payload.axiomSubClientId).toBe('platform');
    expect(payload.errorMessage).toBe('connection refused');
    expect(payload.status).toBe(503);
  });

  it('does not include errorMessage key when undefined', () => {
    const cfg = buildConfig({ url: '/api/documents/fs-1/status', method: 'get' });
    const payload = buildAxiomLogPayload(cfg, 200, undefined, identity);
    expect('errorMessage' in payload).toBe(false);
  });
});
