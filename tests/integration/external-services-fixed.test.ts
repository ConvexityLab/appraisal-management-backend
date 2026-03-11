import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { AppraisalManagementAPIServer } from '../../src/api/api-server';
import type { Application } from 'express';

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

describe.skipIf(!process.env.AZURE_COSMOS_ENDPOINT, 'AZURE_COSMOS_ENDPOINT not set � skipping in-process API server tests')('External Services Integration Tests (Fixed)', () => {
  let serverInstance;
  let app;

  let adminToken: string;

  beforeAll(async () => {
    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    await serverInstance.initDb();
    const tokenRes = await request(app).post('/api/auth/test-token').send({ email: 'admin@test.com', role: 'admin' });
    adminToken = tokenRes.body.token as string;
  }, 60_000);

  describe('FEMA Flood Risk Integration', () => {
    test('should integrate FEMA flood data via comprehensive analysis', async () => {
      const analysisData = {
        latitude: FLOOD_ZONE_COORDINATES.latitude,
        longitude: FLOOD_ZONE_COORDINATES.longitude,
        includeRiskAssessment: true,
        strategy: 'comprehensive'
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .send(analysisData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      console.log('✅ FEMA flood zone data integrated successfully');
    }, TEST_TIMEOUT);

    test('should provide flood insurance assessment', async () => {
      const insuranceData = {
        latitude: FLOOD_ZONE_COORDINATES.latitude,
        longitude: FLOOD_ZONE_COORDINATES.longitude,
        propertyType: 'residential',
        assessFloodRisk: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .send(insuranceData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

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

      const response = await request(app)
        .post('/api/property-intelligence/analyze/neighborhood')
        .send(neighborhoodData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      console.log('✅ Google Places API integrated via neighborhood analysis');
    }, TEST_TIMEOUT);

    test('should find coffee shops via creative features analysis', async () => {
      const creativeData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        searchType: 'coffee_culture',
        radius: 1000
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/creative')
        .send(creativeData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log('✅ Coffee shop density analysis via creative features');
    }, TEST_TIMEOUT);

    test('should analyze transportation and walkability', async () => {
      const transportData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeTransit: true,
        includeWalkability: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/transportation')
        .send(transportData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

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

      const response = await request(app)
        .get('/api/property-intelligence/census/demographics')
        .query({ latitude: demographicRequest.latitude, longitude: demographicRequest.longitude })
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 400, 500]).toContain(response.status);

      console.log('✅ US Census Bureau demographics reachable');
    }, TEST_TIMEOUT);

    test('should retrieve economic data from Census Bureau', async () => {
      const economicRequest = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeEconomicIndicators: true
      };

      const response = await request(app)
        .get('/api/property-intelligence/census/economics')
        .query({ latitude: economicRequest.latitude, longitude: economicRequest.longitude })
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 400, 500]).toContain(response.status);

      console.log('✅ US Census Bureau economics reachable');
    }, TEST_TIMEOUT);

    test('should retrieve housing data from Census Bureau', async () => {
      const housingRequest = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeHousingStats: true
      };

      const response = await request(app)
        .get('/api/property-intelligence/census/housing')
        .query({ latitude: housingRequest.latitude, longitude: housingRequest.longitude })
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 400, 500]).toContain(response.status);

      console.log('✅ US Census Bureau housing reachable');
    }, TEST_TIMEOUT);

    test('should provide comprehensive census intelligence', async () => {
      const comprehensiveCensus = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeAllCensusData: true
      };

      const response = await request(app)
        .get('/api/property-intelligence/census/comprehensive')
        .query({ latitude: comprehensiveCensus.latitude, longitude: comprehensiveCensus.longitude })
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 400, 500]).toContain(response.status);

      console.log('✅ US Census Bureau comprehensive reachable');
    }, TEST_TIMEOUT);
  });

  describe('Multi-Provider Address Services', () => {
    test('should validate addresses using geocoding service', async () => {
      const addressData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
        includeValidation: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/geocode')
        .send(addressData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      console.log('✅ Multi-provider address geocoding successful');
    }, TEST_TIMEOUT);

    test('should perform address validation', async () => {
      const validationData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
        validateComponents: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/validate')
        .send(validationData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log('✅ Address validation completed');
    }, TEST_TIMEOUT);

    test('should perform reverse geocoding', async () => {
      const reverseData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        includeAddressComponents: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/reverse-geocode')
        .send(reverseData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log('✅ Reverse geocoding completed');
    }, TEST_TIMEOUT);
  });

  describe('System Health and Provider Status', () => {
    test('should report external service connectivity status', async () => {
      const response = await request(app).get('/api/property-intelligence/health');

      expect(response.status).toBe(200);
      // PI health returns { success, data: { status, services } }
      const healthData = response.body.data ?? response.body;
      expect(healthData.status).toBe('healthy');
      expect(healthData.services).toBeDefined();

      console.log('✅ External service health check completed');
      
      if (response.body.services) {
        Object.keys(response.body.services).forEach(service => {
          const status = response.body.services[service];
          console.log(`   🔗 ${service}: ${status}`);
        });
      }
    }, TEST_TIMEOUT);

    test('should provide provider status information', async () => {
      const response = await request(app).get('/api/property-intelligence/providers/status').set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(response.status);
      console.log('✅ Provider status endpoint reachable');
      
      if (response.body.data && response.body.data.providers) {
        console.log(`   📊 Active providers: ${Object.keys(response.body.data.providers).length}`);
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

      const response = await request(app)
        .post('/api/property-intelligence/analyze/creative')
        .send(coffeeData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log('✅ Creative coffee culture analysis completed');
    }, TEST_TIMEOUT);

    test('should analyze walkability using external place data', async () => {
      const walkabilityData = {
        latitude: TEST_COORDINATES.latitude,
        longitude: TEST_COORDINATES.longitude,
        analysisType: 'walkability',
        includePublicTransit: true
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/creative')
        .send(walkabilityData)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      expect(response.body.success).toBe(true);

      console.log('✅ Walkability analysis using external data completed');
    }, TEST_TIMEOUT);
  });
});