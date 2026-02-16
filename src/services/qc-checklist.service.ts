/**
 * QC Checklist Service
 * 
 * Manages QC checklists stored in the criteria container
 * Provides CRUD operations and query capabilities for QC checklists
 */

import { CosmosClient, Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { QCChecklist, QCCategory, QCQuestion } from '../types/qc-checklist.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

export class QCChecklistService {
  private container: Container;
  private readonly CHECKLIST_TYPE = 'qc-checklist';

  constructor() {
    const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
    const databaseId = process.env.AZURE_COSMOS_DATABASE_NAME || 'appraisal-management';

    if (!endpoint) {
      throw new Error('AZURE_COSMOS_ENDPOINT environment variable is required');
    }

    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ endpoint, aadCredentials: credential });
    const database = client.database(databaseId);
    
    // Use the criteria container for checklists
    this.container = database.container('criteria');
  }

  /**
   * Get all active QC checklists
   */
  async getAllChecklists(clientId: string = 'default-client'): Promise<QCChecklist[]> {
    try {
      const query = {
        query: `SELECT * FROM c WHERE c.type = @type AND c.clientId = @clientId AND c.isActive = true`,
        parameters: [
          { name: '@type', value: this.CHECKLIST_TYPE },
          { name: '@clientId', value: clientId }
        ]
      };

      const { resources } = await this.container.items.query<QCChecklist>(query).fetchAll();
      
      logger.info(`Retrieved ${resources.length} active checklists for client: ${clientId}`);
      return resources;
    } catch (error) {
      logger.error('Failed to get checklists', { error });
      throw new Error(`Failed to retrieve checklists: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific checklist by ID
   */
  async getChecklistById(id: string, clientId: string = 'default-client'): Promise<QCChecklist | null> {
    try {
      const { resource } = await this.container.item(id, clientId).read<any>();
      
      if (!resource || resource.type !== this.CHECKLIST_TYPE) {
        return null;
      }

      return resource;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      logger.error('Failed to get checklist', { id, error });
      throw new Error(`Failed to retrieve checklist: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get checklists filtered by property type or tags
   */
  async getChecklistsByFilter(
    filters: {
      propertyType?: string;
      checklistType?: string;
      tags?: string[];
      clientId?: string;
    }
  ): Promise<QCChecklist[]> {
    try {
      const clientId = filters.clientId || 'default-client';
      let queryText = `SELECT * FROM c WHERE c.type = @type AND c.clientId = @clientId AND c.active = true`;
      const parameters: Array<{ name: string; value: any }> = [
        { name: '@type', value: this.CHECKLIST_TYPE },
        { name: '@clientId', value: clientId }
      ];

      if (filters.propertyType) {
        queryText += ` AND c.propertyType = @propertyType`;
        parameters.push({ name: '@propertyType', value: filters.propertyType });
      }

      if (filters.checklistType) {
        queryText += ` AND c.checklistType = @checklistType`;
        parameters.push({ name: '@checklistType', value: filters.checklistType });
      }

      if (filters.tags && filters.tags.length > 0) {
        queryText += ` AND ARRAY_CONTAINS(c.tags, @tag)`;
        parameters.push({ name: '@tag', value: filters.tags[0] });
      }

      const query = { query: queryText, parameters };
      const { resources } = await this.container.items.query<QCChecklist>(query).fetchAll();

      logger.info(`Retrieved ${resources.length} filtered checklists`, { filters });
      return resources;
    } catch (error) {
      logger.error('Failed to filter checklists', { filters, error });
      throw new Error(`Failed to filter checklists: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all questions from a checklist with their document requirements
   */
  async getChecklistQuestions(checklistId: string, clientId: string = 'default-client'): Promise<QCQuestion[]> {
    try {
      const checklist = await this.getChecklistById(checklistId, clientId);
      if (!checklist) {
        throw new Error(`Checklist not found: ${checklistId}`);
      }

      const allQuestions: QCQuestion[] = [];

      for (const category of checklist.categories) {
        for (const subcategory of category.subcategories) {
          allQuestions.push(...subcategory.questions);
        }
      }

      logger.info(`Retrieved ${allQuestions.length} questions from checklist: ${checklistId}`);
      return allQuestions;
    } catch (error) {
      logger.error('Failed to get checklist questions', { checklistId, error });
      throw error;
    }
  }

  /**
   * Get questions that require specific document categories
   */
  async getQuestionsByDocumentCategory(
    checklistId: string,
    documentCategory: string,
    clientId: string = 'default-client'
  ): Promise<QCQuestion[]> {
    try {
      const allQuestions = await this.getChecklistQuestions(checklistId, clientId);
      
      const matchingQuestions = allQuestions.filter(question =>
        question.requiredDocumentCategories?.includes(documentCategory)
      );

      logger.info(`Found ${matchingQuestions.length} questions requiring document category: ${documentCategory}`);
      return matchingQuestions;
    } catch (error) {
      logger.error('Failed to get questions by document category', { checklistId, documentCategory, error });
      throw error;
    }
  }

  /**
   * Create or update a checklist
   */
  async upsertChecklist(checklist: any): Promise<any> {
    try {
      if (!checklist.type) {
        checklist.type = this.CHECKLIST_TYPE;
      }

      if (!checklist.clientId) {
        checklist.clientId = 'default-client';
      }

      const now = new Date();
      if (!checklist.createdAt) {
        checklist.createdAt = now;
      }
      checklist.updatedAt = now;

      const { resource } = await this.container.items.upsert(checklist);

      logger.info(`Upserted checklist: ${checklist.id}`);
      return resource;
    } catch (error) {
      logger.error('Failed to upsert checklist', { checklistId: checklist.id, error });
      throw new Error(`Failed to save checklist: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete (deactivate) a checklist
   */
  async deleteChecklist(id: string, clientId: string = 'default-client'): Promise<boolean> {
    try {
      const checklist = await this.getChecklistById(id, clientId);
      if (!checklist) {
        return false;
      }

      checklist.isActive = false;
      checklist.updatedAt = new Date();

      await this.container.items.upsert(checklist);

      logger.info(`Deactivated checklist: ${id}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete checklist', { id, error });
      throw new Error(`Failed to delete checklist: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get checklist statistics
   */
  async getChecklistStatistics(clientId: string = 'default-client'): Promise<{
    totalChecklists: number;
    activeChecklists: number;
    totalQuestions: number;
    questionsWithDocRequirements: number;
    checklistsByType: Record<string, number>;
  }> {
    try {
      const checklists = await this.getAllChecklists(clientId);
      
      let totalQuestions = 0;
      let questionsWithDocRequirements = 0;
      const checklistsByType: Record<string, number> = {};

      for (const checklist of checklists) {
        // Count by type
        const type = checklist.documentType || 'UNKNOWN';
        checklistsByType[type] = (checklistsByType[type] || 0) + 1;

        // Count questions
        for (const category of checklist.categories) {
          for (const subcategory of category.subcategories) {
            totalQuestions += subcategory.questions.length;
            
            for (const question of subcategory.questions) {
              if (question.requiredDocumentCategories && question.requiredDocumentCategories.length > 0) {
                questionsWithDocRequirements++;
              }
            }
          }
        }
      }

      const stats = {
        totalChecklists: checklists.length,
        activeChecklists: checklists.filter(c => c.isActive).length,
        totalQuestions,
        questionsWithDocRequirements,
        checklistsByType
      };

      logger.info('Retrieved checklist statistics', { stats });
      return stats;
    } catch (error) {
      logger.error('Failed to get checklist statistics', { error });
      throw error;
    }
  }
}
