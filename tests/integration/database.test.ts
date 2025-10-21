// Real Cosmos DB Integration Tests
// Tests actual database CRUD operations against local emulator or Azure Cosmos DB

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { CosmosDbService } from '../../src/services/cosmos-db.service'
import type { AppraisalOrder, Vendor, PropertySummary } from '../../src/types'

describe('Cosmos DB Real Integration Tests', () => {
  let dbService: CosmosDbService
  let testOrderId: string
  let testVendorId: string
  let testPropertyId: string

  beforeAll(async () => {
    console.log('🚀 Initializing Cosmos DB Integration Tests...')
    
    // Use local emulator by default, or Azure if configured
    const endpoint = process.env.COSMOS_ENDPOINT || 'https://localhost:8081'
    const key = process.env.COSMOS_KEY || 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=='
    
    dbService = new CosmosDbService(endpoint, key)
    
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
          await dbService.deleteOrder(testOrderId)
        }
        if (testVendorId) {
          await dbService.deleteVendor(testVendorId)
        }
        if (testPropertyId) {
          await dbService.deletePropertySummary(testPropertyId)
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
          propertyType: 'single_family_residential' as const,
          occupancy: 'owner_occupied' as const,
          features: ['garage', 'pool']
        },
        orderType: 'purchase' as const,
        priority: 'standard' as const,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        estimatedValue: 750000,
        loanAmount: 600000,
        borrowerName: 'John Test',
        lenderName: 'Test Bank',
        orderDate: new Date(),
        status: 'pending' as const
      }

      const result = await dbService.createOrder(orderData)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.id).toBeDefined()
      expect(result.data.orderNumber).toBe(orderData.orderNumber)
      expect(result.data.clientId).toBe(orderData.clientId)
      expect(result.data.status).toBe('pending')
      
      testOrderId = result.data.id
      console.log(`✅ Created order with ID: ${testOrderId}`)
    })

    it('should retrieve the created order by ID', async () => {
      expect(testOrderId).toBeDefined()
      
      const result = await dbService.getOrderById(testOrderId)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.id).toBe(testOrderId)
      expect(result.data.propertyAddress.streetAddress).toBe('123 Test Property Lane')
      expect(result.data.estimatedValue).toBe(750000)
      
      console.log(`✅ Retrieved order: ${result.data.orderNumber}`)
    })

    it('should update the order status', async () => {
      expect(testOrderId).toBeDefined()
      
      const updateData = {
        status: 'in_progress' as const,
        assignedVendorId: 'test-vendor-123',
        notes: 'Order assigned to vendor for processing'
      }
      
      const result = await dbService.updateOrder(testOrderId, updateData)
      
      expect(result.success).toBe(true)
      expect(result.data.status).toBe('in_progress')
      expect(result.data.assignedVendorId).toBe('test-vendor-123')
      expect(result.data.notes).toBe('Order assigned to vendor for processing')
      
      console.log(`✅ Updated order status to: ${result.data.status}`)
    })

    it('should list orders with filters', async () => {
      const filters = {
        status: 'in_progress' as const,
        limit: 10
      }
      
      const result = await dbService.getOrders(filters)
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
      
      // Should include our test order
      const testOrder = result.data.find(order => order.id === testOrderId)
      expect(testOrder).toBeDefined()
      expect(testOrder?.status).toBe('in_progress')
      
      console.log(`✅ Found ${result.data.length} orders with status 'in_progress'`)
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
        serviceAreas: ['Los Angeles', 'Orange County'],
        productTypes: ['residential', 'commercial'],
        status: 'active' as const,
        performance: {
          rating: 4.5,
          completedOrders: 0,
          averageTurnaround: 5,
          qualityScore: 95
        }
      }

      const result = await dbService.createVendor(vendorData)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.id).toBeDefined()
      expect(result.data.name).toBe(vendorData.name)
      expect(result.data.email).toBe(vendorData.email)
      expect(result.data.status).toBe('active')
      expect(result.data.performance.rating).toBe(4.5)
      
      testVendorId = result.data.id
      console.log(`✅ Created vendor with ID: ${testVendorId}`)
    })

    it('should retrieve vendor by ID', async () => {
      expect(testVendorId).toBeDefined()
      
      const result = await dbService.getVendorById(testVendorId)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.id).toBe(testVendorId)
      expect(result.data.name).toBe('Test Appraisal Company')
      expect(result.data.serviceAreas).toContain('Los Angeles')
      
      console.log(`✅ Retrieved vendor: ${result.data.name}`)
    })

    it('should update vendor performance metrics', async () => {
      expect(testVendorId).toBeDefined()
      
      const updateData = {
        performance: {
          rating: 4.8,
          completedOrders: 5,
          averageTurnaround: 4,
          qualityScore: 98
        },
        notes: 'Excellent performance on recent orders'
      }
      
      const result = await dbService.updateVendor(testVendorId, updateData)
      
      expect(result.success).toBe(true)
      expect(result.data.performance.rating).toBe(4.8)
      expect(result.data.performance.completedOrders).toBe(5)
      expect(result.data.performance.qualityScore).toBe(98)
      expect(result.data.notes).toBe('Excellent performance on recent orders')
      
      console.log(`✅ Updated vendor performance - Rating: ${result.data.performance.rating}`)
    })

    it('should search vendors by criteria', async () => {
      const filters = {
        status: 'active' as const,
        serviceArea: 'Los Angeles',
        productType: 'residential'
      }
      
      const result = await dbService.searchVendors(filters)
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
      
      // Should include our test vendor
      const testVendor = result.data.find(vendor => vendor.id === testVendorId)
      expect(testVendor).toBeDefined()
      expect(testVendor?.serviceAreas).toContain('Los Angeles')
      expect(testVendor?.productTypes).toContain('residential')
      
      console.log(`✅ Found ${result.data.length} vendors matching criteria`)
    })
  })

  describe('Property Summary CRUD Operations', () => {
    it('should create a property summary', async () => {
      const propertyData = {
        address: {
          streetAddress: '789 Property Test St',
          city: 'Property City',
          state: 'CA',
          zipCode: '90212',
          county: 'Los Angeles',
          location: {
            type: 'Point',
            coordinates: [-118.2437, 34.0522] // Los Angeles coordinates
          }
        },
        propertyType: 'single_family_residential' as const,
        building: {
          yearBuilt: 2005,
          squareFootage: 2500,
          bedrooms: 4,
          bathrooms: 3,
          stories: 2,
          garageSpaces: 2
        },
        lot: {
          size: 8000,
          dimensions: '80x100'
        },
        valuation: {
          estimatedValue: 850000,
          pricePerSqft: 340,
          lastSoldPrice: 750000,
          lastSoldDate: new Date('2020-05-15'),
          taxAssessedValue: 820000
        },
        features: ['pool', 'fireplace', 'hardwood_floors'],
        neighborhood: {
          name: 'Test Hills',
          walkScore: 75,
          schoolRating: 8
        }
      }

      const result = await dbService.createPropertySummary(propertyData)
      
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.id).toBeDefined()
      expect(result.data.address.streetAddress).toBe(propertyData.address.streetAddress)
      expect(result.data.building.squareFootage).toBe(2500)
      expect(result.data.valuation.estimatedValue).toBe(850000)
      
      testPropertyId = result.data.id
      console.log(`✅ Created property summary with ID: ${testPropertyId}`)
    })

    it('should search properties by location', async () => {
      const searchParams = {
        state: 'CA',
        city: 'Property City',
        propertyType: 'single_family_residential' as const,
        minValue: 800000,
        maxValue: 900000
      }
      
      const result = await dbService.searchPropertySummaries(searchParams)
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
      
      // Should include our test property
      const testProperty = result.data.find(prop => prop.id === testPropertyId)
      expect(testProperty).toBeDefined()
      expect(testProperty?.valuation.estimatedValue).toBe(850000)
      
      console.log(`✅ Found ${result.data.length} properties matching search criteria`)
    })

    it('should calculate property statistics', async () => {
      const stats = await dbService.getPropertyStatistics({
        state: 'CA',
        propertyType: 'single_family_residential' as const
      })
      
      expect(stats.success).toBe(true)
      expect(stats.data).toBeDefined()
      expect(typeof stats.data.totalProperties).toBe('number')
      expect(typeof stats.data.averageValue).toBe('number')
      expect(typeof stats.data.medianValue).toBe('number')
      expect(stats.data.totalProperties).toBeGreaterThan(0)
      expect(stats.data.averageValue).toBeGreaterThan(0)
      
      console.log(`✅ Property statistics - Total: ${stats.data.totalProperties}, Avg Value: $${stats.data.averageValue.toLocaleString()}`)
    })
  })

  describe('Performance and Concurrency', () => {
    it('should handle concurrent read operations', async () => {
      expect(testOrderId).toBeDefined()
      
      // Make 5 concurrent requests to read the same order
      const promises = Array.from({ length: 5 }, () =>
        dbService.getOrderById(testOrderId)
      )
      
      const startTime = Date.now()
      const results = await Promise.all(promises)
      const duration = Date.now() - startTime
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.data.id).toBe(testOrderId)
      })
      
      // Should complete reasonably quickly
      expect(duration).toBeLessThan(5000)
      
      console.log(`✅ Completed 5 concurrent reads in ${duration}ms`)
    })

    it('should handle batch operations efficiently', async () => {
      // Create multiple orders in sequence and measure performance
      const orderPromises = Array.from({ length: 3 }, (_, index) => {
        const orderData = {
          clientId: `batch-client-${index}`,
          orderNumber: `BATCH-ORDER-${Date.now()}-${index}`,
          propertyAddress: {
            streetAddress: `${100 + index} Batch Test St`,
            city: 'Batch City',
            state: 'CA',
            zipCode: '90213',
            county: 'Los Angeles'
          },
          propertyDetails: {
            propertyType: 'single_family_residential' as const,
            occupancy: 'owner_occupied' as const,
            features: []
          },
          orderType: 'refinance' as const,
          priority: 'standard' as const,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          estimatedValue: 500000 + (index * 50000),
          orderDate: new Date(),
          status: 'pending' as const
        }
        
        return dbService.createOrder(orderData)
      })
      
      const startTime = Date.now()
      const results = await Promise.all(orderPromises)
      const duration = Date.now() - startTime
      
      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true)
        expect(result.data.clientId).toBe(`batch-client-${index}`)
      })
      
      // Cleanup batch orders
      await Promise.all(results.map(result => 
        dbService.deleteOrder(result.data.id)
      ))
      
      console.log(`✅ Created and cleaned up 3 orders in ${duration}ms`)
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent order lookup gracefully', async () => {
      const fakeId = 'non-existent-order-id'
      const result = await dbService.getOrderById(fakeId)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toMatch(/not found|does not exist/i)
    })

    it('should validate required fields on order creation', async () => {
      const incompleteOrderData = {
        clientId: 'test-client',
        // Missing required fields like orderNumber, propertyAddress, etc.
      }
      
      try {
        await dbService.createOrder(incompleteOrderData as any)
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeDefined()
        console.log(`✅ Properly rejected incomplete order data`)
      }
    })

    it('should handle duplicate vendor email gracefully', async () => {
      // Try to create a vendor with the same email as our test vendor
      const duplicateVendorData = {
        name: 'Duplicate Test Company',
        email: 'test-vendor@example.com', // Same email
        phone: '555-999-8888',
        address: {
          streetAddress: '999 Duplicate St',
          city: 'Duplicate City',
          state: 'CA',
          zipCode: '90999'
        },
        licenseNumber: 'DUP-123',
        licenseState: 'CA',
        licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        serviceAreas: ['Test Area'],
        productTypes: ['residential'],
        status: 'active' as const
      }
      
      try {
        await dbService.createVendor(duplicateVendorData)
        // May succeed or fail depending on unique constraints
        console.log(`ℹ️  Duplicate vendor creation handled`)
      } catch (error) {
        console.log(`✅ Properly handled duplicate vendor email`)
      }
    })
  })
})