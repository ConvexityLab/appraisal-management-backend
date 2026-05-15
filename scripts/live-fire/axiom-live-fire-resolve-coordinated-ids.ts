#!/usr/bin/env tsx

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

interface OrderRecord {
  id?: string;
  orderId?: string;
  tenantId?: string;
  clientId?: string;
  status?: string;
}

interface DocumentRecord {
  id?: string;
  orderId?: string;
  blobPath?: string;
  blobUrl?: string;
  tenantId?: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function hasUsableBlob(document: DocumentRecord): boolean {
  return Boolean((document.blobPath && document.blobPath.trim()) || (document.blobUrl && document.blobUrl.trim()));
}

function quotePwsh(value: string): string {
  return value.replace(/'/g, "''");
}

function quoteBash(value: string): string {
  return value.replace(/'/g, "'\\''");
}

async function main(): Promise<void> {
  const endpoint = requiredEnv('COSMOS_ENDPOINT');
  const databaseName = requiredEnv('COSMOS_DATABASE_NAME');
  const tenantId = requiredEnv('AXIOM_LIVE_TENANT_ID');

  const explicitClientId = optionalEnv('AXIOM_LIVE_COORDINATED_CLIENT_ID');
  const maxOrders = Number(optionalEnv('AXIOM_LIVE_COORDINATED_MAX_ORDERS') ?? '200');
  if (!Number.isFinite(maxOrders) || maxOrders <= 0) {
    throw new Error(`AXIOM_LIVE_COORDINATED_MAX_ORDERS must be a positive number. Received: ${optionalEnv('AXIOM_LIVE_COORDINATED_MAX_ORDERS')}`);
  }

  const cosmos = new CosmosClient({
    endpoint,
    aadCredentials: new DefaultAzureCredential(),
  });

  const db = cosmos.database(databaseName);
  const ordersContainer = db.container('orders');
  const documentsContainer = db.container('documents');
  const criteriaContainer = db.container('criteria');

  const criteriaClientRows = await criteriaContainer.items.query<{ clientId?: string }>({
    query: `SELECT DISTINCT VALUE {"clientId": c.clientId}
            FROM c
            WHERE c.tenantId = @tenantId AND IS_DEFINED(c.clientId)` ,
    parameters: [{ name: '@tenantId', value: tenantId }],
  }).fetchAll();

  const criteriaClientIds = new Set(
    (criteriaClientRows.resources ?? [])
      .map((row) => row?.clientId)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
  );

  const orderRows = await ordersContainer.items.query<OrderRecord>({
    query: `SELECT TOP ${Math.floor(maxOrders)} c.id, c.orderId, c.tenantId, c.clientId, c.status
            FROM c
            WHERE c.tenantId = @tenantId AND IS_DEFINED(c.clientId)
            ORDER BY c._ts DESC`,
    parameters: [{ name: '@tenantId', value: tenantId }],
  }).fetchAll();

  const orderCandidates = (orderRows.resources ?? []).filter((order) => {
    const cid = typeof order.clientId === 'string' ? order.clientId.trim() : '';
    if (!cid) return false;
    if (explicitClientId && cid !== explicitClientId) return false;
    return criteriaClientIds.has(cid);
  });

  let selectedOrder: OrderRecord | undefined;
  let selectedDocument: DocumentRecord | undefined;

  for (const order of orderCandidates) {
    const orderId = (order.id ?? order.orderId)?.trim();
    if (!orderId) {
      continue;
    }

    const docs = await documentsContainer.items.query<DocumentRecord>({
      query: `SELECT TOP 10 c.id, c.orderId, c.blobPath, c.blobUrl, c.tenantId
              FROM c
              WHERE c.orderId = @orderId`,
      parameters: [{ name: '@orderId', value: orderId }],
    }).fetchAll();

    const goodDoc = (docs.resources ?? []).find((doc) => hasUsableBlob(doc));
    if (!goodDoc?.id) {
      continue;
    }

    selectedOrder = order;
    selectedDocument = goodDoc;
    break;
  }

  if (!selectedOrder?.clientId || !selectedOrder?.id || !selectedDocument?.id) {
    throw new Error(
      `No coordinated tuple found for tenant '${tenantId}'. ` +
      `Need intersection of: criteria clientId + order clientId + document with blobPath/blobUrl. ` +
      `Tried ${orderCandidates.length} order candidate(s).`,
    );
  }

  const resolvedClientId = selectedOrder.clientId;
  const resolvedOrderId = selectedOrder.id;
  const resolvedDocumentId = selectedDocument.id;

  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('Coordinated Live-Fire IDs');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`tenantId  : ${tenantId}`);
  console.log(`clientId  : ${resolvedClientId}`);
  console.log(`orderId   : ${resolvedOrderId}`);
  console.log(`documentId: ${resolvedDocumentId}`);
  console.log(`orderStatus: ${selectedOrder.status ?? 'unknown'}`);
  console.log(`blobPath  : ${selectedDocument.blobPath ?? 'n/a'}`);
  console.log(`blobUrl   : ${selectedDocument.blobUrl ?? 'n/a'}`);

  console.log('\nPowerShell exports');
  console.log(`$env:AXIOM_LIVE_CLIENT_ID='${quotePwsh(resolvedClientId)}'`);
  console.log(`$env:AXIOM_LIVE_ORDER_ID='${quotePwsh(resolvedOrderId)}'`);
  console.log(`$env:AXIOM_LIVE_DOCUMENT_ID='${quotePwsh(resolvedDocumentId)}'`);
  console.log(`$env:AXIOM_LIVE_PREFLIGHT_CLIENT_ID_ALLOWLIST='${quotePwsh(resolvedClientId)}'`);

  console.log('\nBash exports');
  console.log(`export AXIOM_LIVE_CLIENT_ID='${quoteBash(resolvedClientId)}'`);
  console.log(`export AXIOM_LIVE_ORDER_ID='${quoteBash(resolvedOrderId)}'`);
  console.log(`export AXIOM_LIVE_DOCUMENT_ID='${quoteBash(resolvedDocumentId)}'`);
  console.log(`export AXIOM_LIVE_PREFLIGHT_CLIENT_ID_ALLOWLIST='${quoteBash(resolvedClientId)}'`);

  console.log('\n✅ Coordinated ID resolution passed.');
}

main().catch((error) => {
  console.error(`\n❌ Coordinated ID resolution failed: ${(error as Error).message}`);
  process.exit(1);
});
