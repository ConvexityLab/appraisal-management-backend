/**
 * User Profile Management Service
 * 
 * Syncs Azure AD users to Cosmos DB and manages access scope attributes
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { UserProfile, AccessScope } from '../types/authorization.types.js';

export interface CreateUserProfileRequest {
  email: string;
  name: string;
  azureAdObjectId: string;
  role: string;
  tenantId: string;
  accessScope?: Partial<AccessScope>;
}

export interface UpdateAccessScopeRequest {
  teamIds?: string[];
  departmentIds?: string[];
  managedClientIds?: string[];
  managedVendorIds?: string[];
  managedUserIds?: string[];
  regionIds?: string[];
  statesCovered?: string[];
  canViewAllOrders?: boolean;
  canViewAllVendors?: boolean;
  canOverrideQC?: boolean;
}

export class UserProfileService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private readonly CONTAINER_NAME = 'users';

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Create or update user profile from Azure AD
   */
  async syncUserProfile(request: CreateUserProfileRequest): Promise<UserProfile> {
    try {
      const userId = this.generateUserId(request.email);
      
      // Check if profile exists
      const existing = await this.dbService.getDocument<UserProfile>(
        this.CONTAINER_NAME,
        userId,
        request.tenantId
      );

      const defaultAccessScope: AccessScope = {
        teamIds: [],
        departmentIds: [],
        managedClientIds: [],
        managedVendorIds: [],
        managedUserIds: [],
        regionIds: [],
        statesCovered: [],
        canViewAllOrders: false,
        canViewAllVendors: false,
        canOverrideQC: false
      };

      const profile: UserProfile = {
        id: userId,
        email: request.email,
        name: request.name,
        azureAdObjectId: request.azureAdObjectId,
        tenantId: request.tenantId,
        role: request.role,
        accessScope: existing?.accessScope || { ...defaultAccessScope, ...request.accessScope },
        isActive: existing?.isActive !== false,
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await this.dbService.upsertDocument(this.CONTAINER_NAME, profile);

      this.logger.info('User profile synced', {
        userId,
        email: request.email,
        role: request.role,
        isNew: !existing
      });

      return profile;
    } catch (error) {
      this.logger.error('Failed to sync user profile', { request, error });
      throw error;
    }
  }

  /**
   * Update user's access scope attributes
   */
  async updateAccessScope(
    userId: string,
    tenantId: string,
    updates: UpdateAccessScopeRequest
  ): Promise<UserProfile | null> {
    try {
      const profile = await this.dbService.getDocument<UserProfile>(
        this.CONTAINER_NAME,
        userId,
        tenantId
      );

      if (!profile) {
        this.logger.warn('User profile not found', { userId, tenantId });
        return null;
      }

      // Merge updates into existing scope
      profile.accessScope = {
        ...profile.accessScope,
        ...updates
      };
      profile.updatedAt = new Date();

      await this.dbService.upsertDocument(this.CONTAINER_NAME, profile);

      this.logger.info('Access scope updated', { userId, updates });

      return profile;
    } catch (error) {
      this.logger.error('Failed to update access scope', { userId, tenantId, error });
      throw error;
    }
  }

  /**
   * Add user to team
   */
  async addToTeam(userId: string, teamId: string, tenantId: string): Promise<UserProfile | null> {
    try {
      const profile = await this.dbService.getDocument<UserProfile>(
        this.CONTAINER_NAME,
        userId,
        tenantId
      );

      if (!profile) {
        return null;
      }

      if (!profile.accessScope.teamIds.includes(teamId)) {
        profile.accessScope.teamIds.push(teamId);
        profile.updatedAt = new Date();
        await this.dbService.upsertDocument(this.CONTAINER_NAME, profile);
        
        this.logger.info('User added to team', { userId, teamId });
      }

      return profile;
    } catch (error) {
      this.logger.error('Failed to add user to team', { userId, teamId, error });
      throw error;
    }
  }

  /**
   * Remove user from team
   */
  async removeFromTeam(userId: string, teamId: string, tenantId: string): Promise<UserProfile | null> {
    try {
      const profile = await this.dbService.getDocument<UserProfile>(
        this.CONTAINER_NAME,
        userId,
        tenantId
      );

      if (!profile) {
        return null;
      }

      profile.accessScope.teamIds = profile.accessScope.teamIds.filter(id => id !== teamId);
      profile.updatedAt = new Date();
      await this.dbService.upsertDocument(this.CONTAINER_NAME, profile);

      this.logger.info('User removed from team', { userId, teamId });

      return profile;
    } catch (error) {
      this.logger.error('Failed to remove user from team', { userId, teamId, error });
      throw error;
    }
  }

  /**
   * Assign client management to user
   */
  async assignClientManagement(
    userId: string,
    clientIds: string[],
    tenantId: string
  ): Promise<UserProfile | null> {
    try {
      const profile = await this.dbService.getDocument<UserProfile>(
        this.CONTAINER_NAME,
        userId,
        tenantId
      );

      if (!profile) {
        return null;
      }

      profile.accessScope.managedClientIds = [
        ...(profile.accessScope.managedClientIds || []),
        ...clientIds.filter(id => !profile.accessScope.managedClientIds?.includes(id))
      ];
      profile.updatedAt = new Date();

      await this.dbService.upsertDocument(this.CONTAINER_NAME, profile);

      this.logger.info('Client management assigned', { userId, clientIds });

      return profile;
    } catch (error) {
      this.logger.error('Failed to assign client management', { userId, clientIds, error });
      throw error;
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string, tenantId: string): Promise<UserProfile | null> {
    try {
      return await this.dbService.getDocument<UserProfile>(
        this.CONTAINER_NAME,
        userId,
        tenantId
      );
    } catch (error) {
      this.logger.error('Failed to get user profile', { userId, tenantId, error });
      return null;
    }
  }

  /**
   * Get user profile by email
   */
  async getUserProfileByEmail(email: string, tenantId: string): Promise<UserProfile | null> {
    try {
      const userId = this.generateUserId(email);
      return await this.getUserProfile(userId, tenantId);
    } catch (error) {
      this.logger.error('Failed to get user profile by email', { email, tenantId, error });
      return null;
    }
  }

  /**
   * Get user profile by Azure AD object ID
   */
  async getUserProfileByAzureId(azureAdObjectId: string, tenantId: string): Promise<UserProfile | null> {
    try {
      const query = `
        SELECT * FROM c 
        WHERE c.azureAdObjectId = @azureAdObjectId
        AND c.tenantId = @tenantId
      `;

      const parameters = [
        { name: '@azureAdObjectId', value: azureAdObjectId },
        { name: '@tenantId', value: tenantId }
      ];

      const results = await this.dbService.queryDocuments<UserProfile>(
        this.CONTAINER_NAME,
        query,
        parameters
      );

      return (results.length > 0 ? results[0] : null) as UserProfile | null;
    } catch (error) {
      this.logger.error('Failed to get user profile by Azure ID', { azureAdObjectId, tenantId, error });
      return null;
    }
  }

  /**
   * List all users in a tenant
   */
  async listUsers(tenantId: string, filters?: {
    role?: string;
    isActive?: boolean;
    teamId?: string;
  }): Promise<UserProfile[]> {
    try {
      let query = 'SELECT * FROM c WHERE c.tenantId = @tenantId';
      const parameters: Array<{ name: string; value: any }> = [
        { name: '@tenantId', value: tenantId }
      ];

      if (filters?.role) {
        query += ' AND c.role = @role';
        parameters.push({ name: '@role', value: filters.role });
      }

      if (filters?.isActive !== undefined) {
        query += ' AND c.isActive = @isActive';
        parameters.push({ name: '@isActive', value: filters.isActive });
      }

      if (filters?.teamId) {
        query += ' AND ARRAY_CONTAINS(c.accessScope.teamIds, @teamId)';
        parameters.push({ name: '@teamId', value: filters.teamId });
      }

      query += ' ORDER BY c.name ASC';

      return await this.dbService.queryDocuments<UserProfile>(
        this.CONTAINER_NAME,
        query,
        parameters
      );
    } catch (error) {
      this.logger.error('Failed to list users', { tenantId, filters, error });
      return [];
    }
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: string, tenantId: string): Promise<UserProfile | null> {
    try {
      const profile = await this.dbService.getDocument<UserProfile>(
        this.CONTAINER_NAME,
        userId,
        tenantId
      );

      if (!profile) {
        return null;
      }

      profile.isActive = false;
      profile.updatedAt = new Date();

      await this.dbService.upsertDocument(this.CONTAINER_NAME, profile);

      this.logger.info('User deactivated', { userId });

      return profile;
    } catch (error) {
      this.logger.error('Failed to deactivate user', { userId, tenantId, error });
      throw error;
    }
  }

  /**
   * Reactivate user
   */
  async reactivateUser(userId: string, tenantId: string): Promise<UserProfile | null> {
    try {
      const profile = await this.dbService.getDocument<UserProfile>(
        this.CONTAINER_NAME,
        userId,
        tenantId
      );

      if (!profile) {
        return null;
      }

      profile.isActive = true;
      profile.updatedAt = new Date();

      await this.dbService.upsertDocument(this.CONTAINER_NAME, profile);

      this.logger.info('User reactivated', { userId });

      return profile;
    } catch (error) {
      this.logger.error('Failed to reactivate user', { userId, tenantId, error });
      throw error;
    }
  }

  /**
   * Generate consistent user ID from email
   */
  private generateUserId(email: string): string {
    return `user_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
}
