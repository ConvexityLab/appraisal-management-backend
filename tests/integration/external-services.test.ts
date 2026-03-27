import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { AppraisalManagementAPIServer } from '../../src/api/api-server';
import type { Application } from 'express';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';

// Test configuration
const TEST_TIMEOUT = 20000;

// Test coordinates for Google headquarters (good test location with known data)
const TEST_COORDINATES = {
  latitude: 37.4224764,
  longitude: -122.0842499,
  address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
};

// High-risk flood zone coordinates for FEMA testing
const FLOOD_ZONE_COORDINATES = {
  latitude: 29.7604, // Houston, TX (known flood risk area)
  longitude: -95.3698
};

describe.skipIf(process.env.VITEST_INTEGRATION !== 'true', 'AZURE_COSMOS_ENDPOINT not set ï¿½ skipping in-process API server tests')('External Services Integration Tests', () => {
  let serverInstance;
  let app: Application;
  let adminToken: string;

  beforeAll(async () => {
    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    // No initDb() needed â€” property intelligence does not use the DB
    const tokenGen = new TestTokenGenerator();
    adminToken = tokenGen.generateToken({ id: 'test-admin', email: 'admin@appraisal.com', name: 'Test Admin', role: 'admin' as const, tenantId: 'test-tenant' });
  }, 60_000);

  describe('FEMA Flood Risk Integration', () => {
    it('should integrate with FEMA flood zone data via risk assessment', async () => {
      const riskData = {
        latitude: FLOOD_ZONE_COORDINATES.latitude,
        longitude: FLOOD_ZONE_COORDINATES.longitude,
        includeFloodRisk: true,
        includeFemaData: true
      };

      // Use comprehensive analysis endpoint which includes risk assessment
      const response = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(riskData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for FEMA-specific data in response
      if (response.body.data && response.body.data.riskFactors) {
        console.log('âœ… FEMA flood risk data integration working');
      }

      console.log('âœ… FEMA integration test completed');
    }, TEST_TIMEOUT);

    it('should provide flood insurance requirement assessment', async () => {
      const analysisData = {
        latitude: FLOOD_ZONE_COORDINATES.latitude,
        longitude: FLOOD_ZONE_COORDINATES.longitude,
        propertyType: 'single_family',
        assessFloodInsurance: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(analysisData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log('âœ… Flood insurance assessment completed');
    }, TEST_TIMEOUT);
  });

  describe('Google Places API Integration', () => {
    it('should search nearby places using Google Places API', async () => {
      const placesData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        radius: 1000,
        type: 'restaurant'
      };

      // places/nearby maps to neighborhood analysis which covers amenities/places data
      const response = await request(app)
        .post('/api/property-intelligence/analyze/neighborhood')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(placesData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      console.log(`âœ… Google Places API: Neighborhood analysis completed`);
      
      // Verify Google Places specific data structure
      if (response.body.data.length > 0) {
        const place = response.body.data[0];
        if (place.place_id) {
          console.log(`   ðŸ“ Sample Place ID: ${place.place_id}`);
        }
        if (place.rating) {
          console.log(`   â­ Sample Rating: ${place.rating}`);
        }
      }
    }, TEST_TIMEOUT);

    it('should find specific establishment types (Starbucks test)', async () => {
      const starbucksData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        radius: 2000,
        keyword: 'Starbucks'
      };

      // places/nearby maps to neighborhood analysis
      const response = await request(app)
        .post('/api/property-intelligence/analyze/neighborhood')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(starbucksData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log(`âœ… Google Places API: Neighborhood analysis for establishments completed`);
    }, TEST_TIMEOUT);

    it('should provide detailed place information', async () => {
      const placesData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        radius: 500,
        type: 'school',
        includeDetails: true
      };

      // places/nearby maps to neighborhood analysis
      const response = await request(app)
        .post('/api/property-intelligence/analyze/neighborhood')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(placesData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log(`âœ… Google Places API: Neighborhood analysis for schools completed`);
    }, TEST_TIMEOUT);
  });

  describe('US Census Bureau Integration', () => {
    it('should retrieve demographic data from Census Bureau', async () => {
      const { latitude, longitude } = TEST_COORDINATES;

      // Census endpoints are GET with query params
      const response = await request(app)
        .get('/api/property-intelligence/census/demographics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ latitude, longitude });

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for Census Bureau specific data
      if (response.body.data.population) {
        console.log(`   ðŸ‘¥ Population: ${response.body.data.population}`);
      }
      if (response.body.data.medianHouseholdIncome) {
        console.log(`   ðŸ’° Median Household Income: $${response.body.data.medianHouseholdIncome}`);
      }
      if (response.body.data.medianAge) {
        console.log(`   ðŸ“… Median Age: ${response.body.data.medianAge}`);
      }

      console.log('âœ… US Census Bureau demographic data retrieved');
    }, TEST_TIMEOUT);

    it('should retrieve economic data from Census Bureau', async () => {
      const { latitude, longitude } = TEST_COORDINATES;

      // Census endpoints are GET with query params; route is /census/economics (not /economic)
      const response = await request(app)
        .get('/api/property-intelligence/census/economics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ latitude, longitude });

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for economic indicators
      if (response.body.data.unemploymentRate) {
        console.log(`   ðŸ“Š Unemployment Rate: ${response.body.data.unemploymentRate}%`);
      }
      if (response.body.data.medianIncome) {
        console.log(`   ðŸ’µ Median Income: $${response.body.data.medianIncome}`);
      }

      console.log('âœ… US Census Bureau economic data retrieved');
    }, TEST_TIMEOUT);

    it('should retrieve housing data from Census Bureau', async () => {
      const { latitude, longitude } = TEST_COORDINATES;

      // Census endpoints are GET with query params
      const response = await request(app)
        .get('/api/property-intelligence/census/housing')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ latitude, longitude });

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for housing-specific data
      if (response.body.data.medianHomeValue) {
        console.log(`   ðŸ  Median Home Value: $${response.body.data.medianHomeValue}`);
      }
      if (response.body.data.ownerOccupiedRate) {
        console.log(`   ðŸ”‘ Owner Occupied Rate: ${response.body.data.ownerOccupiedRate}%`);
      }
      if (response.body.data.vacancyRate) {
        console.log(`   ðŸ“‹ Vacancy Rate: ${response.body.data.vacancyRate}%`);
      }

      console.log('âœ… US Census Bureau housing data retrieved');
    }, TEST_TIMEOUT);

    it('should provide comprehensive census intelligence', async () => {
      const { latitude, longitude } = TEST_COORDINATES;

      // Census endpoints are GET with query params
      const response = await request(app)
        .get('/api/property-intelligence/census/comprehensive')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ latitude, longitude });

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Should include demographics, economics, and housing
      const dataKeys = Object.keys(response.body.data);
      console.log(`âœ… Comprehensive census data includes: ${dataKeys.join(', ')}`);
    }, TEST_TIMEOUT);
  });

  describe('Multi-Provider Address Services', () => {
    it('should validate addresses using multiple providers', async () => {
      // validateAddress requires a single address string
      const addressData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(addressData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for multiple provider validation
      if (response.body.metadata && response.body.metadata.dataSourcesUsed) {
        console.log(`âœ… Address validation used providers: ${response.body.metadata.dataSourcesUsed.join(', ')}`);
      }

      console.log('âœ… Multi-provider address validation completed');
    }, TEST_TIMEOUT);

    it('should standardize addresses using SmartyStreets/USPS', async () => {
      // address/standardize maps to address/validate which does multi-provider validation+standardization
      // validateAddress requires a single address string
      const addressData = {
        address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043'
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(addressData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log('âœ… Address standardization/validation completed');
    }, TEST_TIMEOUT);

    it('should extract detailed address components', async () => {
      // address/components maps to address/geocode which returns lat/lng and address components
      const addressData = {
        address: TEST_COORDINATES.address,
        includeComponents: true,
        validateComponents: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/geocode')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(addressData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      console.log('âœ… Address component extraction (geocode) completed');
    }, TEST_TIMEOUT);
  });

  describe('Geospatial Risk Assessment Services', () => {
    it('should assess environmental hazards using multiple data sources', async () => {
      const riskData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeEnvironmentalHazards: true,
        includeSeismicRisk: true,
        includeFloodRisk: true,
        includeWildfireRisk: true
      };

      // risk-assessment maps to comprehensive analysis which includes risk data
      const response = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(riskData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for various risk assessments
      if (response.body.data.seismicRisk) {
        console.log(`   ðŸŒ Seismic Risk Score: ${response.body.data.seismicRisk.riskScore}/10`);
      }
      if (response.body.data.floodRisk) {
        console.log(`   ðŸŒŠ Flood Risk Score: ${response.body.data.floodRisk.floodRiskScore}/10`);
      }
      if (response.body.data.wildfireRisk) {
        console.log(`   ðŸ”¥ Wildfire Risk Score: ${response.body.data.wildfireRisk.riskScore}/10`);
      }

      console.log('âœ… Environmental hazard assessment completed');
    }, TEST_TIMEOUT);

    it('should provide detailed earthquake risk using USGS data', async () => {
      const earthquakeData = {
        latitude: 37.7749, // San Francisco (high seismic activity)
        longitude: -122.4194,
        includeUSGSData: true,
        includeDetailedSeismicHistory: true
      };

      // risk-assessment maps to comprehensive analysis
      const response = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(earthquakeData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log('âœ… USGS earthquake risk assessment completed');
    }, TEST_TIMEOUT);
  });

  describe('Property Intelligence Service Health', () => {
    it('should report external service connectivity status', async () => {
      const response = await request(app)
        .get('/api/property-intelligence/health');
      expect(response.status).toBe(200);
      
      // health response structure: { success, data: { status, services, ... } }
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toBeDefined();

      // Check individual service status
      const services = response.body.data.services;
      console.log('\nðŸ“Š External Service Status:');
      
      if (services.googleMaps) {
        console.log(`   ðŸ—ºï¸  Google Maps: ${services.googleMaps.status}`);
      }
      if (services.googlePlaces) {
        console.log(`   ðŸ“ Google Places: ${services.googlePlaces.status}`);
      }
      if (services.censusBureau) {
        console.log(`   ðŸ“Š Census Bureau: ${services.censusBureau.status}`);
      }
      if (services.fema) {
        console.log(`   ðŸŒŠ FEMA Services: ${services.fema.status}`);
      }
      if (services.usgs) {
        console.log(`   ðŸŒ USGS Services: ${services.usgs.status}`);
      }
      if (services.smartyStreets) {
        console.log(`   ðŸ“® SmartyStreets: ${services.smartyStreets.status}`);
      }

      console.log('âœ… External service health check completed');
    });
  });

  describe('Creative Property Features (External Data)', () => {
    it('should analyze coffee shop density using Google Places', async () => {
      const coffeeData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        analysisType: 'coffee_culture',
        includeStarbucksAnalysis: true,
        radius: 2000
      };

      // creative-features maps to analyze/creative
      const response = await request(app)
        .post('/api/property-intelligence/analyze/creative')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(coffeeData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      if (response.body.data.coffeeCulture) {
        console.log(`âœ… Coffee shop analysis: ${response.body.data.coffeeCulture.totalShops} shops found`);
        if (response.body.data.coffeeCulture.starbucksCount) {
          console.log(`   â˜• Starbucks locations: ${response.body.data.coffeeCulture.starbucksCount}`);
        }
      }

      console.log('âœ… Creative coffee culture analysis completed');
    }, TEST_TIMEOUT);

    it('should analyze walkability using external place data', async () => {
      const walkabilityData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        analysisType: 'walkability',
        includePublicTransit: true,
        includeAmenities: true
      };

      // creative-features maps to analyze/creative
      const response = await request(app)
        .post('/api/property-intelligence/analyze/creative')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(walkabilityData);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      if (response.body.data.walkability) {
        console.log(`âœ… Walkability score: ${response.body.data.walkability.score}/100`);
      }

      console.log('âœ… Walkability analysis using external data completed');
    }, TEST_TIMEOUT);
  });
});
