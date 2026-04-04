type HttpMethod = 'GET' | 'POST';

type CanaryConfig = {
  baseUrl: string;
  bearerToken: string;
  tenantContextQuery: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[Canary] Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveTenantContextQuery(): string {
  const orderId = process.env.CANARY_ORDER_ID?.trim();
  const engagementId = process.env.CANARY_ENGAGEMENT_ID?.trim();

  if (!orderId && !engagementId) {
    throw new Error('[Canary] Missing tenant context. Set CANARY_ORDER_ID or CANARY_ENGAGEMENT_ID.');
  }

  if (orderId) {
    return `loanPropertyContextId=${encodeURIComponent(orderId)}`;
  }

  return `engagementId=${encodeURIComponent(engagementId as string)}`;
}

function buildConfig(): CanaryConfig {
  return {
    baseUrl: requiredEnv('CANARY_BASE_URL').replace(/\/+$/, ''),
    bearerToken: requiredEnv('CANARY_BEARER_TOKEN'),
    tenantContextQuery: resolveTenantContextQuery(),
  };
}

async function callJson<T>(config: CanaryConfig, path: string, method: HttpMethod = 'GET'): Promise<{ status: number; body: T }> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.bearerToken}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : ({} as T);
  return { status: response.status, body };
}

type RunLedgerEntry = {
  id: string;
  runType: 'extraction' | 'criteria' | 'criteria-step';
  canonicalSnapshotId?: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

async function main() {
  const config = buildConfig();
  console.log('[Canary] Starting run-ledger journey canary checks...');

  const health = await callJson<Record<string, unknown>>(config, '/health');
  if (health.status < 200 || health.status >= 300) {
    throw new Error(`[Canary] Health check failed with status ${health.status}`);
  }

  const listResponse = await callJson<ApiEnvelope<RunLedgerEntry[]>>(
    config,
    `/api/runs?${config.tenantContextQuery}&limit=20`,
  );

  if (listResponse.status !== 200 || !listResponse.body.success || !Array.isArray(listResponse.body.data)) {
    throw new Error(`[Canary] Run list failed. Status=${listResponse.status}`);
  }

  const runs = listResponse.body.data;
  if (runs.length === 0) {
    throw new Error('[Canary] No runs found for configured tenant context. Canary cannot validate journey wiring.');
  }

  const targetRun = runs[0];
  const runRead = await callJson<ApiEnvelope<RunLedgerEntry>>(config, `/api/runs/${encodeURIComponent(targetRun.id)}`);
  if (runRead.status !== 200 || !runRead.body.success || !runRead.body.data) {
    throw new Error(`[Canary] Run read failed for ${targetRun.id}. Status=${runRead.status}`);
  }

  const snapshotCheck = await callJson<ApiEnvelope<Record<string, unknown>>>(
    config,
    `/api/runs/${encodeURIComponent(targetRun.id)}/snapshot`,
  );
  if (![200, 404].includes(snapshotCheck.status)) {
    throw new Error(`[Canary] Snapshot endpoint returned unexpected status ${snapshotCheck.status} for run ${targetRun.id}`);
  }

  const stepRun = runs.find((item) => item.runType === 'criteria-step');
  if (stepRun) {
    const stepInputCheck = await callJson<ApiEnvelope<Record<string, unknown>>>(
      config,
      `/api/runs/${encodeURIComponent(stepRun.id)}/step-input`,
    );
    if (![200, 404].includes(stepInputCheck.status)) {
      throw new Error(`[Canary] Step-input endpoint returned unexpected status ${stepInputCheck.status} for run ${stepRun.id}`);
    }
  }

  console.log(`[Canary] PASS: checked ${runs.length} runs. Primary run=${targetRun.id}.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Canary] FAIL: ${message}`);
  process.exitCode = 1;
});
