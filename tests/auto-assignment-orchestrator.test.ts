/**
 * Auto-Assignment Orchestrator — FSM Unit Tests
 *
 * Tests the complete state machine flows:
 *   1. Vendor assignment happy path  (order created → bid sent → vendor accepts)
 *   2. Vendor bid timeout → advance  (timeout event → next vendor bid sent)
 *   3. Vendor bid decline → advance  (decline event → next vendor bid sent)
 *   4. Vendor exhaustion             (all vendors tried → escalation event published)
 *   5. Review assignment happy path  (order SUBMITTED → reviewer assigned)
 *   6. Reviewer timeout → advance    (timeout event → next reviewer assigned)
 *   7. Reviewer exhaustion           (all reviewers tried → escalation event published)
 *
 * All I/O is mocked: no real DB, Service Bus, or HTTP calls are made.
 * Run with: pnpm vitest run tests/auto-assignment-orchestrator.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { EventPriority, EventCategory } from '../src/types/events';

// ── Module mocks — must be declared before importing the orchestrator ─────────

vi.mock('../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue(undefined),
    publishBatch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    startListening: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../src/services/vendor-matching-engine.service.js', () => ({
  VendorMatchingEngine: vi.fn().mockImplementation(() => ({
    findMatchingVendors: vi.fn(),
  })),
}));

vi.mock('../src/services/qc-review-queue.service.js', () => ({
  QCReviewQueueService: vi.fn().mockImplementation(() => ({
    addToQueue: vi.fn(),
    assignReview: vi.fn(),
    getAllAnalystWorkloads: vi.fn(),
  })),
}));

// ── Import after mocks are registered ────────────────────────────────────────

import { AutoAssignmentOrchestratorService } from '../src/services/auto-assignment-orchestrator.service';
import { ServiceBusEventPublisher } from '../src/services/service-bus-publisher.js';
import { VendorMatchingEngine } from '../src/services/vendor-matching-engine.service.js';
import { QCReviewQueueService } from '../src/services/qc-review-queue.service.js';

// ── In-memory DB stub ─────────────────────────────────────────────────────────

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

  return {
    _orders: orders,
    _bids: bids,
    _qcItems: qcItems,
    createItem: vi.fn(async (container: string, item: any) => {
      getStore(container).set(item.id, { ...item });
      return { success: true, data: item };
    }),
    updateItem: vi.fn(async (container: string, _id: string, data: any) => {
      getStore(container).set(data.id, { ...data });
      return { success: true, data };
    }),
    getItem: vi.fn(async (container: string, id: string) => {
      const item = getStore(container).get(id);
      return item ? { data: item } : null;
    }),
    findOrderById: vi.fn(async (id: string) => {
      const item = orders.get(id);
      return item ? { data: item } : null;
    }),
  };
}

// ── Test data helpers ─────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-test-001';

function makeOrder(overrides: Partial<any> = {}) {
  const id = overrides.id ?? `order-${uuidv4()}`;
  return {
    id,
    orderNumber: `ORD-${id.slice(-6)}`,
    tenantId: TENANT_ID,
    productType: 'FULL_APPRAISAL',
    propertyAddress: '123 Test Street, Fairfax, VA 22030',
    propertyState: 'VA',
    clientId: 'client-001',
    engagementId: 'eng-001',
    loanInformation: { loanAmount: 500000 },
    priority: 'STANDARD',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'NEW',
    ...overrides,
  };
}

function makeVendorResults() {
  return [
    { vendorId: 'v1', vendor: { name: 'Vendor One' }, matchScore: 95 },
    { vendorId: 'v2', vendor: { name: 'Vendor Two' }, matchScore: 80 },
    { vendorId: 'v3', vendor: { name: 'Vendor Three' }, matchScore: 65 },
  ];
}

function makeAnalystWorkloads() {
  return [
    { analystId: 'r1', analystName: 'Sara Analyst', isAvailable: true, totalActiveReviews: 1, maxConcurrentReviews: 10, capacityUtilization: 10 },
    { analystId: 'r2', analystName: 'Mike Reviewer', isAvailable: true, totalActiveReviews: 5, maxConcurrentReviews: 10, capacityUtilization: 50 },
    { analystId: 'r3', analystName: 'Lee Staff', isAvailable: true, totalActiveReviews: 3, maxConcurrentReviews: 10, capacityUtilization: 30 },
  ];
}

// ── Helpers to access the publisher mock instance ─────────────────────────────

function getPublisher() {
  // The first instance created by the orchestrator constructor
  const MockPublisher = ServiceBusEventPublisher as any;
  return MockPublisher.mock.results[MockPublisher.mock.results.length - 1].value;
}

function getMatchingEngine() {
  const MockME = VendorMatchingEngine as any;
  return MockME.mock.results[MockME.mock.results.length - 1].value;
}

function getQcQueue() {
  const MockQC = QCReviewQueueService as any;
  return MockQC.mock.results[MockQC.mock.results.length - 1].value;
}

function publishedEventTypes(publisher: any): string[] {
  return (publisher.publish as ReturnType<typeof vi.fn>).mock.calls.map(
    (args: any[]) => (args[0] as any).type,
  );
}

function publishedEvent(publisher: any, type: string) {
  const call = (publisher.publish as ReturnType<typeof vi.fn>).mock.calls.find(
    (args: any[]) => (args[0] as any).type === type,
  );
  return call ? call[0] : undefined;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AutoAssignmentOrchestratorService — Vendor Assignment FSM', () => {
  let db: ReturnType<typeof createMockDbService>;
  let orchestrator: AutoAssignmentOrchestratorService;
  let publisher: any;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDbService();
    orchestrator = new AutoAssignmentOrchestratorService(db as any);
    publisher = getPublisher();

    // Default: matching engine returns 3 ranked vendors
    getMatchingEngine().findMatchingVendors.mockResolvedValue(makeVendorResults());
  });

  // ── 1. Happy path: order created → bid sent to top vendor ──────────────────

  it('sends a bid to the top-ranked vendor when triggerVendorAssignment is called', async () => {
    const order = makeOrder();
    db._orders.set(order.id, order);

    await orchestrator.triggerVendorAssignment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: TENANT_ID,
      engagementId: 'eng-001',
      productType: 'FULL_APPRAISAL',
      propertyAddress: '123 Test St, Fairfax, VA',
      propertyState: 'VA',
      clientId: 'client-001',
      loanAmount: 500000,
      priority: 'STANDARD',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // A bid invitation document was created in vendor-bids
    expect(db.createItem).toHaveBeenCalledWith(
      'vendor-bids',
      expect.objectContaining({ vendorId: 'v1', vendorName: 'Vendor One', status: 'PENDING' }),
    );

    // The order's autoVendorAssignment state was persisted
    expect(db.updateItem).toHaveBeenCalledWith(
      'orders',
      order.id,
      expect.objectContaining({
        autoVendorAssignment: expect.objectContaining({
          status: 'PENDING_BID',
          currentAttempt: 0,
          rankedVendors: expect.arrayContaining([expect.objectContaining({ vendorId: 'v1' })]),
        }),
      }),
      TENANT_ID,
    );

    // vendor.bid.sent event published
    expect(publishedEventTypes(publisher)).toContain('vendor.bid.sent');
    const event = publishedEvent(publisher, 'vendor.bid.sent');
    expect(event.data.vendorId).toBe('v1');
    expect(event.data.attemptNumber).toBe(1);
  });

  // ── 2. Idempotency: duplicate engagement.order.created is ignored ──────────

  it('ignores duplicate trigger when PENDING_BID is already in progress', async () => {
    const order = makeOrder({
      autoVendorAssignment: {
        status: 'PENDING_BID',
        rankedVendors: [{ vendorId: 'v1', vendorName: 'Vendor One', score: 95 }],
        currentAttempt: 0,
        currentBidId: 'bid-already-in-flight',
        currentBidExpiresAt: new Date().toISOString(),
        initiatedAt: new Date().toISOString(),
      },
    });
    db._orders.set(order.id, order);

    await orchestrator.triggerVendorAssignment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: TENANT_ID,
      engagementId: 'eng-001',
      productType: 'FULL_APPRAISAL',
      propertyAddress: '123 Test St, Fairfax, VA',
      propertyState: 'VA',
      clientId: 'client-001',
      loanAmount: 500000,
      priority: 'STANDARD',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // No new bid was created and no event was published
    expect(db.createItem).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  // ── 3. Vendor #1 times out → advance to vendor #2 ─────────────────────────

  it('advances to the next vendor when onVendorBidTimedOut is received', async () => {
    const order = makeOrder({
      autoVendorAssignment: {
        status: 'PENDING_BID',
        rankedVendors: [
          { vendorId: 'v1', vendorName: 'Vendor One', score: 95 },
          { vendorId: 'v2', vendorName: 'Vendor Two', score: 80 },
          { vendorId: 'v3', vendorName: 'Vendor Three', score: 65 },
        ],
        currentAttempt: 0,
        currentBidId: 'bid-001',
        currentBidExpiresAt: new Date(Date.now() - 1000).toISOString(), // already expired
        initiatedAt: new Date().toISOString(),
      },
    });
    db._orders.set(order.id, order);

    await (orchestrator as any).onVendorBidTimedOut({
      id: uuidv4(),
      type: 'vendor.bid.timeout',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId: TENANT_ID,
        vendorId: 'v1',
        bidId: 'bid-001',
        attemptNumber: 1,
        totalAttempts: 3,
        priority: EventPriority.NORMAL,
      },
    });

    // New bid for vendor #2 created
    expect(db.createItem).toHaveBeenCalledWith(
      'vendor-bids',
      expect.objectContaining({ vendorId: 'v2', status: 'PENDING', attemptNumber: 2 }),
    );

    // Updated order state: currentAttempt is now 1
    expect(db.updateItem).toHaveBeenCalledWith(
      'orders',
      order.id,
      expect.objectContaining({
        autoVendorAssignment: expect.objectContaining({ currentAttempt: 1 }),
      }),
      TENANT_ID,
    );

    // vendor.bid.sent published for vendor #2
    const sentEvent = publishedEvent(publisher, 'vendor.bid.sent');
    expect(sentEvent.data.vendorId).toBe('v2');
    expect(sentEvent.data.attemptNumber).toBe(2);
  });

  // ── 4. Vendor #1 declines → advance to vendor #2 ─────────────────────────

  it('advances to the next vendor when onVendorBidDeclined is received', async () => {
    const order = makeOrder({
      autoVendorAssignment: {
        status: 'PENDING_BID',
        rankedVendors: [
          { vendorId: 'v1', vendorName: 'Vendor One', score: 95 },
          { vendorId: 'v2', vendorName: 'Vendor Two', score: 80 },
        ],
        currentAttempt: 0,
        currentBidId: 'bid-001',
        currentBidExpiresAt: new Date().toISOString(),
        initiatedAt: new Date().toISOString(),
      },
    });
    db._orders.set(order.id, order);

    await (orchestrator as any).onVendorBidDeclined({
      id: uuidv4(),
      type: 'vendor.bid.declined',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId: TENANT_ID,
        vendorId: 'v1',
        bidId: 'bid-001',
        declineReason: 'Not available in area',
        attemptNumber: 1,
        totalAttempts: 2,
        priority: EventPriority.NORMAL,
      },
    });

    // vendor.bid.sent published for vendor #2
    const sentEvent = publishedEvent(publisher, 'vendor.bid.sent');
    expect(sentEvent.data.vendorId).toBe('v2');
  });

  // ── 5. All vendors exhausted → escalation event published ─────────────────

  it('publishes vendor.assignment.exhausted when all vendors have been contacted', async () => {
    const order = makeOrder({
      autoVendorAssignment: {
        status: 'PENDING_BID',
        rankedVendors: [
          { vendorId: 'v1', vendorName: 'Vendor One', score: 95 },
          { vendorId: 'v2', vendorName: 'Vendor Two', score: 80 },
        ],
        currentAttempt: 1, // v2 is currently being tried (last one)
        currentBidId: 'bid-002',
        currentBidExpiresAt: new Date().toISOString(),
        initiatedAt: new Date().toISOString(),
      },
    });
    db._orders.set(order.id, order);

    // Timeout on v2 — no more vendors left
    await (orchestrator as any).onVendorBidTimedOut({
      id: uuidv4(),
      type: 'vendor.bid.timeout',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId: TENANT_ID,
        vendorId: 'v2',
        bidId: 'bid-002',
        attemptNumber: 2,
        totalAttempts: 2,
        priority: EventPriority.NORMAL,
      },
    });

    // vendor.assignment.exhausted must be published
    expect(publishedEventTypes(publisher)).toContain('vendor.assignment.exhausted');
    const exhaustedEvent = publishedEvent(publisher, 'vendor.assignment.exhausted');
    expect(exhaustedEvent.data.orderId).toBe(order.id);
    expect(exhaustedEvent.data.requiresHumanIntervention).toBe(true);

    // Order marked as requiring human intervention
    expect(db.updateItem).toHaveBeenCalledWith(
      'orders',
      order.id,
      expect.objectContaining({ requiresHumanVendorAssignment: true }),
      TENANT_ID,
    );
  });

  // ── 6. Immediate escalation when no vendors found ─────────────────────────

  it('immediately escalates when matching engine returns no vendors', async () => {
    getMatchingEngine().findMatchingVendors.mockResolvedValue([]);

    const order = makeOrder();
    db._orders.set(order.id, order);

    await orchestrator.triggerVendorAssignment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: TENANT_ID,
      engagementId: 'eng-001',
      productType: 'FULL_APPRAISAL',
      propertyAddress: '123 Test St, Fairfax, VA',
      propertyState: 'VA',
      clientId: 'client-001',
      loanAmount: 500000,
      priority: 'STANDARD',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    expect(publishedEventTypes(publisher)).toContain('vendor.assignment.exhausted');
    expect(db.createItem).not.toHaveBeenCalledWith('vendor-bids', expect.anything());
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('AutoAssignmentOrchestratorService — Review Assignment FSM', () => {
  let db: ReturnType<typeof createMockDbService>;
  let orchestrator: AutoAssignmentOrchestratorService;
  let publisher: any;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDbService();
    orchestrator = new AutoAssignmentOrchestratorService(db as any);
    publisher = getPublisher();

    getQcQueue().addToQueue.mockResolvedValue({ id: 'qcr-001' });
    getQcQueue().assignReview.mockResolvedValue(undefined);
    getQcQueue().getAllAnalystWorkloads.mockResolvedValue(makeAnalystWorkloads());
  });

  // ── 7. Happy path: order SUBMITTED → reviewer assigned ────────────────────

  it('assigns the lowest-workload reviewer when an order is SUBMITTED', async () => {
    const order = makeOrder({ status: 'SUBMITTED', assignedVendorId: 'v1', assignedVendorName: 'Vendor One' });
    db._orders.set(order.id, order);

    await (orchestrator as any).onOrderStatusChanged({
      id: uuidv4(),
      type: 'order.status.changed',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.ORDER,
      data: {
        orderId: order.id,
        tenantId: TENANT_ID,
        newStatus: 'SUBMITTED',
        previousStatus: 'ASSIGNED',
        changedBy: 'test',
        priority: EventPriority.NORMAL,
      },
    });

    // QC queue: addToQueue + assignReview called
    expect(getQcQueue().addToQueue).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: order.id }),
    );
    expect(getQcQueue().assignReview).toHaveBeenCalledWith('qcr-001', 'r1'); // r1 has lowest workload (10%)

    // review.assigned published
    expect(publishedEventTypes(publisher)).toContain('review.assigned');
    const assignedEvent = publishedEvent(publisher, 'review.assigned');
    expect(assignedEvent.data.reviewerId).toBe('r1');
    expect(assignedEvent.data.attemptNumber).toBe(1);
  });

  // ── 8. Reviewer #1 times out → advance to reviewer #2 ────────────────────

  it('advances to the next reviewer when review.assignment.timeout is received', async () => {
    const qcReviewId = 'qcr-001';
    const order = makeOrder({
      status: 'SUBMITTED',
      autoReviewAssignment: {
        qcReviewId,
        status: 'PENDING_ACCEPTANCE',
        rankedReviewers: [
          { reviewerId: 'r1', reviewerName: 'Sara Analyst', workloadPct: 10 },
          { reviewerId: 'r2', reviewerName: 'Mike Reviewer', workloadPct: 50 },
          { reviewerId: 'r3', reviewerName: 'Lee Staff', workloadPct: 30 },
        ],
        currentAttempt: 0,
        currentAssignmentExpiresAt: new Date(Date.now() - 1000).toISOString(),
        initiatedAt: new Date().toISOString(),
      },
    });
    db._orders.set(order.id, order);

    await (orchestrator as any).onReviewAssignmentTimedOut({
      id: uuidv4(),
      type: 'review.assignment.timeout',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId: TENANT_ID,
        qcReviewId,
        reviewerId: 'r1',
        attemptNumber: 1,
        totalAttempts: 3,
        priority: EventPriority.NORMAL,
      },
    });

    // assignReview called for reviewer #2
    expect(getQcQueue().assignReview).toHaveBeenCalledWith(qcReviewId, 'r2');

    // review.assigned published for r2
    const assignedEvent = publishedEvent(publisher, 'review.assigned');
    expect(assignedEvent.data.reviewerId).toBe('r2');
    expect(assignedEvent.data.attemptNumber).toBe(2);
  });

  // ── 9. All reviewers exhausted → escalation event published ───────────────

  it('publishes review.assignment.exhausted when all reviewers have timed out', async () => {
    const qcReviewId = 'qcr-001';
    const order = makeOrder({
      status: 'SUBMITTED',
      autoReviewAssignment: {
        qcReviewId,
        status: 'PENDING_ACCEPTANCE',
        rankedReviewers: [
          { reviewerId: 'r1', reviewerName: 'Sara Analyst', workloadPct: 10 },
          { reviewerId: 'r2', reviewerName: 'Mike Reviewer', workloadPct: 50 },
        ],
        currentAttempt: 1, // r2 is currently assigned (last one)
        currentAssignmentExpiresAt: new Date().toISOString(),
        initiatedAt: new Date().toISOString(),
      },
    });
    db._orders.set(order.id, order);

    await (orchestrator as any).onReviewAssignmentTimedOut({
      id: uuidv4(),
      type: 'review.assignment.timeout',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId: TENANT_ID,
        qcReviewId,
        reviewerId: 'r2',
        attemptNumber: 2,
        totalAttempts: 2,
        priority: EventPriority.NORMAL,
      },
    });

    expect(publishedEventTypes(publisher)).toContain('review.assignment.exhausted');
    const exhaustedEvent = publishedEvent(publisher, 'review.assignment.exhausted');
    expect(exhaustedEvent.data.qcReviewId).toBe(qcReviewId);
    expect(exhaustedEvent.data.requiresHumanIntervention).toBe(true);

    // Order marked as requiring human review assignment
    expect(db.updateItem).toHaveBeenCalledWith(
      'orders',
      order.id,
      expect.objectContaining({ requiresHumanReviewAssignment: true }),
      TENANT_ID,
    );
  });

  // ── 10. Idempotency: duplicate SUBMITTED event is ignored ─────────────────

  it('ignores duplicate SUBMITTED event when review assignment already in progress', async () => {
    const order = makeOrder({
      status: 'SUBMITTED',
      autoReviewAssignment: {
        qcReviewId: 'qcr-already',
        status: 'PENDING_ACCEPTANCE',
        rankedReviewers: [{ reviewerId: 'r1', reviewerName: 'Sara', workloadPct: 10 }],
        currentAttempt: 0,
        currentAssignmentExpiresAt: new Date().toISOString(),
        initiatedAt: new Date().toISOString(),
      },
    });
    db._orders.set(order.id, order);

    await (orchestrator as any).onOrderStatusChanged({
      id: uuidv4(),
      type: 'order.status.changed',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.ORDER,
      data: { orderId: order.id, tenantId: TENANT_ID, newStatus: 'SUBMITTED', previousStatus: 'ASSIGNED', changedBy: 'test', priority: EventPriority.NORMAL },
    });

    expect(getQcQueue().addToQueue).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  // ── 11. Immediate escalation when no reviewers are available ──────────────

  it('immediately escalates review assignment when no analysts are available', async () => {
    getQcQueue().getAllAnalystWorkloads.mockResolvedValue([
      { analystId: 'r1', analystName: 'Sara', isAvailable: false, totalActiveReviews: 10, maxConcurrentReviews: 10, capacityUtilization: 100 },
    ]);

    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    await (orchestrator as any).onOrderStatusChanged({
      id: uuidv4(),
      type: 'order.status.changed',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.ORDER,
      data: { orderId: order.id, tenantId: TENANT_ID, newStatus: 'SUBMITTED', previousStatus: 'ASSIGNED', changedBy: 'test', priority: EventPriority.NORMAL },
    });

    expect(publishedEventTypes(publisher)).toContain('review.assignment.exhausted');
    expect(getQcQueue().assignReview).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('AutoAssignmentOrchestratorService — Full End-to-End Flow', () => {
  /**
   * Tests the entire lifecycle in a single test:
   *   1. Order created → bid sent to vendor #1
   *   2. Vendor #1 declines → bid sent to vendor #2
   *   3. Vendor #2 accepts (via REST endpoint simulation)
   *   4. Order status → SUBMITTED → reviewer #1 assigned
   *   5. Reviewer #1 times out → reviewer #2 assigned
   *   6. Reviewer #2 times out → escalation
   *
   * This gives you a complete observable trace of the FSM.
   */

  let db: ReturnType<typeof createMockDbService>;
  let orchestrator: AutoAssignmentOrchestratorService;
  let publisher: any;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDbService();
    orchestrator = new AutoAssignmentOrchestratorService(db as any);
    publisher = getPublisher();

    getMatchingEngine().findMatchingVendors.mockResolvedValue([
      { vendorId: 'v1', vendor: { name: 'Vendor One' }, matchScore: 95 },
      { vendorId: 'v2', vendor: { name: 'Vendor Two' }, matchScore: 80 },
    ]);
    getQcQueue().addToQueue.mockResolvedValue({ id: 'qcr-e2e' });
    getQcQueue().assignReview.mockResolvedValue(undefined);
    getQcQueue().getAllAnalystWorkloads.mockResolvedValue([
      { analystId: 'r1', analystName: 'Sara', isAvailable: true, totalActiveReviews: 1, maxConcurrentReviews: 10, capacityUtilization: 10 },
      { analystId: 'r2', analystName: 'Mike', isAvailable: true, totalActiveReviews: 5, maxConcurrentReviews: 10, capacityUtilization: 50 },
    ]);
  });

  it('traces the complete assignment lifecycle from order creation to escalation', async () => {
    const orderId = `order-e2e-${uuidv4()}`;
    const order = makeOrder({ id: orderId });
    db._orders.set(orderId, order);

    // Capture service instances once — vi.clearAllMocks() between steps only resets
    // call records, not the instances themselves.
    const pub = getPublisher();
    const qc = getQcQueue();

    const resetPub = () => (pub.publish as ReturnType<typeof vi.fn>).mockClear();
    const resetQc = () => {
      (qc.addToQueue as ReturnType<typeof vi.fn>).mockClear();
      (qc.assignReview as ReturnType<typeof vi.fn>).mockClear();
    };

    // ── Step 1: Trigger vendor assignment ────────────────────────────────────
    await orchestrator.triggerVendorAssignment({
      orderId,
      orderNumber: order.orderNumber,
      tenantId: TENANT_ID,
      engagementId: 'eng-e2e',
      productType: 'FULL_APPRAISAL',
      propertyAddress: '123 Test St, Fairfax, VA',
      propertyState: 'VA',
      clientId: 'client-001',
      loanAmount: 500000,
      priority: 'STANDARD',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    expect(publishedEvent(pub, 'vendor.bid.sent')?.data.vendorId).toBe('v1');
    expect(publishedEvent(pub, 'vendor.bid.sent')?.data.attemptNumber).toBe(1);
    resetPub();

    // ── Step 2: Vendor #1 declines ───────────────────────────────────────────
    const orderAfterStep1 = db._orders.get(orderId);
    expect(orderAfterStep1.autoVendorAssignment.currentAttempt).toBe(0);

    await (orchestrator as any).onVendorBidDeclined({
      id: uuidv4(),
      type: 'vendor.bid.declined',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId,
        orderNumber: order.orderNumber,
        tenantId: TENANT_ID,
        vendorId: 'v1',
        bidId: orderAfterStep1.autoVendorAssignment.currentBidId,
        declineReason: 'Area not covered',
        attemptNumber: 1,
        totalAttempts: 2,
        priority: EventPriority.NORMAL,
      },
    });

    expect(publishedEvent(pub, 'vendor.bid.sent')?.data.vendorId).toBe('v2');
    expect(publishedEvent(pub, 'vendor.bid.sent')?.data.attemptNumber).toBe(2);
    resetPub();

    // ── Step 3: Vendor #2 accepts (simulated via DB state update) ────────────
    const orderAfterStep2 = db._orders.get(orderId);
    expect(orderAfterStep2.autoVendorAssignment.currentAttempt).toBe(1);

    db._orders.set(orderId, {
      ...orderAfterStep2,
      autoVendorAssignment: { ...orderAfterStep2.autoVendorAssignment, status: 'ACCEPTED' },
      assignedVendorId: 'v2',
      assignedVendorName: 'Vendor Two',
      status: 'ASSIGNED',
    });

    // ── Step 4: Order status → SUBMITTED ─────────────────────────────────────
    await (orchestrator as any).onOrderStatusChanged({
      id: uuidv4(),
      type: 'order.status.changed',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.ORDER,
      data: { orderId, tenantId: TENANT_ID, newStatus: 'SUBMITTED', previousStatus: 'ASSIGNED', changedBy: 'test', priority: EventPriority.NORMAL },
    });

    expect(publishedEvent(pub, 'review.assigned')?.data.reviewerId).toBe('r1');
    expect(publishedEvent(pub, 'review.assigned')?.data.attemptNumber).toBe(1);
    resetPub(); resetQc();

    // ── Step 5: Reviewer #1 times out ────────────────────────────────────────
    await (orchestrator as any).onReviewAssignmentTimedOut({
      id: uuidv4(),
      type: 'review.assignment.timeout',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId,
        orderNumber: order.orderNumber,
        tenantId: TENANT_ID,
        qcReviewId: 'qcr-e2e',
        reviewerId: 'r1',
        attemptNumber: 1,
        totalAttempts: 2,
        priority: EventPriority.NORMAL,
      },
    });

    expect(publishedEvent(pub, 'review.assigned')?.data.reviewerId).toBe('r2');
    expect(publishedEvent(pub, 'review.assigned')?.data.attemptNumber).toBe(2);
    resetPub();

    // ── Step 6: Reviewer #2 times out — escalation ───────────────────────────
    await (orchestrator as any).onReviewAssignmentTimedOut({
      id: uuidv4(),
      type: 'review.assignment.timeout',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId,
        orderNumber: order.orderNumber,
        tenantId: TENANT_ID,
        qcReviewId: 'qcr-e2e',
        reviewerId: 'r2',
        attemptNumber: 2,
        totalAttempts: 2,
        priority: EventPriority.NORMAL,
      },
    });

    expect(publishedEventTypes(pub)).toContain('review.assignment.exhausted');
    const exhausted = publishedEvent(pub, 'review.assignment.exhausted');
    expect(exhausted.data.requiresHumanIntervention).toBe(true);
    expect(exhausted.data.qcReviewId).toBe('qcr-e2e');

    const finalOrder = db._orders.get(orderId);
    expect(finalOrder.requiresHumanReviewAssignment).toBe(true);
    expect(finalOrder.autoReviewAssignment.status).toBe('EXHAUSTED');
  });
});
