import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { AppraisalManagementAPIServer } from '../../src/api/api-server';
import type { Application } from 'express';

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

describe.skipIf(!process.env.AZURE_COSMOS_ENDPOINT, 'AZURE_COSMOS_ENDPOINT not set � skipping in-process API server tests')('External Services Integration Tests', () => {
  let serverInstance;
  let app;

  beforeAll(async () => {
    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    // No initDb() needed — property intelligence does not use the DB
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
        .send(riskData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for FEMA-specific data in response
      if (response.body.data && response.body.data.riskFactors) {
        console.log('✅ FEMA flood risk data integration working');
      }

      console.log('✅ FEMA integration test completed');
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
        .send(analysisData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);

      console.log('✅ Flood insurance assessment completed');
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

      const response = await request(app)
        .post('/api/property-intelligence/places/nearby')
        .send(placesData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      console.log(`✅ Google Places API: Found ${response.body.data.length} nearby restaurants`);
      
      // Verify Google Places specific data structure
      if (response.body.data.length > 0) {
        const place = response.body.data[0];
        if (place.place_id) {
          console.log(`   📍 Sample Place ID: ${place.place_id}`);
        }
        if (place.rating) {
          console.log(`   ⭐ Sample Rating: ${place.rating}`);
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

      const response = await request(app)
        .post('/api/property-intelligence/places/nearby')
        .send(starbucksData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);

      console.log(`✅ Google Places API: Found ${response.body.data.length} Starbucks locations nearby`);
    }, TEST_TIMEOUT);

    it('should provide detailed place information', async () => {
      const placesData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        radius: 500,
        type: 'school',
        includeDetails: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/places/nearby')
        .send(placesData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);

      console.log(`✅ Google Places API: Found ${response.body.data.length} schools with detailed info`);
    }, TEST_TIMEOUT);
  });

  describe('US Census Bureau Integration', () => {
    it('should retrieve demographic data from Census Bureau', async () => {
      const censusData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeDetailedDemographics: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/census/demographics')
        .send(censusData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for Census Bureau specific data
      if (response.body.data.population) {
        console.log(`   👥 Population: ${response.body.data.population}`);
      }
      if (response.body.data.medianHouseholdIncome) {
        console.log(`   💰 Median Household Income: $${response.body.data.medianHouseholdIncome}`);
      }
      if (response.body.data.medianAge) {
        console.log(`   📅 Median Age: ${response.body.data.medianAge}`);
      }

      console.log('✅ US Census Bureau demographic data retrieved');
    }, TEST_TIMEOUT);

    it('should retrieve economic data from Census Bureau', async () => {
      const economicData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeBusinessData: true,
        includeEmploymentData: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/census/economic')
        .send(economicData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for economic indicators
      if (response.body.data.unemploymentRate) {
        console.log(`   📊 Unemployment Rate: ${response.body.data.unemploymentRate}%`);
      }
      if (response.body.data.medianIncome) {
        console.log(`   💵 Median Income: $${response.body.data.medianIncome}`);
      }

      console.log('✅ US Census Bureau economic data retrieved');
    }, TEST_TIMEOUT);

    it('should retrieve housing data from Census Bureau', async () => {
      const housingData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeHousingValues: true,
        includeOccupancyData: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/census/housing')
        .send(housingData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for housing-specific data
      if (response.body.data.medianHomeValue) {
        console.log(`   🏠 Median Home Value: $${response.body.data.medianHomeValue}`);
      }
      if (response.body.data.ownerOccupiedRate) {
        console.log(`   🔑 Owner Occupied Rate: ${response.body.data.ownerOccupiedRate}%`);
      }
      if (response.body.data.vacancyRate) {
        console.log(`   📋 Vacancy Rate: ${response.body.data.vacancyRate}%`);
      }

      console.log('✅ US Census Bureau housing data retrieved');
    }, TEST_TIMEOUT);

    it('should provide comprehensive census intelligence', async () => {
      const comprehensiveData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeAllDatasets: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/census/comprehensive')
        .send(comprehensiveData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Should include demographics, economics, and housing
      const dataKeys = Object.keys(response.body.data);
      console.log(`✅ Comprehensive census data includes: ${dataKeys.join(', ')}`);
    }, TEST_TIMEOUT);
  });

  describe('Multi-Provider Address Services', () => {
    it('should validate addresses using multiple providers', async () => {
      const addressData = {
        streetAddress: '1600 Amphitheatre Parkway',
        city: 'Mountain View',
        state: 'CA',
        zipCode: '94043',
        useMultipleProviders: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/validate')
        .send(addressData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for multiple provider validation
      if (response.body.metadata && response.body.metadata.dataSourcesUsed) {
        console.log(`✅ Address validation used providers: ${response.body.metadata.dataSourcesUsed.join(', ')}`);
      }

      console.log('✅ Multi-provider address validation completed');
    }, TEST_TIMEOUT);

    it('should standardize addresses using SmartyStreets/USPS', async () => {
      const addressData = {
        address: '1600 amphitheatre pkwy, mtn view, california 94043',
        standardizeFormat: true,
        validateUSPS: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/standardize')
        .send(addressData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);

      if (response.body.data.standardizedAddress) {
        console.log(`✅ Standardized: ${response.body.data.standardizedAddress}`);
      }

      console.log('✅ Address standardization completed');
    }, TEST_TIMEOUT);

    it('should extract detailed address components', async () => {
      const addressData = {
        address: TEST_COORDINATES.address,
        includeComponents: true,
        validateComponents: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/components')
        .send(addressData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for detailed components
      if (response.body.data.components) {
        const components = response.body.data.components;
        if (components.streetNumber) console.log(`   🏠 Street Number: ${components.streetNumber}`);
        if (components.streetName) console.log(`   🛣️  Street Name: ${components.streetName}`);
        if (components.city) console.log(`   🏙️  City: ${components.city}`);
        if (components.state) console.log(`   🗺️  State: ${components.state}`);
        if (components.zipCode) console.log(`   📮 ZIP Code: ${components.zipCode}`);
        if (components.county) console.log(`   🏛️  County: ${components.county}`);
      }

      console.log('✅ Address component extraction completed');
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

      const response = await request(app)
        .post('/api/property-intelligence/analyze/risk-assessment')
        .send(riskData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      // Check for various risk assessments
      if (response.body.data.seismicRisk) {
        console.log(`   🌍 Seismic Risk Score: ${response.body.data.seismicRisk.riskScore}/10`);
      }
      if (response.body.data.floodRisk) {
        console.log(`   🌊 Flood Risk Score: ${response.body.data.floodRisk.floodRiskScore}/10`);
      }
      if (response.body.data.wildfireRisk) {
        console.log(`   🔥 Wildfire Risk Score: ${response.body.data.wildfireRisk.riskScore}/10`);
      }

      console.log('✅ Environmental hazard assessment completed');
    }, TEST_TIMEOUT);

    it('should provide detailed earthquake risk using USGS data', async () => {
      const earthquakeData = {
        latitude: 37.7749, // San Francisco (high seismic activity)
        longitude: -122.4194,
        includeUSGSData: true,
        includeDetailedSeismicHistory: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/risk-assessment')
        .send(earthquakeData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);

      console.log('✅ USGS earthquake risk assessment completed');
    }, TEST_TIMEOUT);
  });

  describe('Property Intelligence Service Health', () => {
    it('should report external service connectivity status', async () => {
      const response = await request(app)
        .get('/api/property-intelligence/health');
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toBeDefined();

      // Check individual service status
      const services = response.body.services;
      console.log('\n📊 External Service Status:');
      
      if (services.googleMaps) {
        console.log(`   🗺️  Google Maps: ${services.googleMaps.status}`);
      }
      if (services.googlePlaces) {
        console.log(`   📍 Google Places: ${services.googlePlaces.status}`);
      }
      if (services.censusBureau) {
        console.log(`   📊 Census Bureau: ${services.censusBureau.status}`);
      }
      if (services.fema) {
        console.log(`   🌊 FEMA Services: ${services.fema.status}`);
      }
      if (services.usgs) {
        console.log(`   🌍 USGS Services: ${services.usgs.status}`);
      }
      if (services.smartyStreets) {
        console.log(`   📮 SmartyStreets: ${services.smartyStreets.status}`);
      }

      console.log('✅ External service health check completed');
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

      const response = await request(app)
        .post('/api/property-intelligence/analyze/creative-features')
        .send(coffeeData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);

      if (response.body.data.coffeeCulture) {
        console.log(`✅ Coffee shop analysis: ${response.body.data.coffeeCulture.totalShops} shops found`);
        if (response.body.data.coffeeCulture.starbucksCount) {
          console.log(`   ☕ Starbucks locations: ${response.body.data.coffeeCulture.starbucksCount}`);
        }
      }

      console.log('✅ Creative coffee culture analysis completed');
    }, TEST_TIMEOUT);

    it('should analyze walkability using external place data', async () => {
      const walkabilityData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        analysisType: 'walkability',
        includePublicTransit: true,
        includeAmenities: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/creative-features')
        .send(walkabilityData);

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(response.body.success).toBe(true);

      if (response.body.data.walkability) {
        console.log(`✅ Walkability score: ${response.body.data.walkability.score}/100`);
      }

      console.log('✅ Walkability analysis using external data completed');
    }, TEST_TIMEOUT);
  });
});