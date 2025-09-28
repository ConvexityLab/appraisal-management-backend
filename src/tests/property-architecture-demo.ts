import { Logger } from '../utils/logger.js';
import { EnhancedPropertyService } from '../services/enhanced-property.service.js';
import { 
  PropertyType, 
  PropertyCondition, 
  CreatePropertySummaryRequest 
} from '../types/property-enhanced.js';

/**
 * Simple Property Architecture Demo
 * Demonstrates the two-level property architecture without complex test framework
 */
export class PropertyArchitectureDemo {
  private logger: Logger;
  private propertyService: EnhancedPropertyService;

  constructor() {
    this.logger = new Logger();
    this.propertyService = new EnhancedPropertyService();
  }

  /**
   * Run property architecture demonstration
   */
  async runDemo(): Promise<void> {
    console.log('\n=== Two-Level Property Architecture Demo ===\n');

    try {
      await this.demonstrateSummaryOperations();
      await this.demonstrateDetailsOperations();
      await this.demonstratePerformanceComparison();
      await this.demonstrateUseCases();

      console.log('\n=== Demo Completed Successfully ===\n');

    } catch (error) {
      console.error('Demo failed:', error);
      throw error;
    }
  }

  /**
   * Demonstrate PropertySummary operations
   */
  private async demonstrateSummaryOperations(): Promise<void> {
    console.log('1. PropertySummary Operations (Lightweight)');
    console.log('   - Optimized for listings, searches, and quick operations');
    console.log('   - Contains ~15 essential fields (~1-2KB per property)\n');

    try {
      // Create a property summary
      const summaryData: CreatePropertySummaryRequest = {
        address: {
          street: '123 Demo Street',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          county: 'San Francisco'
        },
        propertyType: PropertyType.SFR,
        condition: PropertyCondition.GOOD,
        building: {
          yearBuilt: 2000,
          livingAreaSquareFeet: 2500,
          bedroomCount: 3,
          bathroomCount: 2
        },
        valuation: {
          estimatedValue: 1200000
        }
      };

      console.log('   Creating PropertySummary...');
      const property = await this.propertyService.createPropertySummary(summaryData);
      
      const dataSize = JSON.stringify(property).length;
      console.log(`   ✓ Created property: ${property.id}`);
      console.log(`   ✓ Data size: ${dataSize} bytes`);
      console.log(`   ✓ Essential fields: address, type, valuation, building basics`);

      // Search properties summary
      console.log('\n   Searching PropertySummaries...');
      const searchResults = await this.propertyService.searchPropertiesSummary({
        address: { state: 'CA' },
        limit: 10
      });

      const avgDataSize = searchResults.properties.length > 0 
        ? searchResults.properties.reduce((sum, p) => sum + JSON.stringify(p).length, 0) / searchResults.properties.length
        : 0;

      console.log(`   ✓ Found ${searchResults.total} properties`);
      console.log(`   ✓ Returned ${searchResults.properties.length} properties`);
      console.log(`   ✓ Average data size: ${Math.round(avgDataSize)} bytes`);
      console.log('   ✓ Perfect for listings and search results\n');

    } catch (error) {
      console.log(`   ✗ Summary operations failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
  }

  /**
   * Demonstrate PropertyDetails operations
   */
  private async demonstrateDetailsOperations(): Promise<void> {
    console.log('2. PropertyDetails Operations (Comprehensive)');
    console.log('   - Optimized for analysis, appraisals, and detailed reports');
    console.log('   - Contains 50+ comprehensive fields (~15-30KB per property)\n');

    try {
      // Create a property first
      const summaryData: CreatePropertySummaryRequest = {
        address: {
          street: '456 Detail Avenue',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90210'
        },
        propertyType: PropertyType.CONDO,
        condition: PropertyCondition.EXCELLENT
      };

      console.log('   Creating property for detailed analysis...');
      const property = await this.propertyService.createPropertySummary(summaryData);

      // Get property details
      console.log('   Retrieving PropertyDetails...');
      const propertyDetails = await this.propertyService.getPropertyDetails(property.id);
      
      if (propertyDetails) {
        const dataSize = JSON.stringify(propertyDetails).length;
        const sectionCount = this.countDetailSections(propertyDetails);
        
        console.log(`   ✓ Retrieved detailed property: ${propertyDetails.id}`);
        console.log(`   ✓ Data size: ${dataSize} bytes`);
        console.log(`   ✓ Detail sections: ${sectionCount}`);
        console.log('   ✓ Includes: assessment, deed history, demographics, tax records');
      }

      // Enrich with external data
      console.log('\n   Enriching with external data...');
      const enrichedProperty = await this.propertyService.enrichPropertyWithExternalData(property.id);
      
      const enrichedDataSize = JSON.stringify(enrichedProperty).length;
      console.log(`   ✓ Enriched property: ${enrichedProperty.id}`);
      console.log(`   ✓ Enriched data size: ${enrichedDataSize} bytes`);
      console.log('   ✓ Perfect for appraisals and comprehensive analysis\n');

    } catch (error) {
      console.log(`   ✗ Details operations failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
  }

  /**
   * Demonstrate performance comparison
   */
  private async demonstratePerformanceComparison(): Promise<void> {
    console.log('3. Performance Comparison');
    console.log('   - Comparing summary vs detailed operations\n');

    try {
      const searchCriteria = {
        address: { state: 'CA' },
        propertyType: [PropertyType.SFR, PropertyType.CONDO],
        limit: 10
      };

      // Summary search
      console.log('   Testing Summary Search Performance...');
      const summaryStart = Date.now();
      const summaryResults = await this.propertyService.searchPropertiesSummary(searchCriteria);
      const summaryTime = Date.now() - summaryStart;
      const summaryDataSize = summaryResults.properties.reduce((sum, p) => sum + JSON.stringify(p).length, 0);

      console.log(`   ✓ Summary search: ${summaryTime}ms`);
      console.log(`   ✓ Results: ${summaryResults.properties.length} properties`);
      console.log(`   ✓ Total data: ${summaryDataSize} bytes`);

      // Detailed search
      console.log('\n   Testing Detailed Search Performance...');
      const detailedStart = Date.now();
      const detailedResults = await this.propertyService.searchPropertiesDetailed({
        ...searchCriteria,
        limit: 5 // Smaller limit for detailed search
      });
      const detailedTime = Date.now() - detailedStart;
      const detailedDataSize = detailedResults.properties.reduce((sum, p) => sum + JSON.stringify(p).length, 0);

      console.log(`   ✓ Detailed search: ${detailedTime}ms`);
      console.log(`   ✓ Results: ${detailedResults.properties.length} properties`);
      console.log(`   ✓ Total data: ${detailedDataSize} bytes`);

      // Comparison
      const timeRatio = detailedTime / summaryTime;
      const dataSizeRatio = (detailedDataSize / detailedResults.properties.length) / 
                           (summaryDataSize / summaryResults.properties.length);

      console.log('\n   Performance Analysis:');
      console.log(`   ✓ Detailed operations are ${timeRatio.toFixed(2)}x slower`);
      console.log(`   ✓ Detailed data is ${dataSizeRatio.toFixed(2)}x larger per property`);
      console.log('   ✓ Summary operations are significantly more efficient for listings\n');

    } catch (error) {
      console.log(`   ✗ Performance comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
  }

  /**
   * Demonstrate use cases
   */
  private async demonstrateUseCases(): Promise<void> {
    console.log('4. Use Case Recommendations');
    console.log('   - When to use each data level\n');

    const useCases = {
      propertySummary: [
        'Property listing pages',
        'Search result displays',
        'Map view markers',
        'Quick property comparisons',
        'Batch operations',
        'Mobile app displays',
        'Email notifications',
        'Dashboard overviews'
      ],
      propertyDetails: [
        'Property detail pages',
        'Appraisal forms',
        'Market analysis reports',
        'Comparative market analysis (CMA)',
        'Investment analysis',
        'Due diligence reports',
        'Tax assessment reviews',
        'Detailed property reports'
      ]
    };

    console.log('   PropertySummary (Lightweight) - Use for:');
    useCases.propertySummary.forEach(useCase => {
      console.log(`   ✓ ${useCase}`);
    });

    console.log('\n   PropertyDetails (Comprehensive) - Use for:');
    useCases.propertyDetails.forEach(useCase => {
      console.log(`   ✓ ${useCase}`);
    });

    console.log('\n   Architecture Benefits:');
    console.log('   ✓ Improved API response times for common operations');
    console.log('   ✓ Reduced bandwidth usage');
    console.log('   ✓ Better mobile performance');
    console.log('   ✓ Scalable data architecture');
    console.log('   ✓ Selective data enrichment');
    console.log('   ✓ Cost-effective data management\n');
  }

  /**
   * Count detail sections in PropertyDetails
   */
  private countDetailSections(details: any): number {
    if (!details) return 0;

    const sections = [
      'assessment', 'deedHistory', 'demographics', 'foreclosure',
      'general', 'ids', 'legal', 'lot', 'listing', 'mortgageHistory',
      'openLien', 'permit', 'propertyOwnerProfile', 'sale', 'tax', 'meta'
    ];

    return sections.filter(section => 
      details[section] && Object.keys(details[section]).length > 0
    ).length;
  }
}

// Simple execution function
export async function runPropertyDemo(): Promise<void> {
  const demo = new PropertyArchitectureDemo();
  await demo.runDemo();
}

export default PropertyArchitectureDemo;