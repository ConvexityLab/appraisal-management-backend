/**
 * AI Catalog bootstrap — Phase 10-full part 1 (2026-05-10).
 *
 * Seeds the in-memory `ai-catalog-registry` with the 25 baseline
 * AI-exposable endpoints that previously lived ONLY in the frontend
 * hand-curated TS catalog (src/components/ai/aiEndpointCatalog.ts).
 *
 * This file is imported once at api-server startup so the registry
 * is populated before the first `/api/ai/catalog` request lands.
 *
 * As Phase 10-full progresses, controllers will move their own
 * registrations INLINE next to their `router.METHOD()` calls — and
 * the corresponding entry will be removed from here.  Eventually this
 * file empties out and gets deleted.  Until then it's the source of
 * truth for the baseline AI-exposable surface.
 *
 * The frontend merger (Phase 10-full part 2) treats THIS BE catalog
 * as the new source of truth; the FE TS catalog (Phase 10-light) acts
 * as override entries for the high-value paths.
 */

import { registerAiRoute } from '../utils/ai-catalog-registry.js';

export function bootstrapAiCatalog(): void {
	// ── orders ─────────────────────────────────────────────────────────
	registerAiRoute({
		id: 'list-orders',
		method: 'GET',
		path: '/api/orders',
		summary: 'List orders for the current tenant, optionally filtered by status / vendor / client.',
		category: 'orders',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		queryParams: {
			status: { type: 'string', description: 'OrderStatus enum value (single)' },
			vendorId: { type: 'string' },
			clientId: { type: 'string' },
			page: { type: 'number' },
			pageSize: { type: 'number' },
		},
		uiPages: ['/orders'],
		keywords: ['orders', 'list', 'browse'],
	});
	registerAiRoute({
		id: 'get-order',
		method: 'GET',
		path: '/api/orders/:orderId',
		summary: 'Full detail of a single order by id, including borrower / loan / vendor / fee / status.',
		category: 'orders',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { orderId: { type: 'string', required: true, description: 'VendorOrder UUID' } },
		uiPages: ['/orders/:orderId'],
		keywords: ['order', 'detail', 'single'],
	});
	registerAiRoute({
		id: 'search-orders',
		method: 'POST',
		path: '/api/orders/search',
		summary: 'Free-text + filter search across orders. Supports status[], assignedVendorIds[], clientIds[], createdDateRange.',
		category: 'orders',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		body: {
			description: 'OrderSearchRequest: { textQuery?, status?: string[], assignedVendorIds?: string[], clientIds?: string[], createdDateRange?: {start, end} }',
		},
		keywords: ['search', 'find', 'filter', 'orders'],
	});
	registerAiRoute({
		id: 'get-order-timeline',
		method: 'GET',
		path: '/api/orders/:orderId/timeline',
		summary: 'Chronological event log for an order: status changes, assignments, deliveries, audit entries.',
		category: 'orders',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { orderId: { type: 'string', required: true } },
		keywords: ['timeline', 'history', 'events'],
	});
	registerAiRoute({
		id: 'order-dashboard-metrics',
		method: 'GET',
		path: '/api/orders/dashboard',
		summary: 'Aggregate metrics for the orders dashboard: counts by status, SLA breakdown, fee totals.',
		category: 'orders',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		uiPages: ['/dashboards/monitoring', '/orders'],
		keywords: ['dashboard', 'metrics', 'kpi', 'summary'],
	});
	registerAiRoute({
		id: 'orders-needs-attention',
		method: 'GET',
		path: '/api/orders/needs-attention',
		summary: 'Orders flagged for human attention (stuck, SLA-at-risk, recently failed). For triage workflows.',
		category: 'orders',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		keywords: ['stuck', 'sla', 'attention', 'triage'],
	});

	// ── engagements ────────────────────────────────────────────────────
	registerAiRoute({
		id: 'list-engagements',
		method: 'GET',
		path: '/api/engagements',
		summary: 'Paginated list of engagements with optional status[] / clientId / propertyState / searchText filters.',
		category: 'engagements',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		queryParams: {
			status: {
				type: 'array',
				description: 'EngagementStatus[] — RECEIVED, ACCEPTED, IN_PROGRESS, QC, REVISION, DELIVERED, CANCELLED, ON_HOLD',
				itemType: 'string',
			},
			clientId: { type: 'string' },
			propertyState: { type: 'string', description: '2-letter state code' },
			searchText: { type: 'string' },
			pageSize: { type: 'number' },
		},
		uiPages: ['/engagements'],
		keywords: ['engagements', 'list'],
	});
	registerAiRoute({
		id: 'get-engagement',
		method: 'GET',
		path: '/api/engagements/:id',
		summary: 'Full engagement detail by id, including loans, client orders, and vendor orders.',
		category: 'engagements',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { id: { type: 'string', required: true } },
		uiPages: ['/engagements/:id'],
		keywords: ['engagement', 'detail'],
	});
	registerAiRoute({
		id: 'engagement-vendor-orders',
		method: 'GET',
		path: '/api/engagements/:id/vendor-orders',
		summary: 'The VendorOrder children for one engagement (post-Phase-B canonical path; preferred over the deprecated embedded vendorOrderIds[]).',
		category: 'engagements',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { id: { type: 'string', required: true } },
		keywords: ['vendor orders', 'engagement', 'children'],
	});
	registerAiRoute({
		id: 'engagement-audit',
		method: 'GET',
		path: '/api/engagements/:id/audit',
		summary: 'Paginated audit log for one engagement, filterable by category / severity / eventType.',
		category: 'engagements',
		scopes: ['audit:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { id: { type: 'string', required: true } },
		queryParams: {
			category: { type: 'string' },
			severity: { type: 'string' },
			eventType: { type: 'string' },
			search: { type: 'string' },
		},
		keywords: ['audit', 'history', 'events'],
	});
	registerAiRoute({
		id: 'engagement-timeline',
		method: 'GET',
		path: '/api/engagements/:id/timeline',
		summary: 'Computed lifecycle timeline for one engagement — phase transitions, key events.',
		category: 'engagements',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { id: { type: 'string', required: true } },
		keywords: ['timeline', 'lifecycle', 'phases'],
	});

	// ── vendors ────────────────────────────────────────────────────────
	registerAiRoute({
		id: 'list-vendors',
		method: 'GET',
		path: '/api/vendors',
		summary: 'List vendors with filters: q (text), state, status[], minPerformanceScore.',
		category: 'vendors',
		scopes: ['vendor:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		queryParams: {
			q: { type: 'string', description: 'Free-text search (Cosmos CONTAINS)' },
			state: { type: 'string' },
			status: { type: 'array', itemType: 'string' },
			minPerformanceScore: { type: 'number' },
			limit: { type: 'number' },
		},
		uiPages: ['/vendors'],
		keywords: ['vendors', 'appraisers'],
	});
	registerAiRoute({
		id: 'get-vendor',
		method: 'GET',
		path: '/api/vendors/:vendorId',
		summary: 'Full vendor profile by id: capabilities, licenses, performance, contact, current workload.',
		category: 'vendors',
		scopes: ['vendor:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { vendorId: { type: 'string', required: true } },
		uiPages: ['/vendors/:vendorId'],
		keywords: ['vendor', 'detail', 'profile'],
	});
	registerAiRoute({
		id: 'vendor-performance',
		method: 'GET',
		path: '/api/vendor-performance/:vendorId',
		summary: 'Workload + performance metrics for one vendor: active orders, on-time rate, average QC score.',
		category: 'vendors',
		scopes: ['vendor:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { vendorId: { type: 'string', required: true } },
		keywords: ['performance', 'workload', 'capacity'],
	});

	// ── clients ────────────────────────────────────────────────────────
	registerAiRoute({
		id: 'list-clients',
		method: 'GET',
		path: '/api/clients',
		summary: 'List clients of the current tenant (lenders / AMCs / brokers).',
		category: 'clients',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		uiPages: ['/clients'],
		keywords: ['clients', 'lenders', 'amcs', 'brokers'],
	});
	registerAiRoute({
		id: 'get-client',
		method: 'GET',
		path: '/api/clients/:clientId',
		summary: 'Full client profile by id: configuration, contacts, products, fees.',
		category: 'clients',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { clientId: { type: 'string', required: true } },
		keywords: ['client', 'detail'],
	});

	// ── documents ──────────────────────────────────────────────────────
	registerAiRoute({
		id: 'list-documents',
		method: 'GET',
		path: '/api/documents',
		summary: 'Documents linked to an order or other entity, filterable by category / search text.',
		category: 'documents',
		scopes: ['document:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		queryParams: {
			orderId: { type: 'string' },
			entityType: { type: 'string' },
			entityId: { type: 'string' },
			documentType: { type: 'string' },
			search: { type: 'string' },
			limit: { type: 'number' },
		},
		keywords: ['documents', 'files'],
	});

	// ── properties ─────────────────────────────────────────────────────
	registerAiRoute({
		id: 'get-property-record',
		method: 'GET',
		path: '/api/v1/property-records/:propertyId',
		summary: 'Canonical property record by id — address, characteristics, latest valuation, linked orders.',
		category: 'properties',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { propertyId: { type: 'string', required: true } },
		uiPages: ['/properties/:propertyId'],
		keywords: ['property', 'record', 'address'],
	});

	// ── qc ─────────────────────────────────────────────────────────────
	registerAiRoute({
		id: 'qc-queue-statistics',
		method: 'GET',
		path: '/api/qc-workflow/queue/statistics',
		summary: 'Counts + SLA metrics for the QC queue — items pending, in review, overdue, by analyst.',
		category: 'qc',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		uiPages: ['/qc'],
		keywords: ['qc', 'queue', 'statistics', 'workload'],
	});

	// ── review programs / criteria ─────────────────────────────────────
	registerAiRoute({
		id: 'list-review-programs',
		method: 'GET',
		path: '/api/review-programs',
		summary: 'Versioned review programs available to the current tenant. Each program defines criteria + their data requirements.',
		category: 'review-programs',
		scopes: ['document:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		keywords: ['review program', 'criteria', 'program', 'versions'],
	});
	registerAiRoute({
		id: 'get-review-program',
		method: 'GET',
		path: '/api/review-programs/:programId',
		summary: 'Full review program definition by id + version, including criteria tree.',
		category: 'review-programs',
		scopes: ['document:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { programId: { type: 'string', required: true } },
		queryParams: { version: { type: 'string' } },
		keywords: ['review program', 'criteria tree'],
	});

	// ── axiom ──────────────────────────────────────────────────────────
	registerAiRoute({
		id: 'axiom-scope-results',
		method: 'GET',
		path: '/api/axiom/scopes/:scopeId/results',
		summary: 'Latest verdicts for a review scope under a given program version. Pass/fail/needs_review per criterion.',
		category: 'axiom',
		scopes: ['document:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { scopeId: { type: 'string', required: true } },
		queryParams: { programId: { type: 'string', description: 'Specific program; omit for latest run' } },
		keywords: ['axiom', 'criteria', 'results', 'verdicts'],
	});
	registerAiRoute({
		id: 'axiom-criterion-history',
		method: 'GET',
		path: '/api/axiom/scopes/:scopeId/criteria/:criterionId/history',
		summary: 'Run-by-run history for one criterion within a scope. Use to answer "why did this flip pass→fail?"',
		category: 'axiom',
		scopes: ['document:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: {
			scopeId: { type: 'string', required: true },
			criterionId: { type: 'string', required: true },
		},
		keywords: ['axiom', 'criterion', 'history', 'flip', 'change'],
	});
	registerAiRoute({
		id: 'axiom-complexity-score',
		method: 'GET',
		path: '/api/axiom/scoring/complexity/:orderId',
		summary: 'Computed complexity / risk score for one order based on Axiom enrichment.',
		category: 'axiom',
		scopes: ['document:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { orderId: { type: 'string', required: true } },
		keywords: ['axiom', 'complexity', 'risk', 'score'],
	});
	registerAiRoute({
		id: 'axiom-property-enrichment',
		method: 'GET',
		path: '/api/axiom/property/enrichment/:orderId',
		summary: 'Read the latest Axiom property-enrichment payload for an order (cached comps, AVMs, market data).',
		category: 'axiom',
		scopes: ['document:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { orderId: { type: 'string', required: true } },
		keywords: ['axiom', 'property', 'enrichment', 'comps', 'avm', 'market'],
	});
	registerAiRoute({
		id: 'axiom-get-comparison',
		method: 'GET',
		path: '/api/axiom/comparisons/:comparisonId',
		summary: 'Fetch a document-comparison job by id (results of axiomCompareDocuments).',
		category: 'axiom',
		scopes: ['document:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { comparisonId: { type: 'string', required: true } },
		keywords: ['axiom', 'comparison', 'diff', 'revisions'],
	});
	registerAiRoute({
		id: 'axiom-scope-run',
		method: 'GET',
		path: '/api/axiom/scopes/:scopeId/runs/:runId',
		summary: 'Poll one scope-evaluation run (status, stage progress, pipelineExecutionLog).',
		category: 'axiom',
		scopes: ['document:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: {
			scopeId: { type: 'string', required: true },
			runId: { type: 'string', required: true },
		},
		keywords: ['axiom', 'scope', 'run', 'progress', 'stage'],
	});
	registerAiRoute({
		id: 'axiom-bulk-submission-metrics',
		method: 'GET',
		path: '/api/axiom/bulk-submission/metrics',
		summary: 'Operational metrics for Axiom bulk-submission processing — throughput, success / failure counts.',
		category: 'axiom',
		scopes: ['audit:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'admin',
		keywords: ['axiom', 'bulk', 'submission', 'metrics', 'ops'],
	});
	registerAiRoute({
		id: 'axiom-bulk-submission-dlq',
		method: 'GET',
		path: '/api/axiom/bulk-submission/dlq',
		summary: 'Dead-letter queue inspection for Axiom bulk submissions. Returns failed events with their last error.',
		category: 'axiom',
		scopes: ['audit:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'admin',
		keywords: ['axiom', 'dlq', 'failed', 'errors', 'bulk', 'ops'],
	});
	registerAiRoute({
		id: 'axiom-status',
		method: 'GET',
		path: '/api/axiom/status',
		summary: 'Axiom service health + live/mocked mode indicator. Use to verify Axiom is reachable before kicking off long runs.',
		category: 'axiom',
		scopes: [],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		keywords: ['axiom', 'status', 'health', 'live', 'mock'],
	});

	// ── decision engine / auto-assignment ──────────────────────────────
	registerAiRoute({
		id: 'list-decision-rules',
		method: 'GET',
		path: '/api/decision-engine/rules/:category',
		summary: 'Per-tenant rule packs for a given Decision Engine category (vendor-matching, criteria, etc.).',
		category: 'decision-engine',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { category: { type: 'string', required: true, description: 'Decision Engine category slug' } },
		keywords: ['rules', 'decision engine', 'rule pack', 'matching'],
	});
	registerAiRoute({
		id: 'list-auto-assignment-suggestions',
		method: 'GET',
		path: '/api/auto-assignment/suggestions',
		summary: 'Auto-assignment orchestrator suggestions for the orders queue.',
		category: 'auto-assignment',
		scopes: ['order:read', 'vendor:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		keywords: ['auto-assignment', 'suggestions', 'matching'],
	});

	// ── mop / vendor-matching ─────────────────────────────────────────
	// Phase 13 of AI-UNIVERSAL-SURFACE-PLAN.md (2026-05-10).  MOP is our
	// first-party rules engine (RETE / Prio) fronted by AMS endpoints.
	// The find-matches endpoint routes through `mopProvider.evaluateForVendors`
	// internally — so this single AI tool unlocks the "why did vendor X
	// not get this order?" use case: call find-matches, filter the result
	// to vendor X, read X's denyReasons[].

	registerAiRoute({
		id: 'find-vendor-matches',
		method: 'POST',
		path: '/api/auto-assignment/find-matches',
		summary: 'Run MOP vendor-matching evaluation for an order. Returns ranked vendor matches with applied rule ids + denyReasons. Use this to answer "which vendors match for order X" and "why didn\'t vendor X get this order?" (filter the result to that vendor and read its denyReasons[]).',
		category: 'mop',
		scopes: ['order:read', 'vendor:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		body: {
			description:
				'VendorMatchRequest body: { orderId?, propertyAddress (required), propertyType (required), dueDate?, urgency?: "STANDARD"|"RUSH"|"SUPER_RUSH", budget?: number, topN?: number, productId?: string, requiredCapabilities?: string[] }',
		},
		keywords: ['mop', 'vendor', 'matching', 'find', 'evaluate', 'rules', 'denyReasons', 'why'],
	});

	registerAiRoute({
		id: 'mop-vendor-match-trigger-vendor',
		method: 'POST',
		path: '/api/auto-assignment/orders/:orderId/trigger-vendor',
		summary: 'Trigger MOP vendor-matching for one specific order. Returns the matching result, including which vendors were eligible / denied (with denyReasons[]) under the current rule pack.',
		category: 'mop',
		scopes: ['order:read', 'vendor:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		pathParams: { orderId: { type: 'string', required: true } },
		keywords: ['mop', 'vendor', 'matching', 'trigger', 'order'],
	});

	registerAiRoute({
		id: 'mop-vendor-match-suggestions',
		method: 'GET',
		path: '/api/auto-assignment/suggest',
		summary: 'GET version of the MOP vendor suggestions endpoint. Returns top-N matches per orderId in the queue.',
		category: 'mop',
		scopes: ['order:read', 'vendor:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		queryParams: {
			orderId: { type: 'string', description: 'Restrict to one order' },
			topN: { type: 'number' },
		},
		keywords: ['mop', 'suggest', 'recommendations', 'matching'],
	});

	// ── ai cost snapshot (Phase 17b token-meter, 2026-05-11) ─────────────
	registerAiRoute({
		id: 'ai-cost-snapshot',
		method: 'GET',
		path: '/api/ai/cost/snapshot',
		summary: 'Per-tenant LLM spend snapshot — currentSpendUsd, totalTokens, periodDays, hardLimitUsd, warnThresholdUsd, exhausted flag. The FE banner + cost guard read this; the AI can read it too to answer "how much of my AI budget have I used this month?"',
		category: 'ops',
		scopes: [],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
		queryParams: {
			periodDays: { type: 'number', description: 'Rolling window (default 30, max 365)' },
		},
		keywords: ['cost', 'budget', 'spend', 'tokens', 'usage', 'llm'],
	});
}
