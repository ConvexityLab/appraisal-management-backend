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
      logger.error('Error generating QB connect URL', error);
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
        qbService.setRealmId(realmId);
      }

      // Exchange the code for a token
      // intuit-oauth library expects the full parseable URL to extract the token
      const parseRedirect = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      await qbService.createToken(parseRedirect);

      // Print tokens for easy CLI copy pasting!
      const finalTokens = qbService.getTokens();
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
      logger.error('Error in QB Callback exchange', error);
      res.status(500).send('OAuth exchange failed. Check server logs.');
    }
  }

  /**
   * Check if we have an active QB connection.
   * Route: GET /api/v1/quickbooks/status
   */
  private status(req: Request, res: Response, next: NextFunction) {
    const qbService = QuickBooksOAuthService.getInstance();
    const tokens = qbService.getTokens();

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
}
