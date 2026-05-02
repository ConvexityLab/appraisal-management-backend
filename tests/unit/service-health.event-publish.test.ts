/**
 * Verifies the /api/health/event-publish-failures endpoint exposes the
 * EventPublishFailureCounter so ops can detect when best-effort event
 * publishing starts failing silently.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/services/service-health-check.service.js', () => ({
  ServiceHealthCheckService: vi.fn().mockImplementation(() => ({
    performHealthCheck: vi.fn(),
    printHealthReport: vi.fn(),
  })),
}));

import { createServiceHealthRouter } from '../../src/controllers/service-health.controller.js';
import {
  __resetEventPublishFailureCounterForTest,
  recordEventPublishFailure,
} from '../../src/utils/event-publish-failure-counter.js';

function buildApp(): express.Express {
  const app = express();
  app.use('/api/health', createServiceHealthRouter());
  return app;
}

describe('GET /api/health/event-publish-failures', () => {
  beforeEach(() => {
    __resetEventPublishFailureCounterForTest();
    delete process.env.HEALTH_CHECK_API_KEY;
  });

  afterEach(() => {
    delete process.env.HEALTH_CHECK_API_KEY;
  });

  it('returns zeroed stats when nothing has failed yet', async () => {
    const res = await request(buildApp()).get('/api/health/event-publish-failures');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        totalFailures: 0,
        failuresByEventType: {},
      },
    });
  });

  it('returns total / per-event-type / lastFailure after failures are recorded', async () => {
    recordEventPublishFailure({
      eventType: 'qc.issue.detected',
      error: new Error('Service Bus 503'),
      source: 'audit-event-sink-service',
      context: { engagementId: 'eng-1' },
    });
    recordEventPublishFailure({
      eventType: 'analysis.criteria.submitted',
      error: 'Service Bus offline',
      source: 'analysis-submission-service',
    });

    const res = await request(buildApp()).get('/api/health/event-publish-failures');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalFailures).toBe(2);
    expect(res.body.data.failuresByEventType).toEqual({
      'qc.issue.detected': 1,
      'analysis.criteria.submitted': 1,
    });
    expect(res.body.data.lastFailure).toMatchObject({
      eventType: 'analysis.criteria.submitted',
      source: 'analysis-submission-service',
      error: 'Service Bus offline',
    });
  });

  it('rejects unauthenticated callers when HEALTH_CHECK_API_KEY is configured', async () => {
    process.env.HEALTH_CHECK_API_KEY = 'secret-token';

    const res = await request(buildApp()).get('/api/health/event-publish-failures');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('accepts authenticated callers when HEALTH_CHECK_API_KEY is configured', async () => {
    process.env.HEALTH_CHECK_API_KEY = 'secret-token';

    const res = await request(buildApp())
      .get('/api/health/event-publish-failures')
      .set('X-Health-Api-Key', 'secret-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
