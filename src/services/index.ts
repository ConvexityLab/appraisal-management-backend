// Service Exports
export { ConsolidatedCosmosDbService } from './consolidated-cosmos.service.js';

// Core services (actively maintained)
export { CosmosDbService } from './cosmos-db.service.js';
export { DatabaseService } from './database.service.js';
export { OrderManagementService } from './order-management.service.js';
export { VendorManagementService } from './vendor-management.service.js';
export { PropertyManagementService } from './property-management.service.js';
export { NotificationService } from './notification.service.js';
export { AuditService } from './audit.service.js';
export { QualityControlEngine } from './quality-control-engine.service.js';
export { AdvancedSearchService } from './advanced-search.service.js';
export { OrderEventService } from './order-event.service.js';

// Legacy services (temporarily disabled for compilation)
// These will be re-enabled once they're updated to work with the new consolidated architecture
// export { ValuationEngine } from './valuation-engine.service.js';
// export { PortfolioAnalyticsService } from './portfolio-analytics.service.js';
// export { EnhancedDatabaseService } from './enhanced-database.service.js';
// export { EnhancedPropertyService } from './enhanced-property.service.js';
// export { EnhancedPropertyService as EnhancedPropertyCosmosService } from './enhanced-property-cosmos.service.js';
// export { ProductionDatabaseService } from './production-database.service.js';
// export { PerligoProductionService } from './perligo-production.service.js';