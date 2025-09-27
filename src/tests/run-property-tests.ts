import { Logger } from '../utils/logger.js';
import TwoLevelPropertyTestSuite from './two-level-property-tests.js';
import { DatabaseService } from '../services/database.service.js';

/**
 * Test Runner for Two-Level Property Architecture
 * Executes comprehensive tests and generates performance reports
 */
class PropertyArchitectureTestRunner {
  private logger: Logger;
  private testSuite: TwoLevelPropertyTestSuite;
  private databaseService: DatabaseService;

  constructor() {
    this.logger = new Logger();
    this.testSuite = new TwoLevelPropertyTestSuite();
    this.databaseService = new DatabaseService();
  }

  /**
   * Main test runner method
   */
  async runTests(): Promise<void> {
    this.logger.info('Starting Property Architecture Test Runner');
    
    const startTime = Date.now();

    try {
      // Initialize test environment
      await this.initializeTestEnvironment();

      // Run comprehensive test suite
      await this.testSuite.runAllTests();

      // Generate test report
      await this.testSuite.generateTestReport();

      // Cleanup test environment
      await this.cleanupTestEnvironment();

      const totalTime = Date.now() - startTime;
      this.logger.info(`Property Architecture tests completed in ${totalTime}ms`);

      // Generate final summary
      this.generateFinalSummary(totalTime);

    } catch (error) {
      this.logger.error('Property Architecture test runner failed', { error });
      await this.cleanupTestEnvironment();
      throw error;
    }
  }

  /**
   * Initialize test environment
   */
  private async initializeTestEnvironment(): Promise<void> {
    this.logger.info('Initializing test environment');

    try {
      // Ensure database connection
      if (!this.databaseService.isConnected()) {
        await this.databaseService.connect();
      }

      // Create test collections if needed
      const collections = ['properties', 'test_properties'];
      for (const collection of collections) {
        try {
          await this.databaseService.createCollection(collection);
        } catch (error) {
          // Collection might already exist
          this.logger.debug(`Collection ${collection} already exists or creation failed`, { error });
        }
      }

      // Create test indexes for performance
      await this.createTestIndexes();

      this.logger.info('Test environment initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize test environment', { error });
      throw error;
    }
  }

  /**
   * Create test indexes for optimal performance
   */
  private async createTestIndexes(): Promise<void> {
    this.logger.info('Creating test indexes');

    try {
      const indexes = [
        // Address indexes
        { 'address.state': 1 },
        { 'address.city': 1 },
        { 'address.zip': 1 },
        
        // Property type and condition
        { 'propertyType': 1 },
        { 'condition': 1 },
        
        // Building characteristics
        { 'building.yearBuilt': 1 },
        { 'building.livingAreaSquareFeet': 1 },
        { 'building.bedroomCount': 1 },
        { 'building.bathroomCount': 1 },
        
        // Valuation
        { 'valuation.estimatedValue': 1 },
        
        // Compound indexes for common searches
        { 'address.state': 1, 'propertyType': 1 },
        { 'propertyType': 1, 'valuation.estimatedValue': 1 },
        { 'address.city': 1, 'building.yearBuilt': 1 },
        
        // Geospatial index
        { 'address.location': '2dsphere' },
        
        // Text search index
        { 'address.street': 'text', 'address.city': 'text' }
      ];

      for (const index of indexes) {
        try {
          await this.databaseService.getCollection('properties').createIndex(index);
          await this.databaseService.getCollection('test_properties').createIndex(index);
        } catch (error) {
          // Index might already exist
          this.logger.debug('Index creation skipped', { index, error });
        }
      }

      this.logger.info('Test indexes created successfully');

    } catch (error) {
      this.logger.error('Failed to create test indexes', { error });
      throw error;
    }
  }

  /**
   * Cleanup test environment
   */
  private async cleanupTestEnvironment(): Promise<void> {
    this.logger.info('Cleaning up test environment');

    try {
      // Remove test data (properties created during testing)
      const testCollections = ['test_properties'];
      
      for (const collection of testCollections) {
        try {
          await this.databaseService.getCollection(collection).deleteMany({
            dataSource: { $in: ['test', 'extracted'] }
          });
        } catch (error) {
          this.logger.debug(`Cleanup failed for collection ${collection}`, { error });
        }
      }

      // Keep the main collections but remove test properties
      await this.databaseService.getCollection('properties').deleteMany({
        $or: [
          { 'address.street': { $regex: /test|Test|TEST/ } },
          { dataSource: { $in: ['test', 'extracted'] } }
        ]
      });

      this.logger.info('Test environment cleaned up successfully');

    } catch (error) {
      this.logger.error('Failed to cleanup test environment', { error });
      // Don't throw here - cleanup failures shouldn't fail the test
    }
  }

  /**
   * Generate final test summary
   */
  private generateFinalSummary(executionTime: number): void {
    const summary = {
      testSuite: 'Two-Level Property Architecture',
      status: 'COMPLETED',
      executionTime: `${executionTime}ms`,
      architecture: {
        name: 'Two-Level Property Data Architecture',
        levels: [
          {
            name: 'PropertySummary',
            purpose: 'Lightweight operations (listings, searches, quick access)',
            estimatedDataSize: '1-2KB per property',
            fields: '~15 essential fields',
            performance: 'Optimized for speed and bandwidth'
          },
          {
            name: 'PropertyDetails',
            purpose: 'Comprehensive operations (analysis, appraisals, detailed reports)',
            estimatedDataSize: '15-30KB per property',
            fields: '50+ comprehensive fields',
            performance: 'Rich data with acceptable performance'
          }
        ]
      },
      recommendations: {
        implementation: [
          'Use PropertySummary endpoints for listings and search results',
          'Use PropertyDetails endpoints for property detail pages and analysis',
          'Implement caching strategies for frequently accessed properties',
          'Consider lazy loading for PropertyDetails sections',
          'Use batch operations with PropertySummary for better performance'
        ],
        api: [
          'Document both summary and detailed endpoints clearly',
          'Provide examples for different use cases',
          'Implement proper error handling for both data levels',
          'Add performance monitoring for both endpoint types'
        ],
        database: [
          'Index frequently queried summary fields',
          'Consider separate collections for performance-critical operations',
          'Implement proper data lifecycle management',
          'Monitor query performance for optimization opportunities'
        ]
      },
      nextSteps: [
        'Deploy to staging environment for integration testing',
        'Implement performance monitoring and alerting',
        'Create API documentation with usage examples',
        'Set up automated testing pipeline',
        'Plan production rollout strategy'
      ]
    };

    console.log('\n=== PROPERTY ARCHITECTURE TEST SUMMARY ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('\n=== TEST COMPLETED SUCCESSFULLY ===\n');
  }
}

/**
 * Main execution function
 */
async function runPropertyArchitectureTests(): Promise<void> {
  const testRunner = new PropertyArchitectureTestRunner();
  
  try {
    await testRunner.runTests();
    process.exit(0);
  } catch (error) {
    console.error('Property Architecture tests failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPropertyArchitectureTests();
}

export { PropertyArchitectureTestRunner, runPropertyArchitectureTests };
export default PropertyArchitectureTestRunner;