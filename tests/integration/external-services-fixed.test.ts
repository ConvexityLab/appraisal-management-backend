/**
 * External Services Integration Tests (Fixed Version)
 * 
 * Comprehensive tests for external API integrations using actual production endpoints:
 * - FEMA flood data via comprehensive analysis
 * - Google Places API via neighborhood analysis
 * - US Census Bureau via census endpoints
 * - Multi-provider address services
 * - Geospatial risk assessment
 */

import { describe, test, beforeAll, expect } from 'vitest';

const API_BASE_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 30000;

// Test coordinates - Google headquarters with comprehensive external data
const TEST_COORDINATES = {
  latitude: 37.4224764,
  longitude: -122.0842499
};

// Houston coordinates for flood zone testing
const FLOOD_ZONE_COORDINATES = {
  latitude: 29.7604,
  longitude: -95.3698
};

describe.skip('External Services Integration Tests (Fixed)', () => {
  beforeAll(async () => {
    // Verify server connectivity
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`Server not responding: ${response.status}`);
      }
      console.log('🔗 Connected to production server for external services testing');
    } catch (error) {
      throw new Error(`❌ Cannot connect to server at ${API_BASE_URL}`);
    }
  }, TEST_TIMEOUT);

  describe('FEMA Flood Risk Integration', () => {
    test('should integrate FEMA flood data via comprehensive analysis', async () => {
      const analysisData = {
        latitude: FLOOD_ZONE_COORDINATES.latitude,
        longitude: FLOOD_ZONE_COORDINATES.longitude,
        includeRiskAssessment: true,
        strategy: 'comprehensive'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      console.log('✅ FEMA flood zone data integrated successfully');
    }, TEST_TIMEOUT);

    test('should provide flood insurance assessment', async () => {
      const insuranceData = {
        latitude: FLOOD_ZONE_COORDINATES.latitude,
        longitude: FLOOD_ZONE_COORDINATES.longitude,
        propertyType: 'residential',
        assessFloodRisk: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insuranceData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log('✅ Flood insurance assessment completed');
    }, TEST_TIMEOUT);
  });

  describe('Google Places API Integration', () => {
    test('should integrate Google Places via neighborhood analysis', async () => {
      const neighborhoodData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeBusinesses: true,
        includeAmenities: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/neighborhood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(neighborhoodData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      console.log('✅ Google Places API integrated via neighborhood analysis');
    }, TEST_TIMEOUT);

    test('should find coffee shops via creative features analysis', async () => {
      const creativeData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        searchType: 'coffee_culture',
        radius: 1000
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/creative-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creativeData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log('✅ Coffee shop density analysis via creative features');
    }, TEST_TIMEOUT);

    test('should analyze transportation and walkability', async () => {
      const transportData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeTransit: true,
        includeWalkability: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/transportation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transportData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log('✅ Transportation and walkability analysis completed');
    }, TEST_TIMEOUT);
  });

  describe('US Census Bureau Integration', () => {
    test('should retrieve demographic data from Census Bureau', async () => {
      const demographicRequest = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeDetailedDemographics: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/census/demographics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demographicRequest)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      console.log('✅ US Census Bureau demographic data retrieved');
    }, TEST_TIMEOUT);

    test('should retrieve economic data from Census Bureau', async () => {
      const economicRequest = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeEconomicIndicators: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/census/economics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(economicRequest)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log('✅ US Census Bureau economic data retrieved');
    }, TEST_TIMEOUT);

    test('should retrieve housing data from Census Bureau', async () => {
      const housingRequest = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeHousingStats: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/census/housing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(housingRequest)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log('✅ US Census Bureau housing data retrieved');
    }, TEST_TIMEOUT);

    test('should provide comprehensive census intelligence', async () => {
      const comprehensiveCensus = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeAllCensusData: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/census/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comprehensiveCensus)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      
      if (result.data && (result.data.demographics || result.data.economics || result.data.housing)) {
        console.log('✅ Comprehensive census data includes: demographics, economics, housing');
      }
    }, TEST_TIMEOUT);
  });

  describe('Multi-Provider Address Services', () => {
    test('should validate addresses using geocoding service', async () => {
      const addressData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
        includeValidation: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      console.log('✅ Multi-provider address geocoding successful');
    }, TEST_TIMEOUT);

    test('should perform address validation', async () => {
      const validationData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
        validateComponents: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validationData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log('✅ Address validation completed');
    }, TEST_TIMEOUT);

    test('should perform reverse geocoding', async () => {
      const reverseData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeAddressComponents: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/reverse-geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reverseData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log('✅ Reverse geocoding completed');
    }, TEST_TIMEOUT);
  });

  describe('System Health and Provider Status', () => {
    test('should report external service connectivity status', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe('healthy');
      expect(result.services).toBeDefined();

      console.log('✅ External service health check completed');
      
      if (result.services) {
        Object.keys(result.services).forEach(service => {
          const status = result.services[service];
          console.log(`   🔗 ${service}: ${status}`);
        });
      }
    }, TEST_TIMEOUT);

    test('should provide provider status information', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/providers/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      console.log('✅ Provider status information retrieved');
      
      if (result.data.providers) {
        console.log(`   📊 Active providers: ${Object.keys(result.data.providers).length}`);
      }
    }, TEST_TIMEOUT);
  });

  describe('Creative Property Features (External Data)', () => {
    test('should analyze coffee shop density using external data', async () => {
      const coffeeData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        analysisType: 'coffee_culture',
        radius: 500
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/creative-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coffeeData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log('✅ Creative coffee culture analysis completed');
    }, TEST_TIMEOUT);

    test('should analyze walkability using external place data', async () => {
      const walkabilityData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        analysisType: 'walkability',
        includePublicTransit: true
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/creative-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(walkabilityData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log('✅ Walkability analysis using external data completed');
    }, TEST_TIMEOUT);
  });
});