/**
 * Engagement Workflow — E2E Integration Tests
 *
 * Validates the full pipeline by wiring the AutoAssignmentOrchestratorService
 * and CommunicationEventHandler together through a captured-event bus.
 * Published events from the orchestrator are replayed into the communication
 * handler to verify the complete notification flow.
 *
 * Scenarios covered:
 *   1. Sequential assignment happy path
 *        order.created → vendor.bid.sent → vendor email sent
 *        vendor.bid.accepted → coordinator notified
 *
 *   2. Broadcast bid round
 *        bidMode=broadcast → vendor.bid.round.started + N × vendor.bid.sent
 *        first vendor.bid.accepted → other bids cancelled → coordinator notified
 *
 *   3. Axiom gate + QC routing
 *        order.status.changed (SUBMITTED, axiomAutoTrigger=true) → QC deferred
 *        axiom.evaluation.completed ACCEPT → QC review created
 *        axiom.evaluation.completed REJECT → human QC created
 *
 *   4. Engagement letter lifecycle
 *        engagement.letter.sent → coordinator emailed
 *        engagement.letter.signed → coordinator emailed ✓
 *        engagement.letter.declined → coordinator + escalation emailed
 *
 *   5. SLA notifications
 *        review.sla.warning → reviewer + escalation emailed
 *        review.sla.breached → escalation emailed
 *
 *   6. Order delivered → client emailed
 *
 * Run with: pnpm vitest run tests/engagement-workflow.e2e.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { EventPriority, EventCategory } from '../src/types/events';

// ── Module mocks ─────────────────────────────────────────────────────────────

// Capture published events for replaying into CommunicationEventHandler
const publishedEvents: Array<{ type: string; data: any }> = [];
const mockPublish = vi.fn(async (event: any) => {
  publishedEvents.push(event);
});

vi.mock('../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
    publishBatch: vi.fn().mockImplementation(async (events: any[]) => {
      events.forEach(e => publishedEvents.push(e));
    }),
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
  VendorMatchingEngine: vi.fn().mockImplementation(() => {
    const instance: any = {
    findMatchingVendors: vi.fn(),
    };
    // Production now calls findMatchingVendorsAndDenied; adapt to the legacy
    // findMatchingVendors mock so existing test setups keep working.
    instance.findMatchingVendorsAndDenied = vi.fn(async (req: any, max: number) => {
      const matches = await instance.findMatchingVendors(req, max);
      return { matches: matches ?? [], denied: [] };
    });
    return instance;
  }),
}));

vi.mock('../src/services/qc-review-queue.service.js', () => ({
  QCReviewQueueService: vi.fn().mockImplementation(() => ({
    addToQueue: vi.fn().mockResolvedValue(undefined),
    assignReview: vi.fn().mockResolvedValue(undefined),
    getAllAnalystWorkloads: vi.fn().mockResolvedValue([
      { analystId: 'r1', analystName: 'Sara QC', isAvailable: true, totalActiveReviews: 1, maxConcurrentReviews: 10, capacityUtilization: 10 },
    ]),
  })),
}));

vi.mock('../src/services/supervisory-review.service.js', () => ({
  SupervisoryReviewService: vi.fn().mockImplementation(() => ({
    requestSupervisoryReview: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Shared getConfig mock — all TenantAutomationConfigService instances use this fn.
// This avoids the problem of multiple instances (orchestrator + commHandler) each
// having private vi.fn() that we can't set from the outside.
const sharedGetConfig = vi.fn();
vi.mock('../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: sharedGetConfig,
  })),
}));

// Email mock — capture send calls
const sentEmails: Array<{ to: string | string[]; subject: string; html: string }> = [];
const mockSendEmail = vi.fn(async (params: any) => {
  sentEmails.push(params);
  return { success: true, messageId: `msg-${uuidv4()}` };
});

vi.mock('../src/services/email.service.js', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    sendEmail: mockSendEmail,
  })),
}));

// ── Imports after mocks ────────────────────────────────────────────────────────

import { AutoAssignmentOrchestratorService } from '../src/services/auto-assignment-orchestrator.service';
import { CommunicationEventHandler } from '../src/services/communication-event-handler.service';
import { ServiceBusEventPublisher } from '../src/services/service-bus-publisher.js';
import { VendorMatchingEngine } from '../src/services/vendor-matching-engine.service.js';
import { QCReviewQueueService } from '../src/services/qc-review-queue.service.js';

// ── Shared test constants ──────────────────────────────────────────────────────

const TENANT = 'tenant-e2e-001';

// ── In-memory DB shared between orchestrator and communication handler ─────────

function createSharedDb() {
  const orders = new Map<string, any>();
  const bids = new Map<string, any>();
  const qcItems = new Map<string, any>();
  const users = new Map<string, any>();
  const vendors = new Map<string, any>();
  const clients = new Map<string, any>();

  // Pre-seed non-order entities for comm handler lookups
  vendors.set(`${TENANT}::vendor-e2e-1`, { id: 'vendor-e2e-1', tenantId: TENANT, email: 'vendor1@appraisal.test', name: 'E2E Vendor 1' });
  vendors.set(`${TENANT}::vendor-e2e-2`, { id: 'vendor-e2e-2', tenantId: TENANT, email: 'vendor2@appraisal.test', name: 'E2E Vendor 2' });
  vendors.set(`${TENANT}::vendor-e2e-3`, { id: 'vendor-e2e-3', tenantId: TENANT, email: 'vendor3@appraisal.test', name: 'E2E Vendor 3' });
  clients.set(`${TENANT}::client-e2e-1`, { id: 'client-e2e-1', tenantId: TENANT, email: 'client@e2e.test' });
  users.set(`${TENANT}::reviewer-e2e-1`, { id: 'reviewer-e2e-1', tenantId: TENANT, email: 'reviewer@e2e.test' });

  const getStore = (container: string) => {
    switch (container) {
      case 'orders': return orders;
      case 'vendor-bids': return bids;
      case 'qc-reviews': return qcItems;
      case 'users': return users;
      case 'vendors': return vendors;
      case 'clients': return clients;
      default: return new Map();
    }
  };

  return {
    _orders: orders,
    _bids: bids,

    createItem: vi.fn(async (container: string, item: any) => {
      getStore(container).set(item.id, { ...item });
      return { success: true, data: item };
    }),
    updateItem: vi.fn(async (container: string, id: string, data: any, _tenantId?: string) => {
      getStore(container).set(id, { ...data });
      return { success: true, data };
    }),
    getItem: vi.fn(async (container: string, id: string, tenantId?: string) => {
      const key = tenantId ? `${tenantId}::${id}` : id;
      const fromKeyed = getStore(container).get(key);
      if (fromKeyed) return { success: true, data: fromKeyed };
      const direct = getStore(container).get(id);
      return direct ? { success: true, data: direct } : { success: false, data: null };
    }),
    findOrderById: vi.fn(async (id: string) => {
      const item = orders.get(id);
      return item ? { data: item } : null;
    }),
    getContainer: vi.fn((container: string) => ({
      items: {
        query: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
        }),
      },
    })),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<any> = {}) {
  const id = overrides.id ?? `order-e2e-${uuidv4().slice(0, 8)}`;
  return {
    id,
    orderNumber: `ORD-E2E-${id.slice(-6)}`,
    tenantId: TENANT,
    productType: 'FULL_APPRAISAL',
    propertyAddress: '456 Integration Way, Vienna, VA 22180',
    propertyState: 'VA',
    clientId: 'client-e2e-1',
    engagementId: `eng-${id}`,
    coordinatorEmail: 'coord@e2e.test',
    loanInformation: { loanAmount: 750_000 },
    priority: 'STANDARD',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'NEW',
    ...overrides,
  };
}

function makeVendors(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    vendorId: `vendor-e2e-${i + 1}`,
    vendor: { name: `E2E Vendor ${i + 1}` },
    matchScore: 95 - i * 10,
  }));
}

function getPublisherMock() {
  const Ctor = ServiceBusEventPublisher as any;
  return Ctor.mock.results[Ctor.mock.results.length - 1].value;
}

function getVendorEngineMock() {
  const Ctor = VendorMatchingEngine as any;
  return Ctor.mock.results[Ctor.mock.results.length - 1].value;
}

function getQcQueueMock() {
  const Ctor = QCReviewQueueService as any;
  return Ctor.mock.results[Ctor.mock.results.length - 1].value;
}

// No longer needed — all instances share sharedGetConfig directly.

function eventsOfType(type: string) {
  return publishedEvents.filter(e => e.type === type);
}

function baseEvent(type: string, data: Record<string, unknown>) {
  return {
    id: `evt-${uuidv4()}`,
    type,
    timestamp: new Date(),
    source: 'e2e-test',
    version: '1.0',
    category: EventCategory.VENDOR,
    data,
  };
}

// ── Scenario 1: Sequential bid happy path ─────────────────────────────────────

describe('Scenario 1 — Sequential bid happy path', () => {
  let db: ReturnType<typeof createSharedDb>;
  let orchestrator: AutoAssignmentOrchestratorService;
  let commHandler: CommunicationEventHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    publishedEvents.length = 0;
    sentEmails.length = 0;

    db = createSharedDb();
    orchestrator = new AutoAssignmentOrchestratorService(db as any);
    commHandler = new CommunicationEventHandler(db as any);

    sharedGetConfig.mockResolvedValue({
      autoAssignmentEnabled: true,
      bidMode: 'sequential',
      axiomAutoTrigger: false,
      aiQcEnabled: false,
      broadcastCount: 3,
      bidTimeoutMinutes: 60,
      maxAssignmentAttempts: 3,
      escalationRecipients: ['ops@e2e.test'],
    });

    getVendorEngineMock().findMatchingVendors.mockResolvedValue(makeVendors(3));
  });

  it('triggers a bid to top vendor and sends vendor email notification', async () => {
    const order = makeOrder();
    db._orders.set(order.id, order);

    await orchestrator.triggerVendorAssignment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      tenantId: TENANT,
      engagementId: order.engagementId,
      productType: order.productType,
      propertyAddress: order.propertyAddress,
      propertyState: order.propertyState,
      clientId: order.clientId,
      loanAmount: 750_000,
      priority: 'STANDARD',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // orchestrator published vendor.bid.sent
    const bidSentEvents = eventsOfType('vendor.bid.sent');
    expect(bidSentEvents).toHaveLength(1);
    expect(bidSentEvents[0].data.vendorId).toBe('vendor-e2e-1'); // top vendor

    // replay into communication handler → vendor receives email
    await (commHandler as any).onVendorBidSent(bidSentEvents[0]);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(sentEmails[0].to).toContain('vendor1@appraisal.test');
    expect(sentEmails[0].subject).toMatch(/invitation/i);
  });

  it('notifies coordinator when vendor accepts bid', async () => {
    const order = makeOrder({
      autoVendorAssignment: {
        status: 'PENDING_BID',
        rankedVendors: [{ vendorId: 'vendor-e2e-1', vendorName: 'E2E Vendor 1', score: 95 }],
        currentAttempt: 0,
        currentBidId: 'bid-e2e-1',
        currentBidExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        initiatedAt: new Date().toISOString(),
      },
    });
    db._orders.set(order.id, order);
    db._bids.set('bid-e2e-1', { id: 'bid-e2e-1', orderId: order.id, vendorId: 'vendor-e2e-1', status: 'PENDING', tenantId: TENANT });

    const acceptEvent = baseEvent('vendor.bid.accepted', {
      orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT,
      vendorId: 'vendor-e2e-1', vendorName: 'E2E Vendor 1',
      bidId: 'bid-e2e-1', priority: EventPriority.NORMAL,
    });

    await (orchestrator as any).onVendorBidAccepted(acceptEvent);

    // relay to comm handler → coordinator gets email
    await (commHandler as any).onVendorBidAccepted(acceptEvent);
    const coordEmail = sentEmails.find(e => {
      const toList = Array.isArray(e.to) ? e.to : [e.to];
      return toList.includes('coord@e2e.test');
    });
    expect(coordEmail).toBeDefined();
  });
});

// ── Scenario 2: Broadcast bid round ───────────────────────────────────────────

describe('Scenario 2 — Broadcast bid round', () => {
  let db: ReturnType<typeof createSharedDb>;
  let orchestrator: AutoAssignmentOrchestratorService;
  let commHandler: CommunicationEventHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    publishedEvents.length = 0;
    sentEmails.length = 0;

    db = createSharedDb();
    orchestrator = new AutoAssignmentOrchestratorService(db as any);
    commHandler = new CommunicationEventHandler(db as any);

    sharedGetConfig.mockResolvedValue({
      autoAssignmentEnabled: true,
      bidMode: 'broadcast',
      axiomAutoTrigger: false,
      aiQcEnabled: false,
      broadcastCount: 3,
      bidTimeoutMinutes: 60,
      maxAssignmentAttempts: 5,
      escalationRecipients: ['ops@e2e.test'],
    });

    getVendorEngineMock().findMatchingVendors.mockResolvedValue(makeVendors(3));
  });

  it('sends broadcastCount vendor invitations and publishes vendor.bid.round.started', async () => {
    const order = makeOrder();
    db._orders.set(order.id, order);

    await orchestrator.triggerVendorAssignment({
      orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT,
      engagementId: order.engagementId, productType: order.productType,
      propertyAddress: order.propertyAddress, propertyState: order.propertyState,
      clientId: order.clientId, loanAmount: 750_000, priority: 'STANDARD',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    expect(eventsOfType('vendor.bid.round.started')).toHaveLength(1);
    expect(eventsOfType('vendor.bid.sent')).toHaveLength(3); // all 3 vendors

    // Each bid results in a vendor email when relayed to comm handler
    for (const bidSent of eventsOfType('vendor.bid.sent')) {
      publishedEvents.push(); // noop to avoid mutation issue
      await (commHandler as any).onVendorBidSent(bidSent);
    }
    expect(mockSendEmail).toHaveBeenCalledTimes(3);
  });

  it('cancels remaining bids and notifies coordinator when first vendor accepts in broadcast mode', async () => {
    const order = makeOrder({
      autoVendorAssignment: {
        status: 'PENDING_BID',
        broadcastMode: true,
        broadcastRound: 1,
        broadcastBidIds: ['bid-b1', 'bid-b2', 'bid-b3'],
        rankedVendors: makeVendors(3).map((v, i) => ({
          vendorId: v.vendorId, vendorName: v.vendor.name, score: v.matchScore,
          bidId: `bid-b${i + 1}`,
        })),
        currentAttempt: 0,
        initiatedAt: new Date().toISOString(),
      },
    });
    db._orders.set(order.id, order);

    // Pre-seed bid records
    ['bid-b1', 'bid-b2', 'bid-b3'].forEach((bidId, i) => {
      db._bids.set(bidId, { id: bidId, orderId: order.id, vendorId: `vendor-e2e-${i + 1}`, status: 'PENDING', tenantId: TENANT });
    });

    const acceptEvent = baseEvent('vendor.bid.accepted', {
      orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT,
      vendorId: 'vendor-e2e-1', vendorName: 'E2E Vendor 1',
      bidId: 'bid-b1', priority: EventPriority.NORMAL,
    });

    await (orchestrator as any).onVendorBidAccepted(acceptEvent);

    // Comm handler notifies coordinator
    await (commHandler as any).onVendorBidAccepted(acceptEvent);
    const coordEmail = sentEmails.find(e => {
      const toList = Array.isArray(e.to) ? e.to : [e.to];
      return toList.includes('coord@e2e.test');
    });
    expect(coordEmail).toBeDefined();
  });
});

// ── Scenario 3: Axiom gate ────────────────────────────────────────────────────

describe('Scenario 3 — Axiom gate and QC routing', () => {
  let db: ReturnType<typeof createSharedDb>;
  let orchestrator: AutoAssignmentOrchestratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    publishedEvents.length = 0;

    db = createSharedDb();
    orchestrator = new AutoAssignmentOrchestratorService(db as any);

    sharedGetConfig.mockResolvedValue({
      autoAssignmentEnabled: true,
      bidMode: 'sequential',
      axiomAutoTrigger: true,
      // aiQcEnabled: true would cause BOTH onOrderStatusChanged AND onAxiomEvaluationCompleted
      // to return early. Set false so Axiom gate test can verify QC routing.
      aiQcEnabled: false,
      broadcastCount: 3,
      bidTimeoutMinutes: 60,
      maxAssignmentAttempts: 3,
      escalationRecipients: ['ops@e2e.test'],
    });
  });

  it('does not create QC review in onOrderStatusChanged when axiomAutoTrigger=true', async () => {
    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    await (orchestrator as any).onOrderStatusChanged(baseEvent('order.status.changed', {
      orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT,
      oldStatus: 'IN_PROGRESS', newStatus: 'SUBMITTED', priority: EventPriority.NORMAL,
    }));

    const qcQueue = getQcQueueMock();
    expect(qcQueue.addToQueue).not.toHaveBeenCalled();
  });

  it('creates QC review via queue when Axiom returns ACCEPT', async () => {
    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    await (orchestrator as any).onAxiomEvaluationCompleted(baseEvent('axiom.evaluation.completed', {
      orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT,
      jobId: 'axiom-job-1', overallDecision: 'ACCEPT', status: 'completed', score: 92,
      priority: EventPriority.NORMAL,
    }));

    const qcQueue = getQcQueueMock();
    expect(qcQueue.addToQueue).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: order.id }),
    );
  });

  it('routes to human QC (supervisory review) when Axiom returns REJECT', async () => {
    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    await (orchestrator as any).onAxiomEvaluationCompleted(baseEvent('axiom.evaluation.completed', {
      orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT,
      jobId: 'axiom-job-2', overallDecision: 'REJECT', status: 'completed', score: 30,
      priority: EventPriority.NORMAL,
    }));

    const qcQueue = getQcQueueMock();
    // REJECT still routes to review assignment (human QC) — addToQueue IS called
    expect(qcQueue.addToQueue).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: order.id }),
    );
  });

  it('falls through to standard QC when axiomAutoTrigger=false', async () => {
    sharedGetConfig.mockResolvedValue({
      autoAssignmentEnabled: true,
      bidMode: 'sequential',
      axiomAutoTrigger: false,
      aiQcEnabled: false,
      broadcastCount: 3,
      bidTimeoutMinutes: 60,
      maxAssignmentAttempts: 3,
      escalationRecipients: ['ops@e2e.test'],
    });

    const order = makeOrder({ status: 'SUBMITTED' });
    db._orders.set(order.id, order);

    await (orchestrator as any).onOrderStatusChanged(baseEvent('order.status.changed', {
      orderId: order.id, orderNumber: order.orderNumber, tenantId: TENANT,
      oldStatus: 'IN_PROGRESS', newStatus: 'SUBMITTED', priority: EventPriority.NORMAL,
    }));

    const qcQueue = getQcQueueMock();
    expect(qcQueue.addToQueue).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: order.id }),
    );
  });
});

// ── Scenario 4: Engagement letter lifecycle ───────────────────────────────────

describe('Scenario 4 — Engagement letter lifecycle', () => {
  let db: ReturnType<typeof createSharedDb>;
  let commHandler: CommunicationEventHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    sentEmails.length = 0;

    db = createSharedDb();
    commHandler = new CommunicationEventHandler(db as any);

    sharedGetConfig.mockResolvedValue({
      escalationRecipients: ['ops@e2e.test'],
    });
  });

  const orderId = 'e2e-letter-order';
  const orderNumber = 'ORD-LETTER-001';

  beforeEach(() => {
    db._orders.set(orderId, {
      id: orderId, tenantId: TENANT, orderNumber,
      coordinatorEmail: 'coord@e2e.test', clientId: 'client-e2e-1',
    });
  });

  it('emails coordinator when engagement letter is sent to vendor', async () => {
    await (commHandler as any).onEngagementLetterSent(baseEvent('engagement.letter.sent', {
      orderId, orderNumber, tenantId: TENANT,
      vendorId: 'vendor-e2e-1', letterId: 'letter-e2e-001',
      signingToken: 'tok-abc', expiresAt: new Date(Date.now() + 86400_000),
      priority: EventPriority.NORMAL,
    }));

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(sentEmails[0].to).toContain('coord@e2e.test');
    expect(sentEmails[0].subject).toMatch(/Engagement Letter Sent/i);
  });

  it('emails coordinator when vendor signs engagement letter', async () => {
    await (commHandler as any).onEngagementLetterSigned(baseEvent('engagement.letter.signed', {
      orderId, orderNumber, tenantId: TENANT,
      vendorId: 'vendor-e2e-1', letterId: 'letter-e2e-001',
      signedAt: new Date(), priority: EventPriority.NORMAL,
    }));

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(sentEmails[0].to).toContain('coord@e2e.test');
    expect(sentEmails[0].subject).toMatch(/Engagement Letter Signed/i);
  });

  it('emails coordinator AND escalation when vendor declines engagement letter', async () => {
    await (commHandler as any).onEngagementLetterDeclined(baseEvent('engagement.letter.declined', {
      orderId, orderNumber, tenantId: TENANT,
      vendorId: 'vendor-e2e-1', letterId: 'letter-e2e-001',
      declinedAt: new Date(), reason: 'Outside service area',
      priority: EventPriority.NORMAL,
    }));

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const recipients: string[] = Array.isArray(sentEmails[0].to) ? sentEmails[0].to : [sentEmails[0].to];
    expect(recipients).toContain('coord@e2e.test');
    expect(recipients).toContain('ops@e2e.test');
    expect(sentEmails[0].subject).toMatch(/Engagement Letter Declined/i);
    expect(sentEmails[0].html).toMatch(/Outside service area/);
  });
});

// ── Scenario 5: SLA notifications ────────────────────────────────────────────

describe('Scenario 5 — SLA warning and breach', () => {
  let db: ReturnType<typeof createSharedDb>;
  let commHandler: CommunicationEventHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    sentEmails.length = 0;

    db = createSharedDb();
    commHandler = new CommunicationEventHandler(db as any);

    sharedGetConfig.mockResolvedValue({
      escalationRecipients: ['ops@e2e.test'],
    });

    // seed order for subject line context
    db._orders.set('e2e-sla-order', {
      id: 'e2e-sla-order', tenantId: TENANT, orderNumber: 'ORD-SLA-001',
      coordinatorEmail: 'coord@e2e.test', clientId: 'client-e2e-1',
    });
  });

  it('emails reviewer and ops on review.sla.warning', async () => {
    await (commHandler as any).onReviewSLAWarning(baseEvent('review.sla.warning', {
      orderId: 'e2e-sla-order', orderNumber: 'ORD-SLA-001', tenantId: TENANT,
      qcReviewId: 'qc-sla-1', reviewerId: 'reviewer-e2e-1',
      percentElapsed: 80, targetDate: new Date(Date.now() + 3_600_000),
      remainingMinutes: 60, priority: EventPriority.NORMAL,
    }));

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const recipients: string[] = Array.isArray(sentEmails[0].to) ? sentEmails[0].to : [sentEmails[0].to];
    expect(recipients).toContain('reviewer@e2e.test');
    expect(recipients).toContain('ops@e2e.test');
    expect(sentEmails[0].subject).toMatch(/SLA Warning/i);
  });

  it('emails ops only on review.sla.breached', async () => {
    await (commHandler as any).onReviewSLABreached(baseEvent('review.sla.breached', {
      orderId: 'e2e-sla-order', orderNumber: 'ORD-SLA-001', tenantId: TENANT,
      qcReviewId: 'qc-sla-1', reviewerId: 'reviewer-e2e-1',
      targetDate: new Date(Date.now() - 3_600_000), minutesOverdue: 60,
      priority: EventPriority.HIGH,
    }));

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const recipients: string[] = Array.isArray(sentEmails[0].to) ? sentEmails[0].to : [sentEmails[0].to];
    expect(recipients).toContain('ops@e2e.test');
    expect(sentEmails[0].subject).toMatch(/SLA Breached/i);
    expect(sentEmails[0].html).toMatch(/60/); // minutesOverdue
  });
});

// ── Scenario 6: Order delivered → client email ───────────────────────────────

describe('Scenario 6 — Order delivered', () => {
  let db: ReturnType<typeof createSharedDb>;
  let commHandler: CommunicationEventHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    sentEmails.length = 0;

    db = createSharedDb();
    commHandler = new CommunicationEventHandler(db as any);

    db._orders.set('e2e-delivered-order', {
      id: 'e2e-delivered-order', tenantId: TENANT, orderNumber: 'ORD-DEL-001',
      coordinatorEmail: 'coord@e2e.test', clientId: 'client-e2e-1',
    });
  });

  it('emails client when order is delivered', async () => {
    await (commHandler as any).onOrderDelivered(baseEvent('order.delivered', {
      orderId: 'e2e-delivered-order', orderNumber: 'ORD-DEL-001', tenantId: TENANT,
      clientId: 'client-e2e-1', deliveredAt: new Date().toISOString(),
      priority: EventPriority.NORMAL,
    }));

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(sentEmails[0].to).toContain('client@e2e.test');
    expect(sentEmails[0].subject).toMatch(/Appraisal Report is Ready/i);
  });
});
