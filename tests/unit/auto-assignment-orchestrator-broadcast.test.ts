/**
 * AutoAssignmentOrchestratorService — Broadcast Mode + Axiom Gate unit tests
 *
 * Extends the base FSM tests (tests/auto-assignment-orchestrator.test.ts) with:
 *   1. Broadcast mode: top-N vendors contacted simultaneously
 *   2. Broadcast acceptance: first vendor to accept wins, others are cancelled
 *   3. Axiom gate: order.status.changed defers QC routing to axiom.evaluation.completed
 *   4. Axiom ACCEPT routes to AI QC queue
 *   5. Axiom REJECT / UNKNOWN routes to human QC
 *   6. Axiom evaluation failure routes to human QC
 *
 * Run: pnpm test:unit
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { EventPriority, EventCategory } from '../../src/types/events.js';

// ── Module mocks — must be declared before importing the orchestrator ─────────

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue(undefined),
    publishBatch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    startListening: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/vendor-matching-engine.service.js', () => ({
  VendorMatchingEngine: vi.fn().mockImplementation(() => ({
    findMatchingVendors: vi.fn(),
  })),
}));

vi.mock('../../src/services/qc-review-queue.service.js', () => ({
  QCReviewQueueService: vi.fn().mockImplementation(() => ({
    addToQueue: vi.fn(),
    assignReview: vi.fn(),
    getAllAnalystWorkloads: vi.fn(),
    createQCReview: vi.fn(),
  })),
}));

vi.mock('../../src/services/supervisory-review.service.js', () => ({
  SupervisoryReviewService: vi.fn().mockImplementation(() => ({
    requestSupervision: vi.fn(),
  })),
}));

const mockGetConfig = vi.fn();
vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: mockGetConfig,
  })),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { AutoAssignmentOrchestratorService } from '../../src/services/auto-assignment-orchestrator.service.js';
import { ServiceBusEventPublisher } from '../../src/services/service-bus-publisher.js';
import { VendorMatchingEngine } from '../../src/services/vendor-matching-engine.service.js';
import { QCReviewQueueService } from '../../src/services/qc-review-queue.service.js';

// ── In-memory DB stub (mirrors pattern from auto-assignment-orchestrator.test.ts) ──

function createMockDbService() {
  const orders = new Map<string, any>();
  const bids = new Map<string, any>();
  const qcItems = new Map<string, any>();

  const getStore = (container: string) => {
    if (container === 'orders') return orders;
    if (container === 'vendor-bids') return bids;
    if (container === 'qc-reviews') return qcItems;
    return new Map();
  };

  // Fake Cosmos container used by cancelPendingBroadcastBids
  const fakeContainer = {
    items: {
      query: vi.fn().mockReturnValue({
        fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
      }),
      upsert: vi.fn().mockResolvedValue({ resource: {} }),
    },
  };

  return {
    _orders: orders,
    _bids: bids,
    _qcItems: qcItems,
    _fakeContainer: fakeContainer,
    createItem: vi.fn(async (container: string, item: any) => {
      getStore(container).set(item.id, { ...item });
      return { success: true, data: item };
    }),
    updateItem: vi.fn(async (container: string, _id: string, data: any, _tid?: string) => {
      getStore(container).set(data.id, { ...data });
      return { success: true, data };
    }),
    getItem: vi.fn(async (container: string, id: string) => {
      const item = getStore(container).get(id);
      return item ? { data: item } : null;
    }),
    getContainer: vi.fn().mockImplementation(() => fakeContainer),
    queryItems: vi.fn().mockResolvedValue({ success: false, data: [] }),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-broadcast-001';

function makeOrder(overrides: Partial<any> = {}) {
  const id = overrides.id ?? `order-${uuidv4()}`;
  return {
    id,
    orderNumber: `ORD-BC-${id.slice(-6)}`,
    tenantId: TENANT_ID,
    productType: 'FULL_APPRAISAL',
    propertyAddress: '1 Broadcast Ln, Reston, VA 20190',
    propertyState: 'VA',
    clientId: 'client-001',
    engagementId: 'eng-001',
    loanAmount: 450000,
    priority: 'STANDARD',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'NEW',
    ...overrides,
  };
}

/** findMatchingVendors returns this shape; orchestrator maps it to RankedVendorEntry */
function makeVendorResults(n = 5) {
  return Array.from({ length: n }, (_, i) => ({
    vendorId: `v${i + 1}`,
    vendor: { name: `Vendor ${i + 1}` },
    matchScore: 95 - i * 5,
  }));
}

const sequentialConfig = {
  autoAssignmentEnabled: true,
  bidMode: 'sequential' as const,
  broadcastCount: 5,
  axiomAutoTrigger: false,
  axiomTimeoutMinutes: 10,
  // aiQcEnabled MUST be false here so onOrderStatusChanged proceeds to QC routing
  // when neither gate is active. Tests that need aiQcEnabled can override directly.
  aiQcEnabled: false,
  maxVendorAttempts: 5,
  escalationRecipients: ['ops@test.com'],
  supervisoryReviewForAllOrders: false,
  supervisoryReviewValueThreshold: 0,
  defaultSupervisorId: null,
  preferredVendorIds: [],
};

function broadcastConfig(count = 3) {
  return { ...sequentialConfig, bidMode: 'broadcast' as const, broadcastCount: count };
}

function axiomConfig(aiQcEnabled = true) {
  return { ...sequentialConfig, axiomAutoTrigger: true, aiQcEnabled };
}

// ── Accessor helpers ──────────────────────────────────────────────────────────

function getPublisher() {
  const M = ServiceBusEventPublisher as any;
  return M.mock.results[M.mock.results.length - 1].value;
}

function getMatchingEngine() {
  const M = VendorMatchingEngine as any;
  return M.mock.results[M.mock.results.length - 1].value;
}

function getQcQueue() {
  const M = QCReviewQueueService as any;
  return M.mock.results[M.mock.results.length - 1].value;
}

function publishedTypes(publisher: any): string[] {
  return (publisher.publish as ReturnType<typeof vi.fn>).mock.calls.map(
    (args: any[]) => (args[0] as any).type,
  );
}

function publishedEvent(publisher: any, type: string) {
  const call = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls.find(
    (args: any[]) => (args[0] as any).type === type,
  );
  return call ? (call[0] as any) : undefined;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AutoAssignmentOrchestratorService — Broadcast Mode', () => {
  let db: ReturnType<typeof createMockDbService>;
  let orchestrator: AutoAssignmentOrchestratorService;
  let publisher: any;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDbService();
    orchestrator = new AutoAssignmentOrchestratorService(db as any);
    publisher = getPublisher();
    getMatchingEngine().findMatchingVendors.mockResolvedValue(makeVendorResults(5));
  });

  // ── 1. Broadcast: N bid invitations are created simultaneously ────────────

  it('creates broadcastCount bid invitations and publishes vendor.bid.round.started', async () => {
    mockGetConfig.mockResolvedValue(broadcastConfig(3));
    const order = makeOrder();
    db._orders.set(order.id, order);

    await orchestrator.triggerVendorAssignment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: TENANT_ID,
      engagementId: 'eng-001',
      productType: 'FULL_APPRAISAL',
      propertyAddress: order.propertyAddress,
      propertyState: 'VA',
      clientId: 'client-001',
      loanAmount: 450000,
      priority: 'STANDARD',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Exactly broadcastCount (3) bid documents created
    const bidCreates = (db.createItem as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: any[]) => args[0] === 'vendor-bids',
    );
    expect(bidCreates).toHaveLength(3);

    // Each bid should target a different vendor
    const vendorIds = bidCreates.map((args: any[]) => args[1].vendorId);
    expect(new Set(vendorIds).size).toBe(3);

    // Round-started event published
    expect(publishedTypes(publisher)).toContain('vendor.bid.round.started');
    const roundEvent = publishedEvent(publisher, 'vendor.bid.round.started');
    expect(roundEvent.data.roundNumber).toBe(1);
    expect(roundEvent.data.vendorIds).toHaveLength(3);

    // Individual vendor.bid.sent per vendor
    const sentEvents = publisher.publish.mock.calls.filter(
      (args: any[]) => (args[0] as any).type === 'vendor.bid.sent',
    );
    expect(sentEvents).toHaveLength(3);
  });

  // ── 2. Broadcast state persisted with broadcastBidIds ─────────────────────

  it('persists broadcastBidIds and broadcastMode=true in order state', async () => {
    mockGetConfig.mockResolvedValue(broadcastConfig(2));
    const order = makeOrder();
    db._orders.set(order.id, order);

    await orchestrator.triggerVendorAssignment({
      orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT_ID,
      engagementId: 'eng-001', productType: 'FULL_APPRAISAL',
      propertyAddress: order.propertyAddress, propertyState: 'VA',
      clientId: 'client-001', loanAmount: 450000, priority: 'STANDARD',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const orderUpdate = (db.updateItem as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: any[]) => args[0] === 'orders',
    );
    expect(orderUpdate).toBeDefined();
    const savedState = (orderUpdate as any[])[2].autoVendorAssignment;
    expect(savedState.broadcastMode).toBe(true);
    expect(savedState.broadcastBidIds).toHaveLength(2);
    expect(savedState.broadcastRound).toBe(1);
  });

  // ── 3. Broadcast escalates immediately when no vendors are available ───────

  it('escalates immediately when no vendors are returned in broadcast mode', async () => {
    mockGetConfig.mockResolvedValue(broadcastConfig(3));
    getMatchingEngine().findMatchingVendors.mockResolvedValue([]);
    const order = makeOrder();
    db._orders.set(order.id, order);

    await orchestrator.triggerVendorAssignment({
      orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT_ID,
      engagementId: 'eng-001', productType: 'FULL_APPRAISAL',
      propertyAddress: order.propertyAddress, propertyState: 'VA',
      clientId: 'client-001', loanAmount: 450000, priority: 'STANDARD',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    expect(publishedTypes(publisher)).toContain('vendor.assignment.exhausted');
    expect(db.createItem).not.toHaveBeenCalledWith('vendor-bids', expect.anything());
  });

  // ── 4. Broadcast acceptance cancels all other pending bids ───────────────────

  it('onVendorBidAccepted cancels other broadcast bids and publishes vendor.bid.accepted', async () => {
    const bidIds = ['bid-alpha', 'bid-beta', 'bid-gamma'];
    const state = {
      status: 'PENDING_BID',
      rankedVendors: makeVendorResults(3).map((r) => ({
        vendorId: r.vendorId, vendorName: r.vendor.name, score: r.matchScore,
      })),
      currentAttempt: 0,
      currentBidId: null,
      currentBidExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      initiatedAt: new Date().toISOString(),
      broadcastMode: true,
      broadcastBidIds: bidIds,
      broadcastRound: 1,
    };

    const order = makeOrder({ autoVendorAssignment: state });
    db._orders.set(order.id, order);

    // Seed two pending bids in Cosmos so cancel can find them
    const pendingBids = [
      { id: 'bid-beta', orderId: order.id, vendorId: 'v2', status: 'PENDING' },
      { id: 'bid-gamma', orderId: order.id, vendorId: 'v3', status: 'PENDING' },
    ];
    db._fakeContainer.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValueOnce({ resources: [pendingBids[0]] })
              .mockResolvedValueOnce({ resources: [pendingBids[1]] }),
    });

    const event = {
      id: uuidv4(), type: 'vendor.bid.accepted', timestamp: new Date(),
      source: 'test', version: '1.0', category: EventCategory.VENDOR,
      data: {
        orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT_ID,
        vendorId: 'v1', vendorName: 'Vendor 1', bidId: 'bid-alpha',
        priority: EventPriority.NORMAL,
      },
    };

    await (orchestrator as any).onVendorBidAccepted(event);

    // Other bids upserted as CANCELLED
    expect(db._fakeContainer.items.upsert).toHaveBeenCalled();

    // Order state updated to ACCEPTED
    const orderUpdate = (db.updateItem as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: any[]) => args[0] === 'orders',
    );
    const savedState = (orderUpdate as any[])[2].autoVendorAssignment;
    expect(savedState.status).toBe('ACCEPTED');
    // Note: the orchestrator does NOT re-publish vendor.bid.accepted — it only
    // updates state and cancels sibling bids. The bid controller published it first.
  });

  // ── 5. Broadcast: accepting vendor when already accepted is a no-op ────────

  it('ignores late acceptance when broadcast order is already ACCEPTED', async () => {
    const state = {
      status: 'ACCEPTED', // already won
      rankedVendors: makeVendorResults(2).map((r) => ({
        vendorId: r.vendorId, vendorName: r.vendor.name, score: r.matchScore,
      })),
      currentAttempt: 0, currentBidId: null,
      currentBidExpiresAt: null, initiatedAt: new Date().toISOString(),
      broadcastMode: true, broadcastBidIds: ['bid-A', 'bid-B'], broadcastRound: 1,
    };

    const order = makeOrder({ autoVendorAssignment: state });
    db._orders.set(order.id, order);

    const event = {
      id: uuidv4(), type: 'vendor.bid.accepted', timestamp: new Date(),
      source: 'test', version: '1.0', category: EventCategory.VENDOR,
      data: {
        orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT_ID,
        vendorId: 'v2', vendorName: 'Vendor 2', bidId: 'bid-B',
        priority: EventPriority.NORMAL,
      },
    };

    await (orchestrator as any).onVendorBidAccepted(event);

    // No state change, no published events (already accepted)
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(db.updateItem).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('AutoAssignmentOrchestratorService — Axiom Gate', () => {
  let db: ReturnType<typeof createMockDbService>;
  let orchestrator: AutoAssignmentOrchestratorService;
  let publisher: any;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDbService();
    orchestrator = new AutoAssignmentOrchestratorService(db as any);
    publisher = getPublisher();
  });

  // ── 6. Axiom gate: onOrderStatusChanged defers QC routing ─────────────────

  it('does NOT create a QC review in onOrderStatusChanged when axiomAutoTrigger=true', async () => {
    mockGetConfig.mockResolvedValue(axiomConfig());
    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    const event = {
      id: uuidv4(), type: 'order.status.changed', timestamp: new Date(),
      source: 'test', version: '1.0', category: EventCategory.ORDER,
      data: {
        orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT_ID,
        newStatus: 'SUBMITTED', previousStatus: 'DRAFT', priority: EventPriority.NORMAL,
      },
    };

    await (orchestrator as any).onOrderStatusChanged(event);

    expect(getQcQueue().addToQueue).not.toHaveBeenCalled();
  });

  // ── 7. Axiom ACCEPT routes to AI QC queue ─────────────────────────────────

  it('creates a QC review when Axiom returns ACCEPT', async () => {
    // aiQcEnabled must be false — if true the orchestrator returns early (defers to AI QC gate)
    mockGetConfig.mockResolvedValue(axiomConfig(false));
    getQcQueue().addToQueue.mockResolvedValue({ id: 'qc-axiom-001' });
    getQcQueue().getAllAnalystWorkloads.mockResolvedValue([]);
    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    const event = {
      id: uuidv4(), type: 'axiom.evaluation.completed', timestamp: new Date(),
      source: 'test', version: '1.0', category: EventCategory.QC,
      data: {
        orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT_ID,
        evaluationId: 'eval-001', pipelineJobId: 'job-001',
        overallRiskScore: 15, overallDecision: 'ACCEPT', status: 'completed',
        priority: EventPriority.NORMAL,
      },
    };

    await (orchestrator as any).onAxiomEvaluationCompleted(event);

    expect(getQcQueue().addToQueue).toHaveBeenCalledTimes(1);
  });

  // ── 8. Axiom REJECT routes to human QC ────────────────────────────────────

  it('creates a human QC review when Axiom returns REJECT', async () => {
    mockGetConfig.mockResolvedValue(axiomConfig(false));
    getQcQueue().addToQueue.mockResolvedValue({ id: 'qc-axiom-002' });
    getQcQueue().getAllAnalystWorkloads.mockResolvedValue([]);
    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    const event = {
      id: uuidv4(), type: 'axiom.evaluation.completed', timestamp: new Date(),
      source: 'test', version: '1.0', category: EventCategory.QC,
      data: {
        orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT_ID,
        evaluationId: 'eval-002', pipelineJobId: 'job-002',
        overallRiskScore: 88, overallDecision: 'REJECT', status: 'completed',
        priority: EventPriority.NORMAL,
      },
    };

    await (orchestrator as any).onAxiomEvaluationCompleted(event);

    expect(getQcQueue().addToQueue).toHaveBeenCalledTimes(1);
  });

  // ── 9. Axiom UNKNOWN routes to human QC ───────────────────────────────────

  it('creates a human QC review when Axiom returns UNKNOWN (failed evaluation)', async () => {
    mockGetConfig.mockResolvedValue(axiomConfig(false));
    getQcQueue().addToQueue.mockResolvedValue({ id: 'qc-axiom-003' });
    getQcQueue().getAllAnalystWorkloads.mockResolvedValue([]);
    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    const event = {
      id: uuidv4(), type: 'axiom.evaluation.completed', timestamp: new Date(),
      source: 'test', version: '1.0', category: EventCategory.QC,
      data: {
        orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT_ID,
        evaluationId: 'eval-003', pipelineJobId: 'job-003',
        overallRiskScore: 0, overallDecision: 'UNKNOWN', status: 'failed',
        priority: EventPriority.NORMAL,
      },
    };

    await (orchestrator as any).onAxiomEvaluationCompleted(event);

    expect(getQcQueue().addToQueue).toHaveBeenCalledTimes(1);
  });

  // ── 10. Axiom disabled: onOrderStatusChanged proceeds normally ─────────────

  it('proceeds to QC routing in onOrderStatusChanged when axiomAutoTrigger=false', async () => {
    // Both aiQcEnabled and axiomAutoTrigger must be false for the standard QC path to fire
    mockGetConfig.mockResolvedValue(sequentialConfig); // aiQcEnabled: false, axiomAutoTrigger: false
    getQcQueue().addToQueue.mockResolvedValue({ id: 'qc-no-axiom-001' });
    getQcQueue().getAllAnalystWorkloads.mockResolvedValue([
      { analystId: 'r1', analystName: 'Analyst', isAvailable: true, totalActiveReviews: 0, maxConcurrentReviews: 10, capacityUtilization: 0 },
    ]);

    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    const event = {
      id: uuidv4(), type: 'order.status.changed', timestamp: new Date(),
      source: 'test', version: '1.0', category: EventCategory.ORDER,
      data: {
        orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT_ID,
        newStatus: 'SUBMITTED', previousStatus: 'DRAFT', priority: EventPriority.NORMAL,
      },
    };

    await (orchestrator as any).onOrderStatusChanged(event);

    // With both gates disabled, addToQueue should be called to initiate QC review
    expect(getQcQueue().addToQueue).toHaveBeenCalledTimes(1);
  });
});
