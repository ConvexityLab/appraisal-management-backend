# Azure Cosmos DB Setup Guide for Appraisal Management Platform

This guide explains how to set up Azure Cosmos DB for local development and production deployment.

## Overview

The platform uses Azure Cosmos DB as the primary database with the following containers:
- **Orders**: Appraisal orders with status tracking
- **Vendors**: Vendor profiles and performance data
- **Properties**: Comprehensive property details
- **Property Summaries**: Lightweight property data for quick access
- **QC Results**: Quality control validation results
- **Analytics**: Performance metrics and reporting data

## Local Development Setup

### Option 1: Azure Cosmos DB Emulator (Recommended for Development)

1. **Download and Install Cosmos DB Emulator**
   ```bash
   # Download from Microsoft
   # https://docs.microsoft.com/en-us/azure/cosmos-db/local-emulator
   
   # Or install via Chocolatey
   choco install azure-cosmosdb-emulator
   ```

2. **Start the Emulator**
   ```bash
   # Start with default settings
   "C:\Program Files\Azure Cosmos DB Emulator\CosmosDB.Emulator.exe"
   
   # Start with custom settings (optional)
   "C:\Program Files\Azure Cosmos DB Emulator\CosmosDB.Emulator.exe" /port=8081 /EnablePreview
   ```

3. **Environment Configuration**
   The application automatically detects and uses the emulator when `NODE_ENV=development`:
   ```bash
   # .env.development
   NODE_ENV=development
   # No COSMOS_ENDPOINT or COSMOS_KEY needed - uses emulator defaults
   ```

4. **Verify Connection**
   - Emulator UI: `https://localhost:8081/_explorer/index.html`
   - Default endpoint: `https://localhost:8081`
   - Default key: `C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==`

### Option 2: Docker Cosmos DB Emulator

1. **Run Cosmos DB Emulator in Docker**
   ```bash
   docker run -p 8081:8081 -p 10251:10251 -p 10252:10252 -p 10253:10253 -p 10254:10254 \\
     -m 3g --cpus=2.0 \\
     -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 \\
     -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \\
     mcr.microsoft.com/cosmosdb/emulator
   ```

2. **Trust the SSL Certificate** (required for HTTPS)
   ```bash
   # Download certificate
   curl -k https://localhost:8081/_explorer/emulator.pem > emulatorcert.crt
   
   # Windows: Import certificate to Trusted Root Certification Authorities
   certlm.msc
   ```

## Production Setup

### Option 1: Azure Cosmos DB Cloud Service

1. **Create Cosmos DB Account**
   ```bash
   # Using Azure CLI
   az cosmosdb create \\
     --name appraisal-management-db \\
     --resource-group appraisal-rg \\
     --kind GlobalDocumentDB \\
     --locations regionName=EastUS failoverPriority=0 isZoneRedundant=False \\
     --default-consistency-level Session \\
     --enable-automatic-failover true
   ```

2. **Get Connection Details**
   ```bash
   # Get endpoint
   az cosmosdb show --name appraisal-management-db --resource-group appraisal-rg --query documentEndpoint
   
   # Get primary key
   az cosmosdb keys list --name appraisal-management-db --resource-group appraisal-rg --query primaryMasterKey
   ```

3. **Environment Configuration**
   ```bash
   # .env.production
   COSMOS_ENDPOINT=https://appraisal-management-db.documents.azure.com:443/
   COSMOS_KEY=your-primary-key-here
   NODE_ENV=production
   ```

### Option 2: Azure Container Instance with Cosmos DB

1. **Deploy with ARM Template**
   ```json
   {
     "resources": [
       {
         "type": "Microsoft.DocumentDB/databaseAccounts",
         "apiVersion": "2021-04-15",
         "name": "appraisal-management-db",
         "location": "[resourceGroup().location]",
         "properties": {
           "databaseAccountOfferType": "Standard",
           "locations": [
             {
               "locationName": "[resourceGroup().location]",
               "failoverPriority": 0,
               "isZoneRedundant": false
             }
           ],
           "consistencyPolicy": {
             "defaultConsistencyLevel": "Session"
           }
         }
       }
     ]
   }
   ```

## Database Schema and Indexing

### Container Specifications

#### Orders Container
```json
{
  "partitionKey": "/status",
  "indexingPolicy": {
    "compositeIndexes": [
      [
        { "path": "/status", "order": "ascending" },
        { "path": "/createdAt", "order": "descending" }
      ],
      [
        { "path": "/assignedVendorId", "order": "ascending" },
        { "path": "/dueDate", "order": "ascending" }
      ]
    ]
  }
}
```

#### Vendors Container
```json
{
  "partitionKey": "/licenseState",
  "indexingPolicy": {
    "compositeIndexes": [
      [
        { "path": "/status", "order": "ascending" },
        { "path": "/performance/rating", "order": "descending" }
      ]
    ]
  }
}
```

#### Property Summaries Container
```json
{
  "partitionKey": "/address/state",
  "indexingPolicy": {
    "spatialIndexes": [
      {
        "path": "/address/location/*",
        "types": ["Point"]
      }
    ],
    "compositeIndexes": [
      [
        { "path": "/address/state", "order": "ascending" },
        { "path": "/propertyType", "order": "ascending" }
      ]
    ]
  }
}
```

## Development Workflow

### 1. Initialize Database
```bash
# Start the application - database will auto-initialize
npm run dev

# Or manually initialize
npx ts-node src/scripts/init-database.ts
```

### 2. Seed Test Data
```bash
# Create sample orders, vendors, and properties
npx ts-node src/scripts/seed-database.ts
```

### 3. Run Tests
```bash
# Integration tests with database
npm test

# API tests
npm run test:api
```

## Environment Variables

### Development (.env.development)
```bash
NODE_ENV=development
PORT=3000

# Cosmos DB (auto-configured for emulator)
# COSMOS_ENDPOINT=https://localhost:8081
# COSMOS_KEY=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==

# API Configuration
JWT_SECRET=dev-secret-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Production (.env.production)
```bash
NODE_ENV=production
PORT=3000

# Cosmos DB
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your-production-key

# API Configuration
JWT_SECRET=your-secure-production-secret
ALLOWED_ORIGINS=https://your-domain.com
RATE_LIMIT_MAX=1000
```

## Monitoring and Performance

### Connection Health Check
```typescript
// API endpoint: GET /health
{
  "status": "healthy",
  "database": {
    "name": "appraisal-management",
    "latency": 45
  }
}
```

### Performance Optimization

1. **Partition Key Strategy**
   - Orders: Partitioned by `status` for even distribution
   - Vendors: Partitioned by `licenseState` for geographic queries
   - Properties: Partitioned by `address/state` for location-based queries

2. **Indexing Strategy**
   - Composite indexes for common query patterns
   - Spatial indexes for geo-location queries
   - Exclude large nested objects from indexing

3. **Query Optimization**
   - Use parameterized queries to prevent SQL injection
   - Implement pagination with OFFSET/LIMIT
   - Use projection to reduce data transfer

## Troubleshooting

### Common Issues

1. **Emulator SSL Certificate Issues**
   ```bash
   # Trust the emulator certificate
   curl -k https://localhost:8081/_explorer/emulator.pem > cosmos-emulator.crt
   # Import to trusted certificates
   ```

2. **Connection Timeout**
   ```bash
   # Increase timeout in connection policy
   connectionPolicy: {
     requestTimeout: 60000
   }
   ```

3. **Partition Key Violations**
   ```bash
   # Ensure all operations include proper partition key
   container.item(id, partitionKeyValue)
   ```

### Debug Logging
```typescript
// Enable debug logging
process.env.DEBUG = 'azure:cosmos-db'
```

## Data Migration

### Export Data
```bash
# Export from emulator
npx ts-node src/scripts/export-data.ts --source=emulator --output=./data/

# Export from production
npx ts-node src/scripts/export-data.ts --source=production --output=./backup/
```

### Import Data
```bash
# Import to emulator
npx ts-node src/scripts/import-data.ts --target=emulator --input=./data/

# Import to production
npx ts-node src/scripts/import-data.ts --target=production --input=./backup/
```

## Best Practices

1. **Always use partition keys** in queries for optimal performance
2. **Implement retry logic** for transient failures
3. **Use bulk operations** for large data sets
4. **Monitor RU consumption** to optimize costs
5. **Implement proper error handling** for connection failures
6. **Use consistent naming conventions** for containers and properties
7. **Regular backup strategy** for production data
8. **Monitor query performance** with built-in metrics

## Security Considerations

1. **Rotate access keys** regularly in production
2. **Use managed identities** when possible
3. **Implement proper authentication** in API endpoints
4. **Encrypt sensitive data** before storage
5. **Use firewall rules** to restrict access
6. **Enable audit logging** for compliance
7. **Implement proper RBAC** for team access

---

This setup provides a robust, scalable database foundation for the appraisal management platform with support for both local development and production deployment.