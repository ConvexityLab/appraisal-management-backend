/**
 * QC Checklist Management Service
 * Handles CRUD operations, assignments, templates, and version control for QC checklists
 */

import { Logger } from '../utils/logger';
import { CosmosDbService } from './cosmos-db.service';
import { Container } from '@azure/cosmos';
import { createApiError } from '../utils/api-response.util';
import { ApiResponse } from '../types/index';
import {
  QCChecklist,
  QCChecklistAssignment,
  QCTemplateConfig,
  CreateQCChecklistRequest,
  QCStatus,
  QCPriority,
  QCConditionalLogic,
  QCConditionalRule,
  ConditionalOperator
} from '../types/qc-checklist.types';

export interface QCChecklistSearchFilters {
  documentType?: string;
  isTemplate?: boolean;
  isActive?: boolean;
  tags?: string[];
  createdBy?: string;
  clientId?: string;
  organizationId?: string;
  regulatoryFramework?: string;
}

export interface QCChecklistAssignmentFilters {
  assignmentType?: 'user' | 'client' | 'organization' | 'role';
  targetId?: string;
  checklistId?: string;
  isActive?: boolean;
}

export class QCChecklistManagementService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private checklistsContainer: Container | null = null;
  private assignmentsContainer: Container | null = null;
  
  private readonly CHECKLISTS_CONTAINER = 'qc_checklists';
  private readonly ASSIGNMENTS_CONTAINER = 'qc_assignments';

  constructor() {
    this.logger = new Logger('QCChecklistManagement');
    this.dbService = new CosmosDbService();
  }

  /**
   * Initialize the service and create containers
   */
  async initialize(): Promise<void> {
    await this.dbService.initialize();
    await this.initializeContainers();
  }

  /**
   * Initialize QC containers
   */
  private async initializeContainers(): Promise<void> {
    try {
      if (!this.dbService.isDbConnected()) {
        throw new Error('Database not connected. Call initialize() first.');
      }

      const database = (this.dbService as any).database;
      if (!database) {
        throw new Error('Database not available');
      }

      // Create QC checklists container
      const { container: checklistsContainer } = await database.containers.createIfNotExists({
        id: this.CHECKLISTS_CONTAINER,
        partitionKey: '/documentType'
      });
      this.checklistsContainer = checklistsContainer;

      // Create QC assignments container
      const { container: assignmentsContainer } = await database.containers.createIfNotExists({
        id: this.ASSIGNMENTS_CONTAINER,
        partitionKey: '/targetId'
      });
      this.assignmentsContainer = assignmentsContainer;

      this.logger.info('QC containers initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize QC containers', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // ============================================================================
  // QC Checklist CRUD Operations
  // ============================================================================

  /**
   * Create a new QC checklist
   */
  async createChecklist(request: CreateQCChecklistRequest, userId: string): Promise<ApiResponse<QCChecklist>> {
    try {
      this.logger.info('Creating new QC checklist', { name: request.name, documentType: request.documentType });

      if (!this.checklistsContainer) {
        throw new Error('QC checklists container not initialized');
      }

      // Generate unique IDs for categories, subcategories, and questions
      const checklist: QCChecklist = {
        id: this.generateId(),
        name: request.name,
        description: request.description || undefined,
        version: '1.0.0',
        documentType: request.documentType,
        createdBy: userId,
        createdAt: new Date(),
        isTemplate: request.isTemplate || false,
        isActive: true,
        tags: [],
        categories: request.categories.map(category => ({
          ...category,
          id: this.generateId(),
          subcategories: category.subcategories.map(subcategory => ({
            ...subcategory,
            id: this.generateId(),
            questions: subcategory.questions.map(question => ({
              ...question,
              id: this.generateId()
            }))
          }))
        })),
        overallScoringMethod: request.globalConfiguration?.scoringMethod as any || 'weighted_average',
        passingScore: request.globalConfiguration?.passingScore || 70
      };

      // Validate the checklist
      await this.validateChecklist(checklist);

      // Save to database
      const { resource } = await this.checklistsContainer.items.create(checklist);
      
      this.logger.info('QC checklist created successfully', { checklistId: resource?.id });
      
      return {
        success: true,
        data: resource as QCChecklist
      };

    } catch (error) {
      this.logger.error('Failed to create QC checklist', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        name: request.name, 
        documentType: request.documentType 
      });
      
      return {
        success: false,
        error: createApiError('QC_CHECKLIST_CREATE_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  /**
   * Get QC checklist by ID
   */
  async getChecklist(checklistId: string, includeInactive = false): Promise<QCChecklist | null> {
    try {
      const response = await this.dbService.getItem<QCChecklist>(
        this.CHECKLISTS_CONTAINER, 
        checklistId
      );

      if (!response.success || !response.data) {
        return null;
      }

      const checklist = response.data;
      if (!includeInactive && !checklist.isActive) {
        return null;
      }

      return checklist;

    } catch (error) {
      this.logger.error('Failed to get QC checklist', { error: error instanceof Error ? error.message : 'Unknown error', checklistId });
      throw error;
    }
  }

  /**
   * Update an existing QC checklist
   */
  async updateChecklist(
    checklistId: string, 
    updates: Partial<QCChecklist>, 
    userId: string
  ): Promise<QCChecklist> {
    try {
      const existingChecklist = await this.getChecklist(checklistId, true);
      if (!existingChecklist) {
        throw new Error(`QC checklist not found: ${checklistId}`);
      }

      // Create new version if significant changes
      const shouldCreateNewVersion = this.shouldCreateNewVersion(existingChecklist, updates);
      
      const updatedChecklist: QCChecklist = {
        ...existingChecklist,
        ...updates,
        updatedBy: userId,
        updatedAt: new Date(),
        version: shouldCreateNewVersion 
          ? this.incrementVersion(existingChecklist.version)
          : existingChecklist.version
      };

      // Validate the updated checklist
      await this.validateChecklist(updatedChecklist);

      // Save to database
      const result = await this.dbService.updateItem(
        this.CHECKLISTS_CONTAINER,
        checklistId,
        updatedChecklist
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to update checklist in database');
      }

      this.logger.info('QC checklist updated successfully', { checklistId, version: result.data.version });
      return result.data;

    } catch (error) {
      this.logger.error('Failed to update QC checklist', { error: error instanceof Error ? error.message : 'Unknown error', checklistId });
      throw error;
    }
  }

  /**
   * Delete (deactivate) a QC checklist
   */
  async deleteChecklist(checklistId: string, userId: string): Promise<void> {
    try {
      await this.updateChecklist(checklistId, {
        isActive: false,
        updatedBy: userId,
        updatedAt: new Date()
      }, userId);

      this.logger.info('QC checklist deactivated successfully', { checklistId });

    } catch (error) {
      this.logger.error('Failed to delete QC checklist', { error: error instanceof Error ? error.message : 'Unknown error', checklistId });
      throw error;
    }
  }

  /**
   * Search QC checklists with filters
   */
  async searchChecklists(
    filters: QCChecklistSearchFilters = {},
    limit = 50,
    offset = 0
  ): Promise<{ checklists: QCChecklist[]; totalCount: number }> {
    try {
      const query = this.buildChecklistSearchQuery(filters);
      
      const result = await this.dbService.queryItems<QCChecklist>(
        this.CHECKLISTS_CONTAINER,
        query
      );

      if (!result.success || !result.data) {
        return { checklists: [], totalCount: 0 };
      }

      // Apply pagination in memory for now
      const startIndex = offset;
      const endIndex = offset + limit;
      const paginatedItems = result.data.slice(startIndex, endIndex);

      return {
        checklists: paginatedItems,
        totalCount: result.data.length
      };

    } catch (error) {
      this.logger.error('Failed to search QC checklists', { error: error instanceof Error ? error.message : 'Unknown error', filters });
      throw error;
    }
  }

  // ============================================================================
  // QC Checklist Assignment Management
  // ============================================================================

  /**
   * Assign a checklist to a user, client, or organization
   */
  async assignChecklist(assignment: Omit<QCChecklistAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<QCChecklistAssignment> {
    try {
      const newAssignment: QCChecklistAssignment = {
        ...assignment,
        id: this.generateId(),
        createdAt: new Date()
      };

      // Validate the checklist exists
      const checklist = await this.getChecklist(assignment.checklistId);
      if (!checklist) {
        throw new Error(`QC checklist not found: ${assignment.checklistId}`);
      }

      const result = await this.dbService.createItem<QCChecklistAssignment>(this.ASSIGNMENTS_CONTAINER, newAssignment);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to create checklist assignment');
      }

      this.logger.info('QC checklist assignment created', { 
        assignmentId: result.data.id,
        checklistId: assignment.checklistId,
        targetId: assignment.targetId
      });

      return result.data;

    } catch (error) {
      this.logger.error('Failed to assign QC checklist', { error: error instanceof Error ? error.message : 'Unknown error', assignment });
      throw error;
    }
  }

  /**
   * Get checklist assignments for a user, client, or organization
   */
  async getAssignments(filters: QCChecklistAssignmentFilters = {}): Promise<QCChecklistAssignment[]> {
    try {
      const query = this.buildAssignmentSearchQuery(filters);
      
      const result = await this.dbService.queryItems<QCChecklistAssignment>(
        this.ASSIGNMENTS_CONTAINER,
        query
      );

      if (!result.success || !result.data) {
        return [];
      }

      return result.data;

    } catch (error) {
      this.logger.error('Failed to get QC checklist assignments', { error: error instanceof Error ? error.message : 'Unknown error', filters });
      throw error;
    }
  }

  /**
   * Get active checklists for a specific target (user, client, organization)
   */
  async getActiveChecklistsForTarget(
    targetId: string,
    documentType?: string
  ): Promise<Array<{ checklist: QCChecklist; assignment: QCChecklistAssignment }>> {
    try {
      const now = new Date();
      
      // Get active assignments for the target
      const assignments = await this.getAssignments({
        targetId,
        isActive: true
      });

      // Filter by effective dates and get checklists
      const activeAssignments = assignments.filter(assignment => 
        assignment.effectiveFrom <= now && 
        (!assignment.effectiveTo || assignment.effectiveTo > now)
      );

      const results = [];
      for (const assignment of activeAssignments) {
        const checklist = await this.getChecklist(assignment.checklistId);
        if (checklist && (!documentType || checklist.documentType === documentType)) {
          results.push({ checklist, assignment });
        }
      }

      // Sort by priority (higher priority first)
      return results.sort((a, b) => b.assignment.priority - a.assignment.priority);

    } catch (error) {
      this.logger.error('Failed to get active checklists for target', { error: error instanceof Error ? error.message : 'Unknown error', targetId, documentType });
      throw error;
    }
  }

  /**
   * Remove a checklist assignment
   */
  async removeAssignment(assignmentId: string): Promise<void> {
    try {
      await this.dbService.deleteItem(this.ASSIGNMENTS_CONTAINER, assignmentId);
      this.logger.info('QC checklist assignment removed', { assignmentId });

    } catch (error) {
      this.logger.error('Failed to remove QC checklist assignment', { error: error instanceof Error ? error.message : 'Unknown error', assignmentId });
      throw error;
    }
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  /**
   * Create a checklist from a template
   */
  async createFromTemplate(
    templateId: string,
    customizations: QCTemplateConfig['customizations'],
    name: string,
    userId: string
  ): Promise<QCChecklist> {
    try {
      const template = await this.getChecklist(templateId);
      if (!template || !template.isTemplate) {
        throw new Error(`Template not found or not a template: ${templateId}`);
      }

      // Apply customizations to the template
      const customizedChecklist = this.applyTemplateCustomizations(template, customizations);

      // Create the new checklist
      const newChecklist: QCChecklist = {
        ...customizedChecklist,
        id: this.generateId(),
        name,
        isTemplate: false,
        createdBy: userId,
        createdAt: new Date(),
        version: '1.0.0'
      };

      const result = await this.dbService.createItem<QCChecklist>(this.CHECKLISTS_CONTAINER, newChecklist);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to create checklist from template');
      }

      this.logger.info('QC checklist created from template', { 
        checklistId: result.data.id,
        templateId,
        name
      });

      return result.data;

    } catch (error) {
      this.logger.error('Failed to create checklist from template', { error: error instanceof Error ? error.message : 'Unknown error', templateId, name });
      throw error;
    }
  }

  /**
   * Clone an existing checklist
   */
  async cloneChecklist(
    sourceChecklistId: string,
    name: string,
    userId: string,
    makeTemplate = false
  ): Promise<QCChecklist> {
    try {
      const sourceChecklist = await this.getChecklist(sourceChecklistId);
      if (!sourceChecklist) {
        throw new Error(`Source checklist not found: ${sourceChecklistId}`);
      }

      const clonedChecklist: QCChecklist = {
        ...sourceChecklist,
        id: this.generateId(),
        name,
        isTemplate: makeTemplate,
        createdBy: userId,
        createdAt: new Date(),
        updatedBy: undefined,
        updatedAt: undefined,
        version: '1.0.0',
        // Regenerate IDs for all nested items
        categories: sourceChecklist.categories.map(category => ({
          ...category,
          id: this.generateId(),
          subcategories: category.subcategories.map(subcategory => ({
            ...subcategory,
            id: this.generateId(),
            questions: subcategory.questions.map(question => ({
              ...question,
              id: this.generateId()
            }))
          }))
        }))
      };

      const result = await this.dbService.createItem<QCChecklist>(this.CHECKLISTS_CONTAINER, clonedChecklist);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to clone checklist');
      }

      this.logger.info('QC checklist cloned successfully', { 
        newChecklistId: result.data.id,
        sourceChecklistId,
        name
      });

      return result.data;

    } catch (error) {
      this.logger.error('Failed to clone QC checklist', { error: error instanceof Error ? error.message : 'Unknown error', sourceChecklistId, name });
      throw error;
    }
  }

  // ============================================================================
  // Conditional Logic Evaluation
  // ============================================================================

  /**
   * Evaluate conditional logic against data
   */
  evaluateConditionalLogic(
    logic: QCConditionalLogic,
    data: Record<string, any>
  ): boolean {
    try {
      // Evaluate individual rules
      const ruleResults = logic.rules.map(rule => this.evaluateRule(rule, data));
      
      // Apply operator
      let result = logic.operator === 'AND' 
        ? ruleResults.every(r => r)
        : ruleResults.some(r => r);

      // Evaluate nested logic if present
      if (logic.nested && logic.nested.length > 0) {
        const nestedResults = logic.nested.map(nestedLogic => 
          this.evaluateConditionalLogic(nestedLogic, data)
        );
        
        const nestedResult = logic.operator === 'AND'
          ? nestedResults.every(r => r)
          : nestedResults.some(r => r);
          
        result = logic.operator === 'AND' ? result && nestedResult : result || nestedResult;
      }

      return result;

    } catch (error) {
      this.logger.error('Failed to evaluate conditional logic', { error: error instanceof Error ? error.message : 'Unknown error', logic });
      return false;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateId(): string {
    return `qc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async validateChecklist(checklist: QCChecklist): Promise<void> {
    // Validate required fields
    if (!checklist.name || checklist.name.trim().length === 0) {
      throw new Error('Checklist name is required');
    }

    if (!checklist.documentType || checklist.documentType.trim().length === 0) {
      throw new Error('Document type is required');
    }

    if (!checklist.categories || checklist.categories.length === 0) {
      throw new Error('At least one category is required');
    }

    // Validate categories have questions
    for (const category of checklist.categories) {
      if (!category.subcategories || category.subcategories.length === 0) {
        throw new Error(`Category '${category.name}' must have at least one subcategory`);
      }

      for (const subcategory of category.subcategories) {
        if (!subcategory.questions || subcategory.questions.length === 0) {
          throw new Error(`Subcategory '${subcategory.name}' must have at least one question`);
        }
      }
    }

    // Validate unique IDs
    const allIds: string[] = [];
    const addId = (id: string, type: string) => {
      if (allIds.includes(id)) {
        throw new Error(`Duplicate ID found: ${id} (${type})`);
      }
      allIds.push(id);
    };

    addId(checklist.id, 'checklist');
    
    for (const category of checklist.categories) {
      addId(category.id, 'category');
      
      for (const subcategory of category.subcategories) {
        addId(subcategory.id, 'subcategory');
        
        for (const question of subcategory.questions) {
          addId(question.id, 'question');
        }
      }
    }
  }

  private shouldCreateNewVersion(
    existing: QCChecklist, 
    updates: Partial<QCChecklist>
  ): boolean {
    // Create new version if categories, scoring, or critical structure changes
    return !!(
      updates.categories ||
      updates.overallScoringMethod ||
      updates.passingScore ||
      updates.regulatoryFramework ||
      updates.complianceStandards
    );
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private buildChecklistSearchQuery(filters: QCChecklistSearchFilters): string {
    const conditions: string[] = [];

    if (filters.documentType) {
      conditions.push(`c.documentType = '${filters.documentType}'`);
    }

    if (filters.isTemplate !== undefined) {
      conditions.push(`c.isTemplate = ${filters.isTemplate}`);
    }

    if (filters.isActive !== undefined) {
      conditions.push(`c.isActive = ${filters.isActive}`);
    }

    if (filters.createdBy) {
      conditions.push(`c.createdBy = '${filters.createdBy}'`);
    }

    if (filters.regulatoryFramework) {
      conditions.push(`c.regulatoryFramework = '${filters.regulatoryFramework}'`);
    }

    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map(tag => `ARRAY_CONTAINS(c.tags, '${tag}')`);
      conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    return `SELECT * FROM c${whereClause} ORDER BY c.createdAt DESC`;
  }

  private buildAssignmentSearchQuery(filters: QCChecklistAssignmentFilters): string {
    const conditions: string[] = [];

    if (filters.assignmentType) {
      conditions.push(`c.assignmentType = '${filters.assignmentType}'`);
    }

    if (filters.targetId) {
      conditions.push(`c.targetId = '${filters.targetId}'`);
    }

    if (filters.checklistId) {
      conditions.push(`c.checklistId = '${filters.checklistId}'`);
    }

    // Only active assignments by default
    if (filters.isActive !== false) {
      const now = new Date().toISOString();
      conditions.push(`c.effectiveFrom <= '${now}'`);
      conditions.push(`(c.effectiveTo = null OR c.effectiveTo > '${now}')`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    return `SELECT * FROM c${whereClause} ORDER BY c.priority DESC, c.createdAt DESC`;
  }

  private applyTemplateCustomizations(
    template: QCChecklist,
    customizations?: QCTemplateConfig['customizations']
  ): QCChecklist {
    if (!customizations) {
      return { ...template };
    }

    const customized = { ...template };

    // Apply global settings
    if (customizations.globalSettings) {
      if (customizations.globalSettings.passingScore !== undefined) {
        customized.passingScore = customizations.globalSettings.passingScore;
      }
    }

    // Apply category customizations
    if (customizations.categories) {
      customized.categories = template.categories.map(category => {
        const categoryCustomization = customizations.categories!.find(c => c.categoryId === category.id);
        
        if (!categoryCustomization) {
          return category;
        }

        if (!categoryCustomization.enabled) {
          // Category is disabled, skip it
          return null;
        }

        const customizedCategory = { ...category };

        // Add custom questions
        if (categoryCustomization.customQuestions) {
          // Add to first subcategory or create new subcategory
          if (customizedCategory.subcategories.length > 0) {
            customizedCategory.subcategories?.[0]?.questions?.push(
              ...categoryCustomization.customQuestions.map(q => ({ ...q, id: this.generateId() }))
            );
          }
        }

        // Modify existing questions
        if (categoryCustomization.modifiedQuestions) {
          customizedCategory.subcategories = customizedCategory.subcategories.map(subcategory => ({
            ...subcategory,
            questions: subcategory.questions.map(question => {
              const modification = categoryCustomization.modifiedQuestions!.find(m => m.questionId === question.id);
              return modification ? { ...question, ...modification.modifications } : question;
            })
          }));
        }

        return customizedCategory;
      }).filter(Boolean) as typeof template.categories;
    }

    return customized;
  }

  private evaluateRule(rule: QCConditionalRule, data: Record<string, any>): boolean {
    const fieldValue = this.getFieldValue(rule.field, data);
    
    switch (rule.operator) {
      case ConditionalOperator.EQUALS:
        return fieldValue === rule.value;
      
      case ConditionalOperator.NOT_EQUALS:
        return fieldValue !== rule.value;
      
      case ConditionalOperator.GREATER_THAN:
        return Number(fieldValue) > Number(rule.value);
      
      case ConditionalOperator.LESS_THAN:
        return Number(fieldValue) < Number(rule.value);
      
      case ConditionalOperator.GREATER_THAN_OR_EQUAL:
        return Number(fieldValue) >= Number(rule.value);
      
      case ConditionalOperator.LESS_THAN_OR_EQUAL:
        return Number(fieldValue) <= Number(rule.value);
      
      case ConditionalOperator.CONTAINS:
        return String(fieldValue).includes(String(rule.value));
      
      case ConditionalOperator.NOT_CONTAINS:
        return !String(fieldValue).includes(String(rule.value));
      
      case ConditionalOperator.IN:
        return Array.isArray(rule.value) && rule.value.includes(fieldValue);
      
      case ConditionalOperator.NOT_IN:
        return Array.isArray(rule.value) && !rule.value.includes(fieldValue);
      
      case ConditionalOperator.IS_EMPTY:
        return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
      
      case ConditionalOperator.IS_NOT_EMPTY:
        return fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);
      
      case ConditionalOperator.MATCHES_PATTERN:
        const regex = new RegExp(String(rule.value));
        return regex.test(String(fieldValue));
      
      default:
        return false;
    }
  }

  private getFieldValue(fieldPath: string, data: Record<string, any>): any {
    // Support JSONPath-like field access (e.g., "property.address.street")
    return fieldPath.split('.').reduce((obj, key) => obj && obj[key], data);
  }
}