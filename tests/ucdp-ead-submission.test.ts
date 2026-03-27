/**
 * UCDP/EAD Submission Service — Tests (Phase 1.5)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UCDPEADSubmissionService } from '../src/services/ucdp-ead-submission.service';
import type { SubmissionProvider, SubmissionPortal, SubmissionStatus, SSRFinding } from '../src/services/ucdp-ead-submission.service';

function createMockDbService() {
  const items: any[] = [];
  const mockContainer = {
    items: {
      query: vi.fn().mockReturnValue({
        fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
      }),
      upsert: vi.fn().mockImplementation(async (item: any) => {
        items.push(item);
        return { resource: item };
      }),
    },
  };
  return {
    ordersContainer: mockContainer,
    _items: items,
    _mockContainer: mockContainer,
  } as any;
}

function createMockProvider(overrides?: Partial<SubmissionProvider>): SubmissionProvider {
  return {
    submit: overrides?.submit ?? vi.fn().mockResolvedValue({
      portalDocumentId: 'DOC-12345',
      status: 'ACCEPTED' as SubmissionStatus,
      findings: [],
    }),
    checkStatus: overrides?.checkStatus ?? vi.fn().mockResolvedValue({
      status: 'ACCEPTED' as SubmissionStatus,
      findings: [],
    }),
  };
}

describe('UCDPEADSubmissionService', () => {
  describe('without provider', () => {
    let service: UCDPEADSubmissionService;
    let dbService: ReturnType<typeof createMockDbService>;

    beforeEach(() => {
      dbService = createMockDbService();
      service = new UCDPEADSubmissionService(dbService);
    });

    it('should return ERROR when no provider configured', async () => {
      const result = await service.submit({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        portal: 'UCDP',
        xmlContent: '<MESSAGE/>',
      });
      expect(result.isAccepted).toBe(false);
      expect(result.submission.status).toBe('ERROR');
      expect(result.submission.errorMessage).toContain('not configured');
    });

    it('should save the submission record even on provider error', async () => {
      await service.submit({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        portal: 'EAD',
        xmlContent: '<MESSAGE/>',
      });
      expect(dbService._mockContainer.items.upsert).toHaveBeenCalled();
    });
  });

  describe('with provider', () => {
    let service: UCDPEADSubmissionService;
    let dbService: ReturnType<typeof createMockDbService>;
    let provider: SubmissionProvider;

    beforeEach(() => {
      dbService = createMockDbService();
      provider = createMockProvider();
      service = new UCDPEADSubmissionService(dbService, provider);
    });

    it('should submit successfully and return ACCEPTED', async () => {
      const result = await service.submit({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        portal: 'UCDP',
        xmlContent: '<MESSAGE/>',
        lenderId: 'LENDER-1',
      });
      expect(result.isAccepted).toBe(true);
      expect(result.submission.status).toBe('ACCEPTED');
      expect(result.submission.portalDocumentId).toBe('DOC-12345');
      expect(result.hardStopCount).toBe(0);
    });

    it('should handle accepted with warnings', async () => {
      (provider.submit as any).mockResolvedValue({
        portalDocumentId: 'DOC-67890',
        status: 'ACCEPTED_WITH_WARNINGS',
        findings: [
          { code: 'W001', severity: 'WARNING', category: 'Data', description: 'Minor data issue' },
        ],
      });

      const result = await service.submit({
        orderId: 'ORD-002',
        tenantId: 'tenant-1',
        portal: 'UCDP',
        xmlContent: '<MESSAGE/>',
      });
      expect(result.isAccepted).toBe(true);
      expect(result.warningCount).toBe(1);
      expect(result.hardStopCount).toBe(0);
    });

    it('should handle rejection with hard stops', async () => {
      (provider.submit as any).mockResolvedValue({
        portalDocumentId: 'DOC-99999',
        status: 'REJECTED',
        findings: [
          { code: 'HS001', severity: 'HARD_STOP', category: 'Missing Data', description: 'Missing borrower' },
          { code: 'HS002', severity: 'HARD_STOP', category: 'Invalid', description: 'Invalid address' },
        ],
      });

      const result = await service.submit({
        orderId: 'ORD-003',
        tenantId: 'tenant-1',
        portal: 'EAD',
        xmlContent: '<MESSAGE/>',
      });
      expect(result.isAccepted).toBe(false);
      expect(result.hardStopCount).toBe(2);
    });

    it('should handle provider errors gracefully', async () => {
      (provider.submit as any).mockRejectedValue(new Error('Network timeout'));

      const result = await service.submit({
        orderId: 'ORD-004',
        tenantId: 'tenant-1',
        portal: 'UCDP',
        xmlContent: '<MESSAGE/>',
      });
      expect(result.isAccepted).toBe(false);
      expect(result.submission.status).toBe('ERROR');
      expect(result.submission.errorMessage).toBe('Network timeout');
      expect(result.submission.retryCount).toBe(1);
    });

    it('should get submissions for an order', async () => {
      const subs = await service.getSubmissionsForOrder('ORD-001', 'tenant-1');
      expect(Array.isArray(subs)).toBe(true);
    });
  });
});
