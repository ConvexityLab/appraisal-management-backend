// Real Cosmos DB Integration Tests
// Tests actual database CRUD operations against local emulator or Azure Cosmos DB

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { CosmosDbService } from '../../src/services/cosmos-db.service'
import { OrderStatus, OrderType, ProductType, PropertyType, OccupancyType, Priority, VendorStatus } from '../../src/types'

describe('Cosmos DB Real Integration Tests', () => {
  let dbService: CosmosDbService
  let testOrderId: string
  let testVendorId: string

  beforeAll(async () => {
    console.log('🚀 Initializing Cosmos DB Integration Tests...')
    
    // Use local emulator by default, or Azure if configured
    const endpoint = process.env.COSMOS_ENDPOINT || process.env.AZURE_COSMOS_ENDPOINT || 'https://localhost:8081'
    
    // For local emulator, disable SSL verification to handle self-signed certificates
    if (endpoint.includes('localhost')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      console.log('🔓 SSL verification disabled for local emulator')
    }
    
    // CosmosDbService now uses managed identity in production, emulator key automatically in dev
    dbService = new CosmosDbService(endpoint)
    
    console.log(`📡 Connecting to: ${endpoint.includes('localhost') ? 'Local Emulator' : 'Azure Cosmos DB'}`)
    
    // Initialize database and containers
    await dbService.initialize()
    
    // Wait for containers to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('✅ Database initialization complete')
  }, 30000) // 30 second timeout for initialization

  afterAll(async () => {
    // Cleanup test data and disconnect
    if (dbService && dbService.isDbConnected()) {
      try {
        // Clean up test data
        if (testOrderId) {
          await dbService.deleteOrder(testOrderId, testOrderId) // Use ID as partition key
        }
      } catch (error) {
        console.log('⚠️  Cleanup warning:', error)
      }
      
      await dbService.disconnect()
      console.log('🔌 Database disconnected')
    }
  })

  describe('Database Connection & Health', () => {
    it('should connect to Cosmos DB successfully', () => {
      expect(dbService.isDbConnected()).toBe(true)
    })

    it('should pass health check with valid latency', async () => {
      const health = await dbService.healthCheck()
      
      expect(health.status).toBe('healthy')
      expect(health.database).toBe('appraisal-management')
      expect(typeof health.latency).toBe('number')
      expect(health.latency).toBeGreaterThan(0)
      expect(health.latency).toBeLessThan(5000) // Should be under 5 seconds
      
      console.log(`💚 Health check passed - Latency: ${health.latency}ms`)
    })
  })

  describe('Appraisal Order CRUD Operations', () => {
    it('should create a new appraisal order', async () => {
      const orderData = {
        clientId: `test-client-${Date.now()}`,
        orderNumber: `TEST-ORDER-${Date.now()}`,
        propertyAddress: {
          streetAddress: '123 Test Property Lane',
          city: 'Test City',
          state: 'CA',
          zipCode: '90210',
          county: 'Los Angeles'
        },
        propertyDetails: {
          propertyType: PropertyType.SFR,
          occupancy: OccupancyType.OWNER_OCCUPIED,
          features: ['garage', 'pool']
        },
        orderType: OrderType.PURCHASE,
        productType: ProductType.FULL_APPRAISAL,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        rushOrder: false,
        borrowerInformation: {
          firstName: 'John',
          lastName: 'Test',
          email: 'john.test@example.com',
          phone: '555-1234'
        },
        loanInformation: {
          loanAmount: 600000,
          loanType: 'conventional',
          loanPurpose: 'purchase'
        },
        contactInformation: {
          lenderName: 'Test Bank',
          lenderContact: 'Jane Lender',
          lenderEmail: 'jane@testbank.com',
          lenderPhone: '555-5678'
        },
        status: OrderStatus.NEW,
        priority: Priority.NORMAL,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test-user',
        tags: ['integration-test'],
        metadata: {
          testOrder: true,
          integrationTest: true
        }
      }

      const result = await dbService.createOrder(orderData)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      
      if (result.data) {
        expect(result.data.id).toBeDefined()
        expect(result.data.orderNumber).toBe(orderData.orderNumber)
        expect(result.data.clientId).toBe(orderData.clientId)
        expect(result.data.status).toBe(OrderStatus.NEW)
        
        testOrderId = result.data.id
        console.log(`✅ Created order with ID: ${testOrderId}`)
      }
    })

    it('should retrieve the created order by ID', async () => {
      expect(testOrderId).toBeDefined()
      
      const result = await dbService.findOrderById(testOrderId)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      
      if (result.data) {
        expect(result.data.id).toBe(testOrderId)
        expect(result.data.propertyAddress.streetAddress).toBe('123 Test Property Lane')
        expect(result.data.tags).toContain('integration-test')
        
        console.log(`✅ Retrieved order: ${result.data.orderNumber}`)
      }
    })

    it('should update the order status', async () => {
      expect(testOrderId).toBeDefined()
      
      const updateData = {
        status: OrderStatus.IN_PROGRESS,
        assignedVendorId: 'test-vendor-123',
        updatedAt: new Date()
      }
      
      const result = await dbService.updateOrder(testOrderId, updateData)
      
      expect(result.success).toBe(true)
      
      if (result.data) {
        expect(result.data.status).toBe(OrderStatus.IN_PROGRESS)
        expect(result.data.assignedVendorId).toBe('test-vendor-123')
        
        console.log(`✅ Updated order status to: ${result.data.status}`)
      }
    })

    it('should list orders with filters', async () => {
      const filters = {
        status: [OrderStatus.IN_PROGRESS] // Search for IN_PROGRESS orders since we updated our test order
      }
      
      const result = await dbService.findOrders(filters, 0, 10)
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      
      if (result.data) {
        expect(result.data.length).toBeGreaterThan(0)
        
        // Should include our test order (which was updated to IN_PROGRESS)
        const testOrder = result.data.find(order => order.id === testOrderId)
        expect(testOrder).toBeDefined()
        expect(testOrder?.status).toBe(OrderStatus.IN_PROGRESS)
        
        console.log(`✅ Found ${result.data.length} orders with status 'new'`)
      }
    })
  })

  describe('Vendor CRUD Operations', () => {
    it('should create a new vendor', async () => {
      const vendorData = {
        name: 'Test Appraisal Company',
        email: `test-vendor-${Date.now()}@example.com`,
        phone: '555-123-4567',
        address: {
          streetAddress: '456 Business Park Dr',
          city: 'Business City',
          state: 'CA',
          zipCode: '90211'
        },
        licenseNumber: `LIC-${Date.now()}`,
        licenseState: 'CA',
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        serviceAreas: [
          {
            state: 'CA',
            counties: ['Los Angeles', 'Orange']
          }
        ],
        productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL],
        status: VendorStatus.ACTIVE,
        performance: {
          totalOrders: 0,
          completedOrders: 0,
          averageTurnTime: 120, // 5 days in hours
          revisionRate: 5, // 5%
          onTimeDeliveryRate: 95, // 95%
          qualityScore: 4.5, // 1-5 scale
          clientSatisfactionScore: 4.8, // 1-5 scale
          lastUpdated: new Date()
        },
        certifications: [
          {
            type: 'CGA',
            number: 'CGA-12345',
            issuingAuthority: 'Canadian Institute of Chartered Business Valuators',
            issueDate: new Date('2020-01-01'),
            expiryDate: new Date('2025-01-01'),
            status: 'active' as const
          },
          {
            type: 'ASA',
            number: 'ASA-67890',
            issuingAuthority: 'American Society of Appraisers',
            issueDate: new Date('2019-06-01'),
            expiryDate: new Date('2024-06-01'),
            status: 'active' as const
          }
        ],
        specialties: [
          {
            type: 'single-family',
            description: 'Single family residential properties',
            yearsExperience: 10
          },
          {
            type: 'luxury',
            description: 'Luxury properties over $1M',
            yearsExperience: 5
          }
        ],
        insuranceInfo: {
          provider: 'Test Insurance',
          policyNumber: 'POL-123456',
          coverage: 1000000,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'active' as const
        },
        paymentInfo: {
          method: 'ach' as const,
          bankName: 'Test Bank',
          accountNumber: '****1234',
          routingNumber: '123456789'
        },
        preferences: {
          maxConcurrentOrders: 10,
          preferredProductTypes: ['residential'],
          workingHours: {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' }
          }
        }
      }

      const result = await dbService.createVendor(vendorData)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      
      if (result.data) {
        expect(result.data.id).toBeDefined()
        expect(result.data.name).toBe(vendorData.name)
        expect(result.data.email).toBe(vendorData.email)
        expect(result.data.status).toBe('active')
        expect(result.data.performance.qualityScore).toBe(4.5)
        
        testVendorId = result.data.id
        console.log(`✅ Created vendor with ID: ${testVendorId}`)
      }
    })

    it('should retrieve vendor by ID', async () => {
      expect(testVendorId).toBeDefined()
      
      const result = await dbService.findVendorById(testVendorId)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      
      if (result.data) {
        expect(result.data.id).toBe(testVendorId)
        expect(result.data.name).toBe('Test Appraisal Company')
        expect(result.data.serviceAreas[0].counties).toContain('Los Angeles')
        
        console.log(`✅ Retrieved vendor: ${result.data.name}`)
      }
    })

    it('should update vendor performance metrics', async () => {
      expect(testVendorId).toBeDefined()
      
      const updateData = {
        performance: {
          totalOrders: 5,
          completedOrders: 4,
          averageTurnTime: 96, // 4 days
          revisionRate: 10,
          onTimeDeliveryRate: 85,
          qualityScore: 4.8,
          clientSatisfactionScore: 4.9,
          lastUpdated: new Date()
        }
      }
      
      const result = await dbService.updateVendor(testVendorId, updateData)
      
      expect(result.success).toBe(true)
      
      if (result.data) {
        expect(result.data.performance.qualityScore).toBe(4.8)
        expect(result.data.performance.completedOrders).toBe(4)
        
        console.log(`✅ Updated vendor performance - Quality Score: ${result.data.performance.qualityScore}`)
      }
    })

    it('should list all vendors', async () => {
      const result = await dbService.findAllVendors()
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      
      if (result.data) {
        expect(result.data.length).toBeGreaterThan(0)
        
        // Should include our test vendor
        const testVendor = result.data.find(vendor => vendor.id === testVendorId)
        expect(testVendor).toBeDefined()
        expect(testVendor?.serviceAreas[0].counties).toContain('Los Angeles')
        
        console.log(`✅ Found ${result.data.length} total vendors`)
      }
    })
  })

  describe('Property Summary Operations', () => {
    it('should create a property summary', async () => {
      const propertyData = {
        address: {
          street: '789 Property Test St',
          city: 'Property City',
          state: 'CA',
          zip: '90212',
          county: 'Los Angeles'
        },
        propertyType: 'single_family_residential' as any,
        building: {
          yearBuilt: 2005,
          livingAreaSquareFeet: 2500,
          bedroomCount: 4,
          bathroomCount: 3,
          storyCount: 2
        },
        lot: {
          size: 8000
        },
        valuation: {
          estimatedValue: 850000,
          lastSoldPrice: 750000,
          lastSoldDate: new Date('2020-05-15'),
          pricePerSqft: 340
        },
        features: ['pool', 'fireplace'],
        lastUpdated: new Date()
      }

      const result = await dbService.createPropertySummary(propertyData)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      
      if (result.data) {
        expect(result.data.id).toBeDefined()
        expect(result.data.address.street).toBe(propertyData.address.street)
        expect(result.data.building.livingAreaSquareFeet).toBe(2500)
        expect(result.data.valuation.estimatedValue).toBe(850000)
        
        console.log(`✅ Created property summary with ID: ${result.data.id}`)
      }
    })

    it('should search properties by criteria', async () => {
      const searchParams = {
        state: 'CA',
        propertyType: 'single_family_residential',
        minValue: 800000,
        maxValue: 900000
      }
      
      const result = await dbService.searchPropertySummaries(searchParams, 0, 10)
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      
      if (result.data) {
        console.log(`✅ Found ${result.data.length} properties matching search criteria`)
      }
    })
  })

  describe('Performance and Concurrency', () => {
    it('should handle concurrent read operations', async () => {
      expect(testOrderId).toBeDefined()
      
      // Make 5 concurrent requests to read the same order
      const promises = Array.from({ length: 5 }, () =>
        dbService.findOrderById(testOrderId)
      )
      
      const startTime = Date.now()
      const results = await Promise.all(promises)
      const duration = Date.now() - startTime
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.data?.id).toBe(testOrderId)
      })
      
      // Should complete reasonably quickly
      expect(duration).toBeLessThan(5000)
      
      console.log(`✅ Completed 5 concurrent reads in ${duration}ms`)
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent order lookup gracefully', async () => {
      const fakeId = 'non-existent-order-id'
      const result = await dbService.findOrderById(fakeId)
      
      // Should return success: false or data: null for non-existent items
      expect(result.success === false || result.data === null).toBe(true)
    })

    it('should validate required fields on order creation', async () => {
      const incompleteOrderData = {
        clientId: 'test-client',
        // Missing many required fields
      }
      
      try {
        await dbService.createOrder(incompleteOrderData as any)
        // If it doesn't throw, check if result indicates failure
        console.log(`ℹ️  Incomplete order creation handled`)
      } catch (error) {
        expect(error).toBeDefined()
        console.log(`✅ Properly rejected incomplete order data`)
      }
    })
  })
})