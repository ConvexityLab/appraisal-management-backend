/**
 * Census Intelligence Service Test
 * 
 * Test file to validate Census integration with real coordinates
 * Tests demographic, economic, and housing analysis capabilities
 */

import { CensusIntelligenceService } from '../services/census-intelligence.service';
import { MultiProviderPropertyIntelligenceService } from '../services/multi-provider-intelligence.service';
import { Coordinates } from '../types/geospatial';

// Test coordinates (Manhattan, NYC)
const testCoordinates: Coordinates = {
  latitude: 40.7589,
  longitude: -73.9851
};

// Test coordinates (Austin, TX)
const testCoordinatesAustin: Coordinates = {
  latitude: 30.2672,
  longitude: -97.7431
};

async function testCensusIntelligence() {
  console.log('🏛️ Testing Census Intelligence Service\n');

  try {
    const censusService = new CensusIntelligenceService();
    const multiService = new MultiProviderPropertyIntelligenceService();

    console.log('📍 Testing with Manhattan coordinates:', testCoordinates);
    console.log('----------------------------------------\n');

    // Test demographic analysis
    console.log('👥 Testing Demographic Analysis...');
    const demographics = await multiService.getDemographicIntelligence(testCoordinates, 'test-manhattan');
    console.log(`✅ Demographic Score: ${demographics.demographicCompatibilityScore}/100`);
    console.log(`   Population: ${demographics.populationCharacteristics.totalPopulation.toLocaleString()}`);
    console.log(`   Diversity Index: ${demographics.diversityMetrics.racialDiversityIndex}/100`);
    console.log(`   Young Professionals (18-34): ${demographics.populationCharacteristics.ageDistribution.age18to34.toFixed(1)}%\n`);

    // Test economic analysis
    console.log('💰 Testing Economic Analysis...');
    const economics = await multiService.getEconomicIntelligence(testCoordinates, 'test-manhattan');
    console.log(`✅ Economic Vitality Score: ${economics.economicVitalityScore}/100`);
    console.log(`   Median Income: $${economics.incomeMetrics.medianHouseholdIncome.toLocaleString()}`);
    console.log(`   Unemployment Rate: ${economics.employmentCharacteristics.unemploymentRate.toFixed(1)}%`);
    console.log(`   Work From Home: ${economics.employmentCharacteristics.workFromHomeRate.toFixed(1)}%\n`);

    // Test housing analysis
    console.log('🏠 Testing Housing Analysis...');
    const housing = await multiService.getHousingIntelligence(testCoordinates, 'test-manhattan');
    console.log(`✅ Housing Market Score: ${housing.housingMarketScore}/100`);
    console.log(`   Median Home Value: $${housing.housingAffordability.medianHomeValue.toLocaleString()}`);
    console.log(`   Owner Occupied: ${housing.housingStock.ownerOccupiedRate.toFixed(1)}%`);
    console.log(`   Vacancy Rate: ${housing.housingStock.vacancyRate.toFixed(1)}%\n`);

    // Test comprehensive analysis
    console.log('🔍 Testing Comprehensive Analysis...');
    const comprehensive = await multiService.getComprehensiveCensusIntelligence(testCoordinates, 'test-manhattan');
    console.log(`✅ Overall Community Score: ${comprehensive.overallCommunityScore}/100`);
    console.log('📊 Score Breakdown:');
    console.log(`   Demographics: ${comprehensive.demographics.demographicCompatibilityScore}/100`);
    console.log(`   Economics: ${comprehensive.economics.economicVitalityScore}/100`);
    console.log(`   Housing: ${comprehensive.housing.housingMarketScore}/100\n`);

    console.log('🎯 Key Insights for Manhattan:');
    const insights = generateTestInsights(comprehensive);
    insights.forEach(insight => console.log(`   • ${insight}`));
    console.log();

    // Test with different location (Austin, TX)
    console.log('📍 Testing with Austin coordinates:', testCoordinatesAustin);
    console.log('----------------------------------------\n');

    const austinAnalysis = await multiService.getComprehensiveCensusIntelligence(testCoordinatesAustin, 'test-austin');
    console.log(`✅ Austin Overall Community Score: ${austinAnalysis.overallCommunityScore}/100`);
    console.log('📊 Austin Score Breakdown:');
    console.log(`   Demographics: ${austinAnalysis.demographics.demographicCompatibilityScore}/100`);
    console.log(`   Economics: ${austinAnalysis.economics.economicVitalityScore}/100`);
    console.log(`   Housing: ${austinAnalysis.housing.housingMarketScore}/100\n`);

    // Compare markets
    console.log('⚖️ Market Comparison:');
    console.log(`Manhattan vs Austin Community Scores: ${comprehensive.overallCommunityScore} vs ${austinAnalysis.overallCommunityScore}`);
    if (comprehensive.overallCommunityScore > austinAnalysis.overallCommunityScore) {
      console.log('🏆 Manhattan shows stronger overall community metrics');
    } else {
      console.log('🏆 Austin shows stronger overall community metrics');
    }

    console.log('\n✅ All Census Intelligence tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Census Intelligence test failed:', error);
    
    // Test health status even if main tests fail
    try {
      const censusService = new CensusIntelligenceService();
      const health = await censusService.getHealthStatus();
      console.log('\n🏥 Service Health Status:', health);
    } catch (healthError) {
      console.error('❌ Health status check failed:', healthError);
    }
  }
}

function generateTestInsights(analysis: any): string[] {
  const insights: string[] = [];

  // Population insights
  if (analysis.demographics.populationCharacteristics.totalPopulation > 2000) {
    insights.push(`Dense urban area with ${analysis.demographics.populationCharacteristics.totalPopulation.toLocaleString()} residents`);
  }

  // Economic insights
  if (analysis.economics.incomeMetrics.medianHouseholdIncome > 75000) {
    insights.push('High-income area indicating strong economic fundamentals');
  }

  // Diversity insights
  if (analysis.demographics.diversityMetrics.racialDiversityIndex > 70) {
    insights.push('Highly diverse community with multicultural environment');
  }

  // Housing insights
  if (analysis.housing.housingAffordability.medianHomeValue > 500000) {
    insights.push('Premium housing market with high property values');
  }

  // Overall assessment
  if (analysis.overallCommunityScore > 75) {
    insights.push('Excellent location for long-term property investment');
  } else if (analysis.overallCommunityScore > 60) {
    insights.push('Solid community fundamentals with good investment potential');
  }

  return insights;
}

// Additional test functions for specific scenarios
async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling...');
  
  const multiService = new MultiProviderPropertyIntelligenceService();
  
  try {
    // Test with invalid coordinates (middle of ocean)
    const invalidCoordinates: Coordinates = { latitude: 0, longitude: 0 };
    await multiService.getDemographicIntelligence(invalidCoordinates);
    console.log('❌ Should have thrown error for invalid coordinates');
  } catch (error) {
    console.log('✅ Properly handled invalid coordinates error');
  }

  try {
    // Test with coordinates outside US
    const internationalCoordinates: Coordinates = { latitude: 51.5074, longitude: -0.1278 }; // London
    await multiService.getDemographicIntelligence(internationalCoordinates);
    console.log('❌ Should have thrown error for non-US coordinates');
  } catch (error) {
    console.log('✅ Properly handled non-US coordinates error');
  }
}

async function testCachePerformance() {
  console.log('\n⚡ Testing Cache Performance...');
  
  const multiService = new MultiProviderPropertyIntelligenceService();
  
  // First request (cache miss)
  const start1 = Date.now();
  await multiService.getDemographicIntelligence(testCoordinates, 'cache-test-1');
  const time1 = Date.now() - start1;
  
  // Second request (cache hit)
  const start2 = Date.now();
  await multiService.getDemographicIntelligence(testCoordinates, 'cache-test-2');
  const time2 = Date.now() - start2;
  
  console.log(`First request (cache miss): ${time1}ms`);
  console.log(`Second request (cache hit): ${time2}ms`);
  console.log(`Cache performance improvement: ${((time1 - time2) / time1 * 100).toFixed(1)}%`);
  
  if (time2 < time1 * 0.1) { // Cache should be at least 90% faster
    console.log('✅ Cache performance is excellent');
  } else {
    console.log('⚠️ Cache performance could be improved');
  }
}

// Run all tests
async function runAllTests() {
  await testCensusIntelligence();
  await testErrorHandling();
  await testCachePerformance();
  
  console.log('\n🎉 All Census Intelligence Service tests completed!');
}

// Export for potential use in other test files
export {
  testCensusIntelligence,
  testErrorHandling,
  testCachePerformance,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}