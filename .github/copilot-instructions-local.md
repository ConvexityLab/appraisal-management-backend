# Appraisal Management Platform - AI Agent Instructions

## Architecture Overview

This is an **enterprise appraisal management system** built as a multi-layered TypeScript/Node.js platform that integrates property intelligence, valuation workflows, and AI/ML services for real estate appraisal automation.

### Key Components
- **API Server** (`src/api/api-server.ts`): Comprehensive REST API with authentication, validation, and Swagger docs
- **Property Intelligence Engine**: Multi-provider geospatial data integration (Google Maps, Azure Maps, Census)
- **Dynamic Code Execution Service**: Secure sandboxed JavaScript execution for business rules
- **Cosmos DB Integration**: Primary data persistence with event-driven architecture
- **AI/ML Services**: Azure OpenAI integration for intelligent property analysis

## Critical Patterns

### Service Layer Architecture
Services follow a consistent pattern in `src/services/`:
```typescript
// All services extend base patterns with proper error handling
export class ExampleService {
  private logger: Logger;
  private dbService: CosmosDbService;
  
  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }
}
```

### Controller Pattern
Controllers in `src/controllers/` handle request/response with validation:
```typescript
// Standard controller pattern with express-validator
export const createOrderRouter = () => {
  const router = express.Router();
  
  router.post('/orders', 
    validateOrderRequest(), 
    handleValidationErrors,
    async (req: Request, res: Response) => {
      // Implementation
    }
  );
};
```

### Database Service Pattern
- **Primary**: Cosmos DB via `CosmosDbService` for all persistent data
- **Pattern**: Use container-based operations with consistent error handling
- **Event-driven**: All database operations trigger events via Azure Service Bus

## Development Workflows

### Build & Run Commands
```bash
# Development with hot reload
npm run dev

# Production build
npm run build && npm start

# Testing
npm test                    # Jest unit tests
npm run test:cosmos        # Cosmos DB integration tests
npm run test:events        # Event-driven architecture tests
```

### Key Scripts
- `npm run demo:events` - Run event-driven architecture demo
- `npm run test:verification` - Run comprehensive verification tests
- `npm run docker:build` - Build Docker container

## Project-Specific Conventions

### Import Paths
Uses TypeScript path mapping (tsconfig.json):
```typescript
import { Logger } from '@/utils/logger';
import { OrderService } from '@/services/order-management.service';
```

### Error Handling
Consistent error pattern across all services:
```typescript
interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}
```

### Environment Configuration
Critical environment variables for development:
- `AZURE_COSMOS_ENDPOINT` / `AZURE_COSMOS_KEY`
- `GOOGLE_MAPS_API_KEY`
- `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_API_KEY`
- `JWT_SECRET` for authentication

## Integration Points

### External APIs
- **Google Maps Platform**: Property intelligence, geocoding, place details
- **Azure Maps**: Alternative geospatial provider
- **US Census API**: Demographic and economic data
- **SmartyStreets**: Address validation and standardization

### Azure Services
- **Cosmos DB**: Primary database (containers: orders, properties, vendors, users)
- **Service Bus**: Event messaging between services
- **OpenAI**: AI/ML processing for property analysis
- **Key Vault**: Secrets management

### Property Intelligence Pipeline
Key service: `enhanced-property-intelligence.controller.ts`
```typescript
// Comprehensive analysis endpoint
POST /api/property-intelligence/analyze/comprehensive
{
  "latitude": 37.4224764,
  "longitude": -122.0842499,
  "strategy": "quality_first"
}
```

## Testing Patterns

### Test Structure
- Unit tests: `src/tests/` (Jest)
- Integration tests: Cosmos DB, API endpoints
- Demo scripts: `src/demos/` for feature validation

### Key Test Commands
```typescript
// Run specific test suites
npm run test:cosmos     // Database integration
npm run test:events     // Event-driven workflows
npm run test:verification // End-to-end validation
```

## Security & Performance

### Dynamic Code Execution
Secure sandbox via `dynamic-code-execution.service.ts`:
- VM2 isolation with timeout protection
- Memory limits and no file system access
- Used for business rules and financial calculations

### Authentication
JWT-based with role-based permissions:
```typescript
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}
```

## Key Files to Reference

- `src/api/api-server.ts` - Main API server with all endpoints
- `src/services/enhanced-property-intelligence.service.ts` - Core property analysis
- `src/services/cosmos-db.service.ts` - Database abstraction layer
- `package.json` - All available scripts and dependencies
- `DYNAMIC_CODE_EXECUTION_SERVICE.md` - Sandboxed execution documentation

When adding features, follow the established service → controller → route pattern and ensure proper error handling, logging, and event emission for audit trails.