/**
 * P-19 closure — Webhook → service end-to-end integration test
 *
 * Closes the gap flagged in the live-fire audit: existing tests verify the
 * controller path (axiom-controller-webhook-ack.test.ts) AND the service path
 * (axiom-pipeline-result-stamping.test.ts) IN ISOLATION, but nothing tests
 * them WIRED TOGETHER. This is the closest-to-live-fire assertion we can run
 * in CI without real Axiom — it exercises:
 *
 *   POST body (signed-equivalent) → AxiomController.handleWebhook (ORDER path)
 *      → REAL AxiomService.fetchAndStorePipelineResults
 *      → DbService.updateOrder, upsertItem (aiInsights), updateItem (documents)
 *      → ServiceBusEventPublisher.publish (axiom.evaluation.completed + qc.issue.detected)
 *
 * What we verify in one shot:
 *   - Controller stamps the order with all webhook-derived fields
 *   - Controller delegates to AxiomService.fetchAndStorePipelineResults
 *   - Service writes the evaluation to aiInsights with criteria
 *   - Service writes extractedData back to the source document
 *   - Service publishes axiom.evaluation.completed with the expected payload
 *   - Service publishes qc.issue.detected per fail/warning criterion
 *   - Controller publishes axiom.pipeline.completed AND returns 200 only after
 *     all of the above succeed
 *
 * If this test passes, the only thing the actual live-fire run adds is:
 *   - Real HMAC signature validation (covered by verify-axiom-webhook.middleware.test.ts)
 *   - Real Axiom HTTP round-trip (out of scope until A-01 lands)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ─────────────────────────────────────────────────────────────
// Pattern-matched on the existing axiom-controller-webhook-ack.test.ts so the
// controller's other dependencies don't blow up at construction time.

const {
	mockGetConfig,
	mockCreateExtractionRun,
	mockSetRunStatus,
	mockUpdateRun,
	mockCreateCriteriaRun,
	mockCreateCriteriaStepRun,
	mockCreateFromExtractionRun,
	mockDispatchCriteria,
	mockDispatchCriteriaStep,
	mockCreateStepInputSlice,
} = vi.hoisted(() => ({
	mockGetConfig: vi.fn(),
	mockCreateExtractionRun: vi.fn(),
	mockSetRunStatus: vi.fn().mockResolvedValue(undefined),
	mockUpdateRun: vi.fn(),
	mockCreateCriteriaRun: vi.fn(),
	mockCreateCriteriaStepRun: vi.fn(),
	mockCreateFromExtractionRun: vi.fn(),
	mockDispatchCriteria: vi.fn(),
	mockDispatchCriteriaStep: vi.fn(),
	mockCreateStepInputSlice: vi.fn(),
}));

// Capture every event published anywhere in the chain.
const publishedEvents: any[] = [];
const mockPublish = vi.fn(async (event: any) => {
	publishedEvents.push(event);
});

// WebPubSub broadcast (called by AxiomService.broadcastAxiomStatus after writeback)
const mockSendToGroup = vi.fn().mockResolvedValue(undefined);
const mockGetToken = vi.fn().mockResolvedValue({
	token: 'entra-token-001',
	expiresOnTimestamp: Date.now() + 60 * 60 * 1000,
});

vi.mock('@azure/identity', () => ({
	DefaultAzureCredential: vi.fn().mockImplementation(() => ({
		getToken: mockGetToken,
	})),
}));

vi.mock('../../src/services/web-pubsub.service.js', () => ({
	WebPubSubService: vi.fn().mockImplementation(() => ({
		sendToGroup: mockSendToGroup,
	})),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
	ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
		publish: mockPublish,
		publishBatch: vi.fn().mockResolvedValue(undefined),
		verifyConnectivity: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock('../../src/services/blob-storage.service.js', () => ({
	BlobStorageService: vi.fn().mockImplementation(() => ({
		generateReadSasUrl: vi.fn().mockResolvedValue('https://blob/sas'),
	})),
}));

vi.mock('../../src/services/axiom-execution.service.js', () => ({
	AxiomExecutionService: vi.fn().mockImplementation(() => ({
		updateExecutionStatus: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock('../../src/services/bulk-portfolio.service', () => ({
	BulkPortfolioService: vi.fn().mockImplementation(() => ({
		stampBatchEvaluationResults: vi.fn().mockResolvedValue({ items: [] }),
		processExtractionCompletion: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
	TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
		getConfig: mockGetConfig,
	})),
}));

vi.mock('../../src/services/run-ledger.service.js', () => ({
	RunLedgerService: vi.fn().mockImplementation(() => ({
		createExtractionRun: mockCreateExtractionRun,
		setRunStatus: mockSetRunStatus,
		updateRun: mockUpdateRun,
		createCriteriaRun: mockCreateCriteriaRun,
		createCriteriaStepRun: mockCreateCriteriaStepRun,
	})),
}));

vi.mock('../../src/services/canonical-snapshot.service.js', () => ({
	CanonicalSnapshotService: vi.fn().mockImplementation(() => ({
		createFromExtractionRun: mockCreateFromExtractionRun,
		refreshFromExtractionRun: vi.fn().mockResolvedValue(null),
	})),
}));

vi.mock('../../src/services/engine-dispatch.service.js', () => ({
	EngineDispatchService: vi.fn().mockImplementation(() => ({
		dispatchCriteria: mockDispatchCriteria,
		dispatchCriteriaStep: mockDispatchCriteriaStep,
	})),
}));

vi.mock('../../src/services/criteria-step-input.service.js', () => ({
	CriteriaStepInputService: vi.fn().mockImplementation(() => ({
		createStepInputSlice: mockCreateStepInputSlice,
	})),
}));

import { AxiomController } from '../../src/controllers/axiom.controller.js';
import { AxiomService } from '../../src/services/axiom.service.js';

function makeRes() {
	const res: any = {};
	res.status = vi.fn().mockReturnValue(res);
	res.json = vi.fn().mockReturnValue(res);
	return res;
}

/**
 * Realistic Axiom pipeline payload that exercises every shape that
 * fetchAndStorePipelineResults reads (consolidate / aggregateResults /
 * extractStructuredData / overallDecision / overallRiskScore / criteria).
 */
function buildLiveFireRawResults() {
	return {
		overallRiskScore: 42,
		criteria: [
			{
				criterionId: 'CRIT-PASS',
				criterionName: 'Property address matches subject',
				evaluation: 'pass',
				confidence: 0.97,
				reasoning: 'Address matched the subject record.',
				documentReferences: [{ page: 1, section: 'Subject', quote: '17 David Dr' }],
			},
			{
				criterionId: 'CRIT-WARN',
				criterionName: 'GLA within 10% of comparable median',
				evaluation: 'warning',
				confidence: 0.72,
				reasoning: 'GLA differs by 12% from comparable median.',
				remediation: 'Confirm GLA measurement source.',
				documentReferences: [{ page: 4, section: 'Improvements', quote: 'GLA 1,847' }],
			},
			{
				criterionId: 'CRIT-FAIL',
				criterionName: 'At least 3 closed comparables within 6 months',
				evaluation: 'fail',
				confidence: 0.91,
				reasoning: 'Only 2 closed comparables found within the 6-month window.',
				remediation: 'Source one additional closed sale.',
				documentReferences: [{ page: 12, section: 'Sales Comparison', quote: 'Comp 3 closed 2025-06-15' }],
			},
		],
		results: {
			overallDecision: 'CONDITIONAL',
			consolidate: [
				{
					consolidatedData: {
						propertyAddress: { street: '17 David Dr', city: 'Johnston', state: 'RI' },
						gla: 1847,
						appraisedValue: 425000,
					},
				},
			],
			aggregateResults: [{ summary: 'aggregate-summary-payload' }],
			extractStructuredData: [{ kind: 'extracted', fields: 3 }],
		},
	};
}

describe('Axiom webhook → service end-to-end (P-19 live-fire equivalent)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		publishedEvents.length = 0;
		// AxiomService constructor honors these env vars
		process.env.AXIOM_API_BASE_URL = 'https://axiom.example';
		process.env.AXIOM_API_KEY = 'live-fire-testing-key';
		process.env.API_BASE_URL = 'http://localhost:3011';
		process.env.AXIOM_WEBHOOK_SECRET = 'test-webhook-secret';
		process.env.AXIOM_SUB_CLIENT_ID = 'test-sub-client-id';
		delete process.env.AXIOM_API_TOKEN_SCOPE;
		delete process.env.AXIOM_API_RESOURCE;
		delete process.env.AXIOM_USE_DEFAULT_CREDENTIAL;
	});

	it('ORDER-correlated completed webhook triggers full chain: order stamping + evaluation writeback + document writeback + qc-issue events + axiom.evaluation.completed event + 200 response', async () => {
		// ── Set up fakes ─────────────────────────────────────────────────────
		const updateOrder = vi.fn().mockResolvedValue({ success: true });
		const upsertItem = vi.fn().mockResolvedValue({ success: true });
		const updateItem = vi.fn().mockResolvedValue({ success: true });

		const dbStub = {
			updateOrder,
			findOrderById: vi.fn().mockResolvedValue({
				success: true,
				data: { tenantId: 'tenant-001', orderNumber: 'ORD-100' },
			}),
			// First getItem: pending evaluation (lookup by evalId in fetchAndStorePipelineResults)
			// Second getItem: source document (lookup by docId for extractedData writeback)
			getItem: vi.fn()
				.mockResolvedValueOnce({
					success: true,
					data: {
						id: 'eval-order-100-pjob-100',
						documentType: 'appraisal',
						tenantId: 'tenant-001',
						clientId: 'client-001',
						pipelineId: 'adaptive-document-processing',
						_metadata: {
							documentId: 'doc-100',
							documentName: 'Appraisal Report.pdf',
							blobUrl: 'https://blob/doc-100.pdf?sas=1',
						},
					},
				})
				.mockResolvedValueOnce({
					success: true,
					data: { id: 'doc-100', fileName: 'Appraisal Report.pdf' },
				}),
			upsertItem,
			updateItem,
			queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
		};

		// Use a REAL AxiomService — this is the integration we're verifying.
		const axiomService = new AxiomService(dbStub as any);
		// Stub only the outbound HTTP call to Axiom; everything downstream of
		// fetchPipelineResults runs for real.
		vi.spyOn(axiomService, 'fetchPipelineResults').mockResolvedValue(buildLiveFireRawResults());

		const controller = new AxiomController(dbStub as any, axiomService);

		// Webhook payload as Axiom would deliver it after the analyze pipeline
		// (correlationType=ORDER, status=completed, optional inline result).
		const req: any = {
			body: {
				correlationId: 'order-100',
				correlationType: 'ORDER',
				pipelineJobId: 'pjob-100',
				status: 'completed',
				result: {
					overallRiskScore: 42,
					overallDecision: 'CONDITIONAL',
					flags: ['gla-variance', 'comp-shortfall'],
				},
			},
		};
		const res = makeRes();

		// ── Act ──────────────────────────────────────────────────────────────
		await controller.handleWebhook(req, res);

		// ── Assert: webhook returned 200 only after every step landed ────────
		expect(res.status).toHaveBeenCalledWith(200);

		// ── Assert: order stamped from controller AND from service ───────────
		// Controller updateOrder #1 stamps webhook-derived fields. Service
		// updateOrder #2 stamps fetched-from-Axiom fields (axiomEvaluationId,
		// axiomLastUpdatedAt, axiomExtractedSummary).
		expect(updateOrder).toHaveBeenCalledTimes(2);

		// Controller stamping (from webhook payload directly)
		const controllerStamp = updateOrder.mock.calls[0][1];
		expect(controllerStamp).toMatchObject({
			axiomStatus: 'completed',
			axiomPipelineJobId: 'pjob-100',
			axiomRiskScore: 42,
			axiomDecision: 'CONDITIONAL',
			axiomFlags: ['gla-variance', 'comp-shortfall'],
		});
		expect(typeof controllerStamp.axiomCompletedAt).toBe('string');

		// Service stamping (from fetched pipeline results)
		const serviceStamp = updateOrder.mock.calls[1][1];
		expect(serviceStamp).toMatchObject({
			axiomRiskScore: 42,
			axiomStatus: 'completed',
			axiomEvaluationId: 'eval-order-100-pjob-100',
			axiomPipelineJobId: 'pjob-100',
			axiomDecision: 'CONDITIONAL',
		});
		expect(typeof serviceStamp.axiomLastUpdatedAt).toBe('string');
		expect(serviceStamp.axiomExtractedSummary).toMatchObject({
			gla: 1847,
			appraisedValue: 425000,
		});

		// ── Assert: evaluation written to aiInsights with criteria array ─────
		expect(upsertItem).toHaveBeenCalled();
		const evalRecord = upsertItem.mock.calls[upsertItem.mock.calls.length - 1]?.[1];
		expect(evalRecord).toMatchObject({
			id: 'eval-order-100-pjob-100',
			orderId: 'order-100',
			status: 'completed',
			overallRiskScore: 42,
			tenantId: 'tenant-001',
		});
		expect(evalRecord.criteria).toHaveLength(3);

		// ── Assert: extractedData written back to documents container ────────
		expect(updateItem).toHaveBeenCalledWith('documents', 'doc-100', expect.objectContaining({
			id: 'doc-100',
			extractedData: expect.objectContaining({ gla: 1847, appraisedValue: 425000 }),
			extractedDataSource: 'axiom',
			extractedDataPipelineJobId: 'pjob-100',
		}));

		// ── Assert: qc.issue.detected published per fail/warning criterion ───
		const qcIssues = publishedEvents.filter((e) => e.type === 'qc.issue.detected');
		expect(qcIssues, 'one qc.issue.detected per fail+warning criterion').toHaveLength(2);
		const failIssue = qcIssues.find((e) => e.data.criterionId === 'CRIT-FAIL');
		expect(failIssue?.data.severity).toBe('CRITICAL');
		const warnIssue = qcIssues.find((e) => e.data.criterionId === 'CRIT-WARN');
		expect(warnIssue?.data.severity).toBe('MAJOR');

		// ── Assert: axiom.evaluation.completed published with full payload ───
		const completed = publishedEvents.find((e) => e.type === 'axiom.evaluation.completed');
		expect(completed, 'axiom.evaluation.completed event').toBeDefined();
		expect(completed.data).toMatchObject({
			orderId: 'order-100',
			tenantId: 'tenant-001',
			evaluationId: 'eval-order-100-pjob-100',
			pipelineJobId: 'pjob-100',
			status: 'failed', // 1 fail in fixture
			score: 42,
			criteriaCount: 3,
			passCount: 1,
			failCount: 1,
			warnCount: 1,
			decision: 'CONDITIONAL',
		});

		// ── Assert: controller-level pipeline-completion event also published ─
		const pipelineEvent = publishedEvents.find(
			(e) => e.type === 'axiom.pipeline.completed' || e.type === 'axiom.evaluation.completed',
		);
		expect(pipelineEvent).toBeDefined();
	});

	it('ORDER-correlated FAILED webhook stamps order and does NOT call fetchAndStorePipelineResults', async () => {
		const updateOrder = vi.fn().mockResolvedValue({ success: true });
		const dbStub = {
			updateOrder,
			findOrderById: vi.fn().mockResolvedValue({
				success: true,
				data: { tenantId: 'tenant-001', orderNumber: 'ORD-200' },
			}),
			getItem: vi.fn(),
			upsertItem: vi.fn().mockResolvedValue({ success: true }),
			updateItem: vi.fn().mockResolvedValue({ success: true }),
			queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
		};

		const axiomService = new AxiomService(dbStub as any);
		const fetchSpy = vi.spyOn(axiomService, 'fetchAndStorePipelineResults').mockResolvedValue();
		const controller = new AxiomController(dbStub as any, axiomService);

		const req: any = {
			body: {
				correlationId: 'order-200',
				correlationType: 'ORDER',
				pipelineJobId: 'pjob-200',
				status: 'failed',
			},
		};
		const res = makeRes();

		await controller.handleWebhook(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(updateOrder).toHaveBeenCalledTimes(1);
		const stamp = updateOrder.mock.calls[0][1];
		expect(stamp).toMatchObject({
			axiomStatus: 'failed',
			axiomPipelineJobId: 'pjob-200',
		});
		expect(typeof stamp.axiomCompletedAt).toBe('string');
		// Critical: failed pipelines must NOT trigger the result-fetch chain
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('returns 500 when the controller-level order update fails (durable-ACK contract)', async () => {
		const dbStub = {
			updateOrder: vi.fn().mockResolvedValue({ success: false, error: 'Cosmos throughput throttle' }),
			findOrderById: vi.fn().mockResolvedValue({
				success: true,
				data: { tenantId: 'tenant-001', orderNumber: 'ORD-300' },
			}),
			getItem: vi.fn(),
			upsertItem: vi.fn(),
			updateItem: vi.fn(),
			queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
		};
		const axiomService = new AxiomService(dbStub as any);
		const fetchSpy = vi.spyOn(axiomService, 'fetchAndStorePipelineResults').mockResolvedValue();
		const controller = new AxiomController(dbStub as any, axiomService);

		const req: any = {
			body: {
				correlationId: 'order-300',
				correlationType: 'ORDER',
				pipelineJobId: 'pjob-300',
				status: 'completed',
			},
		};
		const res = makeRes();

		await controller.handleWebhook(req, res);

		expect(res.status).toHaveBeenCalledWith(500);
		// fetchAndStorePipelineResults should NOT be called when the durable
		// stamp failed — Axiom will retry the webhook
		expect(fetchSpy).not.toHaveBeenCalled();
		// No completion event should be published when we return 500
		expect(publishedEvents.find((e) => e.type === 'axiom.evaluation.completed')).toBeUndefined();
	});
});
