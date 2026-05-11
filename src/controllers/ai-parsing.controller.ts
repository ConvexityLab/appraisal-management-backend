import { Router, Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AiParserService } from '../services/ai-parser.service.js';
import { AiParseRequest } from '../types/ai-parser.types.js';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';

const logger = new Logger('AiParsingController');

export function createAiParsingRouter(cosmos?: CosmosDbService): Router {
  const router = Router();

  // We initialize lazily or inside the route to handle missing API keys gracefully at startup,
  // but for a singleton service, it's fine to instantiate here if we catch errors.
  let aiService: AiParserService | null = null;
  try {
    aiService = new AiParserService(cosmos);
  } catch (err: any) {
    logger.warn(`AI Parser Service disabled: ${err.message}`);
  }

  /** POST /api/ai/parse-intent */
  router.post('/parse-intent', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      if (!aiService) {
        return res.status(503).json({ error: "AI Parsing is not enabled. Missing OPENAI_API_KEY." });
      }

      const requestBody = req.body as AiParseRequest;
      if (!requestBody || !requestBody.text) {
        return res.status(400).json({ error: "Missing 'text' in request body." });
      }

      // Phase 17b token-meter: pass authenticated tenant + user so the
      // parser can write an LLM usage audit row.  Never trust the
      // request body for these values.  Built conditionally so optional
      // fields are OMITTED rather than `undefined` (strict optionals).
      const authContext: Parameters<typeof aiService.parseIntent>[1] = {};
      if (req.user?.tenantId) authContext.tenantId = req.user.tenantId;
      if (req.user?.id) authContext.userId = req.user.id;
      if (typeof requestBody.context?.conversationId === 'string') {
        authContext.conversationId = requestBody.context.conversationId;
      }

      const result = await aiService.parseIntent(requestBody, authContext);
      // Phase 8 / A7: stamp schemaVersion so the frontend can assert
      // stability.  Bumping this value is a coordinated contract change
      // — the frontend's Zod schemas refuse any version it doesn't
      // recognise and surface an AiContractError naming the drift.
      return res.json({ ...result, schemaVersion: 'v1' });

    } catch (error) {
      logger.error('Failed to parse intent via AI', { error });
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}
