/**
 * Property Intelligence API Demo Script
 * 
 * Demonstrates comprehensive usage of the Enhanced Property Intelligence API
 * Shows practical examples of all major endpoints and features
 */

import axios from 'axios';
import { Coordinates } from '../src/types/geospatial';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY; // Optional

// Axios instance with default config
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/property-intelligence`,
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'X-API-Key': API_KEY })
  },
  timeout: 30000
});

// Demo properties for testing
const DEMO_PROPERTIES = {
  googleHQ: {
    name: 'Google Headquarters',
    address: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
    coordinates: { latitude: 37.4224764, longitude: -122.0842499 }
  },
  timesSquare: {
    name: 'Times Square, NYC',
    address: 'Times Square, New York, NY 10036',
    coordinates: { latitude: 40.7580, longitude: -73.9855 }
  },
  goldenGateBridge: {
    name: 'Golden Gate Bridge',
    address: 'Golden Gate Bridge, San Francisco, CA',
    coordinates: { latitude: 37.8199, longitude: -122.4783 }
  },
  downtownSeattle: {
    name: 'Downtown Seattle',
    address: '1st Avenue & Pike Street, Seattle, WA 98101',
    coordinates: { latitude: 47.6097, longitude: -122.3331 }
  }
};

/**
 * Helper function to log results with nice formatting
 */
function logResult(title: string, data: any): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);
  console.log(JSON.stringify(data, null, 2));
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Demo 1: Address Services
 */
async function demoAddressServices(): Promise<void> {
  console.log('🏠 DEMO: Address Services');
  
  try {
    // Geocode an address
    console.log('\n📍 Geocoding Google HQ address...');
    const geocodeResponse = await api.post('/address/geocode', {
      address: DEMO_PROPERTIES.googleHQ.address
    });
    
    logResult('Geocoding Result', {
      address: DEMO_PROPERTIES.googleHQ.address,
      results: geocodeResponse.data.data,
      processingTime: geocodeResponse.data.metadata.processingTime + 'ms',
      providers: geocodeResponse.data.metadata.dataSourcesUsed
    });

    // Validate an address
    console.log('\n✅ Validating address...');
    const validateResponse = await api.post('/address/validate', {
      address: DEMO_PROPERTIES.googleHQ.address
    });
    
    logResult('Address Validation Result', {
      originalAddress: DEMO_PROPERTIES.googleHQ.address,
      isValid: validateResponse.data.data.isValid,
      standardizedAddress: validateResponse.data.data.standardizedAddress,
      confidence: validateResponse.data.data.confidence
    });

    // Address suggestions
    console.log('\n💡 Getting address suggestions...');
    const suggestResponse = await api.get('/address/suggest?q=1600 Amphitheatre&limit=3');
    
    logResult('Address Suggestions', {
      query: '1600 Amphitheatre',
      suggestions: suggestResponse.data.data
    });

  } catch (error: any) {
    console.error('❌ Address Services Demo Failed:', error.response?.data || error.message);
  }
}

/**
 * Demo 2: Comprehensive Property Analysis
 */
async function demoComprehensiveAnalysis(): Promise<void> {
  console.log('🏢 DEMO: Comprehensive Property Analysis');
  
  try {
    const { coordinates } = DEMO_PROPERTIES.timesSquare;
    
    console.log(`\n🔍 Analyzing ${DEMO_PROPERTIES.timesSquare.name}...`);
    const response = await api.post('/analyze/comprehensive', {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      propertyId: 'demo-times-square',
      strategy: 'quality_first'
    });

    const analysis = response.data.data;
    
    logResult('Comprehensive Analysis Summary', {
      property: DEMO_PROPERTIES.timesSquare.name,
      coordinates: coordinates,
      processingTime: response.data.metadata.processingTime + 'ms',
      dataProviders: response.data.metadata.dataSourcesUsed,
      
      // Key highlights from the analysis
      highlights: {
        overallScore: analysis.overallIntelligenceScore || 'N/A',
        viewScore: analysis.viewAnalysis?.overallViewScore || 'N/A',
        coffeeScore: analysis.creativeFeatures?.lifestyle?.coffeeAccessibilityScore || 'N/A',
        instagrammabilityScore: analysis.creativeFeatures?.uniqueCharacteristics?.instagrammabilityScore || 'N/A',
        walkabilityScore: analysis.locationCharacteristics?.walkabilityScore || 'N/A',
        safetyScore: analysis.locationCharacteristics?.safetyScore || 'N/A'
      },
      
      nearbyPointsOfInterest: analysis.nearbyPointsOfInterest?.slice(0, 5) || [],
      demographics: analysis.demographics || {},
      marketData: analysis.marketData || {}
    });

  } catch (error: any) {
    console.error('❌ Comprehensive Analysis Demo Failed:', error.response?.data || error.message);
  }
}

/**
 * Demo 3: Creative Features Analysis
 */
async function demoCreativeFeatures(): Promise<void> {
  console.log('🎨 DEMO: Creative Features Analysis');
  
  try {
    const { coordinates } = DEMO_PROPERTIES.downtownSeattle;
    
    console.log(`\n☕ Analyzing creative features for ${DEMO_PROPERTIES.downtownSeattle.name}...`);
    const response = await api.post('/analyze/creative-features', {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      propertyId: 'demo-seattle-downtown'
    });

    const features = response.data.data;
    
    logResult('Creative Features Analysis', {
      property: DEMO_PROPERTIES.downtownSeattle.name,
      
      lifestyleScores: {
        coffeeAccessibility: features.lifestyle?.coffeeAccessibilityScore,
        diningDiversity: features.lifestyle?.diningDiversityIndex,
        shoppingConvenience: features.lifestyle?.shoppingConvenienceScore,
        entertainmentAccess: features.lifestyle?.entertainmentAccessScore
      },
      
      uniqueCharacteristics: {
        instagrammability: features.uniqueCharacteristics?.instagrammabilityScore,
        historicSignificance: features.uniqueCharacteristics?.historicSignificanceScore,
        architecturalInterest: features.uniqueCharacteristics?.architecturalInterestScore,
        landmarkProximity: features.uniqueCharacteristics?.landmarkProximityScore
      },
      
      professionalEnvironment: {
        coworkingSpaces: features.professionalEnvironment?.coworkingSpacesNearby,
        businessDistricts: features.professionalEnvironment?.businessDistrictsNearby,
        networkingOpportunities: features.professionalEnvironment?.networkingOpportunitiesScore
      }
    });

  } catch (error: any) {
    console.error('❌ Creative Features Demo Failed:', error.response?.data || error.message);
  }
}

/**
 * Demo 4: View Analysis
 */
async function demoViewAnalysis(): Promise<void> {
  console.log('🌉 DEMO: View Analysis');
  
  try {
    const { coordinates } = DEMO_PROPERTIES.goldenGateBridge;
    
    console.log(`\n🏔️ Analyzing views for ${DEMO_PROPERTIES.goldenGateBridge.name}...`);
    const response = await api.post('/analyze/views', {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude
    });

    const viewAnalysis = response.data.data;
    
    logResult('View Analysis Results', {
      property: DEMO_PROPERTIES.goldenGateBridge.name,
      elevation: viewAnalysis.elevation,
      overallViewScore: viewAnalysis.overallViewScore,
      
      viewTypes: {
        waterViews: {
          hasWaterView: viewAnalysis.waterViews?.hasWaterView,
          waterTypes: viewAnalysis.waterViews?.waterTypes,
          viewQuality: viewAnalysis.waterViews?.viewQuality
        },
        cityViews: {
          hasCityView: viewAnalysis.cityViews?.hasCityView,
          skylineVisibility: viewAnalysis.cityViews?.skylineVisibility,
          nightViewPotential: viewAnalysis.cityViews?.nightViewPotential
        },
        mountainViews: {
          hasMountainView: viewAnalysis.mountainViews?.hasMountainView,
          peaksVisible: viewAnalysis.mountainViews?.peaksVisible,
          viewObstruction: viewAnalysis.mountainViews?.viewObstruction
        },
        natureViews: {
          hasNatureView: viewAnalysis.natureViews?.hasNatureView,
          greenSpaceVisibility: viewAnalysis.natureViews?.greenSpaceVisibility,
          seasonalVariation: viewAnalysis.natureViews?.seasonalVariation
        }
      }
    });

  } catch (error: any) {
    console.error('❌ View Analysis Demo Failed:', error.response?.data || error.message);
  }
}

/**
 * Demo 5: Batch Analysis
 */
async function demoBatchAnalysis(): Promise<void> {
  console.log('📊 DEMO: Batch Property Analysis');
  
  try {
    console.log('\n🏘️ Analyzing multiple properties in batch...');
    
    const properties = Object.entries(DEMO_PROPERTIES).map(([key, property]) => ({
      latitude: property.coordinates.latitude,
      longitude: property.coordinates.longitude,
      propertyId: `demo-${key}`
    }));

    const response = await api.post('/analyze/batch', {
      properties: properties.slice(0, 3), // Analyze first 3 properties
      strategy: 'cost_optimized'
    });

    const batchResults = response.data;
    
    logResult('Batch Analysis Results', {
      summary: batchResults.summary,
      results: batchResults.results.map((result: any) => ({
        propertyId: result.propertyId,
        success: result.success,
        overallScore: result.data?.overallIntelligenceScore || 'N/A',
        coffeeScore: result.data?.creativeFeatures?.lifestyle?.coffeeAccessibilityScore || 'N/A',
        error: result.error || null
      }))
    });

  } catch (error: any) {
    console.error('❌ Batch Analysis Demo Failed:', error.response?.data || error.message);
  }
}

/**
 * Demo 6: Provider Status and Health Checks
 */
async function demoProviderStatus(): Promise<void> {
  console.log('🔧 DEMO: Provider Status and Health Checks');
  
  try {
    // Check provider status
    console.log('\n📡 Checking data provider status...');
    const providerResponse = await api.get('/providers/status');
    
    logResult('Data Provider Status', providerResponse.data.data);

    // Health check
    console.log('\n❤️ Performing health check...');
    const healthResponse = await api.get('/health');
    
    logResult('Health Check Results', healthResponse.data.data);

  } catch (error: any) {
    console.error('❌ Provider Status Demo Failed:', error.response?.data || error.message);
  }
}

/**
 * Main demo runner
 */
async function runAllDemos(): Promise<void> {
  console.log('🚀 Starting Property Intelligence API Demo');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`🔐 API Key: ${API_KEY ? 'Configured' : 'Not configured (using anonymous access)'}`);
  
  const demos = [
    { name: 'Address Services', func: demoAddressServices },
    { name: 'Comprehensive Analysis', func: demoComprehensiveAnalysis },
    { name: 'Creative Features', func: demoCreativeFeatures },
    { name: 'View Analysis', func: demoViewAnalysis },
    { name: 'Batch Analysis', func: demoBatchAnalysis },
    { name: 'Provider Status', func: demoProviderStatus }
  ];

  for (const demo of demos) {
    try {
      console.log(`\n\n🎯 Running ${demo.name} Demo...`);
      await demo.func();
      console.log(`✅ ${demo.name} Demo completed successfully`);
      
      // Small delay between demos to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ ${demo.name} Demo failed:`, error);
    }
  }
  
  console.log('\n\n🏁 All demos completed!');
  console.log('📖 Check the API documentation for more details and integration examples.');
}

// Run the demo if this script is executed directly
if (require.main === module) {
  runAllDemos().catch(console.error);
}

export {
  runAllDemos,
  demoAddressServices,
  demoComprehensiveAnalysis,
  demoCreativeFeatures,
  demoViewAnalysis,
  demoBatchAnalysis,
  demoProviderStatus
};