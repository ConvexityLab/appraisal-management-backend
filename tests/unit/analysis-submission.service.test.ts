import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateReadSasUrl } = vi.hoisted(() => ({
  mockGenerateReadSasUrl: vi.fn(),
}));

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    generateReadSasUrl: mockGenerateReadSasUrl,
  })),
}));

import { AnalysisSubmissionService } from '../../src/services/analysis-submission.service.js';

describe('AnalysisSubmissionService DOCUMENT_ANALYZE parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_CONTAINER_DOCUMENTS = 'documents';
    mockGenerateReadSasUrl.mockResolvedValue('https://blob.example/orders/order-123/report.pdf?sas=1');
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
    expect(mockSubmitOrderEvaluation).toHaveBeenCalledWith(
      'order-123',
      expect.arrayContaining([
        { fieldName: 'orderId', fieldType: 'string', value: 'order-123' },
        { fieldName: 'loanAmount', fieldType: 'number', value: 425000 },
        { fieldName: 'loanType', fieldType: 'string', value: 'CONVENTIONAL' },
        { fieldName: 'borrowerName', fieldType: 'string', value: 'Pat Borrower' },
        { fieldName: 'propertyStreet', fieldType: 'string', value: '123 Main St' },
        { fieldName: 'propertyCity', fieldType: 'string', value: 'Phoenix' },
        { fieldName: 'propertyState', fieldType: 'string', value: 'AZ' },
        { fieldName: 'propertyZip', fieldType: 'string', value: '85001' },
        { fieldName: 'propertyType', fieldType: 'string', value: 'SFR' },
        { fieldName: 'tenantId', fieldType: 'string', value: 'tenant-123' },
        { fieldName: 'clientId', fieldType: 'string', value: 'client-123' },
      ]),
      [{
        documentName: 'Appraisal Report.pdf',
        documentReference: 'https://blob.example/orders/order-123/report.pdf?sas=1',
      }],
      'tenant-123',
      'client-123',
      undefined,       // programId
      undefined,       // programVersion
      'ORDER',
      evaluationMode,
      false,           // forceResubmit
    );
    expect(response).toEqual({
      submissionId: 'eval-123',
      analysisType: 'DOCUMENT_ANALYZE',
      status: 'queued',
      provider: 'AXIOM',
      evaluationId: 'eval-123',
      pipelineJobId: 'job-123',
    });
  });
});