/**
 * Internal E-Sign Controller
 *
 * Public (no auth required) endpoints used by vendors to review and sign
 * engagement letters via a one-time token link.
 *
 * Mounted at /api/esign by the API server.
 *
 * Routes:
 *   GET  /api/esign/letter/:token          — fetch letter content for display
 *   POST /api/esign/letter/:token/accept   — vendor accepts (signs)
 *   POST /api/esign/letter/:token/decline  — vendor declines
 */

import { Router, Request, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { InternalESignService } from '../services/internal-esign.service.js';

export class InternalESignController {
  public readonly router: Router;
  private readonly esignService: InternalESignService;

  constructor(dbService: CosmosDbService) {
    this.router = Router();
    this.esignService = new InternalESignService(dbService);
    this.initRoutes();
  }

  private initRoutes(): void {
    this.router.get('/letter/:token', this.getLetterForSigning.bind(this));
    this.router.post('/letter/:token/accept', this.acceptLetter.bind(this));
    this.router.post('/letter/:token/decline', this.declineLetter.bind(this));
  }

  /**
   * GET /api/esign/letter/:token
   * Returns the engagement letter content so the vendor can review it.
   * Returns 404 when the token is invalid, expired, or already used.
   */
  private async getLetterForSigning(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params as { token: string };
      if (!token) {
        res.status(400).json({ success: false, error: 'token is required' });
        return;
      }

      const ctx = await this.esignService.getSigningContext(token);
      if (!ctx) {
        res.status(404).json({
          success: false,
          error: 'This signing link is invalid, expired, or has already been used.',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          orderId: ctx.tokenRecord.orderId,
          orderNumber: ctx.tokenRecord.orderNumber,
          expiresAt: ctx.tokenRecord.expiresAt,
          letterContent: ctx.letterContent,
        },
      });
    } catch (err) {
      console.error('InternalESign getLetterForSigning error:', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve signing context.' });
    }
  }

  /**
   * POST /api/esign/letter/:token/accept
   * Body: {} (optional — future: `{ ipConfirm: true }`)
   */
  private async acceptLetter(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params as { token: string };
      const ipAddress = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        ?? req.socket.remoteAddress;

      const result = await this.esignService.acceptLetter(token, ipAddress);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.message });
        return;
      }
      res.json({ success: true, message: result.message });
    } catch (err) {
      console.error('InternalESign acceptLetter error:', err);
      res.status(500).json({ success: false, error: 'Failed to process signature.' });
    }
  }

  /**
   * POST /api/esign/letter/:token/decline
   * Body: { reason?: string }
   */
  private async declineLetter(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params as { token: string };
      const { reason } = req.body as { reason?: string };
      const ipAddress = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        ?? req.socket.remoteAddress;

      const result = await this.esignService.declineLetter(token, reason, ipAddress);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.message });
        return;
      }
      res.json({ success: true, message: result.message });
    } catch (err) {
      console.error('InternalESign declineLetter error:', err);
      res.status(500).json({ success: false, error: 'Failed to record decline.' });
    }
  }
}
