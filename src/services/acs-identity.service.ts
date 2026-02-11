/**
 * ACS Identity Service - Token Exchange for Chat Authentication
 * 
 * Manages Azure Communication Services user identities and tokens.
 * Uses DefaultAzureCredential for service-level access to ACS Identity API,
 * then generates user-scoped tokens for ACS Chat SDK.
 */

import { CommunicationIdentityClient } from '@azure/communication-identity';
import { DefaultAzureCredential } from '@azure/identity';
import { AzureKeyCredential } from '@azure/core-auth';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { ApiResponse } from '../types/index.js';

interface AcsUserMapping {
  id: string;
  azureAdUserId: string;
  acsUserId: string;
  createdAt: Date;
  lastTokenGeneratedAt?: Date;
}

interface AcsTokenResponse {
  acsUserId: string;
  token: string;
  expiresOn: Date;
}

export class AcsIdentityService {
  private logger: Logger;
  private dbService?: CosmosDbService;
  private identityClient?: CommunicationIdentityClient;
  private configured: boolean = false;

  constructor() {
    this.logger = new Logger();
    
    const endpoint = process.env.AZURE_COMMUNICATION_ENDPOINT;
    if (!endpoint) {
      this.logger.warn('AZURE_COMMUNICATION_ENDPOINT not configured - ACS Identity service unavailable');
      return;
    }

    // Initialize Cosmos DB service only if configured
    try {
      this.dbService = new CosmosDbService();
      this.logger.info('Cosmos DB initialized successfully for ACS Identity mappings');
    } catch (error) {
      this.logger.error('Failed to initialize Cosmos DB for ACS Identity service', { 
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
    }

    // For local development, prefer API key. For production, use Managed Identity.
    const apiKey = process.env.AZURE_COMMUNICATION_API_KEY;
    
    if (apiKey) {
      // Use API key if available (local development)
      this.logger.info('Initializing ACS with API key authentication');
      const keyCredential = new AzureKeyCredential(apiKey);
      this.identityClient = new CommunicationIdentityClient(endpoint, keyCredential);
      this.configured = true;
      this.logger.info('ACS Identity Service initialized with API key');
    } else {
      // Fall back to Managed Identity (production)
      try {
        this.logger.info('No API key found, attempting Managed Identity authentication');
        const credential = new DefaultAzureCredential();
        this.identityClient = new CommunicationIdentityClient(endpoint, credential);
        this.configured = true;
        this.logger.info('ACS Identity Service initialized with Managed Identity');
      } catch (error) {
        this.logger.error('Failed to initialize ACS with Managed Identity', { error });
        return;
      }
    }
  }

  /**
   * Exchange Azure AD user ID for ACS user identity + token
   * Creates new ACS identity if needed, otherwise reuses existing
   */
  async exchangeUserToken(azureAdUserId: string, tenantId: string): Promise<ApiResponse<AcsTokenResponse>> {
    try {
      // Check if service is properly configured
      if (!this.configured || !this.identityClient) {
        return {
          success: false,
          data: null as any,
          error: {
            code: 'ACS_NOT_CONFIGURED',
            message: 'Azure Communication Services not properly configured',
            timestamp: new Date()
          }
        };
      }

      // Check if user already has ACS identity mapping
      let mapping = await this.getUserMapping(azureAdUserId, tenantId);

      if (!mapping) {
        // Create new ACS user identity
        this.logger.info('Creating new ACS user identity', { azureAdUserId });
        const acsUserId = await this.createAcsUser();
        
        // Save mapping to Cosmos DB
        mapping = {
          id: `${azureAdUserId}-${tenantId}`,
          azureAdUserId,
          acsUserId,
          createdAt: new Date()
        };
        
        await this.saveUserMapping(mapping, tenantId);
      }

      // Generate fresh access token (24 hour expiry)
      // Include all available scopes for maximum flexibility
      this.logger.info('Generating ACS token', { acsUserId: mapping.acsUserId });
      const tokenResponse = await this.identityClient.getToken(
        { communicationUserId: mapping.acsUserId },
        ['chat', 'voip'] // All supported scopes: chat (messaging), voip (voice/video calls)
      );

      // Update last token generation time
      mapping.lastTokenGeneratedAt = new Date();
      await this.saveUserMapping(mapping, tenantId);

      return {
        success: true,
        data: {
          acsUserId: mapping.acsUserId,
          token: tokenResponse.token,
          expiresOn: tokenResponse.expiresOn
        }
      };
    } catch (error) {
      this.logger.error('Error exchanging user token', { error, azureAdUserId });
      throw error;
    }
  }

  /**
   * Create new ACS user identity
   */
  private async createAcsUser(): Promise<string> {
    try {
      if (!this.identityClient) {
        throw new Error('ACS Identity Client not initialized');
      }
      const userResponse = await this.identityClient.createUser();
      this.logger.info('ACS user created', { userId: userResponse.communicationUserId });
      return userResponse.communicationUserId;
    } catch (error) {
      this.logger.error('Error creating ACS user', { error });
      throw error;
    }
  }

  /**
   * Get existing user mapping from Cosmos DB
   */
  private async getUserMapping(azureAdUserId: string, tenantId: string): Promise<AcsUserMapping | null> {
    try {
      if (!this.dbService) {
        this.logger.warn('Cosmos DB not available - cannot retrieve user mapping');
        return null;
      }

      const query = `SELECT * FROM c WHERE c.azureAdUserId = @azureAdUserId`;
      const parameters = [{ name: '@azureAdUserId', value: azureAdUserId }];

      const result = await this.dbService.queryItems<AcsUserMapping>(
        'acsUserMappings',
        query,
        parameters
      );

      if (result.success && result.data && result.data.length > 0) {
        const mapping = result.data[0];
        return mapping || null;
      }

      return null;
    } catch (error) {
      this.logger.error('Error getting user mapping', { error, azureAdUserId });
      return null;
    }
  }

  /**
   * Save user mapping to Cosmos DB
   */
  private async saveUserMapping(mapping: AcsUserMapping, tenantId: string): Promise<void> {
    try {
      if (!this.dbService) {
        this.logger.warn('Cosmos DB not available - cannot save user mapping');
        return;
      }
      await this.dbService.upsertItem('acsUserMappings', mapping);
      this.logger.info('User mapping saved', { 
        azureAdUserId: mapping.azureAdUserId, 
        acsUserId: mapping.acsUserId 
      });
    } catch (error) {
      this.logger.error('Error saving user mapping', { error, mapping });
      // Don't throw - mapping save is not critical
    }
  }

  /**
   * Revoke ACS user identity (cleanup)
   */
  async revokeUserIdentity(azureAdUserId: string, tenantId: string): Promise<ApiResponse<void>> {
    try {
      const mapping = await this.getUserMapping(azureAdUserId, tenantId);
      
      if (!mapping) {
        return {
          success: false,
          data: null as any,
          error: { 
            code: 'MAPPING_NOT_FOUND', 
            message: 'User mapping not found', 
            timestamp: new Date() 
          }
        };
      }

      // Revoke tokens for ACS user
      if (!this.identityClient) {
        throw new Error('Identity client not initialized');
      }
      await this.identityClient.revokeTokens({ communicationUserId: mapping.acsUserId });

      // Delete user (optional - preserves chat history if you don't)
      if (!this.identityClient) {
        throw new Error('Identity client not initialized');
      }
      await this.identityClient.deleteUser({ communicationUserId: mapping.acsUserId });

      // Remove mapping from DB
      if (!this.dbService) {
        throw new Error('Database service not initialized');
      }
      await this.dbService.deleteItem('acsUserMappings', mapping.id, mapping.azureAdUserId);

      this.logger.info('User identity revoked', { azureAdUserId, acsUserId: mapping.acsUserId });

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('Error revoking user identity', { error, azureAdUserId });
      throw error;
    }
  }

  /**
   * Get ACS user ID for Azure AD user (without generating token)
   */
  async getAcsUserId(azureAdUserId: string, tenantId: string): Promise<string | null> {
    const mapping = await this.getUserMapping(azureAdUserId, tenantId);
    return mapping ? mapping.acsUserId : null;
  }

  /**
   * Check if ACS Identity service is properly configured
   */
  isConfigured(): boolean {
    return this.configured && !!this.identityClient;
  }
}
