import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}));

import { CriteriaReevaluationHandlerService } from '../../src/services/criteria-reevaluation-handler.service.js';

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    type: 'qc.criterion.reevaluate.requested',
    timestamp: new Date(),
    source: 'unit-test',
    version: '1.0',
    category: 'QC',
    data: {
      orderId: 'order-1',
      tenantId: 'tenant-1',
      triggeringFieldName: 'propertyAddress',
      triggeringFieldNewValue: '17 David Dr',
      triggeredBy: 'reviewer-1',
      ...overrides,
    },
  };
}

describe('CriteriaReevaluationHandlerService', () => {
  let dbStub: any;
  let axiomServiceStub: any;
  let publisherStub: any;
  let service: CriteriaReevaluationHandlerService;

  beforeEach(() => {
    vi.clearAllMocks();

    dbStub = {
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-1',
          type: 'order',
          tenantId: 'tenant-1',
          clientId: 'client-1',
          subClientId: 'platform',
          axiomProgramId: 'FNMA-URAR',
          axiomProgramVersion: '1.0.0',
        },
      }),
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'eval-old',
            orderId: 'order-1',
            tenantId: 'tenant-1',
            clientId: 'client-1',
            programId: 'FNMA-URAR',
            programVersion: '1.0.0',
            status: 'completed',
            criteria: [
              { criterionId: 'URAR-1004-001', evaluation: 'fail' },
              { criterionId: 'URAR-1004-020', evaluation: 'pass' },
            ],
          },
        ],
      }),
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'eval-new',
          evaluationId: 'eval-new',
          orderId: 'order-1',
          status: 'completed',
          pipelineJobId: 'pjob-2',
          criteria: [
            { criterionId: 'URAR-1004-001', evaluation: 'pass' },
          ],
        },
      }),
    };

    axiomServiceStub = {
      getCompiledCriteria: vi.fn().mockResolvedValue({
        criteria: [
          {
            concept: 'URAR-1004-001',
            title: 'Subject property address complete',
            description: 'Property address is complete',
            dataRequirements: [{ path: 'propertyAddress', required: true }],
          },
          {
            concept: 'URAR-1004-022',
            title: 'Comparable sale dates present',
            description: 'Comparable sale dates available',
            dataRequirements: [{ path: 'comparables.saleDate', required: true }],
          },
        ],
      }),
      submitCriteriaReevaluation: vi.fn().mockResolvedValue({
        evaluationId: 'eval-new',
        pipelineJobId: 'pjob-2',
      }),
      getLastPipelineSubmissionError: vi.fn().mockReturnValue(null),
    };

    publisherStub = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    service = new CriteriaReevaluationHandlerService(dbStub, axiomServiceStub, publisherStub);
  });

  async function deliver(event = makeEvent()): Promise<void> {
    await service.start();
    expect(mockSubscribe).toHaveBeenCalledWith('qc.criterion.reevaluate.requested', expect.any(Object));
    const handler = mockSubscribe.mock.calls[0][1];
    await handler.handle(event);
  }

  it('start() subscribes exactly once and stop() unsubscribes', async () => {
    await service.start();
    await service.start();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('qc.criterion.reevaluate.requested', expect.objectContaining({
      handle: expect.any(Function),
    }));

    await service.stop();
    expect(mockUnsubscribe).toHaveBeenCalledWith('qc.criterion.reevaluate.requested');
  });

  it('publishes per-criterion requested and reevaluated events with old/new verdicts', async () => {
    await deliver();

    expect(axiomServiceStub.getCompiledCriteria).toHaveBeenCalledWith('client-1', 'tenant-1', 'FNMA-URAR', '1.0.0');
    expect(axiomServiceStub.submitCriteriaReevaluation).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      subClientId: 'platform',
      programId: 'FNMA-URAR',
      programVersion: '1.0.0',
    }));

    expect(publisherStub.publish).toHaveBeenCalledTimes(2);
    expect(publisherStub.publish).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'qc.criterion.reevaluate.requested',
      data: expect.objectContaining({
        orderId: 'order-1',
        criterionId: 'URAR-1004-001',
        triggeringFieldName: 'propertyAddress',
      }),
    }));
    expect(publisherStub.publish).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: 'qc.criterion.reevaluated',
      data: expect.objectContaining({
        orderId: 'order-1',
        criterionId: 'URAR-1004-001',
        oldVerdict: 'fail',
        newVerdict: 'pass',
        changedFlag: true,
        triggeringFieldName: 'propertyAddress',
        evaluationId: 'eval-new',
        pipelineJobId: 'pjob-2',
      }),
    }));
  });

  it('publishes a failed reevaluated event when submission fails', async () => {
    axiomServiceStub.submitCriteriaReevaluation.mockResolvedValueOnce(null);
    axiomServiceStub.getLastPipelineSubmissionError.mockReturnValueOnce({
      code: 'NO_PRIOR_EXTRACTION',
      message: 'no prior extraction available',
    });

    await deliver();

    expect(publisherStub.publish).toHaveBeenCalledTimes(2);
    expect(publisherStub.publish).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'qc.criterion.reevaluated',
      data: expect.objectContaining({
        criterionId: 'URAR-1004-001',
        oldVerdict: 'fail',
        changedFlag: false,
        errorCode: 'NO_PRIOR_EXTRACTION',
        errorMessage: 'no prior extraction available',
      }),
    }));
  });

  it('is idempotent for duplicate in-flight requests', async () => {
    let resolveSubmit: ((value: unknown) => void) | undefined;
    axiomServiceStub.submitCriteriaReevaluation.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );

    await service.start();
    const handler = mockSubscribe.mock.calls[0][1];

    const first = handler.handle(makeEvent());
    const second = handler.handle(makeEvent());

    for (let attempt = 0; attempt < 20; attempt++) {
      if (axiomServiceStub.submitCriteriaReevaluation.mock.calls.length === 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(axiomServiceStub.submitCriteriaReevaluation).toHaveBeenCalledTimes(1);

    resolveSubmit?.({
      evaluationId: 'eval-new',
      pipelineJobId: 'pjob-2',
    });

    await Promise.all([first, second]);
  });
});