/**
 * Access Graph Service
 * 
 * Graph-based access control for exception-based permissions
 * Models relationships as: Entity -> [Actions] -> Object
 */

import { Logger } from '../utils/logger';
import { CosmosDbService } from './cosmos-db.service';
import {
  AccessRelationship,
  AccessEntity,
  AccessPath,
  AccessGraph
} from '../types/authorization.types';

export interface GrantAccessRequest {
  entityType: 'user' | 'role' | 'group' | 'team';
  entityId: string;
  entityName?: string;
  objectType: string;
  objectId: string;
  objectName?: string;
  actions: string[];
  grantedBy: string;
  grantedByName?: string;
  reason?: string;
  expiresAt?: Date;
  conditions?: {
    timeWindow?: {
      startTime?: string;
      endTime?: string;
    };
    ipRestrictions?: string[];
    requiresMFA?: boolean;
  };
  tenantId: string;
}

export class AccessGraphService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private readonly CONTAINER_NAME = 'access_relationships';

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Grant access by creating a relationship in the access graph
   */
  async grantAccess(request: GrantAccessRequest): Promise<AccessRelationship> {
    try {
      const relationship: AccessRelationship = {
        id: this.generateRelationshipId(request.entityType, request.entityId, request.objectType, request.objectId),
        ...request,
        grantedAt: new Date(),
        useCount: 0
      };

      this.logger.info('Creating access relationship', {
        entityType: request.entityType,
        entityId: request.entityId,
        objectType: request.objectType,
        objectId: request.objectId,
        actions: request.actions
      });

      await this.dbService.upsertDocument(this.CONTAINER_NAME, relationship);

      return relationship;
    } catch (error) {
      this.logger.error('Failed to grant access', { request, error });
      throw error;
    }
  }

  /**
   * Revoke access by removing a relationship
   */
  async revokeAccess(
    entityType: string,
    entityId: string,
    objectType: string,
    objectId: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const relationshipId = this.generateRelationshipId(entityType, entityId, objectType, objectId);

      this.logger.info('Revoking access relationship', {
        entityType,
        entityId,
        objectType,
        objectId,
        relationshipId
      });

      await this.dbService.deleteDocument(this.CONTAINER_NAME, relationshipId, tenantId);

      return true;
    } catch (error) {
      this.logger.error('Failed to revoke access', {
        entityType,
        entityId,
        objectType,
        objectId,
        error
      });
      return false;
    }
  }

  /**
   * Check if an entity can perform an action on an object
   * Returns the matching relationship if allowed
   */
  async canAccess(
    entityType: string,
    entityId: string,
    objectType: string,
    objectId: string,
    action: string,
    tenantId: string,
    context?: { ipAddress?: string; timestamp?: Date }
  ): Promise<AccessRelationship | null> {
    try {
      const query = `
        SELECT * FROM c 
        WHERE c.entityType = @entityType
        AND c.entityId = @entityId
        AND c.objectType = @objectType
        AND c.objectId = @objectId
        AND ARRAY_CONTAINS(c.actions, @action)
        AND c.tenantId = @tenantId
        AND (c.expiresAt IS NULL OR c.expiresAt > @now)
      `;

      const parameters = [
        { name: '@entityType', value: entityType },
        { name: '@entityId', value: entityId },
        { name: '@objectType', value: objectType },
        { name: '@objectId', value: objectId },
        { name: '@action', value: action },
        { name: '@tenantId', value: tenantId },
        { name: '@now', value: new Date().toISOString() }
      ];

      const results = await this.dbService.queryDocuments<AccessRelationship>(
        this.CONTAINER_NAME,
        query,
        parameters
      );

      if (results.length === 0) {
        return null;
      }

      const relationship = results[0];

      if (!relationship) {
        return null;
      }

      // Check additional conditions if present
      if (relationship.conditions) {
        if (!this.checkConditions(relationship.conditions, context)) {
          return null;
        }
      }

      // Update usage statistics
      await this.trackUsage(relationship.id, tenantId);

      return relationship;
    } catch (error) {
      this.logger.error('Failed to check access', {
        entityType,
        entityId,
        objectType,
        objectId,
        action,
        error
      });
      return null;
    }
  }

  /**
   * Find all access paths from an entity to an object
   * Supports transitive relationships (e.g., user -> team -> object)
   */
  async findAccessPaths(
    entityType: string,
    entityId: string,
    objectType: string,
    objectId: string,
    tenantId: string
  ): Promise<AccessPath[]> {
    try {
      const paths: AccessPath[] = [];

      // Direct relationships
      const directQuery = `
        SELECT * FROM c 
        WHERE c.entityType = @entityType
        AND c.entityId = @entityId
        AND c.objectType = @objectType
        AND c.objectId = @objectId
        AND c.tenantId = @tenantId
        AND (c.expiresAt IS NULL OR c.expiresAt > @now)
      `;

      const directResults = await this.dbService.queryDocuments<AccessRelationship>(
        this.CONTAINER_NAME,
        directQuery,
        [
          { name: '@entityType', value: entityType },
          { name: '@entityId', value: entityId },
          { name: '@objectType', value: objectType },
          { name: '@objectId', value: objectId },
          { name: '@tenantId', value: tenantId },
          { name: '@now', value: new Date().toISOString() }
        ]
      );

      // Add direct paths
      for (const rel of directResults) {
        paths.push({
          from: { type: entityType as any, id: entityId, name: rel.entityName || entityId },
          to: { type: objectType, id: objectId, ...(rel.objectName && { name: rel.objectName }) },
          via: [rel],
          actions: rel.actions
        });
      }

      // TODO: Transitive relationships (e.g., user -> team -> object)
      // This would require a graph traversal algorithm
      // For now, we support only direct relationships

      return paths;
    } catch (error) {
      this.logger.error('Failed to find access paths', {
        entityType,
        entityId,
        objectType,
        objectId,
        error
      });
      return [];
    }
  }

  /**
   * Get all relationships for an entity (outgoing edges)
   */
  async getEntityRelationships(
    entityType: string,
    entityId: string,
    tenantId: string
  ): Promise<AccessRelationship[]> {
    try {
      const query = `
        SELECT * FROM c 
        WHERE c.entityType = @entityType
        AND c.entityId = @entityId
        AND c.tenantId = @tenantId
        AND (c.expiresAt IS NULL OR c.expiresAt > @now)
        ORDER BY c.grantedAt DESC
      `;

      const parameters = [
        { name: '@entityType', value: entityType },
        { name: '@entityId', value: entityId },
        { name: '@tenantId', value: tenantId },
        { name: '@now', value: new Date().toISOString() }
      ];

      return await this.dbService.queryDocuments<AccessRelationship>(
        this.CONTAINER_NAME,
        query,
        parameters
      );
    } catch (error) {
      this.logger.error('Failed to get entity relationships', { entityType, entityId, error });
      return [];
    }
  }

  /**
   * Get all relationships for an object (incoming edges)
   */
  async getObjectRelationships(
    objectType: string,
    objectId: string,
    tenantId: string
  ): Promise<AccessRelationship[]> {
    try {
      const query = `
        SELECT * FROM c 
        WHERE c.objectType = @objectType
        AND c.objectId = @objectId
        AND c.tenantId = @tenantId
        AND (c.expiresAt IS NULL OR c.expiresAt > @now)
        ORDER BY c.grantedAt DESC
      `;

      const parameters = [
        { name: '@objectType', value: objectType },
        { name: '@objectId', value: objectId },
        { name: '@tenantId', value: tenantId },
        { name: '@now', value: new Date().toISOString() }
      ];

      return await this.dbService.queryDocuments<AccessRelationship>(
        this.CONTAINER_NAME,
        query,
        parameters
      );
    } catch (error) {
      this.logger.error('Failed to get object relationships', { objectType, objectId, error });
      return [];
    }
  }

  /**
   * Update actions for an existing relationship
   */
  async updateActions(
    entityType: string,
    entityId: string,
    objectType: string,
    objectId: string,
    actions: string[],
    tenantId: string
  ): Promise<AccessRelationship | null> {
    try {
      const relationshipId = this.generateRelationshipId(entityType, entityId, objectType, objectId);
      
      const existing = await this.dbService.getDocument<AccessRelationship>(
        this.CONTAINER_NAME,
        relationshipId,
        tenantId
      );

      if (!existing) {
        this.logger.warn('Relationship not found for update', { relationshipId });
        return null;
      }

      const updated: AccessRelationship = {
        ...existing,
        actions
      };

      await this.dbService.upsertDocument(this.CONTAINER_NAME, updated);

      this.logger.info('Relationship actions updated', { relationshipId, actions });

      return updated;
    } catch (error) {
      this.logger.error('Failed to update relationship actions', {
        entityType,
        entityId,
        objectType,
        objectId,
        error
      });
      return null;
    }
  }

  /**
   * Build an access graph for visualization
   */
  async buildAccessGraph(
    tenantId: string,
    filters?: {
      entityType?: string;
      entityId?: string;
      objectType?: string;
      objectId?: string;
    }
  ): Promise<AccessGraph> {
    try {
      let query = `
        SELECT * FROM c 
        WHERE c.tenantId = @tenantId
        AND (c.expiresAt IS NULL OR c.expiresAt > @now)
      `;

      const parameters: Array<{ name: string; value: any }> = [
        { name: '@tenantId', value: tenantId },
        { name: '@now', value: new Date().toISOString() }
      ];

      if (filters?.entityType) {
        query += ' AND c.entityType = @entityType';
        parameters.push({ name: '@entityType', value: filters.entityType });
      }

      if (filters?.entityId) {
        query += ' AND c.entityId = @entityId';
        parameters.push({ name: '@entityId', value: filters.entityId });
      }

      if (filters?.objectType) {
        query += ' AND c.objectType = @objectType';
        parameters.push({ name: '@objectType', value: filters.objectType });
      }

      if (filters?.objectId) {
        query += ' AND c.objectId = @objectId';
        parameters.push({ name: '@objectId', value: filters.objectId });
      }

      const relationships = await this.dbService.queryDocuments<AccessRelationship>(
        this.CONTAINER_NAME,
        query,
        parameters
      );

      // Extract unique entities
      const entityMap = new Map<string, AccessEntity>();

      for (const rel of relationships) {
        const entityKey = `${rel.entityType}:${rel.entityId}`;
        if (!entityMap.has(entityKey)) {
          entityMap.set(entityKey, {
            type: rel.entityType,
            id: rel.entityId,
            name: rel.entityName || rel.entityId
          });
        }
      }

      return {
        entities: Array.from(entityMap.values()),
        relationships
      };
    } catch (error) {
      this.logger.error('Failed to build access graph', { tenantId, filters, error });
      return { entities: [], relationships: [] };
    }
  }

  /**
   * Clean up expired relationships
   */
  async cleanupExpired(tenantId: string): Promise<number> {
    try {
      const query = `
        SELECT c.id FROM c 
        WHERE c.tenantId = @tenantId
        AND c.expiresAt < @now
      `;

      const parameters = [
        { name: '@tenantId', value: tenantId },
        { name: '@now', value: new Date().toISOString() }
      ];

      const expired = await this.dbService.queryDocuments<{ id: string }>(
        this.CONTAINER_NAME,
        query,
        parameters
      );

      let deletedCount = 0;
      for (const rel of expired) {
        try {
          await this.dbService.deleteDocument(this.CONTAINER_NAME, rel.id, tenantId);
          deletedCount++;
        } catch (error) {
          this.logger.warn('Failed to delete expired relationship', { relationshipId: rel.id, error });
        }
      }

      this.logger.info('Cleaned up expired relationships', { tenantId, deletedCount });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired relationships', { tenantId, error });
      return 0;
    }
  }

  /**
   * Check if conditions are satisfied
   */
  private checkConditions(
    conditions: NonNullable<AccessRelationship['conditions']>,
    context?: { ipAddress?: string; timestamp?: Date }
  ): boolean {
    // Check time window
    if (conditions.timeWindow) {
      const now = context?.timestamp || new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (conditions.timeWindow.startTime && currentTime < conditions.timeWindow.startTime) {
        return false;
      }
      
      if (conditions.timeWindow.endTime && currentTime > conditions.timeWindow.endTime) {
        return false;
      }
    }

    // Check IP restrictions
    if (conditions.ipRestrictions && context?.ipAddress) {
      if (!conditions.ipRestrictions.includes(context.ipAddress)) {
        return false;
      }
    }

    // MFA check would be handled at authentication layer
    // This is just metadata for now

    return true;
  }

  /**
   * Track relationship usage
   */
  private async trackUsage(relationshipId: string, tenantId: string): Promise<void> {
    try {
      const relationship = await this.dbService.getDocument<AccessRelationship>(
        this.CONTAINER_NAME,
        relationshipId,
        tenantId
      );

      if (relationship) {
        relationship.lastUsed = new Date();
        relationship.useCount = (relationship.useCount || 0) + 1;
        await this.dbService.upsertDocument(this.CONTAINER_NAME, relationship);
      }
    } catch (error) {
      // Don't fail the authorization if usage tracking fails
      this.logger.warn('Failed to track relationship usage', { relationshipId, error });
    }
  }

  /**
   * Generate consistent relationship ID
   */
  private generateRelationshipId(
    entityType: string,
    entityId: string,
    objectType: string,
    objectId: string
  ): string {
    return `rel_${entityType}_${entityId}_${objectType}_${objectId}`;
  }
}
