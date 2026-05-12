#!/usr/bin/env node
/**
 * One-shot autopilot-task publisher for live-fire testing.
 *
 * Sends a single message to the staging Service Bus `autopilot-tasks`
 * queue.  The deployed `AiAutopilotConsumer` picks it up, the
 * orchestrator parks the run as `awaiting-approval` (because the
 * recipe used in live-fire has policy.mode='approve'), and then
 * test 5 in ai-autopilot.live-fire.spec.ts has data to validate.
 *
 * Uses DefaultAzureCredential → AzureCliCredential when run from a
 * shell where `az login` has been completed.
 *
 * Usage:
 *   node scripts/live-fire/publish-autopilot-task.mjs <recipeId> [tenantId]
 *
 * Required env:
 *   AZURE_SERVICE_BUS_NAMESPACE  — staging SB namespace fqdn
 *                                  (e.g. appraisal-mgmt-sta-sb.servicebus.windows.net)
 */

import { ServiceBusClient } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { randomUUID } from 'node:crypto';

const recipeId = process.argv[2];
const tenantId = process.argv[3] ?? '885097ba-35ea-48db-be7a-a0aa7ff451bd';

if (!recipeId) {
	console.error('Usage: node publish-autopilot-task.mjs <recipeId> [tenantId]');
	process.exit(1);
}

const ns = process.env.AZURE_SERVICE_BUS_NAMESPACE;
if (!ns) {
	console.error('AZURE_SERVICE_BUS_NAMESPACE required (e.g. appraisal-mgmt-sta-sb.servicebus.windows.net).');
	process.exit(1);
}

const idempotencyKey = `${recipeId}::live-fire::${randomUUID()}`;
const task = {
	tenantId,
	recipeId,
	idempotencyKey,
	triggeredBy: {
		kind: 'queue-message',
		sourceId: 'live-fire-manual-publish',
		chainDepth: 0,
	},
};

console.log('[publish-autopilot-task] Configuration:');
console.log(`  namespace = ${ns}`);
console.log(`  queue     = autopilot-tasks`);
console.log(`  tenantId  = ${tenantId}`);
console.log(`  recipeId  = ${recipeId}`);
console.log(`  idempKey  = ${idempotencyKey}\n`);

const client = new ServiceBusClient(ns, new DefaultAzureCredential());
const sender = client.createSender('autopilot-tasks');

try {
	await sender.sendMessages({
		messageId: randomUUID(),
		contentType: 'application/json',
		body: task,
		applicationProperties: {
			tenantId,
			recipeId,
			triggerKind: 'queue-message',
		},
		correlationId: idempotencyKey,
	});
	console.log('[publish-autopilot-task] Sent.  The deployed consumer should pick it up within seconds.');
	console.log('  Check awaiting queue: GET /api/ai/autopilot/runs/awaiting');
	process.exit(0);
} catch (err) {
	console.error('[publish-autopilot-task] Failed:', err instanceof Error ? err.message : err);
	process.exit(2);
} finally {
	await sender.close();
	await client.close();
}
