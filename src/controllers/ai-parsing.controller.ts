import { Router, Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AiParserService } from '../services/ai-parser.service.js';
import { AiParseRequest } from '../types/ai-parser.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AiParsingController');

export function createAiParsingRouter(): Router {
  const router = Router();
  
  // We initialize lazily or inside the route to handle missing API keys gracefully at startup,
  // but for a singleton service, it's fine to instantiate here if we catch errors.
  let aiService: AiParserService | null = null;
  try {
    aiService = new AiParserService();
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

      const result = await aiService.parseIntent(requestBody);
      return res.json(result);
      
    } catch (error) {
      logger.error('Failed to parse intent via AI', { error });
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}
