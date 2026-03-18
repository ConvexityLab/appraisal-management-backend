import OAuthClient from 'intuit-oauth';
import { Logger } from '../utils/logger.js';
const logger = new Logger('QuickBooksOAuthService');
import dotenv from 'dotenv';
dotenv.config();

/**
 * Service to manage QuickBooks OAuth2 authentication flow.
 */
export class QuickBooksOAuthService {
  private static instance: QuickBooksOAuthService;
  private oauthClient: OAuthClient;
  
  // Temporary in-memory token store for testing (in prod this should go to Cosmos)
  private tokens: {
    accessToken?: string;
    refreshToken?: string;
    realmId?: string;
  } = {};

  private constructor() {
    this.oauthClient = new OAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
      environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:8080/api/v1/quickbooks/auth/callback',
    });
  }

  public static getInstance(): QuickBooksOAuthService {
    if (!QuickBooksOAuthService.instance) {
      QuickBooksOAuthService.instance = new QuickBooksOAuthService();
    }
    return QuickBooksOAuthService.instance;
  }

  /**
   * Generates the URL the user must navigate to in order to authorize the app.
   */
  public getAuthorizationUrl(): string {
    const authUri = this.oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.Payment],
      state: 'l1-valuation-quickbooks-auth'
    });
    logger.info('QuickBooks generation auth URI', { authUri });
    return authUri;
  }

  /**
   * Exchanges the callback auth code for an access token.
   */
  public async createToken(url: string): Promise<any> {
    try {
      const authResponse = await this.oauthClient.createToken(url);
      
      const tokenObj = authResponse.getJson();
      this.tokens = {
        ...this.tokens,
        accessToken: tokenObj.access_token,
        refreshToken: tokenObj.refresh_token,
      };

      logger.info('QuickBooks tokens acquired successfully');
      return tokenObj;
    } catch (e: any) {
      logger.error('Failed to create QuickBooks token', e);
      throw e;
    }
  }

  /**
   * Refresh the access token using the refresh token.
   */
  public async refreshAuthToken(): Promise<any> {
    try {
      const authResponse = await this.oauthClient.refresh();
      const tokenObj = authResponse.getJson();
      
      this.tokens.accessToken = tokenObj.access_token;
      this.tokens.refreshToken = tokenObj.refresh_token;

      logger.info('QuickBooks tokens refreshed successfully');
      return tokenObj;
    } catch (e: any) {
      logger.error('Failed to refresh QuickBooks token', e);
      throw e;
    }
  }

  public setRealmId(realmId: string) {
    this.tokens.realmId = realmId;
    logger.info('QuickBooks RealmId set', { realmId });
  }

  public getTokens() {
    return this.tokens;
  }

  public getClient(): OAuthClient {
    return this.oauthClient;
  }
}
