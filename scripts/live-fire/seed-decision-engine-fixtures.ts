#!/usr/bin/env tsx
/**
 * Seed Decision Engine live-fire fixtures so the Phase J Playwright suite
 * can actually exercise the J10 (Override + Replay on trace timeline) and
 * J5/J6 (firing-rules analytics) rows.
 *
 * Idempotent — uses deterministic ids so reruns upsert in place.
 *
 * Writes (when --mode=seed):
 *   - 1 × assignment-traces doc for the target order so J10's order-detail
 *     page renders a TraceEntry, which is what hosts the Override + Replay
 *     buttons. Carries an evaluationsSnapshot so D.faithful replay path is
 *     exercised — replay surfaces "faithful" chip.
 *   - 2 × firing-decisions docs (one with fired rules, one no_action) so
 *     J5's analytics tab has real per-rule counts + outcome distribution
 *     to render (not just the "0 decisions" green path).
 *
 * Auth: DefaultAzureCredential against the staging Cosmos endpoint set in
 * the backend .env. Runs with the operator's own login session; no
 * service-principal secrets in scripts.
 *
 * Usage (sets up a real fixture against staging Cosmos):
 *   COSMOS_ENDPOINT=https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/ \
 *   COSMOS_DATABASE_NAME=appraisal-management \
 *   SEED_TENANT_ID=885097ba-35ea-48db-be7a-a0aa7ff451bd \
 *   SEED_ORDER_ID=SEED-VO-00105 \
 *   pnpm tsx scripts/live-fire/seed-decision-engine-fixtures.ts
 */

import { CosmosClient, type Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

interface SeedConfig {
	tenantId: string;
	orderId: string;
	endpoint: string;
	databaseName: string;
	mode: 'seed' | 'check-only';
}

function readRequired(name: string): string {
	const v = process.env[name];
	if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
	return v.trim();
}

function readOptional(name: string, fallback: string): string {
	const v = process.env[name];
	return v && v.trim() ? v.trim() : fallback;
}

function loadConfig(): SeedConfig {
	const modeRaw = readOptional('SEED_MODE', 'seed').toLowerCase();
	if (modeRaw !== 'seed' && modeRaw !== 'check-only') {
		throw new Error(`SEED_MODE must be 'seed' or 'check-only'. Received: ${modeRaw}`);
	}
	return {
		tenantId: readRequired('SEED_TENANT_ID'),
		orderId: readRequired('SEED_ORDER_ID'),
		endpoint: readRequired('COSMOS_ENDPOINT'),
		databaseName: readOptional('COSMOS_DATABASE_NAME', 'appraisal-management'),
		mode: modeRaw,
	};
}

async function ensureContainer(client: CosmosClient, dbName: string, name: string): Promise<Container> {
	const container = client.database(dbName).container(name);
	try {
		await container.read();
		return container;
	} catch {
		throw new Error(`Container '${name}' missing in '${dbName}'. This script never creates infrastructure.`);
	}
}

/** Synthetic id; same orderId+initiatedAt always collapses to the same doc. */
function traceId(orderId: string, initiatedAt: string): string {
	return `live-fire-trace__${orderId}__${initiatedAt.replace(/[:.]/g, '-')}`;
}

async function seedAssignmentTrace(container: Container, cfg: SeedConfig): Promise<string> {
	const initiatedAt = '2026-05-11T10:00:00.000Z';
	const id = traceId(cfg.orderId, initiatedAt);
	const doc = {
		id,
		type: 'assignment-trace',
		tenantId: cfg.tenantId,
		orderId: cfg.orderId,
		initiatedAt,
		rulesProviderName: 'homegrown',
		matchRequest: {
			propertyAddress: '123 Live-Fire Lane, Austin, TX 78701',
			propertyType: 'SFR',
			productId: 'seed-product-desktop-review-003',
			requiredCapabilities: ['DESKTOP_APPRAISAL'],
			dueDate: '2026-05-25T00:00:00.000Z',
			urgency: 'STANDARD',
		},
		rankedVendors: [
			{
				vendorId: 'vendor-fixture-001',
				vendorName: 'LiveFire Vendor 1',
				score: 87,
				staffType: 'external',
				explanation: {
					weightsVersion: 'v1',
					appliedRuleIds: ['Example_Score_Boost_Preferred_State'],
					components: [
						{ id: 'distance',    label: 'Distance',    rawValue: 12,  weight: 1, weighted: 12,  reason: '12 mi' },
						{ id: 'performance', label: 'Performance', rawValue: 92,  weight: 1, weighted: 92,  reason: '92% completion' },
					],
				},
			},
			{
				vendorId: 'vendor-fixture-002',
				vendorName: 'LiveFire Vendor 2',
				score: 72,
				staffType: 'external',
				explanation: {
					weightsVersion: 'v1',
					appliedRuleIds: [],
					components: [
						{ id: 'distance',    label: 'Distance',    rawValue: 34,  weight: 1, weighted: 34,  reason: '34 mi' },
						{ id: 'performance', label: 'Performance', rawValue: 80,  weight: 1, weighted: 80,  reason: '80% completion' },
					],
				},
			},
		],
		deniedVendors: [
			{
				vendorId: 'vendor-fixture-003',
				vendorName: 'LiveFire Vendor 3 (denied)',
				reasons: ['Missing required capability: DESKTOP_APPRAISAL'],
				appliedRuleIds: ['Example_Min_Performance_Score'],
			},
		],
		outcome: 'pending_bid',
		selectedVendorId: 'vendor-fixture-001',
		rankingLatencyMs: 142,
		// D.faithful — snapshot so the Replay button surfaces "faithful" chip.
		evaluationsSnapshot: [
			{
				vendor: { id: 'vendor-fixture-001', capabilities: ['DESKTOP_APPRAISAL'], states: ['TX'], performanceScore: 92 },
				order:  { productType: 'DESKTOP_APPRAISAL', propertyState: 'TX' },
				originallyRanked: true,
				originalScore: 87,
			},
			{
				vendor: { id: 'vendor-fixture-002', capabilities: ['DESKTOP_APPRAISAL'], states: ['TX'], performanceScore: 80 },
				order:  { productType: 'DESKTOP_APPRAISAL', propertyState: 'TX' },
				originallyRanked: true,
				originalScore: 72,
			},
			{
				vendor: { id: 'vendor-fixture-003', capabilities: ['BPO_INTERIOR'], states: ['TX'], performanceScore: 55 },
				order:  { productType: 'DESKTOP_APPRAISAL', propertyState: 'TX' },
				originallyRanked: false,
				originalScore: 0,
			},
		],
	};
	await container.items.upsert(doc);
	return id;
}

async function seedFiringDecisions(container: Container, cfg: SeedConfig): Promise<string[]> {
	const runDate = '2026-05-11';
	const evaluatedAt = '2026-05-11T08:00:00.000Z';
	const ids: string[] = [];

	const docs = [
		{
			id: `${cfg.tenantId}__vendor-fixture-001__${runDate}`,
			type: 'firing-decision',
			tenantId: cfg.tenantId,
			packId: 'default',
			packVersion: 1,
			vendorId: 'vendor-fixture-001',
			vendorName: 'LiveFire Vendor 1',
			evaluatedAt,
			runDate,
			metricsSnapshot: {
				vendor_id: 'vendor-fixture-001',
				vendor_performance_score: 92,
				vendor_completion_rate: 0.96,
				vendor_decline_rate: 0.02,
				vendor_revision_rate: 0.05,
				vendor_orders_last_30_days: 28,
				vendor_orders_last_90_days: 72,
				vendor_score_delta_30d: 3,
			},
			firedRuleIds: [],
			actionsFired: [],
			terminalActionFired: false,
			outcome: 'no_action',
		},
		{
			id: `${cfg.tenantId}__vendor-fixture-004__${runDate}`,
			type: 'firing-decision',
			tenantId: cfg.tenantId,
			packId: 'default',
			packVersion: 1,
			vendorId: 'vendor-fixture-004',
			vendorName: 'LiveFire Vendor 4 (probation)',
			evaluatedAt,
			runDate,
			metricsSnapshot: {
				vendor_id: 'vendor-fixture-004',
				vendor_performance_score: 41,
				vendor_completion_rate: 0.68,
				vendor_decline_rate: 0.22,
				vendor_revision_rate: 0.31,
				vendor_orders_last_30_days: 12,
				vendor_orders_last_90_days: 38,
				vendor_score_delta_30d: -8,
			},
			firedRuleIds: ['probation_when_completion_low'],
			actionsFired: [
				{ ruleId: 'probation_when_completion_low', type: 'set_status', data: { status: 'probation' }, terminal: false },
			],
			terminalActionFired: false,
			outcome: 'probation',
		},
	];

	for (const doc of docs) {
		await container.items.upsert(doc);
		ids.push(doc.id);
	}
	return ids;
}

async function main(): Promise<void> {
	const cfg = loadConfig();
	const client = new CosmosClient({
		endpoint: cfg.endpoint,
		aadCredentials: new DefaultAzureCredential(),
	});

	console.log('Mode:           ', cfg.mode);
	console.log('Tenant:         ', cfg.tenantId);
	console.log('Order id:       ', cfg.orderId);
	console.log('Cosmos endpoint:', cfg.endpoint);
	console.log('Database:       ', cfg.databaseName);
	console.log('');

	const tracesContainer  = await ensureContainer(client, cfg.databaseName, 'assignment-traces');
	const firingContainer  = await ensureContainer(client, cfg.databaseName, 'firing-decisions');

	if (cfg.mode === 'check-only') {
		const probeTraces = await tracesContainer.items
			.query({
				query: `SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @t AND c.orderId = @o`,
				parameters: [{ name: '@t', value: cfg.tenantId }, { name: '@o', value: cfg.orderId }],
			})
			.fetchAll();
		const probeFiring = await firingContainer.items
			.query({
				query: `SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = @t AND c.runDate >= '2026-05-04'`,
				parameters: [{ name: '@t', value: cfg.tenantId }],
			})
			.fetchAll();
		console.log(`Assignment traces for (${cfg.tenantId}, ${cfg.orderId}):`, probeTraces.resources[0] ?? 0);
		console.log(`Firing decisions in last 7d for tenant:                 `, probeFiring.resources[0] ?? 0);
		return;
	}

	const traceId = await seedAssignmentTrace(tracesContainer, cfg);
	const firingIds = await seedFiringDecisions(firingContainer, cfg);

	console.log('✅ Assignment trace upserted:', traceId);
	for (const id of firingIds) console.log('✅ Firing decision upserted:', id);
	console.log('\nNow run the live-fire suite with both gates set:');
	console.log(`  LIVE_UI_ORDER_ID=${cfg.orderId} LIVE_UI_FIRING_ENABLED=true \\`);
	console.log('    pnpm exec playwright test e2e/live-fire/decision-engine-suite.live-fire.spec.ts');
}

main().catch((err: unknown) => {
	console.error('\n❌ Seed failed:', err instanceof Error ? err.message : String(err));
	process.exit(1);
});
