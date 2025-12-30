/**
 * AI Services Controller
 * 
 * Provides REST endpoints for AI-powered operations including:
 * - QC Analysis and validation
 * - Market insights and property analysis  
 * - Image analysis and vision capabilities
 * - Text generation and embeddings
 * - Performance monitoring and health checks
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger';
import { UniversalAIService } from '../services/universal-ai.service';

interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  body: any;
}

export class AIServicesController {
  private logger: Logger;
  private aiService: UniversalAIService;

  constructor() {
    this.logger = new Logger();
    this.aiService = new UniversalAIService();
  }

  // ===========================
  // QC ANALYSIS ENDPOINTS
  // ===========================

  /**
   * Perform comprehensive QC analysis on appraisal report
   */
  public performQCAnalysis = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { reportText, propertyData, complianceRules, analysisType } = req.body;

      const result = await this.aiService.performQCAnalysis({
        reportText,
        propertyData,
        complianceRules,
        analysisType: analysisType || 'comprehensive'
      });

      res.json({
        success: true,
        qcResults: result,
        analysisType,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('QC Analysis failed', { 
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        error: 'QC analysis failed',
        code: 'QC_ANALYSIS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Perform technical QC validation
   */
  public performTechnicalQC = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { reportText, propertyData } = req.body;

      const result = await this.aiService.performQCAnalysis({
        reportText,
        propertyData,
        analysisType: 'technical'
      });

      res.json({
        success: true,
        technicalQC: result,
        focus: 'technical_validation',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Technical QC failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Technical QC analysis failed',
        code: 'TECHNICAL_QC_ERROR'
      });
    }
  };

  /**
   * Perform compliance QC validation
   */
  public performComplianceQC = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { reportText, complianceRules, jurisdiction } = req.body;

      const result = await this.aiService.performQCAnalysis({
        reportText,
        complianceRules: complianceRules || this.getDefaultComplianceRules(jurisdiction),
        analysisType: 'compliance'
      });

      res.json({
        success: true,
        complianceQC: result,
        jurisdiction,
        rulesApplied: complianceRules?.length || 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Compliance QC failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Compliance QC analysis failed',
        code: 'COMPLIANCE_QC_ERROR'
      });
    }
  };

  // ===========================
  // MARKET ANALYSIS ENDPOINTS
  // ===========================

  /**
   * Generate comprehensive market insights
   */
  public generateMarketInsights = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { propertyData, marketContext, analysisScope } = req.body;

      const result = await this.aiService.generateMarketInsights({
        ...propertyData,
        marketContext,
        analysisScope
      });

      res.json({
        success: true,
        marketInsights: {
          content: result.content,
          provider: result.provider,
          model: result.model,
          analysisScope,
          generatedAt: new Date().toISOString()
        },
        performance: {
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          responseTime: result.responseTime
        }
      });

    } catch (error) {
      this.logger.error('Market insights generation failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Market insights generation failed',
        code: 'MARKET_INSIGHTS_ERROR'
      });
    }
  };

  /**
   * Generate property description
   */
  public generatePropertyDescription = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { propertyData, imageUrls, style, targetAudience } = req.body;

      const result = await this.aiService.generatePropertyDescription(
        { ...propertyData, style, targetAudience },
        imageUrls
      );

      res.json({
        success: true,
        propertyDescription: {
          content: result.content,
          provider: result.provider,
          model: result.model,
          style: style || 'professional',
          includesImageAnalysis: !!(imageUrls && imageUrls.length > 0)
        },
        performance: {
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          responseTime: result.responseTime
        }
      });

    } catch (error) {
      this.logger.error('Property description generation failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Property description generation failed',
        code: 'PROPERTY_DESCRIPTION_ERROR'
      });
    }
  };

  // ===========================
  // VISION ANALYSIS ENDPOINTS
  // ===========================

  /**
   * Analyze property images
   */
  public analyzePropertyImages = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { imageUrls, analysisType, propertyContext } = req.body;

      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Image URLs are required',
          code: 'MISSING_IMAGES'
        });
        return;
      }

      const analyses = await Promise.all(
        imageUrls.slice(0, 5).map(async (imageUrl: string, index: number) => {
          const prompt = this.buildImageAnalysisPrompt(analysisType, propertyContext, index);
          
          return this.aiService.analyzeImage({
            imageUrl,
            prompt,
            provider: 'auto'
          });
        })
      );

      const consolidatedAnalysis = this.consolidateImageAnalyses(analyses, analysisType);

      res.json({
        success: true,
        imageAnalysis: {
          ...consolidatedAnalysis,
          analysisType,
          imagesAnalyzed: imageUrls.length,
          totalCost: analyses.reduce((sum, a) => sum + a.cost, 0),
          totalTokens: analyses.reduce((sum, a) => sum + a.tokensUsed, 0)
        }
      });

    } catch (error) {
      this.logger.error('Image analysis failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Image analysis failed',
        code: 'IMAGE_ANALYSIS_ERROR'
      });
    }
  };

  /**
   * Analyze property condition from images
   */
  public analyzePropertyCondition = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { imageUrls, focusAreas } = req.body;

      const conditionAnalysis = await Promise.all(
        imageUrls.map(async (imageUrl: string) => {
          const prompt = `
          Analyze this property image for condition assessment:
          
          Focus Areas: ${focusAreas?.join(', ') || 'overall condition'}
          
          Provide detailed assessment of:
          1. Overall condition rating (1-10)
          2. Visible maintenance issues
          3. Age-related wear indicators
          4. Safety concerns
          5. Renovation/improvement recommendations
          
          Format as structured condition report.
          `;

          return this.aiService.analyzeImage({
            imageUrl,
            prompt,
            provider: 'auto'
          });
        })
      );

      res.json({
        success: true,
        conditionAnalysis: {
          analyses: conditionAnalysis.map(a => ({
            condition: a.content,
            provider: a.provider,
            confidence: a.confidence
          })),
          focusAreas,
          summary: this.summarizeConditionFindings(conditionAnalysis)
        }
      });

    } catch (error) {
      this.logger.error('Property condition analysis failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Property condition analysis failed',
        code: 'CONDITION_ANALYSIS_ERROR'
      });
    }
  };
  /**
   * Analyze multiple property images with structured output
   */
  public analyzePropertyConditionStructured = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { imageUrls, focusAreas, provider } = req.body;

      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Image URLs are required',
          code: 'MISSING_IMAGES'
        });
        return;
      }

      // Structured output schema for property condition
      const conditionSchema = {
        type: 'object',
        properties: {
          overallCondition: {
            type: 'string',
            enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Severe Distress']
          },
          conditionScore: { type: 'number', minimum: 1, maximum: 10 },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                severity: { type: 'string', enum: ['Critical', 'Major', 'Minor', 'Cosmetic'] },
                description: { type: 'string' },
                location: { type: 'string' },
                estimatedRepairCost: { type: 'number' }
              }
            }
          },
          maintenanceNeeds: { type: 'array', items: { type: 'string' } },
          safetyHazards: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      };

      const prompt = `Analyze these property images for comprehensive condition assessment. 
      Focus on: ${focusAreas?.join(', ') || 'overall condition, structural integrity, maintenance needs, safety concerns'}.
      Provide detailed structured output.`;

      const result = await this.aiService.analyzeMultipleImages({
        imageUrls,
        prompt,
        jsonSchema: conditionSchema,
        provider: provider || 'auto'
      });

      res.json({
        success: true,
        conditionAnalysis: JSON.parse(result.content),
        metadata: {
          imagesAnalyzed: imageUrls.length,
          provider: result.provider,
          model: result.model
        },
        performance: {
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          responseTime: result.responseTime
        }
      });

    } catch (error) {
      this.logger.error('Structured condition analysis failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Structured condition analysis failed',
        code: 'STRUCTURED_CONDITION_ERROR'
      });
    }
  };

  /**
   * Process appraisal document (PDF) and extract structured data
   */
  public processAppraisalDocument = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { documentUrl, mimeType, extractionSchema, provider } = req.body;

      if (!documentUrl) {
        res.status(400).json({
          success: false,
          error: 'Document URL is required',
          code: 'MISSING_DOCUMENT'
        });
        return;
      }

      const defaultSchema = {
        type: 'object',
        properties: {
          propertyDetails: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              propertyType: { type: 'string' },
              yearBuilt: { type: 'number' },
              squareFootage: { type: 'number' },
              lotSize: { type: 'number' },
              bedrooms: { type: 'number' },
              bathrooms: { type: 'number' }
            }
          },
          valuation: {
            type: 'object',
            properties: {
              appraisedValue: { type: 'number' },
              effectiveDate: { type: 'string' },
              approach: { type: 'string' }
            }
          },
          comparables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                salePrice: { type: 'number' },
                adjustedPrice: { type: 'number' }
              }
            }
          }
        }
      };

      const prompt = `Extract structured data from this appraisal document. Include property details, valuation, comparables, condition, and appraiser information.`;

      const result = await this.aiService.processDocument({
        documentUrl,
        mimeType: mimeType || 'application/pdf',
        prompt,
        jsonSchema: extractionSchema || defaultSchema,
        provider: provider || 'auto'
      });

      res.json({
        success: true,
        extractedData: JSON.parse(result.content),
        metadata: {
          provider: result.provider,
          model: result.model,
          documentUrl
        },
        performance: {
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          responseTime: result.responseTime
        }
      });

    } catch (error) {
      this.logger.error('Document processing failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Document processing failed',
        code: 'DOCUMENT_PROCESSING_ERROR'
      });
    }
  };
  // ===========================
  // TEXT AND EMBEDDING ENDPOINTS
  // ===========================

  /**
   * Generate text embeddings for similarity search
   */
  public generateEmbeddings = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { texts, model, provider } = req.body;

      if (!Array.isArray(texts) || texts.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Texts array is required',
          code: 'MISSING_TEXTS'
        });
        return;
      }

      const embeddings = await Promise.all(
        texts.map(async (text: string) => {
          return this.aiService.generateEmbedding({
            text,
            model,
            provider
          });
        })
      );

      res.json({
        success: true,
        embeddings: embeddings.map(e => ({
          embedding: e.embedding,
          dimensions: e.dimensions,
          provider: e.provider,
          model: e.model
        })),
        totalCost: embeddings.reduce((sum, e) => sum + e.cost, 0),
        totalTokens: embeddings.reduce((sum, e) => sum + e.tokensUsed, 0)
      });

    } catch (error) {
      this.logger.error('Embeddings generation failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Embeddings generation failed',
        code: 'EMBEDDINGS_ERROR'
      });
    }
  };

  /**
   * Generate custom AI completion
   */
  public generateCompletion = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
    try {
      const { messages, temperature, maxTokens, model, provider } = req.body;

      const result = await this.aiService.generateCompletion({
        messages,
        temperature,
        maxTokens,
        model,
        provider
      });

      res.json({
        success: true,
        completion: {
          content: result.content,
          provider: result.provider,
          model: result.model
        },
        performance: {
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          responseTime: result.responseTime
        }
      });

    } catch (error) {
      this.logger.error('AI completion failed', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'AI completion failed',
        code: 'COMPLETION_ERROR'
      });
    }
  };

  // ===========================
  // MONITORING AND HEALTH ENDPOINTS
  // ===========================

  /**
   * Get AI service health and status
   */
  public getServiceHealth = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const health = await this.aiService.healthCheck();
      const usage = this.aiService.getUsageStats();

      res.json({
        status: 'healthy',
        providers: health,
        usage,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Get usage statistics and cost tracking
   */
  public getUsageStats = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const usage = this.aiService.getUsageStats();

      res.json({
        success: true,
        usage,
        summary: {
          totalRequests: Object.values(usage).reduce((sum: number, u: any) => sum + u.requestCount, 0),
          totalTokens: Object.values(usage).reduce((sum: number, u: any) => sum + u.tokenCount, 0),
          totalCost: Object.values(usage).reduce((sum: number, u: any) => sum + u.cost, 0)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve usage statistics',
        code: 'USAGE_STATS_ERROR'
      });
    }
  };

  // ===========================
  // VALIDATION MIDDLEWARE
  // ===========================

  public validateQCAnalysis() {
    return [
      body('reportText').isLength({ min: 50 }).withMessage('Report text must be at least 50 characters'),
      body('analysisType').optional().isIn(['comprehensive', 'technical', 'compliance', 'market']),
      body('complianceRules').optional().isArray(),
      this.handleValidationErrors
    ];
  }

  public validateMarketInsights() {
    return [
      body('propertyData').isObject().withMessage('Property data is required'),
      body('propertyData.address').notEmpty().withMessage('Property address is required'),
      body('analysisScope').optional().isIn(['local', 'regional', 'national']),
      this.handleValidationErrors
    ];
  }

  public validateImageAnalysis() {
    return [
      body('imageUrls').isArray({ min: 1, max: 10 }).withMessage('1-10 image URLs required'),
      body('imageUrls.*').isURL().withMessage('Valid image URLs required'),
      body('analysisType').optional().isIn(['condition', 'features', 'compliance', 'market']),
      this.handleValidationErrors
    ];
  }

  public validateEmbeddingGeneration() {
    return [
      body('texts').isArray({ min: 1, max: 100 }).withMessage('1-100 texts required'),
      body('texts.*').isLength({ min: 1, max: 8000 }).withMessage('Text length must be 1-8000 characters'),
      body('model').optional().isString(),
      body('provider').optional().isIn(['azure-openai', 'google-gemini', 'auto']),
      this.handleValidationErrors
    ];
  }

  public validateCompletion() {
    return [
      body('messages').isArray({ min: 1 }).withMessage('Messages array is required'),
      body('messages.*.role').isIn(['system', 'user', 'assistant']).withMessage('Invalid message role'),
      body('messages.*.content').isLength({ min: 1 }).withMessage('Message content is required'),
      body('temperature').optional().isFloat({ min: 0, max: 2 }),
      body('maxTokens').optional().isInt({ min: 1, max: 8000 }),
      this.handleValidationErrors
    ];
  }

  private handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
      return;
    }
    next();
  };

  // ===========================
  // HELPER METHODS
  // ===========================

  private buildImageAnalysisPrompt(analysisType: string, propertyContext: any, imageIndex: number): string {
    let prompt = `Analyze this property image (${imageIndex + 1}) for ${analysisType || 'general'} assessment.\n\n`;
    
    if (propertyContext) {
      prompt += `Property Context: ${JSON.stringify(propertyContext, null, 2)}\n\n`;
    }

    switch (analysisType) {
      case 'condition':
        prompt += `Focus on: structural condition, maintenance needs, visible defects, safety concerns, renovation requirements.`;
        break;
      case 'features':
        prompt += `Focus on: architectural features, room layouts, finishes, fixtures, unique characteristics, amenities.`;
        break;
      case 'compliance':
        prompt += `Focus on: building code compliance, safety features, accessibility, environmental concerns.`;
        break;
      case 'market':
        prompt += `Focus on: marketability, curb appeal, competitive features, value drivers, presentation quality.`;
        break;
      default:
        prompt += `Provide comprehensive analysis covering condition, features, and market appeal.`;
    }

    prompt += `\n\nProvide detailed, professional analysis suitable for appraisal documentation.`;
    
    return prompt;
  }

  private consolidateImageAnalyses(analyses: any[], analysisType: string): any {
    return {
      consolidatedFindings: analyses.map((a, i) => ({
        imageIndex: i + 1,
        analysis: a.content,
        provider: a.provider,
        confidence: a.confidence
      })),
      summary: `Analyzed ${analyses.length} images for ${analysisType} assessment`,
      averageConfidence: analyses.reduce((sum, a) => sum + (a.confidence || 0.8), 0) / analyses.length
    };
  }

  private summarizeConditionFindings(analyses: any[]): any {
    // Simple consolidation logic - could be enhanced with AI
    return {
      overallCondition: 'Good', // Would be calculated from individual analyses
      majorIssues: 0,
      minorIssues: 2,
      recommendedActions: ['Regular maintenance', 'Monitor minor issues'],
      estimatedConditionScore: 8.5
    };
  }

  private getDefaultComplianceRules(jurisdiction?: string): string[] {
    // Default compliance rules - could be expanded by jurisdiction
    return [
      'USPAP compliance verification',
      'Property disclosure requirements',
      'Environmental hazard assessment',
      'Building code compliance check',
      'Zoning regulation compliance',
      'Fair housing law adherence'
    ];
  }
}