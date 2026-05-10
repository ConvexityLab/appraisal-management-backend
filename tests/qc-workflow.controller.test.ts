import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Response } from 'express';
import request from 'supertest';

const mockQCQueueService = vi.hoisted(() => ({
  searchQueue: vi.fn(),
  getCurrentQueueItemForOrder: vi.fn(),
  assignReview: vi.fn(),
}));

const mockRevisionService = vi.hoisted(() => ({
  getActiveRevisions: vi.fn(),
}));

const mockEscalationService = vi.hoisted(() => ({
  createEscalation: vi.fn(),
}));

const mockCosmos = vi.hoisted(() => ({
  getDocument: vi.fn(),
  orderIds: [] as string[],
}));

vi.mock('../src/services/qc-review-queue.service.js', () => ({
  QCReviewQueueService: class QCReviewQueueService {
    async searchQueue(...args: unknown[]) {
      return mockQCQueueService.searchQueue(...args);
    }
    async getCurrentQueueItemForOrder(...args: unknown[]) {
      return mockQCQueueService.getCurrentQueueItemForOrder(...args);
    }
    async assignReview(...args: unknown[]) {
      return mockQCQueueService.assignReview(...args);
    }
  },
}));

vi.mock('../src/services/revision-management.service.js', () => ({
  RevisionManagementService: class RevisionManagementService {
    async getActiveRevisions(...args: unknown[]) {
      return mockRevisionService.getActiveRevisions(...args);
    }
  },
}));

vi.mock('../src/services/escalation-workflow.service.js', () => ({
  EscalationWorkflowService: class EscalationWorkflowService {
    async createEscalation(...args: unknown[]) {
      return mockEscalationService.createEscalation(...args);
    }
  },
}));

vi.mock('../src/services/sla-tracking.service.js', () => ({
  SLATrackingService: class SLATrackingService {},
}));

vi.mock('../src/services/cosmos-db.service.js', () => ({
  CosmosDbService: class CosmosDbService {
    async initialize() {
      return undefined;
    }

    getDocument(...args: unknown[]) {
      return mockCosmos.getDocument(...args);
    }

    getContainer(_name: string) {
      return {
        items: {
          query: () => ({
            fetchAll: async () => ({ resources: mockCosmos.orderIds }),
          }),
        },
      };
    }
  },
}));

vi.mock('../src/services/axiom.service.js', () => ({
  AxiomService: class AxiomService {},
}));

vi.mock('../src/services/final-report.service.js', () => ({
  FinalReportService: class FinalReportService {
    async addFieldOverride() {
      return { id: 'review-1' };
    }
  },
}));

import { createQCWorkflowRouter } from '../src/controllers/qc-workflow.controller.js';
import type { AuthorizationMiddleware } from '../src/middleware/authorization.middleware.js';

function makeQueueItem(id: string, orderId: string) {
  return {
    id,
    orderId,
    orderNumber: `ORD-${id}`,
    appraisalId: `APR-${id}`,
    priorityLevel: 'HIGH',
    priorityScore: 50,
    status: 'PENDING',
    submittedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    propertyAddress: '1 Main',
    appraisedValue: 500000,
    orderPriority: 'RUSH',
    clientId: 'client-1',
    clientName: 'Client',
    vendorId: 'vendor-1',
    vendorName: 'Vendor',
    slaTargetDate: new Date('2026-01-02T00:00:00.000Z'),
    slaBreached: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function makeRevision(id: string, orderId: string) {
  return {
    id,
    orderId,
    orderNumber: `ORD-${id}`,
    appraisalId: `APR-${id}`,
    qcReportId: 'qc-1',
    version: 1,
    revisionNumber: 'REV-1',
    severity: 'MAJOR',
    status: 'PENDING',
    issues: [],
    requestedBy: 'user-1',
    requestedByName: 'User One',
    assignedTo: 'vendor-1',
    assignedToName: 'Vendor One',
    requestedAt: new Date('2026-01-01T00:00:00.000Z'),
    dueDate: new Date('2026-01-02T00:00:00.000Z'),
    requestNotes: 'Needs changes',
    notificationsSent: [],
    remindersSent: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function makeAuthzStub(overrides?: {
  authorizeQuery?: () => any;
  authorizeResource?: () => any;
}) {
  return {
    loadUserProfile: () => async (req: any, _res: Response, next: NextFunction) => {
      req.userProfile = {
        id: req.user.id,
        email: req.user.email,
        role: 'manager',
        tenantId: req.user.tenantId,
      };
      next();
    },
    authorize: () => async (_req: any, _res: Response, next: NextFunction) => {
      next();
    },
    authorizeQuery:
      overrides?.authorizeQuery ??
      (() => async (req: any, _res: Response, next: NextFunction) => {
        req.authorizationFilter = {
          sql: 'c.id IN (@orderIds)',
          parameters: [{ name: '@tenantId', value: 'tenant-a' }],
        };
        next();
      }),
    authorizeResource:
      overrides?.authorizeResource ??
      (() => async (_req: any, _res: Response, next: NextFunction) => {
        next();
      }),
  } satisfies Partial<AuthorizationMiddleware>;
}

function makeApp(authz?: Partial<AuthorizationMiddleware>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'user@example.com',
    };
    next();
  });
  app.use('/api/qc-workflow', createQCWorkflowRouter(authz as AuthorizationMiddleware | undefined));
  return app;
}

describe('QC workflow authorization', () => {
  beforeEach(() => {
    mockQCQueueService.searchQueue.mockReset();
    mockQCQueueService.getCurrentQueueItemForOrder.mockReset();
    mockQCQueueService.assignReview.mockReset();
    mockRevisionService.getActiveRevisions.mockReset();
    mockEscalationService.createEscalation.mockReset();
    mockCosmos.getDocument.mockReset();
    mockCosmos.orderIds = [];
  });

  it('filters queue results to orders allowed by parent order query authorization', async () => {
    mockQCQueueService.searchQueue.mockResolvedValue([
      makeQueueItem('queue-1', 'order-1'),
      makeQueueItem('queue-2', 'order-2'),
    ]);
    mockCosmos.orderIds = ['order-1'];

    const app = makeApp(makeAuthzStub());
    const res = await request(app).get('/api/qc-workflow/queue');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].orderId).toBe('order-1');
  });

  it('blocks current queue item reads when parent order authorization denies access', async () => {
    const app = makeApp(makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    }));

    const res = await request(app).get('/api/qc-workflow/queue/order/order-1/current');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockQCQueueService.getCurrentQueueItemForOrder).not.toHaveBeenCalled();
  });

  it('blocks queue assignment when resolved parent order authorization denies access', async () => {
    mockCosmos.getDocument.mockResolvedValue({ id: 'queue-1', orderId: 'order-1' });

    const app = makeApp(makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    }));

    const res = await request(app)
      .post('/api/qc-workflow/queue/assign')
      .send({ queueItemId: 'queue-1', analystId: 'analyst-1' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockQCQueueService.assignReview).not.toHaveBeenCalled();
  });

  it('filters active revisions to orders allowed by parent order query authorization', async () => {
    mockRevisionService.getActiveRevisions.mockResolvedValue([
      makeRevision('rev-1', 'order-1'),
      makeRevision('rev-2', 'order-2'),
    ]);
    mockCosmos.orderIds = ['order-2'];

    const app = makeApp(makeAuthzStub());
    const res = await request(app).get('/api/qc-workflow/revisions/active');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].orderId).toBe('order-2');
  });

  it('blocks escalation creation when parent order authorization denies access', async () => {
    const app = makeApp(makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    }));

    const res = await request(app)
      .post('/api/qc-workflow/escalations')
      .send({
        orderId: 'order-1',
        escalationType: 'QC_DISPUTE',
        priority: 'HIGH',
        title: 'Need manager review',
        description: 'Escalate this case',
        raisedBy: 'user-1',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockEscalationService.createEscalation).not.toHaveBeenCalled();
  });
});
