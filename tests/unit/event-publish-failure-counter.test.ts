import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetEventPublishFailureCounterForTest,
  getEventPublishFailureStats,
  recordEventPublishFailure,
} from '../../src/utils/event-publish-failure-counter.js';

describe('EventPublishFailureCounter', () => {
  beforeEach(() => {
    __resetEventPublishFailureCounterForTest();
  });

  it('starts with zero failures and no last failure', () => {
    const stats = getEventPublishFailureStats();
    expect(stats.totalFailures).toBe(0);
    expect(stats.failuresByEventType).toEqual({});
    expect(stats.lastFailure).toBeUndefined();
  });

  it('increments totalFailures and per-event-type counts when failures are recorded', () => {
    recordEventPublishFailure({ eventType: 'qc.issue.detected', error: new Error('a'), source: 'svc-1' });
    recordEventPublishFailure({ eventType: 'qc.issue.detected', error: new Error('b'), source: 'svc-1' });
    recordEventPublishFailure({ eventType: 'analysis.criteria.submitted', error: 'c', source: 'svc-2' });

    const stats = getEventPublishFailureStats();
    expect(stats.totalFailures).toBe(3);
    expect(stats.failuresByEventType).toEqual({
      'qc.issue.detected': 2,
      'analysis.criteria.submitted': 1,
    });
  });

  it('captures lastFailure with the most recent eventType, source, and error message', () => {
    recordEventPublishFailure({
      eventType: 'analysis.criteria.submitted',
      error: new Error('Service Bus 503'),
      source: 'analysis-submission-service',
      context: { correlationId: 'corr-1' },
    });

    const stats = getEventPublishFailureStats();
    expect(stats.lastFailure).toMatchObject({
      eventType: 'analysis.criteria.submitted',
      error: 'Service Bus 503',
      source: 'analysis-submission-service',
      context: { correlationId: 'corr-1' },
    });
    expect(Number.isNaN(Date.parse(stats.lastFailure!.timestamp))).toBe(false);
  });

  it('coerces non-Error values into a string error message', () => {
    recordEventPublishFailure({ eventType: 'foo', error: { code: 503 }, source: 's' });
    expect(getEventPublishFailureStats().lastFailure?.error).toBe('[object Object]');
  });
});
