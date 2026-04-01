import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Blob } from 'node:buffer';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { generateBulkFixture, type BulkPerfProfile } from './bulk-fixtures.js';

interface CliArgs {
  scenario: string;
  baseUrl: string;
  tenantId: string;
  clientId: string;
  adapterKey: string;
  outputDir: string;
  concurrencyLevels?: number[];
  rpsLevels?: number[];
  durationSec?: number;
  bi03Mode: 'shared-storage' | 'multipart';
}

interface ScenarioConfig {
  id: 'BI-PERF-01' | 'BI-PERF-02' | 'BI-PERF-03' | 'BI-PERF-04' | 'BI-PERF-05';
  profile: BulkPerfProfile;
  mode: 'serial' | 'concurrency-ramp' | 'operator-read-ramp';
  iterations?: number;
  iterationsPerRamp?: number;
  defaultConcurrencyLevels?: number[];
  defaultRpsLevels?: number[];
  defaultDurationSec?: number;
  thresholds: {
    maxP95Ms: number;
    minSuccessRatePct: number;
    max5xxRatePct?: number;
    endpointP95Ms?: {
      list?: number;
      get?: number;
      failures?: number;
    };
  };
}

interface IterationResult {
  iteration: number;
  endpoint: 'submit' | 'list' | 'get' | 'failures';
  status: number;
  ok: boolean;
  durationMs: number;
  responseMessage: string;
}

interface SharedStorageFixtureRef {
  storageAccountName: string;
  containerName: string;
  dataFileBlobName: string;
  documentBlobNames: string[];
}

const SCENARIOS: Record<string, ScenarioConfig> = {
  'BI-PERF-01': {
    id: 'BI-PERF-01',
    profile: 'P-SMALL',
    mode: 'serial',
    iterations: 20,
    thresholds: {
      maxP95Ms: 2000,
      minSuccessRatePct: 99,
      max5xxRatePct: 1,
    },
  },
  'BI-PERF-02': {
    id: 'BI-PERF-02',
    profile: 'P-MEDIUM',
    mode: 'serial',
    iterations: 10,
    thresholds: {
      maxP95Ms: 5000,
      minSuccessRatePct: 99,
      max5xxRatePct: 1,
    },
  },
  'BI-PERF-03': {
    id: 'BI-PERF-03',
    profile: 'P-LARGE',
    mode: 'serial',
    iterations: 5,
    thresholds: {
      maxP95Ms: 12000,
      minSuccessRatePct: 99,
      max5xxRatePct: 1,
    },
  },
  'BI-PERF-04': {
    id: 'BI-PERF-04',
    profile: 'P-SMALL',
    mode: 'concurrency-ramp',
    iterationsPerRamp: 10,
    defaultConcurrencyLevels: [10, 25, 50],
    thresholds: {
      maxP95Ms: 8000,
      minSuccessRatePct: 98,
      max5xxRatePct: 2,
    },
  },
  'BI-PERF-05': {
    id: 'BI-PERF-05',
    profile: 'P-SMALL',
    mode: 'operator-read-ramp',
    defaultRpsLevels: [30, 60, 120],
    defaultDurationSec: 300,
    thresholds: {
      maxP95Ms: 1500,
      minSuccessRatePct: 99,
      max5xxRatePct: 1,
      endpointP95Ms: {
        list: 1000,
        get: 1000,
        failures: 1500,
      },
    },
  },
};

function parseArgs(argv: string[]): CliArgs {
  const envBi03Mode = process.env['PERF_BULK_BI03_MODE']?.trim().toLowerCase();
  const defaultBi03Mode: 'shared-storage' | 'multipart' =
    envBi03Mode === 'multipart' || envBi03Mode === 'shared-storage'
      ? envBi03Mode
      : 'shared-storage';

  const defaults: CliArgs = {
    scenario: 'BI-PERF-01',
    baseUrl: process.env['PERF_BULK_BASE_URL'] ?? 'http://localhost:3011',
    tenantId: process.env['PERF_BULK_TENANT_ID'] ?? 'tenant-perf',
    clientId: process.env['PERF_BULK_CLIENT_ID'] ?? 'client-perf',
    adapterKey: process.env['PERF_BULK_ADAPTER_KEY'] ?? 'bridge-standard',
    outputDir: process.env['PERF_BULK_OUTPUT_DIR'] ?? path.resolve('output/perf'),
    bi03Mode: defaultBi03Mode,
  };

  const next = { ...defaults };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const value = argv[i + 1];
    if (!current?.startsWith('--') || !value) continue;

    if (current === '--scenario') next.scenario = value;
    if (current === '--baseUrl') next.baseUrl = value;
    if (current === '--tenantId') next.tenantId = value;
    if (current === '--clientId') next.clientId = value;
    if (current === '--adapterKey') next.adapterKey = value;
    if (current === '--outputDir') next.outputDir = value;
    if (current === '--concurrency') {
      const parsed = value
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((candidate) => Number.isFinite(candidate) && candidate > 0);
      if (parsed.length > 0) {
        next.concurrencyLevels = parsed;
      }
    }
    if (current === '--rps') {
      const parsed = value
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((candidate) => Number.isFinite(candidate) && candidate > 0);
      if (parsed.length > 0) {
        next.rpsLevels = parsed;
      }
    }
    if (current === '--durationSec') {
      const parsed = Number.parseInt(value.trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        next.durationSec = parsed;
      }
    }
    if (current === '--bi03Mode') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'shared-storage' || normalized === 'multipart') {
        next.bi03Mode = normalized;
      } else {
        throw new Error(`Invalid --bi03Mode '${value}'. Supported values: shared-storage, multipart`);
      }
    }
  }

  return next;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))]!;
}

async function getTestToken(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/test-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'bulk-perf@appraisal.local',
      role: 'admin',
      name: 'Bulk Perf Runner',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain test token. HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error('Test token endpoint did not return token');
  }

  return payload.token;
}

async function submitSeedJob(params: {
  baseUrl: string;
  token: string;
  tenantId: string;
  clientId: string;
  adapterKey: string;
  fixtureDataFilePath: string;
  fixtureDocumentPaths: string[];
  items: unknown;
  scenarioId: string;
}): Promise<string> {
  const formData = await createSubmitFormData({
    clientId: params.clientId,
    adapterKey: params.adapterKey,
    fixtureDataFilePath: params.fixtureDataFilePath,
    fixtureDocumentPaths: params.fixtureDocumentPaths,
    items: params.items,
    jobName: `${params.scenarioId}-seed-${Date.now()}`,
  });

  const response = await fetch(`${params.baseUrl}/api/bulk-ingestion/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'x-tenant-id': params.tenantId,
    },
    body: formData,
  });

  const payload = (await response.json()) as { job?: { id?: string }; error?: string };
  if (response.status !== 202 || !payload.job?.id) {
    throw new Error(`Failed to create BI-PERF-05 seed job. HTTP ${response.status}. ${payload.error ?? ''}`.trim());
  }

  return payload.job.id;
}

async function createSubmitFormData(params: {
  clientId: string;
  adapterKey: string;
  fixtureDataFilePath: string;
  fixtureDocumentPaths: string[];
  items: unknown;
  jobName: string;
}): Promise<FormData> {
  const form = new FormData();
  form.set('clientId', params.clientId);
  form.set('adapterKey', params.adapterKey);
  form.set('ingestionMode', 'MULTIPART');
  form.set('jobName', params.jobName);
  form.set('items', JSON.stringify(params.items));

  const dataFileBuffer = await fs.readFile(params.fixtureDataFilePath);
  form.append('dataFile', new Blob([dataFileBuffer], { type: 'text/csv' }), path.basename(params.fixtureDataFilePath));

  for (const documentPath of params.fixtureDocumentPaths) {
    const documentBuffer = await fs.readFile(documentPath);
    form.append('documents', new Blob([documentBuffer], { type: 'application/pdf' }), path.basename(documentPath));
  }

  return form;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable '${name}' for BI-PERF-03 shared-storage mode`);
  }
  return value;
}

async function stageFixtureToSharedStorage(params: {
  scenarioId: string;
  timestamp: string;
  profile: BulkPerfProfile;
  fixtureDataFilePath: string;
  fixtureDocumentPaths: string[];
}): Promise<SharedStorageFixtureRef> {
  const storageAccountName = requireEnv('AZURE_STORAGE_ACCOUNT_NAME');
  const containerName = requireEnv('STORAGE_CONTAINER_DOCUMENTS');
  const accountUrl = `https://${storageAccountName}.blob.core.windows.net`;
  const client = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
  const containerClient = client.getContainerClient(containerName);

  const prefix = `perf-shared/${params.scenarioId}/${params.timestamp}/${params.profile.toLowerCase()}`;
  const dataFileBlobName = `${prefix}/data/${path.basename(params.fixtureDataFilePath)}`;
  const dataBuffer = await fs.readFile(params.fixtureDataFilePath);
  await containerClient
    .getBlockBlobClient(dataFileBlobName)
    .uploadData(dataBuffer, { blobHTTPHeaders: { blobContentType: 'text/csv' } });

  const documentBlobNames: string[] = [];
  for (const documentPath of params.fixtureDocumentPaths) {
    const blobName = `${prefix}/documents/${path.basename(documentPath)}`;
    const buffer = await fs.readFile(documentPath);
    await containerClient
      .getBlockBlobClient(blobName)
      .uploadData(buffer, { blobHTTPHeaders: { blobContentType: 'application/pdf' } });
    documentBlobNames.push(blobName);
  }

  return {
    storageAccountName,
    containerName,
    dataFileBlobName,
    documentBlobNames,
  };
}

async function runScenario(args: CliArgs, scenario: ScenarioConfig): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputRoot = path.resolve(args.outputDir, scenario.id, timestamp);
  const fixtureRoot = path.resolve('output/perf-fixtures', scenario.id, timestamp);

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.mkdir(fixtureRoot, { recursive: true });

  console.log(`[perf] Generating fixture for ${scenario.id} (${scenario.profile})...`);
  const fixture = await generateBulkFixture(scenario.profile, fixtureRoot);

  const useBi03SharedStorage = scenario.id === 'BI-PERF-03' && args.bi03Mode === 'shared-storage';

  let sharedStorageRef: SharedStorageFixtureRef | null = null;
  if (useBi03SharedStorage) {
    console.log(`[perf] BI-PERF-03 mode: ${args.bi03Mode}`);
    console.log('[perf] Staging BI-PERF-03 fixture to shared storage once...');
    sharedStorageRef = await stageFixtureToSharedStorage({
      scenarioId: scenario.id,
      timestamp,
      profile: scenario.profile,
      fixtureDataFilePath: fixture.dataFilePath,
      fixtureDocumentPaths: fixture.documentPaths,
    });
  } else if (scenario.id === 'BI-PERF-03') {
    console.log(`[perf] BI-PERF-03 mode: ${args.bi03Mode}`);
  }

  console.log(`[perf] Acquiring test token from ${args.baseUrl}...`);
  const token = await getTestToken(args.baseUrl);

  const results: IterationResult[] = [];
  const rampResults: Array<{
    concurrency: number;
    iterationCount: number;
    successRatePct: number;
    p95Ms: number;
    failures5xx: number;
  }> = [];

  let bi05SeedJobId: string | null = null;
  if (scenario.id === 'BI-PERF-05') {
    console.log('[perf] Creating BI-PERF-05 seed job for read-pressure endpoints...');
    bi05SeedJobId = await submitSeedJob({
      baseUrl: args.baseUrl,
      token,
      tenantId: args.tenantId,
      clientId: args.clientId,
      adapterKey: args.adapterKey,
      fixtureDataFilePath: fixture.dataFilePath,
      fixtureDocumentPaths: fixture.documentPaths,
      items: fixture.items,
      scenarioId: scenario.id,
    });
    console.log(`[perf] BI-PERF-05 seed job: ${bi05SeedJobId}`);
  }

  async function executeIteration(iterationLabel: string): Promise<IterationResult> {
    return executeIterationForEndpoint(iterationLabel, 'submit');
  }

  async function executeIterationForEndpoint(
    iterationLabel: string,
    endpoint: 'submit' | 'list' | 'get' | 'failures',
  ): Promise<IterationResult> {
    const start = process.hrtime.bigint();
    const response = await (async () => {
      if (endpoint === 'list') {
        const query = new URLSearchParams({ clientId: args.clientId }).toString();
        return fetch(`${args.baseUrl}/api/bulk-ingestion?${query}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': args.tenantId,
          },
        });
      }

      if (endpoint === 'get') {
        if (!bi05SeedJobId) {
          throw new Error('BI-PERF-05 seed job is not initialized');
        }
        return fetch(`${args.baseUrl}/api/bulk-ingestion/${bi05SeedJobId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': args.tenantId,
          },
        });
      }

      if (endpoint === 'failures') {
        if (!bi05SeedJobId) {
          throw new Error('BI-PERF-05 seed job is not initialized');
        }
        return fetch(`${args.baseUrl}/api/bulk-ingestion/${bi05SeedJobId}/failures?limit=25`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': args.tenantId,
          },
        });
      }

      if (sharedStorageRef) {
        return fetch(`${args.baseUrl}/api/bulk-ingestion/submit`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': args.tenantId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: args.clientId,
            adapterKey: args.adapterKey,
            ingestionMode: 'SHARED_STORAGE',
            jobName: `${scenario.id}-${iterationLabel}`,
            items: fixture.items,
            dataFileName: path.basename(fixture.dataFilePath),
            documentFileNames: fixture.documentPaths.map((docPath) => path.basename(docPath)),
            sharedStorage: {
              storageAccountName: sharedStorageRef.storageAccountName,
              containerName: sharedStorageRef.containerName,
              dataFileBlobName: sharedStorageRef.dataFileBlobName,
              documentBlobNames: sharedStorageRef.documentBlobNames,
            },
          }),
        });
      }

      const formData = await createSubmitFormData({
        clientId: args.clientId,
        adapterKey: args.adapterKey,
        fixtureDataFilePath: fixture.dataFilePath,
        fixtureDocumentPaths: fixture.documentPaths,
        items: fixture.items,
        jobName: `${scenario.id}-${iterationLabel}`,
      });

      return fetch(`${args.baseUrl}/api/bulk-ingestion/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': args.tenantId,
        },
        body: formData,
      });
    })();
    const end = process.hrtime.bigint();

    const durationMs = Number(end - start) / 1_000_000;
    let responseMessage = '';
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      responseMessage = payload.message ?? payload.error ?? '';
    } catch {
      responseMessage = '';
    }

    return {
      iteration: results.length + 1,
      endpoint,
      status: response.status,
      ok: endpoint === 'submit' ? response.status === 202 : response.status === 200,
      durationMs,
      responseMessage,
    };
  }

  if (scenario.mode === 'serial') {
    const iterations = scenario.iterations ?? 1;
    for (let i = 1; i <= iterations; i += 1) {
      const result = await executeIteration(String(i));
      result.iteration = i;
      results.push(result);
      console.log(`[perf] ${scenario.id} iteration ${i}/${iterations}: status=${result.status}, durationMs=${result.durationMs.toFixed(2)}`);
    }
  } else if (scenario.mode === 'concurrency-ramp') {
    const iterationsPerRamp = scenario.iterationsPerRamp ?? 10;
    const concurrencyLevels = args.concurrencyLevels ?? scenario.defaultConcurrencyLevels ?? [10, 25, 50];
    let globalIteration = 1;

    for (const concurrency of concurrencyLevels) {
      console.log(`[perf] ${scenario.id} ramp starting: concurrency=${concurrency}, iterations=${iterationsPerRamp}`);
      const rampChunk: IterationResult[] = [];

      for (let i = 0; i < iterationsPerRamp; i += concurrency) {
        const batchSize = Math.min(concurrency, iterationsPerRamp - i);
        const batch = await Promise.all(
          Array.from({ length: batchSize }, async (_unused, index) => {
            const label = `${concurrency}-${i + index + 1}`;
            const outcome = await executeIteration(label);
            outcome.iteration = globalIteration;
            globalIteration += 1;
            return outcome;
          }),
        );

        for (const item of batch) {
          results.push(item);
          rampChunk.push(item);
          console.log(`[perf] ${scenario.id} ramp c=${concurrency}: status=${item.status}, durationMs=${item.durationMs.toFixed(2)}`);
        }
      }

      const rampDurations = rampChunk.map((entry) => entry.durationMs);
      const rampSuccessCount = rampChunk.filter((entry) => entry.ok).length;
      const ramp5xx = rampChunk.filter((entry) => entry.status >= 500 && entry.status < 600).length;
      const rampSuccessRatePct = rampChunk.length === 0 ? 0 : (rampSuccessCount / rampChunk.length) * 100;
      rampResults.push({
        concurrency,
        iterationCount: rampChunk.length,
        successRatePct: Number(rampSuccessRatePct.toFixed(2)),
        p95Ms: Number(percentile(rampDurations, 95).toFixed(2)),
        failures5xx: ramp5xx,
      });
    }
  } else {
    const durationSec = args.durationSec ?? scenario.defaultDurationSec ?? 300;
    const rpsLevels = args.rpsLevels ?? scenario.defaultRpsLevels ?? [30, 60, 120];
    let globalIteration = 1;

    for (const rps of rpsLevels) {
      console.log(`[perf] ${scenario.id} ramp starting: rps=${rps}, durationSec=${durationSec}`);
      const rampChunk: IterationResult[] = [];
      const totalRequests = rps * durationSec;

      for (let second = 0; second < durationSec; second += 1) {
        const secondStart = Date.now();
        const requestsThisSecond = Math.min(rps, totalRequests - second * rps);
        if (requestsThisSecond <= 0) {
          break;
        }

        const batch = await Promise.all(
          Array.from({ length: requestsThisSecond }, async (_unused, index) => {
            const endpointSelector = (globalIteration + index) % 3;
            const endpoint: 'list' | 'get' | 'failures' =
              endpointSelector === 0 ? 'list' : endpointSelector === 1 ? 'get' : 'failures';
            const label = `${rps}-${second + 1}-${index + 1}`;
            const outcome = await executeIterationForEndpoint(label, endpoint);
            outcome.iteration = globalIteration;
            globalIteration += 1;
            return outcome;
          }),
        );

        for (const item of batch) {
          results.push(item);
          rampChunk.push(item);
        }

        const elapsedMs = Date.now() - secondStart;
        if (elapsedMs < 1000 && second < durationSec - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 - elapsedMs));
        }
      }

      const rampDurations = rampChunk.map((entry) => entry.durationMs);
      const rampSuccessCount = rampChunk.filter((entry) => entry.ok).length;
      const ramp5xx = rampChunk.filter((entry) => entry.status >= 500 && entry.status < 600).length;
      const rampSuccessRatePct = rampChunk.length === 0 ? 0 : (rampSuccessCount / rampChunk.length) * 100;
      rampResults.push({
        concurrency: rps,
        iterationCount: rampChunk.length,
        successRatePct: Number(rampSuccessRatePct.toFixed(2)),
        p95Ms: Number(percentile(rampDurations, 95).toFixed(2)),
        failures5xx: ramp5xx,
      });
      console.log(`[perf] ${scenario.id} ramp complete: rps=${rps}, requests=${rampChunk.length}`);
    }
  }

  const durations = results.map((r) => r.durationMs);
  const successCount = results.filter((r) => r.ok).length;
  const failures5xx = results.filter((r) => r.status >= 500 && r.status < 600).length;
  const successRatePct = results.length === 0 ? 0 : (successCount / results.length) * 100;
  const failures5xxRatePct = results.length === 0 ? 0 : (failures5xx / results.length) * 100;
  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const max = Math.max(...durations);
  const min = Math.min(...durations);
  const thresholdP95 = scenario.thresholds.maxP95Ms;
  const thresholdSuccess = scenario.thresholds.minSuccessRatePct;
  const threshold5xx = scenario.thresholds.max5xxRatePct;

  const pass =
    p95 < thresholdP95 &&
    successRatePct >= thresholdSuccess &&
    (threshold5xx === undefined || failures5xxRatePct <= threshold5xx);

  const endpointMetrics = (['submit', 'list', 'get', 'failures'] as const)
    .map((endpoint) => {
      const entries = results.filter((entry) => entry.endpoint === endpoint);
      if (entries.length === 0) {
        return null;
      }

      const latencies = entries.map((entry) => entry.durationMs);
      const endpointSuccessRatePct = (entries.filter((entry) => entry.ok).length / entries.length) * 100;
      return {
        endpoint,
        requests: entries.length,
        successRatePct: Number(endpointSuccessRatePct.toFixed(2)),
        failures5xx: entries.filter((entry) => entry.status >= 500 && entry.status < 600).length,
        latencyMs: {
          p50: Number(percentile(latencies, 50).toFixed(2)),
          p95: Number(percentile(latencies, 95).toFixed(2)),
          p99: Number(percentile(latencies, 99).toFixed(2)),
          min: Number(Math.min(...latencies).toFixed(2)),
          max: Number(Math.max(...latencies).toFixed(2)),
        },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const endpointThresholds = scenario.thresholds.endpointP95Ms;
  const endpointPass = endpointThresholds
    ? endpointMetrics.every((metric) => {
        if (metric.endpoint === 'list' && endpointThresholds.list !== undefined) {
          return metric.latencyMs.p95 < endpointThresholds.list;
        }
        if (metric.endpoint === 'get' && endpointThresholds.get !== undefined) {
          return metric.latencyMs.p95 < endpointThresholds.get;
        }
        if (metric.endpoint === 'failures' && endpointThresholds.failures !== undefined) {
          return metric.latencyMs.p95 < endpointThresholds.failures;
        }
        return true;
      })
    : true;

  const finalPass = pass && endpointPass;

  const summary = {
    scenarioId: scenario.id,
    profile: scenario.profile,
    mode: scenario.mode,
    ...(scenario.id === 'BI-PERF-03' ? { bi03Mode: args.bi03Mode } : {}),
    iterations: results.length,
    fixture: {
      itemCount: fixture.itemCount,
      documentCount: fixture.documentCount,
      dataFilePath: fixture.dataFilePath,
    },
    metrics: {
      successCount,
      failureCount: results.length - successCount,
      successRatePct: Number(successRatePct.toFixed(2)),
      failures5xx,
      failures5xxRatePct: Number(failures5xxRatePct.toFixed(2)),
      latencyMs: {
        p50: Number(p50.toFixed(2)),
        p95: Number(p95.toFixed(2)),
        p99: Number(p99.toFixed(2)),
        min: Number(min.toFixed(2)),
        max: Number(max.toFixed(2)),
      },
    },
    ...(rampResults.length > 0 ? { ramps: rampResults } : {}),
    ...(endpointMetrics.length > 0 ? { endpointMetrics } : {}),
    thresholds: {
      maxP95Ms: thresholdP95,
      minSuccessRatePct: thresholdSuccess,
      ...(threshold5xx !== undefined ? { max5xxRatePct: threshold5xx } : {}),
      ...(endpointThresholds ? { endpointP95Ms: endpointThresholds } : {}),
    },
    pass: finalPass,
  };

  const rawCsv = [
    'iteration,endpoint,status,ok,durationMs,responseMessage',
    ...results.map((r) => `${r.iteration},${r.endpoint},${r.status},${r.ok},${r.durationMs.toFixed(2)},"${(r.responseMessage || '').replace(/"/g, '""')}"`),
  ].join('\n');

  await fs.writeFile(path.join(outputRoot, 'summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
  await fs.writeFile(path.join(outputRoot, 'raw.csv'), rawCsv, 'utf-8');

  console.log(`[perf] Summary written to: ${path.join(outputRoot, 'summary.json')}`);
  console.log(`[perf] Raw results written to: ${path.join(outputRoot, 'raw.csv')}`);

  if (!summary.pass) {
    throw new Error(
      `${scenario.id} failed thresholds: p95=${summary.metrics.latencyMs.p95}ms (max ${thresholdP95}), successRate=${summary.metrics.successRatePct}% (min ${thresholdSuccess}), 5xxRate=${summary.metrics.failures5xxRatePct}%${threshold5xx !== undefined ? ` (max ${threshold5xx})` : ''}`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const scenario = SCENARIOS[args.scenario];

  if (!scenario) {
    throw new Error(`Unsupported scenario '${args.scenario}'. Supported: ${Object.keys(SCENARIOS).join(', ')}`);
  }

  await runScenario(args, scenario);
}

void main().catch((error) => {
  console.error('[perf] Runner failed:', error);
  process.exit(1);
});
