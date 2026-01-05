/**
 * Dynamic Prompt Generation Engine
 * Creates AI prompts from QC checklists and available document data
 */

import { Logger } from '../utils/logger.js';
import {
  QCChecklist,
  QCQuestion,
  QCDataRequirement,
  DataSourceType,
  QCConditionalLogic
} from '../types/qc-checklist.types.js';

export interface PromptTemplate {
  systemPrompt: string;
  userPrompt: string;
  context: Record<string, any>;
  dataMapping: Record<string, any>;
}

export interface QCPromptGenerationOptions {
  includeExamples?: boolean;
  includeReferences?: boolean;
  maxContextLength?: number;
  focusArea?: string;
  clientCustomizations?: Record<string, any>;
}

export class DynamicPromptGenerationEngine {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('DynamicPromptGeneration');
  }

  /**
   * Generate a comprehensive QC prompt for a specific question
   */
  async generateQCPrompt(
    question: QCQuestion,
    availableData: Record<string, any>,
    documentType: string,
    options: QCPromptGenerationOptions = {}
  ): Promise<PromptTemplate> {
    try {
      this.logger.debug('Generating QC prompt', {
        questionId: question.id,
        questionType: question.type,
        documentType
      });

      // Extract relevant data for this question
      const relevantData = this.extractRelevantData(question, availableData);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(question, documentType, options);

      // Build user prompt
      const userPrompt = this.buildUserPrompt(question, relevantData, options);

      // Create context
      const context = this.buildPromptContext(question, relevantData, documentType);

      return {
        systemPrompt,
        userPrompt,
        context,
        dataMapping: relevantData
      };

    } catch (error) {
      this.logger.error('Failed to generate QC prompt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        questionId: question.id
      });

      // Return fallback prompt
      return {
        systemPrompt: `You are a quality control expert reviewing ${documentType} documents.`,
        userPrompt: `Please analyze: ${question.question}`,
        context: { questionId: question.id, documentType },
        dataMapping: {}
      };
    }
  }

  /**
   * Generate batch prompts for multiple questions
   */
  async generateBatchQCPrompts(
    questions: QCQuestion[],
    availableData: Record<string, any>,
    documentType: string,
    options: QCPromptGenerationOptions = {}
  ): Promise<Record<string, PromptTemplate>> {
    const prompts: Record<string, PromptTemplate> = {};

    for (const question of questions) {
      try {
        prompts[question.id] = await this.generateQCPrompt(
          question,
          availableData,
          documentType,
          options
        );
      } catch (error) {
        this.logger.error('Failed to generate prompt for question', {
          error: error instanceof Error ? error.message : 'Unknown error',
          questionId: question.id
        });
      }
    }

    return prompts;
  }

  /**
   * Generate category-level prompt for comprehensive analysis
   */
  async generateCategoryPrompt(
    categoryName: string,
    questions: QCQuestion[],
    availableData: Record<string, any>,
    documentType: string,
    options: QCPromptGenerationOptions = {}
  ): Promise<PromptTemplate> {
    try {
      this.logger.debug('Generating category prompt', {
        categoryName,
        questionCount: questions.length,
        documentType
      });

      // Collect all relevant data for the category
      const categoryData = this.extractCategoryData(questions, availableData);

      // Build comprehensive system prompt
      const systemPrompt = this.buildCategorySystemPrompt(
        categoryName,
        questions,
        documentType,
        options
      );

      // Build comprehensive user prompt
      const userPrompt = this.buildCategoryUserPrompt(
        categoryName,
        questions,
        categoryData,
        options
      );

      const context = {
        categoryName,
        documentType,
        questionCount: questions.length,
        dataFields: Object.keys(categoryData),
        analysisScope: 'category'
      };

      return {
        systemPrompt,
        userPrompt,
        context,
        dataMapping: categoryData
      };

    } catch (error) {
      this.logger.error('Failed to generate category prompt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        categoryName
      });

      return {
        systemPrompt: `You are a quality control expert reviewing ${documentType} documents for ${categoryName}.`,
        userPrompt: `Please analyze all aspects of ${categoryName} for compliance and accuracy.`,
        context: { categoryName, documentType },
        dataMapping: {}
      };
    }
  }

  // ============================================================================
  // Private Methods - System Prompt Generation
  // ============================================================================

  private buildSystemPrompt(
    question: QCQuestion,
    documentType: string,
    options: QCPromptGenerationOptions
  ): string {
    let prompt = `You are an expert quality control analyst specializing in ${documentType} document review. `;

    // Add role-specific context based on question priority
    switch (question.priority) {
      case 'critical':
        prompt += `This is a CRITICAL compliance check that must be thoroughly validated. `;
        break;
      case 'high':
        prompt += `This is a high-priority quality check requiring careful analysis. `;
        break;
      case 'medium':
        prompt += `This is a standard quality check requiring professional review. `;
        break;
      case 'low':
        prompt += `This is an informational check for completeness. `;
        break;
    }

    // Add question-type specific instructions
    switch (question.type) {
      case 'yes_no':
      case 'boolean':
        prompt += `Provide a clear yes/no answer with supporting reasoning. `;
        break;
      case 'multiple_choice':
        prompt += `Select the most appropriate answer from the provided options. `;
        break;
      case 'numeric':
        prompt += `Provide accurate numerical analysis with calculations if needed. `;
        break;
      case 'text':
        prompt += `Provide detailed textual analysis with specific observations. `;
        break;
      case 'data_validation':
        prompt += `Validate data accuracy and completeness against industry standards. `;
        break;
      case 'ai_analysis':
        prompt += `Perform comprehensive AI-powered analysis with confidence scoring. `;
        break;
    }

    // Add AI analysis specific instructions
    if (question.aiAnalysis) {
      if (question.aiAnalysis.prompt) {
        prompt += question.aiAnalysis.prompt + ' ';
      }

      if (question.aiAnalysis.requiresHumanReview) {
        prompt += `Flag this for human review if confidence is below 90%. `;
      }
    }

    // Add documentation requirements
    if (question.documentationRequirements && question.documentationRequirements.length > 0) {
      prompt += `Reference specific document sections and provide citations: `;
      for (const docReq of question.documentationRequirements) {
        prompt += `${docReq.name} (${docReq.sectionReference || 'any section'}), `;
      }
    }

    // Add response format instructions
    prompt += `\n\nRESPONSE FORMAT:\n`;
    prompt += `Provide your analysis in JSON format with these fields:\n`;
    prompt += `{\n`;
    prompt += `  "answer": "your_specific_answer",\n`;
    prompt += `  "confidence": 0.95,\n`;
    prompt += `  "reasoning": "detailed_explanation",\n`;
    prompt += `  "citations": ["specific_document_references"],\n`;
    prompt += `  "flags": ["any_concerns_or_issues"],\n`;
    prompt += `  "recommendations": ["suggested_actions_if_applicable"]\n`;
    prompt += `}\n\n`;

    // Add quality standards
    prompt += `QUALITY STANDARDS:\n`;
    prompt += `- Be precise and factual\n`;
    prompt += `- Cite specific sources\n`;
    prompt += `- Identify any inconsistencies\n`;
    prompt += `- Flag regulatory compliance issues\n`;
    prompt += `- Provide actionable recommendations\n`;

    return prompt;
  }

  private buildCategorySystemPrompt(
    categoryName: string,
    questions: QCQuestion[],
    documentType: string,
    options: QCPromptGenerationOptions
  ): string {
    let prompt = `You are an expert quality control analyst performing comprehensive review of ${categoryName} in ${documentType} documents. `;

    // Add category-specific context
    prompt += `This category contains ${questions.length} quality checks covering multiple aspects of ${categoryName}. `;

    // Identify critical questions
    const criticalQuestions = questions.filter(q => q.priority === 'critical');
    if (criticalQuestions.length > 0) {
      prompt += `${criticalQuestions.length} of these checks are CRITICAL and must pass for compliance. `;
    }

    // Add comprehensive analysis instructions
    prompt += `\n\nANALYSIS APPROACH:\n`;
    prompt += `1. Review all provided data systematically\n`;
    prompt += `2. Cross-reference related fields for consistency\n`;
    prompt += `3. Identify patterns and anomalies\n`;
    prompt += `4. Check against industry standards\n`;
    prompt += `5. Flag all compliance issues\n`;

    prompt += `\n\nRESPONSE FORMAT:\n`;
    prompt += `Provide comprehensive analysis in JSON format:\n`;
    prompt += `{\n`;
    prompt += `  "categoryName": "${categoryName}",\n`;
    prompt += `  "overallScore": 85,\n`;
    prompt += `  "overallStatus": "pass|fail|review_required",\n`;
    prompt += `  "criticalIssues": ["list_of_critical_problems"],\n`;
    prompt += `  "questionResults": {\n`;
    prompt += `    "question_id_1": {\n`;
    prompt += `      "answer": "specific_answer",\n`;
    prompt += `      "confidence": 0.95,\n`;
    prompt += `      "reasoning": "explanation",\n`;
    prompt += `      "status": "pass|fail"\n`;
    prompt += `    }\n`;
    prompt += `  },\n`;
    prompt += `  "summary": "overall_assessment",\n`;
    prompt += `  "recommendations": ["action_items"]\n`;
    prompt += `}\n`;

    return prompt;
  }

  // ============================================================================
  // Private Methods - User Prompt Generation
  // ============================================================================

  private buildUserPrompt(
    question: QCQuestion,
    relevantData: Record<string, any>,
    options: QCPromptGenerationOptions
  ): string {
    let prompt = `QUALITY CONTROL ANALYSIS REQUEST\n\n`;

    // Add question details
    prompt += `Question: ${question.question}\n\n`;

    if (question.description) {
      prompt += `Context: ${question.description}\n\n`;
    }

    // Add help text if available
    if (question.helpText) {
      prompt += `Guidelines: ${question.helpText}\n\n`;
    }

    // Add available options for multiple choice questions
    if (question.options && question.options.length > 0) {
      prompt += `Available Options:\n`;
      for (let i = 0; i < question.options.length; i++) {
        prompt += `${i + 1}. ${question.options[i]}\n`;
      }
      prompt += `\n`;
    }

    // Add relevant data
    if (Object.keys(relevantData).length > 0) {
      prompt += `AVAILABLE DATA:\n`;
      for (const [key, value] of Object.entries(relevantData)) {
        const displayValue = this.formatDataValue(value);
        prompt += `• ${key}: ${displayValue}\n`;
      }
      prompt += `\n`;
    } else {
      prompt += `AVAILABLE DATA: No specific data found for this question.\n\n`;
    }

    // Add examples if requested and available
    if (options.includeExamples && question.examples && question.examples.length > 0) {
      prompt += `EXAMPLES:\n`;
      for (const example of question.examples) {
        prompt += `• ${example}\n`;
      }
      prompt += `\n`;
    }

    // Add references if requested and available
    if (options.includeReferences && question.references && question.references.length > 0) {
      prompt += `REFERENCES:\n`;
      for (const ref of question.references) {
        prompt += `• ${ref.title}`;
        if (ref.section) {
          prompt += ` (Section: ${ref.section})`;
        }
        if (ref.url) {
          prompt += ` - ${ref.url}`;
        }
        prompt += `\n`;
      }
      prompt += `\n`;
    }

    // Add data requirements context
    if (question.dataRequirements && question.dataRequirements.length > 0) {
      const missingData = question.dataRequirements.filter(req => 
        !(req.id in relevantData) || relevantData[req.id] === undefined || relevantData[req.id] === null
      );

      if (missingData.length > 0) {
        prompt += `NOTE: The following required data is missing or unavailable:\n`;
        for (const missing of missingData) {
          prompt += `• ${missing.name}: ${missing.description}\n`;
        }
        prompt += `Please note any limitations in your analysis due to missing data.\n\n`;
      }
    }

    // Add passing criteria if defined
    if (question.passingCriteria) {
      prompt += `PASSING CRITERIA:\n`;
      if (question.passingCriteria.minScore) {
        prompt += `• Minimum score required: ${question.passingCriteria.minScore}\n`;
      }
      if (question.passingCriteria.requiredAnswer) {
        prompt += `• Required answer: ${question.passingCriteria.requiredAnswer}\n`;
      }
      prompt += `\n`;
    }

    prompt += `Please provide your analysis following the specified JSON format.`;

    return prompt;
  }

  private buildCategoryUserPrompt(
    categoryName: string,
    questions: QCQuestion[],
    categoryData: Record<string, any>,
    options: QCPromptGenerationOptions
  ): string {
    let prompt = `COMPREHENSIVE CATEGORY ANALYSIS REQUEST\n\n`;
    prompt += `Category: ${categoryName}\n`;
    prompt += `Questions to Analyze: ${questions.length}\n\n`;

    // List all questions in this category
    prompt += `QUESTIONS TO REVIEW:\n`;
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (question) {
        prompt += `${i + 1}. [${question.priority.toUpperCase()}] ${question.question}\n`;
        if (question.description) {
          prompt += `   Context: ${question.description}\n`;
        }
      }
    }
    prompt += `\n`;

    // Add all available data
    if (Object.keys(categoryData).length > 0) {
      prompt += `AVAILABLE DATA FOR ANALYSIS:\n`;
      for (const [key, value] of Object.entries(categoryData)) {
        const displayValue = this.formatDataValue(value);
        prompt += `• ${key}: ${displayValue}\n`;
      }
      prompt += `\n`;
    }

    prompt += `Please analyze each question systematically and provide comprehensive results in the specified JSON format.`;

    return prompt;
  }

  // ============================================================================
  // Private Methods - Data Extraction
  // ============================================================================

  private extractRelevantData(
    question: QCQuestion,
    availableData: Record<string, any>
  ): Record<string, any> {
    const relevantData: Record<string, any> = {};

    // Extract data based on question requirements
    for (const dataReq of question.dataRequirements) {
      try {
        let value = this.extractDataByPath(availableData, dataReq.sourcePath || dataReq.id);

        // Apply transformations if specified
        if (value !== undefined && dataReq.transformation) {
          value = this.applyDataTransformation(value, dataReq.transformation);
        }

        // Use fallback if needed
        if (value === undefined || value === null) {
          value = dataReq.fallbackValue;
        }

        // Validate extracted data
        if (value !== undefined && this.validateDataRequirement(value, dataReq)) {
          relevantData[dataReq.id] = value;
        }

      } catch (error) {
        this.logger.warn('Failed to extract data requirement', {
          questionId: question.id,
          dataReqId: dataReq.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Use fallback value
        if (dataReq.fallbackValue !== undefined) {
          relevantData[dataReq.id] = dataReq.fallbackValue;
        }
      }
    }

    return relevantData;
  }

  private extractCategoryData(
    questions: QCQuestion[],
    availableData: Record<string, any>
  ): Record<string, any> {
    const categoryData: Record<string, any> = {};

    for (const question of questions) {
      const questionData = this.extractRelevantData(question, availableData);
      
      // Merge question data into category data
      for (const [key, value] of Object.entries(questionData)) {
        if (!(key in categoryData)) {
          categoryData[key] = value;
        }
      }
    }

    return categoryData;
  }

  private extractDataByPath(data: Record<string, any>, path?: string): any {
    if (!path) return undefined;

    let current = data;
    const pathParts = path.split('.');

    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  // ============================================================================
  // Private Methods - Data Processing
  // ============================================================================

  private formatDataValue(value: any): string {
    if (value === null || value === undefined) {
      return 'Not available';
    }

    if (typeof value === 'string') {
      return value.length > 100 ? value.substring(0, 100) + '...' : value;
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (Array.isArray(value)) {
      return `Array (${value.length} items): ${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}`;
    }

    if (typeof value === 'object') {
      return `Object with ${Object.keys(value).length} properties`;
    }

    return String(value);
  }

  private applyDataTransformation(value: any, transformation: string): any {
    // Basic transformation support - could be expanded
    switch (transformation) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'number':
        return Number(value);
      case 'string':
        return String(value);
      case 'boolean':
        return Boolean(value);
      default:
        return value;
    }
  }

  private validateDataRequirement(value: any, requirement: QCDataRequirement): boolean {
    try {
      // Type validation
      switch (requirement.dataType) {
        case 'string':
          if (typeof value !== 'string') return false;
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) return false;
          break;
        case 'boolean':
          if (typeof value !== 'boolean') return false;
          break;
        case 'date':
          if (!(value instanceof Date) && isNaN(Date.parse(value))) return false;
          break;
        case 'array':
          if (!Array.isArray(value)) return false;
          break;
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) return false;
          break;
      }

      // Validation rules
      if (requirement.validationRules) {
        const rules = requirement.validationRules;

        if (rules.minLength && String(value).length < rules.minLength) return false;
        if (rules.maxLength && String(value).length > rules.maxLength) return false;
        if (rules.minValue && Number(value) < rules.minValue) return false;
        if (rules.maxValue && Number(value) > rules.maxValue) return false;
        
        if (rules.pattern) {
          const regex = new RegExp(rules.pattern);
          if (!regex.test(String(value))) return false;
        }

        if (rules.allowedValues && !rules.allowedValues.includes(value)) return false;
      }

      return true;

    } catch (error) {
      this.logger.warn('Data validation failed', {
        dataReqId: requirement.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private buildPromptContext(
    question: QCQuestion,
    relevantData: Record<string, any>,
    documentType: string
  ): Record<string, any> {
    return {
      questionId: question.id,
      questionType: question.type,
      priority: question.priority,
      documentType,
      dataFields: Object.keys(relevantData),
      hasRequiredData: Object.keys(relevantData).length > 0,
      requiresHumanReview: question.aiAnalysis?.requiresHumanReview || false,
      expectedAnswerType: question.options ? 'multiple_choice' : question.type,
      validationRules: question.dataRequirements.map(req => ({
        field: req.id,
        required: req.required,
        type: req.dataType
      }))
    };
  }
}