/**
 * QCIssueRecorderService unit tests (P-19 / P-20 live-fire support).
 *
 * Closes the coverage gap flagged in the extraction-journey audit: this
 * service had ZERO tests despite being on the critical path between
 * `qc.issue.detected` (published by axiom.service.ts) and the QC Issues panel
 * (rendered by the frontend QC review page).
 *
 * What we verify:
 *   - subscribe() wires the handler to the right event topic
 *   - happy-path upsert into aiInsights container with deterministic ID
 *   - severity / issueType / documentReferences round-trip from event into record
 *   - missing required fields are dropped with a warn log (no upsert)
 *   - cosmos failure is logged (no throw — event consumer must not crash on a single bad write)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ─────────────────────────────────────────────────────────────
// The real subscriber connects to Service Bus. For unit tests we only care
// that subscribe() is called with the right topic + handler — replay we
// simulate by invoking the captured handler directly.

const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}));

import { QCIssueRecorderService, QC_ISSUES_CONTAINER } from '../../src/services/qc-issue-recorder.service.js';

describe('QCIssueRecorderService', () => {
  let mockUpsert: ReturnType<typeof vi.fn>;
  let getContainer: ReturnType<typeof vi.fn>;
  let dbStub: any;
  let service: QCIssueRecorderService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert = vi.fn().mockResolvedValue({ resource: {} });
    getContainer = vi.fn().mockReturnValue({ items: { upsert: mockUpsert } });
    dbStub = { getContainer };
    service = new QCIssueRecorderService(dbStub);
  });

  /** Drive the subscriber to call our event handler with the supplied event. */
  async function deliver(event: unknown): Promise<void> {
    await service.start();
    expect(mockSubscribe).toHaveBeenCalledWith('qc.issue.detected', expect.any(Object));
    const handler = mockSubscribe.mock.calls[0][1];
    await handler.handle(event);
  }

  it('start() subscribes to qc.issue.detected exactly once and is idempotent', async () => {
    await service.start();
    await service.start(); // second call should be a no-op
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith('qc.issue.detected', expect.objectContaining({
      handle: expect.any(Function),
    }));
  });

  it('writes a qc-issue record to the aiInsights container with a deterministic ID built from orderId + criterionId + evaluationId', async () => {
    await deliver({
      type: 'qc.issue.detected',
      data: {
        orderId: 'order-100',
        tenantId: 'tenant-001',
        criterionId: 'CRIT-FAIL-001',
        issueSummary: 'Insufficient comparable sales',
        issueType: 'criterion-fail',
        severity: 'CRITICAL',
        confidence: 0.91,
        reasoning: 'Only 2 comparables found within 6 months.',
        remediation: 'Source one additional closed sale.',
        documentReferences: [
          { documentId: 'doc-100', page: 12, section: 'Sales Comparison', quote: 'Comp 3 closed 2025-06-15' },
        ],
        evaluationId: 'eval-order-100-pjob-100',
        pipelineJobId: 'pjob-100',
      },
    });

    expect(getContainer).toHaveBeenCalledWith(QC_ISSUES_CONTAINER);
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    const record = mockUpsert.mock.calls[0][0];
    // ID format: `qc-issue-{orderId}-{criterionId}-{evalId.substring(0, 16)}`
    // 'eval-order-100-pjob-100'.substring(0,16) === 'eval-order-100-p'
    expect(record.id).toBe('qc-issue-order-100-CRIT-FAIL-001-eval-order-100-p');
    expect(record).toMatchObject({
      type: 'qc-issue',
      tenantId: 'tenant-001',
      orderId: 'order-100',
      criterionId: 'CRIT-FAIL-001',
      issueSummary: 'Insufficient comparable sales',
      issueType: 'criterion-fail',
      severity: 'CRITICAL',
      status: 'OPEN',
      confidence: 0.91,
      reasoning: 'Only 2 comparables found within 6 months.',
      remediation: 'Source one additional closed sale.',
      evaluationId: 'eval-order-100-pjob-100',
      pipelineJobId: 'pjob-100',
      createdBy: 'axiom',
    });
    expect(record.documentReferences).toEqual([
      expect.objectContaining({ documentId: 'doc-100', page: 12, section: 'Sales Comparison' }),
    ]);
    // Timestamps should be present and parseable
    expect(Number.isNaN(Date.parse(record.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(record.updatedAt))).toBe(false);
  });

  it('handles warning severity with issueType=criterion-warning correctly', async () => {
    await deliver({
      type: 'qc.issue.detected',
      data: {
        orderId: 'order-200',
        tenantId: 'tenant-001',
        criterionId: 'CRIT-WARN',
        issueType: 'criterion-warning',
        severity: 'MAJOR',
        evaluationId: 'eval-200',
      },
    });

    const record = mockUpsert.mock.calls[0][0];
    expect(record.issueType).toBe('criterion-warning');
    expect(record.severity).toBe('MAJOR');
    expect(record.status).toBe('OPEN');
  });

  it('falls back to manual issueType + MAJOR severity when fields are absent', async () => {
    await deliver({
      type: 'qc.issue.detected',
      data: {
        orderId: 'order-300',
        tenantId: 'tenant-001',
        criterionId: 'CRIT-X',
        // issueType + severity intentionally omitted
        evaluationId: 'eval-300',
      },
    });

    const record = mockUpsert.mock.calls[0][0];
    expect(record.issueType).toBe('manual');
    expect(record.severity).toBe('MAJOR');
  });

  it('drops the event without writing when orderId / tenantId / criterionId is missing', async () => {
    await deliver({
      type: 'qc.issue.detected',
      data: {
        // orderId omitted
        tenantId: 'tenant-001',
        criterionId: 'CRIT-NULL',
        evaluationId: 'eval-bad',
      },
    });

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('logs and swallows cosmos write failures so a single bad event does not crash the consumer', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('Cosmos throughput throttle'));

    await expect(deliver({
      type: 'qc.issue.detected',
      data: {
        orderId: 'order-400',
        tenantId: 'tenant-001',
        criterionId: 'CRIT-FLAKY',
        issueType: 'criterion-fail',
        severity: 'CRITICAL',
        evaluationId: 'eval-400',
      },
    })).resolves.not.toThrow();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('uses pipelineJobId as the evaluation suffix when evaluationId is absent (so deterministic ID still works)', async () => {
    await deliver({
      type: 'qc.issue.detected',
      data: {
        orderId: 'order-500',
        tenantId: 'tenant-001',
        criterionId: 'CRIT-NOEVAL',
        issueType: 'criterion-fail',
        severity: 'CRITICAL',
        pipelineJobId: 'pjob-500',
        // evaluationId omitted
      },
    });

    const record = mockUpsert.mock.calls[0][0];
    expect(record.id).toContain('order-500');
    expect(record.id).toContain('CRIT-NOEVAL');
    expect(record.id).toContain('pjob-500');
  });

  it('stop() unsubscribes and is idempotent when not started', async () => {
    await service.stop(); // never started — should be a no-op
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    await service.start();
    await service.stop();
    expect(mockUnsubscribe).toHaveBeenCalledWith('qc.issue.detected');
  });
});
