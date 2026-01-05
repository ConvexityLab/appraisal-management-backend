/**
 * Universal AI Service for Appraisal Management Platform
 * 
 * Provides unified access to multiple AI providers with intelligent routing,
 * fallback mechanisms, cost optimization, and performance monitoring.
 * 
 * Supported Providers:
 * - Azure OpenAI (GPT-4, GPT-3.5-turbo, text-embedding-ada-002)
 * - Google Gemini (gemini-pro, gemini-pro-vision)
 * 
 * Features:
 * - Automatic provider selection based on task type and availability
 * - Cost optimization and token management
 * - Response caching and performance monitoring
 * - Failover and retry mechanisms
 * - Rate limiting and quota management
 * - Quality control and analysis capabilities
 */

import { Logger } from '../utils/logger.js';
import { GenericCacheService } from './cache/generic-cache.service';

// Types for AI operations
interface AIRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  provider?: 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo' | 'auto';
  responseFormat?: 'json' | 'text';
  jsonSchema?: any;
}

interface AIResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  responseTime: number;
  confidence?: number;
}

interface EmbeddingRequest {
  text: string;
  model?: string;
  provider?: 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo' | 'auto';
}

interface EmbeddingResponse {
  embedding: number[];
  provider: string;
  model: string;
  dimensions: number;
  tokensUsed: number;
  cost: number;
}

interface VisionRequest {
  imageUrl: string;
  prompt: string;
  model?: string;
  provider?: 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo' | 'auto';
  responseFormat?: 'json' | 'text';
  jsonSchema?: any;
}

interface DocumentProcessingRequest {
  documentUrl: string;
  mimeType: string;
  prompt: string;
  jsonSchema?: any;
  provider?: 'google-gemini' | 'azure-openai' | 'auto';
}

interface MultiImageAnalysisRequest {
  imageUrls: string[];
  prompt: string;
  jsonSchema?: any;
  provider?: 'google-gemini' | 'azure-openai' | 'sambanova' | 'certo' | 'auto';
}

interface QCAnalysisRequest {
  reportText: string;
  propertyData?: any;
  complianceRules?: string[];
  analysisType?: 'comprehensive' | 'technical' | 'compliance' | 'market';
}

interface QCAnalysisResponse extends AIResponse {
  findings: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation?: string;
    confidence: number;
  }>;
  overallScore: number;
  passFailStatus: 'pass' | 'fail' | 'conditional';
}

interface ProviderConfig {
  name: string;
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  models: {
    text: string[];
    embedding: string[];
    vision: string[];
  };
  costPerToken: {
    input: number;
    output: number;
  };
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  capabilities: string[];
  reliability: number; // 0-1 score
  latency: number; // average ms
}

interface ProviderRoutingConfig {
  textGeneration?: 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo' | 'auto';
  vision?: 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo' | 'auto';
  embeddings?: 'azure-openai' | 'google-gemini' | 'certo' | 'auto';
  qcAnalysis?: 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo' | 'auto';
  documentProcessing?: 'google-gemini' | 'azure-openai' | 'auto';
  propertyDescription?: 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo' | 'auto';
  marketInsights?: 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo' | 'auto';
}

export class UniversalAIService {
  private logger: Logger;
  private cache: GenericCacheService;
  private providers: Map<string, ProviderConfig>;
  private usage: Map<string, {
    requestCount: number;
    tokenCount: number;
    cost: number;
    lastReset: Date;
  }>;
  private circuitBreaker: Map<string, {
    failures: number;
    lastFailure: Date;
    isOpen: boolean;
  }>;
  private routingConfig: ProviderRoutingConfig;

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
    this.providers = new Map();
    this.usage = new Map();
    this.circuitBreaker = new Map();
    this.routingConfig = this.loadRoutingConfig();
    
    this.initializeProviders();
    this.setupUsageTracking();
    this.logRoutingConfiguration();
  }

  // ===========================
  // INITIALIZATION
  // ===========================

  private initializeProviders(): void {
    // Azure OpenAI Configuration
    const azureConfig: ProviderConfig = {
      name: 'Azure OpenAI',
      enabled: !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY),
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      models: {
        text: ['gpt-4', 'gpt-35-turbo', 'gpt-4-turbo'],
        embedding: ['text-embedding-ada-002'],
        vision: ['gpt-4-vision-preview', 'gpt-4o']
      },
      costPerToken: {
        input: 0.00003, // $0.03 per 1K tokens for GPT-4
        output: 0.00006 // $0.06 per 1K tokens for GPT-4
      },
      rateLimit: {
        requestsPerMinute: parseInt(process.env.AZURE_OPENAI_RPM || '300'),
        tokensPerMinute: parseInt(process.env.AZURE_OPENAI_TPM || '40000')
      },
      capabilities: ['text-generation', 'embeddings', 'vision', 'function-calling'],
      reliability: 0.99,
      latency: 1200 // ms
    };

    // Google Gemini Configuration
    const geminiConfig: ProviderConfig = {
      name: 'Google Gemini',
      enabled: !!process.env.GOOGLE_GEMINI_API_KEY,
      endpoint: process.env.GOOGLE_GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
      models: {
        text: ['gemini-pro', 'gemini-pro-vision'],
        embedding: ['embedding-001'],
        vision: ['gemini-pro-vision']
      },
      costPerToken: {
        input: 0.000125, // $0.125 per 1K tokens for Gemini Pro
        output: 0.000375 // $0.375 per 1K tokens for Gemini Pro
      },
      rateLimit: {
        requestsPerMinute: parseInt(process.env.GOOGLE_GEMINI_RPM || '60'),
        tokensPerMinute: parseInt(process.env.GOOGLE_GEMINI_TPM || '32000')
      },
      capabilities: ['text-generation', 'embeddings', 'vision', 'multimodal'],
      reliability: 0.97,
      latency: 800 // ms
    };

    // SambaNova Configuration
    const sambaNovaConfig: ProviderConfig = {
      name: 'SambaNova',
      enabled: !!(process.env.SAMBANOVA_API_KEY && process.env.SAMBANOVA_ENDPOINT),
      endpoint: process.env.SAMBANOVA_ENDPOINT || 'https://api.sambanova.ai/v1',
      apiKey: process.env.SAMBANOVA_API_KEY || '',
      models: {
        text: ['Meta-Llama-3.1-8B-Instruct', 'Meta-Llama-3.1-70B-Instruct', 'Meta-Llama-3.1-405B-Instruct'],
        embedding: [],
        vision: ['Llama-3.2-11B-Vision-Instruct', 'Llama-3.2-90B-Vision-Instruct']
      },
      costPerToken: {
        input: 0.0000006, // $0.60 per 1M tokens
        output: 0.0000006
      },
      rateLimit: {
        requestsPerMinute: parseInt(process.env.SAMBANOVA_RPM || '100'),
        tokensPerMinute: parseInt(process.env.SAMBANOVA_TPM || '100000')
      },
      capabilities: ['text-generation', 'vision', 'structured-output'],
      reliability: 0.95,
      latency: 600
    };

    // Certo (Custom vLLM) Configuration
    const certoConfig: ProviderConfig = {
      name: 'Certo AI',
      enabled: !!(process.env.CERTO_ENDPOINT && process.env.CERTO_API_KEY),
      endpoint: process.env.CERTO_ENDPOINT || 'http://localhost:8000/v1',
      apiKey: process.env.CERTO_API_KEY || '',
      models: {
        text: ['default'], // Will use whatever model is deployed
        embedding: [],
        vision: ['default']
      },
      costPerToken: {
        input: 0.0000001, // Negligible for self-hosted
        output: 0.0000001
      },
      rateLimit: {
        requestsPerMinute: parseInt(process.env.CERTO_RPM || '1000'),
        tokensPerMinute: parseInt(process.env.CERTO_TPM || '500000')
      },
      capabilities: ['text-generation', 'vision', 'embeddings', 'structured-output', 'function-calling'],
      reliability: 0.98,
      latency: 300
    };

    this.providers.set('azure-openai', azureConfig);
    this.providers.set('google-gemini', geminiConfig);
    this.providers.set('sambanova', sambaNovaConfig);
    this.providers.set('certo', certoConfig);

    // Initialize circuit breakers
    for (const [key] of Array.from(this.providers.entries())) {
      this.circuitBreaker.set(key, {
        failures: 0,
        lastFailure: new Date(0),
        isOpen: false
      });
    }

    this.logger.info('Universal AI Service initialized', {
      providers: Array.from(this.providers.keys()),
      enabledProviders: Array.from(this.providers.values()).filter(p => p.enabled).map(p => p.name)
    });
  }

  private setupUsageTracking(): void {
    // Reset usage counters every hour
    setInterval(() => {
      const now = new Date();
      for (const [provider, usage] of Array.from(this.usage.entries())) {
        const hoursSinceReset = (now.getTime() - usage.lastReset.getTime()) / (1000 * 60 * 60);
        if (hoursSinceReset >= 1) {
          this.usage.set(provider, {
            requestCount: 0,
            tokenCount: 0,
            cost: 0,
            lastReset: now
          });
        }
      }
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Load provider routing configuration from environment variables
   * 
   * Environment Variables:
   * - AI_PROVIDER_TEXT_GENERATION: Provider for text generation tasks
   * - AI_PROVIDER_VISION: Provider for image/vision analysis
   * - AI_PROVIDER_EMBEDDINGS: Provider for embeddings generation
   * - AI_PROVIDER_QC_ANALYSIS: Provider for QC analysis
   * - AI_PROVIDER_DOCUMENT_PROCESSING: Provider for PDF/document processing
   * - AI_PROVIDER_PROPERTY_DESCRIPTION: Provider for property descriptions
   * - AI_PROVIDER_MARKET_INSIGHTS: Provider for market insights
   * 
   * Values: 'azure-openai', 'google-gemini', 'sambanova', 'certo', 'auto'
   */
  private loadRoutingConfig(): ProviderRoutingConfig {
    return {
      textGeneration: (process.env.AI_PROVIDER_TEXT_GENERATION as any) || 'auto',
      vision: (process.env.AI_PROVIDER_VISION as any) || 'google-gemini', // Default to Gemini for vision
      embeddings: (process.env.AI_PROVIDER_EMBEDDINGS as any) || 'azure-openai', // Default to Azure for embeddings
      qcAnalysis: (process.env.AI_PROVIDER_QC_ANALYSIS as any) || 'auto',
      documentProcessing: (process.env.AI_PROVIDER_DOCUMENT_PROCESSING as any) || 'google-gemini', // Gemini excels at docs
      propertyDescription: (process.env.AI_PROVIDER_PROPERTY_DESCRIPTION as any) || 'auto',
      marketInsights: (process.env.AI_PROVIDER_MARKET_INSIGHTS as any) || 'auto'
    };
  }

  private logRoutingConfiguration(): void {
    this.logger.info('AI Provider Routing Configuration', {
      textGeneration: this.routingConfig.textGeneration,
      vision: this.routingConfig.vision,
      embeddings: this.routingConfig.embeddings,
      qcAnalysis: this.routingConfig.qcAnalysis,
      documentProcessing: this.routingConfig.documentProcessing,
      propertyDescription: this.routingConfig.propertyDescription,
      marketInsights: this.routingConfig.marketInsights
    });
  }

  // ===========================
  // MAIN AI OPERATIONS
  // ===========================

  /**
   * Generate text completion with intelligent provider selection
   */
  async generateCompletion(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const provider = await this.selectProvider(request.provider, 'text-generation');
    
    try {
      let response: AIResponse;

      switch (provider) {
        case 'azure-openai':
          response = await this.generateWithAzureOpenAI(request);
          break;
        case 'google-gemini':
          response = await this.generateWithGemini(request);
          break;
        case 'sambanova':
          response = await this.generateWithSambaNova(request);
          break;
        case 'certo':
          response = await this.generateWithCerto(request);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      response.responseTime = Date.now() - startTime;
      await this.trackUsage(provider, response.tokensUsed, response.cost);
      
      this.logger.info('AI completion generated', {
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
        cost: response.cost,
        responseTime: response.responseTime
      });

      return response;

    } catch (error) {
      await this.handleProviderError(provider, error);
      
      // Try fallback provider
      const fallbackProvider = await this.getFallbackProvider(provider, 'text-generation');
      if (fallbackProvider && fallbackProvider !== provider) {
        this.logger.warn(`Falling back to ${fallbackProvider} due to ${provider} error`, { error });
        return this.generateCompletion({ ...request, provider: fallbackProvider });
      }
      
      throw error;
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const provider = await this.selectProvider(request.provider, 'embeddings');
    
    try {
      let response: EmbeddingResponse;

      switch (provider) {
        case 'azure-openai':
          response = await this.generateEmbeddingWithAzureOpenAI(request);
          break;
        case 'google-gemini':
          response = await this.generateEmbeddingWithGemini(request);
          break;
        case 'certo':
          response = await this.generateEmbeddingWithCerto(request);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      await this.trackUsage(provider, response.tokensUsed, response.cost);
      return response;

    } catch (error) {
      await this.handleProviderError(provider, error);
      
      const fallbackProvider = await this.getFallbackProvider(provider, 'embeddings');
      if (fallbackProvider && fallbackProvider !== provider) {
        return this.generateEmbedding({ ...request, provider: fallbackProvider });
      }
      
      throw error;
    }
  }

  /**
   * Analyze images with vision models
   */
  async analyzeImage(request: VisionRequest): Promise<AIResponse> {
    const provider = await this.selectProvider(request.provider, 'vision');
    
    try {
      let response: AIResponse;

      switch (provider) {
        case 'azure-openai':
          response = await this.analyzeImageWithAzureOpenAI(request);
          break;
        case 'google-gemini':
          response = await this.analyzeImageWithGemini(request);
          break;
        case 'sambanova':
          response = await this.analyzeImageWithSambaNova(request);
          break;
        case 'certo':
          response = await this.analyzeImageWithCerto(request);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      await this.trackUsage(provider, response.tokensUsed, response.cost);
      return response;

    } catch (error) {
      await this.handleProviderError(provider, error);
      
      const fallbackProvider = await this.getFallbackProvider(provider, 'vision');
      if (fallbackProvider && fallbackProvider !== provider) {
        return this.analyzeImage({ ...request, provider: fallbackProvider });
      }
      
      throw error;
    }
  }

  /**
   * Analyze multiple images with structured output
   */
  async analyzeMultipleImages(request: MultiImageAnalysisRequest): Promise<AIResponse> {
    const provider = await this.selectProvider(request.provider, 'vision');
    
    try {
      let response: AIResponse;

      switch (provider) {
        case 'google-gemini':
          response = await this.analyzeMultipleImagesWithGemini(request);
          break;
        case 'azure-openai':
          response = await this.analyzeMultipleImagesWithAzureOpenAI(request);
          break;
        case 'sambanova':
          response = await this.analyzeMultipleImagesWithSambaNova(request);
          break;
        case 'certo':
          response = await this.analyzeMultipleImagesWithCerto(request);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      await this.trackUsage(provider, response.tokensUsed, response.cost);
      return response;

    } catch (error) {
      await this.handleProviderError(provider, error);
      throw error;
    }
  }

  /**
   * Process PDF or document with structured output
   */
  async processDocument(request: DocumentProcessingRequest): Promise<AIResponse> {
    const provider = await this.selectProvider(request.provider, 'document-processing');
    
    try {
      let response: AIResponse;

      switch (provider) {
        case 'google-gemini':
          response = await this.processDocumentWithGemini(request);
          break;
        case 'azure-openai':
          response = await this.processDocumentWithAzureOpenAI(request);
          break;
        default:
          throw new Error(`Document processing not supported for provider: ${provider}`);
      }

      await this.trackUsage(provider, response.tokensUsed, response.cost);
      return response;

    } catch (error) {
      await this.handleProviderError(provider, error);
      throw error;
    }
  }

  // ===========================
  // QC AND ANALYSIS METHODS
  // ===========================

  /**
   * Perform comprehensive QC analysis on appraisal reports
   */
  async performQCAnalysis(request: QCAnalysisRequest): Promise<QCAnalysisResponse> {
    const prompt = this.buildQCPrompt(request);
    
    const aiRequest: AIRequest = {
      messages: [
        {
          role: 'system',
          content: `You are an expert appraisal quality control analyst with deep knowledge of:
- USPAP (Uniform Standards of Professional Appraisal Practice)
- Local market conditions and regulations  
- Property valuation methodologies
- Risk assessment and compliance requirements

Analyze the provided appraisal report and return findings in JSON format with specific categories, severity levels, and actionable recommendations.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent analysis
      maxTokens: 4000,
      provider: this.routingConfig.qcAnalysis || 'auto'
    };

    const response = await this.generateCompletion(aiRequest);
    
    try {
      // Parse the structured response
      const analysis = JSON.parse(response.content);
      
      return {
        ...response,
        findings: analysis.findings || [],
        overallScore: analysis.overallScore || 0,
        passFailStatus: analysis.passFailStatus || 'fail'
      };
    } catch (parseError) {
      // Fallback to text analysis if JSON parsing fails
      return this.parseQCResponseText(response);
    }
  }

  /**
   * Generate market insights and property analysis
   */
  async generateMarketInsights(propertyData: any): Promise<AIResponse> {
    const prompt = `
    Analyze this property data and provide comprehensive market insights:
    
    Property Details: ${JSON.stringify(propertyData, null, 2)}
    
    Please provide insights on:
    1. Market positioning and competitiveness
    2. Value drivers and risk factors  
    3. Comparable property analysis
    4. Market trends and outlook
    5. Investment potential and recommendations
    
    Format as detailed analysis with specific data points and reasoning.
    `;

    return this.generateCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a real estate market analyst with expertise in property valuation, market trends, and investment analysis.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      maxTokens: 3000,
      provider: this.routingConfig.marketInsights || 'auto'
    });
  }

  /**
   * Perform automated property description generation
   */
  async generatePropertyDescription(propertyData: any, imageUrls?: string[]): Promise<AIResponse> {
    const basePrompt = `
    Create a compelling property description based on this data:
    ${JSON.stringify(propertyData, null, 2)}
    
    Include: location highlights, unique features, market positioning, investment appeal.
    Keep professional tone suitable for appraisal reports.
    `;

    if (imageUrls && imageUrls.length > 0) {
      // Use vision model if images provided
      if (imageUrls[0]) {
        return this.analyzeImage({
          imageUrl: imageUrls[0],
          prompt: basePrompt + '\n\nAnalyze the property images to enhance the description with visual details.',
          provider: this.routingConfig.vision || 'auto'
        });
      }
    }
    
    return this.generateCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a professional real estate writer creating property descriptions for appraisal reports.'
        },
        {
          role: 'user',
          content: basePrompt
        }
      ],
      temperature: 0.7,
      maxTokens: 1000,
      provider: this.routingConfig.propertyDescription || 'auto'
    });
  }

  // ===========================
  // PROVIDER IMPLEMENTATIONS
  // ===========================

  private async generateWithAzureOpenAI(request: AIRequest): Promise<AIResponse> {
    const config = this.providers.get('azure-openai')!;
    const model = request.model || config.models.text[0];
    
    const response = await fetch(`${config.endpoint}/openai/deployments/${model}/chat/completions?api-version=2024-02-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2000,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const usage = data.usage;
    const content = data.choices[0].message.content;

    return {
      content,
      provider: 'azure-openai',
      model: model || 'gpt-4',
      tokensUsed: usage.total_tokens,
      cost: (usage.prompt_tokens * config.costPerToken.input) + (usage.completion_tokens * config.costPerToken.output),
      responseTime: 0 // Will be set by caller
    };
  }

  private async generateWithGemini(request: AIRequest): Promise<AIResponse> {
    const config = this.providers.get('google-gemini')!;
    const model = request.model || config.models.text[0];
    
    // Convert OpenAI format to Gemini format
    const parts = request.messages.map(msg => ({
      text: `${msg.role}: ${msg.content}`
    }));

    const response = await fetch(`${config.endpoint}/models/${model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts
        }],
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens || 2000,
          topP: 0.95
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    const tokensUsed = data.usageMetadata?.totalTokenCount || 1000; // Estimate if not provided

    return {
      content,
      provider: 'google-gemini',
      model: model || 'gemini-pro',
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input, // Simplified cost calculation
      responseTime: 0
    };
  }

  private async generateEmbeddingWithAzureOpenAI(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const config = this.providers.get('azure-openai')!;
    const model = request.model || config.models.embedding[0];
    
    const response = await fetch(`${config.endpoint}/openai/deployments/${model}/embeddings?api-version=2024-02-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        input: request.text,
        model
      })
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI Embedding API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;
    const tokensUsed = data.usage.total_tokens;

    return {
      embedding,
      provider: 'azure-openai',
      model: model || 'text-embedding-ada-002',
      dimensions: embedding.length,
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input
    };
  }

  private async generateEmbeddingWithGemini(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const config = this.providers.get('google-gemini')!;
    const model = request.model || config.models.embedding[0];
    
    const response = await fetch(`${config.endpoint}/models/${model}:embedContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: {
          parts: [{
            text: request.text
          }]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Google Gemini Embedding API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.embedding.values;
    const tokensUsed = Math.ceil(request.text.length / 4); // Rough estimate

    return {
      embedding,
      provider: 'google-gemini',
      model: model || 'embedding-001',
      dimensions: embedding.length,
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input
    };
  }

  private async analyzeImageWithAzureOpenAI(request: VisionRequest): Promise<AIResponse> {
    const config = this.providers.get('azure-openai')!;
    const model = request.model || config.models.vision[0];
    
    const response = await fetch(`${config.endpoint}/openai/deployments/${model}/chat/completions?api-version=2024-02-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: request.prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: request.imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI Vision API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const tokensUsed = data.usage.total_tokens;

    return {
      content,
      provider: 'azure-openai',
      model: model || 'gpt-4-vision-preview',
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async analyzeImageWithGemini(request: VisionRequest): Promise<AIResponse> {
    const config = this.providers.get('google-gemini')!;
    const model = request.model || 'gemini-2.0-flash-exp';
    
    // Download and encode image to base64
    const imageResponse = await fetch(request.imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    const requestBody: any = {
      contents: [{
        parts: [
          { text: request.prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }]
    };

    // Add structured output if jsonSchema provided
    if (request.jsonSchema) {
      requestBody.generationConfig = {
        response_mime_type: 'application/json',
        response_schema: request.jsonSchema
      };
    }

    const response = await fetch(`${config.endpoint}/models/${model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Google Gemini Vision API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    const tokensUsed = data.usageMetadata?.totalTokenCount || 1500;

    return {
      content,
      provider: 'google-gemini',
      model,
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async analyzeImageWithSambaNova(request: VisionRequest): Promise<AIResponse> {
    const config = this.providers.get('sambanova')!;
    const model = request.model || config.models.vision[0];
    
    // SambaNova uses OpenAI-compatible format
    const imageResponse = await fetch(request.imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    const requestBody: any = {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: request.prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000
    };

    if (request.responseFormat === 'json' && request.jsonSchema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: request.jsonSchema
      };
    }

    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`SambaNova API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 1500;

    return {
      content,
      provider: 'sambanova',
      model: model || 'Llama-3.2-11B-Vision-Instruct',
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async analyzeImageWithCerto(request: VisionRequest): Promise<AIResponse> {
    const config = this.providers.get('certo')!;
    const model = request.model || 'default';
    
    // Certo uses OpenAI-compatible format
    const imageResponse = await fetch(request.imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    const requestBody: any = {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: request.prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000
    };

    if (request.responseFormat === 'json' && request.jsonSchema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: request.jsonSchema
      };
    }

    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Client-ID': process.env.CERTO_CLIENT_ID || '',
        'X-Tenant-ID': process.env.CERTO_TENANT_ID || '',
        'X-User-ID': process.env.CERTO_USER_ID || ''
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Certo AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 1500;

    return {
      content,
      provider: 'certo',
      model,
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  // ===========================
  // PROVIDER SELECTION & MANAGEMENT
  // ===========================

  private async generateWithSambaNova(request: AIRequest): Promise<AIResponse> {
    const config = this.providers.get('sambanova')!;
    const model = request.model || config.models.text[0];
    
    const requestBody: any = {
      model,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 2000
    };

    if (request.responseFormat === 'json' && request.jsonSchema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: request.jsonSchema
      };
    }

    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`SambaNova API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 1000;

    return {
      content,
      provider: 'sambanova',
      model: model || 'Meta-Llama-3.1-8B-Instruct',
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async generateWithCerto(request: AIRequest): Promise<AIResponse> {
    const config = this.providers.get('certo')!;
    const model = request.model || 'default';
    
    const requestBody: any = {
      model,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 2000
    };

    if (request.responseFormat === 'json' && request.jsonSchema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: request.jsonSchema
      };
    }

    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Client-ID': process.env.CERTO_CLIENT_ID || '',
        'X-Tenant-ID': process.env.CERTO_TENANT_ID || '',
        'X-User-ID': process.env.CERTO_USER_ID || ''
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Certo AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 1000;

    return {
      content,
      provider: 'certo',
      model,
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async generateEmbeddingWithCerto(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const config = this.providers.get('certo')!;
    const model = request.model || 'default';
    
    const response = await fetch(`${config.endpoint}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Client-ID': process.env.CERTO_CLIENT_ID || '',
        'X-Tenant-ID': process.env.CERTO_TENANT_ID || '',
        'X-User-ID': process.env.CERTO_USER_ID || ''
      },
      body: JSON.stringify({
        input: request.text,
        model
      })
    });

    if (!response.ok) {
      throw new Error(`Certo AI Embedding API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;
    const tokensUsed = data.usage?.total_tokens || Math.ceil(request.text.length / 4);

    return {
      embedding,
      provider: 'certo',
      model,
      dimensions: embedding.length,
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input
    };
  }

  private async analyzeMultipleImagesWithGemini(request: MultiImageAnalysisRequest): Promise<AIResponse> {
    const config = this.providers.get('google-gemini')!;
    const model = 'gemini-2.0-flash-exp';
    
    // Download and encode all images
    const imageParts = await Promise.all(
      request.imageUrls.map(async (url) => {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        return {
          inline_data: {
            mime_type: mimeType,
            data: base64
          }
        };
      })
    );

    const requestBody: any = {
      contents: [{
        parts: [
          { text: request.prompt },
          ...imageParts
        ]
      }]
    };

    if (request.jsonSchema) {
      requestBody.generationConfig = {
        response_mime_type: 'application/json',
        response_schema: request.jsonSchema
      };
    }

    const response = await fetch(`${config.endpoint}/models/${model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini Multi-Image API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    const tokensUsed = data.usageMetadata?.totalTokenCount || 2000;

    return {
      content,
      provider: 'google-gemini',
      model,
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async analyzeMultipleImagesWithAzureOpenAI(request: MultiImageAnalysisRequest): Promise<AIResponse> {
    const config = this.providers.get('azure-openai')!;
    const model = config.models.vision[0];
    
    // Azure OpenAI supports multiple images in content array
    const imageContents = await Promise.all(
      request.imageUrls.map(async (url) => ({
        type: 'image_url',
        image_url: { url }
      }))
    );

    const requestBody: any = {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: request.prompt },
            ...imageContents
          ]
        }
      ],
      max_tokens: 4000
    };

    if (request.jsonSchema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: request.jsonSchema
      };
    }

    const response = await fetch(`${config.endpoint}/openai/deployments/${model}/chat/completions?api-version=2024-02-15-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI Multi-Image API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const tokensUsed = data.usage.total_tokens;

    return {
      content,
      provider: 'azure-openai',
      model: model || 'gpt-4-vision-preview',
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async analyzeMultipleImagesWithSambaNova(request: MultiImageAnalysisRequest): Promise<AIResponse> {
    const config = this.providers.get('sambanova')!;
    const model = config.models.vision[0];
    
    const imageContents = await Promise.all(
      request.imageUrls.map(async (url) => {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        return {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64}`
          }
        };
      })
    );

    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: request.prompt },
              ...imageContents
            ]
          }
        ],
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`SambaNova Multi-Image API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 2000;

    return {
      content,
      provider: 'sambanova',
      model: model || 'Llama-3.2-11B-Vision-Instruct',
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async analyzeMultipleImagesWithCerto(request: MultiImageAnalysisRequest): Promise<AIResponse> {
    const config = this.providers.get('certo')!;
    const model = 'default';
    
    const imageContents = await Promise.all(
      request.imageUrls.map(async (url) => {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        return {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64}`
          }
        };
      })
    );

    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Client-ID': process.env.CERTO_CLIENT_ID || '',
        'X-Tenant-ID': process.env.CERTO_TENANT_ID || '',
        'X-User-ID': process.env.CERTO_USER_ID || ''
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: request.prompt },
              ...imageContents
            ]
          }
        ],
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`Certo AI Multi-Image API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 2000;

    return {
      content,
      provider: 'certo',
      model,
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async processDocumentWithGemini(request: DocumentProcessingRequest): Promise<AIResponse> {
    const config = this.providers.get('google-gemini')!;
    const model = 'gemini-2.0-flash-exp';
    
    // Fetch and encode document
    const docResponse = await fetch(request.documentUrl);
    const docBuffer = await docResponse.arrayBuffer();
    const base64Doc = Buffer.from(docBuffer).toString('base64');

    const requestBody: any = {
      contents: [{
        parts: [
          { text: request.prompt },
          {
            inline_data: {
              mime_type: request.mimeType,
              data: base64Doc
            }
          }
        ]
      }]
    };

    if (request.jsonSchema) {
      requestBody.generationConfig = {
        response_mime_type: 'application/json',
        response_schema: request.jsonSchema
      };
    }

    const response = await fetch(`${config.endpoint}/models/${model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini Document Processing API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    const tokensUsed = data.usageMetadata?.totalTokenCount || 3000;

    return {
      content,
      provider: 'google-gemini',
      model,
      tokensUsed,
      cost: tokensUsed * config.costPerToken.input,
      responseTime: 0
    };
  }

  private async processDocumentWithAzureOpenAI(request: DocumentProcessingRequest): Promise<AIResponse> {
    // Azure OpenAI requires document to be accessible via URL or converted to images
    // For PDFs, we'd need to convert to images first
    throw new Error('Azure OpenAI document processing requires document-to-image conversion (not implemented)');
  }

  private async selectProvider(preferredProvider?: string, capability?: string): Promise<'azure-openai' | 'google-gemini' | 'sambanova' | 'certo'> {
    // Return preferred provider if specified and available
    if (preferredProvider && preferredProvider !== 'auto') {
      const config = this.providers.get(preferredProvider);
      if (config?.enabled && this.isProviderAvailable(preferredProvider)) {
        return preferredProvider as 'azure-openai' | 'google-gemini';
      }
    }

    // Auto-select best provider based on capability and current conditions
    const availableProviders = Array.from(this.providers.entries())
      .filter(([key, config]) => {
        return config.enabled && 
               this.isProviderAvailable(key) && 
               (!capability || config.capabilities.includes(capability));
      })
      .sort((a, b) => {
        // Sort by reliability, cost, and latency
        const scoreA = (a[1].reliability * 0.4) + ((1 - a[1].costPerToken.input / 0.0001) * 0.3) + ((1 - a[1].latency / 2000) * 0.3);
        const scoreB = (b[1].reliability * 0.4) + ((1 - b[1].costPerToken.input / 0.0001) * 0.3) + ((1 - b[1].latency / 2000) * 0.3);
        return scoreB - scoreA;
      });

    if (availableProviders.length === 0) {
      throw new Error(`No available providers for capability: ${capability}`);
    }

    const selectedProvider = availableProviders[0];
    if (!selectedProvider) {
      throw new Error(`No available providers for capability: ${capability}`);
    }
    
    return selectedProvider[0] as 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo';
  }

  private isProviderAvailable(provider: string): boolean {
    const circuit = this.circuitBreaker.get(provider);
    if (!circuit) return false;

    // Check if circuit breaker is open
    if (circuit.isOpen) {
      const now = new Date();
      const timeSinceFailure = now.getTime() - circuit.lastFailure.getTime();
      
      // Reset circuit breaker after 5 minutes
      if (timeSinceFailure > 5 * 60 * 1000) {
        circuit.isOpen = false;
        circuit.failures = 0;
        return true;
      }
      return false;
    }

    // Check rate limits
    const usage = this.usage.get(provider);
    if (usage) {
      const config = this.providers.get(provider)!;
      if (usage.requestCount >= config.rateLimit.requestsPerMinute) {
        return false;
      }
    }

    return true;
  }

  private async getFallbackProvider(failedProvider: string, capability?: string): Promise<'azure-openai' | 'google-gemini' | 'sambanova' | 'certo' | null> {
    const alternativeProviders = Array.from(this.providers.keys())
      .filter(key => key !== failedProvider && this.isProviderAvailable(key));
    
    if (alternativeProviders.length === 0) {
      return null;
    }

    return alternativeProviders[0] as 'azure-openai' | 'google-gemini' | 'sambanova' | 'certo';
  }

  private async handleProviderError(provider: string, error: any): Promise<void> {
    const circuit = this.circuitBreaker.get(provider);
    if (circuit) {
      circuit.failures++;
      circuit.lastFailure = new Date();
      
      // Open circuit breaker after 3 failures
      if (circuit.failures >= 3) {
        circuit.isOpen = true;
        this.logger.error(`Circuit breaker opened for provider ${provider}`, { 
          error: error instanceof Error ? error.message : String(error),
          failures: circuit.failures 
        });
      }
    }
  }

  private async trackUsage(provider: string, tokens: number, cost: number): Promise<void> {
    const current = this.usage.get(provider) || {
      requestCount: 0,
      tokenCount: 0,
      cost: 0,
      lastReset: new Date()
    };

    this.usage.set(provider, {
      requestCount: current.requestCount + 1,
      tokenCount: current.tokenCount + tokens,
      cost: current.cost + cost,
      lastReset: current.lastReset
    });
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  private buildQCPrompt(request: QCAnalysisRequest): string {
    let prompt = `Perform ${request.analysisType || 'comprehensive'} quality control analysis on this appraisal report:\n\n`;
    prompt += `Report Text:\n${request.reportText}\n\n`;
    
    if (request.propertyData) {
      prompt += `Property Data:\n${JSON.stringify(request.propertyData, null, 2)}\n\n`;
    }
    
    if (request.complianceRules) {
      prompt += `Compliance Rules:\n${request.complianceRules.join('\n')}\n\n`;
    }
    
    prompt += `Return analysis in JSON format with:
{
  "findings": [
    {
      "category": "string",
      "severity": "low|medium|high|critical", 
      "description": "string",
      "recommendation": "string",
      "confidence": number
    }
  ],
  "overallScore": number (0-100),
  "passFailStatus": "pass|fail|conditional"
}`;

    return prompt;
  }

  private parseQCResponseText(response: AIResponse): QCAnalysisResponse {
    // Fallback text parsing if JSON fails
    const findings = [];
    let overallScore = 75;
    let passFailStatus: 'pass' | 'fail' | 'conditional' = 'conditional';

    // Simple text analysis for demonstration
    const lines = response.content.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('critical') || line.toLowerCase().includes('fail')) {
        findings.push({
          category: 'General',
          severity: 'critical' as const,
          description: line.trim(),
          confidence: 0.8
        });
        overallScore -= 20;
      }
    }

    if (overallScore >= 80) passFailStatus = 'pass';
    else if (overallScore < 60) passFailStatus = 'fail';

    return {
      ...response,
      findings,
      overallScore: Math.max(0, overallScore),
      passFailStatus
    };
  }

  // ===========================
  // PUBLIC UTILITY METHODS
  // ===========================

  /**
   * Get current usage statistics
   */
  public getUsageStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [provider, usage] of Array.from(this.usage.entries())) {
      stats[provider] = {
        ...usage,
        provider: this.providers.get(provider)?.name,
        circuitBreakerOpen: this.circuitBreaker.get(provider)?.isOpen || false
      };
    }
    
    return stats;
  }

  /**
   * Health check for all providers
   */
  public async healthCheck(): Promise<Record<string, any>> {
    const health: Record<string, any> = {};
    
    for (const [key, config] of Array.from(this.providers.entries())) {
      health[key] = {
        name: config.name,
        enabled: config.enabled,
        available: this.isProviderAvailable(key),
        circuitBreakerOpen: this.circuitBreaker.get(key)?.isOpen || false,
        lastUsage: this.usage.get(key)?.lastReset || null
      };
    }
    
    return health;
  }

  /**
   * Reset circuit breakers (for administrative use)
   */
  public resetCircuitBreakers(): void {
    for (const [key] of Array.from(this.circuitBreaker.entries())) {
      this.circuitBreaker.set(key, {
        failures: 0,
        lastFailure: new Date(0),
        isOpen: false
      });
    }
    
    this.logger.info('All circuit breakers reset');
  }

  /**
   * Get current routing configuration
   */
  public getRoutingConfig(): ProviderRoutingConfig {
    return { ...this.routingConfig };
  }

  /**
   * Update routing configuration dynamically
   */
  public updateRoutingConfig(config: Partial<ProviderRoutingConfig>): void {
    this.routingConfig = {
      ...this.routingConfig,
      ...config
    };
    
    this.logger.info('Routing configuration updated', config);
  }
}