import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}));

const mockGetConfig = vi.fn();

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: mockGetConfig,
  })),
}));

const mockSubmitDocumentForSchemaExtraction = vi.fn();

vi.mock('../../src/services/axiom.service.js', () => ({
  AxiomService: vi.fn().mockImplementation(() => ({
    submitDocumentForSchemaExtraction: mockSubmitDocumentForSchemaExtraction,
  })),
}));

const mockGenerateReadSasUrl = vi.fn().mockResolvedValue('https://blob.example/doc.pdf?sas=1');

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    generateReadSasUrl: mockGenerateReadSasUrl,
  })),
}));

import { AxiomDocumentProcessingService } from '../../src/services/axiom-document-processing.service.js';

describe('AxiomDocumentProcessingService', () => {
  const tenantId = 'tenant-001';
  const orderId = 'order-001';

  function makeDbStub(overrides?: Partial<any>) {
    return {
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'doc-001',
          name: 'Report.pdf',
          extractionStatus: undefined,
          blobName: 'orders/order-001/report.pdf',
        },
      }),
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: orderId,
          clientId: 'client-001',
        },
      }),
      updateItem: vi.fn().mockResolvedValue({ success: true }),
      ...overrides,
    };
  }

  function makeEvent(overrides?: Partial<any>) {
    return {
      data: {
        documentId: 'doc-001',
        orderId,
        tenantId,
        mimeType: 'application/pdf',
        blobName: 'orders/order-001/report.pdf',
        documentType: 'APPRAISAL_REPORT',
        category: 'appraisal-report',
        ...overrides,
      },
    } as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_CONTAINER_DOCUMENTS = 'documents';

    mockGetConfig.mockResolvedValue({ axiomAutoTrigger: true, axiomProgramId: 'FNMA-URAR', axiomProgramVersion: '1.0.0' });
    mockSubmitDocumentForSchemaExtraction.mockResolvedValue({ pipelineJobId: 'pipeline-001' });
  });

  it('skips non-PDF documents', async () => {
    const db = makeDbStub();
    const service = new AxiomDocumentProcessingService(db as any);

    await (service as any).onDocumentUploaded(makeEvent({ mimeType: 'image/png' }));

    expect(db.getItem).not.toHaveBeenCalled();
    expect(mockSubmitDocumentForSchemaExtraction).not.toHaveBeenCalled();
  });

  it('skips when tenant auto-trigger is disabled', async () => {
    mockGetConfig.mockResolvedValue({ axiomAutoTrigger: false });
    const db = makeDbStub();
    const service = new AxiomDocumentProcessingService(db as any);

    await (service as any).onDocumentUploaded(makeEvent());

    expect(db.getItem).not.toHaveBeenCalled();
    expect(mockSubmitDocumentForSchemaExtraction).not.toHaveBeenCalled();
  });

  it('skips when extractionStatus is already set', async () => {
    const db = makeDbStub({
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'doc-001', name: 'Report.pdf', extractionStatus: 'AXIOM_PENDING' },
      }),
    });
    const service = new AxiomDocumentProcessingService(db as any);

    await (service as any).onDocumentUploaded(makeEvent());

    expect(mockSubmitDocumentForSchemaExtraction).not.toHaveBeenCalled();
  });

  it('marks AXIOM_FAILED when documentType and category are both missing', async () => {
    const db = makeDbStub();
    const service = new AxiomDocumentProcessingService(db as any);

    await (service as any).onDocumentUploaded(makeEvent({ documentType: undefined, category: undefined }));

    expect(db.updateItem).toHaveBeenCalledWith('documents', 'doc-001', { extractionStatus: 'AXIOM_PENDING' });
    expect(db.updateItem).toHaveBeenCalledWith('documents', 'doc-001', { extractionStatus: 'AXIOM_FAILED' });
    expect(mockSubmitDocumentForSchemaExtraction).not.toHaveBeenCalled();
  });

  it('marks AXIOM_FAILED when submitDocumentForSchemaExtraction returns null', async () => {
    mockSubmitDocumentForSchemaExtraction.mockResolvedValueOnce(null);
    const db = makeDbStub();
    const service = new AxiomDocumentProcessingService(db as any);

    await (service as any).onDocumentUploaded(makeEvent());

    expect(db.updateItem).toHaveBeenCalledWith('documents', 'doc-001', { extractionStatus: 'AXIOM_PENDING' });
    expect(db.updateItem).toHaveBeenCalledWith('documents', 'doc-001', { extractionStatus: 'AXIOM_FAILED' });
  });

  it('submits extraction and stamps pipeline job id on success', async () => {
    const db = makeDbStub();
    const service = new AxiomDocumentProcessingService(db as any);

    await (service as any).onDocumentUploaded(makeEvent());

    expect(mockGenerateReadSasUrl).toHaveBeenCalledWith('documents', 'orders/order-001/report.pdf');
    expect(mockSubmitDocumentForSchemaExtraction).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-001',
        orderId,
        tenantId,
        clientId: 'client-001',
        documentType: 'APPRAISAL_REPORT',
      }),
    );
    expect(db.updateItem).toHaveBeenCalledWith('documents', 'doc-001', { extractionStatus: 'AXIOM_PENDING' });
    expect(db.updateItem).toHaveBeenCalledWith('documents', 'doc-001', { axiomPipelineJobId: 'pipeline-001' });
  });
});
