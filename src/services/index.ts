// Core services (actively maintained)
export { CosmosDbService } from './cosmos-db.service.js';
export { DatabaseService } from './database.service.js';
export { OrderManagementService } from './order-management.service.js';
export { VendorManagementService } from './vendor-management.service.js';
export { NotificationService } from './notification.service.js';
export { AuditService } from './audit.service.js';
export { QualityControlEngine } from './quality-control-engine.service.js';
export { AdvancedSearchService } from './advanced-search.service.js';
export { OrderEventService } from './order-event.service.js';

// Legacy services (temporarily disabled for compilation)
// These will be re-enabled once they're updated to work with the new consolidated architecture
// export { ValuationEngine } from './valuation-engine.service.js';
export { PortfolioAnalyticsService } from './portfolio-analytics.service.js';
// export { EnhancedDatabaseService } from './enhanced-database.service.js';

// Phase 1 — Core AMC Operations services
export { EngagementLetterService } from './engagement-letter.service.js';
export { BillingEnhancementService } from './billing-enhancement.service.js';
export { InspectionEnhancementService } from './inspection-enhancement.service.js';
export { DuplicateOrderDetectionService, normalizeAddress, normalizeName } from './duplicate-order-detection.service.js';
export { WaiverScreeningService } from './waiver-screening.service.js';
export { ClientConfigurationService } from './client-configuration.service.js';
export { PostDeliveryService } from './post-delivery.service.js';
// export { PerligoProductionService } from './perligo-production.service.js';

// Phase R1 — Property Aggregate Root services
export { PropertyRecordService, normalizeStreetForMatch, PROPERTY_RECORDS_CONTAINER } from './property-record.service.js';
export { PropertyObservationService, buildObservationFingerprint, PROPERTY_OBSERVATIONS_CONTAINER } from './property-observation.service.js';
export { PropertyEventOutboxService, buildPropertyEventOutboxFingerprint, PROPERTY_EVENT_OUTBOX_CONTAINER } from './property-event-outbox.service';
export { PropertyOutboxWorkerService } from './property-outbox-worker.service.js';
export { PropertyProjectorService } from './property-projector.service.js';
export { ComparableSaleService, haversineDistanceMiles, COMPARABLE_SALES_CONTAINER } from './comparable-sale.service.js';
export { BulkIngestionAdapterConfigService } from './bulk-ingestion-adapter-config.service.js';
export { BulkAdapterDefinitionService } from './bulk-adapter-definition.service.js';