import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendToGroup = vi.fn().mockResolvedValue(undefined);
const mockGetToken = vi.fn().mockResolvedValue({
  token: 'entra-token-001',
  expiresOnTimestamp: Date.now() + 60 * 60 * 1000,
});

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn().mockImplementation(() => ({
    getToken: mockGetToken,
  })),
}));

vi.mock('../../src/services/web-pubsub.service.js', () => ({
  WebPubSubService: vi.fn().mockImplementation(() => ({
    sendToGroup: mockSendToGroup,
  })),
}));

import { AxiomService } from '../../src/services/axiom.service.js';

describe('AxiomService pipeline result stamping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AXIOM_API_BASE_URL = 'https://axiom.example';
    process.env.AXIOM_API_KEY = 'live-fire-testing-key';
    process.env.API_BASE_URL = 'http://localhost:3011';
    process.env.AXIOM_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.AXIOM_SUB_CLIENT_ID = 'test-sub-client-id';
    delete process.env.AXIOM_API_TOKEN_SCOPE;
    delete process.env.AXIOM_API_RESOURCE;
    delete process.env.AXIOM_USE_DEFAULT_CREDENTIAL;
  });

  it('replaces the checked-in placeholder key with a real Entra bearer token for live-fire requests', async () => {
    const service = new AxiomService({} as any);

    const authHeader = await (service as any).getAxiomAuthorizationHeader();

    expect(mockGetToken).toHaveBeenCalledWith('api://3bc96929-593c-4f35-8997-e341a7e09a69/.default');
    expect(authHeader).toBe('Bearer entra-token-001');
  });

  it('returns cached pending evaluation when live by-id lookup is not yet available', async () => {
    const pendingEvaluation = {
      id: 'eval-order-001-pjob-001',
      orderId: 'order-001',
      evaluationId: 'eval-order-001-pjob-001',
      pipelineJobId: 'pjob-001',
      tenantId: 'tenant-001',
      clientId: 'client-001',
      documentType: 'appraisal',
      status: 'pending',
      criteria: [],
      overallRiskScore: 0,
      timestamp: '2026-04-09T00:00:00.000Z',
    };

    const dbStub = {
      getItem: vi.fn().mockResolvedValue({ success: true, data: pendingEvaluation }),
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);

    vi.spyOn<any, any>(service as any, 'client', 'get').mockReturnValue({
      get: vi.fn().mockRejectedValue({
        response: { status: 404 },
        message: 'Not Found',
      }),
    });

    const result = await service.getEvaluationById('eval-order-001-pjob-001');

    expect(result).toMatchObject({
      evaluationId: 'eval-order-001-pjob-001',
      status: 'pending',
      pipelineJobId: 'pjob-001',
    });
  });

  it('promotes a pending cached evaluation to completed when pipeline results are already available', async () => {
    const pendingEvaluation = {
      id: 'eval-order-002-pjob-002',
      orderId: 'order-002',
      evaluationId: 'eval-order-002-pjob-002',
      pipelineJobId: 'pjob-002',
      tenantId: 'tenant-001',
      clientId: 'client-001',
      documentType: 'appraisal',
      status: 'pending',
      criteria: [],
      overallRiskScore: 0,
      timestamp: '2026-04-09T00:00:00.000Z',
    };

    const completedEvaluation = {
      ...pendingEvaluation,
      status: 'completed',
      overallRiskScore: 82,
      criteria: [
        {
          criterionId: 'criterion-1',
          criterionName: 'Completeness',
          description: 'Completeness',
          evaluation: 'pass',
          confidence: 0.98,
          reasoning: 'All required sections were present.',
          documentReferences: [],
        },
      ],
    };

    const dbStub = {
      getItem: vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: pendingEvaluation })
        .mockResolvedValueOnce({ success: true, data: completedEvaluation }),
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);

    vi.spyOn(service, 'fetchAndStorePipelineResults').mockResolvedValue();

    const result = await service.getEvaluationById('eval-order-002-pjob-002');

    expect(service.fetchAndStorePipelineResults).toHaveBeenCalledWith(
      'order-002',
      'pjob-002',
      'eval-order-002-pjob-002',
      0,
    );
    expect(result).toMatchObject({
      evaluationId: 'eval-order-002-pjob-002',
      status: 'completed',
      overallRiskScore: 82,
    });
  });

  it('reuses the latest local evaluation when Axiom rejects a duplicate submission as already existing', async () => {
    const dbStub = {
      getItem: vi.fn().mockResolvedValue({ success: false, data: null }),
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
      queryItems: vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({
          success: true,
          data: [{ evaluationId: 'eval-order-003-pjob-003', pipelineJobId: 'pjob-003' }],
        }),
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);
    (service as any).client = {
      post: vi.fn().mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Entity with the specified id already exists in the system.' },
        },
        message: 'Request failed with status code 500',
      }),
      interceptors: { request: { use: vi.fn() } },
    };

    const result = await service.submitOrderEvaluation(
      'order-003',
      [],
      [{ documentName: 'Appraisal.pdf', documentReference: 'https://blob/doc.pdf?sas=1' }],
      'tenant-001',
      'client-001',
    );

    expect(result).toEqual({
      evaluationId: 'eval-order-003-pjob-003',
      pipelineJobId: 'pjob-003',
    });
  });

  it('enriches criteria references from pending metadata when storing pipeline results', async () => {
    const upsertItem = vi.fn().mockResolvedValue({ success: true });
    const getItem = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'eval-order-001-pjob-001',
        documentType: 'appraisal',
        tenantId: 'tenant-001',
        clientId: 'client-001',
        _metadata: {
          documentId: 'doc-001',
          documentName: 'Appraisal Report.pdf',
          blobUrl: 'https://blob/doc-001.pdf?sas=1',
        },
      },
    });

    const dbStub = {
      upsertItem,
      getItem,
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);

    vi.spyOn(service, 'fetchPipelineResults').mockResolvedValue({
      results: {
        overallRiskScore: 37,
        criteria: [
          {
            criterionId: 'CRIT-1',
            criterionName: 'Comparable count',
            evaluation: 'pass',
            confidence: 0.95,
            reasoning: 'Found enough comparables',
            supportingData: [
              {
                sourceDocument: 'Appraisal Report.pdf',
                sourcePage: 12,
                salePrice: 425000,
              },
            ],
            documentReferences: [
              {
                page: 12,
                section: 'Sales Comparison',
                quote: 'Three closed sales were analyzed.',
              },
            ],
          },
        ],
      },
    });

    await service.fetchAndStorePipelineResults('order-001', 'pjob-001', 'eval-order-001-pjob-001');

    expect(upsertItem).toHaveBeenCalled();

    const savedRecord = upsertItem.mock.calls[upsertItem.mock.calls.length - 1]?.[1];
    expect(savedRecord).toMatchObject({
      id: 'eval-order-001-pjob-001',
      orderId: 'order-001',
      status: 'completed',
      overallRiskScore: 37,
      tenantId: 'tenant-001',
      clientId: 'client-001',
      criteria: [
        {
          criterionId: 'CRIT-1',
          documentReferences: [
            {
              documentId: 'doc-001',
              documentName: 'Appraisal Report.pdf',
              blobUrl: 'https://blob/doc-001.pdf?sas=1',
            },
          ],
          supportingData: [
            {
              sourceDocumentId: 'doc-001',
              sourceBlobUrl: 'https://blob/doc-001.pdf?sas=1',
            },
          ],
        },
      ],
    });
  });
});
