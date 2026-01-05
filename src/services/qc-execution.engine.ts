/**
 * QC Execution Engine
 * Handles the execution of QC reviews using dynamic checklists and AI services
 */

import { Logger } from '../utils/logger.js';
import { UniversalAIService } from './universal-ai.service';
import {
  QCChecklist,
  QCExecutionContext,
  QCExecutionResult,
  QCAnswer,
  QCStatus,
  QCPriority,
  QCQuestion,
  QCConditionalLogic,
  ExecuteQCReviewRequest,
  QCResultsSummaryResponse
} from '../types/qc-checklist.types.js';
import { ApiResponse } from '../types/index.js';
import { createApiError } from '../utils/api-response.util.js';

export interface QCPromptTemplate {
  systemPrompt: string;
  userPrompt: string;
  context: Record<string, any>;
}

export class QCExecutionEngine {
  private logger: Logger;
  private aiService: UniversalAIService;

  constructor() {
    this.logger = new Logger('QCExecutionEngine');
    this.aiService = new UniversalAIService();
  }

  /**
   * Execute a complete QC review using a checklist and document data
   */
  async executeQCReview(
    checklist: QCChecklist,
    documentData: Record<string, any>,
    context: QCExecutionContext
  ): Promise<ApiResponse<QCExecutionResult>> {
    try {
      this.logger.info('Starting QC review execution', {
        checklistId: checklist.id,
        documentType: checklist.documentType,
        executionId: context.executionId
      });

      const startTime = new Date();
      const result: QCExecutionResult = {
        id: this.generateExecutionId(),
        checklistId: checklist.id,
        executionContext: context,
        startedAt: startTime,
        status: QCStatus.IN_PROGRESS,
        overallScore: 0,
        passed: false,
        categoryResults: [],
        criticalIssues: [],
        auditTrail: [{
          timestamp: startTime,
          action: 'QC_REVIEW_STARTED',
          userId: context.userId,
          details: { checklistId: checklist.id, executionId: context.executionId }
        }]
      };

      // Process each category
      let totalScore = 0;
      let totalWeight = 0;
      let allCategoriesPassed = true;

      for (const category of checklist.categories) {
        // Check if category should be included based on conditional logic
        if (category.conditionalLogic && !this.evaluateConditionalLogic(category.conditionalLogic, documentData)) {
          this.logger.debug('Category skipped due to conditional logic', { categoryId: category.id });
          continue;
        }

        const categoryResult = await this.processCategoryQC(category, documentData, context);
        result.categoryResults.push(categoryResult);

        // Update overall scoring
        const categoryWeight = this.calculateCategoryWeight(category);
        totalScore += (categoryResult.score || 0) * categoryWeight;
        totalWeight += categoryWeight;

        if (!categoryResult.passed) {
          allCategoriesPassed = false;
        }

        // Collect critical issues
        for (const subcategoryResult of categoryResult.subcategoryResults) {
          for (const questionResult of subcategoryResult.questionResults) {
            if (!questionResult.passed && questionResult.answer) {
              const question = this.findQuestionById(checklist, questionResult.questionId);
              if (question && question.priority === QCPriority.CRITICAL) {
                result.criticalIssues.push({
                  questionId: questionResult.questionId,
                  issue: `Critical QC failure: ${question.question}`,
                  severity: 'critical',
                  recommendedAction: 'Review and address before proceeding'
                });
              }
            }
          }
        }
      }

      // Calculate final results
      result.overallScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
      result.passed = allCategoriesPassed && 
                     result.overallScore >= (checklist.passingScore || 70) && 
                     result.criticalIssues.length === 0;

      result.status = result.passed ? QCStatus.COMPLETED : QCStatus.FAILED;
      result.completedAt = new Date();

      // Add completion audit entry
      result.auditTrail.push({
        timestamp: result.completedAt,
        action: 'QC_REVIEW_COMPLETED',
        userId: context.userId,
        details: {
          passed: result.passed,
          score: result.overallScore,
          criticalIssues: result.criticalIssues.length
        }
      });

      this.logger.info('QC review execution completed', {
        executionId: result.id,
        passed: result.passed,
        score: result.overallScore,
        criticalIssues: result.criticalIssues.length
      });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      this.logger.error('QC review execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checklistId: checklist.id,
        executionId: context.executionId
      });

      return {
        success: false,
        error: createApiError('QC_EXECUTION_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  /**
   * Process a single category in the QC checklist
   */
  private async processCategoryQC(
    category: any,
    documentData: Record<string, any>,
    context: QCExecutionContext
  ): Promise<any> {
    this.logger.debug('Processing category QC', { categoryId: category.id, categoryName: category.name });

    const categoryResult = {
      categoryId: category.id,
      status: QCStatus.IN_PROGRESS,
      score: 0,
      passed: false,
      subcategoryResults: [] as any[]
    };

    let totalScore = 0;
    let totalWeight = 0;
    let allSubcategoriesPassed = true;

    for (const subcategory of category.subcategories) {
      // Check subcategory conditional logic
      if (subcategory.conditionalLogic && !this.evaluateConditionalLogic(subcategory.conditionalLogic, documentData)) {
        this.logger.debug('Subcategory skipped due to conditional logic', { subcategoryId: subcategory.id });
        continue;
      }

      const subcategoryResult = await this.processSubcategoryQC(subcategory, documentData, context);
      categoryResult.subcategoryResults.push(subcategoryResult);

      // Update category scoring
      const subcategoryWeight = this.calculateSubcategoryWeight(subcategory);
      totalScore += (subcategoryResult.score || 0) * subcategoryWeight;
      totalWeight += subcategoryWeight;

      if (!subcategoryResult.passed) {
        allSubcategoriesPassed = false;
      }
    }

    // Calculate category results
    categoryResult.score = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
    categoryResult.passed = allSubcategoriesPassed && 
                           categoryResult.score >= (category.passingThreshold || 70);
    categoryResult.status = categoryResult.passed ? QCStatus.COMPLETED : QCStatus.FAILED;

    return categoryResult;
  }

  /**
   * Process a single subcategory in the QC checklist
   */
  private async processSubcategoryQC(
    subcategory: any,
    documentData: Record<string, any>,
    context: QCExecutionContext
  ): Promise<any> {
    this.logger.debug('Processing subcategory QC', { subcategoryId: subcategory.id, subcategoryName: subcategory.name });

    const subcategoryResult = {
      subcategoryId: subcategory.id,
      status: QCStatus.IN_PROGRESS,
      score: 0,
      passed: false,
      questionResults: [] as any[]
    };

    let totalScore = 0;
    let totalWeight = 0;
    let allQuestionsPassed = true;

    for (const question of subcategory.questions) {
      // Check question conditional logic
      if (question.conditionalLogic && !this.evaluateConditionalLogic(question.conditionalLogic, documentData)) {
        this.logger.debug('Question skipped due to conditional logic', { questionId: question.id });
        continue;
      }

      const questionResult = await this.processQuestionQC(question, documentData, context);
      subcategoryResult.questionResults.push(questionResult);

      // Update subcategory scoring
      const questionWeight = question.scoringWeight || 1;
      totalScore += (questionResult.score || 0) * questionWeight;
      totalWeight += questionWeight;

      if (!questionResult.passed) {
        allQuestionsPassed = false;
      }
    }

    // Calculate subcategory results
    subcategoryResult.score = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
    subcategoryResult.passed = allQuestionsPassed && 
                              subcategoryResult.score >= (subcategory.passingThreshold || 70);
    subcategoryResult.status = subcategoryResult.passed ? QCStatus.COMPLETED : QCStatus.FAILED;

    return subcategoryResult;
  }

  /**
   * Process a single question in the QC checklist
   */
  private async processQuestionQC(
    question: QCQuestion,
    documentData: Record<string, any>,
    context: QCExecutionContext
  ): Promise<any> {
    this.logger.debug('Processing question QC', { questionId: question.id, question: question.question });

    interface QuestionExecutionResult {
      questionId: string;
      status: QCStatus;
      score: number;
      passed: boolean;
      validationErrors: string[];
      answer?: any;
      aiAnalysisResult?: any;
    }

    const questionResult: QuestionExecutionResult = {
      questionId: question.id,
      status: QCStatus.IN_PROGRESS,
      score: 0,
      passed: false,
      validationErrors: [],
      answer: undefined,
      aiAnalysisResult: undefined
    };

    try {
      // Extract required data for this question
      const questionData = this.extractQuestionData(question, documentData);

      // Generate AI prompt for this question
      const prompt = await this.generateQuestionPrompt(question, questionData, documentData);

      // Execute AI analysis if configured
      if (question.aiAnalysis) {
        const aiResult = await this.executeAIAnalysis(question, prompt, questionData, context);
        questionResult.aiAnalysisResult = aiResult;

        if (aiResult.result) {
          // Create answer from AI result
          const answer: QCAnswer = {
            questionId: question.id,
            value: aiResult.result.answer || aiResult.result,
            confidence: aiResult.confidence,
            source: 'ai',
            timestamp: new Date(),
            supportingData: questionData,
            citations: aiResult.result.citations || []
          };

          questionResult.answer = answer;

          // Validate the answer
          const validation = this.validateAnswer(question, answer);
          questionResult.passed = validation.passed;
          questionResult.score = validation.score;
          questionResult.validationErrors = validation.errors;
        }
      }

      questionResult.status = questionResult.passed ? QCStatus.COMPLETED : QCStatus.FAILED;

    } catch (error) {
      this.logger.error('Question processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        questionId: question.id
      });

      questionResult.status = QCStatus.FAILED;
      questionResult.validationErrors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return questionResult;
  }

  /**
   * Extract data needed for a specific question
   */
  private extractQuestionData(question: QCQuestion, documentData: Record<string, any>): Record<string, any> {
    const extractedData: Record<string, any> = {};

    for (const dataReq of question.dataRequirements) {
      try {
        let value = documentData;

        // Navigate through the source path
        if (dataReq.sourcePath) {
          const pathParts = dataReq.sourcePath.split('.');
          for (const part of pathParts) {
            value = value?.[part];
          }
        }

        // Apply fallback if needed
        if (value === undefined || value === null) {
          value = dataReq.fallbackValue;
        }

        extractedData[dataReq.id] = value;

      } catch (error) {
        this.logger.warn('Failed to extract data requirement', {
          dataReqId: dataReq.id,
          sourcePath: dataReq.sourcePath,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        extractedData[dataReq.id] = dataReq.fallbackValue;
      }
    }

    return extractedData;
  }

  /**
   * Generate an AI prompt for a specific question
   */
  private async generateQuestionPrompt(
    question: QCQuestion,
    questionData: Record<string, any>,
    fullDocumentData: Record<string, any>
  ): Promise<QCPromptTemplate> {
    // Build dynamic prompt based on question configuration
    let systemPrompt = `You are a quality control expert reviewing ${question.type} items for compliance and accuracy. `;
    systemPrompt += `Focus on ${question.priority} priority items. `;
    
    if (question.aiAnalysis?.prompt) {
      systemPrompt += question.aiAnalysis.prompt + ' ';
    }

    systemPrompt += `Provide detailed analysis with specific citations and confidence scores.`;

    let userPrompt = `Question: ${question.question}\n\n`;
    
    if (question.description) {
      userPrompt += `Context: ${question.description}\n\n`;
    }

    userPrompt += `Available Data:\n`;
    for (const [key, value] of Object.entries(questionData)) {
      userPrompt += `- ${key}: ${JSON.stringify(value)}\n`;
    }

    if (question.options && question.options.length > 0) {
      userPrompt += `\nPossible Answers: ${question.options.join(', ')}\n`;
    }

    userPrompt += `\nProvide your analysis in JSON format with: { "answer": "your_answer", "confidence": 0.95, "reasoning": "explanation", "citations": ["source1", "source2"] }`;

    return {
      systemPrompt,
      userPrompt,
      context: {
        questionType: question.type,
        priority: question.priority,
        documentType: 'appraisal',
        dataAvailable: Object.keys(questionData)
      }
    };
  }

  /**
   * Execute AI analysis for a question
   */
  private async executeAIAnalysis(
    question: QCQuestion,
    prompt: QCPromptTemplate,
    questionData: Record<string, any>,
    context: QCExecutionContext
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Use Universal AI Service for analysis
      const aiResponse = await this.aiService.generateCompletion({
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt }
        ],
        model: question.aiAnalysis?.model || 'gpt-4',
        temperature: 0.1, // Low temperature for consistency
        maxTokens: 2000,
        provider: (context.aiProvider === 'azure' ? 'azure-openai' : 
                  context.aiProvider === 'google' ? 'google-gemini' : 'auto') as 'azure-openai' | 'google-gemini' | 'auto'
      });

      if (!aiResponse || !aiResponse.content) {
        throw new Error(`AI analysis failed: No response content available`);
      }

      // Parse AI response
      let result: any;
      try {
        result = JSON.parse(aiResponse.content || '{}');
      } catch {
        // Fallback if response is not JSON
        result = {
          answer: aiResponse.content,
          confidence: 0.7,
          reasoning: 'AI provided text response without structured format'
        };
      }

      return {
        analysisType: question.aiAnalysis?.analysisType || 'text_analysis',
        result,
        confidence: result.confidence || 0.7,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('AI analysis failed for question', {
        questionId: question.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        analysisType: question.aiAnalysis?.analysisType || 'text_analysis',
        result: { error: 'AI analysis failed' },
        confidence: 0,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate an answer against question criteria
   */
  private validateAnswer(question: QCQuestion, answer: QCAnswer): { passed: boolean; score: number; errors: string[] } {
    const validation: { passed: boolean; score: number; errors: string[] } = {
      passed: false,
      score: 0,
      errors: []
    };

    try {
      // Check if answer exists
      if (answer.value === undefined || answer.value === null) {
        validation.errors.push('No answer provided');
        return validation;
      }

      // Validate based on question type
      switch (question.type) {
        case 'yes_no':
        case 'boolean':
          if (typeof answer.value === 'boolean' || 
              answer.value === 'yes' || answer.value === 'no' ||
              answer.value === 'Yes' || answer.value === 'No') {
            validation.passed = true;
            validation.score = 100;
          } else {
            validation.errors.push('Expected yes/no or boolean answer');
          }
          break;

        case 'multiple_choice':
          if (question.options && question.options.includes(answer.value)) {
            validation.passed = true;
            validation.score = 100;
          } else {
            validation.errors.push(`Answer must be one of: ${question.options?.join(', ')}`);
          }
          break;

        case 'numeric':
          if (!isNaN(Number(answer.value))) {
            validation.passed = true;
            validation.score = 100;
          } else {
            validation.errors.push('Expected numeric answer');
          }
          break;

        default:
          // For text and other types, consider it valid if not empty
          if (String(answer.value).trim().length > 0) {
            validation.passed = true;
            validation.score = 100;
          } else {
            validation.errors.push('Expected non-empty answer');
          }
      }

      // Apply confidence penalty if AI confidence is low
      if (answer.confidence && answer.confidence < 0.7) {
        validation.score *= answer.confidence;
        if (answer.confidence < 0.5) {
          validation.errors.push('Low AI confidence in answer');
        }
      }

      // Check passing criteria if defined
      if (question.passingCriteria) {
        if (question.passingCriteria.minScore && validation.score < question.passingCriteria.minScore) {
          validation.passed = false;
          validation.errors.push(`Score ${validation.score} below minimum ${question.passingCriteria.minScore}`);
        }

        if (question.passingCriteria.requiredAnswer && answer.value !== question.passingCriteria.requiredAnswer) {
          validation.passed = false;
          validation.errors.push(`Expected answer: ${question.passingCriteria.requiredAnswer}`);
        }
      }

    } catch (error) {
      validation.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return validation;
  }

  /**
   * Generate execution summary
   */
  async generateQCResultsSummary(result: QCExecutionResult): Promise<QCResultsSummaryResponse> {
    const summary: QCResultsSummaryResponse = {
      executionId: result.id,
      checklistName: 'QC Review', // Would come from checklist lookup
      documentType: result.executionContext.documentType,
      overallScore: result.overallScore || 0,
      passed: result.passed,
      status: result.status,
      totalQuestions: 0,
      answeredQuestions: 0,
      passedQuestions: 0,
      failedQuestions: 0,
      criticalIssuesCount: result.criticalIssues.length,
      categoryBreakdown: [],
      startedAt: result.startedAt
    };

    // Calculate summary statistics
    for (const categoryResult of result.categoryResults) {
      let categoryQuestions = 0;
      let categoryAnswered = 0;
      let categoryPassed = 0;
      let categoryFailed = 0;

      for (const subcategoryResult of categoryResult.subcategoryResults) {
        for (const questionResult of subcategoryResult.questionResults) {
          categoryQuestions++;
          summary.totalQuestions++;

          if (questionResult.answer) {
            categoryAnswered++;
            summary.answeredQuestions++;
          }

          if (questionResult.passed) {
            categoryPassed++;
            summary.passedQuestions++;
          } else {
            categoryFailed++;
            summary.failedQuestions++;
          }
        }
      }

      summary.categoryBreakdown.push({
        categoryId: categoryResult.categoryId,
        categoryName: categoryResult.categoryId, // Would come from checklist lookup
        score: categoryResult.score || 0,
        passed: categoryResult.passed,
        issuesCount: categoryFailed
      });
    }

    if (result.completedAt) {
      summary.completedAt = result.completedAt;
      summary.processingTimeMs = result.completedAt.getTime() - result.startedAt.getTime();
    }

    return summary;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private generateExecutionId(): string {
    return `qc_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private evaluateConditionalLogic(logic: QCConditionalLogic, data: Record<string, any>): boolean {
    // Basic implementation - would be expanded for complex conditions
    return true; // For now, always include all items
  }

  private calculateCategoryWeight(category: any): number {
    return 1; // Equal weight for now
  }

  private calculateSubcategoryWeight(subcategory: any): number {
    return 1; // Equal weight for now
  }

  private findQuestionById(checklist: QCChecklist, questionId: string): QCQuestion | undefined {
    for (const category of checklist.categories) {
      for (const subcategory of category.subcategories) {
        const question = subcategory.questions.find(q => q.id === questionId);
        if (question) return question;
      }
    }
    return undefined;
  }
}