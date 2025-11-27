# Universal AI Services Architecture

## Overview

The Universal AI Service provides a unified interface to multiple AI providers (Azure OpenAI and Google Gemini) with intelligent routing, cost optimization, failover mechanisms, and comprehensive monitoring. This architecture ensures your appraisal management platform has reliable, scalable AI capabilities for QC analysis, market insights, and property intelligence.

## Architecture Design

### Core Components

1. **Universal AI Service** (`src/services/universal-ai.service.ts`)
   - Central orchestration layer
   - Provider selection and routing
   - Cost optimization and usage tracking
   - Circuit breaker pattern for reliability
   - Response caching and performance monitoring

2. **AI Services Controller** (`src/controllers/ai-services.controller.ts`)
   - REST API endpoints for AI operations
   - Request validation and authentication
   - Structured response formatting
   - Error handling and logging

3. **Provider Configurations**
   - Azure OpenAI integration
   - Google Gemini integration
   - Automatic failover and load balancing
   - Rate limiting and quota management

## Supported AI Providers

### Azure OpenAI
- **Models**: GPT-4, GPT-3.5-turbo, text-embedding-ada-002, GPT-4-vision
- **Capabilities**: Text generation, embeddings, vision analysis, function calling
- **Cost**: $0.03/$0.06 per 1K tokens (input/output)
- **Rate Limits**: 300 RPM, 40K TPM (configurable)
- **Reliability**: 99% uptime SLA

### Google Gemini
- **Models**: gemini-pro, gemini-pro-vision, embedding-001
- **Capabilities**: Text generation, embeddings, vision, multimodal
- **Cost**: $0.125/$0.375 per 1K tokens (input/output)
- **Rate Limits**: 60 RPM, 32K TPM (configurable)
- **Reliability**: 97% uptime SLA

## API Endpoints

### QC Analysis Endpoints

#### `POST /api/ai/qc/analyze`
**Purpose**: Comprehensive QC analysis of appraisal reports
**Authentication**: JWT + `qc_validate` permission
**Request Body**:
```json
{
  "reportText": "Full appraisal report text...",
  "propertyData": {
    "address": "123 Main St",
    "propertyType": "single_family",
    "squareFootage": 2000
  },
  "complianceRules": [
    "USPAP compliance verification",
    "Environmental hazard assessment"
  ],
  "analysisType": "comprehensive"
}
```
**Response**:
```json
{
  "success": true,
  "qcResults": {
    "findings": [
      {
        "category": "Market Analysis",
        "severity": "medium",
        "description": "Comparable sales analysis could be strengthened",
        "recommendation": "Include more recent sales within 0.5 miles",
        "confidence": 0.85
      }
    ],
    "overallScore": 87,
    "passFailStatus": "pass",
    "provider": "azure-openai",
    "model": "gpt-4",
    "tokensUsed": 2500,
    "cost": 0.15
  }
}
```

#### `POST /api/ai/qc/technical`
**Purpose**: Technical validation focusing on methodology and calculations
**Response**: Similar structure with technical-specific findings

#### `POST /api/ai/qc/compliance`
**Purpose**: Regulatory and compliance validation
**Additional Parameters**: `jurisdiction` for location-specific rules

### Market Analysis Endpoints

#### `POST /api/ai/market/insights`
**Purpose**: Generate comprehensive market analysis and insights
**Request Body**:
```json
{
  "propertyData": {
    "address": "123 Main St, City, State",
    "propertyType": "single_family",
    "yearBuilt": 1995,
    "squareFootage": 2000,
    "bedrooms": 4,
    "bathrooms": 2.5,
    "lotSize": 0.25
  },
  "marketContext": {
    "analysisDate": "2025-11-23",
    "purposeOfAppraisal": "purchase",
    "marketConditions": "balanced"
  },
  "analysisScope": "local"
}
```

#### `POST /api/ai/property/description`
**Purpose**: Generate compelling property descriptions
**Supports**: Text-only or image-enhanced descriptions

### Vision Analysis Endpoints

#### `POST /api/ai/vision/analyze`
**Purpose**: Comprehensive image analysis for property assessment
**Request Body**:
```json
{
  "imageUrls": [
    "https://example.com/property-front.jpg",
    "https://example.com/property-interior.jpg"
  ],
  "analysisType": "condition",
  "propertyContext": {
    "propertyType": "single_family",
    "yearBuilt": 1995
  }
}
```
**Analysis Types**: `condition`, `features`, `compliance`, `market`

#### `POST /api/ai/vision/condition`
**Purpose**: Detailed condition assessment from property images
**Focus Areas**: Structural condition, maintenance needs, safety concerns

### Text Processing Endpoints

#### `POST /api/ai/embeddings`
**Purpose**: Generate embeddings for similarity search and semantic analysis
**Use Cases**: Property matching, report similarity, knowledge base search

#### `POST /api/ai/completion`
**Purpose**: Custom AI text generation with full control
**Authentication**: JWT + `ai_generate` permission
**Advanced Features**: Function calling, structured outputs, custom instructions

### Monitoring Endpoints

#### `GET /api/ai/health`
**Purpose**: AI service health check and provider status
**Public Endpoint**: No authentication required
**Response**:
```json
{
  "status": "healthy",
  "providers": {
    "azure-openai": {
      "name": "Azure OpenAI",
      "enabled": true,
      "available": true,
      "circuitBreakerOpen": false
    },
    "google-gemini": {
      "name": "Google Gemini", 
      "enabled": true,
      "available": true,
      "circuitBreakerOpen": false
    }
  },
  "usage": {
    "azure-openai": {
      "requestCount": 245,
      "tokenCount": 125000,
      "cost": 8.75
    }
  }
}
```

#### `GET /api/ai/usage`
**Purpose**: Detailed usage statistics and cost tracking
**Authentication**: JWT + `analytics_view` permission

## Configuration

### Environment Variables

```bash
# Azure OpenAI (Primary Provider)
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-key-here
AZURE_OPENAI_RPM=300        # Requests per minute
AZURE_OPENAI_TPM=40000      # Tokens per minute

# Google Gemini (Secondary Provider) 
GOOGLE_GEMINI_API_KEY=your-google-gemini-api-key-here
GOOGLE_GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta
GOOGLE_GEMINI_RPM=60
GOOGLE_GEMINI_TPM=32000
```

### Provider Selection Logic

1. **Auto Selection** (`provider: "auto"`)
   - Evaluates reliability (40%), cost (30%), latency (30%)
   - Respects rate limits and circuit breaker status
   - Prefers Azure OpenAI for text generation, Gemini for cost-sensitive tasks

2. **Explicit Selection** (`provider: "azure-openai"` or `provider: "google-gemini"`)
   - Uses specified provider if available
   - Automatic fallback if provider unavailable

3. **Capability-Based Routing**
   - Text generation: Both providers supported
   - Embeddings: Provider-specific implementations
   - Vision: Both support image analysis
   - Function calling: Azure OpenAI preferred

## Reliability Features

### Circuit Breaker Pattern
- **Failure Threshold**: 3 consecutive failures
- **Recovery Time**: 5 minutes
- **Automatic Reset**: When provider becomes available

### Retry Logic
- **Automatic Failover**: Falls back to alternative provider
- **Exponential Backoff**: For transient errors
- **Dead Letter Queue**: For failed requests requiring manual review

### Caching Strategy
- **Response Caching**: 6 hours for analysis results
- **Cost Optimization**: Reduces redundant API calls
- **Cache Invalidation**: Based on content changes

## Cost Management

### Usage Tracking
- **Real-time Monitoring**: Token usage and cost per provider
- **Hourly Reset**: Usage counters reset every hour
- **Budget Alerts**: Configurable cost thresholds

### Cost Optimization
- **Provider Selection**: Routes to most cost-effective provider
- **Response Caching**: Eliminates duplicate API calls
- **Token Management**: Optimizes prompt engineering for efficiency

### Estimated Costs (Per 1000 Operations)
- **QC Analysis**: $3.50 - $8.75 (depending on report complexity)
- **Market Insights**: $2.25 - $5.50 (depending on analysis depth)
- **Image Analysis**: $4.50 - $12.00 (depending on image count/complexity)
- **Property Descriptions**: $0.75 - $2.25 (depending on detail level)

## Security

### API Key Management
- **Environment Variables**: Secure key storage
- **Azure Key Vault**: Production key management
- **Rotation Support**: Seamless key updates

### Data Privacy
- **No Data Retention**: Providers don't store request data
- **Encryption in Transit**: All API calls use HTTPS
- **Audit Logging**: Complete request/response logging

### Access Control
- **Role-Based Permissions**: Fine-grained access control
- **Rate Limiting**: Per-user and global limits
- **Authentication**: JWT token validation

## Integration Examples

### QC Analysis Workflow
```typescript
// 1. Authenticate user
const token = await login(email, password);

// 2. Perform QC analysis
const qcResults = await fetch('/api/ai/qc/analyze', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reportText: reportContent,
    propertyData: propertyDetails,
    analysisType: 'comprehensive'
  })
});

// 3. Process results
const analysis = await qcResults.json();
if (analysis.qcResults.passFailStatus === 'fail') {
  // Handle failed QC
  await flagReportForReview(orderId, analysis.qcResults.findings);
}
```

### Property Intelligence Workflow
```typescript
// 1. Generate market insights
const insights = await fetch('/api/ai/market/insights', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ propertyData })
});

// 2. Analyze property images  
const imageAnalysis = await fetch('/api/ai/vision/analyze', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    imageUrls: propertyImages,
    analysisType: 'features'
  })
});

// 3. Generate property description
const description = await fetch('/api/ai/property/description', {
  method: 'POST', 
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    propertyData,
    imageUrls: propertyImages
  })
});
```

## Performance Monitoring

### Metrics Tracked
- **Response Times**: Per provider and endpoint
- **Success Rates**: Provider reliability metrics
- **Cost per Operation**: Real-time cost tracking
- **Token Usage**: Efficiency monitoring

### Alerts and Monitoring
- **Circuit Breaker**: Automatic provider failover
- **Cost Thresholds**: Budget monitoring and alerts
- **Performance Degradation**: Latency and error monitoring
- **Usage Spikes**: Anomaly detection

## Troubleshooting

### Common Issues

1. **Provider Unavailable**
   - Check API keys and endpoints
   - Verify network connectivity
   - Review rate limit status

2. **High Costs**
   - Enable response caching
   - Optimize prompt engineering
   - Review provider selection logic

3. **Poor Quality Results**
   - Adjust temperature settings
   - Improve prompt engineering
   - Switch to higher-tier models

### Support and Maintenance

1. **Circuit Breaker Reset**
   ```bash
   POST /api/ai/admin/reset-circuit-breakers
   ```

2. **Clear Cache**
   ```bash
   POST /api/ai/admin/clear-cache
   ```

3. **Provider Status Check**
   ```bash
   GET /api/ai/health
   ```

This Universal AI Service architecture provides your appraisal management platform with enterprise-grade AI capabilities that are reliable, cost-effective, and scalable for production use.