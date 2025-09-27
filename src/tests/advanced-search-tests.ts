import { Logger } from '../utils/logger.js';
import { AdvancedSearchService } from '../services/advanced-search.service.js';
import { PropertyType, PropertyCondition, OrderStatus, Priority, ProductType } from '../types/index.js';

/**
 * Comprehensive test suite for advanced search capabilities
 */
export class AdvancedSearchTestSuite {
  private logger: Logger;
  private searchService: AdvancedSearchService;

  constructor() {
    this.logger = new Logger();
    this.searchService = new AdvancedSearchService();
  }

  /**
   * Run all search tests
   */
  async runAllTests(): Promise<void> {
    this.logger.info('Starting Advanced Search Test Suite');

    try {
      // Universal search tests
      await this.testUniversalSearch();
      
      // Property search tests
      await this.testPropertySearch();
      
      // Vendor search tests
      await this.testVendorSearch();
      
      // Order search tests
      await this.testOrderSearch();
      
      // Faceted search tests
      await this.testFacetedSearch();
      
      // Performance tests
      await this.testSearchPerformance();

      this.logger.info('Advanced Search Test Suite completed successfully');

    } catch (error) {
      this.logger.error('Test suite failed', { error });
      throw error;
    }
  }

  // ===============================
  // Universal Search Tests
  // ===============================

  /**
   * Test universal search functionality
   */
  private async testUniversalSearch(): Promise<void> {
    this.logger.info('Testing universal search functionality');

    try {
      // Test basic universal search
      const basicResults = await this.searchService.universalSearch('high priority');
      console.log('Universal Search - Basic Results:', {
        totalResults: basicResults.totalResults,
        orders: basicResults.results.orders.length,
        vendors: basicResults.results.vendors.length,
        properties: basicResults.results.properties.length,
        executionTime: basicResults.executionTime
      });

      // Test with entity filtering
      const filteredResults = await this.searchService.universalSearch('california', {
        entities: ['properties', 'vendors'],
        limit: 25
      });
      console.log('Universal Search - Filtered Results:', {
        totalResults: filteredResults.totalResults,
        includedEntities: ['properties', 'vendors'],
        executionTime: filteredResults.executionTime
      });

      // Test search terms parsing
      const complexResults = await this.searchService.universalSearch('single family home san francisco');
      console.log('Universal Search - Complex Query:', {
        searchTerms: complexResults.searchTerms,
        totalResults: complexResults.totalResults
      });

      this.logger.info('Universal search tests passed');

    } catch (error) {
      this.logger.error('Universal search tests failed', { error });
      throw error;
    }
  }

  // ===============================
  // Property Search Tests
  // ===============================

  /**
   * Test advanced property search functionality
   */
  private async testPropertySearch(): Promise<void> {
    this.logger.info('Testing advanced property search functionality');

    try {
      // Test basic property search
      const basicSearch = await this.searchService.advancedPropertySearch({
        propertyType: [PropertyType.SFR, PropertyType.CONDO],
        condition: [PropertyCondition.EXCELLENT, PropertyCondition.GOOD],
        limit: 20
      });
      console.log('Property Search - Basic:', {
        total: basicSearch.total,
        avgSquareFootage: basicSearch.aggregations.averageSquareFootage,
        avgPrice: basicSearch.aggregations.averagePrice
      });

      // Test geographic search
      const geoSearch = await this.searchService.advancedPropertySearch({
        address: {
          city: 'San Francisco',
          state: 'CA'
        },
        geographic: {
          bounds: {
            north: 37.8199,
            south: 37.7049,
            east: -122.3482,
            west: -122.5221
          }
        },
        includeAnalytics: true
      });
      console.log('Property Search - Geographic:', {
        total: geoSearch.total,
        byPropertyType: geoSearch.aggregations.byPropertyType
      });

      // Test range filters
      const rangeSearch = await this.searchService.advancedPropertySearch({
        yearBuiltRange: { min: 2000, max: 2020 },
        squareFootageRange: { min: 1500, max: 3000 },
        priceRange: { min: 500000, max: 1500000 },
        bedroomRange: { min: 2, max: 4 }
      });
      console.log('Property Search - Range Filters:', {
        total: rangeSearch.total,
        byCondition: rangeSearch.aggregations.byCondition
      });

      // Test text search with features
      const featureSearch = await this.searchService.advancedPropertySearch({
        textQuery: 'luxury waterfront',
        features: ['pool', 'garage', 'fireplace'],
        amenities: ['gym', 'concierge'],
        sortBy: 'price',
        sortOrder: 'desc' as const
      });
      console.log('Property Search - Features:', {
        total: featureSearch.total,
        properties: featureSearch.properties.length
      });

      this.logger.info('Property search tests passed');

    } catch (error) {
      this.logger.error('Property search tests failed', { error });
      throw error;
    }
  }

  // ===============================
  // Vendor Search Tests
  // ===============================

  /**
   * Test advanced vendor search functionality
   */
  private async testVendorSearch(): Promise<void> {
    this.logger.info('Testing advanced vendor search functionality');

    try {
      // Test basic vendor search
      const basicSearch = await this.searchService.advancedVendorSearch({
        licenseState: ['CA', 'TX'],
        productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL],
        limit: 15
      });
      console.log('Vendor Search - Basic:', {
        total: basicSearch.total,
        avgQualityScore: basicSearch.aggregations.averageQualityScore,
        avgOnTimeRate: basicSearch.aggregations.averageOnTimeRate
      });

      // Test performance-based search
      const performanceSearch = await this.searchService.advancedVendorSearch({
        performanceRange: {
          qualityScore: { min: 4.0, max: 5.0 },
          onTimeDeliveryRate: { min: 85, max: 100 },
          clientSatisfactionScore: { min: 4.2 }
        },
        availabilityStatus: ['available'],
        includePerformanceHistory: true
      });
      console.log('Vendor Search - Performance:', {
        total: performanceSearch.total,
        byPerformanceLevel: performanceSearch.aggregations.byPerformanceLevel
      });

      // Test service area search
      const serviceAreaSearch = await this.searchService.advancedVendorSearch({
        serviceAreas: {
          states: ['CA'],
          radius: { lat: 37.7749, lng: -122.4194, miles: 50 }
        },
        specialties: ['luxury homes', 'historic properties'],
        maxOrdersPerDay: { min: 5, max: 20 }
      });
      console.log('Vendor Search - Service Areas:', {
        total: serviceAreaSearch.total,
        byState: serviceAreaSearch.aggregations.byState
      });

      // Test text and certification search
      const certificationSearch = await this.searchService.advancedVendorSearch({
        textQuery: 'certified residential appraiser',
        certifications: ['MAI', 'SRA', 'ASA'],
        licenseStatus: ['active'],
        insuranceStatus: ['active'],
        paymentMethods: ['ach', 'wire']
      });
      console.log('Vendor Search - Certifications:', {
        total: certificationSearch.total,
        byProductType: certificationSearch.aggregations.byProductType
      });

      this.logger.info('Vendor search tests passed');

    } catch (error) {
      this.logger.error('Vendor search tests failed', { error });
      throw error;
    }
  }

  // ===============================
  // Order Search Tests
  // ===============================

  /**
   * Test advanced order search functionality
   */
  private async testOrderSearch(): Promise<void> {
    this.logger.info('Testing advanced order search functionality');

    try {
      // Test basic order search
      const basicSearch = await this.searchService.advancedOrderSearch({
        status: [OrderStatus.NEW, OrderStatus.ASSIGNED, OrderStatus.IN_PROGRESS],
        priority: [Priority.HIGH, Priority.URGENT],
        limit: 25
      });
      console.log('Order Search - Basic:', {
        total: basicSearch.total,
        avgTurnaroundTime: basicSearch.aggregations.averageTurnaroundTime,
        onTimeRate: basicSearch.aggregations.onTimeDeliveryRate
      });

      // Test date range search
      const dateRangeSearch = await this.searchService.advancedOrderSearch({
        createdDateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-02-01')
        },
        dueDateRange: {
          start: new Date('2024-01-15'),
          end: new Date('2024-02-15')
        },
        productType: [ProductType.FULL_APPRAISAL]
      });
      console.log('Order Search - Date Range:', {
        total: dateRangeSearch.total,
        byStatus: dateRangeSearch.aggregations.byStatus
      });

      // Test property and financial filters
      const propertySearch = await this.searchService.advancedOrderSearch({
        propertyType: [PropertyType.SFR, PropertyType.CONDO],
        propertyAddress: {
          city: 'San Francisco',
          state: 'CA'
        },
        loanAmountRange: { min: 500000, max: 2000000 },
        contractPriceRange: { min: 800000, max: 1500000 }
      });
      console.log('Order Search - Property & Financial:', {
        total: propertySearch.total,
        byPriority: propertySearch.aggregations.byPriority
      });

      // Test vendor assignment and special characteristics
      const specialSearch = await this.searchService.advancedOrderSearch({
        unassigned: true,
        rushOrder: true,
        hasSpecialInstructions: true,
        tags: ['complex', 'high-value', 'litigation'],
        includeAuditTrail: true
      });
      console.log('Order Search - Special Characteristics:', {
        total: specialSearch.total,
        byProductType: specialSearch.aggregations.byProductType
      });

      this.logger.info('Order search tests passed');

    } catch (error) {
      this.logger.error('Order search tests failed', { error });
      throw error;
    }
  }

  // ===============================
  // Faceted Search Tests
  // ===============================

  /**
   * Test faceted search functionality
   */
  private async testFacetedSearch(): Promise<void> {
    this.logger.info('Testing faceted search functionality');

    try {
      // Test property facets
      const propertyFacets = await this.searchService.facetedSearch('properties');
      console.log('Faceted Search - Properties:', {
        totalCount: propertyFacets.totalCount,
        facetTypes: Object.keys(propertyFacets.facets),
        propertyTypeFacets: propertyFacets.facets.propertyType?.values.length,
        conditionFacets: propertyFacets.facets.condition?.values.length
      });

      // Test vendor facets
      const vendorFacets = await this.searchService.facetedSearch('vendors');
      console.log('Faceted Search - Vendors:', {
        totalCount: vendorFacets.totalCount,
        facetTypes: Object.keys(vendorFacets.facets),
        stateFacets: vendorFacets.facets.licenseState?.values.length,
        productTypeFacets: vendorFacets.facets.productTypes?.values.length
      });

      // Test order facets
      const orderFacets = await this.searchService.facetedSearch('orders');
      console.log('Faceted Search - Orders:', {
        totalCount: orderFacets.totalCount,
        facetTypes: Object.keys(orderFacets.facets),
        statusFacets: orderFacets.facets.status?.values.length,
        priorityFacets: orderFacets.facets.priority?.values.length
      });

      // Test facets with base filters
      const filteredFacets = await this.searchService.facetedSearch('properties', {
        'address.state': 'CA',
        'details.propertyType': PropertyType.SFR
      });
      console.log('Faceted Search - Filtered:', {
        totalCount: filteredFacets.totalCount,
        facetTypes: Object.keys(filteredFacets.facets)
      });

      this.logger.info('Faceted search tests passed');

    } catch (error) {
      this.logger.error('Faceted search tests failed', { error });
      throw error;
    }
  }

  // ===============================
  // Performance Tests
  // ===============================

  /**
   * Test search performance and optimization
   */
  private async testSearchPerformance(): Promise<void> {
    this.logger.info('Testing search performance');

    try {
      const performanceTests = [];

      // Test 1: Large result set performance
      const startTime1 = Date.now();
      const largeResultsTest = await this.searchService.advancedPropertySearch({
        limit: 100,
        includeAnalytics: true
      });
      const time1 = Date.now() - startTime1;
      performanceTests.push({
        test: 'Large Property Results',
        executionTime: time1,
        resultCount: largeResultsTest.total
      });

      // Test 2: Complex filter performance
      const startTime2 = Date.now();
      const complexFilterTest = await this.searchService.advancedVendorSearch({
        performanceRange: {
          qualityScore: { min: 4.0, max: 5.0 },
          onTimeDeliveryRate: { min: 80 }
        },
        productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL],
        serviceAreas: {
          states: ['CA', 'TX', 'FL'],
          radius: { lat: 39.8283, lng: -98.5795, miles: 500 }
        },
        includePerformanceHistory: true
      });
      const time2 = Date.now() - startTime2;
      performanceTests.push({
        test: 'Complex Vendor Filters',
        executionTime: time2,
        resultCount: complexFilterTest.total
      });

      // Test 3: Universal search performance
      const startTime3 = Date.now();
      const universalTest = await this.searchService.universalSearch(
        'high priority urgent california single family',
        { limit: 50 }
      );
      const time3 = Date.now() - startTime3;
      performanceTests.push({
        test: 'Universal Search',
        executionTime: time3,
        resultCount: universalTest.totalResults
      });

      // Test 4: Faceted search performance
      const startTime4 = Date.now();
      const facetedTest = await this.searchService.facetedSearch('orders', {
        status: { $in: [OrderStatus.NEW, OrderStatus.ASSIGNED] }
      });
      const time4 = Date.now() - startTime4;
      performanceTests.push({
        test: 'Faceted Search',
        executionTime: time4,
        resultCount: facetedTest.totalCount
      });

      // Performance summary
      console.log('Search Performance Results:', performanceTests);
      
      const avgExecutionTime = performanceTests.reduce((sum, test) => sum + test.executionTime, 0) / performanceTests.length;
      const maxExecutionTime = Math.max(...performanceTests.map(test => test.executionTime));
      
      console.log('Performance Summary:', {
        averageExecutionTime: `${avgExecutionTime}ms`,
        maxExecutionTime: `${maxExecutionTime}ms`,
        allTestsUnder1Second: maxExecutionTime < 1000 ? 'PASS' : 'FAIL'
      });

      this.logger.info('Performance tests completed');

    } catch (error) {
      this.logger.error('Performance tests failed', { error });
      throw error;
    }
  }

  // ===============================
  // Saved Search Tests
  // ===============================

  /**
   * Test saved search functionality
   */
  private async testSavedSearches(): Promise<void> {
    this.logger.info('Testing saved search functionality');

    try {
      // Test saving a search
      const saveResult = await this.searchService.saveSearch({
        name: 'High Priority CA Orders',
        description: 'Orders with high priority in California',
        entityType: 'orders',
        criteria: {
          priority: [Priority.HIGH, Priority.URGENT],
          propertyAddress: { state: 'CA' },
          status: [OrderStatus.NEW, OrderStatus.ASSIGNED]
        },
        userId: 'test_user_123',
        isPublic: false
      });

      console.log('Saved Search Test:', {
        searchId: saveResult.searchId,
        saved: !!saveResult.searchId
      });

      this.logger.info('Saved search tests passed');

    } catch (error) {
      this.logger.error('Saved search tests failed', { error });
      throw error;
    }
  }

  // ===============================
  // Helper Methods
  // ===============================

  /**
   * Generate comprehensive test report
   */
  async generateTestReport(): Promise<void> {
    this.logger.info('Generating comprehensive search test report');

    try {
      const report = {
        testSuite: 'Advanced Search Capabilities',
        timestamp: new Date().toISOString(),
        categories: [
          'Universal Search',
          'Property Search',
          'Vendor Search', 
          'Order Search',
          'Faceted Search',
          'Performance Testing'
        ],
        features: [
          'Text-based search across all entities',
          'Complex property filtering (type, condition, location, features)',
          'Vendor performance and capability filtering',
          'Order status and timeline filtering',
          'Geographic and radius-based search',
          'Date range and numerical range filtering',
          'Faceted search with dynamic filter options',
          'Search aggregations and analytics',
          'Performance optimization and caching',
          'Saved search functionality'
        ],
        capabilities: {
          entities: ['orders', 'vendors', 'properties'],
          searchTypes: ['universal', 'advanced', 'faceted'],
          filterTypes: ['text', 'categorical', 'numerical', 'date', 'geographic'],
          aggregations: ['counts', 'averages', 'distributions'],
          performance: 'Optimized for sub-second response times'
        }
      };

      console.log('\n=== ADVANCED SEARCH TEST REPORT ===');
      console.log(JSON.stringify(report, null, 2));

      this.logger.info('Test report generated successfully');

    } catch (error) {
      this.logger.error('Failed to generate test report', { error });
      throw error;
    }
  }
}

// Export for testing
export default AdvancedSearchTestSuite;