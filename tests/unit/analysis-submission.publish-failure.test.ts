/**
 * Verifies that AnalysisSubmissionService.publishEvent surfaces publish
 * failures on the EventPublishFailureCounter while preserving its no-throw
 * contract. Without this signal, a Service Bus outage would be silent to
 * downstream audit / event consumers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPublish = vi.fn();

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    generateReadSasUrl: vi.fn(),
  })),
}));

vi.mock('../../src/services/axiom-execution.service.js', () => ({
  AxiomExecutionService: vi.fn().mockImplementation(() => ({})),
}));

import { AnalysisSubmissionService } from '../../src/services/analysis-submission.service.js';
import { EventCategory } from '../../src/types/events.js';
import {
  __resetEventPublishFailureCounterForTest,
  getEventPublishFailureStats,
} from '../../src/utils/event-publish-failure-counter.js';

describe('AnalysisSubmissionService.publishEvent failure observability', () => {
  let service: AnalysisSubmissionService;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetEventPublishFailureCounterForTest();
    service = new AnalysisSubmissionService({} as never);
  });

  async function callPublishEvent(type: string, data: Record<string, unknown>): Promise<void> {
    // publishEvent is private — escape the type to drive the unit under test.
    await (service as unknown as {
      publishEvent: (t: string, c: EventCategory, d: Record<string, unknown>) => Promise<void>;
    }).publishEvent(type, EventCategory.AXIOM, data);
  }

  it('records the failure on the counter when publish throws and does not propagate the error', async () => {
    mockPublish.mockRejectedValueOnce(new Error('Service Bus unavailable'));

    await expect(
      callPublishEvent('axiom.evaluation.submitted', { orderId: 'order-1', correlationId: 'corr-1' }),
    ).resolves.toBeUndefined();

    const stats = getEventPublishFailureStats();
    expect(stats.totalFailures).toBe(1);
    expect(stats.failuresByEventType['axiom.evaluation.submitted']).toBe(1);
    expect(stats.lastFailure).toMatchObject({
      eventType: 'axiom.evaluation.submitted',
      source: 'analysis-submission-service',
      error: 'Service Bus unavailable',
      context: { orderId: 'order-1', correlationId: 'corr-1' },
    });
  });

  it('does not record on the counter when publish succeeds', async () => {
    mockPublish.mockResolvedValueOnce(undefined);

    await callPublishEvent('axiom.evaluation.submitted', { orderId: 'order-2' });

    expect(getEventPublishFailureStats().totalFailures).toBe(0);
  });
});
