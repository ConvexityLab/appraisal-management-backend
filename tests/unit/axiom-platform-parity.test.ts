import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendToGroup = vi.fn().mockResolvedValue(undefined);
const mockPropertyEnrichOrder = vi.fn();
const mockGetLatestPropertyEnrichment = vi.fn();

vi.mock('../../src/services/web-pubsub.service.js', () => ({
  WebPubSubService: vi.fn().mockImplementation(() => ({
    sendToGroup: mockSendToGroup,
  })),
}));

vi.mock('../../src/services/property-enrichment.service.js', () => ({
  PropertyEnrichmentService: vi.fn().mockImplementation(() => ({
    enrichOrder: mockPropertyEnrichOrder,
    getLatestEnrichment: mockGetLatestPropertyEnrichment,
  })),
}));

import { AxiomService } from '../../src/services/axiom.service.js';

describe('AxiomService platform parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AXIOM_API_BASE_URL = 'https://axiom.example';
    process.env.API_BASE_URL = 'https://backend.example';
    process.env.AXIOM_WEBHOOK_SECRET = 'webhook-secret';
    process.env.AXIOM_SUB_CLIENT_ID = 'tenant-123';
    process.env.AXIOM_AUTH_AUDIENCE = 'api://3bc96929-593c-4f35-8997-e341a7e09a69';
    delete process.env.AXIOM_REQUIRED_DOCUMENT_TYPES;
    delete process.env.AXIOM_PIPELINE_ID_DOC_EXTRACT;
    delete process.env.AXIOM_PIPELINE_ID_CRITERIA_EVAL;
    delete process.env.AXIOM_PIPELINE_ID_RISK_EVAL;
    mockPropertyEnrichOrder.mockResolvedValue({
      enrichmentId: 'enrich-order-123',
      propertyId: 'prop-123',
      status: 'enriched',
    });
    mockGetLatestPropertyEnrichment.mockResolvedValue(null);
  });

  it('delegates property enrichment to PropertyEnrichmentService using normalized address parts', async () => {
    const dbStub = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);

    const result = await service.enrichProperty(
      {
        propertyAddress: '2055 Peachtree Rd, Atlanta, GA 30309',
        propertyCity: 'Atlanta',
        propertyState: 'GA',
        propertyZip: '30309',
      },
      'order-123',
      'tenant-123',
      'client-123',
    );

    expect(mockPropertyEnrichOrder).toHaveBeenCalledWith(
      'order-123',
      'tenant-123',
      {
        street: '2055 Peachtree Rd',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30309',
      },
    );
    expect(result).toEqual({ enrichmentId: 'enrich-order-123', status: 'queued' });
  });

  it('reads property enrichment records from PropertyEnrichmentService', async () => {
    const dbStub = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
    };

    mockGetLatestPropertyEnrichment.mockResolvedValueOnce({
      id: 'enrich-order-123',
      type: 'property-enrichment',
      orderId: 'order-123',
      tenantId: 'tenant-123',
      status: 'enriched',
    });

    const service = new AxiomService(dbStub as any);

    const result = await service.getPropertyEnrichment('order-123', 'tenant-123');

    expect(mockGetLatestPropertyEnrichment).toHaveBeenCalledWith('order-123', 'tenant-123');
    expect(result).toMatchObject({
      id: 'enrich-order-123',
      orderId: 'order-123',
      status: 'enriched',
    });
  });

  it.each([
    ['EXTRACTION', 'adaptive-document-processing'],
    // Axiom renamed CRITERIA_ONLY pipeline 'smart-criteria-evaluation'
    // -> 'criteria-only-evaluation' (axiom.service.ts:314-316).
    ['CRITERIA_EVALUATION', 'criteria-only-evaluation'],
    ['COMPLETE_EVALUATION', 'complete-document-criteria-evaluation'],
  ] as const)('uses %s pipeline id for submitOrderEvaluation', async (evaluationMode, pipelineId) => {
    const dbStub = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);
    const post = vi.fn().mockResolvedValue({ data: { jobId: 'job-123' } });
    (service as any).client.post = post;

    vi.spyOn(service as any, 'storeEvaluationRecord').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'watchPipelineStream').mockResolvedValue(undefined);

    await service.submitOrderEvaluation(
      'order-123',
      [{ fieldName: 'orderId', fieldType: 'string', value: 'order-123' }],
      [{ documentName: 'Appraisal Report.pdf', documentReference: 'https://blob.example/report.pdf?sas=1' }],
      'tenant-123',
      'client-123',
      'sub-client-123',
      undefined,   // programId
      undefined,   // programVersion
      'ORDER',
      evaluationMode,
    );

    expect(post).toHaveBeenCalledWith('/api/pipelines', {
      pipelineId,
      input: {
        subClientId: 'sub-client-123',
        clientId: 'client-123',
        fileSetId: 'fs-order-123',
        files: [{
          fileName: 'Appraisal Report.pdf',
          url: 'https://blob.example/report.pdf?sas=1',
          mediaType: 'application/pdf',
          downloadMethod: 'fetch',
        }],
        requiredDocuments: ['appraisal-report'],
        correlationId: 'order-123',
        correlationType: 'ORDER',
        webhookUrl: 'https://backend.example/api/axiom/webhook',
        webhookSecret: 'webhook-secret',
      },
    });
  });

  it('stores extraction result, criteria result, and stage execution log from completed pipeline results', async () => {
    const upsertItem = vi.fn().mockResolvedValue({ success: true });
    const updateOrder = vi.fn().mockResolvedValue({ success: true });
    const dbStub = {
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'eval-order-123-job-123',
          documentType: 'appraisal',
          tenantId: 'tenant-123',
          clientId: 'client-123',
          _metadata: {
            documentId: 'doc-123',
            documentName: 'Appraisal Report.pdf',
            blobUrl: 'https://blob.example/report.pdf?sas=1',
          },
        },
      }),
      upsertItem,
      updateOrder,
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
    };

    const service = new AxiomService(dbStub as any);
    vi.spyOn(service, 'fetchPipelineResults').mockResolvedValue({
      results: {
        extractStructuredData: [{ field: 'appraisedValue', value: 425000 }],
        aggregateResults: [{ summary: 'criteria-pass', totalCriteria: 1 }],
        criteria: [{
          criterionId: 'CRIT-1',
          criterionName: 'Value support',
          evaluation: 'pass',
          confidence: 0.98,
          reasoning: 'Supported by appraisal report',
          documentReferences: [{ page: 4, section: 'Reconciliation', quote: 'Final value is supported.' }],
        }],
        overallRiskScore: 22,
        overallDecision: 'ACCEPT',
      },
    });
    vi.spyOn(service as any, 'broadcastAxiomStatus').mockResolvedValue(undefined);

    const pipelineExecutionLog = [{
      stage: 'extractStructuredData',
      event: 'completed' as const,
      timestamp: '2026-04-08T16:20:10.051Z',
      durationMs: 5110,
    }];

    await service.fetchAndStorePipelineResults('order-123', 'job-123', 'eval-order-123-job-123', undefined, pipelineExecutionLog);

    const savedRecord = upsertItem.mock.calls[upsertItem.mock.calls.length - 1]?.[1];
    expect(savedRecord).toMatchObject({
      id: 'eval-order-123-job-123',
      orderId: 'order-123',
      tenantId: 'tenant-123',
      clientId: 'client-123',
      overallRiskScore: 22,
      axiomExtractionResult: [{ field: 'appraisedValue', value: 425000 }],
      axiomCriteriaResult: { summary: 'criteria-pass', totalCriteria: 1 },
      pipelineExecutionLog,
      criteria: [{
        criterionId: 'CRIT-1',
        documentReferences: [{
          documentId: 'doc-123',
          documentName: 'Appraisal Report.pdf',
          blobUrl: 'https://blob.example/report.pdf?sas=1',
        }],
      }],
    });
    expect(updateOrder).toHaveBeenCalledWith(
      'order-123',
      expect.objectContaining({
        axiomRiskScore: 22,
        axiomDecision: 'ACCEPT',
        axiomStatus: 'completed',
        axiomEvaluationId: 'eval-order-123-job-123',
        axiomPipelineJobId: 'job-123',
        axiomLastUpdatedAt: expect.any(String),
      }),
    );
  });

  it('compares documents via the unified pipeline flow and stores a local comparison record', async () => {
    const dbStub = {
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-123',
          tenantId: 'tenant-123',
          clientId: 'client-123',
          clientInformation: { clientId: 'client-123' },
        },
      }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);
    const post = vi.fn()
      .mockResolvedValueOnce({ data: { jobId: 'job-original' } })
      .mockResolvedValueOnce({ data: { jobId: 'job-revised' } });
    (service as any).client.post = post;

    const fetchPipelineResults = vi.spyOn(service, 'fetchPipelineResults');
    fetchPipelineResults
      .mockResolvedValueOnce({ results: { extractedData: { summary: { appraisedValue: 400000, status: 'draft' } } } })
      .mockResolvedValueOnce({ results: { extractedData: { summary: { appraisedValue: 425000, status: 'final' } } } });

    const storeEvaluationRecord = vi.spyOn(service as any, 'storeEvaluationRecord').mockResolvedValue(undefined);

    const result = await service.compareDocuments(
      'order-123',
      'https://blob.example/original.pdf?sas=1',
      'https://blob.example/revised.pdf?sas=1',
      'sub-client-123',
    );

    expect(post).toHaveBeenNthCalledWith(1, '/api/pipelines', expect.objectContaining({
      pipelineId: 'adaptive-document-processing',
      input: expect.objectContaining({
        subClientId: 'sub-client-123',
        clientId: 'client-123',
        correlationId: 'order-123:comparison:original',
      }),
    }));
    expect(post).toHaveBeenNthCalledWith(2, '/api/pipelines', expect.objectContaining({
      pipelineId: 'adaptive-document-processing',
      input: expect.objectContaining({
        subClientId: 'sub-client-123',
        clientId: 'client-123',
        correlationId: 'order-123:comparison:revised',
      }),
    }));
    expect(result.success).toBe(true);
    expect(result.comparisonId).toBeTruthy();
    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section: 'Summary › AppraisedValue',
        changeType: 'modified',
        original: '400000',
        revised: '425000',
      }),
      expect.objectContaining({
        section: 'Summary › Status',
        changeType: 'modified',
        original: 'draft',
        revised: 'final',
      }),
    ]));
    expect(storeEvaluationRecord).toHaveBeenCalledWith(expect.objectContaining({
      id: result.comparisonId,
      type: 'document-comparison',
      orderId: 'order-123',
      changes: expect.any(Array),
    }));
  });

  it('reads stored document comparisons locally', async () => {
    const dbStub = {
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'cmp-123',
          comparisonId: 'cmp-123',
          type: 'document-comparison',
          changes: [{ section: 'Summary › Status', changeType: 'modified' }],
        },
      }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);
    const comparison = await service.getComparison('cmp-123');

    expect(dbStub.getItem).toHaveBeenCalledWith('aiInsights', 'cmp-123');
    expect(comparison).toMatchObject({
      comparisonId: 'cmp-123',
      type: 'document-comparison',
    });
  });
});