import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateReadSasUrl } = vi.hoisted(() => ({
  mockGenerateReadSasUrl: vi.fn(),
}));

const mockAxiomExecutionService = vi.hoisted(() => ({
  getExecutionByAxiomJobId: vi.fn(),
  createExecution: vi.fn(),
}));

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    generateReadSasUrl: mockGenerateReadSasUrl,
  })),
}));

vi.mock('../../src/services/axiom-execution.service.js', () => ({
  AxiomExecutionService: vi.fn().mockImplementation(() => ({
    getExecutionByAxiomJobId: mockAxiomExecutionService.getExecutionByAxiomJobId,
    createExecution: mockAxiomExecutionService.createExecution,
  })),
}));

import { AnalysisSubmissionService } from '../../src/services/analysis-submission.service.js';

describe('AnalysisSubmissionService DOCUMENT_ANALYZE parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_CONTAINER_DOCUMENTS = 'documents';
    mockGenerateReadSasUrl.mockResolvedValue('https://blob.example/orders/order-123/report.pdf?sas=1');
    mockAxiomExecutionService.getExecutionByAxiomJobId.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });
    mockAxiomExecutionService.createExecution.mockResolvedValue({ success: true, data: { id: 'exec-123' } });
  });

  it.each([
    ['EXTRACTION'],
    ['CRITERIA_EVALUATION'],
    ['COMPLETE_EVALUATION'],
  ] as const)('submits exact order/document context for %s', async (evaluationMode) => {
    const dbStub = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [{
          id: 'doc-123',
          blobName: 'orders/order-123/report.pdf',
          fileName: 'Appraisal Report.pdf',
        }],
      }),
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-123',
          tenantId: 'tenant-123',
          clientId: 'client-123',
          subClientId: 'sub-client-123',
          productType: 'FULL_APPRAISAL',
          propertyAddress: {
            streetAddress: '123 Main St',
            city: 'Phoenix',
            state: 'AZ',
            zipCode: '85001',
          },
          propertyDetails: {
            propertyType: 'SFR',
          },
          loanInformation: {
            loanAmount: 425000,
            loanType: 'CONVENTIONAL',
          },
          borrowerInformation: {
            firstName: 'Pat',
            lastName: 'Borrower',
          },
        },
      }),
    };

    const mockSubmitOrderEvaluation = vi.fn().mockResolvedValue({
      evaluationId: 'eval-123',
      pipelineJobId: 'job-123',
    });

    const service = new AnalysisSubmissionService(dbStub as any, {
      submitOrderEvaluation: mockSubmitOrderEvaluation,
      getLastPipelineSubmissionError: vi.fn(),
    } as any);

    const response = await service.submit(
      {
        analysisType: 'DOCUMENT_ANALYZE',
        orderId: 'order-123',
        documentId: 'doc-123',
        documentType: 'appraisal-report',
        evaluationMode,
      },
      {
        tenantId: 'tenant-123',
        initiatedBy: 'user-123',
        correlationId: 'corr-123',
        idempotencyKey: 'idem-123',
      },
    );

    expect(mockGenerateReadSasUrl).toHaveBeenCalledWith('documents', 'orders/order-123/report.pdf');
    const submitArgs = mockSubmitOrderEvaluation.mock.calls[0];
    expect(submitArgs?.[0]).toBe('order-123');
    expect(submitArgs?.[1]).toEqual(
      expect.arrayContaining([
        { fieldName: 'orderId', fieldType: 'string', value: 'order-123' },
        { fieldName: 'loanAmount', fieldType: 'number', value: 425000 },
        { fieldName: 'loanType', fieldType: 'string', value: 'CONVENTIONAL' },
        { fieldName: 'productType', fieldType: 'string', value: 'FULL_APPRAISAL' },
        { fieldName: 'borrowerName', fieldType: 'string', value: 'Pat Borrower' },
        { fieldName: 'propertyStreet', fieldType: 'string', value: '123 Main St' },
        { fieldName: 'propertyCity', fieldType: 'string', value: 'Phoenix' },
        { fieldName: 'propertyState', fieldType: 'string', value: 'AZ' },
        { fieldName: 'propertyZip', fieldType: 'string', value: '85001' },
        { fieldName: 'propertyType', fieldType: 'string', value: 'SFR' },
        { fieldName: 'tenantId', fieldType: 'string', value: 'tenant-123' },
        { fieldName: 'clientId', fieldType: 'string', value: 'client-123' },
      ]),
    );
    expect(submitArgs?.[2]).toEqual([
      {
        documentName: 'Appraisal Report.pdf',
        documentReference: 'https://blob.example/orders/order-123/report.pdf?sas=1',
        documentId: 'doc-123',
      },
    ]);
    expect(submitArgs?.slice(3)).toEqual([
      'tenant-123',
      'client-123',
      'sub-client-123',
      undefined,
      undefined,
      'ORDER',
      evaluationMode,
      false,
    ]);
    expect(response).toEqual({
      submissionId: 'eval-123',
      analysisType: 'DOCUMENT_ANALYZE',
      status: 'queued',
      provider: 'AXIOM',
      evaluationId: 'eval-123',
      pipelineJobId: 'job-123',
    });
    expect(mockAxiomExecutionService.getExecutionByAxiomJobId).toHaveBeenCalledWith('job-123');
    expect(mockAxiomExecutionService.createExecution).toHaveBeenCalledWith({
      tenantId: 'tenant-123',
      orderId: 'order-123',
      documentIds: ['doc-123'],
      axiomJobId: 'job-123',
      pipelineMode:
        evaluationMode === 'EXTRACTION'
          ? 'EXTRACTION_ONLY'
          : evaluationMode === 'CRITERIA_EVALUATION'
            ? 'CRITERIA_ONLY'
            : 'FULL_PIPELINE',
      initiatedBy: 'user-123',
    });
  });

  it('propagates draft source identity into the document analyze run-ledger record', async () => {
    const dbStub = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'doc-123',
            blobName: 'orders/order-123/report.pdf',
            fileName: 'Appraisal Report.pdf',
            orderId: 'order-123',
            entityType: 'order-intake-draft',
            entityId: 'draft-123',
          },
        ],
      }),
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-123',
          tenantId: 'tenant-123',
          clientId: 'client-123',
          subClientId: 'sub-client-123',
          metadata: {
            sourceIdentity: {
              sourceKind: 'manual-draft',
              intakeDraftId: 'draft-123',
              orderId: 'order-123',
              sourceArtifactRefs: [{ artifactType: 'order-intake-draft', artifactId: 'draft-123' }],
            },
          },
          propertyAddress: {
            streetAddress: '123 Main St',
            city: 'Phoenix',
            state: 'AZ',
            zipCode: '85001',
          },
          propertyDetails: {
            propertyType: 'SFR',
          },
          loanInformation: {
            loanAmount: 425000,
            loanType: 'CONVENTIONAL',
          },
          borrowerInformation: {
            firstName: 'Pat',
            lastName: 'Borrower',
          },
        },
      }),
    };

    const mockSubmitOrderEvaluation = vi.fn().mockResolvedValue({
      evaluationId: 'eval-123',
      pipelineJobId: 'job-123',
    });
    const service = new AnalysisSubmissionService(dbStub as any, {
      submitOrderEvaluation: mockSubmitOrderEvaluation,
      getLastPipelineSubmissionError: vi.fn(),
    } as any);

    const createExtractionRun = vi.fn().mockResolvedValue({ id: 'run-1' });
    const setRunStatus = vi.fn().mockResolvedValue({ id: 'run-1', status: 'running' });
    (service as any).configService = {
      getConfig: vi.fn().mockResolvedValue({
        axiomDocumentSchemaVersion: '1.0.0',
        axiomPipelineIdExtraction: 'pipeline-1',
      }),
    };
    (service as any).runLedgerService = {
      createExtractionRun,
      setRunStatus,
    };

    await service.submit(
      {
        analysisType: 'DOCUMENT_ANALYZE',
        orderId: 'order-123',
        documentId: 'doc-123',
        documentType: 'appraisal-report',
        evaluationMode: 'EXTRACTION',
      },
      {
        tenantId: 'tenant-123',
        initiatedBy: 'user-123',
        correlationId: 'corr-123',
        idempotencyKey: 'idem-123',
      },
    );

    expect(createExtractionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceIdentity: expect.objectContaining({
          sourceKind: 'manual-draft',
          intakeDraftId: 'draft-123',
          documentId: 'doc-123',
        }),
      }),
    );
    expect(setRunStatus).toHaveBeenCalled();
  });
});