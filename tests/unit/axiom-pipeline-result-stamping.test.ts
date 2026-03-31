import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendToGroup = vi.fn().mockResolvedValue(undefined);

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
