import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendToGroup = vi.fn().mockResolvedValue(undefined);
const mockGetToken = vi.fn().mockResolvedValue({
  token: 'entra-token-001',
  expiresOnTimestamp: Date.now() + 60 * 60 * 1000,
});

// P-19 step (a) + (f) — Capture every event published by AxiomService.
// `new ServiceBusEventPublisher()` inside the service returns this fake whose
// `publish()` records the message so tests can assert the event payload.
const publishedEvents: any[] = [];
const mockPublish = vi.fn(async (event: any) => {
  publishedEvents.push(event);
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

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
    publishBatch: vi.fn().mockResolvedValue(undefined),
    verifyConnectivity: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { AxiomService } from '../../src/services/axiom.service.js';

describe('AxiomService pipeline result stamping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishedEvents.length = 0;
    process.env.AXIOM_API_BASE_URL = 'https://axiom.example';
    process.env.AXIOM_API_KEY = 'live-fire-testing-key';
    process.env.API_BASE_URL = 'http://localhost:3011';
    process.env.AXIOM_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.AXIOM_SUB_CLIENT_ID = 'test-sub-client-id';
    // Pin the audience here so the test does not depend on .env providing it.
    // CI has no .env, and the assertion at line 62 hardcodes this exact GUID.
    process.env.AXIOM_AUTH_AUDIENCE = 'api://3bc96929-593c-4f35-8997-e341a7e09a69';
    delete process.env.AXIOM_API_TOKEN_SCOPE;
    delete process.env.AXIOM_API_RESOURCE;
    delete process.env.AXIOM_USE_DEFAULT_CREDENTIAL;
    // .env sets AXIOM_AUTH_REQUIRED=false for local dev which short-circuits
    // credential setup. Clear it so the placeholder→DefaultAzureCredential
    // path runs in this test.
    delete process.env.AXIOM_AUTH_REQUIRED;
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
      'sub-001',
    );

    expect(result).toEqual({
      evaluationId: 'eval-order-003-pjob-003',
      pipelineJobId: 'pjob-003',
    });
  });

  // ── P-19 live-fire-extraction shared fixture builders ─────────────────────
  // Used by the four assertions below (steps d, e, f, plus document writeback)
  // to keep each test focused on what it's verifying without rebuilding the
  // entire raw Axiom result payload from scratch every time.
  const buildPendingEvaluation = (overrides: Record<string, any> = {}) => ({
    id: 'eval-order-100-pjob-100',
    documentType: 'appraisal',
    tenantId: 'tenant-001',
    clientId: 'client-001',
    pipelineId: 'adaptive-document-processing',
    _metadata: {
      documentId: 'doc-100',
      documentName: 'Appraisal Report.pdf',
      blobUrl: 'https://blob/doc-100.pdf?sas=1',
    },
    ...overrides,
  });

  /**
   * Realistic Axiom pipeline payload covering all the shapes
   * `fetchAndStorePipelineResults` reads:
   *   - results.consolidate[0].consolidatedData → buildExtractedSummary + writeback
   *   - results.aggregateResults[0]              → axiomCriteriaResult
   *   - results.extractStructuredData[]          → axiomExtractionResult
   *   - results.overallDecision                  → order.axiomDecision
   *   - top-level criteria + overallRiskScore    → mapPipelineResultsToEvaluation
   */
  const buildLiveFireRawResults = (overrides: any = {}) => ({
    overallRiskScore: 42,
    criteria: [
      {
        criterionId: 'CRIT-PASS',
        criterionName: 'Property address matches subject',
        evaluation: 'pass',
        confidence: 0.97,
        reasoning: 'Address matched the subject record.',
        documentReferences: [{ page: 1, section: 'Subject', quote: '17 David Dr' }],
      },
      {
        criterionId: 'CRIT-WARN',
        criterionName: 'GLA within 10% of comparable median',
        evaluation: 'warning',
        confidence: 0.72,
        reasoning: 'GLA differs by 12% from comparable median.',
        remediation: 'Confirm GLA measurement source.',
        documentReferences: [{ page: 4, section: 'Improvements', quote: 'GLA 1,847' }],
      },
      {
        criterionId: 'CRIT-FAIL',
        criterionName: 'At least 3 closed comparables within 6 months',
        evaluation: 'fail',
        confidence: 0.91,
        reasoning: 'Only 2 closed comparables found within the 6-month window.',
        remediation: 'Source one additional closed sale or document expanded date window.',
        documentReferences: [{ page: 12, section: 'Sales Comparison', quote: 'Comp 3 closed 2025-06-15' }],
      },
    ],
    results: {
      overallDecision: 'CONDITIONAL',
      consolidate: [
        {
          consolidatedData: {
            propertyAddress: { street: '17 David Dr', city: 'Johnston', state: 'RI', zip: '02919' },
            gla: 1847,
            yearBuilt: 1962,
            appraisedValue: 425000,
          },
        },
      ],
      aggregateResults: [{ summary: 'aggregate-summary-payload' }],
      extractStructuredData: [{ kind: 'extracted', fields: 4 }],
    },
    ...overrides,
  });

  it('P-19 (e): stamps order with axiomRiskScore, axiomStatus, axiomDecision, axiomEvaluationId, axiomPipelineJobId, axiomLastUpdatedAt, and axiomExtractedSummary', async () => {
    const updateOrder = vi.fn().mockResolvedValue({ success: true });
    const dbStub = {
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
      // First getItem call is the pending evaluation lookup; second is the
      // documents lookup for extracted-data writeback.
      getItem: vi.fn()
        .mockResolvedValueOnce({ success: true, data: buildPendingEvaluation() })
        .mockResolvedValueOnce({ success: true, data: { id: 'doc-100', extractedData: undefined } }),
      updateItem: vi.fn().mockResolvedValue({ success: true }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      updateOrder,
    };

    const service = new AxiomService(dbStub as any);
    vi.spyOn(service, 'fetchPipelineResults').mockResolvedValue(buildLiveFireRawResults());

    await service.fetchAndStorePipelineResults('order-100', 'pjob-100', 'eval-order-100-pjob-100');

    expect(updateOrder).toHaveBeenCalledTimes(1);
    const stamp = updateOrder.mock.calls[0][1];
    expect(stamp).toMatchObject({
      axiomRiskScore: 42,
      axiomStatus: 'completed',
      axiomEvaluationId: 'eval-order-100-pjob-100',
      axiomPipelineJobId: 'pjob-100',
      axiomDecision: 'CONDITIONAL',
    });
    // axiomLastUpdatedAt must be a parseable ISO string
    expect(typeof stamp.axiomLastUpdatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(stamp.axiomLastUpdatedAt))).toBe(false);
    // axiomExtractedSummary should denormalise the consolidated identity fields
    expect(stamp.axiomExtractedSummary).toMatchObject({
      propertyAddress: expect.objectContaining({ street: '17 David Dr', state: 'RI' }),
      gla: 1847,
      yearBuilt: 1962,
      appraisedValue: 425000,
    });
  });

  it('P-19 (f): publishes axiom.evaluation.completed with fail/warn/pass counts, decision, score, and pipelineName', async () => {
    const dbStub = {
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
      getItem: vi.fn()
        .mockResolvedValueOnce({ success: true, data: buildPendingEvaluation() })
        .mockResolvedValueOnce({ success: true, data: { id: 'doc-100' } }),
      updateItem: vi.fn().mockResolvedValue({ success: true }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);
    vi.spyOn(service, 'fetchPipelineResults').mockResolvedValue(buildLiveFireRawResults());

    await service.fetchAndStorePipelineResults('order-100', 'pjob-100', 'eval-order-100-pjob-100');

    const completed = publishedEvents.find((e) => e.type === 'axiom.evaluation.completed');
    expect(completed, 'axiom.evaluation.completed event missing from publisher capture').toBeDefined();
    expect(completed.source).toBe('axiom-service');
    expect(completed.data).toMatchObject({
      orderId: 'order-100',
      tenantId: 'tenant-001',
      evaluationId: 'eval-order-100-pjob-100',
      pipelineJobId: 'pjob-100',
      pipelineName: 'adaptive-document-processing',
      // 1 fail in fixture → status=failed
      status: 'failed',
      score: 42,
      criteriaCount: 3,
      passCount: 1,
      failCount: 1,
      warnCount: 1,
      decision: 'CONDITIONAL',
    });
    // fieldsExtracted derives from the keys of axiomExtractedSummary (4 fields)
    expect(completed.data.fieldsExtracted).toBeGreaterThanOrEqual(4);
  });

  it('P-19 step toward QC: publishes qc.issue.detected for each fail/warning criterion (CRITICAL for fail, MAJOR for warning)', async () => {
    const dbStub = {
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
      getItem: vi.fn()
        .mockResolvedValueOnce({ success: true, data: buildPendingEvaluation() })
        .mockResolvedValueOnce({ success: true, data: { id: 'doc-100' } }),
      updateItem: vi.fn().mockResolvedValue({ success: true }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);
    vi.spyOn(service, 'fetchPipelineResults').mockResolvedValue(buildLiveFireRawResults());

    await service.fetchAndStorePipelineResults('order-100', 'pjob-100', 'eval-order-100-pjob-100');

    const issues = publishedEvents.filter((e) => e.type === 'qc.issue.detected');
    expect(issues, 'expected one qc.issue.detected per fail+warning criterion').toHaveLength(2);

    const failIssue = issues.find((e) => e.data.criterionId === 'CRIT-FAIL');
    expect(failIssue).toBeDefined();
    expect(failIssue.data).toMatchObject({
      orderId: 'order-100',
      tenantId: 'tenant-001',
      criterionId: 'CRIT-FAIL',
      issueType: 'criterion-fail',
      severity: 'CRITICAL',
      evaluationId: 'eval-order-100-pjob-100',
      pipelineJobId: 'pjob-100',
    });
    expect(failIssue.data.documentReferences).toEqual(
      expect.arrayContaining([expect.objectContaining({ page: 12 })]),
    );

    const warnIssue = issues.find((e) => e.data.criterionId === 'CRIT-WARN');
    expect(warnIssue).toBeDefined();
    expect(warnIssue.data.severity).toBe('MAJOR');

    // Pass criterion must NOT produce a qc-issue event
    expect(issues.find((e) => e.data.criterionId === 'CRIT-PASS')).toBeUndefined();
  });

  it('P-19 (d-extension): writes consolidated extractedData back to the source documents container', async () => {
    const updateItem = vi.fn().mockResolvedValue({ success: true });
    const documentRecord = { id: 'doc-100', fileName: 'Appraisal Report.pdf' };
    const dbStub = {
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
      getItem: vi.fn()
        .mockResolvedValueOnce({ success: true, data: buildPendingEvaluation() })
        .mockResolvedValueOnce({ success: true, data: documentRecord }),
      updateItem,
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new AxiomService(dbStub as any);
    vi.spyOn(service, 'fetchPipelineResults').mockResolvedValue(buildLiveFireRawResults());

    await service.fetchAndStorePipelineResults('order-100', 'pjob-100', 'eval-order-100-pjob-100');

    expect(updateItem).toHaveBeenCalledWith('documents', 'doc-100', expect.objectContaining({
      id: 'doc-100',
      extractedData: expect.objectContaining({
        gla: 1847,
        appraisedValue: 425000,
      }),
      extractedDataSource: 'axiom',
      extractedDataPipelineJobId: 'pjob-100',
    }));
    const writebackPayload = updateItem.mock.calls[0][2];
    expect(typeof writebackPayload.extractedDataAt).toBe('string');
    expect(Number.isNaN(Date.parse(writebackPayload.extractedDataAt))).toBe(false);
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
