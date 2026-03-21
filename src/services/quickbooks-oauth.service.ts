// @ts-ignore
import OAuthClient from 'intuit-oauth';
import { Logger } from '../utils/logger.js';
const logger = new Logger('QuickBooksOAuthService');
import dotenv from 'dotenv';
import { CosmosDbService } from './cosmos-db.service.js';
dotenv.config();

export interface QuickBooksTokenData {
  id: string;
  tenantId: string;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  realmId?: string | undefined;
  updatedAt: string;
}

export class QuickBooksOAuthService {
  private static instance: QuickBooksOAuthService;
  private oauthClient: OAuthClient;
  private dbService: CosmosDbService;

  private readonly TENANT_ID = 'system';
  private readonly DOC_ID = 'quickbooks-system';

  private tokens: {
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    realmId?: string | undefined;
  } = {};

  private constructor() {
    this.dbService = new CosmosDbService();
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

  private async loadTokensFromDb(): Promise<void> {
    try {
      const doc = await this.dbService.getDocument<QuickBooksTokenData>('integrations', this.DOC_ID, this.TENANT_ID);
      if (doc) {
        this.tokens = {
          accessToken: doc.accessToken,
          refreshToken: doc.refreshToken,
          realmId: doc.realmId
        };
        this.oauthClient.setToken({
          access_token: doc.accessToken,
          refresh_token: doc.refreshToken
        });
      }
    } catch (error: any) {
      logger.error('Failed to load QuickBooks tokens from DB', error);
    }
  }

  private async saveTokensToDb(): Promise<void> {
    try {
      const doc: QuickBooksTokenData = {
        id: this.DOC_ID,
        tenantId: this.TENANT_ID,
        accessToken: this.tokens.accessToken,
        refreshToken: this.tokens.refreshToken,
        realmId: this.tokens.realmId,
        updatedAt: new Date().toISOString()
      };
      await this.dbService.upsertDocument('integrations', doc);
    } catch (error: any) {
      logger.error('Failed to save QuickBooks tokens to DB', error);
    }
  }

  public getAuthorizationUrl(): string {
    const authUri = this.oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.Payment],
      state: 'l1-valuation-quickbooks-auth'
    });
    logger.info('QuickBooks generation auth URI', { authUri });
    return authUri;
  }

  public async createToken(url: string): Promise<any> {
    try {
      const authResponse = await this.oauthClient.createToken(url);
      const tokenObj = authResponse.getJson();
      this.tokens = {
        ...this.tokens,
        accessToken: tokenObj.access_token,
        refreshToken: tokenObj.refresh_token,
      };
      await this.saveTokensToDb();
      logger.info('QuickBooks tokens acquired and saved successfully');
      return tokenObj;
    } catch (e: any) {
      logger.error('Failed to create QuickBooks token', e);
      throw e;
    }
  }

  public async refreshAuthToken(): Promise<any> {
    try {
      // First ensure we have the latest tokens if missing
      if (!this.tokens.refreshToken) {
         await this.loadTokensFromDb();
      }
      const authResponse = await this.oauthClient.refresh();
      const tokenObj = authResponse.getJson();
      this.tokens.accessToken = tokenObj.access_token;
      this.tokens.refreshToken = tokenObj.refresh_token;
      await this.saveTokensToDb();
      logger.info('QuickBooks tokens refreshed and saved successfully');
      return tokenObj;
    } catch (e: any) {
      logger.error('Failed to refresh QuickBooks token', e);
      throw e;
    }
  }

  public async setRealmId(realmId: string) {
    this.tokens.realmId = realmId;
    await this.saveTokensToDb();
    logger.info('QuickBooks RealmId set and saved', { realmId });
  }

  public async getTokens() {
    if (!this.tokens.accessToken) {
      await this.loadTokensFromDb();
    }
    return this.tokens;
  }

  public async getClientInitialized(): Promise<any> {
    if (!this.tokens.accessToken) {
      await this.loadTokensFromDb();
    }
    
    // Check if the current token is about to expire, or is invalid
    if (this.tokens.accessToken && !this.oauthClient.isAccessTokenValid()) {
      logger.info('Access token is invalid or expired. Attempting refresh...');
      await this.refreshAuthToken();
    }
    
    return this.oauthClient;
  }

  public getClient(): any {
    return this.oauthClient;
  }
}
