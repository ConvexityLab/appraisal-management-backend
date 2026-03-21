import { Logger } from '../utils/logger.js';
import { QuickBooksOAuthService } from '../services/quickbooks-oauth.service.js';


export class QuickBooksTokenRefreshJob {
  private logger: Logger;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private readonly checkIntervalMs = 45 * 60 * 1000; // 45 minutes

  constructor() {
    this.logger = new Logger('QuickBooksTokenRefreshJob');
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.info('Starting QuickBooks Token Refresh Job scheduler');

    // Run first immediately
    this.execute().catch(e => this.logger.error('Initial QB refresh failed', e));

    this.intervalId = setInterval(() => {
      this.execute().catch(e => this.logger.error('Scheduled QB refresh failed', e));
    }, this.checkIntervalMs);
  }

  public stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isRunning = false;
    this.logger.info('QuickBooks Token Refresh Job stopped');
  }

  public async execute(): Promise<void> {
    const qbService = QuickBooksOAuthService.getInstance();
    
    try {
      const tokens = await qbService.getTokens();
      
      // If we don't have a refresh token, it means the user has never authorized
      if (!tokens.refreshToken) {
        this.logger.info('No QuickBooks refresh token found. Skipping background refresh. User must authenticate via UI.');
        return;
      }
      
      this.logger.info('Attempting background refresh of QuickBooks tokens...');
      await qbService.refreshAuthToken();
      this.logger.info('Background refresh of QuickBooks tokens successful.');
      
    } catch (error: any) {
      this.logger.error('Failed to refresh QuickBooks OAuth token', error);
    }
  }
}
