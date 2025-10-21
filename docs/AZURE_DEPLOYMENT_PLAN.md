# Azure Deployment Plan - Appraisal Management Platform

## Overview

This document outlines the Infrastructure as Code (IaC) deployment strategy for the Appraisal Management Platform using Azure Bicep templates and GitHub Actions CI/CD pipelines.

## Architecture Summary

### Core Components
- **App Service**: Production-ready Node.js API server
- **Cosmos DB**: Primary database for orders, properties, vendors, users
- **Service Bus**: Event-driven messaging between services
- **Key Vault**: Secure storage for secrets and connection strings
- **Application Insights**: Monitoring, logging, and performance tracking
- **Storage Account**: File storage for appraisal documents and reports

### Environment Strategy
- **Development**: Single resource group, minimal SKUs for cost efficiency
- **Staging**: Production-like environment for testing
- **Production**: High-availability, geo-redundant configuration

## Infrastructure Requirements

### Resource Groups
```
rg-appraisal-dev-eastus2
rg-appraisal-staging-eastus2  
rg-appraisal-prod-eastus2
rg-appraisal-prod-westus2 (DR)
```

### Azure Resources per Environment

#### App Service Plan & App Service
- **Development**: B1 Basic (1 Core, 1.75GB RAM)
- **Staging**: S2 Standard (2 Cores, 3.5GB RAM)
- **Production**: P2v3 Premium (2 Cores, 8GB RAM, Auto-scaling)

#### Cosmos DB
- **Development**: Serverless mode, single region
- **Staging**: Provisioned throughput (400 RU/s), single region
- **Production**: Provisioned throughput (1000 RU/s), multi-region with automatic failover

#### Service Bus
- **Development**: Basic tier
- **Staging**: Standard tier
- **Production**: Premium tier with geo-disaster recovery

#### Key Vault
- **All Environments**: Standard tier with soft delete enabled

#### Application Insights
- **All Environments**: Standard tier with log analytics workspace

#### Storage Account
- **Development**: LRS (Locally Redundant Storage)
- **Staging**: ZRS (Zone Redundant Storage)
- **Production**: GRS (Geo-Redundant Storage)

## Bicep Template Structure

### Main Template (`main.bicep`)
Orchestrates all resource deployments with environment-specific parameters.

### Modules
- `modules/app-service.bicep` - App Service Plan and Web App
- `modules/cosmos-db.bicep` - Cosmos DB account and containers
- `modules/service-bus.bicep` - Service Bus namespace and queues
- `modules/key-vault.bicep` - Key Vault with secrets
- `modules/monitoring.bicep` - Application Insights and Log Analytics
- `modules/storage.bicep` - Storage account for documents
- `modules/networking.bicep` - VNet, subnets, NSGs (production only)

### Parameter Files
- `parameters/dev.parameters.json` - Development environment
- `parameters/staging.parameters.json` - Staging environment  
- `parameters/prod.parameters.json` - Production environment

## GitHub Actions Workflow Strategy

### Workflow Files
1. **`.github/workflows/ci.yml`** - Continuous Integration
   - Code quality checks (ESLint, Prettier)
   - TypeScript compilation
   - Unit tests
   - Security scanning

2. **`.github/workflows/infrastructure.yml`** - Infrastructure Deployment
   - Bicep template validation
   - Deploy to development environment
   - Deploy to staging (on release branch)
   - Deploy to production (manual approval)

3. **`.github/workflows/application.yml`** - Application Deployment
   - Build Node.js application
   - Deploy to App Service
   - Run integration tests
   - Health check validation

### Deployment Flow
```
Developer Push → CI Validation → Infrastructure Deploy (Dev) → App Deploy (Dev) → Tests
                                      ↓
Release Branch → Infrastructure Deploy (Staging) → App Deploy (Staging) → Tests
                                      ↓
Manual Approval → Infrastructure Deploy (Prod) → App Deploy (Prod) → Health Check
```

## Security Implementation

### Authentication & Authorization
- **Service Principal**: Dedicated SP for GitHub Actions with minimal required permissions
- **RBAC**: Role-based access control for each environment
- **Managed Identity**: App Service uses managed identity for Azure resource access

### Secrets Management
- Database connection strings in Key Vault
- Service Bus connection strings in Key Vault  
- External API keys in Key Vault
- GitHub repository secrets for deployment credentials

### Network Security
- **Development**: Public endpoints with IP restrictions
- **Staging**: VNet integration with private endpoints
- **Production**: Full VNet isolation with private endpoints and WAF

## Environment Configuration

### Development Environment
```json
{
  "environment": "dev",
  "location": "eastus2",
  "appServicePlan": {
    "sku": "B1",
    "capacity": 1
  },
  "cosmosDb": {
    "tier": "Serverless",
    "locations": ["East US 2"]
  },
  "serviceBus": {
    "tier": "Basic"
  }
}
```

### Production Environment
```json
{
  "environment": "prod",
  "location": "eastus2",
  "secondaryLocation": "westus2",
  "appServicePlan": {
    "sku": "P2v3",
    "capacity": 2,
    "autoScale": true
  },
  "cosmosDb": {
    "tier": "Provisioned",
    "throughput": 1000,
    "locations": ["East US 2", "West US 2"],
    "automaticFailover": true
  },
  "serviceBus": {
    "tier": "Premium",
    "geoRecovery": true
  }
}
```

## Monitoring & Alerting

### Application Insights Metrics
- Response time and throughput
- Dependency failures (Cosmos DB, Service Bus)
- Exception tracking and error rates
- Custom business metrics (orders processed, etc.)

### Azure Monitor Alerts
- App Service CPU/Memory thresholds
- Cosmos DB RU consumption
- Service Bus message queue depth
- Key Vault access anomalies

### Log Analytics Queries
- Application error analysis
- Performance trending
- Security event monitoring
- Cost optimization insights

## Disaster Recovery

### Backup Strategy
- **Cosmos DB**: Automatic backups with point-in-time restore
- **App Service**: Source code in GitHub, infrastructure in Bicep
- **Key Vault**: Soft delete enabled, backup to secondary region
- **Storage Account**: Geo-redundant storage with read access

### Failover Procedures
1. **Automatic**: Cosmos DB automatic regional failover
2. **Manual**: App Service deployment to secondary region
3. **RTO Target**: 4 hours for full service restoration
4. **RPO Target**: 1 hour maximum data loss

## Cost Optimization

### Development Environment
- **Monthly Estimate**: $150-200
- Serverless Cosmos DB, Basic Service Bus
- Scheduled shutdown for non-business hours

### Production Environment
- **Monthly Estimate**: $800-1200
- Reserved instances for App Service
- Cosmos DB autoscale configuration
- Storage lifecycle policies

### Cost Monitoring
- Azure Cost Management alerts
- Resource tagging for cost allocation
- Monthly cost review and optimization

## Deployment Validation

### Pre-Deployment Checks
- Bicep template validation
- Parameter file validation
- Security policy compliance
- Resource naming convention adherence

### Post-Deployment Validation
- Health endpoint verification
- Database connectivity tests
- Service Bus messaging tests
- Application Insights telemetry validation

### Rollback Strategy
- Infrastructure: Previous ARM deployment
- Application: Previous container image
- Database: Point-in-time restore if needed
- DNS: Traffic manager failover

## Implementation Timeline

### Phase 1: Foundation (Week 1)
- Create Bicep templates and parameter files
- Setup GitHub Actions workflows
- Deploy development environment

### Phase 2: Staging (Week 2)
- Configure staging environment
- Implement automated testing
- Security and compliance validation

### Phase 3: Production (Week 3)
- Production environment deployment
- Disaster recovery setup
- Monitoring and alerting configuration

### Phase 4: Optimization (Week 4)
- Performance tuning
- Cost optimization
- Documentation and runbooks

## Success Criteria

### Technical
- ✅ Zero-downtime deployments
- ✅ Sub-2-second API response times
- ✅ 99.9% availability SLA
- ✅ Automated security scanning

### Operational
- ✅ Complete Infrastructure as Code
- ✅ Automated CI/CD pipeline
- ✅ Comprehensive monitoring
- ✅ Disaster recovery tested

### Business
- ✅ Development velocity increased
- ✅ Infrastructure costs optimized
- ✅ Security compliance maintained
- ✅ Scalability requirements met

---

*This plan provides a robust, secure, and scalable foundation for the Appraisal Management Platform on Azure.*