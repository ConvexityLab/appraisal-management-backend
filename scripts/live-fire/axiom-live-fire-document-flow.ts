#!/usr/bin/env tsx

import {
  assertStatus,
  getJson,
  loadLiveFireContext,
  logConfig,
  logSection,
  postJson,
  sleep,
} from './_axiom-live-fire-common.js';

type ChangeType = 'added' | 'removed' | 'modified';
type Significance = 'minor' | 'moderate' | 'major';

interface ComparisonChange {
  section?: string;
  changeType?: ChangeType;
  original?: string;
  revised?: string;
  significance?: Significance;
}

interface ComparisonEnvelope {
  success: boolean;
  data?: {
    comparisonId?: string;
    evaluationId?: string;
    status?: string;
    changes?: ComparisonChange[];
  };
}

interface DocumentsEnvelope {
  success?: boolean;
  documents?: Array<{
    id?: string;
    blobUrl?: string;
    fileName?: string;
    name?: string;
  }>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function assertSubstantiveComparison(changes: ComparisonChange[] | undefined, source: string): void {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error(`${source} returned no document changes.`);
  }

  const validChanges = changes.filter((change) => {
    const hasSection = typeof change.section === 'string' && change.section.trim().length > 0;
    const hasChangeType = change.changeType === 'added' || change.changeType === 'removed' || change.changeType === 'modified';
    const hasSignificance = change.significance === 'minor' || change.significance === 'moderate' || change.significance === 'major';
    const original = typeof change.original === 'string' ? change.original.trim() : '';
    const revised = typeof change.revised === 'string' ? change.revised.trim() : '';
    const hasContentDelta = original !== revised || original.length > 0 || revised.length > 0;
    return hasSection && hasChangeType && hasSignificance && hasContentDelta;
  });

  if (validChanges.length === 0) {
    throw new Error(`${source} returned changes, but none had section/changeType/significance/content delta.`);
  }

  console.log(`✓ comparisonChangeCount=${changes.length}`);
  console.log(`✓ validComparisonChangeCount=${validChanges.length}`);
}

async function resolveDocumentUrls(
  baseUrl: string,
  authHeader: Record<string, string>,
  orderId: string,
): Promise<{ originalDocumentUrl: string; revisedDocumentUrl: string }> {
  const explicitOriginal = process.env['AXIOM_LIVE_DOCUMENT_URL']?.trim();
  const explicitRevised = process.env['AXIOM_LIVE_REVISED_DOCUMENT_URL']?.trim();

  if (explicitOriginal && explicitRevised) {
    return {
      originalDocumentUrl: explicitOriginal,
      revisedDocumentUrl: explicitRevised,
    };
  }

  const preferredDocumentId = process.env['AXIOM_LIVE_DOCUMENT_ID']?.trim();
  const documentsRes = await getJson<DocumentsEnvelope>(
    `${baseUrl}/api/documents?orderId=${encodeURIComponent(orderId)}&limit=100&offset=0`,
    authHeader,
  );
  assertStatus(documentsRes.status, [200], 'list order documents for document-flow', documentsRes.data);

  const documents = Array.isArray(documentsRes.data?.documents)
    ? documentsRes.data.documents.filter(
        (document) => typeof document.blobUrl === 'string' && document.blobUrl.trim().length > 0,
      )
    : [];

  if (documents.length === 0) {
    throw new Error(`Order '${orderId}' has no documents with blobUrl available for document-flow live-fire.`);
  }

  const originalDocument = preferredDocumentId
    ? documents.find((document) => document.id === preferredDocumentId) ?? documents[0]
    : documents[0];

  const revisedDocument = documents.find((document) => document.id && document.id !== originalDocument.id);

  const originalDocumentUrl = explicitOriginal ?? originalDocument.blobUrl?.trim();
  const revisedDocumentUrl = explicitRevised ?? revisedDocument?.blobUrl?.trim();

  if (!originalDocumentUrl) {
    throw new Error(`Unable to resolve original document URL for order '${orderId}'.`);
  }

  if (!revisedDocumentUrl) {
    throw new Error(
      `Unable to resolve revised document URL for order '${orderId}'. Set AXIOM_LIVE_REVISED_DOCUMENT_URL or ensure the order has a second document with blobUrl.`,
    );
  }

  console.log(`✓ resolvedOriginalDocumentId=${originalDocument.id ?? 'unknown'}`);
  console.log(`✓ resolvedRevisedDocumentId=${revisedDocument?.id ?? 'env-provided'}`);

  return { originalDocumentUrl, revisedDocumentUrl };
}

async function main(): Promise<void> {
  const context = await loadLiveFireContext();
  const orderId = required('AXIOM_LIVE_ORDER_ID');
  const pollAttempts = Number(process.env['AXIOM_LIVE_POLL_ATTEMPTS'] ?? '20');
  const pollIntervalMs = Number(process.env['AXIOM_LIVE_POLL_INTERVAL_MS'] ?? '3000');
  const { originalDocumentUrl: documentUrl, revisedDocumentUrl } = await resolveDocumentUrls(
    context.baseUrl,
    context.authHeader,
    orderId,
  );

  logConfig(context, { orderId, pollAttempts, pollIntervalMs });

  logSection('Step 1: POST /api/axiom/documents');
  const notifyRes = await postJson<{
    success: boolean;
    data?: { evaluationId: string; pipelineJobId?: string };
    error?: { message: string };
  }>(
    `${context.baseUrl}/api/axiom/documents`,
    {
      orderId,
      documentType: 'appraisal',
      documentUrl,
      forceResubmit: true,
      metadata: {
        fileName: `live-fire-${Date.now()}.pdf`,
        uploadedBy: 'live-fire-script',
        propertyAddress: process.env['AXIOM_LIVE_PROPERTY_ADDRESS'] ?? 'Unknown',
      },
    },
    context.authHeader,
  );
  assertStatus(notifyRes.status, [202], 'document notify', notifyRes.data);
  if (!notifyRes.data?.success || !notifyRes.data?.data?.evaluationId) {
    throw new Error(`document notify missing evaluationId: ${JSON.stringify(notifyRes.data)}`);
  }
  const evaluationId = notifyRes.data.data.evaluationId;
  console.log(`✓ evaluationId=${evaluationId}`);

  logSection('Step 2: GET /api/axiom/evaluations/:evaluationId');
  const evalByIdRes = await getJson<{ success: boolean; data?: { evaluationId: string; status: string } }>(
    `${context.baseUrl}/api/axiom/evaluations/${evaluationId}?bypassCache=true`,
    context.authHeader,
  );
  assertStatus(evalByIdRes.status, [200, 404], 'evaluation by id', evalByIdRes.data);
  if (evalByIdRes.status === 200) {
    console.log(`✓ evaluation lookup returned status=${evalByIdRes.data.data?.status}`);
  } else {
    console.log('… evaluation-by-id not yet available (404), continuing to order polling');
  }

  logSection('Step 3: GET /api/axiom/evaluations/order/:orderId (poll)');
  let foundOrderEvaluation = false;
  for (let attempt = 1; attempt <= pollAttempts; attempt++) {
    const orderEvalRes = await getJson<{ success: boolean; data?: Array<{ evaluationId: string; status?: string }> }>(
      `${context.baseUrl}/api/axiom/evaluations/order/${orderId}`,
      context.authHeader,
    );

    if (orderEvalRes.status === 200 && orderEvalRes.data?.success && Array.isArray(orderEvalRes.data?.data)) {
      const found = orderEvalRes.data.data.find((item) => item.evaluationId === evaluationId);
      if (found) {
        foundOrderEvaluation = true;
        console.log(`✓ evaluation surfaced in order list on attempt ${attempt} (status=${found.status ?? 'n/a'})`);
        break;
      }
    } else if (orderEvalRes.status !== 404) {
      throw new Error(`unexpected order evaluation status ${orderEvalRes.status}: ${JSON.stringify(orderEvalRes.data)}`);
    }

    console.log(`… evaluation not yet visible for order (attempt ${attempt}/${pollAttempts})`);
    await sleep(pollIntervalMs);
  }

  if (!foundOrderEvaluation) {
    throw new Error(`evaluationId=${evaluationId} did not appear under orderId=${orderId} within poll window`);
  }

  logSection('Step 4: POST /api/axiom/documents/compare');
  const compareRes = await postJson<ComparisonEnvelope>(
    `${context.baseUrl}/api/axiom/documents/compare`,
    {
      orderId,
      originalDocumentUrl: documentUrl,
      revisedDocumentUrl,
      metadata: {
        reason: 'live-fire regression comparison',
      },
    },
    context.authHeader,
  );
  assertStatus(compareRes.status, [202], 'document compare', compareRes.data);
  if (!compareRes.data?.success) {
    throw new Error(`document comparison did not return success: ${JSON.stringify(compareRes.data)}`);
  }
  const comparisonId = compareRes.data?.data?.comparisonId;
  const comparisonEvaluationId = compareRes.data?.data?.evaluationId;
  console.log(
    `✓ comparison queued${comparisonId ? ` (comparisonId=${comparisonId})` : comparisonEvaluationId ? ` (evaluationId=${comparisonEvaluationId})` : ''}`,
  );
  assertSubstantiveComparison(compareRes.data?.data?.changes, 'Initial comparison response');

  if (comparisonId) {
    logSection('Step 5: GET /api/axiom/comparisons/:comparisonId');
    const getComparisonRes = await getJson<ComparisonEnvelope>(
      `${context.baseUrl}/api/axiom/comparisons/${comparisonId}`,
      context.authHeader,
    );
    assertStatus(getComparisonRes.status, [200, 404], 'get comparison', getComparisonRes.data);
    if (getComparisonRes.status === 200 && getComparisonRes.data?.success) {
      console.log(`✓ comparison retrieval returned status=${getComparisonRes.data.data?.status ?? 'unknown'}`);
      assertSubstantiveComparison(getComparisonRes.data.data?.changes, 'Retrieved comparison response');
    } else {
      console.log('… comparison retrieval returned 404 (accepted for async upstream timing)');
    }
  }

  console.log('\n✅ Document flow live-fire passed.');
}

main().catch((error) => {
  console.error(`\n❌ Document flow live-fire failed: ${(error as Error).message}`);
  process.exit(1);
});
