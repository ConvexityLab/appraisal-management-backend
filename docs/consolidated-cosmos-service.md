# Consolidated Cosmos DB Service

The `ConsolidatedCosmosDbService` is the new unified service for interacting with our consolidated Azure Cosmos DB instance. This service replaces multiple existing database services and provides a single, optimized interface for all database operations.

## Overview

After the database consolidation effort, we now have:
- **Single Cosmos DB instance** instead of multiple databases
- **4 optimized containers** with proper partitioning:
  - `orders` - partitioned by `status`
  - `vendors` - partitioned by `status` 
  - `property-summaries` - partitioned by `propertyType`
  - `properties` - partitioned by `id`

## Configuration

The service automatically reads configuration from environment variables set by our Bicep deployment:

```typescript
COSMOS_ENDPOINT=<cosmos-db-endpoint>
COSMOS_KEY=<cosmos-db-key>
COSMOS_DATABASE_NAME=appraisal-management
COSMOS_CONTAINER_ORDERS=orders
COSMOS_CONTAINER_VENDORS=vendors
COSMOS_CONTAINER_PROPERTY_SUMMARIES=property-summaries
COSMOS_CONTAINER_PROPERTIES=properties
```

## Usage

### Basic Setup

```typescript
import { ConsolidatedCosmosDbService } from '../services/consolidated-cosmos.service.js';

const cosmosService = new ConsolidatedCosmosDbService();

// Initialize connection
const connectionResult = await cosmosService.connect();
if (!connectionResult.success) {
  console.error('Failed to connect:', connectionResult.error);
  return;
}

// Check service health
const healthCheck = await cosmosService.healthCheck();
console.log('Service health:', healthCheck.data);
```

### Order Operations

```typescript
// Create a new order
const orderData = {
  clientId: 'client123',
  orderNumber: 'ORD-2024-001',
  propertyAddress: {
    streetAddress: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    county: 'Sangamon'
  },
  propertyDetails: {
    propertyType: 'SINGLE_FAMILY',
    squareFeet: 2000,
    bedrooms: 3,
    bathrooms: 2
  },
  orderType: 'APPRAISAL',
  productType: 'FULL_APPRAISAL',
  dueDate: new Date('2024-02-15'),
  rushOrder: false,
  borrowerInformation: {
    firstName: 'John',
    lastName: 'Doe',
    phone: '555-0123',
    email: 'john.doe@email.com'
  },
  loanInformation: {
    loanAmount: 250000,
    loanType: 'CONVENTIONAL',
    loanPurpose: 'PURCHASE'
  },
  contactInformation: {
    primaryContact: 'Jane Smith',
    phone: '555-0456',
    email: 'jane.smith@lender.com'
  },
  status: 'NEW',
  priority: 'NORMAL',
  createdBy: 'user123',
  tags: ['residential', 'conventional'],
  metadata: {}
};

const result = await cosmosService.createOrder(orderData);
if (result.success) {
  console.log('Order created:', result.data.id);
} else {
  console.error('Failed to create order:', result.error);
}

// Search orders
const searchResult = await cosmosService.searchOrders({
  status: ['NEW', 'IN_PROGRESS'],
  clientId: 'client123',
  dueDateFrom: new Date('2024-01-01'),
  dueDateTo: new Date('2024-12-31')
});

if (searchResult.success) {
  console.log(`Found ${searchResult.data.length} orders`);
  searchResult.data.forEach(order => {
    console.log(`- ${order.orderNumber}: ${order.status}`);
  });
}

// Get specific order
const order = await cosmosService.getOrder('order_id', 'NEW');
if (order.success) {
  console.log('Order details:', order.data);
}

// Update order
const updateResult = await cosmosService.updateOrder('order_id', 'NEW', {
  status: 'IN_PROGRESS',
  assignedVendorId: 'vendor123'
});
```

### Vendor Operations

```typescript
// Create vendor
const vendorData = {
  name: 'ABC Appraisal Services',
  email: 'contact@abcappraisals.com',
  phone: '555-0789',
  licenseNumber: 'IL-12345',
  licenseState: 'IL',
  licenseExpiry: new Date('2025-12-31'),
  certifications: [],
  serviceAreas: ['Springfield', 'Decatur'],
  productTypes: ['FULL_APPRAISAL', 'BPO'],
  specialties: ['RESIDENTIAL'],
  performance: {
    completedOrders: 0,
    averageRating: 0,
    onTimeDeliveryRate: 0
  },
  status: 'ACTIVE',
  onboardingDate: new Date(),
  lastActive: new Date(),
  insuranceInfo: {
    carrier: 'Insurance Co',
    policyNumber: 'POL-123',
    expiryDate: new Date('2025-06-30'),
    coverageAmount: 1000000
  },
  paymentInfo: {
    method: 'ACH',
    accountDetails: 'encrypted_data'
  },
  preferences: {}
};

const vendorResult = await cosmosService.createVendor(vendorData);

// Search vendors
const vendorSearch = await cosmosService.searchVendors({
  status: ['ACTIVE'],
  licenseState: 'IL',
  serviceArea: 'Springfield'
});
```

### Property Operations

```typescript
// Create property summary
const propertyData = {
  address: {
    street: '456 Oak Ave',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    county: 'Sangamon'
  },
  propertyType: 'SINGLE_FAMILY',
  condition: 'GOOD',
  building: {
    yearBuilt: 1995,
    livingAreaSquareFeet: 1800,
    bedroomCount: 3,
    bathroomCount: 2
  },
  valuation: {
    estimatedValue: 275000
  }
};

const propertyResult = await cosmosService.createPropertySummary(propertyData);

// Search properties
const propertySearch = await cosmosService.searchProperties({
  propertyType: ['SINGLE_FAMILY'],
  city: 'Springfield',
  state: 'IL',
  minSquareFeet: 1500,
  maxSquareFeet: 2500
});
```

### Error Handling

All methods return a standardized `ApiResponse<T>` format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationInfo;
  metadata?: Record<string, any>;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}
```

Always check the `success` property before using the data:

```typescript
const result = await cosmosService.getOrder('order_id', 'NEW');
if (result.success) {
  // Use result.data
  console.log('Order:', result.data);
} else {
  // Handle error
  console.error('Error:', result.error?.message);
  console.error('Error code:', result.error?.code);
}
```

### Monitoring and Health

```typescript
// Check if service is ready
if (cosmosService.isReady()) {
  console.log('Service is ready for operations');
}

// Get container statistics
const stats = await cosmosService.getContainerStats();
if (stats.success) {
  console.log('Container statistics:', stats.data);
}

// Health check for monitoring
const health = await cosmosService.healthCheck();
if (health.success) {
  console.log('Service status:', health.data.status);
  console.log('Available containers:', health.data.containers);
}
```

### Cleanup

```typescript
// Always disconnect when done
await cosmosService.disconnect();
```

## Migration from Legacy Services

This service is designed to replace:
- `CosmosDbService`
- `DatabaseService` 
- Individual entity services (OrderManagementService, VendorManagementService, etc.)

When migrating:

1. Replace service imports
2. Update connection initialization (single `connect()` call)
3. Update method calls to use new standardized API
4. Update error handling to use new `ApiResponse` format
5. Test thoroughly with the new consolidated containers

## Performance Benefits

- **Reduced connection overhead** - Single database connection
- **Optimized partitioning** - Proper partition keys for each container
- **Efficient queries** - Designed for common access patterns
- **Better resource utilization** - Consolidated request units
- **Simplified monitoring** - Single service to monitor

## Container Partitioning Strategy

- **orders**: Partitioned by `status` - optimizes for status-based queries
- **vendors**: Partitioned by `status` - separates active vs inactive vendors  
- **property-summaries**: Partitioned by `propertyType` - groups similar properties
- **properties**: Partitioned by `id` - ensures even distribution for point reads