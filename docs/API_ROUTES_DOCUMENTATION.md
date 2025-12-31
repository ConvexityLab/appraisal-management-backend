# Appraisal Management Platform - API Routes Documentation

## Overview

This document outlines all API routes available in the Appraisal Management Platform, organized by functional area. The platform provides comprehensive REST endpoints for managing appraisal orders, vendors, quality control, property intelligence, and analytics.

## Base Configuration

- **Base URL**: `http://localhost:3000` (development)
- **Authentication**: JWT Bearer token required for all protected routes
- **Content Type**: `application/json`
- **Rate Limiting**: 100 requests per 15-minute window per IP
- **API Documentation**: Available at `/api-docs` (Swagger UI)

## Table of Contents

1. [System Health & Documentation](#system-health--documentation)
2. [Authentication](#authentication)
3. [Order Management](#order-management)
4. [Quality Control (QC) Validation](#quality-control-qc-validation)
5. [Vendor Management](#vendor-management)
6. [Analytics & Reporting](#analytics--reporting)
7. [AI Services](#ai-services)
8. [Property Intelligence](#property-intelligence)
9. [Dynamic Code Execution](#dynamic-code-execution)

---

## System Health & Documentation

### Health Check
- **Route**: `GET /health`
- **Authentication**: None required
- **Purpose**: System health monitoring and service status verification
- **Response**: Service health status, database connectivity, latency metrics
- **Use Case**: Load balancer health checks, monitoring systems

### API Documentation
- **Route**: `GET /api-docs`
- **Authentication**: None required
- **Purpose**: Interactive Swagger UI documentation
- **Response**: HTML interface for API exploration and testing

---

## Authentication

### User Login
- **Route**: `POST /api/auth/login`
- **Authentication**: None required
- **Purpose**: Authenticate user credentials and obtain JWT token
- **Request Body**:
  - `email` (string, required): Valid email address
  - `password` (string, required): User password (min 6 characters)
- **Response**: JWT token and user profile information
- **Use Case**: Initial user authentication for web/mobile applications

### User Registration
- **Route**: `POST /api/auth/register`
- **Authentication**: None required
- **Purpose**: Create new user account in the system
- **Request Body**:
  - `email` (string, required): Valid email address
  - `password` (string, required): Strong password (min 8 chars, mixed case, numbers)
  - `firstName` (string, required): User's first name
  - `lastName` (string, required): User's last name
  - `role` (enum, required): User role (`admin`, `manager`, `appraiser`, `qc_analyst`)
- **Response**: JWT token and created user profile
- **Use Case**: New user onboarding, account creation

### Token Refresh
- **Route**: `POST /api/auth/refresh`
- **Authentication**: Valid JWT token required
- **Purpose**: Refresh expiring JWT token without re-authentication
- **Response**: New JWT token with extended expiration
- **Use Case**: Maintaining user sessions, preventing frequent re-logins

---

## Order Management

### Create Order
- **Route**: `POST /api/orders`
- **Authentication**: JWT token required
- **Purpose**: Create new appraisal order in the system
- **Request Body**:
  - `propertyAddress` (string, required): Complete property address (min 10 characters)
  - `clientId` (UUID, required): Client identifier
  - `orderType` (enum, required): Order type (`purchase`, `refinance`, `heloc`, `other`)
  - `priority` (enum, optional): Priority level (`standard`, `rush`, `super_rush`)
  - `dueDate` (ISO8601, required): Order completion deadline
- **Response**: Created order with assigned ID and initial status
- **Use Case**: Initiating new appraisal requests from client systems

### Get Orders (List/Search)
- **Route**: `GET /api/orders`
- **Authentication**: JWT token required
- **Purpose**: Retrieve orders with filtering and pagination
- **Query Parameters**:
  - `status` (enum, optional): Filter by order status
  - `priority` (enum, optional): Filter by priority level
  - `limit` (number, optional): Results per page (1-100, default: 20)
  - `offset` (number, optional): Page offset (default: 0)
- **Response**: Paginated list of orders with metadata
- **Use Case**: Order management dashboards, search functionality

### Get Single Order
- **Route**: `GET /api/orders/:orderId`
- **Authentication**: JWT token required
- **Purpose**: Retrieve detailed information for specific order
- **Parameters**: `orderId` (UUID): Unique order identifier
- **Response**: Complete order details including status history
- **Use Case**: Order detail views, status tracking

### Update Order Status
- **Route**: `PUT /api/orders/:orderId/status`
- **Authentication**: JWT token required
- **Purpose**: Update order status and add progress notes
- **Parameters**: `orderId` (UUID): Order identifier
- **Request Body**:
  - `status` (enum, required): New status (`pending`, `assigned`, `in_progress`, `delivered`, `completed`, `cancelled`)
  - `notes` (string, optional): Status change notes (max 1000 chars)
- **Response**: Updated order with new status
- **Use Case**: Workflow progression, status tracking

### Deliver Order
- **Route**: `POST /api/orders/:orderId/deliver`
- **Authentication**: JWT token required
- **Purpose**: Mark order as delivered with report attachment
- **Parameters**: `orderId` (UUID): Order identifier
- **Request Body**:
  - `reportUrl` (URL, required): Link to completed appraisal report
  - `deliveryNotes` (string, optional): Delivery notes (max 1000 chars)
- **Response**: Updated order marked as delivered
- **Use Case**: Report delivery, order completion

### Order Dashboard
- **Route**: `GET /api/orders/dashboard`
- **Authentication**: JWT token required
- **Purpose**: Get comprehensive dashboard data for order management
- **Response**: Order summary statistics, metrics, and recent orders
- **Use Case**: Management dashboards, performance monitoring

---

## Quality Control (QC) Validation

### Perform QC Validation
- **Route**: `POST /api/qc/validate/:orderId`
- **Authentication**: JWT token + `qc_validate` permission required
- **Purpose**: Execute quality control validation on completed order
- **Parameters**: `orderId` (UUID): Order to validate
- **Response**: QC validation results with scores and recommendations
- **Use Case**: Quality assurance processes, report validation

### Get QC Results
- **Route**: `GET /api/qc/results/:orderId`
- **Authentication**: JWT token required
- **Purpose**: Retrieve QC validation results for specific order
- **Parameters**: `orderId` (UUID): Order identifier
- **Response**: Complete QC validation data and scores
- **Use Case**: QC result review, audit trails

### Get QC Metrics
- **Route**: `GET /api/qc/metrics`
- **Authentication**: JWT token + `qc_metrics` permission required
- **Purpose**: Retrieve aggregate QC performance metrics
- **Response**: QC pass rates, average scores, trend data
- **Use Case**: Quality management dashboards, performance analysis

---

## Vendor Management

### Get Vendors
- **Route**: `GET /api/vendors`
- **Authentication**: JWT token required
- **Purpose**: Retrieve list of all registered vendors
- **Response**: Array of vendor profiles with capabilities
- **Use Case**: Vendor selection, directory browsing

### Create Vendor
- **Route**: `POST /api/vendors`
- **Authentication**: JWT token + `vendor_manage` permission required
- **Purpose**: Register new vendor in the system
- **Request Body**:
  - `name` (string, required): Vendor business name (min 2 chars)
  - `email` (string, required): Valid email address
  - `phone` (string, required): Valid mobile phone number
  - `serviceTypes` (array, required): Types of services offered
  - `serviceAreas` (array, required): Geographic service areas
- **Response**: Created vendor profile with assigned ID
- **Use Case**: Vendor onboarding, network expansion

### Update Vendor
- **Route**: `PUT /api/vendors/:vendorId`
- **Authentication**: JWT token + `vendor_manage` permission required
- **Purpose**: Update existing vendor information
- **Parameters**: `vendorId` (UUID): Vendor identifier
- **Request Body**: Partial vendor data (all fields optional)
- **Response**: Updated vendor profile
- **Use Case**: Vendor profile maintenance, capability updates

### Assign Vendor
- **Route**: `POST /api/vendors/assign/:orderId`
- **Authentication**: JWT token + `vendor_assign` permission required
- **Purpose**: Automatically assign optimal vendor to order
- **Parameters**: `orderId` (UUID): Order requiring vendor assignment
- **Response**: Assignment details with selected vendor and score
- **Use Case**: Automated vendor assignment, workflow optimization

### Get Vendor Performance
- **Route**: `GET /api/vendors/performance/:vendorId`
- **Authentication**: JWT token required
- **Purpose**: Retrieve performance metrics for specific vendor
- **Parameters**: `vendorId` (UUID): Vendor identifier
- **Response**: Performance statistics, ratings, completion metrics
- **Use Case**: Vendor evaluation, performance monitoring

---

## Analytics & Reporting

### Analytics Overview
- **Route**: `GET /api/analytics/overview`
- **Authentication**: JWT token + `analytics_view` permission required
- **Purpose**: Get high-level analytics and KPI summary
- **Response**: Overall system metrics, order statistics, performance indicators
- **Use Case**: Executive dashboards, system health monitoring

### Performance Analytics
- **Route**: `GET /api/analytics/performance`
- **Authentication**: JWT token + `analytics_view` permission required
- **Purpose**: Detailed performance analytics with time-series data
- **Query Parameters**:
  - `startDate` (ISO8601, optional): Analysis period start
  - `endDate` (ISO8601, optional): Analysis period end
  - `groupBy` (enum, optional): Data grouping (`day`, `week`, `month`)
- **Response**: Time-series performance data, trends, and comparisons
- **Use Case**: Performance analysis, trend identification, reporting

---

## AI Services

### QC Analysis with AI
- **Route**: `POST /api/ai/qc/analyze`
- **Authentication**: JWT token + `qc_validate` permission required
- **Purpose**: Comprehensive AI-powered quality control analysis of appraisal reports
- **Request Body**:
  - `reportText` (string, required): Full appraisal report text (min 50 characters)
  - `propertyData` (object, optional): Property details for context
  - `complianceRules` (array, optional): Specific compliance rules to check
  - `analysisType` (enum, optional): Analysis focus (`comprehensive`, `technical`, `compliance`, `market`)
- **Response**: Detailed QC findings with severity levels, recommendations, and pass/fail status
- **Use Case**: Automated report validation, compliance checking, quality assurance

### Technical QC Analysis
- **Route**: `POST /api/ai/qc/technical`
- **Authentication**: JWT token + `qc_validate` permission required
- **Purpose**: Technical validation focusing on methodology and calculations
- **Request Body**: Same as comprehensive QC analysis
- **Response**: Technical-specific findings and recommendations
- **Use Case**: Methodology validation, calculation verification, technical compliance

### Compliance QC Analysis
- **Route**: `POST /api/ai/qc/compliance`
- **Authentication**: JWT token + `qc_validate` permission required
- **Purpose**: Regulatory and compliance-focused validation
- **Request Body**:
  - `reportText` (string, required): Report content
  - `complianceRules` (array, optional): Specific rules to validate
  - `jurisdiction` (string, optional): Location for jurisdiction-specific rules
- **Response**: Compliance findings with regulatory references
- **Use Case**: USPAP compliance, regulatory validation, jurisdiction-specific checks

### Market Insights Generation
- **Route**: `POST /api/ai/market/insights`
- **Authentication**: JWT token required
- **Purpose**: Generate comprehensive AI-powered market analysis and insights
- **Request Body**:
  - `propertyData` (object, required): Property details including address, type, size
  - `marketContext` (object, optional): Analysis date, purpose, market conditions
  - `analysisScope` (enum, optional): Scope of analysis (`local`, `regional`, `national`)
- **Response**: Detailed market insights including positioning, trends, and recommendations
- **Use Case**: Market analysis, competitive positioning, investment evaluation

### Property Description Generation
- **Route**: `POST /api/ai/property/description`
- **Authentication**: JWT token required
- **Purpose**: Generate compelling property descriptions using AI
- **Request Body**:
  - `propertyData` (object, required): Property details and features
  - `imageUrls` (array, optional): Property images for enhanced descriptions
  - `style` (string, optional): Description style (professional, marketing, technical)
  - `targetAudience` (string, optional): Target audience for description
- **Response**: AI-generated property description with analysis metadata
- **Use Case**: Automated report writing, property marketing, description standardization

### Image Analysis
- **Route**: `POST /api/ai/vision/analyze`
- **Authentication**: JWT token required
- **Purpose**: Comprehensive AI-powered analysis of property images
- **Request Body**:
  - `imageUrls` (array, required): 1-10 property image URLs
  - `analysisType` (enum, optional): Analysis focus (`condition`, `features`, `compliance`, `market`)
  - `propertyContext` (object, optional): Property details for context
- **Response**: Structured image analysis with findings and confidence scores
- **Use Case**: Visual property assessment, condition evaluation, feature identification

### Property Condition Analysis
- **Route**: `POST /api/ai/vision/condition`
- **Authentication**: JWT token required
- **Purpose**: Detailed condition assessment from property images
- **Request Body**:
  - `imageUrls` (array, required): Property images
  - `focusAreas` (array, optional): Specific areas to analyze
- **Response**: Condition assessment with ratings and recommendations
- **Use Case**: Condition reporting, maintenance assessment, safety evaluation

### Text Embeddings Generation
- **Route**: `POST /api/ai/embeddings`
- **Authentication**: JWT token required
- **Purpose**: Generate vector embeddings for text similarity and semantic search
- **Request Body**:
  - `texts` (array, required): 1-100 text strings to embed
  - `model` (string, optional): Specific embedding model to use
  - `provider` (enum, optional): AI provider preference
- **Response**: Vector embeddings with dimensions and metadata
- **Use Case**: Semantic search, document similarity, knowledge base integration

### Custom AI Completion
- **Route**: `POST /api/ai/completion`
- **Authentication**: JWT token + `ai_generate` permission required
- **Purpose**: Custom AI text generation with full control
- **Request Body**:
  - `messages` (array, required): Conversation messages with roles
  - `temperature` (float, optional): Creativity level (0.0-2.0)
  - `maxTokens` (int, optional): Maximum response length
  - `model` (string, optional): Specific model to use
  - `provider` (enum, optional): Provider preference (`azure-openai`, `google-gemini`, `auto`)
- **Response**: Generated text with performance metrics
- **Use Case**: Custom analysis, specialized reports, flexible AI integration

### AI Service Health Check
- **Route**: `GET /api/ai/health`
- **Authentication**: None required
- **Purpose**: Monitor AI service health and provider availability
- **Response**: Provider status, circuit breaker states, and availability
- **Use Case**: System monitoring, provider status verification, health checks

### AI Usage Statistics
- **Route**: `GET /api/ai/usage`
- **Authentication**: JWT token + `analytics_view` permission required
- **Purpose**: Detailed usage statistics and cost tracking for AI services
- **Response**: Token usage, costs, request counts by provider
- **Use Case**: Cost management, usage monitoring, budget tracking

---

## Property Intelligence

### Address Geocoding
- **Route**: `POST /api/property-intelligence/address/geocode`
- **Authentication**: JWT token required
- **Purpose**: Convert property address to latitude/longitude coordinates
- **Response**: Geocoded coordinates with accuracy indicators
- **Use Case**: Property location mapping, coordinate-based analysis

### Address Validation
- **Route**: `POST /api/property-intelligence/address/validate`
- **Authentication**: JWT token required
- **Purpose**: Validate and standardize property address format
- **Response**: Validated address with standardization corrections
- **Use Case**: Data quality, address normalization

### Comprehensive Property Analysis
- **Route**: `POST /api/property-intelligence/analyze/comprehensive`
- **Authentication**: JWT token required
- **Purpose**: Full property intelligence analysis with multiple data sources
- **Request Body**: Property coordinates and analysis strategy
- **Response**: Comprehensive property data including demographics, market data, risk factors
- **Use Case**: Complete property evaluation, appraisal support

### Creative Feature Analysis
- **Route**: `POST /api/property-intelligence/analyze/creative`
- **Authentication**: JWT token required
- **Purpose**: Advanced AI-powered property feature analysis
- **Response**: Creative insights, unique property characteristics
- **Use Case**: Enhanced property descriptions, marketing insights

### View Analysis
- **Route**: `POST /api/property-intelligence/analyze/view`
- **Authentication**: JWT token required
- **Purpose**: Analyze property views and visual characteristics
- **Response**: View quality assessment, scenic value analysis
- **Use Case**: View premium calculation, property positioning

### Transportation Analysis
- **Route**: `POST /api/property-intelligence/analyze/transportation`
- **Authentication**: JWT token required
- **Purpose**: Analyze transportation accessibility and options
- **Response**: Transit scores, commute times, transportation infrastructure
- **Use Case**: Accessibility valuation, commuter property analysis

### Neighborhood Analysis
- **Route**: `POST /api/property-intelligence/analyze/neighborhood`
- **Authentication**: JWT token required
- **Purpose**: Comprehensive neighborhood characteristics and trends
- **Response**: Neighborhood demographics, amenities, market trends
- **Use Case**: Market positioning, comparative market analysis

### Batch Analysis
- **Route**: `POST /api/property-intelligence/analyze/batch`
- **Authentication**: JWT token required
- **Purpose**: Process multiple properties in single request
- **Response**: Array of property analysis results
- **Use Case**: Portfolio analysis, bulk property evaluation

### Census Demographics
- **Route**: `GET /api/property-intelligence/census/demographics`
- **Authentication**: JWT token required
- **Purpose**: Retrieve US Census demographic data for area
- **Response**: Population demographics, age distributions, household data
- **Use Case**: Market research, demographic analysis

### Census Economics
- **Route**: `GET /api/property-intelligence/census/economics`
- **Authentication**: JWT token required
- **Purpose**: Retrieve economic indicators from US Census
- **Response**: Income levels, employment statistics, economic indicators
- **Use Case**: Economic impact assessment, market viability

### Census Housing
- **Route**: `GET /api/property-intelligence/census/housing`
- **Authentication**: JWT token required
- **Purpose**: Retrieve housing statistics from US Census
- **Response**: Housing stock, ownership rates, housing costs
- **Use Case**: Housing market analysis, competitive positioning

### Comprehensive Census Intelligence
- **Route**: `GET /api/property-intelligence/census/comprehensive`
- **Authentication**: JWT token required
- **Purpose**: Complete census data analysis for property area
- **Response**: All census categories with integrated analysis
- **Use Case**: Complete market research, comprehensive property context

### Property Intelligence Health Check
- **Route**: `GET /api/property-intelligence/health`
- **Authentication**: None required
- **Purpose**: Verify property intelligence service functionality
- **Response**: Service status and external API connectivity
- **Use Case**: Service monitoring, integration health checks

---

## Dynamic Code Execution

### Execute Code
- **Route**: `POST /api/code/execute`
- **Authentication**: JWT token + `code_execute` permission required
- **Purpose**: Execute custom business logic code in secure sandbox
- **Request Body**:
  - `code` (string, required): JavaScript code to execute (max 10KB)
  - `context` (object, optional): Execution context and variables
  - `timeout` (number, optional): Execution timeout in ms (100-30000)
  - `memoryLimit` (number, optional): Memory limit in bytes (1KB-64MB)
- **Response**: Execution results, performance metrics, or error details
- **Use Case**: Custom calculations, business rules, dynamic pricing

---

## Security & Permissions

### Role-Based Access Control

**Admin Role**:
- Full access to all endpoints and functionality
- User management and system configuration

**Manager Role**:
- Order management and vendor assignment
- QC validation and analytics access
- AI-powered QC analysis and market insights
- Vendor management capabilities

**Appraiser Role**:
- Order viewing and status updates
- Property description generation
- Image analysis for assigned properties
- Limited to assigned orders

**QC Analyst Role**:
- Quality control validation
- AI-powered QC analysis (all types)
- QC metrics and analytics access
- Order review capabilities

### Rate Limiting & Security

- **Rate Limiting**: 100 requests per 15-minute window per IP address
- **Security Headers**: Helmet.js security middleware applied
- **CORS**: Configurable origin restrictions for production
- **Content Security Policy**: Strict CSP headers for XSS protection
- **JWT Tokens**: 24-hour expiration with refresh capability

### Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "details": "Additional error context",
  "timestamp": "2025-11-23T10:30:00Z"
}
```

Common error codes:
- `TOKEN_REQUIRED`: Missing authentication token
- `TOKEN_INVALID`: Invalid or expired token
- `PERMISSION_DENIED`: Insufficient permissions
- `VALIDATION_ERROR`: Request validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_SERVER_ERROR`: Server-side error

---

## Integration Examples

### Creating an Order Workflow

1. **Authenticate**: `POST /api/auth/login`
2. **Create Order**: `POST /api/orders`
3. **Assign Vendor**: `POST /api/vendors/assign/:orderId`
4. **Track Progress**: `GET /api/orders/:orderId`
5. **Perform QC**: `POST /api/qc/validate/:orderId`
6. **Deliver Report**: `POST /api/orders/:orderId/deliver`

### Property Analysis Workflow

1. **Validate Address**: `POST /api/property-intelligence/address/validate`
2. **Geocode Location**: `POST /api/property-intelligence/address/geocode`
3. **Comprehensive Analysis**: `POST /api/property-intelligence/analyze/comprehensive`
4. **Get Census Data**: `GET /api/property-intelligence/census/comprehensive`

### Analytics Dashboard Workflow

1. **Get Overview**: `GET /api/analytics/overview`
2. **Order Dashboard**: `GET /api/orders/dashboard`
3. **QC Metrics**: `GET /api/qc/metrics`
4. **Performance Analytics**: `GET /api/analytics/performance`

---

## Development & Testing

### Environment Configuration

Required environment variables:
- `AZURE_COSMOS_ENDPOINT`: Cosmos DB endpoint
- `AZURE_COSMOS_KEY`: Cosmos DB access key
- `JWT_SECRET`: JWT signing secret
- `GOOGLE_MAPS_API_KEY`: Google Maps API key
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI endpoint

### API Testing

- **Swagger UI**: Available at `/api-docs` for interactive testing
- **Health Check**: Use `/health` endpoint for connectivity verification
- **Authentication**: All protected routes require `Authorization: Bearer <token>` header

This comprehensive API provides full functionality for appraisal management, from order creation through delivery, with integrated quality control, vendor management, and advanced property intelligence capabilities.