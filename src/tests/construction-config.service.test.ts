/**
 * Construction Config Service � Integration Tests
 *
 * Runs against real Azure Cosmos DB using DefaultAzureCredential (az login).
 * Requires AZURE_COSMOS_ENDPOINT to be set in the environment.
 * All test documents are deleted in afterAll.
 *
 * Key invariants verified against real data:
 *   1. getConfig throws when config doc does not exist (no auto-create)
 *   2. retainageReleaseRequiresHumanApproval is always written as true
 *   3. All 27 default values are persisted correctly on createConfig
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionConfigService } from '../services/construction-config.service.js';

// --- Setup -------------------------------------------------------------------

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction finance integration tests. ' +
    'Set it in your shell before running jest: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

const testRunId   = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TEST_TENANT = `tenant-cfg-${testRunId}`;

const docsToCleanup: { container: string; id: string; partitionKey: string }[] = [];
const track = (container: string, id: string, partitionKey: string) =>
  docsToCleanup.push({ container, id, partitionKey });

let db: CosmosDbService;
let svc: ConstructionConfigService;

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT);
  await db.initialize();
  svc = new ConstructionConfigService(db);
}, 30_000);

afterAll(async () => {
  for (const doc of docsToCleanup) {
    try { await db.deleteDocument(doc.container, doc.id, doc.partitionKey); } catch { /* best-effort */ }
  }
}, 30_000);

// --- getConfig ----------------------------------------------------------------

describe('ConstructionConfigService � getConfig', () => {
  it('throws a clear error when no config exists for the tenant (no auto-create)', async () => {
    await expect(svc.getConfig(`unconfigured-${testRunId}`))
      .rejects.toThrow(/no.*config.*found|not found/i);
  });

  it('throws when tenantId is empty', async () => {
    await expect(svc.getConfig('')).rejects.toThrow(/tenantId/i);
  });

  it('returns the config document after it has been created', async () => {
    const tenantId = `${TEST_TENANT}-read`;
    const created  = await svc.createConfig(tenantId, 'test-runner');
    track('construction-loans', created.tenantId === tenantId ? `config-${tenantId}` : created.tenantId, tenantId);

    const fetched = await svc.getConfig(tenantId);
    expect(fetched.tenantId).toBe(tenantId);
    expect(fetched.defaultRetainagePercent).toBe(10);
  });
});

// --- createConfig -------------------------------------------------------------

describe('ConstructionConfigService � createConfig', () => {
  it('persists a config document with all 27 default values', async () => {
    const tenantId = `${TEST_TENANT}-defaults`;
    const config   = await svc.createConfig(tenantId, 'test-runner');
    track('construction-loans', `config-${tenantId}`, tenantId);

    expect(config.tenantId).toBe(tenantId);
    expect(config.allowConcurrentDraws).toBe(false);
    expect(config.maxConcurrentDraws).toBe(1);
    expect(config.requireInspectionBeforeDraw).toBe(true);
    expect(config.allowDesktopInspection).toBe(true);
    expect(config.lienWaiverGracePeriodDays).toBe(0);
    expect(config.defaultRetainagePercent).toBe(10);
    expect(config.retainageReleaseAutoTrigger).toBe(true);
    expect(config.retainageReleaseThreshold).toBe(95);
    expect(config.retainageReleaseRequiresHumanApproval).toBe(true);
    expect(config.feasibilityEnabled).toBe(true);
    expect(config.feasibilityBlocksApproval).toBe(false);
    expect(config.feasibilityMinScore).toBe(65);
    expect(config.feasibilityCustomRules).toEqual([]);
    expect(config.stalledProjectDays).toBe(60);
    expect(config.overBudgetThresholdPct).toBe(5);
    expect(config.scheduleSlipDays).toBe(30);
    expect(config.lowArvCoverageThreshold).toBe(0.9);
    expect(config.contractorLicenseExpiryWarningDays).toBe(30);
    expect(config.aiMonitoringEnabled).toBe(true);
    expect(config.aiDrawAnomalyDetection).toBe(true);
    expect(config.aiCompletionForecastingEnabled).toBe(true);
    expect(config.aiServicingEnabled).toBe(true);
    expect(config.interestReserveWarningDays).toBe(30);
    expect(config.maturityWarningDays).toBe(60);
    expect(config.autoGenerateStatusReports).toBe(true);
    expect(config.statusReportFrequencyDays).toBe(30);

    // Verify the defaults survive a round-trip read from Cosmos
    const readBack = await svc.getConfig(tenantId);
    expect(readBack.defaultRetainagePercent).toBe(10);
    expect(readBack.feasibilityMinScore).toBe(65);
  });

  it('applies overrides on top of defaults', async () => {
    const tenantId = `${TEST_TENANT}-overrides`;
    const config   = await svc.createConfig(tenantId, 'test-runner', { defaultRetainagePercent: 5, feasibilityMinScore: 70 });
    track('construction-loans', `config-${tenantId}`, tenantId);

    expect(config.defaultRetainagePercent).toBe(5);
    expect(config.feasibilityMinScore).toBe(70);
    // Non-overridden defaults are still applied
    expect(config.stalledProjectDays).toBe(60);
  });

  it('always forces retainageReleaseRequiresHumanApproval to true even if override tries false', async () => {
    const tenantId = `${TEST_TENANT}-invariant`;
    const config   = await svc.createConfig(tenantId, 'test-runner', { retainageReleaseRequiresHumanApproval: false } as any);
    track('construction-loans', `config-${tenantId}`, tenantId);

    expect(config.retainageReleaseRequiresHumanApproval).toBe(true);

    // Verify the invariant survived the round-trip
    const readBack = await svc.getConfig(tenantId);
    expect(readBack.retainageReleaseRequiresHumanApproval).toBe(true);
  });
});

// --- updateConfig -------------------------------------------------------------

describe('ConstructionConfigService � updateConfig', () => {
  it('applies a partial update and reads the changes back from Cosmos', async () => {
    const tenantId = `${TEST_TENANT}-update`;
    await svc.createConfig(tenantId, 'test-runner');
    track('construction-loans', `config-${tenantId}`, tenantId);

    const updated = await svc.updateConfig(tenantId, { defaultRetainagePercent: 15, stalledProjectDays: 90 }, 'test-runner');
    expect(updated.defaultRetainagePercent).toBe(15);
    expect(updated.stalledProjectDays).toBe(90);

    const readBack = await svc.getConfig(tenantId);
    expect(readBack.defaultRetainagePercent).toBe(15);
    expect(readBack.stalledProjectDays).toBe(90);
  });

  it('preserves retainageReleaseRequiresHumanApproval as true after an update that tries to set false', async () => {
    const tenantId = `${TEST_TENANT}-update-inv`;
    await svc.createConfig(tenantId, 'test-runner');
    track('construction-loans', `config-${tenantId}`, tenantId);

    const updated = await svc.updateConfig(tenantId, { retainageReleaseRequiresHumanApproval: false } as any, 'test-runner');
    expect(updated.retainageReleaseRequiresHumanApproval).toBe(true);

    const readBack = await svc.getConfig(tenantId);
    expect(readBack.retainageReleaseRequiresHumanApproval).toBe(true);
  });

  it('throws when config does not exist (no auto-create on update)', async () => {
    await expect(svc.updateConfig(`unconfigured-update-${testRunId}`, { stalledProjectDays: 90 }, 'test-runner'))
      .rejects.toThrow(/no.*config.*found|not found/i);
  });
});