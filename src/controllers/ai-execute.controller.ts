import { Router, Response } from 'express';
import { z } from 'zod';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import {
  AiActionDispatchError,
  AiActionDispatcherService,
} from '../services/ai-action-dispatcher.service.js';
import { safeValidateAiIntentPayload } from '../validators/ai-intent-payloads.validator.js';
import {
  AI_EXECUTABLE_INTENTS,
  type AiExecutableIntent,
} from '../types/ai-parser.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AiExecuteController');

const aiPresentationFieldSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  status: z.enum(['added', 'changed', 'removed', 'unchanged']),
  warning: z.string().optional(),
});

const aiPresentationSchemaSchema = z.object({
  title: z.string(),
  summary: z.string(),
  fields: z.array(aiPresentationFieldSchema),
  actionButtonText: z.string(),
});

const aiExecuteRequestSchema = z.object({
  intent: z.enum(AI_EXECUTABLE_INTENTS),
  confidence: z.number().min(0).max(1),
  actionPayload: z.record(z.string(), z.unknown()),
  presentationSchema: aiPresentationSchemaSchema,
});

type AiExecuteRequest = z.infer<typeof aiExecuteRequestSchema>;

export interface AiExecuteContext {
  tenantId: string;
  userId: string;
}

export interface AiExecuteHandlerResult {
  message: string;
  data?: Record<string, unknown>;
}

export type AiExecuteHandler<K extends AiExecutableIntent> = (
  payload: AiExecuteRequest['actionPayload'],
  context: AiExecuteContext,
  request: AiExecuteRequest,
) => Promise<AiExecuteHandlerResult>;

export type AiExecuteHandlerMap = {
  [K in AiExecutableIntent]: AiExecuteHandler<K>;
};

export interface AiExecuteRouterOptions {
  handlers?: Partial<AiExecuteHandlerMap>;
  dispatcher?: AiActionDispatcherService;
  dbService?: CosmosDbService;
}

class AiExecuteNotImplementedError extends Error {
  constructor(intent: AiExecutableIntent) {
    super(`AI execute handler '${intent}' is not implemented yet`);
    this.name = 'AiExecuteNotImplementedError';
  }
}

function resolveExecutionContext(req: UnifiedAuthRequest): AiExecuteContext {
  const tenantId = (req.headers['x-tenant-id'] as string | undefined) ?? req.user?.tenantId;
  const userId = req.user?.id;

  if (!tenantId) {
    throw new Error('AI execute requires tenant context from auth token or x-tenant-id header');
  }
  if (!userId) {
    throw new Error('AI execute requires authenticated user id in auth token');
  }

  return { tenantId, userId };
}

function createDefaultHandler(intent: AiExecutableIntent): AiExecuteHandler<AiExecutableIntent> {
  return async () => {
    throw new AiExecuteNotImplementedError(intent);
  };
}

export function createAiExecuteRouter(options: AiExecuteRouterOptions = {}): Router {
  const router = Router();
  const dispatcher = options.dispatcher ??
    (options.dbService ? new AiActionDispatcherService(options.dbService) : undefined);

  const handlerMap: AiExecuteHandlerMap = {
    CREATE_ORDER: options.handlers?.CREATE_ORDER ??
      (dispatcher
        ? (payload, context) => dispatcher.handleCreateOrder(payload, context)
        : createDefaultHandler('CREATE_ORDER')),
    CREATE_ENGAGEMENT:
      options.handlers?.CREATE_ENGAGEMENT ??
      (dispatcher
        ? (payload, context) => dispatcher.handleCreateEngagement(payload, context)
        : createDefaultHandler('CREATE_ENGAGEMENT')),
    ASSIGN_VENDOR: options.handlers?.ASSIGN_VENDOR ??
      (dispatcher
        ? (payload, context) => dispatcher.handleAssignVendor(payload, context)
        : createDefaultHandler('ASSIGN_VENDOR')),
    TRIGGER_AUTO_ASSIGNMENT:
      options.handlers?.TRIGGER_AUTO_ASSIGNMENT ??
      (dispatcher
        ? (payload, context) => dispatcher.handleTriggerAutoAssignment(payload, context)
        : createDefaultHandler('TRIGGER_AUTO_ASSIGNMENT')),
  };

  router.post('/execute', async (req: UnifiedAuthRequest, res: Response) => {
    const parsed = aiExecuteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid AI execute payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    try {
      const executionContext = resolveExecutionContext(req);
      const requestBody = parsed.data;
      const payloadValidation = safeValidateAiIntentPayload(
        requestBody.intent,
        requestBody.actionPayload,
      );
      if (!payloadValidation.success) {
        return res.status(400).json({
          success: false,
          error: `Invalid AI intent payload for ${requestBody.intent}`,
          issues: payloadValidation.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      const handler = handlerMap[requestBody.intent];
      const result = await handler(payloadValidation.data, executionContext, requestBody);

      return res.status(200).json({
        success: true,
        intent: requestBody.intent,
        data: result.data ?? null,
        message: result.message,
        schemaVersion: 'v1',
      });
    } catch (error) {
      if (error instanceof AiExecuteNotImplementedError) {
        return res.status(501).json({ success: false, error: error.message });
      }
      if (error instanceof AiActionDispatchError) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }

      const message = error instanceof Error ? error.message : 'Failed to execute AI intent';
      const status = message.includes('requires ') ? 401 : 500;
      logger.error('AI execute request failed', {
        error: message,
        intent: parsed.data.intent,
      });
      return res.status(status).json({ success: false, error: message });
    }
  });

  return router;
}