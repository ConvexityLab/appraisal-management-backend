# Appraisal Management Platform - Web API

A comprehensive REST API server for the appraisal management platform with authentication, validation, and comprehensive documentation.

## Features

### 🔐 Authentication & Security
- JWT-based authentication with role-based permissions
- Password hashing with bcrypt
- Rate limiting and CORS protection
- Helmet security middleware
- Request validation with express-validator

### 📊 Order Management API
- Create orders with property intelligence pre-qualification
- Retrieve orders with filtering and pagination
- Update order status with audit trail
- Deliver orders with automatic QC validation
- Real-time dashboard with metrics

### 🏢 Vendor Management API
- Intelligent vendor assignment algorithms
- Vendor performance tracking
- Service area and type management
- Availability monitoring
- Assignment scoring with multi-criteria evaluation

### ✅ QC Validation API
- Comprehensive appraisal validation using Census data
- Market validation with comparable properties
- Risk assessment and fraud detection
- Performance metrics and trending
- Automated quality scoring

### 📈 Analytics API
- Performance analytics with time-based grouping
- Vendor performance comparisons
- Order volume and completion trends
- QC score analysis and recommendations
- Executive dashboard summaries

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Update .env with your configuration
# At minimum, set JWT_SECRET to a secure value
```

### Development

```bash
# Start development server with hot reloading
npm run dev

# Start API server specifically
npm run api

# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh JWT token

### Order Management
- `POST /api/orders` - Create new order
- `GET /api/orders` - Get orders with filters
- `GET /api/orders/:orderId` - Get specific order
- `PUT /api/orders/:orderId/status` - Update order status
- `POST /api/orders/:orderId/deliver` - Deliver order
- `GET /api/orders/dashboard` - Order dashboard

### QC Validation
- `POST /api/qc/validate/:orderId` - Perform QC validation
- `GET /api/qc/results/:orderId` - Get QC results
- `GET /api/qc/metrics` - Get QC metrics

### Vendor Management
- `GET /api/vendors` - Get all vendors
- `POST /api/vendors` - Create vendor
- `PUT /api/vendors/:vendorId` - Update vendor
- `POST /api/vendors/assign/:orderId` - Assign vendor
- `GET /api/vendors/performance/:vendorId` - Get performance

### Analytics
- `GET /api/analytics/overview` - Analytics overview
- `GET /api/analytics/performance` - Performance analytics

## Authentication

All API endpoints (except health check and auth endpoints) require authentication using JWT Bearer tokens.

### Getting a Token

```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "manager"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

### Using the Token

```bash
# Include in Authorization header
curl -X GET http://localhost:3000/api/orders \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## User Roles & Permissions

### Admin
- Full access to all endpoints
- User management capabilities
- System configuration

### Manager
- Order management
- Vendor management
- QC validation
- Analytics viewing

### Appraiser
- View and update assigned orders
- Submit deliveries

### QC Analyst
- Perform QC validations
- View QC metrics
- Generate reports

## Request/Response Examples

### Create Order

```bash
curl -X POST http://localhost:3000/api/orders \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "propertyAddress": "123 Main Street, Anytown, ST 12345",
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "orderType": "purchase",
    "priority": "standard",
    "dueDate": "2024-02-15T00:00:00.000Z"
  }'
```

Response:
```json
{
  "orderId": "ord_123456789",
  "status": "pending",
  "propertyAddress": "123 Main Street, Anytown, ST 12345",
  "propertyIntelligence": {
    "demographics": {
      "medianIncome": 75000,
      "population": 25000
    },
    "marketData": {
      "averageHomeValue": 350000,
      "pricePerSqFt": 185
    }
  },
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

### Perform QC Validation

```bash
curl -X POST http://localhost:3000/api/qc/validate/ord_123456789 \\
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "orderId": "ord_123456789",
  "qcScore": 94.5,
  "validationResults": {
    "marketValidation": {
      "status": "passed",
      "score": 95.2,
      "confidence": "high"
    },
    "riskAssessment": {
      "status": "passed",
      "riskLevel": "low",
      "score": 93.8
    }
  },
  "recommendations": [
    "Market data validates property value within acceptable range",
    "No significant risk factors identified"
  ],
  "validatedAt": "2024-01-15T11:00:00.000Z"
}
```

## Error Handling

The API uses consistent error response format:

```json
{
  "error": "Description of the error",
  "code": "ERROR_CODE",
  "details": "Additional details when available"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate limited to prevent abuse:
- Default: 100 requests per 15 minutes per IP
- Configurable via environment variables
- Rate limit headers included in responses

## API Documentation

Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:3000/api-docs`

The documentation includes:
- Complete endpoint descriptions
- Request/response schemas
- Authentication requirements
- Interactive testing interface

## Monitoring & Health

### Health Check
```bash
curl http://localhost:3000/health
```

Response includes service status and version information.

### Logging
- Request/response logging with Morgan
- Error logging with Winston
- Configurable log levels
- Daily rotating log files

## Environment Configuration

Key environment variables:

```bash
# Server
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your-secure-secret-key
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # requests per window

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# External APIs
CENSUS_API_KEY=your-census-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-key
AZURE_MAPS_API_KEY=your-azure-maps-key
```

## Development Features

### Hot Reloading
```bash
npm run dev  # Uses ts-node-dev for automatic restarts
```

### TypeScript Support
- Full TypeScript implementation
- Strict type checking
- Auto-completion and IntelliSense

### Testing
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

### Linting
```bash
# Linting removed for production deployment simplicity
```

## Production Deployment

### Docker Support
```bash
# Build Docker image
npm run docker:build

# Run container
npm run docker:run
```

### Security Checklist
- [ ] Change default JWT_SECRET
- [ ] Configure proper CORS origins
- [ ] Set up rate limiting for production
- [ ] Enable HTTPS/TLS
- [ ] Configure proper logging
- [ ] Set up monitoring and alerts

### Performance Optimization
- Compression middleware enabled
- Response caching where appropriate
- Database connection pooling
- Async/await for non-blocking operations

## Integration with Services

The API server integrates with:
- **Order Management Service**: Full lifecycle management
- **QC Validation Service**: Comprehensive validation using Census data
- **Vendor Management Service**: Intelligent assignment algorithms
- **Property Intelligence**: Multi-provider data aggregation

## Support

For issues and questions:
1. Check the API documentation at `/api-docs`
2. Review the error response format
3. Check logs for detailed error information
4. Verify authentication and permissions

## Next Steps

The API server provides the foundation for:
1. Database integration and persistence
2. Real-time notifications via WebSockets
3. Advanced analytics and reporting
4. External system integrations

---

**Status**: ✅ Complete - Full REST API with authentication, validation, and comprehensive endpoint coverage