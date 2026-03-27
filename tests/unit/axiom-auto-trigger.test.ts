/**
 * AxiomAutoTriggerService — Unit Tests
 *
 * Coverage:
 *   onOrderStatusChanged happy path
 *     ✓ Submits evaluation and stamps axiomStatus='submitted'
 *     ✓ Publishes axiom.evaluation.submitted event on success
 *
 *   P3-B zero-document guard
 *     ✓ Stamps axiomStatus='skipped-no-documents' when no appraisal-report docs exist
 *     ✓ Publishes axiom.evaluation.skipped event
 *     ✓ Does NOT call submitOrderEvaluation when no docs
 *     ✓ Does NOT re-publish skip event when order already has axiomStatus='skipped-no-documents'
 *       (prevents recovery job from emitting 192 duplicate events over 48 h)
 *
 *   P3-C submit failure handling
 *     ✓ Stamps axiomStatus='submit-failed' when submitOrderEvaluation throws
 *     ✓ Publishes axiom.evaluation.failed event
 *     ✓ Re-throws so the caller (SB SDK) can abandon the message
 *     ✓ Stamps axiomStatus='submit-failed' when submitOrderEvaluation returns null
 *     ✓ Does NOT re-publish axiom.evaluation.failed when already submit-failed — exception path
 *       (prevents SB retry × max-delivery-count duplicate events per order)
 *     ✓ Does NOT re-publish axiom.evaluation.failed when already submit-failed — null-return path
 *
 *   P3-F idempotency
 *     ✓ Skips submission when order.axiomStatus is already 'submitted'
 *     ✓ Skips submission when order.axiomPipelineJobId is already set
 *
 *   Early-exit guards
 *     ✓ Returns immediately for non-SUBMITTED events
 *     ✓ Returns if tenant axiomAutoTrigger config is false
 *     ✓ Returns if order not found
 *     ✓ Returns if order has no clientId
 *
 *   triggerForOrder (P3-G)
 *     ✓ Calls onOrderStatusChanged with a synthetic SUBMITTED event
 *     ✓ Throws if order not found
 *     ✓ Throws if order has no tenantId
 *
 * All external dependencies are mocked/stubbed.
 * Run: pnpm test:unit
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Service Bus mocks ─────────────────────────────────────────────────────────

const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}));

const mockPublish = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

// ── TenantAutomationConfigService mock ───────────────────────────────────────

const mockGetConfig = vi.fn();

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: mockGetConfig,
  })),
}));

// ── DocumentService mock ──────────────────────────────────────────────────────

const mockListDocuments = vi.fn();

vi.mock('../../src/services/document.service.js', () => ({
  DocumentService: vi.fn().mockImplementation(() => ({
    listDocuments: mockListDocuments,
  })),
}));

// ── BlobStorageService mock ───────────────────────────────────────────────────

const mockGenerateReadSasUrl = vi.fn().mockResolvedValue('https://blob/Report.pdf?sv=sas-token');

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    generateReadSasUrl: mockGenerateReadSasUrl,
  })),
}));

// ── AxiomService mock ─────────────────────────────────────────────────────────

const mockSubmitOrderEvaluation = vi.fn();

vi.mock('../../src/services/axiom.service.js', () => ({
  AxiomService: vi.fn().mockImplementation(() => ({
    submitOrderEvaluation: mockSubmitOrderEvaluation,
  })),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { AxiomAutoTriggerService } from '../../src/services/axiom-auto-trigger.service.js';
import { EventCategory, EventPriority } from '../../src/types/events.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = 'tenant-unit-test';
const ORDER_ID = 'order-unit-001';
const CLIENT_ID = 'client-unit-001';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    tenantId: TENANT,
    clientId: CLIENT_ID,
    orderNumber: 'ORD-001',
    productType: 'appraisal',
    propertyAddress: { streetAddress: '123 Main St', city: 'Anytown', state: 'CA', zipCode: '90210' },
    ...overrides,
  };
}

function makeSubmittedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-001',
    type: 'order.status.changed',
    timestamp: new Date(),
    source: 'unit-test',
    version: '1.0',
    category: EventCategory.ORDER,
    data: {
      orderId: ORDER_ID,
      tenantId: TENANT,
      newStatus: 'SUBMITTED',
      previousStatus: 'DRAFT',
      changedBy: 'unit-test',
      priority: EventPriority.NORMAL,
      orderNumber: 'ORD-001',
      ...overrides,
    },
  } as any;
}

function makeAppraisalDocs() {
  return [
    { id: 'doc-1', name: 'Report.pdf', category: 'appraisal-report', blobUrl: 'https://blob/Report.pdf', blobName: 'order-unit-001/abc123.pdf', tenantId: TENANT },
  ];
}

// ── In-memory CosmosDbService stub ───────────────────────────────────────────

function createDbStub(order: Record<string, unknown> | null = makeOrder()) {
  const mockUpdateOrder = vi.fn().mockResolvedValue({ success: true });
  const mockFindOrderById = vi.fn().mockResolvedValue(
    order ? { success: true, data: order } : { success: false, data: null },
  );

  return {
    findOrderById: mockFindOrderById,
    updateOrder: mockUpdateOrder,
    // P3-F idempotency query (axiom.service calls this — but axiom.service is mocked at module level)
    query: vi.fn().mockResolvedValue({ success: true, data: [] }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('AxiomAutoTriggerService', () => {
  let service: AxiomAutoTriggerService;
  let db: ReturnType<typeof createDbStub>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set required env var for SAS URL generation
    process.env.STORAGE_CONTAINER_DOCUMENTS = 'documents';

    // Default: tenant has axiomAutoTrigger enabled
    mockGetConfig.mockResolvedValue({ axiomAutoTrigger: true });

    // Default: one appraisal-report document
    mockListDocuments.mockResolvedValue({ success: true, data: makeAppraisalDocs() });

    // Default: submitOrderEvaluation succeeds
    mockSubmitOrderEvaluation.mockResolvedValue({
      pipelineJobId: 'pjob-001',
      evaluationId: 'eval-001',
    });

    db = createDbStub();
    service = new AxiomAutoTriggerService(db as any);
  });

  // ── Early-exit guards ─────────────────────────────────────────────────────

  describe('early-exit guards', () => {
    it('returns immediately for non-SUBMITTED status events', async () => {
      const event = makeSubmittedEvent({ newStatus: 'IN_REVIEW' });
      await (service as any).onOrderStatusChanged(event);
      expect(db.findOrderById).not.toHaveBeenCalled();
    });

    it('returns if tenant axiomAutoTrigger config is false', async () => {
      mockGetConfig.mockResolvedValue({ axiomAutoTrigger: false });
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(db.findOrderById).not.toHaveBeenCalled();
    });

    it('returns (with warning) if order is not found', async () => {
      db.findOrderById.mockResolvedValueOnce({ success: false, data: null });
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(mockSubmitOrderEvaluation).not.toHaveBeenCalled();
    });

    it('returns if order has no clientId', async () => {
      db = createDbStub(makeOrder({ clientId: undefined }));
      service = new AxiomAutoTriggerService(db as any);
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(mockSubmitOrderEvaluation).not.toHaveBeenCalled();
    });
  });

  // ── P3-F Idempotency ─────────────────────────────────────────────────────

  describe('P3-F idempotency', () => {
    it('skips submission when order.axiomStatus is already "submitted"', async () => {
      db = createDbStub(makeOrder({ axiomStatus: 'submitted' }));
      service = new AxiomAutoTriggerService(db as any);
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(mockSubmitOrderEvaluation).not.toHaveBeenCalled();
    });

    it('skips submission when order.axiomStatus is "processing"', async () => {
      db = createDbStub(makeOrder({ axiomStatus: 'processing' }));
      service = new AxiomAutoTriggerService(db as any);
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(mockSubmitOrderEvaluation).not.toHaveBeenCalled();
    });

    it('skips submission when order.axiomPipelineJobId is already set', async () => {
      db = createDbStub(makeOrder({ axiomPipelineJobId: 'pjob-existing-001' }));
      service = new AxiomAutoTriggerService(db as any);
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(mockSubmitOrderEvaluation).not.toHaveBeenCalled();
    });
  });

  // ── P3-B zero-document guard ─────────────────────────────────────────────

  describe('P3-B zero-document guard', () => {
    beforeEach(() => {
      // Simulate no appraisal-report documents
      mockListDocuments.mockResolvedValue({ success: true, data: [] });
    });

    it('does NOT call submitOrderEvaluation when no appraisal-report docs exist', async () => {
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(mockSubmitOrderEvaluation).not.toHaveBeenCalled();
    });

    it('stamps axiomStatus="skipped-no-documents" on the order', async () => {
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(db.updateOrder).toHaveBeenCalledWith(ORDER_ID, { axiomStatus: 'skipped-no-documents' });
    });

    it('publishes axiom.evaluation.skipped event', async () => {
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      const call = mockPublish.mock.calls.find(
        ([evt]: [any]) => evt.type === 'axiom.evaluation.skipped',
      );
      expect(call).toBeDefined();
      expect(call[0].data.orderId).toBe(ORDER_ID);
      expect(call[0].data.reason).toBe('no-documents');
    });

    it('also skips when listDocuments returns non-appraisal-report categories only', async () => {
      mockListDocuments.mockResolvedValue({
        success: true,
        data: [
          { id: 'doc-2', name: 'Invoice.pdf', category: 'invoice', blobUrl: 'https://blob/Invoice.pdf', tenantId: TENANT },
        ],
      });
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(mockSubmitOrderEvaluation).not.toHaveBeenCalled();
    });

    it('does NOT re-publish axiom.evaluation.skipped if already axiomStatus="skipped-no-documents" (prevents recovery-job event spam)', async () => {
      // Simulate order already stamped from a prior trigger pass.
      db = createDbStub(makeOrder({ axiomStatus: 'skipped-no-documents' }));
      service = new AxiomAutoTriggerService(db as any);
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      // No event published, no DB write, no submission attempt.
      expect(mockPublish).not.toHaveBeenCalled();
      expect(db.updateOrder).not.toHaveBeenCalled();
      expect(mockSubmitOrderEvaluation).not.toHaveBeenCalled();
    });
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  describe('happy path — successful submission', () => {
    it('calls submitOrderEvaluation with the correct orderId, tenantId, and clientId', async () => {
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(mockSubmitOrderEvaluation).toHaveBeenCalledOnce();
      const [orderId, , , tenantId, clientId] = mockSubmitOrderEvaluation.mock.calls[0];
      expect(orderId).toBe(ORDER_ID);
      expect(tenantId).toBe(TENANT);
      expect(clientId).toBe(CLIENT_ID);
    });

    it('stamps axiomStatus="submitted" and pipelineJobId on the order', async () => {
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      expect(db.updateOrder).toHaveBeenCalledWith(ORDER_ID, {
        axiomStatus: 'submitted',
        axiomPipelineJobId: 'pjob-001',
        axiomEvaluationId: 'eval-001',
      });
    });

    it('publishes axiom.evaluation.submitted event with correct fields', async () => {
      await (service as any).onOrderStatusChanged(makeSubmittedEvent());
      const call = mockPublish.mock.calls.find(
        ([evt]: [any]) => evt.type === 'axiom.evaluation.submitted',
      );
      expect(call).toBeDefined();
      const evt = call[0];
      expect(evt.data.orderId).toBe(ORDER_ID);
      expect(evt.data.pipelineJobId).toBe('pjob-001');
      expect(evt.data.evaluationId).toBe('eval-001');
      expect(evt.data.tenantId).toBe(TENANT);
    });
  });

  // ── P3-C submit failure handling ─────────────────────────────────────────

  describe('P3-C submit failure handling', () => {
    it('stamps axiomStatus="submit-failed" when submitOrderEvaluation throws', async () => {
      mockSubmitOrderEvaluation.mockRejectedValueOnce(new Error('Axiom API down'));
      await expect(
        (service as any).onOrderStatusChanged(makeSubmittedEvent()),
      ).rejects.toThrow('Axiom API down');
      expect(db.updateOrder).toHaveBeenCalledWith(ORDER_ID, { axiomStatus: 'submit-failed' });
    });

    it('publishes axiom.evaluation.failed when submitOrderEvaluation throws', async () => {
      mockSubmitOrderEvaluation.mockRejectedValueOnce(new Error('Axiom API down'));
      await expect(
        (service as any).onOrderStatusChanged(makeSubmittedEvent()),
      ).rejects.toThrow();
      const call = mockPublish.mock.calls.find(
        ([evt]: [any]) => evt.type === 'axiom.evaluation.failed',
      );
      expect(call).toBeDefined();
      expect(call[0].data.orderId).toBe(ORDER_ID);
    });

    it('re-throws after stamping failed status (allows SB message abandonment → retry)', async () => {
      const originalError = new Error('upstream failure');
      mockSubmitOrderEvaluation.mockRejectedValueOnce(originalError);
      await expect(
        (service as any).onOrderStatusChanged(makeSubmittedEvent()),
      ).rejects.toBe(originalError);
    });

    it('stamps axiomStatus="submit-failed" and throws when submitOrderEvaluation returns null', async () => {
      mockSubmitOrderEvaluation.mockResolvedValueOnce(null);
      await expect(
        (service as any).onOrderStatusChanged(makeSubmittedEvent()),
      ).rejects.toThrow(/submitOrderEvaluation returned null/);
      expect(db.updateOrder).toHaveBeenCalledWith(ORDER_ID, { axiomStatus: 'submit-failed' });
    });

    it('does NOT re-publish axiom.evaluation.failed when already axiomStatus="submit-failed" — exception path (prevents SB retry event spam)', async () => {
      // Simulate a SB retry: the order was already stamped 'submit-failed' by a prior attempt.
      db = createDbStub(makeOrder({ axiomStatus: 'submit-failed' }));
      service = new AxiomAutoTriggerService(db as any);
      mockSubmitOrderEvaluation.mockRejectedValueOnce(new Error('Axiom still down'));
      await expect(
        (service as any).onOrderStatusChanged(makeSubmittedEvent()),
      ).rejects.toThrow('Axiom still down');
      // axiomStatus is stamped again (idempotent update), but no event should fire a second time.
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('does NOT re-publish axiom.evaluation.failed when already axiomStatus="submit-failed" — null-return path (prevents SB retry event spam)', async () => {
      db = createDbStub(makeOrder({ axiomStatus: 'submit-failed' }));
      service = new AxiomAutoTriggerService(db as any);
      mockSubmitOrderEvaluation.mockResolvedValueOnce(null);
      await expect(
        (service as any).onOrderStatusChanged(makeSubmittedEvent()),
      ).rejects.toThrow(/submitOrderEvaluation returned null/);
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  // ── makeHandler — SB retry propagation ──────────────────────────────────

  describe('makeHandler (Service Bus retry propagation)', () => {
    it('re-throws from handle() when the inner fn throws — so Service Bus SDK can abandon the message', async () => {
      // Build the handler the same way start() does
      const handler = (service as any).makeHandler(
        'order.status.changed',
        (service as any).onOrderStatusChanged.bind(service),
      );

      mockSubmitOrderEvaluation.mockRejectedValueOnce(new Error('Axiom API down'));

      // handle() must reject — if it resolves, the SB SDK completes the message and never retries
      await expect(handler.handle(makeSubmittedEvent())).rejects.toThrow('Axiom API down');
    });

    it('resolves from handle() for early-exit paths (non-SUBMITTED status) — SB settles normally', async () => {
      const handler = (service as any).makeHandler(
        'order.status.changed',
        (service as any).onOrderStatusChanged.bind(service),
      );
      // Non-SUBMITTED events are silently ignored — should NOT reject
      await expect(handler.handle(makeSubmittedEvent({ newStatus: 'IN_REVIEW' }))).resolves.toBeUndefined();
    });
  });



  describe('triggerForOrder (P3-G)', () => {
    it('triggers a successful evaluation when order exists and has a tenantId', async () => {
      await service.triggerForOrder(ORDER_ID);
      expect(mockSubmitOrderEvaluation).toHaveBeenCalledOnce();
      expect(db.updateOrder).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({ axiomStatus: 'submitted' }));
    });

    it('throws with a clear message when order is not found', async () => {
      db = createDbStub(null);
      service = new AxiomAutoTriggerService(db as any);
      await expect(service.triggerForOrder(ORDER_ID)).rejects.toThrow(/order not found/i);
    });

    it('throws with a clear message when order has no tenantId', async () => {
      db = createDbStub(makeOrder({ tenantId: undefined }));
      service = new AxiomAutoTriggerService(db as any);
      await expect(service.triggerForOrder(ORDER_ID)).rejects.toThrow(/no tenantId/i);
    });
  });
});
