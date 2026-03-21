import express, { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
const logger = new Logger('QuickBooksController');
import { QuickBooksOAuthService } from '../services/quickbooks-oauth.service.js';
import { QuickBooksService } from '../services/quickbooks.service.js';

/**
 * Controller for QuickBooks OAuth & Integration
 */
export class QuickBooksController {
  
  public getRouter(): express.Router {
    const router = express.Router();
    
    // Mount the OAuth routes
    router.get('/auth/connect', this.connect.bind(this));
    router.get('/auth/callback', this.callback.bind(this));
    
    // Status endpoint
    router.get('/status', this.status.bind(this));
    
    // Core Data endpoints
    router.get('/company', this.getCompany.bind(this));
    router.get('/summary', this.getSummary.bind(this));

    // Webhooks endpoint
    router.post('/webhook', express.raw({ type: 'application/json' }), this.webhook.bind(this));

    return router;
  }

  /**
   * Generates the Auth URL and redirects the user to Intuit.
   * Route: GET /api/v1/quickbooks/auth/connect
   */
  private connect(req: Request, res: Response, next: NextFunction) {
    try {
      const qbService = QuickBooksOAuthService.getInstance();
      const authUri = qbService.getAuthorizationUrl();
      
      logger.info('Redirecting to QuickBooks for OAuth', { authUri });
      res.redirect(authUri);
    } catch (error) {
      logger.error('Error generating QB connect URL', error as Error);
      res.status(500).json({ error: 'Failed to generate QuickBooks authorization URL.' });
    }
  }

  /**
   * Intuit redirects back here with `code` and `realmId` (company ID).
   * Route: GET /api/v1/quickbooks/auth/callback
   */
  private async callback(req: Request, res: Response, next: NextFunction) {
    try {
      const qbService = QuickBooksOAuthService.getInstance();
      
      // Store the realmId (This is the specific QuickBooks Company ID we just linked to)
      const realmId = req.query.realmId as string;
      if (realmId) {
        await qbService.setRealmId(realmId);
      }

      // Exchange the code for a token
      // intuit-oauth library expects the full parseable URL to extract the token
      const parseRedirect = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      await qbService.createToken(parseRedirect);

      // Print tokens for easy CLI copy pasting!
      const finalTokens = await qbService.getTokens();
      console.log('\n\n======================================================');
      console.log('✅ QuickBooks OAuth Tokens Captured!');
      console.log('======================================================');
      console.log(`REALM_ID: ${finalTokens.realmId}`);
      console.log(`ACCESS_TOKEN: ${finalTokens.accessToken}`);
      console.log('======================================================\n\n');

      // In a real scenario, we'd save these tokens to the DB here.
      // For now, redirect back to the Front-End UI
      const feRedirect = process.env.FRONTEND_APP_URL || 'http://localhost:3010';
      
      res.redirect(`${feRedirect}/accounting`);
    } catch (error) {
      logger.error('Error in QB Callback exchange', error as Error);
      res.status(500).send('OAuth exchange failed. Check server logs.');
    }
  }

  /**
   * Check if we have an active QB connection.
   * Route: GET /api/v1/quickbooks/status
   */
  private async status(req: Request, res: Response, next: NextFunction) {
    const qbService = QuickBooksOAuthService.getInstance();
    const tokens = await qbService.getTokens();

    if (tokens.accessToken && tokens.realmId) {
      res.json({
        connected: true,
        realmId: tokens.realmId,
        message: 'Successfully connected to QuickBooks',
      });
    } else {
      res.json({
        connected: false,
        message: 'QuickBooks is not connected.',
      });
    }
  }

  /**
   * Get basic company info from QuickBooks.
   * Route: GET /api/v1/quickbooks/company
   */
  private async getCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const qbOperations = new QuickBooksService();
      const companyInfo = await qbOperations.getCompanyInfo();
      res.json(companyInfo);
    } catch (error: any) {
      logger.error('Failed to retrieve QuickBooks company info', error);
      res.status(500).json({ error: error.message || 'Error fetching company info' });
    }
  }

  /**
   * Get AR/AP Summary for the dashboard.
   * Route: GET /api/v1/quickbooks/summary
   */
  private async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const qbOperations = new QuickBooksService();
      const summary = await qbOperations.getSummary();
      res.json(summary);
    } catch (error: any) {
      logger.error('Failed to retrieve QuickBooks summary', error);
      res.status(500).json({ error: error.message || 'Error fetching summary' });
    }
  }

  /**
   * Intuit Webhook Endpoint
   * Used for bidirectional syncing (e.g. knowing when a Client pays an AR Invoice or Vendor is Paid)
   * Route: POST /api/v1/quickbooks/webhook
   */
  private async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const webhookPayload = req.body.toString();
      const intuitSignature = req.headers['intuit-signature'];
      
      logger.info('Received QuickBooks Webhook', { signature: intuitSignature, body: webhookPayload });

      // @ts-ignore - To parse it back to JSON
      const body = JSON.parse(webhookPayload);

      // Verify the signature against process.env.QUICKBOOKS_WEBHOOK_TOKEN
      const crypto = await import('crypto');
      const webhookToken = process.env.QUICKBOOKS_WEBHOOK_TOKEN;
      
      if (webhookToken && intuitSignature) {
        const hash = crypto.createHmac('sha256', webhookToken).update(webhookPayload).digest('base64');
        if (hash !== intuitSignature) {
          logger.warn('QuickBooks Webhook Signature mismatch', { expected: hash, received: intuitSignature });
          // Still returning 200 to Acknowledge to Intuit
          res.status(200).send('Signature mismatch');
          return;
        }
      }

      const qbOperations = new QuickBooksService();
      
      // Process events
      if (body.eventNotifications && Array.isArray(body.eventNotifications)) {
        for (const notif of body.eventNotifications) {
          if (notif.dataChangeEvent && Array.isArray(notif.dataChangeEvent.entities)) {
            for (const entity of notif.dataChangeEvent.entities) {
              const { name, id, operation } = entity;
              logger.info(`QB Webhook Entity Update: ${name} [${id}] - ${operation}`);
              
              if ((name === 'Invoice' || name === 'Bill') && operation === 'Update') {
                // We should ideally sync the status back
                // This is a Fire-and-forget sync to not hold up the webhook acknowledgement
                qbOperations.syncStatusFromQuickbooks(name, id).catch((err: any) => {
                  logger.error(`Failed to sync ${name} ${id} from QuickBooks Webhook`, err);
                });
              }
            }
          }
        }
      }

      res.status(200).send('Acknowledged');
    } catch (error: any) {
      logger.error('Error processing QuickBooks Webhook', error);
      res.status(500).json({ error: error.message || 'Error processing webhook' });
    }
  }
}
