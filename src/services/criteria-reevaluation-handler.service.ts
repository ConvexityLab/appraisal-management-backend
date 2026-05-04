import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { AxiomService, type AxiomEvaluationResult, type CriterionEvaluation } from './axiom.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { EventCategory, EventPriority, type BaseEvent, type EventHandler } from '../types/events.js';
import type { CompiledCriterion } from '../types/axiom.types.js';

const AI_INSIGHTS_CONTAINER = 'aiInsights';
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 90_000;

const EXPLICIT_FIELD_TO_CRITERIA: Record<string, string[]> = {
  propertyaddress: ['URAR-1004-001'],
  streetaddress: ['URAR-1004-001'],
  address: ['URAR-1004-001'],
  city: ['URAR-1004-001'],
  state: ['URAR-1004-001'],
  zipcode: ['URAR-1004-001'],
  zip: ['URAR-1004-001'],
  lotsize: ['URAR-1004-011'],
  sitesize: ['URAR-1004-011'],
  sitedimensions: ['URAR-1004-011'],
  neighborhooddescription: ['URAR-1004-007', 'URAR-1004-008', 'URAR-1004-009'],
  marketingtime: ['URAR-1004-009'],
  propertyvaluetrend: ['URAR-1004-008'],
  comparableaddress: ['URAR-1004-020', 'URAR-1004-021'],
  compaddress: ['URAR-1004-020', 'URAR-1004-021'],
  comparablesaledate: ['URAR-1004-022'],
  saledate: ['URAR-1004-022'],
  grossadjustments: ['URAR-1004-025'],
  netadjustments: ['URAR-1004-024'],
  reconciledvalue: ['URAR-1004-026', 'URAR-1004-027'],
  appraisedvalue: ['URAR-1004-026', 'URAR-1004-027'],
  effectivedate: ['URAR-1004-028'],
  legaldescription: ['URAR-1004-002'],
  apn: ['URAR-1004-003'],
  parcelid: ['URAR-1004-003'],
  yearbuilt: ['URAR-1004-014'],
  gla: ['URAR-1004-016'],
  grosslivingarea: ['URAR-1004-016'],
  roomcount: ['URAR-1004-017'],
  bedrooms: ['URAR-1004-017'],
  bathrooms: ['URAR-1004-017'],
  conditionrating: ['URAR-1004-018'],
  qualityrating: ['URAR-1004-019'],
  condition: ['URAR-1004-018'],
  quality: ['URAR-1004-019'],
};

interface CriteriaReevaluationRequestedData {
  orderId?: string;
  tenantId?: string;
  triggeringFieldName?: string;
  triggeringFieldNewValue?: unknown;
  triggeredBy?: string;
}

interface ReevaluationContext {
  orderId: string;
  tenantId: string;
  clientId: string;
  subClientId: string;
  programId: string;
  programVersion: string;
  triggeringFieldName: string;
  triggeringFieldNewValue?: unknown;
  triggeredBy?: string;
  previousEvaluation: AxiomEvaluationResult;
}

type PublishableVerdict = CriterionEvaluation['evaluation'] | undefined;

export class CriteriaReevaluationHandlerService {
  private readonly logger = new Logger('CriteriaReevaluationHandlerService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly inflightByKey = new Map<string, Promise<void>>();
  private isStarted = false;

  constructor(
    private readonly dbService: CosmosDbService,
    private readonly axiomService: Pick<AxiomService, 'getCompiledCriteria' | 'submitCriteriaReevaluation' | 'getLastPipelineSubmissionError'> = new AxiomService(dbService),
    private readonly publisher: Pick<ServiceBusEventPublisher, 'publish'> = new ServiceBusEventPublisher(),
  ) {
    this.subscriber = new ServiceBusEventSubscriber('criteria-reevaluation-handler');
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('CriteriaReevaluationHandlerService already started');
      return;
    }

    const handler: EventHandler<BaseEvent> = {
      handle: async (event) => {
        await this.onReevaluationRequested(event as BaseEvent & { data?: CriteriaReevaluationRequestedData });
      },
    };

    await this.subscriber.subscribe('qc.criterion.reevaluate.requested', handler);
    this.isStarted = true;
    this.logger.info('CriteriaReevaluationHandlerService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('qc.criterion.reevaluate.requested').catch(() => undefined);
    this.isStarted = false;
  }

  private async onReevaluationRequested(event: BaseEvent & { data?: CriteriaReevaluationRequestedData }): Promise<void> {
    const data = event.data ?? {};
    const orderId = typeof data.orderId === 'string' ? data.orderId : undefined;
    const tenantId = typeof data.tenantId === 'string' ? data.tenantId : undefined;
    const triggeringFieldName = typeof data.triggeringFieldName === 'string' ? data.triggeringFieldName : undefined;

    if (!orderId || !tenantId || !triggeringFieldName) {
      this.logger.warn('qc.criterion.reevaluate.requested missing required fields', {
        orderId,
        tenantId,
        triggeringFieldName,
      });
      return;
    }

    const dedupeKey = `${orderId}:${this.normalizeToken(triggeringFieldName)}:${JSON.stringify(data.triggeringFieldNewValue ?? null)}`;
    const existing = this.inflightByKey.get(dedupeKey);
    if (existing) {
      this.logger.info('Duplicate criteria reevaluation request ignored while one is already in flight', {
        orderId,
        triggeringFieldName,
      });
      return existing;
    }

    const requestInput: Required<Pick<CriteriaReevaluationRequestedData, 'orderId' | 'tenantId' | 'triggeringFieldName'>> & CriteriaReevaluationRequestedData = {
      orderId,
      tenantId,
      triggeringFieldName,
      ...(data.triggeringFieldNewValue !== undefined ? { triggeringFieldNewValue: data.triggeringFieldNewValue } : {}),
      ...(typeof data.triggeredBy === 'string' ? { triggeredBy: data.triggeredBy } : {}),
    };

    const job = this.processReevaluation(requestInput).finally(() => {
      this.inflightByKey.delete(dedupeKey);
    });

    this.inflightByKey.set(dedupeKey, job);
    return job;
  }

  private async processReevaluation(input: Required<Pick<CriteriaReevaluationRequestedData, 'orderId' | 'tenantId' | 'triggeringFieldName'>> & CriteriaReevaluationRequestedData): Promise<void> {
    let context: ReevaluationContext | null = null;
    let dependentCriterionIds: string[] = [];

    try {
      context = await this.resolveContext(input);
      dependentCriterionIds = await this.resolveDependentCriteria(context);

      if (dependentCriterionIds.length === 0) {
        this.logger.info('No dependent criteria resolved for corrected field — skipping cascade rerun', {
          orderId: input.orderId,
          tenantId: input.tenantId,
          triggeringFieldName: input.triggeringFieldName,
        });
        return;
      }

      const oldVerdicts = this.toVerdictMap(context.previousEvaluation.criteria);

      for (const criterionId of dependentCriterionIds) {
        await this.publishRequestedEvent(context, criterionId);
      }

      const submission = await this.axiomService.submitCriteriaReevaluation({
        orderId: context.orderId,
        tenantId: context.tenantId,
        clientId: context.clientId,
        subClientId: context.subClientId,
        programId: context.programId,
        programVersion: context.programVersion,
      });

      if (!submission) {
        const submissionError = this.axiomService.getLastPipelineSubmissionError?.() ?? null;
        for (const criterionId of dependentCriterionIds) {
          await this.publishReevaluatedEvent({
            context,
            criterionId,
            oldVerdict: oldVerdicts.get(criterionId),
            changedFlag: false,
            errorMessage: submissionError?.message ?? 'Criteria re-evaluation submission failed',
            ...(submissionError?.code ? { errorCode: submissionError.code } : {}),
          });
        }
        return;
      }

      const completedEvaluation = await this.waitForEvaluationCompletion(submission.evaluationId);
      if (!completedEvaluation || completedEvaluation.status !== 'completed') {
        for (const criterionId of dependentCriterionIds) {
          await this.publishReevaluatedEvent({
            context,
            criterionId,
            oldVerdict: oldVerdicts.get(criterionId),
            changedFlag: false,
            evaluationId: submission.evaluationId,
            pipelineJobId: submission.pipelineJobId,
            errorMessage: completedEvaluation
              ? `Criteria re-evaluation finished with status '${completedEvaluation.status}'`
              : `Criteria re-evaluation timed out waiting for evaluation '${submission.evaluationId}'`,
          });
        }
        return;
      }

      const newVerdicts = this.toVerdictMap(completedEvaluation.criteria ?? []);
      for (const criterionId of dependentCriterionIds) {
        const oldVerdict = oldVerdicts.get(criterionId);
        const newVerdict = newVerdicts.get(criterionId);
        await this.publishReevaluatedEvent({
          context,
          criterionId,
          oldVerdict,
          ...(newVerdict !== undefined ? { newVerdict } : {}),
          changedFlag: oldVerdict !== undefined && newVerdict !== undefined ? oldVerdict !== newVerdict : false,
          evaluationId: completedEvaluation.evaluationId,
          ...(completedEvaluation.pipelineJobId ? { pipelineJobId: completedEvaluation.pipelineJobId } : {}),
        });
      }
    } catch (error) {
      this.logger.error('Failed to process criteria reevaluation request', {
        orderId: input.orderId,
        tenantId: input.tenantId,
        triggeringFieldName: input.triggeringFieldName,
        error: error instanceof Error ? error.message : String(error),
      });

      if (context && dependentCriterionIds.length > 0) {
        const oldVerdicts = this.toVerdictMap(context.previousEvaluation.criteria);
        for (const criterionId of dependentCriterionIds) {
          await this.publishReevaluatedEvent({
            context,
            criterionId,
            oldVerdict: oldVerdicts.get(criterionId),
            changedFlag: false,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  private async resolveContext(input: Required<Pick<CriteriaReevaluationRequestedData, 'orderId' | 'tenantId' | 'triggeringFieldName'>> & CriteriaReevaluationRequestedData): Promise<ReevaluationContext> {
    const orderResponse = await this.dbService.findOrderById(input.orderId);
    const order = orderResponse.success ? orderResponse.data as Record<string, unknown> | null : null;

    if (!order) {
      throw new Error(`Order '${input.orderId}' could not be found for criteria reevaluation`);
    }
    if (typeof order['tenantId'] !== 'string' || order['tenantId'] !== input.tenantId) {
      throw new Error(`Order '${input.orderId}' is not accessible for tenant '${input.tenantId}'`);
    }

    const previousEvaluation = await this.loadLatestCompletedEvaluation(input.orderId, input.tenantId);
    const clientId = this.requireString(
      (order['clientId'] as string | undefined) ?? previousEvaluation.clientId,
      `Order '${input.orderId}' is missing clientId required for criteria reevaluation`,
    );
    const subClientId = this.requireString(
      order['subClientId'] as string | undefined,
      `Order '${input.orderId}' is missing subClientId required for criteria reevaluation`,
    );
    const programId = this.requireString(
      (order['axiomProgramId'] as string | undefined) ?? previousEvaluation.programId,
      `Order '${input.orderId}' is missing axiomProgramId required for criteria reevaluation`,
    );
    const programVersion = this.requireString(
      (order['axiomProgramVersion'] as string | undefined) ?? previousEvaluation.programVersion,
      `Order '${input.orderId}' is missing axiomProgramVersion required for criteria reevaluation`,
    );

    return {
      orderId: input.orderId,
      tenantId: input.tenantId,
      clientId,
      subClientId,
      programId,
      programVersion,
      triggeringFieldName: input.triggeringFieldName,
      ...(input.triggeringFieldNewValue !== undefined ? { triggeringFieldNewValue: input.triggeringFieldNewValue } : {}),
      ...(input.triggeredBy ? { triggeredBy: input.triggeredBy } : {}),
      previousEvaluation,
    };
  }

  private async loadLatestCompletedEvaluation(orderId: string, tenantId: string): Promise<AxiomEvaluationResult> {
    const response = await this.dbService.queryItems<AxiomEvaluationResult>(
      AI_INSIGHTS_CONTAINER,
      `SELECT TOP 1 * FROM c
       WHERE c.orderId = @orderId
         AND c.tenantId = @tenantId
         AND c.status = 'completed'
         AND IS_ARRAY(c.criteria)
       ORDER BY c._ts DESC`,
      [
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    const evaluation = response.success ? response.data?.[0] : undefined;
    if (!evaluation) {
      throw new Error(`Order '${orderId}' has no completed Axiom evaluation available for criteria reevaluation`);
    }
    return evaluation;
  }

  private async resolveDependentCriteria(context: ReevaluationContext): Promise<string[]> {
    const explicitMatches = this.resolveExplicitCriterionMatches(context.triggeringFieldName);
    const compiledMatches = await this.resolveCompiledCriterionMatches(context).catch((error) => {
      this.logger.warn('Failed to infer dependent criteria from compiled program', {
        orderId: context.orderId,
        triggeringFieldName: context.triggeringFieldName,
        error: error instanceof Error ? error.message : String(error),
      });
      return [] as string[];
    });

    const knownPreviousCriteria = new Set((context.previousEvaluation.criteria ?? []).map((criterion) => criterion.criterionId));
    return [...new Set([...explicitMatches, ...compiledMatches])]
      .filter((criterionId) => knownPreviousCriteria.has(criterionId));
  }

  private async resolveCompiledCriterionMatches(context: ReevaluationContext): Promise<string[]> {
    const compiled = await this.axiomService.getCompiledCriteria(
      context.clientId,
      context.tenantId,
      context.programId,
      context.programVersion,
    );

    const aliases = this.buildFieldAliases(context.triggeringFieldName);
    return compiled.criteria
      .filter((criterion) => this.compiledCriterionDependsOnField(criterion, aliases))
      .map((criterion) => criterion.code)
      .filter((code): code is string => typeof code === 'string' && code.length > 0);
  }

  private compiledCriterionDependsOnField(criterion: CompiledCriterion, aliases: Set<string>): boolean {
    const dataRequirementPaths = Array.isArray(criterion.dataRequirements)
      ? criterion.dataRequirements.map((requirement) => requirement.path)
      : [];
    const haystack = [
      ...dataRequirementPaths,
      criterion.code,
      criterion.statement,
      criterion.description,
    ]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((value) => this.normalizeToken(value));

    return haystack.some((value) => {
      for (const alias of aliases) {
        if (value === alias || value.includes(alias) || alias.includes(value)) {
          return true;
        }
      }
      return false;
    });
  }

  private resolveExplicitCriterionMatches(fieldName: string): string[] {
    const aliases = this.buildFieldAliases(fieldName);
    const matches = new Set<string>();
    for (const alias of aliases) {
      for (const criterionId of EXPLICIT_FIELD_TO_CRITERIA[alias] ?? []) {
        matches.add(criterionId);
      }
    }
    return [...matches];
  }

  private buildFieldAliases(fieldName: string): Set<string> {
    const normalized = this.normalizeToken(fieldName);
    const aliases = new Set<string>([normalized]);

    const segments = fieldName
      .split(/[.\s_\-\/]+/)
      .map((segment) => this.normalizeToken(segment))
      .filter(Boolean);
    for (const segment of segments) {
      aliases.add(segment);
    }

    if (normalized.includes('grosslivingarea')) {
      aliases.add('gla');
    }
    if (normalized === 'gla') {
      aliases.add('grosslivingarea');
    }
    if (normalized.includes('zipcode') || normalized === 'zip') {
      aliases.add('zipcode');
      aliases.add('zip');
    }
    if (normalized.includes('parcelid') || normalized === 'apn') {
      aliases.add('parcelid');
      aliases.add('apn');
    }
    if (normalized.includes('propertyaddress') || normalized.includes('streetaddress')) {
      aliases.add('propertyaddress');
      aliases.add('streetaddress');
      aliases.add('address');
    }

    return aliases;
  }

  private async waitForEvaluationCompletion(evaluationId: string): Promise<AxiomEvaluationResult | null> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < this.timeoutMs()) {
      const response = await this.dbService.getItem<AxiomEvaluationResult>(AI_INSIGHTS_CONTAINER, evaluationId);
      const evaluation = response.success ? response.data : undefined;
      if (evaluation && (evaluation.status === 'completed' || evaluation.status === 'failed')) {
        return evaluation;
      }
      await this.delay(this.pollIntervalMs());
    }
    return null;
  }

  private async publishRequestedEvent(context: ReevaluationContext, criterionId: string): Promise<void> {
    await this.publisher.publish({
      id: uuidv4(),
      type: 'qc.criterion.reevaluate.requested',
      timestamp: new Date(),
      source: 'criteria-reevaluation-handler',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId: context.orderId,
        tenantId: context.tenantId,
        criterionId,
        triggeringFieldName: context.triggeringFieldName,
        triggeringFieldNewValue: context.triggeringFieldNewValue,
        ...(context.triggeredBy ? { triggeredBy: context.triggeredBy } : {}),
        priority: EventPriority.NORMAL,
      },
    } as any);
  }

  private async publishReevaluatedEvent(args: {
    context: ReevaluationContext;
    criterionId: string;
    oldVerdict?: PublishableVerdict;
    newVerdict?: PublishableVerdict;
    changedFlag: boolean;
    evaluationId?: string;
    pipelineJobId?: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    await this.publisher.publish({
      id: uuidv4(),
      type: 'qc.criterion.reevaluated',
      timestamp: new Date(),
      source: 'criteria-reevaluation-handler',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId: args.context.orderId,
        tenantId: args.context.tenantId,
        criterionId: args.criterionId,
        oldVerdict: args.oldVerdict,
        ...(args.newVerdict !== undefined ? { newVerdict: args.newVerdict } : {}),
        changedFlag: args.changedFlag,
        triggeringFieldName: args.context.triggeringFieldName,
        triggeringFieldNewValue: args.context.triggeringFieldNewValue,
        ...(args.evaluationId ? { evaluationId: args.evaluationId } : {}),
        ...(args.pipelineJobId ? { pipelineJobId: args.pipelineJobId } : {}),
        ...(args.errorCode ? { errorCode: args.errorCode } : {}),
        ...(args.errorMessage ? { errorMessage: args.errorMessage } : {}),
        priority: args.newVerdict === 'fail' ? EventPriority.HIGH : EventPriority.NORMAL,
      },
    } as any);
  }

  private toVerdictMap(criteria: CriterionEvaluation[] = []): Map<string, CriterionEvaluation['evaluation']> {
    return new Map(criteria.map((criterion) => [criterion.criterionId, criterion.evaluation]));
  }

  private normalizeToken(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private requireString(value: string | undefined, message: string): string {
    if (!value || value.trim().length === 0) {
      throw new Error(message);
    }
    return value;
  }

  private pollIntervalMs(): number {
    const raw = process.env['QC_CRITERION_REEVAL_POLL_MS'];
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POLL_INTERVAL_MS;
  }

  private timeoutMs(): number {
    const raw = process.env['QC_CRITERION_REEVAL_TIMEOUT_MS'];
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}