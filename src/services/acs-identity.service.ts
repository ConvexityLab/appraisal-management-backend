/**
 * ACS Identity Service - Token Exchange for Chat Authentication
 * 
 * Manages Azure Communication Services user identities and tokens.
 * Uses DefaultAzureCredential for service-level access to ACS Identity API,
 * then generates user-scoped tokens for ACS Chat SDK.
 */

import { CommunicationIdentityClient } from '@azure/communication-identity';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../utils/logger';
import { CosmosDbService } from './cosmos-db.service';
import { ApiResponse } from '../types/index';

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
  private dbService: CosmosDbService;
  private identityClient: CommunicationIdentityClient;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();

    const endpoint = process.env.AZURE_COMMUNICATION_ENDPOINT;
    if (!endpoint) {
      throw new Error('AZURE_COMMUNICATION_ENDPOINT not configured');
    }

    // Use Managed Identity to access ACS Identity API
    const credential = new DefaultAzureCredential();
    this.identityClient = new CommunicationIdentityClient(endpoint, credential);
    
    this.logger.info('ACS Identity Service initialized with Managed Identity');
  }

  /**
   * Exchange Azure AD user ID for ACS user identity + token
   * Creates new ACS identity if needed, otherwise reuses existing
   */
  async exchangeUserToken(azureAdUserId: string, tenantId: string): Promise<ApiResponse<AcsTokenResponse>> {
    try {
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
      this.logger.info('Generating ACS token', { acsUserId: mapping.acsUserId });
      const tokenResponse = await this.identityClient.getToken(
        { communicationUserId: mapping.acsUserId },
        ['chat'] // Scope: chat only
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
      await this.dbService.upsertItem('acsUserMappings', mapping);
      this.logger.info('User mapping saved', { 
        azureAdUserId: mapping.azureAdUserId, 
        acsUserId: mapping.acsUserId 
      });
    } catch (error) {
      this.logger.error('Error saving user mapping', { error, mapping });
      throw error;
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
      await this.identityClient.revokeTokens({ communicationUserId: mapping.acsUserId });

      // Delete user (optional - preserves chat history if you don't)
      await this.identityClient.deleteUser({ communicationUserId: mapping.acsUserId });

      // Remove mapping from DB
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
    return !!process.env.AZURE_COMMUNICATION_ENDPOINT;
  }
}
