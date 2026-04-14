import { randomUUID } from 'crypto';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  CreateCriteriaRunInput,
  CreateExtractionRunInput,
  EngineSelectionMode,
  EngineTarget,
  RerunCriteriaStepInput,
  RunLedgerRecord,
  RunStatus,
  RunType,
} from '../types/run-ledger.types.js';

export class RunLedgerService {
  private readonly logger = new Logger('RunLedgerService');
  private readonly containerName = 'aiInsights';

  constructor(private readonly dbService: CosmosDbService) {}

  async createExtractionRun(input: CreateExtractionRunInput): Promise<RunLedgerRecord> {
    const existing = await this.findByIdempotency(input.tenantId, input.idempotencyKey, 'extraction');
    if (existing) return existing;

    const engineSelection = this.resolveEngineSelection(input.engineTarget, input.enginePolicyRef);
    const now = new Date().toISOString();
    const record: RunLedgerRecord = {
      id: this.buildRunId('ext_run'),
      type: 'run-ledger-entry',
      runType: 'extraction',
      status: 'queued',
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
      initiatedBy: input.initiatedBy,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      engine: engineSelection.engine,
      engineSelectionMode: engineSelection.mode,
      ...(engineSelection.policyRef ? { enginePolicyRef: engineSelection.policyRef } : {}),
      engineVersion: 'pending',
      engineRunRef: 'pending',
      engineRequestRef: 'pending',
      engineResponseRef: 'pending',
      documentId: input.documentId,
      schemaKey: input.schemaKey,
      runReason: input.runReason,
      ...(input.engagementId ? { engagementId: input.engagementId } : {}),
      ...(input.loanPropertyContextId ? { loanPropertyContextId: input.loanPropertyContextId } : {}),
    };

    await this.persist(record);
    return record;
  }

  async createCriteriaRun(input: CreateCriteriaRunInput): Promise<RunLedgerRecord> {
    const existing = await this.findByIdempotency(input.tenantId, input.idempotencyKey, 'criteria');
    if (existing) return existing;

    const engineSelection = this.resolveEngineSelection(input.engineTarget, input.enginePolicyRef);
    const now = new Date().toISOString();
    const record: RunLedgerRecord = {
      id: this.buildRunId('crt_run'),
      type: 'run-ledger-entry',
      runType: 'criteria',
      status: 'queued',
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
      initiatedBy: input.initiatedBy,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      engine: engineSelection.engine,
      engineSelectionMode: engineSelection.mode,
      ...(engineSelection.policyRef ? { enginePolicyRef: engineSelection.policyRef } : {}),
      engineVersion: 'pending',
      engineRunRef: 'pending',
      engineRequestRef: 'pending',
      engineResponseRef: 'pending',
      snapshotId: input.snapshotId,
      programKey: input.programKey,
      runMode: input.runMode,
      ...(input.rerunReason ? { rerunReason: input.rerunReason } : {}),
      ...(input.parentRunId ? { parentRunId: input.parentRunId } : {}),
      ...(input.engagementId ? { engagementId: input.engagementId } : {}),
      ...(input.loanPropertyContextId ? { loanPropertyContextId: input.loanPropertyContextId } : {}),
    };

    await this.persist(record);
    return record;
  }

  async rerunCriteriaStep(input: RerunCriteriaStepInput): Promise<RunLedgerRecord> {
    const existing = await this.findByIdempotency(input.tenantId, input.idempotencyKey, 'criteria-step');
    if (existing) return existing;

    const parentCriteriaRun = await this.getRunById(input.criteriaRunId, input.tenantId);
    if (!parentCriteriaRun || parentCriteriaRun.runType !== 'criteria') {
      throw new Error(`Criteria run '${input.criteriaRunId}' was not found for tenant '${input.tenantId}'`);
    }

    const engineSelection = this.resolveEngineSelection(input.engineTarget, input.enginePolicyRef);
    const now = new Date().toISOString();
    const record: RunLedgerRecord = {
      id: this.buildRunId('step_run'),
      type: 'run-ledger-entry',
      runType: 'criteria-step',
      status: 'queued',
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
      initiatedBy: input.initiatedBy,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      engine: engineSelection.engine,
      engineSelectionMode: engineSelection.mode,
      ...(engineSelection.policyRef ? { enginePolicyRef: engineSelection.policyRef } : {}),
      engineVersion: 'pending',
      engineRunRef: 'pending',
      engineRequestRef: 'pending',
      engineResponseRef: 'pending',
      criteriaRunId: input.criteriaRunId,
      parentRunId: input.criteriaRunId,
      stepKey: input.stepKey,
      rerunReason: input.rerunReason,
      ...(parentCriteriaRun.snapshotId ? { snapshotId: parentCriteriaRun.snapshotId } : {}),
      ...(parentCriteriaRun.programKey ? { programKey: parentCriteriaRun.programKey } : {}),
      runMode: 'STEP_ONLY',
      ...(parentCriteriaRun.engagementId ? { engagementId: parentCriteriaRun.engagementId } : {}),
      ...(parentCriteriaRun.loanPropertyContextId
        ? { loanPropertyContextId: parentCriteriaRun.loanPropertyContextId }
        : {}),
    };

    await this.persist(record);
    return record;
  }

  async createCriteriaStepRun(input: {
    tenantId: string;
    initiatedBy: string;
    correlationId: string;
    idempotencyKey: string;
    parentCriteriaRunId: string;
    stepKey: string;
    engineTarget?: EngineTarget;
    enginePolicyRef?: string;
    rerunReason?: string;
  }): Promise<RunLedgerRecord> {
    const existing = await this.findByIdempotency(input.tenantId, input.idempotencyKey, 'criteria-step');
    if (existing) return existing;

    const parentCriteriaRun = await this.getRunById(input.parentCriteriaRunId, input.tenantId);
    if (!parentCriteriaRun || parentCriteriaRun.runType !== 'criteria') {
      throw new Error(
        `Criteria run '${input.parentCriteriaRunId}' was not found for tenant '${input.tenantId}'`,
      );
    }

    const engineSelection = this.resolveEngineSelection(input.engineTarget, input.enginePolicyRef);
    const now = new Date().toISOString();
    const stepRecord: RunLedgerRecord = {
      id: this.buildRunId('step_run'),
      type: 'run-ledger-entry',
      runType: 'criteria-step',
      status: 'queued',
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
      initiatedBy: input.initiatedBy,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      engine: engineSelection.engine,
      engineSelectionMode: engineSelection.mode,
      ...(engineSelection.policyRef ? { enginePolicyRef: engineSelection.policyRef } : {}),
      engineVersion: 'pending',
      engineRunRef: 'pending',
      engineRequestRef: 'pending',
      engineResponseRef: 'pending',
      criteriaRunId: parentCriteriaRun.id,
      parentRunId: parentCriteriaRun.id,
      stepKey: input.stepKey,
      ...(input.rerunReason ? { rerunReason: input.rerunReason } : {}),
      ...(parentCriteriaRun.snapshotId ? { snapshotId: parentCriteriaRun.snapshotId } : {}),
      ...(parentCriteriaRun.canonicalSnapshotId
        ? { canonicalSnapshotId: parentCriteriaRun.canonicalSnapshotId }
        : {}),
      ...(parentCriteriaRun.programKey ? { programKey: parentCriteriaRun.programKey } : {}),
      runMode: 'STEP_ONLY',
      ...(parentCriteriaRun.engagementId ? { engagementId: parentCriteriaRun.engagementId } : {}),
      ...(parentCriteriaRun.loanPropertyContextId
        ? { loanPropertyContextId: parentCriteriaRun.loanPropertyContextId }
        : {}),
    };

    await this.persist(stepRecord);

    const nextStepRunIds = [...(parentCriteriaRun.criteriaStepRunIds ?? []), stepRecord.id];
    await this.updateRun(parentCriteriaRun.id, input.tenantId, {
      criteriaStepRunIds: nextStepRunIds,
      updatedAt: now,
    });

    return stepRecord;
  }

  async getRunById(runId: string, tenantId: string): Promise<RunLedgerRecord | null> {
    const query = `
      SELECT TOP 1 * FROM c
      WHERE c.type = @type AND c.id = @id AND c.tenantId = @tenantId`;

    const result = await this.dbService.queryItems<RunLedgerRecord>(this.containerName, query, [
      { name: '@type', value: 'run-ledger-entry' },
      { name: '@id', value: runId },
      { name: '@tenantId', value: tenantId },
    ]);

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  async listRuns(
    tenantId: string,
    filters?: {
      runType?: RunType;
      engagementId?: string;
      loanPropertyContextId?: string;
      documentId?: string;
      parentRunId?: string;
      criteriaRunId?: string;
      status?: RunStatus;
      limit?: number;
    },
  ): Promise<RunLedgerRecord[]> {
    const whereClauses = ['c.type = @type', 'c.tenantId = @tenantId'];
    const parameters: Array<{ name: string; value: unknown }> = [
      { name: '@type', value: 'run-ledger-entry' },
      { name: '@tenantId', value: tenantId },
    ];

    if (filters?.runType) {
      whereClauses.push('c.runType = @runType');
      parameters.push({ name: '@runType', value: filters.runType });
    }
    if (filters?.engagementId) {
      whereClauses.push('c.engagementId = @engagementId');
      parameters.push({ name: '@engagementId', value: filters.engagementId });
    }
    if (filters?.loanPropertyContextId) {
      whereClauses.push('c.loanPropertyContextId = @loanPropertyContextId');
      parameters.push({ name: '@loanPropertyContextId', value: filters.loanPropertyContextId });
    }
    if (filters?.documentId) {
      whereClauses.push('c.documentId = @documentId');
      parameters.push({ name: '@documentId', value: filters.documentId });
    }
    if (filters?.parentRunId) {
      whereClauses.push('c.parentRunId = @parentRunId');
      parameters.push({ name: '@parentRunId', value: filters.parentRunId });
    }
    if (filters?.criteriaRunId) {
      whereClauses.push('c.criteriaRunId = @criteriaRunId');
      parameters.push({ name: '@criteriaRunId', value: filters.criteriaRunId });
    }
    if (filters?.status) {
      whereClauses.push('c.status = @status');
      parameters.push({ name: '@status', value: filters.status });
    }

    const limit = Math.max(1, Math.min(filters?.limit ?? 100, 500));
    const query = `
      SELECT TOP ${limit} * FROM c
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY c.createdAt DESC`;

    const result = await this.dbService.queryItems<RunLedgerRecord>(this.containerName, query, parameters);
    if (!result.success || !result.data) {
      return [];
    }
    return result.data;
  }

  async updateRun(
    runId: string,
    tenantId: string,
    updates: Partial<RunLedgerRecord>,
  ): Promise<RunLedgerRecord> {
    const current = await this.getRunById(runId, tenantId);
    if (!current) {
      throw new Error(`Run '${runId}' was not found for tenant '${tenantId}'`);
    }

    const merged: RunLedgerRecord = {
      ...current,
      ...updates,
      id: current.id,
      type: current.type,
      tenantId: current.tenantId,
      updatedAt: new Date().toISOString(),
    };

    await this.persist(merged);
    return merged;
  }

  async setRunStatus(
    runId: string,
    tenantId: string,
    status: RunStatus,
    extra?: Partial<RunLedgerRecord>,
  ): Promise<RunLedgerRecord> {
    return this.updateRun(runId, tenantId, {
      status,
      ...(extra ?? {}),
    });
  }

  async listCriteriaStepRuns(criteriaRunId: string, tenantId: string): Promise<RunLedgerRecord[]> {
    const query = `
      SELECT * FROM c
      WHERE c.type = @type AND c.runType = @runType AND c.tenantId = @tenantId AND c.criteriaRunId = @criteriaRunId
      ORDER BY c.createdAt ASC`;

    const result = await this.dbService.queryItems<RunLedgerRecord>(this.containerName, query, [
      { name: '@type', value: 'run-ledger-entry' },
      { name: '@runType', value: 'criteria-step' },
      { name: '@tenantId', value: tenantId },
      { name: '@criteriaRunId', value: criteriaRunId },
    ]);

    if (!result.success || !result.data) {
      return [];
    }

    return result.data;
  }

  private async persist(record: RunLedgerRecord): Promise<void> {
    const saveResult = await this.dbService.upsertItem<RunLedgerRecord>(this.containerName, record);
    if (!saveResult.success) {
      const message = saveResult.error?.message ?? 'Unknown Cosmos error';
      this.logger.error('Failed to persist run ledger record', { runId: record.id, error: message });
      throw new Error(`Failed to persist run ledger record '${record.id}': ${message}`);
    }
  }

  private async findByIdempotency(
    tenantId: string,
    idempotencyKey: string,
    runType: RunType,
  ): Promise<RunLedgerRecord | null> {
    const query = `
      SELECT TOP 1 * FROM c
      WHERE c.type = @type AND c.tenantId = @tenantId AND c.runType = @runType AND c.idempotencyKey = @idempotencyKey
      ORDER BY c.createdAt DESC`;

    const result = await this.dbService.queryItems<RunLedgerRecord>(this.containerName, query, [
      { name: '@type', value: 'run-ledger-entry' },
      { name: '@tenantId', value: tenantId },
      { name: '@runType', value: runType },
      { name: '@idempotencyKey', value: idempotencyKey },
    ]);

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  private resolveEngineSelection(
    engineTarget: EngineTarget | undefined,
    enginePolicyRef: string | undefined,
  ): { engine: EngineTarget; mode: EngineSelectionMode; policyRef?: string } {
    if (engineTarget) {
      return { engine: engineTarget, mode: 'EXPLICIT' };
    }

    if (!enginePolicyRef) {
      throw new Error('Either engineTarget or enginePolicyRef is required');
    }

    const mapJson = process.env.RUN_ENGINE_POLICY_MAP_JSON;
    if (!mapJson) {
      throw new Error(
        `RUN_ENGINE_POLICY_MAP_JSON is required when enginePolicyRef is provided. Missing policyRef='${enginePolicyRef}'`,
      );
    }

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(mapJson) as Record<string, string>;
    } catch {
      throw new Error('RUN_ENGINE_POLICY_MAP_JSON must be valid JSON object mapping policyRef to AXIOM or MOP_PRIO');
    }

    const resolved = parsed[enginePolicyRef];
    if (resolved !== 'AXIOM' && resolved !== 'MOP_PRIO') {
      throw new Error(
        `enginePolicyRef '${enginePolicyRef}' was not found in RUN_ENGINE_POLICY_MAP_JSON with a valid engine target`,
      );
    }

    return { engine: resolved, mode: 'POLICY', policyRef: enginePolicyRef };
  }

  private buildRunId(prefix: string): string {
    return `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  }
}
