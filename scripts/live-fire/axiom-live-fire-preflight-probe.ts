#!/usr/bin/env tsx

import {
  getJson,
  loadLiveFireContext,
  logConfig,
  logSection,
  sleep,
} from './_axiom-live-fire-common.js';

interface OrderSummary {
  id?: string;
  orderId?: string;
  clientId?: string;
  tenantId?: string;
  status?: string;
}

interface OrdersResponse {
  orders?: OrderSummary[];
}

interface WrappedOrderResponse {
  success?: boolean;
  data?: OrderSummary;
}

interface DocumentSummary {
  id?: string;
  orderId?: string;
  blobPath?: string;
  blobUrl?: string;
  fileName?: string;
  documentType?: string;
}

interface DocumentsResponse {
  success?: boolean;
  documents?: DocumentSummary[];
}

function requiredOrderId(order: OrderSummary): string | undefined {
  if (typeof order.id === 'string' && order.id.trim()) return order.id.trim();
  if (typeof order.orderId === 'string' && order.orderId.trim()) return order.orderId.trim();
  return undefined;
}

function hasUsableBlob(document: DocumentSummary): boolean {
  return Boolean((document.blobPath && document.blobPath.trim()) || (document.blobUrl && document.blobUrl.trim()));
}

function hasTenantAndClient(order: OrderSummary | undefined): boolean {
  if (!order) return false;
  const tenantId = typeof order.tenantId === 'string' ? order.tenantId.trim() : '';
  const clientId = typeof order.clientId === 'string' ? order.clientId.trim() : '';
  return Boolean(tenantId) && Boolean(clientId);
}

async function getJsonWith429Retry<T>(
  url: string,
  headers: Record<string, string>,
  attempts = 3,
  retryDelayMs = 1500,
): Promise<{ status: number; data: T }> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const res = await getJson<T>(url, headers);
    if (res.status !== 429) {
      return res;
    }

    if (attempt < attempts) {
      await sleep(retryDelayMs * attempt);
    }
  }

  return getJson<T>(url, headers);
}

function extractOrder(payload: OrderSummary | WrappedOrderResponse | undefined): OrderSummary | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  if ('orderId' in payload || 'id' in payload) {
    return payload as OrderSummary;
  }

  const wrapped = payload as WrappedOrderResponse;
  if (wrapped.data && typeof wrapped.data === 'object') {
    return wrapped.data;
  }

  return undefined;
}

function quotePwsh(value: string): string {
  return value.replace(/'/g, "''");
}

function quoteBash(value: string): string {
  return value.replace(/'/g, "'\\''");
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();

  const pageLimit = Number(process.env['AXIOM_LIVE_PREFLIGHT_ORDER_LIMIT'] ?? '50');
  const maxScan = Number(process.env['AXIOM_LIVE_PREFLIGHT_MAX_SCAN'] ?? '200');

  if (!Number.isFinite(pageLimit) || pageLimit <= 0) {
    throw new Error(`AXIOM_LIVE_PREFLIGHT_ORDER_LIMIT must be a positive number. Received: ${process.env['AXIOM_LIVE_PREFLIGHT_ORDER_LIMIT']}`);
  }
  if (!Number.isFinite(maxScan) || maxScan <= 0) {
    throw new Error(`AXIOM_LIVE_PREFLIGHT_MAX_SCAN must be a positive number. Received: ${process.env['AXIOM_LIVE_PREFLIGHT_MAX_SCAN']}`);
  }

  logConfig(context, { pageLimit, maxScan });

  logSection('Step 1: Scan /api/documents for candidate pairs');

  const scanned: string[] = [];
  let selectedOrder: OrderSummary | undefined;
  let selectedOrderId: string | undefined;
  let selectedDocument: DocumentSummary | undefined;

  for (let offset = 0; offset < maxScan; offset += pageLimit) {
    const docsRes = await getJsonWith429Retry<DocumentsResponse>(
      `${context.baseUrl}/api/documents?limit=${pageLimit}&offset=${offset}`,
      context.authHeader,
    );

    if (docsRes.status !== 200) {
      continue;
    }

    const documents = Array.isArray(docsRes.data?.documents) ? docsRes.data.documents : [];
    if (documents.length === 0) {
      break;
    }

    for (const doc of documents) {
      const orderId = typeof doc.orderId === 'string' ? doc.orderId.trim() : '';
      if (!orderId) {
        continue;
      }
      scanned.push(orderId);
      if (!(typeof doc.id === 'string' && doc.id.trim()) || !hasUsableBlob(doc)) {
        continue;
      }

      selectedOrderId = orderId;
      selectedDocument = doc;

      const orderRes = await getJsonWith429Retry<OrderSummary | WrappedOrderResponse>(
        `${context.baseUrl}/api/orders/${encodeURIComponent(selectedOrderId)}`,
        context.authHeader,
      );

      if (orderRes.status === 200) {
        selectedOrder = extractOrder(orderRes.data);
      }
      break;
    }

    if (selectedOrderId && selectedDocument) {
      break;
    }
  }

  if (!selectedOrderId || !selectedDocument?.id) {
    logSection('Step 2: Fallback scan /api/orders and order-scoped documents');

    for (let offset = 0; offset < maxScan; offset += pageLimit) {
      const ordersRes = await getJsonWith429Retry<OrdersResponse>(
        `${context.baseUrl}/api/orders?limit=${pageLimit}&offset=${offset}`,
        context.authHeader,
      );

      if (ordersRes.status !== 200) {
        throw new Error(`GET /api/orders failed with status ${ordersRes.status}: ${JSON.stringify(ordersRes.data)}`);
      }

      const orders = Array.isArray(ordersRes.data?.orders) ? ordersRes.data.orders : [];
      if (orders.length === 0) {
        break;
      }

      for (const order of orders) {
        const orderId = requiredOrderId(order);
        if (!orderId) {
          continue;
        }

        scanned.push(orderId);
        const docsRes = await getJsonWith429Retry<DocumentsResponse>(
          `${context.baseUrl}/api/documents?orderId=${encodeURIComponent(orderId)}&limit=100&offset=0`,
          context.authHeader,
        );

        if (docsRes.status !== 200) {
          continue;
        }

        const documents = Array.isArray(docsRes.data?.documents) ? docsRes.data.documents : [];
        const candidateDoc = documents.find((doc) => typeof doc.id === 'string' && doc.id.trim() && hasUsableBlob(doc));
        if (candidateDoc) {
          selectedOrder = order;
          selectedOrderId = orderId;
          selectedDocument = candidateDoc;
          break;
        }
      }

      if (selectedOrderId && selectedDocument) {
        break;
      }
    }
  }

  if (!selectedOrderId || !selectedDocument?.id) {
    throw new Error(
      `No valid order/document pair found. ` +
      `Order-first scan checked ${Math.min(scanned.length, maxScan)} order(s). ` +
      'Fallback document scan also found no document with id + orderId + blobPath/blobUrl.',
    );
  }

  const resolvedClientId = hasTenantAndClient(selectedOrder)
    ? (selectedOrder as OrderSummary).clientId!.trim()
    : context.clientId;

  logSection('Preflight result');
  console.log(`✓ orderId=${selectedOrderId}`);
  console.log(`✓ documentId=${selectedDocument.id}`);
  console.log(`✓ orderStatus=${selectedOrder.status ?? 'unknown'}`);
  console.log(`✓ clientId=${resolvedClientId}`);
  console.log(`✓ blobPath=${selectedDocument.blobPath ?? 'n/a'}`);
  console.log(`✓ blobUrl=${selectedDocument.blobUrl ?? 'n/a'}`);

  logSection('PowerShell exports');
  console.log(`$env:AXIOM_LIVE_ORDER_ID='${quotePwsh(selectedOrderId)}'`);
  console.log(`$env:AXIOM_LIVE_DOCUMENT_ID='${quotePwsh(selectedDocument.id)}'`);
  console.log(`$env:AXIOM_LIVE_CLIENT_ID='${quotePwsh(resolvedClientId)}'`);

  logSection('Bash exports');
  console.log(`export AXIOM_LIVE_ORDER_ID='${quoteBash(selectedOrderId)}'`);
  console.log(`export AXIOM_LIVE_DOCUMENT_ID='${quoteBash(selectedDocument.id)}'`);
  console.log(`export AXIOM_LIVE_CLIENT_ID='${quoteBash(resolvedClientId)}'`);

  console.log('\n✅ Axiom live-fire preflight probe passed.');
}

main().catch((error) => {
  console.error(`\n❌ Axiom live-fire preflight probe failed: ${(error as Error).message}`);
  process.exit(1);
});
