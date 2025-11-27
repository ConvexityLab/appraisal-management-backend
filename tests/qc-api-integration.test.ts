/**
 * Comprehensive QC API Endpoints Test Suite
 * Tests all QC controllers with proper authentication and validation
 */

import request from 'supertest';
import { AppraisalManagementAPIServer } from '../src/api/api-server';
import { CosmosDbService } from '../src/services/cosmos-db.service';
import jwt from 'jsonwebtoken';

describe('QC API Endpoints Integration Tests', () => {
  let app: any;
  let server: AppraisalManagementAPIServer;
  let authToken: string;
  let testUser: any;
  let testChecklistId: string;
  let testExecutionId: string;

  beforeAll(async () => {
    // Initialize test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-for-qc-api-testing-only';
    process.env.COSMOS_USE_EMULATOR = 'true';
    
    // Create API server instance
    server = new AppraisalManagementAPIServer(0); // Use random port for testing
    app = server.getExpressApp();
    
    // Create test user and auth token
    testUser = {
      id: 'test-user-qc-analyst',
      email: 'qc.analyst@test.com',
      role: 'qc_analyst',
      organizationId: 'test-org',
      permissions: [
        'qc_validate', 'qc_execute', 'qc_manage', 
        'qc_checklist_manage', 'qc_results_view'
      ]
    };
    
    authToken = jwt.sign(testUser, process.env.JWT_SECRET!, { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Cleanup test environment
    if (server) {
      await server.disconnect?.();
    }
  });

  describe('QC Checklist Management', () => {
    describe('POST /api/qc/checklists', () => {
      it('should create a new QC checklist with proper authentication', async () => {
        const checklistData = {
          name: 'Test Appraisal QC Checklist',
          description: 'Comprehensive test checklist for appraisal QC validation',
          category: 'appraisal',
          documentType: 'appraisal_report',
          priority: 'high',
          items: [
            {
              id: 'item-1',
              title: 'Property Address Verification',
              description: 'Verify property address matches all documentation',
              category: 'property_details',
              criticality: 'high',
              checkType: 'manual_review',
              weight: 10,
              validationRules: {
                required: true,
                mustMatch: ['subject_property', 'legal_description']
              }
            },
            {
              id: 'item-2', 
              title: 'Market Data Analysis',
              description: 'Validate comparable sales selection and adjustments',
              category: 'market_analysis',
              criticality: 'high',
              checkType: 'ai_analysis',
              weight: 15,
              validationRules: {
                required: true,
                minComparables: 3,
                maxDistance: '5 miles'
              }
            }
          ],
          clientId: 'test-client-123',
          isTemplate: false,
          version: '1.0'
        };

        const response = await request(app)
          .post('/api/qc/checklists')
          .set('Authorization', `Bearer ${authToken}`)
          .send(checklistData)
          .expect(201);

        expect(response.body).toHaveProperty('checklistId');
        expect(response.body).toHaveProperty('name', checklistData.name);
        expect(response.body).toHaveProperty('category', checklistData.category);
        
        testChecklistId = response.body.checklistId;
      });

      it('should reject checklist creation without authentication', async () => {
        const checklistData = {
          name: 'Unauthorized Checklist',
          category: 'test'
        };

        await request(app)
          .post('/api/qc/checklists')
          .send(checklistData)
          .expect(401);
      });

      it('should reject invalid checklist data', async () => {
        const invalidData = {
          name: '', // Invalid empty name
          category: 'invalid_category'
        };

        await request(app)
          .post('/api/qc/checklists')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData)
          .expect(400);
      });
    });

    describe('GET /api/qc/checklists', () => {
      it('should search checklists with filters', async () => {
        const response = await request(app)
          .get('/api/qc/checklists')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            category: 'appraisal',
            status: 'active',
            limit: 10
          })
          .expect(200);

        expect(response.body).toHaveProperty('checklists');
        expect(response.body).toHaveProperty('pagination');
        expect(Array.isArray(response.body.checklists)).toBe(true);
      });

      it('should return empty results for non-existent category', async () => {
        const response = await request(app)
          .get('/api/qc/checklists')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ category: 'non_existent_category' })
          .expect(200);

        expect(response.body.checklists).toHaveLength(0);
      });
    });

    describe('GET /api/qc/checklists/:checklistId', () => {
      it('should retrieve specific checklist by ID', async () => {
        if (!testChecklistId) {
          throw new Error('Test checklist not created');
        }

        const response = await request(app)
          .get(`/api/qc/checklists/${testChecklistId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', testChecklistId);
        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
      });

      it('should return 404 for non-existent checklist', async () => {
        await request(app)
          .get('/api/qc/checklists/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });

    describe('PUT /api/qc/checklists/:checklistId', () => {
      it('should update checklist successfully', async () => {
        if (!testChecklistId) {
          throw new Error('Test checklist not created');
        }

        const updateData = {
          description: 'Updated test checklist description',
          priority: 'medium'
        };

        const response = await request(app)
          .put(`/api/qc/checklists/${testChecklistId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('description', updateData.description);
        expect(response.body).toHaveProperty('priority', updateData.priority);
      });
    });
  });

  describe('QC Execution Management', () => {
    describe('POST /api/qc/execution/execute', () => {
      it('should execute QC review successfully', async () => {
        if (!testChecklistId) {
          throw new Error('Test checklist not created');
        }

        const executionRequest = {
          checklistId: testChecklistId,
          targetId: 'test-appraisal-doc-123',
          executionMode: 'comprehensive',
          documentData: {
            propertyAddress: '123 Test Street, Test City, TS 12345',
            appraisalValue: 450000,
            comparables: [
              { address: '125 Test Street', salePrice: 440000, adjustedValue: 445000 },
              { address: '121 Test Street', salePrice: 460000, adjustedValue: 455000 }
            ]
          }
        };

        const response = await request(app)
          .post('/api/qc/execution/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send(executionRequest)
          .expect(200);

        expect(response.body).toHaveProperty('executionId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('totalIssues');
        expect(response.body).toHaveProperty('overallScore');
        
        testExecutionId = response.body.executionId;
      });

      it('should reject execution without required permissions', async () => {
        // Create token with limited permissions
        const limitedUser = { ...testUser, permissions: ['qc_results_view'] };
        const limitedToken = jwt.sign(limitedUser, process.env.JWT_SECRET!, { expiresIn: '1h' });

        const executionRequest = {
          checklistId: testChecklistId,
          targetId: 'test-doc',
          executionMode: 'basic'
        };

        await request(app)
          .post('/api/qc/execution/execute')
          .set('Authorization', `Bearer ${limitedToken}`)
          .send(executionRequest)
          .expect(403);
      });
    });

    describe('POST /api/qc/execution/execute-async', () => {
      it('should start async QC execution', async () => {
        if (!testChecklistId) {
          throw new Error('Test checklist not created');
        }

        const executionRequest = {
          checklistId: testChecklistId,
          targetId: 'test-async-doc-456',
          executionMode: 'comprehensive'
        };

        const response = await request(app)
          .post('/api/qc/execution/execute-async')
          .set('Authorization', `Bearer ${authToken}`)
          .send(executionRequest)
          .expect(202);

        expect(response.body).toHaveProperty('executionId');
        expect(response.body).toHaveProperty('status', 'started');
        expect(response.body).toHaveProperty('estimatedDuration');
      });
    });

    describe('GET /api/qc/execution/status/:executionId', () => {
      it('should retrieve execution status', async () => {
        if (!testExecutionId) {
          throw new Error('Test execution not created');
        }

        const response = await request(app)
          .get(`/api/qc/execution/status/${testExecutionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('executionId', testExecutionId);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('progress');
      });
    });

    describe('GET /api/qc/execution/progress/:executionId', () => {
      it('should retrieve execution progress', async () => {
        if (!testExecutionId) {
          throw new Error('Test execution not created');
        }

        const response = await request(app)
          .get(`/api/qc/execution/progress/${testExecutionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('executionId');
        expect(response.body).toHaveProperty('progress');
        expect(response.body).toHaveProperty('completedItems');
        expect(response.body).toHaveProperty('totalItems');
      });
    });
  });

  describe('QC Results Management', () => {
    describe('GET /api/qc/results/search', () => {
      it('should search QC results with filters', async () => {
        const response = await request(app)
          .get('/api/qc/results/search')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            checklistId: testChecklistId,
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            limit: 20
          })
          .expect(200);

        expect(response.body).toHaveProperty('results');
        expect(response.body).toHaveProperty('pagination');
        expect(Array.isArray(response.body.results)).toBe(true);
      });

      it('should validate date range parameters', async () => {
        await request(app)
          .get('/api/qc/results/search')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            startDate: 'invalid-date',
            endDate: '2024-12-31'
          })
          .expect(400);
      });
    });

    describe('GET /api/qc/results/analytics/summary', () => {
      it('should retrieve QC analytics summary', async () => {
        const response = await request(app)
          .get('/api/qc/results/analytics/summary')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            timeframe: 'last_30_days',
            category: 'appraisal'
          })
          .expect(200);

        expect(response.body).toHaveProperty('summary');
        expect(response.body).toHaveProperty('metrics');
        expect(response.body.summary).toHaveProperty('totalExecutions');
        expect(response.body.summary).toHaveProperty('averageScore');
        expect(response.body.metrics).toHaveProperty('scoreDistribution');
      });
    });

    describe('POST /api/qc/results/reports/generate', () => {
      it('should generate QC report successfully', async () => {
        const reportRequest = {
          title: 'Test QC Report',
          description: 'Comprehensive QC analysis report for testing',
          type: 'summary',
          format: 'pdf',
          filters: {
            checklistIds: [testChecklistId],
            dateRange: {
              startDate: '2024-01-01',
              endDate: '2024-12-31'
            }
          },
          includeCharts: true,
          includeDetails: true
        };

        const response = await request(app)
          .post('/api/qc/results/reports/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(reportRequest)
          .expect(202);

        expect(response.body).toHaveProperty('reportId');
        expect(response.body).toHaveProperty('status', 'generating');
        expect(response.body).toHaveProperty('estimatedCompletion');
      });
    });

    describe('GET /api/qc/results/export', () => {
      it('should export QC results in specified format', async () => {
        const response = await request(app)
          .get('/api/qc/results/export')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            format: 'csv',
            checklistId: testChecklistId,
            fields: 'id,executedAt,overallScore,status'
          })
          .expect(200);

        expect(response.headers['content-type']).toContain('text/csv');
      });

      it('should support JSON export format', async () => {
        const response = await request(app)
          .get('/api/qc/results/export')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            format: 'json',
            limit: 5
          })
          .expect(200);

        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body).toHaveProperty('results');
        expect(response.body).toHaveProperty('exportMetadata');
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication token', async () => {
      await request(app)
        .get('/api/qc/checklists')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/qc/checklists')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);
    });

    it('should reject requests with expired token', async () => {
      const expiredUser = { ...testUser };
      const expiredToken = jwt.sign(expiredUser, process.env.JWT_SECRET!, { expiresIn: '0s' });

      await request(app)
        .get('/api/qc/checklists')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);
    });

    it('should enforce role-based permissions', async () => {
      // Create token with appraiser role (limited permissions)
      const appraiserUser = {
        ...testUser,
        role: 'appraiser',
        permissions: ['order_view', 'qc_results_view']
      };
      const appraiserToken = jwt.sign(appraiserUser, process.env.JWT_SECRET!, { expiresIn: '1h' });

      // Should be able to view results
      await request(app)
        .get('/api/qc/results/search')
        .set('Authorization', `Bearer ${appraiserToken}`)
        .expect(200);

      // Should NOT be able to execute QC
      await request(app)
        .post('/api/qc/execution/execute')
        .set('Authorization', `Bearer ${appraiserToken}`)
        .send({ checklistId: testChecklistId })
        .expect(403);
    });
  });

  describe('Input Validation and Security', () => {
    it('should sanitize malicious input', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>Malicious Checklist',
        description: 'Normal description',
        category: 'appraisal'
      };

      const response = await request(app)
        .post('/api/qc/checklists')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(201);

      // Should sanitize the script tag
      expect(response.body.name).not.toContain('<script>');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        description: 'Missing required fields'
        // Missing name, category, etc.
      };

      await request(app)
        .post('/api/qc/checklists')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData)
        .expect(400);
    });

    it('should enforce field length limits', async () => {
      const oversizedData = {
        name: 'A'.repeat(1001), // Assuming 1000 char limit
        category: 'appraisal'
      };

      await request(app)
        .post('/api/qc/checklists')
        .set('Authorization', `Bearer ${authToken}`)
        .send(oversizedData)
        .expect(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking the database service
      // For now, just ensure proper error response format
      await request(app)
        .get('/api/qc/checklists/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('code');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('should return proper error format for validation failures', async () => {
      await request(app)
        .post('/api/qc/checklists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Empty data
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('details');
          expect(Array.isArray(res.body.details)).toBe(true);
        });
    });
  });
});